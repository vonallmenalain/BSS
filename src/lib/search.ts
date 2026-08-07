/**
 * Fundstellen eines Suchbegriffs im Text – für die Hervorhebung.
 *
 * `matchesSearch` beantwortet «kommt es vor?». Für die Anzeige braucht es die
 * Frage danach: **wo genau?** Denn markiert werden soll die Stelle im
 * ursprünglichen Text, mit seinen Umlauten und seiner Gross- und
 * Kleinschreibung – und nicht eine vereinfachte Fassung davon.
 *
 * Deshalb wird der Text zeichenweise vereinfacht und dabei festgehalten, aus
 * welchem ursprünglichen Zeichen jedes vereinfachte stammt. «Grüezi» wird zu
 * «gruezi», und der Treffer «rue» zeigt danach wieder auf «rüe».
 *
 * Firestore-frei und ohne Oberfläche, damit sich die Regel prüfen lässt
 * (`tests/search.test.ts`).
 */

export interface SearchHit {
  /** Erstes Zeichen im ursprünglichen Text */
  start: number
  /** Erstes Zeichen **nach** der Fundstelle */
  end: number
}

/**
 * Kleinschreibung ohne Akzente – Zeichen für Zeichen, mit Rückweg.
 *
 * `ß` wird zu `ss` und wächst dabei auf zwei Zeichen; beide zeigen auf
 * dasselbe ursprüngliche. Genau dafür ist die Zuordnung da.
 */
function fold(text: string): { folded: string; origin: number[] } {
  let folded = ''
  const origin: number[] = []

  for (let index = 0; index < text.length; index++) {
    const plain = text[index]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')

    for (const char of plain) {
      folded += char
      origin.push(index)
    }
  }

  return { folded, origin }
}

/**
 * Alle Fundstellen aller Suchwörter, der Reihe nach und ohne Überschneidung.
 *
 * Mehrere Wörter zählen einzeln: Wer «taufe protokoll» sucht, sieht beide
 * markiert – so wie `matchesSearch` auch beide verlangt, in beliebiger
 * Reihenfolge.
 */
export function searchHits(text: string, needle: string): SearchHit[] {
  const words = needle.trim().split(/\s+/).filter(Boolean)
  if (!text || words.length === 0) return []

  const { folded, origin } = fold(text)
  const found: SearchHit[] = []

  for (const word of words) {
    const term = fold(word).folded
    if (!term) continue

    let at = folded.indexOf(term)
    while (at !== -1) {
      found.push({ start: origin[at], end: origin[at + term.length - 1] + 1 })
      at = folded.indexOf(term, at + term.length)
    }
  }

  return merge(found)
}

/** Überschneidende Fundstellen zu einer zusammenziehen. */
function merge(hits: SearchHit[]): SearchHit[] {
  const sorted = [...hits].sort((a, b) => a.start - b.start || a.end - b.end)
  const result: SearchHit[] = []

  for (const hit of sorted) {
    const last = result[result.length - 1]
    if (last && hit.start <= last.end) last.end = Math.max(last.end, hit.end)
    else result.push({ ...hit })
  }

  return result
}

/**
 * Ein Ausschnitt um die erste Fundstelle – für lange Beschreibungen.
 *
 * Ein Treffer im dritten Absatz einer Beschreibung ist kein Treffer, wenn
 * man ihn nicht sieht. Der Ausschnitt bringt ihn nach vorn, mit ein paar
 * Wörtern Umgebung; angeschnittene Ränder bekommen Auslassungspunkte.
 *
 * Zurück kommt der Ausschnitt samt seinem Versatz, damit die Fundstellen
 * darin erneut bestimmt werden können.
 */
export function searchSnippet(text: string, needle: string, around = 60): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const [first] = searchHits(clean, needle)
  if (!first) return clean.length > around * 2 ? `${clean.slice(0, around * 2).trim()} …` : clean

  const from = Math.max(0, first.start - around)
  const to = Math.min(clean.length, first.end + around)

  return `${from > 0 ? '… ' : ''}${clean.slice(from, to).trim()}${to < clean.length ? ' …' : ''}`
}
