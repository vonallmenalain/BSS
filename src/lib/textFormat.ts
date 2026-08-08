/**
 * Ein wenig Auszeichnung im Text – Aufzählung, Schriftfarbe, Hintergrund.
 *
 * ## Warum überhaupt
 *
 * In einer Pendenz steht selten ein Absatz, sondern meist eine Liste: wer was
 * übernimmt, was noch fehlt, was dringend ist. Bis hierhin half sich jeder mit
 * Bindestrichen und Grossbuchstaben. Drei Handgriffe genügen, damit daraus
 * etwas wird, das man auf einen Blick liest: **Aufzählung**, **Schriftfarbe**
 * und **Hintergrundfarbe**. Mehr nicht – ein Textverarbeitungsprogramm gehört
 * nicht in eine Sitzungs-App.
 *
 * ## Wie es gespeichert wird
 *
 * Nicht als HTML und nicht in einem zweiten Feld daneben, sondern **im Text
 * selbst**, als kurze Markierung:
 *
 * ```
 * {{rot|dringend}}          rote Schrift
 * {{/gelb|dringend}}        gelb hinterlegt
 * {{rot/gelb|dringend}}     beides
 * - Brief an die Missionare eine Zeile der Aufzählung
 * ```
 *
 * Das ist derselbe Weg, den Erwähnungen (`lib/mention`) und Verweise
 * (`lib/links`) schon gehen: Im Feld steht Text, und erst beim Anzeigen wird
 * daraus etwas. Der Gewinn ist derselbe – der Text bleibt ein Text. Er lässt
 * sich weiterhin suchen, kopieren, ins Protokoll schreiben und in eine
 * Sicherung legen, und wer die Markierung nicht mehr will, löscht sie von
 * Hand. Ein Feld voller HTML wäre nichts davon.
 *
 * Die Aufzählung braucht gar keine eigene Markierung: Ein Strich am
 * Zeilenanfang ist, was ohnehin alle schreiben. Aus `- Boas` wird beim Anzeigen
 * ein Aufzählungszeichen mit hängendem Einzug – und alles, was je in diesem
 * Stil geschrieben wurde, sieht rückwirkend richtig aus. Zwei Leerzeichen mehr
 * am Anfang rücken eine Zeile eine Stufe tiefer.
 *
 * ## Was hier nicht steht
 *
 * Die Darstellung (`components/ui/RichText`) und das Menü
 * (`components/ui/FormatMenu`). Diese Datei kennt weder React noch den
 * Browser – damit sich die Regeln mit `node --test` prüfen lassen
 * (`tests/text-format.test.ts`).
 */

/* ------------------------------------------------------------------ */
/* Die Farben                                                          */
/* ------------------------------------------------------------------ */

/**
 * Schriftfarben – wenige, kräftige, in beiden Erscheinungsbildern lesbar.
 *
 * Je Farbe eine gedeckte Fassung für den hellen und eine hellere für den
 * dunklen Hintergrund: Ein sattes Rot auf Dunkelgrau ist nicht mehr zu lesen.
 * `dot` ist der Farbtupfer im Menü – dort steht die Farbe für sich und nicht
 * auf Text.
 */
