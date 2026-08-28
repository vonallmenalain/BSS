import { Buffer } from 'node:buffer'
import { createSign } from 'node:crypto'
import process from 'node:process'
import { buildApIcs, type IcsActivity } from '../../src/lib/apIcs.ts'

/**
 * Liefert den Aktivitätenplan als abonnierbaren Kalender aus.
 *
 * Erreichbar unter `/api/ap.ics?token=…` (siehe `netlify.toml`). Google,
 * Apple und Outlook rufen diese Adresse von sich aus immer wieder ab und
 * ersetzen damit den ganzen Kalender – deshalb genügt es, hier stets den
 * aktuellen Stand auszugeben. Neue Termine erscheinen, geänderte rücken,
 * gelöschte verschwinden, ohne dass jemand etwas tut.
 *
 * ## Warum es diese Function überhaupt braucht
 *
 * Die App ist sonst eine reine Browser-Anwendung: Sie meldet sich bei
 * Firebase an und liest die Daten selbst. Ein Kalenderprogramm kann das
 * nicht – es ruft eine Adresse ab, sonst nichts. Es braucht deshalb eine
 * Stelle, die sich für den Abruf anmeldet, und das ist diese hier.
 *
 * ## Wie sie sich anmeldet
 *
 * Mit einem Dienstkonto von Google, nicht mit einem Benutzerkonto. Der
 * Schlüssel dazu steht in `FIREBASE_SERVICE_ACCOUNT`. Daraus entsteht ein
 * kurzlebiges Zugriffstoken, mit dem die Firestore-REST-Schnittstelle
 * antwortet.
 *
 * Bewusst ohne `firebase-admin`: Das Paket bringt gRPC und einiges mehr mit,
 * was sich in einer Function nur mit Sonderbehandlung bündeln lässt. Was
 * hier gebraucht wird – ein signiertes JWT, zwei Abfragen, ein
 * Schreibvorgang – steht in wenigen Dutzend Zeilen darunter und hat dafür
 * keine einzige Abhängigkeit, die brechen könnte.
 *
 * ## Zwei Adressen, ein Plan
 *
 * **Ohne Token** – `/api/ap.ics` – kommt der ganze Plan heraus. Das ist der
 * Link, den man weitergibt, seit die Seite unter `/ap` ohnehin jedem
 * offensteht: Ein Token schützte hier nichts mehr, es machte den Link bloss
 * lang und den Weg dorthin umständlich. Wer den Plan lesen darf – und das
 * darf jeder –, darf ihn auch abonnieren.
 *
 * **Mit Token** – `/api/ap.ics?token=…` – wird das Token gegen die Sammlung
 * `calendarFeeds` geprüft. Diese Links bleiben, weil sie etwas können, was
 * der öffentliche nicht kann: Sie zeigen wahlweise nur bestimmte Arten von
 * Terminen, und an ihnen steht, wann ein Kalenderprogramm zuletzt vorbeikam.
 * Ein unbekanntes oder widerrufenes Token bekommt 404 und keine Auskunft
 * darüber, welches von beidem zutraf.
 *
 * Das Dienstkonto geht an den Sicherheitsregeln vorbei. Es gibt
 * ausschliesslich den Aktivitätenplan heraus, nie etwas anderes – die
 * Abfragen darunter nennen die Sammlungen einzeln beim Namen.
 */

/* ------------------------------------------------------------------ */
/* Einstellungen                                                       */
/* ------------------------------------------------------------------ */

/**
 * Welcher Zeitraum im Kalender landet.
 *
 * Nicht der ganze Bestand: Ein Kalenderprogramm lädt die Datei bei jedem
 * Abruf vollständig, und Termine von vorgestern interessieren dabei
 * niemanden. Ein halbes Jahr zurück reicht, um nachzusehen, was war; zwei
 * Jahre voraus decken die Jahresplanung ab, auch wenn sie früh beginnt.
 */
