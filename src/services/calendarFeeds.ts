import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from '@/lib/db'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { commit, type SaveOutcome } from '@/lib/sync'
import type { ApActivityKind, CalendarFeed } from '@/lib/types'

/*
 * Die Links, unter denen der Aktivitätenplan abonniert werden kann.
 *
 * Ein Abo ist kein Export: Google und Apple holen die Datei von sich aus
 * immer wieder ab und ersetzen damit den ganzen Kalender. Neue Termine
 * erscheinen, geänderte rücken, gelöschte verschwinden – ohne dass jemand
 * etwas tut. Ausgeliefert wird die Datei von der Netlify-Function
 * `netlify/functions/ap-ics.mts`; hier entstehen nur die Links dorthin.
 *
 * Der Plan steht seit der Öffnung von `/ap` jedem offen, und mit ihm der
 * Feed: `/api/ap.ics` ohne alles gibt den ganzen Plan heraus. Das ist der
 * Link für den Aushang und für die Gruppe der Jugendführung.
 *
 * Die Links mit Token bleiben daneben bestehen – nicht mehr als Schutz,
 * sondern für das, was sie können: nur bestimmte Arten zeigen, und
 * festhalten, wann ein Kalenderprogramm zuletzt vorbeikam. Warum überhaupt
 * ein Token in der URL steht: Ein Kalenderprogramm kann sich nirgends
 * anmelden. Es ruft eine Adresse ab, und was zurückkommt, zeigt es an – siehe
 * `CalendarFeed` in `lib/types` für die Abwägung dahinter.
 */

/**
 * Wie lang das Geheimnis ist.
 *
 * 24 Bytes sind 192 Bit – so weit jenseits des Erratbaren, dass die Frage
 * sich nicht stellt, und als Text noch kurz genug, dass der Link in eine
 * Zeile passt.
 */
const TOKEN_BYTES = 24

/** Der Pfad, unter dem die Function antwortet. Steht ebenso in `netlify.toml`. */
export const AP_FEED_PATH = '/api/ap.ics'

/**
 * Ein neues Geheimnis.
 *
 * Aus dem Zufallsgenerator des Betriebssystems (`crypto.getRandomValues`),
 * nicht aus `Math.random()`: Letzterer ist auf Geschwindigkeit gebaut und
 * vorhersagbar, sobald man ein paar Werte gesehen hat.
 *
 * Base64 in der URL-tauglichen Schreibweise – ohne «+», «/» und die
 * Auffüllzeichen, die in einer Adresse eine eigene Bedeutung hätten.
 */
export function newFeedToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Die Adresse zum Abonnieren.
 *
 * Ohne Token – «https://…/api/ap.ics» – ist es der öffentliche Feed: der
 * ganze Plan, für jeden, der den Link hat. Das ist seit der Öffnung von
 * `/ap` der Link, den man weitergibt; ein Token schützte nichts mehr, was
 * nicht ohnehin offenstünde.
 *
 * Mit Token – «…?token=…» – ist es einer der vergebenen Links. Die gibt es
 * weiterhin, aber für das, was sie zusätzlich können: nur bestimmte Arten
 * zeigen, und verraten, wann ein Kalenderprogramm zuletzt vorbeikam.
 */
export function apFeedUrl(
  token: string | null = null,
  origin: string = window.location.origin,
): string {
  return token
    ? `${origin}${AP_FEED_PATH}?token=${encodeURIComponent(token)}`
    : `${origin}${AP_FEED_PATH}`
}

/**
 * Dieselbe Adresse als «webcal://».
 *
 * Ein Klick darauf öffnet am Mac und am iPhone unmittelbar den Kalender und
 * fragt nach dem Abonnieren – mit «https://» lädt der Browser stattdessen
 * eine Datei herunter, und die wäre eine einmalige Kopie statt eines Abos.
 */
export function apFeedWebcalUrl(
  token: string | null = null,
  origin: string = window.location.origin,
): string {
  return apFeedUrl(token, origin).replace(/^https?:/, 'webcal:')
}

/* ------------------------------------------------------------------ */
/* Anlegen, ändern, widerrufen                                         */
/* ------------------------------------------------------------------ */

export interface NewCalendarFeed {
  label: string
  /** Leer heisst: alle Arten */
  kinds: ApActivityKind[]
}

/**
 * Einen Link anlegen. Gibt das Token zurück, damit es sich sofort zeigen lässt.
 *
 * Bewusst mehrere Links statt eines einzigen: Wer den Beratern einen anderen
 * gibt als der Jugendführung, kann später einen davon widerrufen, ohne allen
 * anderen den Kalender wegzunehmen.
 */
export async function createCalendarFeed(
  input: NewCalendarFeed,
  userId?: string | null,
): Promise<{ id: string; token: string }> {
  const token = newFeedToken()

  const reference = await addDoc(collection(db, COLLECTIONS.calendarFeeds), {
    token,
    label: input.label.trim() || 'Kalender-Abo',
    kinds: input.kinds,
    active: true,
    createdAt: serverTimestamp(),
    createdById: userId ?? null,
  })

  return { id: reference.id, token }
}

/**
 * Beschriftung und Auswahl ändern – oder den Link stilllegen.
 *
 * Ein widerrufener Link wird nicht gelöscht: Er soll in der Liste stehen
 * bleiben, damit erkennbar ist, dass es ihn gab und dass er nicht mehr geht.
 * Wer ihn wirklich loswerden will, löscht ihn.
 */
export async function updateCalendarFeed(
  id: string,
  patch: Partial<Pick<CalendarFeed, 'label' | 'kinds' | 'active'>>,
): Promise<SaveOutcome> {
  return commit(updateDoc(doc(db, COLLECTIONS.calendarFeeds, id), patch))
}

export async function deleteCalendarFeed(id: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.calendarFeeds, id)))
  forgetDoc(COLLECTIONS.calendarFeeds, id)
  return outcome
}
