import { Buffer } from 'node:buffer'
import { createHash, createSign } from 'node:crypto'
import process from 'node:process'
import {
  MAX_CLEANING_REMINDERS,
  parseCleaningReminder,
  validPushToken,
} from '../../src/lib/cleaningReminder.ts'

/**
 * Meldet ein Gerät für die Putzplan-Erinnerung an – oder ab.
 *
 * Erreichbar unter `/.netlify/functions/putzplan-erinnerung`, ohne
 * Umleitung: Aufgerufen wird die Adresse nur von der App selbst
 * (`src/services/cleaningReminder.ts`), weitergegeben wird sie nie.
 *
 * ## Warum es diese Function braucht
 *
 * Die übrigen Benachrichtigungen hängen an einem Konto: Das Gerät legt
 * seine Adresse unter `pushTokens` ab, und die Zugriffsregeln prüfen, dass
 * es das auf den eigenen Namen tut. Die Erinnerung an die Putzwoche soll
 * aber ohne Konto gehen – wer den QR-Code am Anschlagbrett scannt, hat
 * keines. Ohne Anmeldung gibt es nichts, wogegen eine Regel prüfen könnte;
 * eine offene Sammlung, in die jeder schreibt, wollen wir nicht.
 *
 * Deshalb geht die Anmeldung über diese Stelle. Sie schreibt mit dem
 * Dienstkonto in `cleaningReminders`, eine Sammlung, die die Regeln für
 * alle anderen geschlossen halten – lesen kann sie niemand, auch kein
 * Konto mit Vollzugriff.
 *
 * ## Was sie annimmt
 *
 * `POST` mit JSON:
 *
 *  - `{ action: 'save', token, group, day, time, previousToken? }` – legt
 *    die Erinnerung an oder ändert sie. `previousToken` räumt die alte
 *    Adresse weg, wenn der Browser eine neue vergeben hat.
 *  - `{ action: 'delete', token }` – meldet ab.
 *
 * Wer abmelden will, muss die Adresse kennen; sie liegt nur auf dem Gerät.
 * Die Dokument-ID ist ihr SHA-256: fest lang, ohne Sonderzeichen, und wer
 * eine Liste der IDs sähe, hätte damit keine einzige Adresse.
 *
 * ## Was sie prüft
 *
 * Die Einstellung muss zu dem passen, was der Dialog anbietet
 * (`parseCleaningReminder`). Die Adresse muss bei Cloud Messaging bekannt
 * sein – eine Probe ohne Versand (`validate_only`) klärt das, bevor etwas
 * gespeichert wird. Und neue Geräte nimmt sie nur bis zur Obergrenze an
 * (`MAX_CLEANING_REMINDERS`): Die Stelle steht jedem offen, eine
 * Sammlung ohne Boden soll daraus nicht werden.
 *
 * Gespeichert wird nur, was es für den Versand braucht: die Adresse, die
 * Gruppe, Tag und Uhrzeit – kein Name, keine Kennung einer Person.
 * Verschickt wird von `benachrichtigungen.mts`.
 */

const FIRESTORE = 'https://firestore.googleapis.com/v1'
const FCM = 'https://fcm.googleapis.com/v1'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPE =
  'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging'

const COLLECTION = 'cleaningReminders'

/** Eine Anmeldung ist ein paar Hundert Zeichen lang – mehr nimmt die Stelle nicht an. */
const MAX_BODY = 8192

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST

/* ------------------------------------------------------------------ */
/* Dienstkonto und Zugriffstoken – wie in benachrichtigungen.mts       */
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

/* ------------------------------------------------------------------ */
/* Die Erinnerungen                                                    */
/* ------------------------------------------------------------------ */

