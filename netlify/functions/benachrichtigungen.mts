import { Buffer } from 'node:buffer'
import { createSign } from 'node:crypto'
import process from 'node:process'
import { impulseWeekKey } from '../../src/lib/impulse.ts'
import {
  agendaDue,
  agendaMessage,
  firstName,
  impulsMessage,
  meetingDue,
  meetingMessage,
  scheduleDue,
  type PushMessage,
} from '../../src/lib/notifications.ts'
import type { NotificationMode } from '../../src/lib/types.ts'

/**
 * Der Versand aller Benachrichtigungen.
 *
 * Läuft alle Viertelstunde (siehe `config` zuunterst) und fragt jedes Mal
 * dasselbe: Wer hat sich etwas bestellt, und ist es jetzt so weit? Drei
 * Anlässe kennt er:
 *
 *   1. **Anti Doom** – die Erinnerung an die neue Woche, zur selbst gewählten
 *      Zeit. Eine Woche ohne bereiten Inhalt bleibt still; eine
 *      Benachrichtigung ohne Inhalt wäre genau die Mahnung, die der
 *      Bereich nie sein will (Leitgedanke 1 des Konzepts).
 *   2. **Neue Traktanden** – gesammelt, mit Mindestabstand und nie für das,
 *      was man selbst angelegt hat.
 *   3. **Eine Stunde vor der Sitzung** – mit Anzahl Traktanden und
 *      Pendenzen.
 *
 * Wann etwas fällig ist, rechnet `src/lib/notifications.ts` – dieselbe
 * Datei, die auch die Einstellungen in der App beschriften. Hier steht nur,
 * woher die Daten kommen und wie die Nachricht auf das Gerät gelangt.
 *
 * Angemeldet wird wie beim Kalender-Feed (`ap-ics.mts`) mit dem Dienstkonto
 * aus `FIREBASE_SERVICE_ACCOUNT` – derselbe Schlüssel, ein zweiter
 * Geltungsbereich: Neben Firestore braucht es hier Cloud Messaging. Der
 * VAPID-Schlüssel spielt beim Senden keine Rolle; er gehört der App beim
 * Anmelden des Geräts (`VITE_FIREBASE_VAPID_KEY`), den privaten Teil
 * verwahrt Firebase.
 *
 * Abgelaufene Geräte-Adressen (Konto abgemeldet, App gelöscht) meldet Cloud
 * Messaging als «UNREGISTERED» – sie werden im selben Lauf weggeräumt,
 * damit die Liste nicht versandet.
 */

const FIRESTORE = 'https://firestore.googleapis.com/v1'
const FCM = 'https://fcm.googleapis.com/v1'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPE =
  'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging'

/** Mehr Konten und Geräte wird eine Gemeinde nie haben. */
const MAX_DOCUMENTS = 500

/**
 * Rollen mit Vollzugriff – dieselbe Liste wie in `src/lib/types.ts` und in
 * den Zugriffsregeln. Traktanden und Sitzungen gehen nur an sie: Wer die
 * Sitzung gar nicht sehen darf, soll auch nicht erfahren, dass sie
 * gewachsen ist.
 */
const FULL_ACCESS = new Set([
  'bishop',
  'counselor1',
  'counselor2',
  'executive_secretary',
  'secretary',
  'counselor',
])

/** Status, die als «noch zu tun» gelten – wie `OPEN_STATUSES` in lib/types. */
const OPEN_STATUSES = new Set(['new', 'pending'])

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

function idOf(document: FirestoreDocument): string {
  return document.name.split('/').pop() ?? ''
}

/** Die REST-Darstellung eines Feldes in etwas Handliches übersetzen. */
function text(document: FirestoreDocument, field: string): string {
  return (document.fields?.[field]?.stringValue as string) ?? ''
}

function bool(document: FirestoreDocument, path: string[]): boolean {
  return value(document, path)?.booleanValue === true
}

