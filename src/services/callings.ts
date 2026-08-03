import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { stripUndefined } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import {
  ACTIVE_CALLING_STATUSES,
  type Calling,
  type CallingStatus,
  type Organization,
} from '@/lib/types'

const callingsRef = collection(db, COLLECTIONS.callings)

export interface CallingInput {
  memberId: string
  memberName: string
  position: string
  organization: Organization
  status?: CallingStatus
  proposedDate?: Date | null
  extendedDate?: Date | null
  sustainedDate?: Date | null
  setApartDate?: Date | null
  releasedDate?: Date | null
  responsibleId?: string | null
  notes?: string
}

const DATE_FIELDS = [
  'proposedDate',
  'extendedDate',
  'sustainedDate',
  'setApartDate',
  'releasedDate',
] as const

export async function createCalling(
  input: CallingInput,
): Promise<{ id: string; outcome: SaveOutcome }> {
  const dates = Object.fromEntries(
    DATE_FIELDS.map((field) => [field, input[field] ? Timestamp.fromDate(input[field]!) : null]),
  )
  // Die ID entsteht im Client, damit sie auch ohne Netz sofort feststeht.
  const docRef = doc(callingsRef)
  const outcome = await commit(
    setDoc(docRef, {
      ...stripUndefined({ notes: input.notes?.trim() }),
      ...dates,
      memberId: input.memberId,
      memberName: input.memberName,
      position: input.position.trim(),
      organization: input.organization,
      status: input.status ?? 'proposed',
      responsibleId: input.responsibleId ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
  return { id: docRef.id, outcome }
}

export async function updateCalling(
  id: string,
  patch: Partial<Omit<Calling, 'id' | (typeof DATE_FIELDS)[number]>> &
    Partial<Record<(typeof DATE_FIELDS)[number], Date | null>>,
): Promise<SaveOutcome> {
  const data: Record<string, unknown> = stripUndefined(patch as Record<string, unknown>)
  for (const field of DATE_FIELDS) {
    if (field in patch) {
      const value = patch[field]
      data[field] = value ? Timestamp.fromDate(value as Date) : null
    }
  }
  return commit(
    updateDoc(doc(db, COLLECTIONS.callings, id), { ...data, updatedAt: serverTimestamp() }),
  )
}

/**
 * Schiebt eine Berufung einen Schritt weiter und trägt dabei automatisch
 * das passende Datum ein – so muss man im Sitzungsalltag nur einmal klicken.
 */
export async function advanceCalling(
  id: string,
  status: CallingStatus,
  date = new Date(),
): Promise<SaveOutcome> {
  const fieldByStatus: Partial<Record<CallingStatus, (typeof DATE_FIELDS)[number]>> = {
    proposed: 'proposedDate',
    extended: 'extendedDate',
    sustained: 'sustainedDate',
    set_apart: 'setApartDate',
    released: 'releasedDate',
  }
  const field = fieldByStatus[status]
  return commit(
    updateDoc(doc(db, COLLECTIONS.callings, id), {
      status,
      ...(field ? { [field]: Timestamp.fromDate(date) } : {}),
      updatedAt: serverTimestamp(),
    }),
  )
}

export async function deleteCalling(id: string): Promise<SaveOutcome> {
  return commit(deleteDoc(doc(db, COLLECTIONS.callings, id)))
}

/** Laufende Berufungen (alles ausser entlassen/abgelehnt). */
export function activeCallings(callings: Calling[]): Calling[] {
  return callings.filter((c) => ACTIVE_CALLING_STATUSES.includes(c.status))
}

/** Berufungen eines Mitglieds, aktuelle zuerst. */
export function callingsForMember(callings: Calling[], memberId: string): Calling[] {
  return callings
    .filter((c) => c.memberId === memberId)
    .sort((a, b) => {
      const aActive = ACTIVE_CALLING_STATUSES.includes(a.status) ? 0 : 1
      const bActive = ACTIVE_CALLING_STATUSES.includes(b.status) ? 0 : 1
      return aActive - bActive
    })
}

/** Häufige Positionen als Eingabehilfe je Organisation. */
export const COMMON_POSITIONS: Record<Organization, string[]> = {
  bishopric: [
    'Bischof',
    'Erster Ratgeber',
    'Zweiter Ratgeber',
    'Gemeindesekretär',
    'Assistierender Sekretär',
  ],
  elders_quorum: ['Kollegiumspräsident', 'Erster Ratgeber', 'Zweiter Ratgeber', 'Sekretär'],
  relief_society: ['FHV-Leiterin', 'Erste Ratgeberin', 'Zweite Ratgeberin', 'Sekretärin'],
  young_women: ['JD-Leiterin', 'Erste Ratgeberin', 'Zweite Ratgeberin', 'Klassenberaterin'],
  young_men: ['JM-Leiter', 'Erster Ratgeber', 'Zweiter Ratgeber', 'Kollegiumsberater'],
  primary: [
    'PV-Leiterin',
    'Erste Ratgeberin',
    'Zweite Ratgeberin',
    'PV-Musikleiterin',
    'PV-Lehrer',
  ],
  sunday_school: ['Sonntagsschulleiter', 'Erster Ratgeber', 'Zweiter Ratgeber', 'Lehrer'],
  music: ['Gemeindemusikleiter', 'Organist', 'Chorleiter'],
  temple_family_history: ['Tempel- und Familienforschungsleiter', 'Berater Familienforschung'],
  missionary: ['Missionsleiter der Gemeinde', 'Missionarsbetreuer'],
  welfare: [
    'Spezialist für Wohlfahrt und Eigenständigkeit',
    'Moderator einer Gesprächsgruppe für Eigenständigkeit',
    'Behindertenbeauftragter',
  ],
  ward: [
    'Gemeindemissionsleiter',
    'Beauftragter Öffentlichkeitsarbeit',
    'Haus- und Grundstücksbeauftragter',
  ],
  other: [],
}