/** Die Dokument-ID zu einer Adresse – ihr SHA-256. */
function documentId(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Kennt Cloud Messaging diese Adresse?
 *
 * Eine Probe ohne Versand (`validate_only`): Sie prüft die Adresse, ohne
 * dass auf dem Gerät etwas erscheint. Abgelehnt wird nur, was Cloud
 * Messaging ausdrücklich nicht kennt – jede andere Störung ist ein Fehler
 * auf unserer Seite und kein Grund, dem Gerät die Schuld zu geben.
 */
async function tokenKnown(client: Client, token: string): Promise<boolean> {
  if (EMULATOR_HOST) return true

  const response = await fetch(`${FCM}/projects/${client.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: client.authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ validate_only: true, message: { token, data: { probe: '1' } } }),
  })
  if (response.ok) return true

  const body = await response.text()
  if (/UNREGISTERED|INVALID_ARGUMENT|SENDER_ID_MISMATCH/.test(body)) return false
  throw new Error(`Cloud Messaging antwortete mit ${response.status}: ${body}`)
}

/** Wie viele Geräte sich schon erinnern lassen. */
async function countReminders(client: Client): Promise<number> {
  const response = await firestore(client, '/documents:runAggregationQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: { from: [{ collectionId: COLLECTION }] },
        aggregations: [{ alias: 'anzahl', count: {} }],
      },
    }),
  })
  if (!response.ok) {
    throw new Error(`Zählen scheiterte (${response.status}): ${await response.text()}`)
  }
  const rows = (await response.json()) as {
    result?: { aggregateFields?: { anzahl?: { integerValue?: string } } }
  }[]
  return Number(rows[0]?.result?.aggregateFields?.anzahl?.integerValue ?? 0)
}

/**
 * Anlegen oder ändern – nur die Felder der Einstellung.
 *
 * Die Marke des Versands (`lastMark`) bleibt, wie sie ist: Wer bloss die
 * Uhrzeit verschiebt, bekommt die Erinnerung dieser Woche kein zweites Mal.
 */
async function save(
  client: Client,
  token: string,
  schedule: { group: number; day: number; time: string },
): Promise<void> {
  const fields = {
    token: { stringValue: token },
    group: { integerValue: String(schedule.group) },
    day: { integerValue: String(schedule.day) },
    time: { stringValue: schedule.time },
    updatedAt: { timestampValue: new Date().toISOString() },
  }
  const mask = Object.keys(fields)
    .map((field) => `updateMask.fieldPaths=${field}`)
    .join('&')
  const response = await firestore(
    client,
    `/documents/${COLLECTION}/${documentId(token)}?${mask}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    },
  )
  if (!response.ok) {
    throw new Error(`Speichern scheiterte (${response.status}): ${await response.text()}`)
  }
}

async function remove(client: Client, token: string): Promise<void> {
  const response = await firestore(client, `/documents/${COLLECTION}/${documentId(token)}`, {
    method: 'DELETE',
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Entfernen scheiterte (${response.status}): ${await response.text()}`)
  }
}

/* ------------------------------------------------------------------ */
/* Die Anfrage                                                         */
/* ------------------------------------------------------------------ */

function reply(status: number, body: Record<string, unknown>, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      ...headers,
    },
  })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return reply(405, { error: 'Nur POST.' }, { Allow: 'POST' })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY) return reply(413, { error: 'Die Anfrage ist zu gross.' })

  let body: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('Kein Objekt')
    body = parsed as Record<string, unknown>
  } catch {
    return reply(400, { error: 'Die Anfrage ist kein gültiges JSON.' })
  }

  const { action, token, previousToken } = body
  if (!validPushToken(token)) return reply(400, { error: 'Die Geräte-Adresse fehlt.' })

  try {
    const client = await connect()

    if (action === 'delete') {
      await remove(client, token)
      return reply(200, { ok: true })
    }

    if (action !== 'save') return reply(400, { error: 'Unbekannte Aktion.' })

    const schedule = parseCleaningReminder(body)
    if (!schedule) return reply(400, { error: 'Diese Einstellung gibt es nicht.' })

    if (!(await tokenKnown(client, token))) {
      return reply(400, { error: 'Cloud Messaging kennt diese Geräte-Adresse nicht.' })
    }

    const existing = await firestore(client, `/documents/${COLLECTION}/${documentId(token)}`)
    if (existing.status === 404) {
      if ((await countReminders(client)) >= MAX_CLEANING_REMINDERS) {
        return reply(503, { error: 'Es lassen sich gerade keine weiteren Geräte anmelden.' })
      }
    } else if (!existing.ok) {
      throw new Error(`Nachsehen scheiterte (${existing.status}): ${await existing.text()}`)
    }

    await save(client, token, schedule)

    // Hat der Browser eine neue Adresse vergeben, gehört die alte weg –
    // sonst käme dieselbe Erinnerung bald zweimal.
    if (validPushToken(previousToken) && previousToken !== token) {
      await remove(client, previousToken)
    }

    return reply(200, { ok: true })
  } catch (error) {
    console.error('[putzplan-erinnerung]', error)
    return reply(500, { error: 'Die Erinnerung liess sich gerade nicht speichern.' })
  }
}
