// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import type { CleaningGroup, CleaningGroupEntry, Member } from './types.ts'

/**
 * Die Putzgruppen – was sich aus ihnen ablesen lässt.
 *
 * Eine Gruppe ist eine Liste von Einträgen, ein Eintrag ein Haushalt oder
 * eine Person («Bader Roger & Sylvie»), verknüpft mit den Mitgliedern, die
 * dazugehören. Zuständig ist, wer zuoberst steht – genau wie auf der Liste der
 * Gemeinde. Darum gibt es kein eigenes Feld dafür: Wer zuständig wird, rückt
 * nach oben, und eine Gruppe ohne oder mit zwei Zuständigen kann es gar
 * nicht geben.
 *
 * Bewusst frei von Firestore und React, damit sich das mit `node --test`
 * prüfen lässt.
 */

/** Die Dokument-ID einer Gruppe – ihre Nummer. */
export function cleaningGroupId(number: number): string {
  return String(number)
}

/** «Gruppe 5» – so steht sie im Putzplan. */
export function cleaningGroupName(number: number): string {
  return `Gruppe ${number}`
}

/** Die Nummer aus «Gruppe 5» – `null`, wo keine steht. */
export function cleaningGroupNumber(group: string | null | undefined): number | null {
  const match = (group ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}

/** Der zuständige Eintrag – der oberste. */
export function responsibleEntry(
  group: Pick<CleaningGroup, 'entries'> | null | undefined,
): CleaningGroupEntry | null {
  return group?.entries[0] ?? null
}

/** Die Gruppen der Reihe nach, wie sie putzen: 1, 2, … */
export function sortedGroups<T extends Pick<CleaningGroup, 'number'>>(groups: readonly T[]): T[] {
  return [...groups].sort((a, b) => a.number - b.number)
}

/**
 * Die Bezeichnung eines Eintrags aus seinen Mitgliedern – so, wie die Liste
 * schreibt: «Bader Roger & Sylvie», bei verschiedenen Nachnamen
 * «Muster Hans & Meier Anna».
 */
export function entryLabelFromMembers(
  members: readonly Pick<Member, 'firstName' | 'lastName'>[],
): string {
  const families = new Map<string, string[]>()
  for (const member of members) {
    const lastName = member.lastName.trim()
    const given = member.firstName.trim().split(/\s+/)[0] ?? ''
    const names = families.get(lastName) ?? []
    if (given) names.push(given)
    families.set(lastName, names)
  }
  return [...families.entries()]
    .map(([lastName, given]) => [lastName, given.join(' & ')].filter(Boolean).join(' '))
    .join(' & ')
}

/** Wer schon in einer Gruppe steht. */
export function assignedMemberIds(groups: readonly Pick<CleaningGroup, 'entries'>[]): Set<string> {
  return new Set(groups.flatMap((group) => group.entries.flatMap((entry) => entry.memberIds)))
}

/** Volljährig am Stichtag – ohne Geburtsdatum zählt die Person mit. */
export function isAdult(
  member: { birthDate?: { toDate(): Date } | Date | null },
  today: Date,
  age = 18,
): boolean {
  const raw = member.birthDate
  const birth = raw instanceof Date ? raw : (raw?.toDate() ?? null)
  if (!birth || Number.isNaN(birth.getTime())) return true
  const cutoff = new Date(today.getFullYear() - age, today.getMonth(), today.getDate())
  return birth.getTime() <= cutoff.getTime()
}

/**
 * Die aktiven Mitglieder, die in keiner Gruppe stehen – sortiert nach
 * Nachname und Vorname.
 *
 * Geputzt wird von Erwachsenen; Kinder und Jugendliche gehören zum Haushalt
 * ihrer Eltern und stünden sonst alle in dieser Liste. Darum zählen
 * Minderjährige nur auf Wunsch (`withMinors`).
 */
export function unassignedMembers<
  T extends Pick<Member, 'id' | 'firstName' | 'lastName' | 'status' | 'birthDate'>,
>(
  members: readonly T[],
  groups: readonly Pick<CleaningGroup, 'entries'>[],
  today: Date,
  withMinors = false,
): T[] {
  const assigned = assignedMemberIds(groups)
  return members
    .filter((member) => member.status === 'active' && !assigned.has(member.id))
    .filter((member) => withMinors || isAdult(member, today))
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, 'de-CH') ||
        a.firstName.localeCompare(b.firstName, 'de-CH'),
    )
}

/** Wo ein Mitglied eingeteilt ist – Gruppe und Eintrag. */
export function groupOfMember<T extends Pick<CleaningGroup, 'number' | 'entries'>>(
  groups: readonly T[],
  memberId: string,
): { group: T; entry: CleaningGroupEntry } | null {
  for (const group of groups) {
    const entry = group.entries.find((item) => item.memberIds.includes(memberId))
    if (entry) return { group, entry }
  }
  return null
}