const MONTHS_BACK = 6
const MONTHS_AHEAD = 24

/** Wie viele Dokumente eine Abfrage auf einmal holt. */
const PAGE_SIZE = 500

/** Notbremse gegen eine Abfrage ohne Ende. Ein Jahresplan hat einige Hundert Termine. */
const MAX_ACTIVITIES = 5000

/**
 * Wie oft der Abrufzeitpunkt festgehalten wird.
 *
 * Er beantwortet die einzige Frage, die bei einem Abo aufkommt – «holt Google
 * den Link überhaupt?». Bei jedem Abruf zu schreiben wäre dafür zu viel;
 * alle zehn Minuten genügt.
 */
const TOUCH_AFTER_MS = 10 * 60 * 1000

/**
 * Wie lange der öffentliche Feed gemerkt wird.
 *
 * Ohne Token kann die Adresse jeder abrufen, auch mehrmals in der Minute –
 * und jeder Abruf läse sonst den ganzen Plan aus Firestore. Ein
 * Kalenderprogramm schaut alle paar Stunden vorbei; zehn Minuten Verzug
 * bemerkt dort niemand, und die Datenbank bleibt verschont.
 *
 * Gemerkt wird im Speicher der laufenden Function. Sie friert zwischen den
 * Abrufen ein und startet irgendwann neu – der Vorrat gilt also nur für eine
 * warme Instanz und ist keine Zusage, sondern eine Erleichterung. Genau die
 * Abrufe, die kurz hintereinander kommen, fängt er ab.
 */
const PUBLIC_CACHE_MS = 10 * 60 * 1000

/** Der zuletzt gebaute öffentliche Feed – siehe `PUBLIC_CACHE_MS`. */
let publicFeed: { ics: string; builtAt: number } | null = null

const FIRESTORE = 'https://firestore.googleapis.com/v1'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/datastore'

/**
 * Beim Entwickeln gegen den Firestore-Emulator.
 *
 * `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` ist die Schreibweise, die auch
 * Googles eigene Bibliotheken verstehen. Der Emulator kennt keine Anmeldung
 * und keine Dienstkonten – gesetzt, entfällt beides, und `netlify dev`
 * liefert den Feed aus den Testdaten aus.
 *
 * In der Produktion ist der Wert nicht gesetzt, und dann führt kein Weg an
 * der Anmeldung vorbei.
 */
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST

/* ------------------------------------------------------------------ */
/* Dienstkonto und Zugriffstoken                                       */
/* ------------------------------------------------------------------ */

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

/**
 * Der Schlüssel aus der Umgebung.
 *
 * Als JSON oder – wenn die Zeilenumbrüche im privaten Schlüssel unterwegs
 * Schaden nehmen – als Base64 davon. Beides wird angenommen, weil beides
 * vorkommt, je nachdem wie der Wert in die Netlify-Oberfläche gelangt ist.
 */
function serviceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT ist nicht gesetzt.')

  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = JSON.parse(text) as ServiceAccount

  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT ist unvollständig.')
  }

  // Ein durch Kopieren verlorener Zeilenumbruch ist der häufigste Grund,
  // aus dem die Signatur scheitert – «\n» als zwei Zeichen zurückbiegen.
  parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  return parsed
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Das Zugriffstoken, über Aufrufe hinweg behalten.
 *
 * Eine warme Function bedient mehrere Abrufe nacheinander; jedes Mal neu bei
 * Google anzufragen wäre eine Netzrunde ohne Gewinn. Eine Minute Sicherheit
 * vor dem Ablauf, damit kein Abruf in die Lücke fällt.
 */
let cached: { token: string; expiresAt: number } | null = null

