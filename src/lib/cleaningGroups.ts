// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import type { CleaningGroup, CleaningGroupEntry, Gender, Member } from './types.ts'

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

/** Ohne Akzente und Gross-/Kleinschreibung – «Céleste» trifft «celeste». */
function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Eine Person, wie sie für Bezeichnung und Haushalt gebraucht wird. */
type Person = Pick<Member, 'firstName' | 'lastName'> & { gender?: Gender }

/** Die Frauen zuerst – sonst bleibt die Reihenfolge, wie sie ist. */
function womenFirst<T extends { gender?: Gender }>(members: readonly T[]): T[] {
  return [...members].sort((a, b) => Number(a.gender !== 'f') - Number(b.gender !== 'f'))
}

/**
 * Die Bezeichnung eines Eintrags aus seinen Mitgliedern – bei einem
 * Ehepaar die Frau zuerst: «Bader Sylvie & Roger», bei verschiedenen
 * Nachnamen «Meier Anna & Muster Hans».
 */
export function entryLabelFromMembers(members: readonly Person[]): string {
  const families = new Map<string, string[]>()
  for (const member of womenFirst(members)) {
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

/**
 * Bei einem Ehepaar die Frau zuerst – auch in einer Bezeichnung, die schon
 * dasteht: «Bader Roger & Sylvie» wird «Bader Sylvie & Roger», «Muster
 * Hans & Meier Anna» wird «Meier Anna & Muster Hans».
 *
 * Getauscht wird nur, was sich den verknüpften Mitgliedern eindeutig
 * zuordnen lässt: genau zwei Namen, der hintere gehört einer Frau, der
 * vordere nicht. Erkannt wird ein Vorname am ersten Vornamen des Mitglieds
 * oder an seinem Anfang («Bea» für «Beatrice»). Alles andere – drei Namen,
 * keine verknüpften Mitglieder, ein unbekanntes Geschlecht – bleibt, wie
 * es ist.
 */
export function wifeFirst(label: string, members: readonly Person[]): string {
  const parts = label.trim().split(/\s+(?:&|und)\s+/i)
  if (parts.length !== 2) return label
  const [front, back] = parts
  const frontWords = front.split(/\s+/)
  const backWords = back.split(/\s+/)

  const genderOf = (given: string): Gender | 'unknown' => {
    const wanted = plain(given)
    const firstNames = members.map((member) => ({
      member,
      first: plain(member.firstName.split(/\s+/)[0] ?? ''),
    }))
    const exact = firstNames.filter((item) => item.first === wanted)
    const matches =
      exact.length > 0
        ? exact
        : wanted.length >= 3
          ? firstNames.filter((item) => item.first.startsWith(wanted))
          : []
    return matches.length === 1 ? (matches[0].member.gender ?? 'unknown') : 'unknown'
  }

  if (backWords.length === 1) {
    // «Nachname Vorname & Vorname» – vorne muss wirklich ein Nachname
    // stehen. Bei «Muster Hans Peter & Anna» wäre «Muster Hans» keiner; ein
    // Tausch gäbe «Muster Hans Anna & Peter».
    if (frontWords.length < 2) return label
    const lastName = plain(frontWords.slice(0, -1).join(' '))
    const firstGiven = frontWords[frontWords.length - 1]
    const isLastName = members.some(
      (member) =>
        plain(member.lastName) === lastName || familyParts(member.lastName).includes(lastName),
    )
    if (!isLastName || genderOf(back) !== 'f' || genderOf(firstGiven) === 'f') return label
    return `${frontWords.slice(0, -1).join(' ')} ${back} & ${firstGiven}`
  }

  // «Nachname Vorname & Nachname Vorname»
  const frontGiven = frontWords[frontWords.length - 1]
  const backGiven = backWords[backWords.length - 1]
  if (genderOf(backGiven) !== 'f' || genderOf(frontGiven) === 'f') return label
  return `${back} & ${front}`
}

/** Eine Bezeichnung, die «Frau zuerst» umstellt. */
export interface WifeFirstChange {
  group: number
  entryId: string
  from: string
  to: string
}

/**
 * Was «Frau zuerst» an einer bestehenden Einteilung ändert – je Eintrag die
 * neue Bezeichnung, nur wo sich etwas ändert. Für Einteilungen von früher,
 * die noch mit dem Mann zuerst eingelesen wurden.
 */
export function wifeFirstChanges(
  groups: readonly Pick<CleaningGroup, 'number' | 'entries'>[],
  memberOf: (id: string) => Person | undefined,
): WifeFirstChange[] {
  return sortedGroups(groups).flatMap((group) =>
    group.entries.flatMap((entry) => {
      const linked = entry.memberIds
        .map(memberOf)
        .filter((member): member is Person => Boolean(member))
      const to = wifeFirst(entry.label, linked)
      return to === entry.label
        ? []
        : [{ group: group.number, entryId: entry.id, from: entry.label, to }]
    }),
  )
}

/**
 * Die Wochen ab heute, in denen eine umgestellte Bezeichnung als zuständig
 * steht – mit der neuen. Der Plan trägt die Namen als Kopie; ohne das stünde
 * dort bis zum nächsten Generieren die alte Reihenfolge. Vergangene Wochen
 * bleiben, wie sie waren. Eine Bezeichnung, die zwei Einträge trugen und die
 * verschieden umgestellt würde, bleibt ebenfalls.
 */
export function renamedTeams<W extends { id: string; endDate: string; team: string }>(
  weeks: readonly W[],
  changes: readonly Pick<WifeFirstChange, 'from' | 'to'>[],
  today: string,
): { id: string; team: string }[] {
  const renames = new Map<string, string | null>()
  for (const change of changes) {
    const from = change.from.trim()
    const known = renames.get(from)
    renames.set(from, known === undefined || known === change.to ? change.to : null)
  }
  return weeks.flatMap((week) => {
    const team = renames.get(week.team.trim())
    return week.endDate >= today && team ? [{ id: week.id, team }] : []
  })
}

/* ------------------------------------------------------------------ */
/* Haushalte                                                           */
/* ------------------------------------------------------------------ */

/**
 * Der Haushalt einer Person, erkannt an ihrer Postadresse: Strasse und
 * PLZ, ohne Gross-/Kleinschreibung, Akzente und Satzzeichen – «Bahnhofstr.
 * 10» und «Bahnhofstr 10» sind dieselbe. Ohne Strasse kein Haushalt; dann
 * lässt sich nichts ableiten.
 */
export function householdKey(member: Pick<Member, 'street' | 'zip'>): string | null {
  const street = plain(member.street ?? '').replace(/[^a-z0-9]/g, '')
  if (!street) return null
  return `${street}|${(member.zip ?? '').replace(/\D/g, '')}`
}

/** Was in einem Nachnamen nur Beiwerk ist und keine Familie verbindet. */
const NAME_PARTICLES = new Set('von van de den der di da du del la le zu'.split(' '))

/** Die Teile eines Nachnamens, die eine Familie verbinden – «Morales-Römer» → morales, romer. */
function familyParts(lastName: string): string[] {
  return plain(lastName)
    .split(/[\s-]+/)
    .filter((part) => part.length >= 2 && !NAME_PARTICLES.has(part))
}

/** Wer schon in einer Gruppe steht. */
export function assignedMemberIds(groups: readonly Pick<CleaningGroup, 'entries'>[]): Set<string> {
  return new Set(groups.flatMap((group) => group.entries.flatMap((entry) => entry.memberIds)))
}

type Born = { birthDate?: { toDate(): Date } | { seconds: number } | Date | null }

/**
 * Das Geburtsdatum – `null`, wo keines steht. Ohne Verbindung liefert
 * Firestore gelegentlich ein reines Objekt mit `seconds` statt eines
 * Timestamps (siehe `toDate` in `lib/dates`); auch das zählt.
 */
function birthOf(member: Born): Date | null {
  const raw = member.birthDate
  const birth =
    raw instanceof Date
      ? raw
      : raw && 'toDate' in raw
        ? raw.toDate()
        : raw && typeof raw.seconds === 'number'
          ? new Date(raw.seconds * 1000)
          : null
  return birth && !Number.isNaN(birth.getTime()) ? birth : null
}

/** Volljährig am Stichtag – ohne Geburtsdatum zählt die Person mit. */
export function isAdult(member: Born, today: Date, age = 18): boolean {
  const birth = birthOf(member)
  if (!birth) return true
  const cutoff = new Date(today.getFullYear() - age, today.getMonth(), today.getDate())
  return birth.getTime() <= cutoff.getTime()
}

/** So viel älter ist mindestens, wer als Elternteil zählt. */
const PARENT_GAP_YEARS = 16

/**
 * Wer bei Eltern wohnt, die schon eingeteilt sind – je Mitglied die Gruppe,
 * in der die Eltern stehen.
 *
 * Erkannt an drei Dingen zusammen: dieselbe Postadresse, ein gemeinsamer
 * Nachname und mindestens 16 Jahre Altersunterschied zu einem eingeteilten
 * Mitglied dort. Die Adresse allein genügte nicht – in einem
 * Mehrfamilienhaus wohnen unter derselben Hausnummer mehrere Familien. Und
 * erst der Altersunterschied macht aus «wohnt dort» ein «wohnt bei den
 * Eltern»: Ist die erwachsene Tochter eingeteilt und die Eltern nicht,
 * fehlen die Eltern weiterhin in der Liste, ebenso Geschwister und ein
 * Ehepartner, der im Eintrag vergessen ging. Ohne Geburtsdatum lässt sich
 * das nicht sagen; dann bleibt die Person sichtbar.
 */
export function homeWithAssignedParents<
  T extends Pick<Member, 'id' | 'lastName' | 'birthDate' | 'street' | 'zip'>,
>(
  members: readonly T[],
  groups: readonly Pick<CleaningGroup, 'number' | 'entries'>[],
): Map<string, number> {
  const byId = new Map(members.map((member) => [member.id, member]))
  const parents = new Map<string, { parts: string[]; born: Date; group: number }[]>()
  for (const group of groups) {
    for (const id of group.entries.flatMap((entry) => entry.memberIds)) {
      const member = byId.get(id)
      const key = member ? householdKey(member) : null
      const born = member ? birthOf(member) : null
      if (!member || !key || !born) continue
      const atAddress = parents.get(key) ?? []
      atAddress.push({ parts: familyParts(member.lastName), born, group: group.number })
      parents.set(key, atAddress)
    }
  }

  const assigned = assignedMemberIds(groups)
  const result = new Map<string, number>()
  for (const member of members) {
    const key = householdKey(member)
    const born = birthOf(member)
    if (assigned.has(member.id) || !key || !born) continue
    const parts = familyParts(member.lastName)
    const parent = parents
      .get(key)
      ?.find(
        (candidate) =>
          candidate.parts.some((part) => parts.includes(part)) &&
          new Date(
            candidate.born.getFullYear() + PARENT_GAP_YEARS,
            candidate.born.getMonth(),
            candidate.born.getDate(),
          ).getTime() <= born.getTime(),
      )
    if (parent) result.set(member.id, parent.group)
  }
  return result
}

/**
 * Die aktiven Mitglieder, die in keiner Gruppe stehen – sortiert nach
 * Nachname und Vorname.
 *
 * Geputzt wird von Erwachsenen, und ein Haushalt steht einmal in der
 * Einteilung: Es genügt, die Eltern aufzuführen. Kinder und Jugendliche
 * stünden sonst alle in dieser Liste, ebenso die erwachsenen Kinder, die
 * noch zu Hause wohnen. Darum fehlen Minderjährige und wer bei eingeteilten
 * Eltern wohnt (`homeWithAssignedParents`) – ausser auf Wunsch (`everyone`).
 */
export function unassignedMembers<
  T extends Pick<
    Member,
    'id' | 'firstName' | 'lastName' | 'status' | 'birthDate' | 'street' | 'zip'
  >,
>(
  members: readonly T[],
  groups: readonly Pick<CleaningGroup, 'number' | 'entries'>[],
  today: Date,
  everyone = false,
): T[] {
  const assigned = assignedMemberIds(groups)
  const atHome = everyone ? new Map<string, number>() : homeWithAssignedParents(members, groups)
  return members
    .filter((member) => member.status === 'active' && !assigned.has(member.id))
    .filter((member) => everyone || (isAdult(member, today) && !atHome.has(member.id)))
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

/* ------------------------------------------------------------------ */
/* Was gerade unterwegs ist                                            */
/* ------------------------------------------------------------------ */

/**
 * Die Einträge so, wie sie gespeichert werden: die Bezeichnung ohne
 * Leerraum an den Enden, jedes Mitglied höchstens einmal.
 */
export function normalizedEntries(entries: readonly CleaningGroupEntry[]): CleaningGroupEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label.trim(),
    memberIds: [...new Set(entry.memberIds)],
  }))
}

