import { splitMentions, type Mention } from './mention.ts'
import { uid } from './utils.ts'
import type {
  AgendaItem,
  CallingChanges,
  CallingMemberRow,
  CallingOpenRow,
  CallingUrgency,
} from './types.ts'

/**
 * Die Berufungsrunde als zwei Tabellen.
 *
 * Regelmässig geht die Bischofschaft dieselbe Runde durch, und sie hat
 * immer dieselben zwei Hälften: **wer eine Aufgabe braucht** und **welche
 * Aufgabe jemanden braucht**. Als variables Layout wäre das jedes Mal von
 * Hand zu stellen – sechs Spalten, zwei Überschriften, immer dieselben.
 * Deshalb steht die Form hier fest, und ausgefüllt wird nur noch.
 *
 * **Es ist eine Ideenliste und sonst nichts.** Was hier steht, ändert an
 * keiner Berufung und an keinem Mitgliederdatensatz etwas; wer welche
 * Berufung hat, sagt allein das LCR und der Import von dort. Dass die
 * Namen trotzdem aus dem Verzeichnis kommen, hat einen anderen Grund: So
 * führt jeder Name zur Person, und die App weiss, wen eine Zeile angeht.
 *
 * Alles hier ist reine Rechnung ohne React und ohne Firestore – geprüft in
 * `tests/calling-changes.test.ts`.
 */

const URGENCIES: CallingUrgency[] = ['high', 'medium', 'low']

/**
 * Mehr Zeilen trägt keine Runde – und eine verunglückte Liste aus Firestore
 * soll nicht die ganze Seite lahmlegen.
 */
export const MAX_CALLING_ROWS = 100

export function newCallingMemberRow(): CallingMemberRow {
  return { id: uid(), memberIds: [], calling: '', ideas: '', assignees: [] }
}

export function newCallingOpenRow(): CallingOpenRow {
  return { id: uid(), calling: '', candidates: '', next: '', assignees: [] }
}

/** Der Ausgangszustand: je eine leere Zeile in beiden Tabellen. */
export function emptyCallingChanges(): CallingChanges {
  return { members: [newCallingMemberRow()], open: [newCallingOpenRow()] }
}

/* ------------------------------------------------------------------ */
/* Steht etwas drin?                                                   */
/* ------------------------------------------------------------------ */

export function isCallingMemberRowEmpty(row: CallingMemberRow): boolean {
  return (
    row.memberIds.length === 0 &&
    !row.calling.trim() &&
    !row.ideas.trim() &&
    row.assignees.length === 0 &&
    !row.urgency
  )
}

export function isCallingOpenRowEmpty(row: CallingOpenRow): boolean {
  return (
    !row.calling.trim() &&
    !row.candidates.trim() &&
    !row.next.trim() &&
    row.assignees.length === 0 &&
    !row.urgency
  )
}

export function isCallingChangesEmpty(changes: CallingChanges | null | undefined): boolean {
  if (!changes) return true
  return changes.members.every(isCallingMemberRowEmpty) && changes.open.every(isCallingOpenRowEmpty)
}

/** Ist diese Zeile beschrieben? Die letzte, leere Zeile jeder Tabelle ist es nicht. */
export function isCallingRowEmpty(row: CallingMemberRow | CallingOpenRow): boolean {
  return 'memberIds' in row ? isCallingMemberRowEmpty(row) : isCallingOpenRowEmpty(row)
}

/**
 * Wie viel in dieser Runde noch offen ist – und wie viel abgeschlossen.
 *
 * Gezählt wird, was beschrieben ist: Die leere Zeile am Ende einer Tabelle
 * steht dort als Eingang und ist keine Arbeit. Daran hängt, ob der ganze
 * Eintrag abgehakt werden kann – eine Berufungsrunde ist fertig, wenn keine
 * Zeile mehr offen ist, und nicht schon dann, wenn jemand sie für fertig
 * hält.
 */
export function callingRowCounts(changes: CallingChanges | null | undefined): {
  open: number
  done: number
} {
  const counts = { open: 0, done: 0 }
  if (!changes) return counts
  // Was aus Firestore kommt, darf kaputt sein – eine fehlende Tabelle soll
  // nicht die halbe Seite mitreissen.
  ;[...(changes.members ?? []), ...(changes.open ?? [])].forEach((row) => {
    if (isCallingRowEmpty(row)) return
    if (row.done) counts.done += 1
    else counts.open += 1
  })
  return counts
}