async function accessToken(account: ServiceAccount): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    }),
  )

  const signature = base64url(
    createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key),
  )

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Anmeldung beim Dienstkonto scheiterte (${response.status}).`)
  }

  const body = (await response.json()) as { access_token: string; expires_in: number }
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  return body.access_token
}

/* ------------------------------------------------------------------ */
/* Firestore über REST                                                 */
/* ------------------------------------------------------------------ */

/** Ein Firestore-Wert, wie ihn die REST-Schnittstelle verpackt. */
type FirestoreValue = Record<string, unknown>

interface FirestoreDocument {
  name: string
  fields?: Record<string, FirestoreValue>
}

/** Aus «projects/x/databases/(default)/documents/apActivities/abc» wird «abc». */
function idOf(document: FirestoreDocument): string {
  return document.name.split('/').pop() ?? ''
}

/**
 * Einen Wert auspacken.
 *
 * Firestore benennt in REST den Typ jedes Feldes mit («stringValue»,
 * «timestampValue» …). Für die Felder dieses Plans genügen die einfachen
 * Fälle; alles Unbekannte wird zu `null`, statt den Abruf scheitern zu lassen.
 */
function decode(value: FirestoreValue | undefined): unknown {
  if (!value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return new Date(value.timestampValue as string)
  if ('arrayValue' in value) {
    const array = value.arrayValue as { values?: FirestoreValue[] }
    return (array.values ?? []).map(decode)
  }
  return null
}

function field(document: FirestoreDocument, name: string): unknown {
  return decode(document.fields?.[name])
}

function text(document: FirestoreDocument, name: string): string {
  const value = field(document, name)
  return typeof value === 'string' ? value : ''
}

interface Client {
  base: string
  projectId: string
  authorization: string
}

/**
 * Den Zugang herstellen – aus dem Dienstkonto oder gegen den Emulator.
 *
 * Am Emulator genügt die Projekt-ID; sie steht ohnehin schon in der `.env`
 * für die App selbst. Das «Bearer owner» ist dort die vereinbarte
 * Schreibweise für einen Zugriff, der an den Sicherheitsregeln vorbeigeht –
 * und damit genau das, was in der Produktion das Dienstkonto tut. Ohne das
 * prüfte der Emulator die Regeln und wiese den Abruf ab, während er in der
 * Produktion durchginge: Der lokale Versuch verlöre seine Aussagekraft.
 */
async function connect(): Promise<Client> {
  if (EMULATOR_HOST) {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID
    if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID fehlt für den Emulator.')
    return { base: `http://${EMULATOR_HOST}/v1`, projectId, authorization: 'Bearer owner' }
  }

  const account = serviceAccount()
  return {
    base: FIRESTORE,
    projectId: account.project_id,
    authorization: `Bearer ${await accessToken(account)}`,
  }
}

