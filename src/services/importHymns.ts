/**
 * Liederliste aus dem **Musikarchiv** der Kirche als Text einlesen –
 * das Gesangbuch wie das Liederbuch für Kinder.
 *
 * Beide stehen dort nur als Liste im Browser. Herunterladen lässt sich
 * nichts, markieren und kopieren schon, und dabei bleibt das Wesentliche
 * erhalten:
 *
 *     1. Der Morgen naht
 *     2. Der Geist aus den Höhen
 *
 * Anders als bei den LCR-Seiten braucht es hier keine Liste von
 * Seitenelementen, die wegzuwerfen wären: Ein Lied ist eine Nummer, ein
 * Punkt, ein Titel – und fast nichts sonst auf der Seite sieht so aus.
 * Weder die Rubriken («Abendmahl», «Weihnachten») noch die Spieldauer des
 * Hörbeispiels («03:52») noch die Trefferzahl («210 Ergebnisse») kommen der
 * Form nahe. Der Punkt hinter der Zahl ist dabei das entscheidende Merkmal:
 * ohne ihn wäre «210 Ergebnisse» ein Lied.
 *
 * Zwei Eigenheiten bringt das Liederbuch für Kinder mit:
 *
 *  - **Doppelnummern.** «18a. Dankkanon» und «18b. Den Kopf geneigt»
 *    teilen sich die Seite und damit die Zahl.
 *  - **Kopieren als Markdown.** Je nach Browser kommen die Einträge als
 *    Liste mit Verweisen: `* [6. Gebet eines Kindes](…/songs/…)`. Dann
 *    steht darüber auch ein Brotkrumenpfad – `1. [Musikarchiv](…/music)` –,
 *    der der Form eines Liedes gleicht. Er verrät sich am Ziel: Lieder
 *    verweisen auf `/music/songs/`, der Pfad nicht.
 *
 * Bewusst ohne Abhängigkeiten, damit sich der Parser mit `node --test`
 * direkt ausführen lässt.
 */

export interface PastedHymn {
  number: number
  /** Buchstabe bei Doppelnummern: «a», «b» – sonst leer */
  suffix: string
  title: string
}

/**
 * «18a. Dankkanon» – Zahl, allenfalls ein Buchstabe, Punkt, Titel.
 *
 * Vier Stellen, weil das Gesangbuch für zuhause und für die Kirche bei
 * 1001 zu zählen beginnt.
 */
const ENTRY = /^(\d{1,4})([a-z])?\.\s*(.*)$/i

/** Markdown-Verweis: `[Titel](Adresse)`. */
const LINK = /\[([^\]]*)\]\(([^)]*)\)/

/** Nur Verweise auf ein einzelnes Lied zählen – nicht der Brotkrumenpfad. */
const SONG_URL = /\/music\/songs\//

function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value)
}

/**
 * Macht aus einer Zeile den reinen Text – oder `null`, wenn sie zwar wie
 * ein Eintrag aussieht, aber woanders hinführt.
 */
function readLine(line: string): string | null {
  // Aufzählungszeichen der Markdown-Liste.
  const text = line.replace(/^[*-]\s+/, '')

  const link = text.match(LINK)
  if (!link) return text
  if (!SONG_URL.test(link[2])) return null
  return text.replace(LINK, link[1]).trim()
}

export function parsePastedHymns(text: string): PastedHymn[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    // Geschützte Leerzeichen kommen beim Kopieren aus dem Browser häufig mit.
    .replace(/[\u00a0\u202f]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(readLine)

  const byCode = new Map<string, PastedHymn>()

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line === null) continue

    const match = line.match(ENTRY)
    if (!match) continue

    const number = Number(match[1])
    if (number < 1) continue
    const suffix = (match[2] ?? '').toLowerCase()

    // Der Titel muss auf derselben Zeile stehen. Ihn aus der nächsten zu
    // holen wäre naheliegend, ginge aber schief: Im Brotkrumenpfad steht
    // ein leerer zweiter Eintrag – «2.» –, und darunter beginnt der
    // Seitentitel.
    const title = match[3].trim()
    if (!hasLetter(title)) continue
    // Die erste Nennung gilt: Auf der Seite steht jede Nummer genau einmal,
    // eine zweite käme aus einem versehentlich doppelt kopierten Abschnitt.
    const code = `${number}${suffix}`
    if (!byCode.has(code)) byCode.set(code, { number, suffix, title })
  }

  return [...byCode.values()].sort(
    (a, b) => a.number - b.number || a.suffix.localeCompare(b.suffix),
  )
}