/**
 * Ein Feld – auch tief in einer verschachtelten Karte («impuls.on»).
 *
 * Firestore verpackt über REST jeden Wert in seinen Typ (`stringValue`,
 * `mapValue` …); eine Karte trägt ihre Felder unter `mapValue.fields`.
 * Diese Schleife hangelt sich daran entlang und gibt die Verpackung
 * zurück – das Auspacken erledigen `bool()` und `number()`.
 */
function value(document: FirestoreDocument, path: string[]): FirestoreValue | undefined {
  let fields: Record<string, FirestoreValue> | undefined = document.fields
  let current: FirestoreValue | undefined

  for (const key of path) {
    current = fields?.[key]
    if (!current) return undefined
    fields = (current.mapValue as { fields?: Record<string, FirestoreValue> } | undefined)?.fields
  }
  return current
}

function timestamp(document: FirestoreDocument, field: string): Date | null {
  const raw = document.fields?.[field]?.timestampValue as string | undefined
  return raw ? new Date(raw) : null
}

/**
 * Eine Zahl aus einem Feld – gleichgültig, ob Firestore sie als ganze Zahl
 * oder als Fliesskommazahl zurückgibt. Ganze Zahlen kommen als Zeichenkette
 * («1»), und beides ist je nach Herkunft möglich.
 */
function number(field: FirestoreValue | undefined, fallback: number): number {
  const raw = field?.integerValue ?? field?.doubleValue
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function strings(document: FirestoreDocument, field: string): string[] {
  const values = (document.fields?.[field]?.arrayValue as { values?: FirestoreValue[] })?.values
  return (values ?? []).map((entry) => (entry.stringValue as string) ?? '').filter(Boolean)
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

async function collectionOf(client: Client, id: string): Promise<FirestoreDocument[]> {
  return runQuery(client, { from: [{ collectionId: id }], limit: MAX_DOCUMENTS })
}

function equals(fieldPath: string, value: string) {
  return { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } } }
}

function after(fieldPath: string, date: Date) {
  return {
    fieldFilter: {
      field: { fieldPath },
      op: 'GREATER_THAN',
      value: { timestampValue: date.toISOString() },
    },
  }
}

function between(fieldPath: string, from: Date, to: Date) {
  return {
    compositeFilter: {
      op: 'AND',
      filters: [
        {
          fieldFilter: {
            field: { fieldPath },
            op: 'GREATER_THAN_OR_EQUAL',
            value: { timestampValue: from.toISOString() },
          },
        },
        {
          fieldFilter: {
            field: { fieldPath },
            op: 'LESS_THAN_OR_EQUAL',
            value: { timestampValue: to.toISOString() },
          },
        },
      ],
    },
  }
}

/**
 * Eine Marke des Versands fortschreiben.
 *
 * Nur die genannten Felder, nie das ganze Dokument: Die Einstellungen
 * daneben gehören der Person, und ein vollständiges Schreiben würde eine
 * Änderung überfahren, die sie im selben Moment vornimmt.
 */
async function mark(
  client: Client,
  uid: string,
  fields: Record<string, FirestoreValue>,
): Promise<void> {
  const mask = Object.keys(fields)
    .map((field) => `updateMask.fieldPaths=${field}`)
    .join('&')

  const response = await firestore(
    client,
    `/documents/notificationSettings/${encodeURIComponent(uid)}?${mask}`,
    { method: 'PATCH', body: JSON.stringify({ fields }) },
  )

  if (!response.ok) {
    console.error(`[benachrichtigungen] Marke nicht gesetzt (${response.status})`)
  }
}

/* ------------------------------------------------------------------ */
/* Cloud Messaging                                                     */
/* ------------------------------------------------------------------ */

/**
 * Eine Nachricht an ein Gerät.
 *
 * Zurückgemeldet wird, ob die Adresse noch gilt: «UNREGISTERED» (oder 404)
 * heisst, das Gerät ist weg – die Adresse wird danach weggeräumt.
 */
