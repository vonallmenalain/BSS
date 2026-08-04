/**
 * Das `@` in einem Textfeld erkennen – und den eingesetzten Namen wiederfinden.
 *
 * Beim Erfassen eines Traktandums geht es fast immer um jemanden. Ein `@`
 * mitten im Satz öffnet deshalb die Mitgliederliste – wie man es von
 * Nachrichten kennt. Hier stehen zwei Fragen: ob der Cursor gerade hinter
 * einem solchen `@` steht (`findMentionTrigger`), und wo in einem fertigen
 * Text die erwähnten Personen stehen (`splitMentions`). Die Darstellung ist
 * Sache der Oberfläche (`components/ui/MentionField`, `MentionText`).
 */

/** Wie weit vor dem Cursor nach einem `@` gesucht wird. */
const MAX_QUERY = 30

export interface MentionTrigger {
  /** Stelle des `@` im Text */
  start: number
  /** Was seither getippt wurde – der Suchbegriff */
  query: string
}

/**
 * Das `@` unmittelbar vor dem Cursor – oder `null`.
 *
 * Zwei Fälle sind bewusst keine Erwähnung: ein `@` mitten in einem Wort
 * (eine E-Mail-Adresse ruft keine Liste auf) und eine Suche über einen
 * Zeilenumbruch hinweg (wer weiterschreibt, meint kein Mitglied mehr).
 */
export function findMentionTrigger(text: string, caret: number): MentionTrigger | null {
  const position = Math.max(0, Math.min(caret, text.length))
  const start = text.lastIndexOf('@', position - 1)
  if (start < 0 || start < position - MAX_QUERY - 1) return null

  const before = start > 0 ? text[start - 1] : ' '
  if (!/[\s(«"'/-]/.test(before)) return null

  const query = text.slice(start + 1, position)
  if (/[\n\t]/.test(query)) return null
  return { start, query }
}

/* ------------------------------------------------------------------ */
/* Erwähnungen im fertigen Text                                        */
/* ------------------------------------------------------------------ */

/** Eine Person, die im Text erwähnt sein kann. */
export interface Mention {
  id: string
  name: string
}

/** Ein Stück Text: gewöhnlicher Text oder der Name einer erwähnten Person. */
export interface MentionPart {
  text: string
  /** Gesetzt, wenn dieses Stück der Name eines erwähnten Mitglieds ist. */
  memberId?: string
}

/** Buchstabe oder Ziffer? Namen dürfen nicht mitten aus einem Wort gerissen werden. */
function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char)
}

/**
 * Zerlegt einen Text in Stücke – Text, erwähnte Person, Text …
 *
 * Gespeichert wird die Erwähnung nicht als Markierung im Text, sondern als
 * Verweis daneben (`AgendaItem.memberRefs`): Im Feld steht schlicht der Name,
 * genau so, wie ihn jemand geschrieben hätte. Das hat einen Preis – der Name
 * muss beim Anzeigen wiedergefunden werden – und einen Gewinn: Der Text bleibt
 * lesbar, auch wenn ihn niemand mehr durch diese Funktion schickt, und wer
 * eine Erwähnung nicht mehr will, löscht einfach den Namen.
 *
 * Der längste Name gewinnt, damit «Peter Meier» nicht zu «Peter» wird, und
 * innerhalb eines Wortes wird nichts erkannt – «Meierhof» ist kein Meier.
 */
export function splitMentions(text: string, mentions: Mention[]): MentionPart[] {
  if (!text) return []

  const found: { start: number; end: number; id: string }[] = []
  const haystack = text.toLowerCase()

  for (const mention of mentions) {
    const name = mention.name.trim()
    if (!name) continue
    const needle = name.toLowerCase()

    let from = 0
    for (;;) {
      const start = haystack.indexOf(needle, from)
      if (start < 0) break
      const end = start + needle.length
      if (!isWordChar(text[start - 1]) && !isWordChar(text[end])) {
        found.push({ start, end, id: mention.id })
      }
      from = start + 1
    }
  }

  // Der längste Treffer zuerst: Bei «Peter Meier» und «Peter» am selben Ort
  // gewinnt der ganze Name, der kürzere überlappt danach und fällt weg.
  found.sort((a, b) => a.start - b.start || b.end - a.end)

  const parts: MentionPart[] = []
  let position = 0

  for (const hit of found) {
    if (hit.start < position) continue
    if (hit.start > position) parts.push({ text: text.slice(position, hit.start) })
    parts.push({ text: text.slice(hit.start, hit.end), memberId: hit.id })
    position = hit.end
  }

  if (position < text.length) parts.push({ text: text.slice(position) })
  return parts
}