/**
 * Ein Vergleichswert für die Einträge einer Gruppe – gleich, wenn
 * gespeichert dasselbe herauskommt. Unabhängig davon, in welcher Reihenfolge
 * Firestore die Felder eines Eintrags zurückgibt.
 */
export function entriesKey(entries: readonly CleaningGroupEntry[]): string {
  return JSON.stringify(
    normalizedEntries(entries).map((entry) => [entry.id, entry.label, entry.memberIds]),
  )
}

/**
 * Die Einteilung samt dem, was geschrieben, aber noch nicht zurückgemeldet
 * ist – je Gruppe die vorgemerkten Einträge statt der gespeicherten, eine
 * eben angelegte Gruppe hinten angehängt.
 *
 * Gebraucht vom Dialog «Gruppeneinteilung»: Jeder Handgriff schreibt eine
 * ganze Gruppe. Zwei kurz hintereinander – zwei Mitglieder in dieselbe
 * Gruppe – rechneten ohne diese Vormerkung beide mit dem Stand von vorher,
 * und der zweite überschriebe den ersten.
 */
export function withPendingGroups<T extends CleaningGroup>(
  stored: readonly T[],
  pending: ReadonlyMap<number, CleaningGroupEntry[]>,
): CleaningGroup[] {
  if (pending.size === 0) return [...stored]
  const result: CleaningGroup[] = stored.map((group) => {
    const entries = pending.get(group.number)
    return entries ? { ...group, entries } : group
  })
  for (const [number, entries] of pending) {
    if (!stored.some((group) => group.number === number)) {
      result.push({ id: cleaningGroupId(number), number, entries })
    }
  }
  return result
}

