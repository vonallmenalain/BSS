import { Buffer } from 'node:buffer'
import { createSign } from 'node:crypto'
import process from 'node:process'
import { impulseWeekKey } from '../../src/lib/impulse.ts'

/**
 * Die Montags-Erinnerung des Bereichs «Impuls».
 *
 * Läuft jeden Montag um 06:00 UTC (07:00/08:00 Schweizer Zeit, je nach
 * Jahreszeit) – siehe `config` zuunterst. Sie schaut nach, ob die neue
 * Woche **bereiten Inhalt** hat, und schickt nur dann eine kurze Nachricht
 * an die Geräte, die sich die Erinnerung eingeschaltet haben
 * (`impulsePushTokens`). Eine leere Woche bleibt still – eine
 * Benachrichtigung ohne Inhalt wäre genau die Mahnung, die der Bereich
 * nie sein will (Leitgedanke 1).
 *
 * Angemeldet wird wie beim Kalender-Feed (`ap-ics.mts`) mit dem
 * Dienstkonto aus `FIREBASE_SERVICE_ACCOUNT` – derselbe Schlüssel, ein
 * zweiter Geltungsbereich: Neben Firestore braucht es hier Cloud
 * Messaging. Der VAPID-Schlüssel spielt beim Senden keine Rolle; er
 * gehört der App beim Einschalten der Erinnerung
 * (`VITE_FIREBASE_VAPID_KEY`), den privaten Teil verwahrt Firebase.
 *
 * Abgelaufene Geräte-Adressen (Konto abgemeldet, App gelöscht) meldet
 * Cloud Messaging als «UNREGISTERED» – sie werden im selben Lauf
 * weggeräumt, damit die Liste nicht versandet.
 */

const FIRESTORE = 'https://firestore.googleapis.com/v1'
const FCM = 'https://fcm.googleapis.com/v1'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPE =
  'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging'

/** Mehr Geräte wird ein Kollegium nie haben. */
const MAX_TOKENS = 500

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

function equals(fieldPath: string, value: string) {
  return { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } } }
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
async function send(
  client: Client,
  token: string,
  week: string,
): Promise<'sent' | 'gone' | 'failed'> {
  const response = await fetch(`${FCM}/projects/${client.projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: client.authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        data: { url: '/impuls' },
        webpush: {
          headers: { TTL: '172800', Urgency: 'normal' },
          notification: {
            title: 'Impuls',
            body: 'Die neue Woche ist da – Impuls, Quiz und Challenges warten.',
            icon: '/icons/icon-192.png',
            tag: `impuls-${week}`,
          },
        },
      },
    }),
  })

  if (response.ok) return 'sent'

  const text = await response.text()
  if (response.status === 404 || text.includes('UNREGISTERED')) return 'gone'

  console.error(`[impuls-push] Senden scheiterte (${response.status}): ${text}`)
  return 'failed'
}

/* ------------------------------------------------------------------ */
/* Der Lauf                                                            */
/* ------------------------------------------------------------------ */

export default async function handler(): Promise<Response> {
  const client = await connect()
  const week = impulseWeekKey(new Date())

  // Nur wenn die neue Woche wirklich etwas bereithält.
  const ready = await runQuery(client, {
    from: [{ collectionId: 'impulseItems' }],
    where: { compositeFilter: { op: 'AND', filters: [equals('week', week), equals('status', 'ready')] } },
    limit: 1,
  })
  if (ready.length === 0) {
    return new Response(`Woche ${week}: nichts bereit, keine Erinnerung.`, { status: 200 })
  }

  const tokens = await runQuery(client, {
    from: [{ collectionId: 'impulsePushTokens' }],
    limit: MAX_TOKENS,
  })
  if (tokens.length === 0) {
    return new Response(`Woche ${week}: niemand hat die Erinnerung eingeschaltet.`, {
      status: 200,
    })
  }

  // Am Emulator gibt es kein Cloud Messaging – der Lauf meldet nur, was er täte.
  if (EMULATOR_HOST) {
    return new Response(`Emulator: würde ${tokens.length} Erinnerungen für ${week} senden.`, {
      status: 200,
    })
  }

  let sent = 0
  let removed = 0
  let failed = 0

  for (const document of tokens) {
    const token = idOf(document)
    const outcome = await send(client, token, week)
    if (outcome === 'sent') sent += 1
    if (outcome === 'failed') failed += 1
    if (outcome === 'gone') {
      removed += 1
      await firestore(client, `/documents/impulsePushTokens/${encodeURIComponent(token)}`, {
        method: 'DELETE',
      }).catch((error) => console.error('[impuls-push] Aufräumen scheiterte:', error))
    }
  }

  return new Response(
    `Woche ${week}: ${sent} gesendet, ${removed} weggeräumt, ${failed} gescheitert.`,
    { status: 200 },
  )
}

/** Jeden Montag um 06:00 UTC – der Morgen, an dem die neue Woche beginnt. */
export const config = { schedule: '0 6 * * 1' }