async function sendTo(
  client: Client,
  token: string,
  message: PushMessage,
  options: { url: string; tag: string },
): Promise<'sent' | 'gone' | 'failed'> {
  const response = await fetch(`${FCM}/projects/${client.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: client.authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        data: { url: options.url },
        webpush: {
          headers: { TTL: '172800', Urgency: 'normal' },
          notification: {
            title: message.title,
            body: message.body,
            icon: '/icons/icon-192.png',
            tag: options.tag,
          },
        },
      },
    }),
  })

  if (response.ok) return 'sent'

  const body = await response.text()
  if (response.status === 404 || body.includes('UNREGISTERED')) return 'gone'

  console.error(`[benachrichtigungen] Senden scheiterte (${response.status}): ${body}`)
  return 'failed'
}

/* ------------------------------------------------------------------ */
/* Der Lauf                                                            */
/* ------------------------------------------------------------------ */

interface Recipient {
  uid: string
  tokens: string[]
  fullAccess: boolean
  impulse: boolean
  settings: FirestoreDocument
}

export default async function handler(): Promise<Response> {
  const client = await connect()
  const now = new Date()

  const settings = await collectionOf(client, 'notificationSettings')
  if (settings.length === 0) {
    return new Response('Niemand hat Benachrichtigungen eingestellt.', { status: 200 })
  }

  const [tokenDocs, userDocs] = await Promise.all([
    collectionOf(client, 'pushTokens'),
    collectionOf(client, 'users'),
  ])

  const tokensByUid = new Map<string, string[]>()
  for (const document of tokenDocs) {
    const uid = text(document, 'uid')
    if (!uid) continue
    tokensByUid.set(uid, [...(tokensByUid.get(uid) ?? []), idOf(document)])
  }

  const users = new Map(userDocs.map((document) => [idOf(document), document]))

  const recipients: Recipient[] = settings.flatMap((document) => {
    const uid = idOf(document)
    const user = users.get(uid)
    // Wer kein Profil (mehr) hat, bekommt nichts – dieselbe Linie wie in
    // den Zugriffsregeln, nur auf der anderen Seite der Leitung.
    if (!user || user.fields?.active?.booleanValue !== true) return []

    const role = text(user, 'role')
    return [
      {
        uid,
        tokens: tokensByUid.get(uid) ?? [],
        fullAccess: FULL_ACCESS.has(role),
        // Der Schalter am Konto – oder das Administrator-Konto, das den
        // Bereich immer sieht. Dieselbe Adresse steht in `firestore.rules`
        // und in `src/lib/types.ts`; sie ändert sich an drei Orten oder an
        // keinem.
        impulse:
          bool(user, ['impulse']) ||
          bool(user, ['impulseEditor']) ||
          text(user, 'email') === 'alain.sc2@gmail.com',
        settings: document,
      },
    ]
  })

  const withDevices = recipients.filter((recipient) => recipient.tokens.length > 0)
  if (withDevices.length === 0) {
    return new Response('Kein angemeldetes Gerät.', { status: 200 })
  }

  const outbox: { recipient: Recipient; message: PushMessage; url: string; tag: string }[] = []
  const marks: { uid: string; fields: Record<string, FirestoreValue> }[] = []

  /* --- 1. Anti Doom -------------------------------------------------- */

  const impulsSchedule = (recipient: Recipient) => ({
    mode:
      (value(recipient.settings, ['impuls', 'mode'])?.stringValue as NotificationMode) ?? 'weekly',
    weekday: number(value(recipient.settings, ['impuls', 'weekday']), 1),
    time: (value(recipient.settings, ['impuls', 'time'])?.stringValue as string) ?? '08:00',
  })

  const impulsWaiting = withDevices.filter(
    (recipient) =>
      recipient.impulse &&
      bool(recipient.settings, ['impuls', 'on']) &&
      scheduleDue(impulsSchedule(recipient), now, timestamp(recipient.settings, 'impulsSentAt')),
  )

  if (impulsWaiting.length > 0) {
    const week = impulseWeekKey(now)
    const ready = await runQuery(client, {
      from: [{ collectionId: 'impulseItems' }],
      where: {
        compositeFilter: { op: 'AND', filters: [equals('week', week), equals('status', 'ready')] },
      },
      limit: 1,
    })

    // Eine leere Woche bleibt still – und merkt sich auch nichts: Kommt der
    // Inhalt eine Stunde später, greift die Erinnerung noch im Nachlauf.
    if (ready.length > 0) {
      for (const recipient of impulsWaiting) {
        outbox.push({
          recipient,
          message: impulsMessage(impulsSchedule(recipient).mode),
          url: '/anti-doom',
          // Beim Tagestakt trägt der Anker den Tag, sonst käme die
          // Nachricht von gestern der von heute in die Quere.
          tag: `impuls-${week}-${impulsSchedule(recipient).mode === 'daily' ? now.toISOString().slice(0, 10) : 'woche'}`,
        })
        marks.push({
          uid: recipient.uid,
          fields: { impulsSentAt: { timestampValue: now.toISOString() } },
        })
      }
    }
  }

  /* --- 2. Neue Traktanden ------------------------------------------- */

  const agendaWaiting = withDevices.filter(
    (recipient) =>
      recipient.fullAccess &&
      bool(recipient.settings, ['agenda', 'on']) &&
      agendaDue(now, timestamp(recipient.settings, 'agendaSentAt')),
  )

  if (agendaWaiting.length > 0) {
    /*
     * Der Anfangspunkt je Person: die letzte Meldung – und mindestens der
     * Moment, in dem die Einstellungen zuletzt angefasst wurden. Damit
     * beginnt das Einschalten bei null statt mit einem Schwall über alles
     * Vergangene.
     */
    const since = new Map(
      agendaWaiting.map((recipient) => {
        const sent = timestamp(recipient.settings, 'agendaSentAt')?.getTime() ?? 0
        const changed = timestamp(recipient.settings, 'updatedAt')?.getTime() ?? 0
        return [recipient.uid, new Date(Math.max(sent, changed))]
      }),
    )

    const earliest = new Date(Math.min(...[...since.values()].map((date) => date.getTime())))
    const fresh = await runQuery(client, {
      from: [{ collectionId: 'agendaItems' }],
      where: after('createdAt', earliest),
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
      limit: MAX_DOCUMENTS,
    })

    for (const recipient of agendaWaiting) {
      const start = since.get(recipient.uid)?.getTime() ?? 0
      const mine = fresh.filter((item) => {
        const createdAt = timestamp(item, 'createdAt')?.getTime() ?? 0
        return (
          createdAt > start &&
          // Was man selbst anlegt, meldet sich nie – die häufigste Art,
          // eine Benachrichtigung lästig zu machen.
          text(item, 'createdBy') !== recipient.uid &&
          text(item, 'kind') !== 'pendenz'
        )
      })
      if (mine.length === 0) continue

      const names = mine.map((item) => {
        const author = users.get(text(item, 'createdBy'))
        return author ? firstName(text(author, 'displayName')) : ''
      })

      outbox.push({
        recipient,
        message: agendaMessage(names.filter(Boolean), mine.length),
        url: '/sitzungen',
        tag: 'traktanden',
      })
      marks.push({ uid: recipient.uid, fields: { agendaSentAt: { timestampValue: now.toISOString() } } })
    }
  }

  /* --- 3. Eine Stunde vor der Sitzung ------------------------------- */

  const meetingWaiting = withDevices.filter(
    (recipient) => recipient.fullAccess && bool(recipient.settings, ['meeting', 'on']),
  )

  if (meetingWaiting.length > 0) {
    const soon = await runQuery(client, {
      from: [{ collectionId: 'meetings' }],
      where: between('date', now, new Date(now.getTime() + 90 * 60_000)),
      limit: 10,
    })

    /*
     * Wem in diesem Lauf schon eine Sitzung gemeldet wurde – zwei Sitzungen
     * im selben Fenster sind selten, aber ohne diese Spur überschriebe die
     * zweite Marke die erste, und die erste Sitzung meldete sich später
     * noch einmal.
     */
    const notedThisRun = new Map<string, string[]>()

    for (const meeting of soon) {
      const startsAt = timestamp(meeting, 'date')
      if (!startsAt || !meetingDue(startsAt, now)) continue
      if (text(meeting, 'status') === 'closed') continue

      const items = await runQuery(client, {
        from: [{ collectionId: 'agendaItems' }],
        where: equals('meetingId', idOf(meeting)),
        limit: MAX_DOCUMENTS,
      })
      const open = items.filter((item) => OPEN_STATUSES.has(text(item, 'status')))
      const message = meetingMessage(
        { title: text(meeting, 'title'), startsAt },
        {
          traktanden: open.filter((item) => text(item, 'kind') !== 'pendenz').length,
          pendenzen: open.filter((item) => text(item, 'kind') === 'pendenz').length,
        },
      )

      for (const recipient of meetingWaiting) {
        const done = [
          ...strings(recipient.settings, 'meetingsNotified'),
          ...(notedThisRun.get(recipient.uid) ?? []),
        ]
        if (done.includes(idOf(meeting))) continue

        // Die letzten zehn genügen: Sie stehen nur dafür, dass ein zweiter
        // Lauf im selben Fenster nicht noch einmal meldet.
        const next = [...done.slice(-9), idOf(meeting)]
        notedThisRun.set(recipient.uid, next)

        outbox.push({ recipient, message, url: '/sitzungen', tag: `sitzung-${idOf(meeting)}` })
        marks.push({
          uid: recipient.uid,
          fields: {
            meetingsNotified: {
              arrayValue: { values: next.map((id) => ({ stringValue: id })) },
            },
          },
        })
      }
    }
  }

  /* --- Versand ------------------------------------------------------ */

  if (outbox.length === 0) {
    return new Response('Nichts zu melden.', { status: 200 })
  }

  // Am Emulator gibt es kein Cloud Messaging – der Lauf meldet nur, was er täte.
  if (EMULATOR_HOST) {
    return new Response(`Emulator: würde ${outbox.length} Nachrichten senden.`, { status: 200 })
  }

  let sent = 0
  let removed = 0
  let failed = 0

  for (const entry of outbox) {
    for (const token of entry.recipient.tokens) {
      const outcome = await sendTo(client, token, entry.message, {
        url: entry.url,
        tag: entry.tag,
      })
      if (outcome === 'sent') sent += 1
      if (outcome === 'failed') failed += 1
      if (outcome === 'gone') {
        removed += 1
        await firestore(client, `/documents/pushTokens/${encodeURIComponent(token)}`, {
          method: 'DELETE',
        }).catch((error) => console.error('[benachrichtigungen] Aufräumen scheiterte:', error))
      }
    }
  }

  /*
   * Die Marken erst nach dem Versand – und zusammengefasst, damit eine
   * Person mit drei Anlässen nicht drei Schreibvorgänge auslöst.
   */
  const merged = new Map<string, Record<string, FirestoreValue>>()
  for (const entry of marks) {
    merged.set(entry.uid, { ...(merged.get(entry.uid) ?? {}), ...entry.fields })
  }
  for (const [uid, fields] of merged) await mark(client, uid, fields)

  return new Response(`${sent} gesendet, ${removed} weggeräumt, ${failed} gescheitert.`, {
    status: 200,
  })
}

/**
 * Alle Viertelstunde.
 *
 * Das ist der Takt, in dem die Auswahl der Uhrzeiten aufgeht (halbe
 * Stunden) und die Sitzungserinnerung ihr Fenster trifft – öfter brächte
 * nichts, seltener liesse die Stunde vor der Sitzung zu viel Spielraum.
 */
export const config = { schedule: '*/15 * * * *' }
