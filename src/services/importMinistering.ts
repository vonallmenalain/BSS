/**
 * Betreuungsaufträge aus «Hilfsmittel für Führungsbeamte und Sekretäre»
 * (LCR, `/ministering-assignments`) als Text einlesen.
 *
 * Die Seite zeigt drei Spalten – Person, Betreuungspartner, zu betreuende
 * Personen. Beim Kopieren gehen die Spaltengrenzen verloren, weil die
 * beiden hinteren Zellen mehrere Namen untereinander enthalten:
 *
 *     Andrey-Pauli, Esther →              ← Kopfzeile der Person
 *     Seeber, Jennifer                    ← Betreuungspartner
 *     Lauener, Rahel Sandra               ← Betreuungsauftrag
 *     Roemer, Clémentine Lisa Lou
 *     Schaer, Annika
 *     Aeschlimann, Heinz → →              ← Person ohne Zuteilung
 *
 * Erkennbar bleibt nur: Die Zeile einer Person endet auf einen
 * Tabulator, die Namen darunter nicht. Wo Partner aufhören und Auftrag
 * beginnt, muss erschlossen werden – siehe `splitBlock()`.
 *
 * Bewusst ohne Abhängigkeiten, damit sich der Parser mit `node --test`
 * direkt ausführen lässt.
 */

/* ------------------------------------------------------------------ */
/* Zeilen vorbereiten                                                  */
/* ------------------------------------------------------------------ */

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
}

const JUNK = new Set([
  'skip to main content',
  'sign in',
  'anmelden',
  'kirche jesu christi der heiligen der letzten tage',
  'hilfsmittel fur fuhrungsbeamte und sekretare',
  'profile picture',
  'hilfe',
  'suchen',
  'drucken',
  'mitglieder, berichte und formulare suchen',
  'meine gemeinde',
  'andere einheiten und fuhrungsverantwortliche',
  'betreuungsauftrage',
  'alle organisationen',
  'alle personen',
  'feedback geben',
])

const COUNT_LINE = /^anzahl: ?\d+/

/** Sieht die Zelle wie «Nachname, Vorname» aus? */
function isName(value: string): boolean {
  const text = value.trim()
  return text.length > 2 && text.includes(',') && /\p{L}/u.test(text) && !/\d/.test(text)
}

interface RawBlock {
  /** Person, der die Zeile gehört */
  name: string
  /** Alle Namen der beiden hinteren Spalten, in der Reihenfolge der Seite */
  entries: string[]
}

/**
 * Zerlegt den Text in Blöcke – einen je Person.
 *
 * Die Kopfzeile einer Person ist daran zu erkennen, dass sie einen
 * Tabulator enthält (die leeren bzw. mehrzeiligen Folgespalten). Namen
 * innerhalb eines Blocks stehen ohne Tabulator auf eigenen Zeilen.
 */
function readBlocks(text: string): RawBlock[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u202f]/g, ' ')
    .split('\n')

  const blocks: RawBlock[] = []
  let current: RawBlock | null = null

  for (const raw of lines) {
    if (!raw.trim()) continue
    if (COUNT_LINE.test(fold(raw))) break

    const hasTab = raw.includes('\t')
    const cells = raw
      .split('\t')
      .map((cell) => cell.trim())
      .filter((cell) => cell && !JUNK.has(fold(cell)))

    if (cells.length === 0) continue

    if (hasTab && isName(cells[0])) {
      current = { name: cells[0], entries: cells.slice(1).filter(isName) }
      blocks.push(current)
      continue
    }

    if (current && cells.length === 1 && isName(cells[0])) {
      current.entries.push(cells[0])
    }
  }

  return blocks
}

/* ------------------------------------------------------------------ */
/* Partner und Auftrag trennen                                         */
/* ------------------------------------------------------------------ */

const collator = new Intl.Collator('de-CH', { sensitivity: 'base' })

/**
 * Vergleich wie im Verzeichnis: erst Nachname, dann Vorname.
 *
 * Über den ganzen String zu vergleichen ginge schief, sobald ein
 * Doppelname im Spiel ist: «Kummer, Tamara Ursula» steht vor
 * «Kummer-Ryser, Maria Magdalena», weil «Kummer» vor «Kummer-Ryser»
 * kommt – am Stück verglichen läge «Tamara» hinter «Ryser».
 */
function compareNames(a: string, b: string): number {
  const [lastA, firstA = ''] = a.split(',')
  const [lastB, firstB = ''] = b.split(',')
  const byLast = collator.compare(lastA.trim(), lastB.trim())
  return byLast !== 0 ? byLast : collator.compare(firstA.trim(), firstB.trim())
}

/**
 * Sucht die Stelle, an der die alphabetische Reihenfolge neu beginnt.
 *
 * Die Seite sortiert beide Spalten für sich alphabetisch. Stehen sie
 * hintereinander, verrät der Bruch in der Sortierung die Spaltengrenze:
 * bis dahin die Betreuungspartner, danach der Auftrag. `-1`, wenn die
 * ganze Liste aufsteigend ist – dann hilft nur die Gegenseitigkeit.
 */
function findReset(entries: string[]): number {
  for (let i = 1; i < entries.length; i++) {
    if (compareNames(entries[i], entries[i - 1]) < 0) return i
  }
  return -1
}

export interface MinisteringEntry {
  /** «Nachname, Vorname» */
  fullName: string
  /** Mit wem zusammen betreut wird */
  partners: string[]
  /** Wer betreut wird */
  assigned: string[]
}

/**
 * Trennt je Person Betreuungspartner vom Betreuungsauftrag.
 *
 * Zwei Verfahren, weil keines allein reicht:
 *
 *  1. Bruch in der alphabetischen Sortierung. Deckt fast alle Fälle ab,
 *     auch mehrere Partnerschaften («Schaer, Raphael» hat zwei).
 *  2. Ist die ganze Liste aufsteigend, gibt es keinen Bruch. Dann gilt
 *     als Partner, wer diese Person seinerseits aufführt. Die Prüfung
 *     ist hier zulässig, weil sich die Fälle mit Bruch schon in Schritt 1
 *     geklärt haben – gegenseitige *Aufträge* kommen zwar vor
 *     («Kummer, David Jonathan» und «Roemer, Aaron Erich» betreuen
 *     einander), haben aber immer einen Bruch.
 */
function splitBlocks(blocks: RawBlock[]): MinisteringEntry[] {
  const entriesByName = new Map(blocks.map((block) => [fold(block.name), block.entries]))

  return blocks.map((block) => {
    const reset = findReset(block.entries)

    if (reset >= 0) {
      return {
        fullName: block.name,
        partners: block.entries.slice(0, reset),
        assigned: block.entries.slice(reset),
      }
    }

    const partners: string[] = []
    const assigned: string[] = []
    for (const entry of block.entries) {
      const theirs = entriesByName.get(fold(entry))
      const mutual = theirs?.some((name) => fold(name) === fold(block.name)) ?? false
      if (mutual) partners.push(entry)
      else assigned.push(entry)
    }

    return { fullName: block.name, partners, assigned }
  })
}

/* ------------------------------------------------------------------ */
/* Einstiegspunkt                                                      */
/* ------------------------------------------------------------------ */

export interface PastedMinistering {
  entries: MinisteringEntry[]
  /** Personen mit mindestens einer Zuteilung */
  assignedCount: number
}

export function parsePastedMinistering(text: string): PastedMinistering {
  const entries = splitBlocks(readBlocks(text))
  return {
    entries,
    assignedCount: entries.filter((e) => e.partners.length || e.assigned.length).length,
  }
}
