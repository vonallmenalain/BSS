import { splitMentions, type Mention } from './mention.ts'
import { uid } from './utils.ts'
import type {
  AgendaItem,
  CallingChanges,
  CallingMemberRow,
  CallingOpenRow,
  CallingRowBase,
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

function base(row: Record<string, unknown>): { id: string; assignees: string[] } {
  return {
    id: typeof row.id === 'string' && row.id ? row.id : uid(),
    assignees: idList(row.assignees),
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
      return stored
    }),
  }
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
 * Alle Zeilen, in denen ein bestimmtes Mitglied vorkommt.
 *
 * Zwei Wege führen dahin, und beide zählen gleich:
 *
 *  - Die Zeile **nennt** das Mitglied in der Spalte «Name».
 *  - Die Zeile **erwähnt** es mit «@» in einem der Freitextfelder – wer
 *    «@Alain» als Vorschlag schreibt, meint Alain.
 *
 * Ohne Mitglied gibt es nichts zu finden: Ein Name im Text ist dann bloss ein
 * Name, und die App hat keinen Anhaltspunkt, wer gemeint ist.
 */
export function callingRowsAbout(
  changes: CallingChanges | null | undefined,
  member: Mention | null,
): CallingRowMatch[] {
  if (!changes || member === null) return []

  const named = (value: string) =>
    splitMentions(value, [member]).some((part) => part.memberId !== undefined)

  const matches: CallingRowMatch[] = []

  changes.members.forEach((row) => {
    if (row.memberIds.includes(member.id) || named(row.calling) || named(row.ideas)) {
      matches.push({ table: 'members', row })
    }
  })

  changes.open.forEach((row) => {
    if (named(row.calling) || named(row.candidates) || named(row.next)) {
      matches.push({ table: 'open', row })
    }
  })

  return matches
}

/**
 * Betrifft eine dieser Zeilen die angemeldete Person?
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
 */
export function callingChangesConcern(
  changes: CallingChanges | null | undefined,
  userId: string | null | undefined,
  member: Mention | null,
): boolean {
  if (!changes) return false

  if (userId) {
    const assigned = (rows: CallingRowBase[]) => rows.some((row) => row.assignees.includes(userId))
    if (assigned(changes.members) || assigned(changes.open)) return true
  }

  return callingRowsAbout(changes, member).length > 0
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
