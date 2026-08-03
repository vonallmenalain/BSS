/**
 * Liederliste aus dem **Musikarchiv** der Kirche als Text einlesen.
 *
 * Das Gesangbuch steht dort als Liste im Browser
 * (`churchofjesuschrist.org/media/music/collections/hymns`). Herunterladen
 * lässt sie sich nicht, markieren und kopieren schon – und dabei bleibt das
 * Wesentliche erhalten:
 *
 *     1. Der Morgen naht
 *     2. Der Geist aus den Höhen
 *     …
 *     207. Als Schwestern in Zion (Frauenstimmen)
 *
 * Anders als bei den LCR-Seiten braucht es hier keine Liste von
 * Seitenelementen, die wegzuwerfen wären: Ein Lied ist eine Nummer, ein
 * Punkt, ein Titel – und nichts sonst auf der Seite sieht so aus. Weder die
 * Rubriken («Abendmahl», «Weihnachten») noch die Spieldauer des
 * Hörbeispiels («03:52») noch die Trefferzahl («210 Ergebnisse») kommen der
 * Form nahe. Der Punkt hinter der Zahl ist dabei das entscheidende Merkmal:
 * ohne ihn wäre «210 Ergebnisse» ein Lied.
 *
 * Bewusst ohne Abhängigkeiten, damit sich der Parser mit `node --test`
 * direkt ausführen lässt.
 */

export interface PastedHymn {
  number: number
  title: string
}

/** «1. Der Morgen naht» – die Zahl, ein Punkt, der Rest ist Titel. */
const ENTRY = /^(\d{1,3})\.\s*(.*)$/

function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value)
}

export function parsePastedHymns(text: string): PastedHymn[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    // Geschützte Leerzeichen kommen beim Kopieren aus dem Browser häufig mit.
    .replace(/[\u00a0\u202f]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const byNumber = new Map<number, string>()

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(ENTRY)
    if (!match) continue

    const number = Number(match[1])
    if (number < 1) continue

    let title = match[2].trim()

    // Manche Browser setzen die Nummer auf eine eigene Zeile. Die nächste
    // Zeile ist dann der Titel – sofern sie nicht selbst ein Lied ist.
    const next = lines[index + 1] ?? ''
    if (!title && hasLetter(next) && !ENTRY.test(next)) {
      title = next
      index++
    }

    if (!hasLetter(title)) continue
    // Die erste Nennung gilt: Auf der Seite steht jede Nummer genau einmal,
    // eine zweite käme aus einem versehentlich doppelt kopierten Abschnitt.
    if (!byNumber.has(number)) byNumber.set(number, title)
  }

  return [...byNumber.entries()]
    .map(([number, title]) => ({ number, title }))
    .sort((a, b) => a.number - b.number)
}