/**
 * Steht in dieser Runde noch etwas offen?
 *
 * Daran hängt der grüne Knopf «Erledigt» am ganzen Eintrag: Eine
 * Berufungsrunde wird zeilenweise abgeschlossen, und sie als Ganzes
 * abzuhaken, während die Hälfte noch aussteht, hiesse mehr zu erledigen, als
 * besprochen wurde. Wieder öffnen lässt sich ein Eintrag dagegen immer – das
 * fragt hier niemand.
 */
export function hasOpenCallingRows(changes: CallingChanges | null | undefined): boolean {
  return callingRowCounts(changes).open > 0
}

/* ------------------------------------------------------------------ */
/* Lesen und schreiben                                                 */
/* ------------------------------------------------------------------ */

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
}

function toUrgency(value: unknown): CallingUrgency | undefined {
  return URGENCIES.includes(value as CallingUrgency) ? (value as CallingUrgency) : undefined
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .slice(0, MAX_CALLING_ROWS)
}

function base(row: Record<string, unknown>): { id: string; assignees: string[]; done?: true } {
  return {
    id: typeof row.id === 'string' && row.id ? row.id : uid(),
    assignees: idList(row.assignees),
    // Nur die abgeschlossene Zeile trägt den Schlüssel – ein `false` an jeder
    // offenen Zeile wäre in zwanzig Zeilen zwanzigmal nichts.
    ...(row.done === true ? { done: true as const } : {}),
  }
}

/**
 * Aus irgendetwas zwei gültige Tabellen machen.
 *
 * Ein Datensatz aus Firestore darf ruhig kaputt sein: Fehlt eine Tabelle,
 * steht darin eine leere Zeile – eine Tabelle ohne Zeile liesse sich nicht
 * ausfüllen. Aus demselben Grund lässt sich die letzte Zeile auch in der
 * Oberfläche nicht entfernen.
 */
export function normalizeCallingChanges(
  input: Partial<CallingChanges> | null | undefined,
): CallingChanges {
  const members = rowsOf(input?.members).map((row) => {
    const clean: CallingMemberRow = {
      ...base(row),
      memberIds: idList(row.memberIds),
      calling: text(row.calling),
      ideas: text(row.ideas),
    }
    const urgency = toUrgency(row.urgency)
    if (urgency) clean.urgency = urgency
    return clean
  })

  const open = rowsOf(input?.open).map((row) => {
    const clean: CallingOpenRow = {
      ...base(row),
      calling: text(row.calling),
      candidates: text(row.candidates),
      next: text(row.next),
    }
    const urgency = toUrgency(row.urgency)
    if (urgency) clean.urgency = urgency
    return clean
  })

  return {
    members: members.length > 0 ? members : [newCallingMemberRow()],
    open: open.length > 0 ? open : [newCallingOpenRow()],
  }
}

/**
 * Für Firestore: nur gesetzte Schlüssel.
 *
 * Ein `undefined` irgendwo im Objekt lässt den ganzen Schreibvorgang
 * scheitern, und `stripUndefined()` räumt nur die oberste Ebene ab.
 */
export function serializeCallingChanges(changes: CallingChanges): CallingChanges {
  return {
    members: changes.members.map((row) => {
      const stored: CallingMemberRow = {
        id: row.id,
        memberIds: row.memberIds ?? [],
        calling: row.calling ?? '',
        ideas: row.ideas ?? '',
        assignees: row.assignees ?? [],
      }
      if (row.urgency) stored.urgency = row.urgency
      if (row.done) stored.done = true
      return stored
    }),
    open: changes.open.map((row) => {
      const stored: CallingOpenRow = {
        id: row.id,
        calling: row.calling ?? '',
        candidates: row.candidates ?? '',
        next: row.next ?? '',
        assignees: row.assignees ?? [],
      }
      if (row.urgency) stored.urgency = row.urgency
      if (row.done) stored.done = true
      return stored
    }),
  }
}

/* ------------------------------------------------------------------ */
/* Reihenfolge                                                         */
/* ------------------------------------------------------------------ */

/**
 * Eine Zeile an eine andere Stelle setzen – die übrigen rücken nach.
 *
 * Die Reihenfolge einer Runde ist die Reihenfolge des Arrays und sonst
 * nichts: Sie steht damit im Eintrag selbst, wird mit ihm gespeichert und
 * gilt für alle, die ihn öffnen. Ein eigenes Feld je Zeile bräuchte es nur,
 * wenn zwei Ansichten dieselben Zeilen verschieden ordnen sollten – hier
 * ordnet sie eine einzige.
 *
 * Ein Ziel ausserhalb der Liste wird an ihr Ende bzw. ihren Anfang gerückt:
 * Der Pfeil an der obersten Zeile soll nichts tun und nicht die Liste
 * verdrehen.
 */
