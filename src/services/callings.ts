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
import { formatDate, toDate } from '@/lib/dates'
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
  /** Berufung ausserhalb der eigenen Einheit (Pfahl, Seminar, Institut) */
  outOfUnit?: boolean
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
      outOfUnit: input.outOfUnit ?? false,
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

/**
 * Gehört die Berufung zur Gemeinde?
 *
 * Alles ohne Vermerk zählt dazu – so bleiben von Hand erfasste und ältere
 * Datensätze dort, wo man sie erwartet.
 */
export function isWardCalling(calling: Calling): boolean {
  return !calling.outOfUnit
}

/**
 * Berufungen eines Mitglieds, aktuelle zuerst und darunter die jüngste.
 *
 * Die Reihenfolge zählt, seit die übernommene Berufungshistorie das Feld
 * füllt: Wer seit zehn Jahren in der Gemeinde ist, bringt ein Dutzend
 * Einträge mit, und ungeordnet läse sich daraus keine Geschichte.
 */
export function callingsForMember(callings: Calling[], memberId: string): Calling[] {
  return callings
    .filter((c) => c.memberId === memberId)
    .sort((a, b) => {
      const running = Number(!isRunning(a)) - Number(!isRunning(b))
      return running !== 0 ? running : startedAt(b) - startedAt(a)
    })
}

function isRunning(calling: Calling): boolean {
  return ACTIVE_CALLING_STATUSES.includes(calling.status)
}

/** Wann die Berufung begann – für die Sortierung, notfalls ihr Ende. */
function startedAt(calling: Calling): number {
  const date = toDate(
    calling.setApartDate ?? calling.sustainedDate ?? calling.extendedDate ?? calling.releasedDate,
  )
  return date ? date.getTime() : 0
}

/**
 * Der Zeitraum einer Berufung: «seit 4. Feb. 2024», «2015 – 2017».
 *
 * Bei laufenden Berufungen zählt der Anfang, bei abgeschlossenen der
 * Abschnitt. Fehlt beides – aus der Berufungsliste kommen Einträge, deren
 * Datum niemand mehr weiss –, bleibt die Zeile leer statt falsch.
 */
export function callingPeriod(calling: Calling): string {
  const from = calling.setApartDate ?? calling.sustainedDate ?? calling.extendedDate
  if (isRunning(calling)) return from ? `seit ${formatDate(from)}` : ''
  if (from && calling.releasedDate)
    return `${formatDate(from)} – ${formatDate(calling.releasedDate)}`
  if (calling.releasedDate) return `bis ${formatDate(calling.releasedDate)}`
  return from ? `ab ${formatDate(from)}` : ''
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