export const TEXT_COLORS = [
  { key: 'rot', label: 'Rot', className: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  {
    key: 'orange',
    label: 'Orange',
    className: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  {
    key: 'grün',
    label: 'Grün',
    className: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  {
    key: 'blau',
    label: 'Blau',
    className: 'text-brand-600 dark:text-brand-300',
    dot: 'bg-brand-500',
  },
  {
    key: 'violett',
    label: 'Violett',
    className: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  {
    key: 'grau',
    label: 'Grau',
    className: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
] as const

export type TextColor = (typeof TEXT_COLORS)[number]['key']

/**
 * Hintergrundfarben – der Leuchtstift.
 *
 * Sie setzen **nur** die Fläche und nie die Schriftfarbe: Sonst stritten zwei
 * Klassen um dieselbe Eigenschaft, und welche gewönne, entschiede die
 * Reihenfolge im fertigen Stylesheet – also der Zufall. Deshalb sind die
 * Flächen so hell (bzw. im Dunkeln so durchscheinend) gewählt, dass die
 * gewöhnliche Schriftfarbe darauf stehen bleiben kann.
 */
export const BACKGROUND_COLORS = [
  {
    key: 'gelb',
    label: 'Gelb',
    className: 'bg-amber-200 dark:bg-amber-400/30',
    dot: 'bg-amber-200',
  },
  {
    key: 'grün',
    label: 'Grün',
    className: 'bg-emerald-200 dark:bg-emerald-400/30',
    dot: 'bg-emerald-200',
  },
  { key: 'blau', label: 'Blau', className: 'bg-sky-200 dark:bg-sky-400/30', dot: 'bg-sky-200' },
  { key: 'rosa', label: 'Rosa', className: 'bg-pink-200 dark:bg-pink-400/30', dot: 'bg-pink-200' },
  {
    key: 'grau',
    label: 'Grau',
    className: 'bg-slate-200 dark:bg-slate-600/40',
    dot: 'bg-slate-300',
  },
] as const

export type BackgroundColor = (typeof BACKGROUND_COLORS)[number]['key']

/** Wie ein Stück Text aussieht. Beides zusammen ist erlaubt, keines auch. */
export interface Format {
  color?: TextColor
  background?: BackgroundColor
}

const TEXT_KEYS = new Set<string>(TEXT_COLORS.map((entry) => entry.key))
const BACKGROUND_KEYS = new Set<string>(BACKGROUND_COLORS.map((entry) => entry.key))

/**
 * Die Klassen zu einer Auszeichnung – oder `undefined`, wenn keine gesetzt ist.
 *
 * `box-decoration-clone` gehört zum Leuchtstift: Ohne das bekäme eine
 * Markierung, die über den Zeilenumbruch läuft, ihre abgerundeten Ecken nur
 * einmal, und die zweite Zeile hinge als eckiger Balken darunter.
 */
export function formatClass(format: Format | undefined): string | undefined {
  if (!format?.color && !format?.background) return undefined

  const classes: string[] = []
  if (format.color) {
    classes.push(TEXT_COLORS.find((entry) => entry.key === format.color)!.className)
  }
  if (format.background) {
    classes.push(BACKGROUND_COLORS.find((entry) => entry.key === format.background)!.className)
    classes.push('box-decoration-clone rounded px-0.5')
  }
  return classes.join(' ')
}

/* ------------------------------------------------------------------ */
/* Lesen                                                               */
/* ------------------------------------------------------------------ */

/**
 * Die Markierung im Text.
 *
 * Im Inneren sind geschweifte Klammern verboten. Das kostet die Möglichkeit,
 * ausgerechnet `{` einzufärben, und erspart dafür jede Frage nach
 * Verschachtelung: Eine Markierung endet bei den ersten zwei schliessenden
 * Klammern, und zwar immer bei den eigenen.
 */
const MARKER = /\{\{(\p{L}*)(?:\/(\p{L}+))?\|([^{}]*)\}\}/gu

/** Ein ausgezeichnetes Stück im einfachen Text – Anfang, Ende, Aussehen. */
export interface Span extends Format {
  start: number
  /** Erstes Zeichen **nach** dem Stück */
  end: number
}

export interface Parsed {
  /** Der Text ohne Markierungen – das, was man liest. */
  text: string
  spans: Span[]
  /**
   * Zu jedem Zeichen des einfachen Textes seine Stelle im geschriebenen.
   *
   * Der Merkzettel für den Rückweg: Im Feld steht der Text **mit**
   * Markierungen, und dort steht auch der Cursor. Wer eine Auswahl
   * weiterreicht, muss sie zwischen beiden Zählweisen übersetzen können.
   */
  origin: number[]
}

/** Zerlegt den geschriebenen Text in das, was dasteht, und wie es aussieht. */
export function parseFormat(raw: string): Parsed {
  const chars: string[] = []
  const origin: number[] = []
  const spans: Span[] = []
  let position = 0

  const take = (from: number, to: number) => {
    for (let index = from; index < to; index++) {
      chars.push(raw[index])
      origin.push(index)
    }
  }

  for (const match of raw.matchAll(MARKER)) {
    const at = match.index
    const color = TEXT_KEYS.has(match[1]) ? (match[1] as TextColor) : undefined
    const background = BACKGROUND_KEYS.has(match[2]) ? (match[2] as BackgroundColor) : undefined

    /*
     * Eine Markierung mit unbekannter Farbe ist keine – sie bleibt als Text
     * stehen. So wird aus einem Tippfehler kein verschwundener Satz, und ein
     * Text aus einer künftigen Fassung mit mehr Farben verliert höchstens
     * seine Farbe, nie seinen Inhalt.
     */
    if ((match[1] && !color) || (match[2] && !background) || (!color && !background)) continue

    take(position, at)
    const start = chars.length
    // Farbnamen tragen keinen senkrechten Strich – der erste trennt.
    const inner = at + match[0].indexOf('|') + 1
    take(inner, inner + match[3].length)
    spans.push({ start, end: chars.length, color, background })
    position = at + match[0].length
  }

  take(position, raw.length)
  return { text: chars.join(''), spans, origin }
}

/**
 * Der Text ohne jede Markierung.
 *
 * Für alles, was den Text als Text braucht: die Suche, das gedruckte
 * Protokoll, eine knappe Vorschau.
 */
export function plainText(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.includes('{{') ? parseFormat(raw).text : raw
}

/* ------------------------------------------------------------------ */
/* Aufzählung                                                          */
/* ------------------------------------------------------------------ */

/**
 * Eine Zeile der Aufzählung: Einzug, Zeichen, Abstand.
 *
 * Erkannt werden `-`, `*` und `•`, weil alle drei geschrieben werden. Gezeigt
 * wird danach überall dasselbe Zeichen – wie eine Liste aussieht, ist keine
 * Frage dessen, was jemand getippt hat.
 */
const BULLET = /^([ \t]*)([-*•])([ \t]+)/

/** Wie tief eine Zeile eingerückt ist – zwei Leerzeichen sind eine Stufe. */
function bulletLevel(indent: string): number {
  return Math.min(3, Math.floor(indent.replace(/\t/g, '  ').length / 2))
}

/* ------------------------------------------------------------------ */
/* Der Text als Zeichenkette mit Aussehen                              */
/* ------------------------------------------------------------------ */

/**
 * Ein Zeichen und wie es aussieht.
 *
 * Zum Ändern ist das die einfachste brauchbare Form: Farbe setzen heisst
 * «diesen Zeichen diese Farbe», Aufzählung heisst «hier zwei Zeichen
 * einfügen». Alles Kniffelige – überlappende Markierungen, eine Auswahl
 * mitten in einer bestehenden, das Zusammenfassen gleicher Nachbarn –
 * erledigt sich damit von selbst. Texte in dieser App sind kurz; der Aufwand
 * fällt nicht ins Gewicht.
 */
interface Cell extends Format {
  char: string
}

function toCells(parsed: Parsed): Cell[] {
  const cells: Cell[] = []

  /*
   * Gezählt wird in UTF-16-Einheiten und nicht in Codepunkten – denn so zählt
   * auch das Textfeld, dessen Auswahl hier ankommt. Ein Emoji wird damit zu
   * zwei Zellen mit demselben Aussehen und beim Schreiben wieder zu einem.
   */
  for (let index = 0; index < parsed.text.length; index++) {
    cells.push({ char: parsed.text[index] })
  }

  for (const span of parsed.spans) {
    for (let index = span.start; index < span.end; index++) {
      if (span.color) cells[index].color = span.color
      if (span.background) cells[index].background = span.background
    }
  }
  return cells
}

/** Zurück in den geschriebenen Text – gleiche Nachbarn kommen in eine Markierung. */
function fromCells(cells: Cell[]): string {
  let out = ''
  let index = 0

  while (index < cells.length) {
    const { color, background } = cells[index]
    let end = index + 1
    while (
      end < cells.length &&
      cells[end].color === color &&
      cells[end].background === background
    ) {
      end++
    }

    let run = ''
    for (let at = index; at < end; at++) run += cells[at].char

    // Geschweifte Klammern im Text: dann lieber keine Farbe als eine
    // Markierung, die sich beim nächsten Lesen nicht wiederfindet.
    out += (color || background) && !/[{}]/.test(run) ? wrap(run, color, background) : run
    index = end
  }

  return out
}

function wrap(run: string, color?: TextColor, background?: BackgroundColor): string {
  return `{{${color ?? ''}${background ? `/${background}` : ''}|${run}}}`
}

/* ------------------------------------------------------------------ */
/* Zwischen den beiden Zählweisen                                      */
/* ------------------------------------------------------------------ */

/** Wie viele Zeichen des einfachen Textes vor dieser Stelle im Feld liegen. */
function toPlain(parsed: Parsed, raw: number): number {
  let count = 0
  while (count < parsed.origin.length && parsed.origin[count] < raw) count++
  return count
}

/** Die Stelle im Feld, an der dieses Zeichen beginnt. */
function toRawStart(parsed: Parsed, plain: number): number {
  if (parsed.origin.length === 0) return 0
  if (plain >= parsed.origin.length) return parsed.origin[parsed.origin.length - 1] + 1
  return parsed.origin[Math.max(0, plain)]
}

/** Die Stelle im Feld unmittelbar hinter dem Zeichen davor. */
function toRawEnd(parsed: Parsed, plain: number): number {
  if (parsed.origin.length === 0) return 0
  if (plain <= 0) return parsed.origin[0]
  return parsed.origin[Math.min(plain, parsed.origin.length) - 1] + 1
}

/* ------------------------------------------------------------------ */
/* Ändern                                                              */
/* ------------------------------------------------------------------ */

/** Der neue Feldinhalt und wo die Auswahl danach steht. */
export interface Edit {
  text: string
  start: number
  end: number
}

/** Die beiden Enden der Auswahl im einfachen Text. */
function selection(parsed: Parsed, from: number, to: number): [number, number] {
  return [toPlain(parsed, Math.min(from, to)), toPlain(parsed, Math.max(from, to))]
}

/** Die Auswahl zurück in die Zählweise des Feldes. */
function edit(text: string, start: number, end: number): Edit {
  const parsed = parseFormat(text)
  return { text, start: toRawStart(parsed, start), end: toRawEnd(parsed, end) }
}

/**
 * Schrift- oder Hintergrundfarbe über die Auswahl legen – oder wegnehmen.
 *
 * `null` heisst «keine»: Damit wird zurückgenommen, was dasteht, und zwar nur
 * die eine Eigenschaft. Wer den gelben Hintergrund entfernt, behält die rote
 * Schrift.
 *
 * Ohne Auswahl geschieht nichts. Eine Farbe, die erst für das nächste
 * getippte Zeichen gilt, kann ein gewöhnliches Textfeld nicht – und eine, die
 * stillschweigend den ganzen Absatz einfärbt, will niemand.
 */
export function applyColor(
  raw: string,
  from: number,
  to: number,
  kind: 'color' | 'background',
  value: TextColor | BackgroundColor | null,
): Edit {
  const parsed = parseFormat(raw)
  const [start, end] = selection(parsed, from, to)
  if (start >= end) return { text: raw, start: from, end: to }

  const cells = toCells(parsed)
  for (let index = start; index < end; index++) {
    if (kind === 'color') cells[index].color = (value as TextColor | null) ?? undefined
    else cells[index].background = (value as BackgroundColor | null) ?? undefined
  }

  return edit(fromCells(cells), start, end)
}

/**
 * Was in der Auswahl steht – für das Menü, damit es zeigt, was gilt.
 *
 * Nur was für **alles** Ausgewählte gilt, gilt als gesetzt: Eine zur Hälfte
 * rote Auswahl ist nicht rot, und der Haken gehört an keine Farbe.
 */
export function formatOf(raw: string, from: number, to: number): Format {
  const parsed = parseFormat(raw)
  const [start, end] = selection(parsed, from, to)
  if (start >= end) return {}

  const cells = toCells(parsed)
  const first = cells[start]
  let color: TextColor | undefined = first.color
  let background: BackgroundColor | undefined = first.background

  for (let index = start + 1; index < end; index++) {
    if (cells[index].color !== color) color = undefined
    if (cells[index].background !== background) background = undefined
  }

  return { color, background }
}

/** Anfang und Ende jeder Zeile des einfachen Textes. */
function lineRanges(text: string): { start: number; end: number }[] {
  const lines: { start: number; end: number }[] = []
  let at = 0
  for (;;) {
    const brk = text.indexOf('\n', at)
    lines.push({ start: at, end: brk === -1 ? text.length : brk })
    if (brk === -1) return lines
    at = brk + 1
  }
}

/**
 * Aus den berührten Zeilen eine Aufzählung machen – oder wieder Fliesstext.
 *
 * Es gilt, was für alle gilt: Stehen sämtliche berührten Zeilen schon als
 * Aufzählung da, nimmt der Griff die Striche weg; sonst setzt er sie. Ein
 * Umschalter, der bei gemischter Auswahl zweierlei täte, liesse einen jedes
 * Mal nachsehen, was geschehen ist.
 *
 * Der Einzug bleibt, wo er ist – der Strich rückt dahinter. So bleiben
 * Unterpunkte Unterpunkte.
 */
export function toggleBullets(raw: string, from: number, to: number): Edit {
  const parsed = parseFormat(raw)
  const [start, end] = selection(parsed, from, to)
  const text = parsed.text
  const cells = toCells(parsed)

  const touched = lineRanges(text).filter((line) => line.start <= end && line.end >= start)
  if (touched.length === 0) return { text: raw, start: from, end: to }

  // Leerzeilen zählen nicht mit: Ein Strich auf einer leeren Zeile sagt
  // nichts, und eine leere Zeile mitten in der Auswahl darf das Umschalten
  // nicht kippen. Nur wenn gar nichts übrig bleibt, gilt wieder alles.
  const written = touched.filter((line) => text.slice(line.start, line.end).trim() !== '')
  const relevant = written.length > 0 ? written : touched
  const remove = relevant.every((line) => BULLET.test(text.slice(line.start, line.end)))

  let head = start
  let tail = end
  const shift = (at: number, delta: number) => {
    if (head > at) head = Math.max(at, head + delta)
    if (tail > at) tail = Math.max(at, tail + delta)
  }

  // Von hinten nach vorne: So bleiben die Stellen der noch offenen Zeilen
  // gültig, während vorne schon geschnitten wird.
  for (const line of [...relevant].reverse()) {
    const content = text.slice(line.start, line.end)
    const match = BULLET.exec(content)

    if (remove) {
      if (!match) continue
      const at = line.start + match[1].length
      const width = match[2].length + match[3].length
      cells.splice(at, width)
      shift(at, -width)
      continue
    }

    if (match) continue
    const indent = /^[ \t]*/.exec(content)![0].length
    const at = line.start + indent
    // Der Strich bleibt ohne Farbe: Er ist eine Anweisung an die Darstellung
    // und kein Text, der etwas bedeutet.
    cells.splice(at, 0, { char: '-' }, { char: ' ' })
    shift(at, 2)
  }

  return edit(fromCells(cells), head, tail)
}

/** Stehen die berührten Zeilen bereits als Aufzählung da? */
export function hasBullets(raw: string, from: number, to: number): boolean {
  const parsed = parseFormat(raw)
  const [start, end] = selection(parsed, from, to)
  const text = parsed.text
  const touched = lineRanges(text).filter((line) => line.start <= end && line.end >= start)
  const written = touched.filter((line) => text.slice(line.start, line.end).trim() !== '')
  const relevant = written.length > 0 ? written : touched
  return (
    relevant.length > 0 && relevant.every((line) => BULLET.test(text.slice(line.start, line.end)))
  )
}

/* ------------------------------------------------------------------ */
/* Anzeigen                                                            */
/* ------------------------------------------------------------------ */

/** Ein Stück Text mit allem, was daran hängt. */
export interface RichPiece extends Format {
  text: string
  /** Gesetzt, wenn das Stück zum Namen einer erwähnten Person gehört. */
  memberId?: string
  /** Gesetzt, wenn das Stück zu einem Verweis gehört. */
  href?: string
}

/** Eine Zeile – als Aufzählung mit Stufe, oder als gewöhnliche Zeile. */
export interface RichLine {
  /** Einrückungstiefe der Aufzählung, `null` für eine gewöhnliche Zeile */
  level: number | null
  pieces: RichPiece[]
}

/**
 * Was eine Zeile ausser der Auszeichnung noch an sich hat.
 *
 * Erwähnungen (`splitMentions`) und Verweise (`splitLinks`) arbeiten auf
 * einfachem Text und sollen davon nichts wissen müssen. Sie bekommen deshalb
 * die fertige Zeile und geben sie zerlegt zurück; die Farben kommen hier
 * darüber. Zeilenweise genügt: Weder ein Name noch eine Adresse steht über
 * einen Zeilenumbruch hinweg.
 */
export type Decorate = (line: string) => { text: string; memberId?: string; href?: string }[]

/**
 * Der geschriebene Text als das, was gezeichnet wird.
 *
 * Eine Zeile, ein Eintrag; darin die Stücke mit Farbe, Erwähnung und Verweis.
 */
export function richLines(raw: string, decorate?: Decorate): RichLine[] {
  const parsed = parseFormat(raw)

  return lineRanges(parsed.text).map((line) => {
    const content = parsed.text.slice(line.start, line.end)
    const match = BULLET.exec(content)
    const from = line.start + (match ? match[0].length : 0)

    return {
      level: match ? bulletLevel(match[1]) : null,
      pieces: piecesIn(parsed, from, line.end, decorate),
    }
  })
}

/** Ein Abschnitt der Zeile, zerlegt nach Erwähnung, Verweis und Farbe. */
function piecesIn(parsed: Parsed, from: number, to: number, decorate?: Decorate): RichPiece[] {
  const content = parsed.text.slice(from, to)
  if (!content) return []

  const decorated = decorate ? decorate(content) : [{ text: content }]
  const pieces: RichPiece[] = []
  let at = from

  for (const part of decorated) {
    let cursor = 0
    while (cursor < part.text.length) {
      const position = at + cursor
      const limit = at + part.text.length
      const span = parsed.spans.find((entry) => entry.start <= position && position < entry.end)
      const stop = span
        ? Math.min(span.end, limit)
        : Math.min(nextSpanStart(parsed.spans, position) ?? limit, limit)

      pieces.push({
        ...part,
        text: part.text.slice(cursor, cursor + (stop - position)),
        color: span?.color,
        background: span?.background,
      })
      cursor += stop - position
    }
    at += part.text.length
  }

  return pieces
}

function nextSpanStart(spans: Span[], after: number): number | null {
  for (const span of spans) if (span.start > after) return span.start
  return null
}

/**
 * Nachbarn zusammenfassen, die zur selben Person oder demselben Verweis
 * gehören.
 *
 * Ein Name, dessen Vorname eingefärbt ist, ist trotzdem **ein** Name: Ohne
 * das stünden zwei Kreise mit denselben Initialen nebeneinander und zwei
 * Verweise dort, wo eine Adresse steht.
 */
export interface RichGroup {
  memberId?: string
  href?: string
  pieces: RichPiece[]
}

export function groupPieces(pieces: RichPiece[]): RichGroup[] {
  const groups: RichGroup[] = []

  for (const piece of pieces) {
    const last = groups[groups.length - 1]
    const same =
      last !== undefined &&
      last.memberId === piece.memberId &&
      last.href === piece.href &&
      (piece.memberId !== undefined || piece.href !== undefined)

    if (same) last.pieces.push(piece)
    else groups.push({ memberId: piece.memberId, href: piece.href, pieces: [piece] })
  }

  return groups
}

/** Das Zeichen je Stufe – wie in jedem Textprogramm: voll, hohl, klein. */
export const BULLET_MARKS = ['•', '◦', '▪', '·'] as const