export function moveCallingRow<T extends { id: string }>(rows: T[], id: string, to: number): T[] {
  const from = rows.findIndex((row) => row.id === id)
  if (from === -1) return rows

  const target = Math.max(0, Math.min(to, rows.length - 1))
  if (from === target) return rows

  const next = [...rows]
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}

/* ------------------------------------------------------------------ */
/* Als Text                                                            */
/* ------------------------------------------------------------------ */

export const CALLING_TABLE_TITLES = {
  members: 'Neue Berufungen',
  open: 'Offene Berufungen',
} as const

function line(parts: (string | undefined)[]): string {
  return parts
    .map((part) => part?.replace(/\s+/g, ' ').trim())
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

/**
 * Alles, was in **einer** Zeile steht – als ein Stück Text.
 *
 * Damit sucht die Runde in sich selbst: Wer «PV» eintippt, sieht die Zeilen,
 * in denen «PV» vorkommt – gleich in welcher Spalte, im Namen so gut wie im
 * Freitext. Personen zählen mit ihrem Namen mit, sofern der Aufrufer sie
 * auflösen kann; sonst stünde in der Zeile eine ID, die niemand tippt.
 */
export function callingRowText(
  row: CallingMemberRow | CallingOpenRow,
  resolve?: (id: string) => string | undefined,
): string {
  const name = (id: string) => resolve?.(id) ?? ''
  const fields =
    'memberIds' in row
      ? [row.memberIds.map(name).join(' '), row.calling, row.ideas]
      : [row.calling, row.candidates, row.next]
  return [...fields, row.assignees.map(name).join(' ')]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Die beiden Tabellen als Text – für die Suche und für das Protokoll.
 *
 * Je Zeile eine Zeile, die Felder mit «·» getrennt, leere Zeilen bleiben
 * weg. Personen stehen mit Namen da, sofern der Aufrufer sie auflösen kann;
 * `resolve` bekommt sowohl Konten als auch Mitglieder zu sehen.
 */
export function callingChangesToText(
  changes: CallingChanges | null | undefined,
  resolve?: (id: string) => string | undefined,
): string {
  if (!changes) return ''
  const name = (id: string) => resolve?.(id) ?? id

  const blocks: string[] = []

  const members = changes.members.filter((row) => !isCallingMemberRowEmpty(row))
  if (members.length > 0) {
    blocks.push(
      [
        CALLING_TABLE_TITLES.members,
        ...members.map((row) =>
          line([
            row.memberIds.map(name).join(', '),
            row.calling,
            row.ideas,
            row.assignees.length > 0 ? `Zuständig: ${row.assignees.map(name).join(', ')}` : '',
            row.done ? 'Erledigt' : '',
          ]),
        ),
      ].join('\n'),
    )
  }

  const open = changes.open.filter((row) => !isCallingOpenRowEmpty(row))
  if (open.length > 0) {
    blocks.push(
      [
        CALLING_TABLE_TITLES.open,
        ...open.map((row) =>
          line([
            row.calling,
            row.candidates,
            row.next,
            row.assignees.length > 0 ? `Zuständig: ${row.assignees.map(name).join(', ')}` : '',
            row.done ? 'Erledigt' : '',
          ]),
        ),
      ].join('\n'),
    )
  }

  return blocks.join('\n\n')
}

/* ------------------------------------------------------------------ */
/* Wen geht das an?                                                    */
/* ------------------------------------------------------------------ */

/**
 * Eine Zeile, in der eine bestimmte Person vorkommt – samt Herkunft.
 *
 * Aus welcher der beiden Tabellen sie stammt, entscheidet, was die Zeile
 * über die Person sagt: In «Neue Berufungen» geht es um sie, in
 * «Offene Berufungen» ist sie als Vorschlag genannt.
 */
export type CallingRowMatch =
  { table: 'members'; row: CallingMemberRow } | { table: 'open'; row: CallingOpenRow }

/**
 * Kommt ein bestimmtes Mitglied in **dieser einen** Zeile vor?
 *
 * Zwei Wege führen dahin, und beide zählen gleich:
 *
 *  - Die Zeile **nennt** das Mitglied in der Spalte «Name».
 *  - Die Zeile **erwähnt** es mit «@» in einem der Freitextfelder – wer
 *    «@Alain» als Vorschlag schreibt, meint Alain.
 *
 * Welche Felder dabei zu lesen sind, sagt die Tabelle: In «Neue Berufungen»
 * steht die Person in der Spalte «Name», in «Offene Berufungen» kann sie nur
 * erwähnt sein – eine offene Aufgabe ist niemand.
 */
function rowAbout(row: CallingMemberRow | CallingOpenRow, member: Mention): boolean {
  const named = (value: string) =>
    splitMentions(value, [member]).some((part) => part.memberId !== undefined)

  return 'memberIds' in row
    ? row.memberIds.includes(member.id) || named(row.calling) || named(row.ideas)
    : named(row.calling) || named(row.candidates) || named(row.next)
}

/**
 * Alle Zeilen, in denen ein bestimmtes Mitglied vorkommt.
 *
 * Ohne Mitglied gibt es nichts zu finden: Ein Name im Text ist dann bloss ein
 * Name, und die App hat keinen Anhaltspunkt, wer gemeint ist.
 */
export function callingRowsAbout(
  changes: CallingChanges | null | undefined,
  member: Mention | null,
): CallingRowMatch[] {
  if (!changes || member === null) return []

  const matches: CallingRowMatch[] = []
  changes.members.forEach((row) => {
    if (rowAbout(row, member)) matches.push({ table: 'members', row })
  })
  changes.open.forEach((row) => {
    if (rowAbout(row, member)) matches.push({ table: 'open', row })
  })
  return matches
}

/**
 * Geht **diese Zeile** die angemeldete Person an?
 *
 * Zwei Wege führen dahin, und beide zählen gleich:
 *
 *  - Die Zeile trägt das **Konto** unter «Zuständig» – der ausdrückliche Weg.
 *  - Die Zeile nennt oder erwähnt das **Mitglied**, das mit dem Konto
 *    verknüpft ist (siehe «Einstellungen → Benutzer und Rollen»). Wer
 *    «@Alain» in eine Zeile schreibt, meint Alain, und Alain soll die Zeile
 *    unter «Meine» wiederfinden, ohne dass ihn jemand zusätzlich anklickt.
 *
 * Ohne Verknüpfung bleibt der zweite Weg wirkungslos: Ein Name im Text ist
 * dann bloss ein Name.
 *
 * **Vom Abhaken weiss diese Frage nichts.** Wem eine Zeile gehört, ändert
 * sich nicht dadurch, dass sie erledigt ist – die erledigte Zeile ist die
 * meine, die ich abgehakt habe. Genau das braucht der Knopf «Nur meine» in
 * der Runde: Dort sagt ein zweiter Schalter, ob das Erledigte dabei ist, und
 * beide Fragen dürfen sich nicht ins Gehege kommen. Für die Liste «Meine»
 * kommt die Bedingung eine Zeile weiter unten dazu (`isOwnCallingRow`).
 */
export function callingRowConcern(
  row: CallingMemberRow | CallingOpenRow,
  userId: string | null | undefined,
  member: Mention | null,
): boolean {
  if (userId && row.assignees.includes(userId)) return true
  return member !== null && rowAbout(row, member)
}

/**
 * Ist **diese Zeile** eine offene Aufgabe der angemeldeten Person?
 *
 * Dieselbe Frage wie `callingRowConcern`, mit einer Bedingung mehr: Eine
 * abgeschlossene Zeile ist keine Aufgabe. Wessen letzte Zeile erledigt ist,
 * für den fällt die ganze Runde von der Liste «Meine».
 *
 * Es ist dieselbe Frage, die den ganzen Eintrag auf die Liste «Meine» bringt –
 * bloss eine Ebene tiefer gestellt.
 */
export function isOwnCallingRow(
  row: CallingMemberRow | CallingOpenRow,
  userId: string | null | undefined,
  member: Mention | null,
): boolean {
  if (row.done) return false
  return callingRowConcern(row, userId, member)
}

/** Betrifft **eine** dieser Zeilen die angemeldete Person? */
export function callingChangesConcern(
  changes: CallingChanges | null | undefined,
  userId: string | null | undefined,
  member: Mention | null,
): boolean {
  if (!changes) return false
  const own = (row: CallingMemberRow | CallingOpenRow) => isOwnCallingRow(row, userId, member)
  return changes.members.some(own) || changes.open.some(own)
}

/**
 * Gehört dieser Eintrag auf die Liste «Meine»?
 *
 * Bis anhin war das eine einzige Frage – steht mein Konto unter
 * «Zuständig»? –, und für ein Traktandum mit einer Beschreibung ist sie das
 * weiterhin. Eine Berufungsrunde dagegen ist ein Eintrag mit zwanzig
 * Zeilen, die untereinander verteilt werden; sie gehört jedem, der darin
 * eine Zeile hat.
 */
export function isOwnItem(
  item: Pick<AgendaItem, 'assignees' | 'callingChanges'>,
  userId: string | null | undefined,
  member: Mention | null,
): boolean {
  if (userId && item.assignees?.includes(userId)) return true
  return callingChangesConcern(item.callingChanges, userId, member)
}
