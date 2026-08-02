import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { monthsSince } from '@/lib/dates'
import { compareNames, normalize, stripUndefined } from '@/lib/utils'
import type { Gender, Member, MemberStatus } from '@/lib/types'

const membersRef = collection(db, COLLECTIONS.members)

export interface MemberInput {
  lastName: string
  firstName: string
  gender?: Gender
  birthDate?: Date | null
  email?: string
  phone?: string
  mobile?: string
  street?: string
  zip?: string
  city?: string
  status?: MemberStatus
  availableForTalks?: boolean
  notes?: string
  contactPersonId?: string | null
  lastTalkDate?: Date | null
  tags?: string[]
  externalId?: string | null
}

/** Sucht sich über Vor-/Nachname zusammen, was Suche und Sortierung brauchen. */
export function buildSearchName(firstName: string, lastName: string): string {
  return normalize(`${lastName} ${firstName}`)
}

export async function createMember(input: MemberInput): Promise<string> {
  const docRef = await addDoc(membersRef, {
    ...stripUndefined({
      email: input.email?.trim(),
      phone: input.phone?.trim(),
      mobile: input.mobile?.trim(),
      street: input.street?.trim(),
      zip: input.zip?.trim(),
      city: input.city?.trim(),
      notes: input.notes?.trim(),
      externalId: input.externalId ?? null,
    }),
    lastName: input.lastName.trim(),
    firstName: input.firstName.trim(),
    searchName: buildSearchName(input.firstName, input.lastName),
    gender: input.gender ?? 'unknown',
    birthDate: input.birthDate ? Timestamp.fromDate(input.birthDate) : null,
    status: input.status ?? 'active',
    availableForTalks: input.availableForTalks ?? true,
    contactPersonId: input.contactPersonId ?? null,
    lastTalkDate: input.lastTalkDate ? Timestamp.fromDate(input.lastTalkDate) : null,
    talkCount: 0,
    tags: input.tags ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateMember(
  id: string,
  patch: Partial<Omit<Member, 'id' | 'birthDate' | 'lastTalkDate'>> & {
    birthDate?: Date | null
    lastTalkDate?: Date | null
  },
): Promise<void> {
  const data: Record<string, unknown> = stripUndefined(patch as Record<string, unknown>)
  if ('birthDate' in patch) {
    data.birthDate = patch.birthDate ? Timestamp.fromDate(patch.birthDate) : null
  }
  if ('lastTalkDate' in patch) {
    data.lastTalkDate = patch.lastTalkDate ? Timestamp.fromDate(patch.lastTalkDate) : null
  }
  if (patch.firstName || patch.lastName) {
    // searchName konsistent halten – sonst findet die Suche den Datensatz nicht mehr.
    data.searchName = buildSearchName(patch.firstName ?? '', patch.lastName ?? '')
  }
  await updateDoc(doc(db, COLLECTIONS.members, id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteMember(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.members, id))
}

/** Setzt bei vielen Mitgliedern auf einmal denselben Status (z. B. nach Import). */
export async function bulkUpdateStatus(ids: string[], status: MemberStatus): Promise<void> {
  // Firestore erlaubt maximal 500 Schreibvorgänge pro Batch.
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    ids.slice(i, i + 400).forEach((id) => {
      batch.update(doc(db, COLLECTIONS.members, id), {
        status,
        updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }
}

/** Bestehende Mitglieder für den Abgleich beim Import laden. */
export async function loadMembersForMatching(): Promise<Member[]> {
  const snapshot = await getDocs(membersRef)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Member)
}

/* ------------------------------------------------------------------ */
/* Auswertungen                                                        */
/* ------------------------------------------------------------------ */

export type MemberSortKey =
  | 'name'
  | 'firstName'
  | 'birthDate'
  | 'age'
  | 'lastTalk'
  | 'status'
  | 'talkCount'

export interface MemberFilter {
  search?: string
  status?: MemberStatus | 'all'
  gender?: Gender | 'all'
  availableForTalks?: boolean
  tag?: string
  /** Nur Mitglieder, die seit mindestens X Monaten keine Ansprache hatten */
  minMonthsSinceTalk?: number
}

export function filterMembers(members: Member[], filter: MemberFilter): Member[] {
  return members.filter((member) => {
    if (filter.status && filter.status !== 'all' && member.status !== filter.status) return false
    if (filter.gender && filter.gender !== 'all' && member.gender !== filter.gender) return false
    if (filter.availableForTalks !== undefined && member.availableForTalks !== filter.availableForTalks) {
      return false
    }
    if (filter.tag && !(member.tags ?? []).includes(filter.tag)) return false

    if (filter.minMonthsSinceTalk !== undefined) {
      const months = monthsSince(member.lastTalkDate)
      // Wer noch nie gesprochen hat, ist immer «überfällig».
      if (months !== null && months < filter.minMonthsSinceTalk) return false
    }

    if (filter.search?.trim()) {
      const haystack = normalize(
        [member.firstName, member.lastName, member.email, member.phone, member.mobile, member.city, member.notes]
          .filter(Boolean)
          .join(' '),
      )
      const terms = normalize(filter.search).split(/\s+/)
      if (!terms.every((term) => haystack.includes(term))) return false
    }
    return true
  })
}

export function sortMembers(
  members: Member[],
  key: MemberSortKey,
  direction: 'asc' | 'desc' = 'asc',
): Member[] {
  const factor = direction === 'asc' ? 1 : -1
  const time = (value: Member['birthDate']) => {
    if (!value) return null
    return value instanceof Timestamp ? value.toMillis() : new Date(String(value)).getTime()
  }

  return [...members].sort((a, b) => {
    switch (key) {
      case 'name':
        return factor * compareNames(`${a.lastName} ${a.firstName}`, `${b.lastName} ${b.firstName}`)
      case 'firstName':
        return factor * compareNames(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`)
      case 'status':
        return factor * compareNames(a.status, b.status)
      case 'talkCount':
        return factor * ((a.talkCount ?? 0) - (b.talkCount ?? 0))
      case 'birthDate':
      case 'age': {
        const aTime = time(a.birthDate)
        const bTime = time(b.birthDate)
        // Datensätze ohne Geburtsdatum immer ans Ende, unabhängig von der Richtung.
        if (aTime === null && bTime === null) return 0
        if (aTime === null) return 1
        if (bTime === null) return -1
        return factor * (aTime - bTime)
      }
      case 'lastTalk': {
        const aTime = time(a.lastTalkDate)
        const bTime = time(b.lastTalkDate)
        // «Noch nie gesprochen» ist die dringendste Information – zuerst zeigen.
        if (aTime === null && bTime === null) return 0
        if (aTime === null) return -1 * factor
        if (bTime === null) return 1 * factor
        return factor * (aTime - bTime)
      }
      default:
        return 0
    }
  })
}

/** Alle in der Mitgliederliste vergebenen Schlagworte, alphabetisch. */
export function collectTags(members: Member[]): string[] {
  const tags = new Set<string>()
  members.forEach((member) => (member.tags ?? []).forEach((tag) => tags.add(tag)))
  return [...tags].sort(compareNames)
}

/** Findet Mitglieder anhand ihrer externen ID (für Re-Import). */
export async function findByExternalId(externalId: string): Promise<Member | null> {
  const snapshot = await getDocs(query(membersRef, where('externalId', '==', externalId)))
  const first = snapshot.docs[0]
  return first ? ({ id: first.id, ...first.data() } as Member) : null
}
