import { toDate } from './dates.ts'
import { personKeys } from './names.ts'
import type { Member } from './types.ts'

/*
 * Wer in der eingelesenen Liste welches erfasste Mitglied ist – der
 * Abgleich des Mitgliederimports, ohne Datenbank, damit er sich mit
 * `node --test` prüfen lässt (`tests/member-match.test.ts`).
 *
 * **Umlaute zählen in beiden Schreibweisen.** Das LCR schreibt denselben
 * Namen mal «Roemer» und mal «Römer». Verglichen wird deshalb über
 * `personKeys`: «Römer, Aaron» trifft «Roemer, Aaron». Ohne das legte der
 * Import die Person neu an und entfernte die alte – samt Ansprachen,
 * Verknüpfungen und Notizen.
 */

export interface ImportMemberIndex {
  byName: Map<string, Member[]>
  byNameAndBirth: Map<string, Member[]>
}

/** Das Geburtsdatum als Tag («1991-01-22») – nach Ortszeit, wie es eingetragen wurde. */
function dayKey(value: Parameters<typeof toDate>[0]): string {
  const date = toDate(value)
  if (!date) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function add(map: Map<string, Member[]>, key: string, member: Member) {
  const list = map.get(key)
  if (!list) map.set(key, [member])
  else if (!list.includes(member)) list.push(member)
}

/** Die erfassten Mitglieder, nachschlagbar nach jeder Schreibweise ihres Namens. */
export function indexMembersForImport(members: readonly Member[]): ImportMemberIndex {
  const index: ImportMemberIndex = { byName: new Map(), byNameAndBirth: new Map() }
  for (const member of members) {
    const birth = dayKey(member.birthDate)
    for (const key of personKeys(member.lastName ?? '', member.firstName ?? '')) {
      add(index.byName, key, member)
      if (birth) add(index.byNameAndBirth, `${key}|${birth}`, member)
    }
  }
  return index
}

/** Alle Mitglieder, die unter einer der Schreibweisen stehen – jedes einmal. */
function collect(map: Map<string, Member[]>, keys: string[]): Member[] {
  const found: Member[] = []
  for (const key of keys) {
    for (const member of map.get(key) ?? []) if (!found.includes(member)) found.push(member)
  }
  return found
}

export type ImportMatch =
  | { member: Member; reason: 'name+birth' | 'name' }
  /** Niemand – oder mehrere, und dann wird nicht geraten. */
  | { member: null; candidates: number }

/**
 * Wer ist diese Person aus der Liste?
 *
 * Zuerst Name **und** Geburtsdatum – fast sicher. Passt das genau einmal,
 * ist es die Person. Sonst der Name allein, aber nur, wenn er eindeutig ist;
 * stehen zwei unter demselben Namen, bleibt die Zeile offen statt geraten.
 */
export function matchImportPerson(
  index: ImportMemberIndex,
  lastName: string,
  firstName: string,
  birthDate: Date | null,
): ImportMatch {
  const keys = personKeys(lastName, firstName)
  const birth = dayKey(birthDate)
  if (birth) {
    const exact = collect(
      index.byNameAndBirth,
      keys.map((key) => `${key}|${birth}`),
    )
    if (exact.length === 1) return { member: exact[0], reason: 'name+birth' }
  }
  const candidates = collect(index.byName, keys)
  if (candidates.length === 1) return { member: candidates[0], reason: 'name' }
  return { member: null, candidates: candidates.length }
}

/** «Roemer, Aaron Erich» – so, wie der Name in der Vorschau steht. */
export function memberDisplayName(member: Pick<Member, 'lastName' | 'firstName'>): string {
  return [member.lastName, member.firstName].filter(Boolean).join(', ')
}