/**
 * Was der Listener inzwischen so meldet, wie es geschrieben wurde, braucht
 * keine Vormerkung mehr. Unverändert, wenn nichts angekommen ist – dieselbe
 * Map, damit React nichts neu zeichnet.
 */
export function withoutConfirmed(
  pending: ReadonlyMap<number, CleaningGroupEntry[]>,
  stored: readonly Pick<CleaningGroup, 'number' | 'entries'>[],
): ReadonlyMap<number, CleaningGroupEntry[]> {
  let next: Map<number, CleaningGroupEntry[]> | null = null
  for (const [number, entries] of pending) {
    const group = stored.find((item) => item.number === number)
    if (group && entriesKey(group.entries) === entriesKey(entries)) {
      next ??= new Map(pending)
      next.delete(number)
    }
  }
  return next ?? pending
}

/**
 * Die wählbaren Gruppen – für Erinnerung und Kalender: aus der Einteilung,
 * mit der zuständigen Familie dahinter, und was der Plan sonst noch nennt,
 * falls die Einteilung (noch) fehlt.
 */
export function cleaningGroupChoices(
  groups: readonly Pick<CleaningGroup, 'number' | 'entries'>[],
  weeks: readonly { group: string }[],
): { number: number; label: string }[] {
  const options = new Map<number, string>()
  for (const group of sortedGroups(groups)) {
    const responsible = responsibleEntry(group)?.label
    options.set(
      group.number,
      responsible ? `Gruppe ${group.number} – ${responsible}` : `Gruppe ${group.number}`,
    )
  }
  for (const week of weeks) {
    const number = cleaningGroupNumber(week.group)
    if (number !== null && !options.has(number)) options.set(number, `Gruppe ${number}`)
  }
  return [...options].sort((a, b) => a[0] - b[0]).map(([number, label]) => ({ number, label }))
}
