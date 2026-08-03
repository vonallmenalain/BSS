import { collection, doc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { normalize } from '@/lib/utils'
import { commit, requireOnline, type SaveOutcome } from '@/lib/sync'
import {
  bookOf,
  codeOf,
  compareHymns,
  hymnCode,
  hymnDocId,
  hymnKey,
  parseHymnCode,
} from '@/lib/hymnCode'
import type { Hymn, HymnBook, HymnChoice } from '@/lib/types'
import type { ParsedSheet } from '@/services/import'

// Die Code-Regeln liegen firestore-frei in `lib/hymnCode` – von hier
// mitverteilt, damit die Oberfläche nur einen Ort kennen muss.
export { bookOf, codeOf, compareHymns, hymnCode, hymnKey, parseHymnCode }

/* ------------------------------------------------------------------ */
/* Einzelne Lieder                                                     */
/* ------------------------------------------------------------------ */

/**
 * Legt ein Lied an oder korrigiert es. Die Dokument-ID ist der Code,
 * damit derselbe Code nie zweimal in der Liste steht.
 */
export async function saveHymn(code: string, title: string): Promise<SaveOutcome> {
  const parsed = parseHymnCode(code)
  if (!parsed) throw new Error(`«${code}» ist keine gültige Liednummer.`)

  return commit(
    setDoc(
      doc(db, COLLECTIONS.hymns, hymnDocId(parsed.code)),
      {
        number: parsed.number,
        code: parsed.code,
        book: parsed.book,
        title: title.trim(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Liste aus Excel oder CSV übernehmen                                 */
/* ------------------------------------------------------------------ */

export interface HymnRow {
  number: number
  /** Buchstabe bei Doppelnummern: «a», «b» – sonst leer */
  suffix?: string
  title: string
}

const NUMBER_HINTS = ['nummer', 'nr', 'liednummer', 'no', 'number', 'lied nr']
const TITLE_HINTS = ['titel', 'lied', 'name', 'title', 'bezeichnung', 'liedtitel']

/**
 * Erkennt in einer eingelesenen Tabelle die Spalten mit Nummer und Titel.
 *
 * Zuerst wird auf die Überschriften geschaut. Hat die Datei keine brauchbaren
 * Überschriften – was bei einer abgetippten Liederliste oft vorkommt –, wird
 * anhand des Inhalts geraten: die Spalte mit den meisten reinen Zahlen ist die
 * Nummer, die mit dem meisten Text der Titel.
 */
export function guessHymnColumns(sheet: ParsedSheet): { number: number; title: number } {
  const headers = sheet.headers.map(normalize)

  const byHint = (hints: string[]): number =>
    headers.findIndex((header) => hints.some((hint) => header === hint || header.startsWith(hint)))

  let numberColumn = byHint(NUMBER_HINTS)
  let titleColumn = byHint(TITLE_HINTS)

  if (numberColumn === -1) {
    const scores = sheet.headers.map(
      (_, index) => sheet.rows.filter((row) => /^\d{1,4}$/.test((row[index] ?? '').trim())).length,
    )
    const best = Math.max(...scores, 0)
    numberColumn = best > 0 ? scores.indexOf(best) : 0
  }

  if (titleColumn === -1 || titleColumn === numberColumn) {
    const scores = sheet.headers.map((_, index) =>
      index === numberColumn
        ? -1
        : sheet.rows.filter((row) => (row[index] ?? '').trim().length > 3).length,
    )
    const best = Math.max(...scores, 0)
    titleColumn =
      best > 0 ? scores.indexOf(best) : Math.min(numberColumn + 1, sheet.headers.length - 1)
  }

  return { number: numberColumn, title: titleColumn }
}

/**
 * Wandelt die Tabelle in Lieder um.
 *
 * Zeilen ohne gültige Nummer oder ohne Titel werden übergangen – das trifft
 * Zwischenüberschriften wie «Abendmahl» zuverlässig, ohne dass jemand die
 * Datei vorher aufräumen muss.
 */
export function parseHymnSheet(
  sheet: ParsedSheet,
  columns: { number: number; title: number },
): HymnRow[] {
  const seen = new Set<number>()
  const rows: HymnRow[] = []

  // Die Kopfzeile ist bei Listen ohne Überschriften selbst schon ein Lied.
  const candidates = [sheet.headers, ...sheet.rows]

  for (const row of candidates) {
    const raw = (row[columns.number] ?? '').trim()
    const title = (row[columns.title] ?? '').trim()
    const number = Number.parseInt(raw, 10)

    if (!Number.isFinite(number) || number <= 0 || String(number) !== raw) continue
    if (!title || seen.has(number)) continue

    seen.add(number)
    rows.push({ number, title })
  }

  return rows.sort((a, b) => a.number - b.number)
}

/** Schreibt die Liederliste in Firestore – in Batches, wie beim Mitgliederimport. */
export async function importHymns(
  rows: HymnRow[],
  book: HymnBook = 'hymns',
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  // Hunderte Lieder gehören nicht in die Offline-Warteschlange – siehe requireOnline().
  requireOnline()
  for (let offset = 0; offset < rows.length; offset += 400) {
    const chunk = rows.slice(offset, offset + 400)
    const batch = writeBatch(db)
    for (const row of chunk) {
      const code = hymnCode(book, row.number, row.suffix ?? '')
      batch.set(
        doc(db, COLLECTIONS.hymns, hymnDocId(code)),
        { number: row.number, code, book, title: row.title, updatedAt: serverTimestamp() },
        { merge: true },
      )
    }
    await batch.commit()
    onProgress?.(Math.min(offset + chunk.length, rows.length), rows.length)
  }
  return rows.length
}

/**
 * Entfernt eine Liederliste – für einen sauberen Neuimport.
 *
 * Nur das gewählte Buch: Wer die PV-Lieder neu einliest, will nicht das
 * Gesangbuch verlieren. Altbestand ohne `book` zählt zum Gesangbuch.
 */
export async function clearHymns(book: HymnBook = 'hymns'): Promise<number> {
  requireOnline()
  const snapshot = await getDocs(collection(db, COLLECTIONS.hymns))
  const ids = snapshot.docs
    .filter((entry) => bookOf(entry.data() as Hymn) === book)
    .map((entry) => entry.id)

  for (let offset = 0; offset < ids.length; offset += 400) {
    const batch = writeBatch(db)
    ids.slice(offset, offset + 400).forEach((id) => batch.delete(doc(db, COLLECTIONS.hymns, id)))
    await batch.commit()
  }
  return ids.length
}

/* ------------------------------------------------------------------ */
/* Darstellung                                                         */
/* ------------------------------------------------------------------ */

/** «2 – Der Geist aus den Höhen», «PV 6 – Gebet eines Kindes», sonst «–». */
export function formatHymn(choice: HymnChoice | undefined | null): string {
  if (!choice || (!choice.number && !choice.title)) return '–'
  const code = choice.code ?? (choice.number != null ? String(choice.number) : '')
  if (!code) return choice.title
  return choice.title ? `${code} – ${choice.title}` : `Nr. ${code}`
}

/** Findet Lieder über Code oder Titel – für die Suche im Liedfeld. */
export function searchHymns(hymns: Hymn[], term: string, limit = 8): Hymn[] {
  const text = normalize(term)
  if (!text) return []
  // «6» und «pv6» suchen nach dem Code, alles andere nach dem Titel.
  const key = /^(pv)?\d/.test(hymnKey(text)) ? hymnKey(text) : ''

  return hymns
    .filter((hymn) =>
      key ? hymnKey(codeOf(hymn)).startsWith(key) : normalize(hymn.title).includes(text),
    )
    .sort(compareHymns)
    .slice(0, limit)
}
