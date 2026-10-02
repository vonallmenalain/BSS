import { Buffer } from 'node:buffer'
import { createSign } from 'node:crypto'
import process from 'node:process'
import {
  buildCleaningIcs,
  parseCalendarGroup,
  type IcsCleaningWeek,
} from '../../src/lib/cleaningIcs.ts'

/**
 * Die Putzwochen einer Gruppe als abonnierbarer Kalender.
 *
 * Erreichbar unter `/.netlify/functions/putzplan-ics?gruppe=5`, ohne
 * Umleitung – der Dialog «Kalender» über dem Putzplan gibt die Adresse
 * heraus (`services/cleaningCalendar`). Wie beim Kalender des
 * Aktivitätenplans (`ap-ics.mts`) holen Google und Apple die Datei unter
 * der Adresse immer wieder selbst: Wird der Plan neu generiert – etwa weil
 * eine Pfahlkonferenz dazukam –, rücken die Wochen im Kalender von selbst
 * mit.
 *
 * Ohne Anmeldung und ohne Token: Der Putzplan steht ohnehin jedem offen
 * (`firestore.rules`), ein Geheimnis in der Adresse schützte nichts. Die
 * Function liest mit dem Dienstkonto und gibt allein `cleaningWeeks`
 * heraus, nie etwas anderes; dazu den Namen der Gemeinde für die
 * Beschriftung.
 */

/** Wie weit zurück und voraus der Kalender reicht. */
const MONTHS_BACK = 3
const MONTHS_AHEAD = 24

/** Mehr Wochen hat kein Plan – eine Notbremse, keine Grenze. */
const MAX_WEEKS = 500

/**
 * Wie lange ein gebauter Kalender je Gruppe gemerkt wird.
 *
 * Die Adresse steht jedem offen und könnte mehrmals in der Minute abgerufen
 * werden; jeder Abruf läse sonst den Plan aus Firestore. Ein Kalender
 * schaut alle paar Stunden vorbei – zehn Minuten Verzug merkt dort
 * niemand. Gemerkt wird im Speicher einer warmen Instanz, wie in
 * `ap-ics.mts`: eine Erleichterung, keine Zusage.
 */
const CACHE_MS = 10 * 60 * 1000
const feeds = new Map<number, { ics: string; builtAt: number }>()

const FIRESTORE = 'https://firestore.googleapis.com/v1'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/datastore'

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST

/* ------------------------------------------------------------------ */
/* Dienstkonto und Zugriffstoken – wie in ap-ics.mts                   */
/* ------------------------------------------------------------------ */

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT ist nicht gesetzt.')

  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = JSON.parse(text) as ServiceAccount

  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT ist unvollständig.')
  }

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

type FirestoreValue = Record<string, unknown>

interface FirestoreDocument {
  name: string
  fields?: Record<string, FirestoreValue>
}

function text(document: FirestoreDocument, name: string): string {
  return (document.fields?.[name]?.stringValue as string) ?? ''
}

function timestamp(document: FirestoreDocument, name: string): Date | null {
  const raw = document.fields?.[name]?.timestampValue as string | undefined
  return raw ? new Date(raw) : null
}

interface Client {
  base: string
  projectId: string
  authorization: string
}

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

/** Die Wochen im Zeitraum – nach Datum, alle Gruppen (gefiltert wird danach). */
async function weeksBetween(
  client: Client,
  from: string,
  to: string,
): Promise<FirestoreDocument[]> {
  const response = await firestore(client, '/documents:runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'cleaningWeeks' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'startDate' },
                  op: 'GREATER_THAN_OR_EQUAL',
                  value: { stringValue: from },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'startDate' },
                  op: 'LESS_THAN_OR_EQUAL',
                  value: { stringValue: to },
                },
              },
            ],
          },
        },
        limit: MAX_WEEKS,
      },
    }),
  })
  if (!response.ok) {
    throw new Error(`Firestore-Abfrage scheiterte (${response.status}): ${await response.text()}`)
  }
  const rows = (await response.json()) as { document?: FirestoreDocument }[]
  return rows.flatMap((row) => (row.document ? [row.document] : []))
}

/** Der Name der Gemeinde für die Beschriftung – fehlt er, geht es auch ohne. */
async function wardName(client: Client): Promise<string> {
  try {
    const response = await firestore(client, '/documents/settings/app')
    if (!response.ok) return ''
    return text((await response.json()) as FirestoreDocument, 'wardName').trim()
  } catch {
    return ''
  }
}

/** Ein Tagesschlüssel «2026-10-02», um Monate verschoben. */
function shiftedDay(from: Date, months: number): string {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, from.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Die Antwort                                                         */
/* ------------------------------------------------------------------ */

function icsHeaders(group: number): HeadersInit {
  return {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="putzplan-gruppe-${group}.ics"`,
    // Der Sinn eines Abos ist der aktuelle Stand – kein Zwischenspeicher.
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  }
}

function fail(status: number, message: string): Response {
  return new Response(`${message}\n`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const group = parseCalendarGroup(url.searchParams.get('gruppe'))
  if (group === null) return fail(400, 'Welche Gruppe? Die Adresse braucht «?gruppe=5».')

  const remembered = feeds.get(group)
  if (remembered && Date.now() - remembered.builtAt < CACHE_MS) {
    return new Response(remembered.ics, { status: 200, headers: icsHeaders(group) })
  }

  let client: Client
  try {
    client = await connect()
  } catch (error) {
    console.error('[putzplan-ics] Anmeldung nicht möglich:', error)
    return fail(500, 'Der Kalender steht gerade nicht zur Verfügung.')
  }

  try {
    const today = new Date()
    const [documents, ward] = await Promise.all([
      weeksBetween(client, shiftedDay(today, -MONTHS_BACK), shiftedDay(today, MONTHS_AHEAD)),
      wardName(client),
    ])

    const weeks: IcsCleaningWeek[] = documents.map((document) => ({
      startDate: text(document, 'startDate'),
      endDate: text(document, 'endDate'),
      group: text(document, 'group'),
      team: text(document, 'team'),
      note: text(document, 'note'),
      updatedAt: timestamp(document, 'updatedAt'),
    }))

    const ics = buildCleaningIcs(weeks, {
      group,
      name: ward ? `Putzplan Gruppe ${group} – ${ward}` : `Putzplan Gruppe ${group}`,
      domain: url.host,
      now: new Date(),
      planUrl: `${url.origin}/putzplan`,
    })
    feeds.set(group, { ics, builtAt: Date.now() })
    return new Response(ics, { status: 200, headers: icsHeaders(group) })
  } catch (error) {
    console.error('[putzplan-ics] Abruf gescheitert:', error)
    return fail(500, 'Der Kalender konnte nicht erstellt werden.')
  }
}
