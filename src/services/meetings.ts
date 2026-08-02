import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { nextWeekday } from '@/lib/dates'
import { stripUndefined } from '@/lib/utils'
import type { AppSettings, Meeting, MeetingStatus } from '@/lib/types'

const meetingsRef = collection(db, COLLECTIONS.meetings)

export interface MeetingInput {
  date: Date
  title: string
  location?: string
  attendees?: string[]
  openingPrayer?: string
  closingPrayer?: string
  spiritualThought?: string
  notes?: string
}

export async function createMeeting(input: MeetingInput, userId: string): Promise<string> {
  const docRef = await addDoc(meetingsRef, {
    ...stripUndefined({
      title: input.title,
      location: input.location ?? '',
      openingPrayer: input.openingPrayer ?? '',
      closingPrayer: input.closingPrayer ?? '',
      spiritualThought: input.spiritualThought ?? '',
      notes: input.notes ?? '',
    }),
    date: Timestamp.fromDate(input.date),
    status: 'planned' satisfies MeetingStatus,
    attendees: input.attendees ?? [],
    startedAt: null,
    closedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  })
  return docRef.id
}

export async function updateMeeting(id: string, patch: Partial<Meeting>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.meetings, id), {
    ...stripUndefined(patch as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  })
}

export async function startMeeting(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.meetings, id), {
    status: 'running' satisfies MeetingStatus,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Schliesst eine Sitzung ab. Traktanden, die weder erledigt noch verworfen
 * sind, werden aus der Sitzung gelöst und landen wieder im Pool – von dort
 * holt sie die Planung der nächsten Sitzung automatisch zurück.
 */
export async function closeMeeting(id: string): Promise<number> {
  const openItems = await getDocs(
    query(
      collection(db, COLLECTIONS.agendaItems),
      where('meetingId', '==', id),
      where('status', 'in', ['open', 'in_progress', 'deferred']),
    ),
  )

  const batch = writeBatch(db)
  openItems.docs.forEach((item) => {
    batch.update(item.ref, {
      meetingId: null,
      updatedAt: serverTimestamp(),
    })
  })
  batch.update(doc(db, COLLECTIONS.meetings, id), {
    status: 'closed' satisfies MeetingStatus,
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()

  return openItems.size
}

/** Setzt eine abgeschlossene Sitzung zurück auf «läuft». */
export async function reopenMeeting(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.meetings, id), {
    status: 'running' satisfies MeetingStatus,
    closedAt: null,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Löscht eine Sitzung und gibt ihre Traktanden frei, damit keine
 * verwaisten Verweise zurückbleiben.
 */
export async function deleteMeeting(id: string): Promise<void> {
  const items = await getDocs(
    query(collection(db, COLLECTIONS.agendaItems), where('meetingId', '==', id)),
  )
  const batch = writeBatch(db)
  items.docs.forEach((item) => batch.update(item.ref, { meetingId: null }))
  batch.delete(doc(db, COLLECTIONS.meetings, id))
  await batch.commit()
}

/** Terminvorschlag für die Folgesitzung aus den Einstellungen ableiten. */
export function suggestNextMeetingDate(settings: AppSettings, after?: Date): Date {
  return nextWeekday(settings.meetingWeekday, settings.meetingTime, after ?? new Date())
}

/** Die zeitlich nächste geplante oder laufende Sitzung. */
export async function findNextMeeting(): Promise<Meeting | null> {
  const snapshot = await getDocs(
    query(
      meetingsRef,
      where('status', 'in', ['planned', 'running']),
      orderBy('date', 'asc'),
      limit(1),
    ),
  )
  const first = snapshot.docs[0]
  return first ? ({ id: first.id, ...first.data() } as Meeting) : null
}
