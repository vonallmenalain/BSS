// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { HOME_CHURCH_FROM, HYMN_BOOK_PREFIX, type Hymn, type HymnBook } from './types.ts'

/**
 * Der Code ist die Kurzform, unter der ein Lied angeschrieben, gesucht und
 * gespeichert wird: «6» aus dem Gesangbuch, «PV 6» aus dem Liederbuch für
 * Kinder, «PV 18a» bei einer Doppelnummer, «1001» aus dem Gesangbuch für
 * zuhause und für die Kirche.
 *
 * Ein Kürzel trägt nur, was sonst zusammenstiesse. Gesangbuch und
 * PV-Liederbuch zählen beide ab 1 – ohne «PV» wäre nicht zu sagen, welche
 * Nr. 6 gemeint ist. Die neue Sammlung beginnt bei 1001 und kommt deshalb
 * ohne aus; die Kirche zählt dort bewusst weiter, damit sich ihre Lieder
 * ohne Zusatz ansagen lassen.
 *
 * Bewusst frei von Firestore, damit sich die Regel mit `node --test` prüfen
 * lässt – sie steckt an genug Stellen, dass ein stiller Fehler teuer wäre.
 */

export function hymnCode(book: HymnBook, number: number, suffix = ''): string {
  const prefix = HYMN_BOOK_PREFIX[book]
  return `${prefix ? `${prefix} ` : ''}${number}${suffix}`
}

/** Der Code eines gespeicherten Liedes – auch für Altbestand ohne Feld. */
export function codeOf(hymn: Hymn): string {
  return hymn.code ?? String(hymn.number)
}

/**
 * Vergleichsform des Codes: klein, ohne Leerzeichen. «PV 18a», «pv18a» und
 * «Pv 18 a» führen damit alle zum selben Lied.
 */
export function hymnKey(code: string): string {
  return code.toLowerCase().replace(/\s+/g, '')
}

/** Dokument-ID: «6», «pv-18a», «1001». */
export function hymnDocId(code: string): string {
  const key = hymnKey(code)
  return key.startsWith('pv') ? `pv-${key.slice(2)}` : key
}

/**
 * «PV 18a» → Buch, Zahl und Buchstabe. `null`, wenn nichts Brauchbares
 * dasteht.
 *
 * Ohne Kürzel entscheidet die Zahl über das Buch: ab 1001 die neue
 * Sammlung, darunter das Gesangbuch.
 */
export function parseHymnCode(
  text: string,
): { book: HymnBook; number: number; suffix: string; code: string } | null {
  const match = hymnKey(text).match(/^(pv)?(\d{1,4})([a-z])?$/)
  if (!match) return null

  const number = Number(match[2])
  if (number < 1) return null

  const book: HymnBook = match[1] ? 'children' : number > HOME_CHURCH_FROM ? 'home_church' : 'hymns'
  const suffix = match[3] ?? ''

  return { book, number, suffix, code: hymnCode(book, number, suffix) }
}

/** Das Buch eines gespeicherten Liedes – Altbestand zählt zum Gesangbuch. */
export function bookOf(hymn: Hymn): HymnBook {
  return hymn.book ?? 'hymns'
}

/** Sortierung der Liste: erst das Gesangbuch, dann nach Nummer und Code. */
export function compareHymns(a: Hymn, b: Hymn): number {
  const order: HymnBook[] = ['hymns', 'home_church', 'children']
  return (
    order.indexOf(bookOf(a)) - order.indexOf(bookOf(b)) ||
    a.number - b.number ||
    codeOf(a).localeCompare(codeOf(b))
  )
}