async function firestore(client: Client, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${client.base}/projects/${client.projectId}/databases/(default)${path}`, {
    ...init,
    headers: {
      Authorization: client.authorization,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

/**
 * Eine Abfrage ausführen.
 *
 * Die Antwort ist eine Liste, in der auch Einträge ohne Dokument vorkommen –
 * Firestore meldet damit den Lesezeitpunkt einer leeren Antwort. Die fallen
 * hier weg.
 */
async function runQuery(
  client: Client,
  query: Record<string, unknown>,
): Promise<FirestoreDocument[]> {
  const response = await firestore(client, '/documents:runQuery', {
    method: 'POST',
    body: JSON.stringify({ structuredQuery: query }),
  })

  if (!response.ok) {
    throw new Error(`Firestore-Abfrage scheiterte (${response.status}): ${await response.text()}`)
  }

  const rows = (await response.json()) as { document?: FirestoreDocument }[]
  return rows.flatMap((row) => (row.document ? [row.document] : []))
}

/** Dieselbe Abfrage seitenweise, bis nichts mehr kommt. */
async function runQueryAll(
  client: Client,
  query: Record<string, unknown>,
  max: number,
): Promise<FirestoreDocument[]> {
  const all: FirestoreDocument[] = []

  for (let offset = 0; offset < max; offset += PAGE_SIZE) {
    const page = await runQuery(client, { ...query, offset, limit: PAGE_SIZE })
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return all
}

function equals(fieldPath: string, value: string) {
  return { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } } }
}

function between(fieldPath: string, from: string, to: string) {
  return {
    compositeFilter: {
      op: 'AND',
      filters: [
        {
          fieldFilter: {
            field: { fieldPath },
            op: 'GREATER_THAN_OR_EQUAL',
            value: { stringValue: from },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath },
            op: 'LESS_THAN_OR_EQUAL',
            value: { stringValue: to },
          },
        },
      ],
    },
  }
}

/* ------------------------------------------------------------------ */
/* Zeitraum                                                            */
/* ------------------------------------------------------------------ */

/** Ein Tagesschlüssel «2026-08-07», um Monate verschoben. */
function shiftedDay(from: Date, months: number): string {
  const shifted = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, from.getUTCDate()),
  )
  return shifted.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Die Antwort                                                         */
/* ------------------------------------------------------------------ */

const ICS_HEADERS = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="aktivitaeten-ap.ics"',
  /*
   * Nie aus einem Zwischenspeicher bedienen.
   *
   * Der Sinn eines Abos ist der aktuelle Stand. Google und Apple fragen
   * ohnehin nur alle paar Stunden an – da ist mit Caching nichts zu gewinnen,
   * wohl aber ein veralteter Plan zu verlieren.
   */
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

function fail(status: number, message: string): Response {
  return new Response(`${message}\n`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  /*
   * Kein Token heisst nicht «unvollständig», sondern «der öffentliche Feed».
   *
   * Bis der Plan öffentlich wurde, war das hier ein Fehler (400). Heute ist
   * es der Normalfall: `/api/ap.ics` ohne alles gibt den ganzen Plan heraus,
   * und ein Token schränkt ihn höchstens noch ein.
   */
  const token = new URL(request.url).searchParams.get('token')?.trim()

  if (!token && publicFeed && Date.now() - publicFeed.builtAt < PUBLIC_CACHE_MS) {
    return new Response(publicFeed.ics, { status: 200, headers: ICS_HEADERS })
  }

  let client: Client
  try {
    client = await connect()
  } catch (error) {
    // Ein Konfigurationsfehler steht im Protokoll, nicht in der Antwort:
    // Wer die Adresse abruft, muss nichts über den Aufbau dahinter erfahren.
    console.error('[ap-ics] Anmeldung nicht möglich:', error)
    return fail(500, 'Der Kalender steht gerade nicht zur Verfügung.')
  }

  try {
    /* ---- Das Abo heraussuchen – wenn eines genannt ist ---- */

    let feed: FirestoreDocument | null = null
    let wanted: Set<string> | null = null

    if (token) {
      ;[feed] = await runQuery(client, {
        from: [{ collectionId: 'calendarFeeds' }],
        where: equals('token', token),
        limit: 1,
      })

      /*
       * Unbekannt und widerrufen ergeben dieselbe Antwort.
       *
       * Ein «403 – widerrufen» bestätigte, dass es das Token einmal gab, und
       * ein Unterschied in der Antwortzeit täte dasselbe. 404 sagt nur, dass
       * hier nichts zu holen ist.
       *
       * Ein widerrufener Link führt bewusst **nicht** auf den öffentlichen
       * Feed: Wer widerruft, will diesen Kalender leerlaufen lassen – ihn
       * stattdessen kommentarlos weiterzubedienen wäre das Gegenteil dessen,
       * was der Knopf verspricht.
       */
      if (!feed || field(feed, 'active') !== true) {
        return fail(404, 'Dieser Kalender-Link ist nicht (mehr) gültig.')
      }

      const kinds = field(feed, 'kinds')
      wanted = Array.isArray(kinds) && kinds.length > 0 ? new Set(kinds as string[]) : null
    }

    /* ---- Termine, Monate und der Gemeindename ---- */

    const today = new Date()
    const from = shiftedDay(today, -MONTHS_BACK)
    const to = shiftedDay(today, MONTHS_AHEAD)

    const [activityDocs, monthDocs, wardName] = await Promise.all([
      runQueryAll(
        client,
        {
          from: [{ collectionId: 'apActivities' }],
          where: between('date', from, to),
          orderBy: [{ field: { fieldPath: 'date' }, direction: 'ASCENDING' }],
        },
        MAX_ACTIVITIES,
      ),
      runQuery(client, { from: [{ collectionId: 'apMonths' }], limit: 500 }),
      settingsWardName(client),
    ])

    const activities: IcsActivity[] = activityDocs
      .filter((document) => !wanted || wanted.has(text(document, 'kind')))
      .map((document) => {
        const updatedAt = field(document, 'updatedAt')
        return {
          id: idOf(document),
          date: text(document, 'date'),
          endDate: text(document, 'endDate') || null,
          time: text(document, 'time'),
          endTime: text(document, 'endTime'),
          kind: (text(document, 'kind') || 'activity') as IcsActivity['kind'],
          title: text(document, 'title'),
          location: text(document, 'location'),
          leader: text(document, 'leader'),
          bishopric: text(document, 'bishopric'),
          advisor: text(document, 'advisor'),
          note: text(document, 'note'),
          updatedAt: updatedAt instanceof Date ? updatedAt : null,
        }
      })

    const leadership = new Map(
      monthDocs.map((document) => [text(document, 'month'), text(document, 'leadership')]),
    )

    /* ---- Ausliefern ---- */

    const name = wardName ? `Aktivitäten AP – ${wardName}` : 'Aktivitäten AP'
    const ics = buildApIcs(activities, {
      name,
      domain: new URL(request.url).host,
      now: new Date(),
      description: 'Der Aktivitätenplan der Priestertumskollegien.',
      leadership,
    })

    if (feed) {
      // Erst antworten wäre schöner, geht aber nicht: Nach der Antwort friert
      // die Function ein. Der Vermerk ist ein einzelner Schreibvorgang und
      // scheitert im Zweifel lautlos – der Kalender hängt nicht daran.
      await touch(client, feed).catch((error) => {
        console.warn('[ap-ics] Abrufzeitpunkt nicht vermerkt:', error)
      })
    } else {
      // Der öffentliche Feed hat keinen Ort, an dem ein Abruf vermerkt werden
      // könnte – er hat dafür einen Vorrat für den nächsten (`PUBLIC_CACHE_MS`).
      publicFeed = { ics, builtAt: Date.now() }
    }

    return new Response(ics, { status: 200, headers: ICS_HEADERS })
  } catch (error) {
    console.error('[ap-ics] Abruf gescheitert:', error)
    return fail(500, 'Der Kalender konnte nicht erstellt werden.')
  }
}

/** Der Name der Gemeinde für die Kalenderbeschriftung – fehlt er, geht es auch ohne. */
async function settingsWardName(client: Client): Promise<string> {
  try {
    const response = await firestore(client, '/documents/settings/app')
    if (!response.ok) return ''
    return text((await response.json()) as FirestoreDocument, 'wardName').trim()
  } catch {
    return ''
  }
}

/** Festhalten, dass der Link abgerufen wurde – höchstens alle paar Minuten. */
async function touch(client: Client, feed: FirestoreDocument): Promise<void> {
  const last = field(feed, 'lastFetchedAt')
  if (last instanceof Date && Date.now() - last.getTime() < TOUCH_AFTER_MS) return

  const path = feed.name.slice(feed.name.indexOf('/documents'))
  await firestore(client, `${path}?updateMask.fieldPaths=lastFetchedAt`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: { lastFetchedAt: { timestampValue: new Date().toISOString() } },
    }),
  })
}
