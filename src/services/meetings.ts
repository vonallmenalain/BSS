import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from '@/lib/db'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { nextWeekday } from '@/lib/dates'
import { stripUndefined } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import { NEW_STATUS_QUERY, OPEN_STATUS_QUERY } from '@/lib/types'
import type { AppSettings, ItemKind, ItemStatus, Meeting, MeetingStatus } from '@/lib/types'

const meetingsRef = collection(db, COLLECTIONS.meetings)

export interface MeetingInput {
  date: Date
  title: string
  location?: string
  attendees?: string[]
  openingPrayer?: string
  closingPrayer?: string
  spiritualThought?: string
}

export async function createMeeting(
  input: MeetingInput,
  userId: string,
): Promise<{ id: string; outcome: SaveOutcome }> {
  // Die ID entsteht im Client, damit sie auch ohne Netz sofort feststeht –
  // die Ansicht kann direkt zur neuen Sitzung springen.
  const docRef = doc(meetingsRef)
  const outcome = await commit(
    setDoc(docRef, {
      ...stripUndefined({
        title: input.title,
        location: input.location ?? '',
        openingPrayer: input.openingPrayer ?? '',
        closingPrayer: input.closingPrayer ?? '',
        spiritualThought: input.spiritualThought ?? '',
      }),
      date: Timestamp.fromDate(input.date),
      status: 'planned' satisfies MeetingStatus,
      attendees: input.attendees ?? [],
      startedAt: null,
      closedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    }),
  )
  return { id: docRef.id, outcome }
}

export async function updateMeeting(id: string, patch: Partial<Meeting>): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.meetings, id), {
      ...stripUndefined(patch as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Startet die Sitzung – und macht aus allem, was bis dahin «Neu» war,
 * «Pendent».
 *
 * «Neu» beschreibt den Zustand vor der Sitzung: eingetragen, aber noch nicht
 * angeschaut. Sobald die Sitzung läuft, ist jeder Punkt schlicht offen, bis
 * ihn jemand abhakt.
 */
export async function startMeeting(id: string): Promise<SaveOutcome> {
  const fresh = await getDocs(
    query(
      collection(db, COLLECTIONS.agendaItems),
      where('meetingId', '==', id),
      where('status', 'in', NEW_STATUS_QUERY),
    ),
  )

  const batch = writeBatch(db)
  fresh.docs.forEach((item) => {
    batch.update(item.ref, {
      status: 'pending' satisfies ItemStatus,
      updatedAt: serverTimestamp(),
      editedAt: serverTimestamp(),
    })
  })
  batch.update(doc(db, COLLECTIONS.meetings, id), {
    status: 'running' satisfies MeetingStatus,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return commit(batch.commit())
}

/**
 * Schliesst eine Sitzung ab. Was nicht erledigt ist, wandert weiter auf die
 * nächste geplante Sitzung.
 *
 * Genau hier wird aus einem Traktandum eine Pendenz: Es hat eine Sitzung
 * überstanden, ohne erledigt zu werden, und erscheint in der nächsten deshalb
 * unter den Pendenzen statt unter den neuen Traktanden.
 *
 * Eine offene Pendenz gehört immer in eine Sitzung – sonst wartet sie auf
 * einen Termin, den niemand kennt. Steht noch keine nächste Sitzung fest,
 * bleibt sie im Sammelkorb und erscheint so lange unter «Pendenzen»; die
 * Planung der nächsten Sitzung holt sie von dort zurück.
 */
export async function closeMeeting(id: string): Promise<number> {
  const openItems = await getDocs(
    query(
      collection(db, COLLECTIONS.agendaItems),
      where('meetingId', '==', id),
      where('status', 'in', OPEN_STATUS_QUERY),
    ),
  )

  const followUp = openItems.empty ? null : await findNextMeetingAfter(id)

  const batch = writeBatch(db)
  openItems.docs.forEach((item) => {
    batch.update(item.ref, {
      meetingId: followUp,
      kind: 'pendenz' satisfies ItemKind,
      status: 'pending' satisfies ItemStatus,
      updatedAt: serverTimestamp(),
      editedAt: serverTimestamp(),
    })
  })
  batch.update(doc(db, COLLECTIONS.meetings, id), {
    status: 'closed' satisfies MeetingStatus,
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await commit(batch.commit())

  return openItems.size
}

/**
 * Die nächste noch offene Sitzung nach dieser.
 *
 * Abgeschlossene zählen nicht: Eine Pendenz dorthin zu schieben hiesse, sie
 * in einem bereits geschriebenen Protokoll abzulegen. Findet sich keine,
 * bleibt der Sammelkorb – mehr als zehn abgeschlossene Sitzungen in Folge
 * zu durchsuchen lohnt den Aufwand nicht.
 */
async function findNextMeetingAfter(id: string): Promise<string | null> {
  const current = await getDoc(doc(db, COLLECTIONS.meetings, id))
  const date = current.exists() ? (current.data() as Meeting).date : null
  if (!date) return null

  const later = await getDocs(
    query(meetingsRef, where('date', '>', date), orderBy('date'), limit(10)),
  )
  const next = later.docs.find((meeting) => (meeting.data() as Meeting).status !== 'closed')
  return next?.id ?? null
}

/** Setzt eine abgeschlossene Sitzung zurück auf «läuft». */
export async function reopenMeeting(id: string): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.meetings, id), {
      status: 'running' satisfies MeetingStatus,
      closedAt: null,
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Löscht eine Sitzung und gibt ihre Traktanden frei, damit keine
 * verwaisten Verweise zurückbleiben.
 */
export async function deleteMeeting(id: string): Promise<SaveOutcome> {
  const items = await getDocs(
    query(collection(db, COLLECTIONS.agendaItems), where('meetingId', '==', id)),
  )
  const batch = writeBatch(db)
  items.docs.forEach((item) =>
    batch.update(item.ref, {
      meetingId: null,
      updatedAt: serverTimestamp(),
      editedAt: serverTimestamp(),
    }),
  )
  batch.delete(doc(db, COLLECTIONS.meetings, id))
  const outcome = await commit(batch.commit())
  forgetDoc(COLLECTIONS.meetings, id)
  return outcome
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
