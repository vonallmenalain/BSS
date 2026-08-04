/**
 * Das `@` in einem Textfeld erkennen.
 *
 * Beim Erfassen eines Traktandums geht es fast immer um jemanden. Ein `@`
 * mitten im Satz öffnet deshalb die Mitgliederliste – wie man es von
 * Nachrichten kennt. Hier steht nur die Frage, ob der Cursor gerade hinter
 * einem solchen `@` steht; die Auswahl selbst ist Sache der Oberfläche
 * (`components/ui/MentionField`).
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
