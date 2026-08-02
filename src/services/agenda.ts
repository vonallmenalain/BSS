import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { addMonths, startOfDay, toDate } from '@/lib/dates'
import { stripUndefined, uid } from '@/lib/utils'
import type {
  AgendaItem,
  HistoryEntry,
  ItemCategory,
  ItemNote,
  ItemStatus,
  Priority,
} from '@/lib/types'
import { ITEM_STATUS_LABELS } from '@/lib/types'

const itemsRef = collection(db, COLLECTIONS.agendaItems)

export interface Actor {
  id: string
  name: string
}

export interface AgendaItemInput {
  title: string
  description?: string
  meetingId?: string | null
  status?: ItemStatus
  priority?: Priority
  category?: ItemCategory
  assignees?: string[]
  memberRefs?: string[]
  dueDate?: Date | null
  confidential?: boolean
  order?: number
}

function historyEntry(action: string, actor: Actor): HistoryEntry {
  return {
    id: uid(),
    action,
    authorId: actor.id,
    authorName: actor.name,
    createdAt: new Date().toISOString(),
  }
}

export async function createAgendaItem(input: AgendaItemInput, actor: Actor): Promise<string> {
  const docRef = await addDoc(itemsRef, {
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    meetingId: input.meetingId ?? null,
    firstMeetingId: input.meetingId ?? null,
    order: input.order ?? Date.now(),
    status: input.status ?? 'open',
    priority: input.priority ?? 'normal',
    category: input.category ?? 'general',
    assignees: input.assignees ?? [],
    memberRefs: input.memberRefs ?? [],
    dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
    confidential: input.confidential ?? false,
    deferCount: 0,
    notes: [],
    history: [historyEntry('Traktandum erstellt', actor)],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.id,
    completedAt: null,
    completedBy: null,
  })
  return docRef.id
}

export async function updateAgendaItem(
  id: string,
  patch: Partial<Omit<AgendaItem, 'id' | 'dueDate'>> & { dueDate?: Date | null },
): Promise<void> {
  const data: Record<string, unknown> = stripUndefined(patch as Record<string, unknown>)
  if ('dueDate' in patch) {
    data.dueDate = patch.dueDate ? Timestamp.fromDate(patch.dueDate) : null
  }
  await updateDoc(doc(db, COLLECTIONS.agendaItems, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

/** Status ändern und den Wechsel im Verlauf festhalten. */
export async function setItemStatus(
  id: string,
  status: ItemStatus,
  actor: Actor,
): Promise<void> {
  const isDone = status === 'done'
  await updateDoc(doc(db, COLLECTIONS.agendaItems, id), {
    status,
    completedAt: isDone ? serverTimestamp() : null,
    completedBy: isDone ? actor.id : null,
    history: arrayUnion(historyEntry(`Status: ${ITEM_STATUS_LABELS[status]}`, actor)),
    updatedAt: serverTimestamp(),
  })
}

export async function addNote(id: string, text: string, actor: Actor): Promise<void> {
  const note: ItemNote = {
    id: uid(),
    text: text.trim(),
    authorId: actor.id,
    authorName: actor.name,
    createdAt: new Date().toISOString(),
  }
  await updateDoc(doc(db, COLLECTIONS.agendaItems, id), {
    notes: arrayUnion(note),
    updatedAt: serverTimestamp(),
  })
}

export async function removeNote(id: string, noteId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.agendaItems, id)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return
  const notes = ((snapshot.data().notes as ItemNote[]) ?? []).filter((n) => n.id !== noteId)
  await updateDoc(ref, { notes, updatedAt: serverTimestamp() })
}

export type DeferTarget = 'next_meeting' | 'one_week' | 'one_month' | 'three_months' | 'custom'

export const DEFER_LABELS: Record<Exclude<DeferTarget, 'custom'>, string> = {
  next_meeting: 'Auf nächste Sitzung',
  one_week: 'Um 1 Woche',
  one_month: 'Um 1 Monat',
  three_months: 'Um 3 Monate',
}

/**
 * Verschiebt ein Traktandum. Es verlässt die aktuelle Sitzung und erhält je
 * nach Ziel ein neues Fälligkeitsdatum. `deferCount` macht sichtbar, welche
 * Themen immer wieder vertagt werden.
 */
export async function deferItem(
  id: string,
  target: DeferTarget,
  actor: Actor,
  options: { customDate?: Date | null; nextMeetingId?: string | null; nextMeetingDate?: Date | null } = {},
): Promise<void> {
  const ref = doc(db, COLLECTIONS.agendaItems, id)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return

  const current = snapshot.data() as AgendaItem
  const today = startOfDay(new Date())

  let newDueDate: Date | null = null
  let meetingId: string | null = null
  let label: string

  switch (target) {
    case 'next_meeting':
      meetingId = options.nextMeetingId ?? null
      newDueDate = options.nextMeetingDate ?? null
      label = 'Auf die nächste Sitzung verschoben'
      break
    case 'one_week':
      newDueDate = new Date(today.getTime() + 7 * 86400000)
      label = 'Um eine Woche verschoben'
      break
    case 'one_month':
      newDueDate = addMonths(today, 1)
      label = 'Um einen Monat verschoben'
      break
    case 'three_months':
      newDueDate = addMonths(today, 3)
      label = 'Um drei Monate verschoben'
      break
    case 'custom':
      newDueDate = options.customDate ?? null
      label = 'Termin angepasst'
      break
  }

  await updateDoc(ref, {
    status: 'deferred' satisfies ItemStatus,
    meetingId,
    dueDate: newDueDate ? Timestamp.fromDate(newDueDate) : null,
    deferCount: (current.deferCount ?? 0) + 1,
    history: arrayUnion(historyEntry(label, actor)),
    updatedAt: serverTimestamp(),
  })
}

/** Traktandum einer Sitzung zuordnen (oder mit `null` in den Pool zurücklegen). */
export async function assignToMeeting(
  id: string,
  meetingId: string | null,
  actor: Actor,
  order?: number,
): Promise<void> {
  const patch: Record<string, unknown> = {
    meetingId,
    updatedAt: serverTimestamp(),
    history: arrayUnion(
      historyEntry(meetingId ? 'Einer Sitzung zugeordnet' : 'Aus der Sitzung entfernt', actor),
    ),
  }
  if (order !== undefined) patch.order = order
  // Ein zurückgestelltes Traktandum wird durch die Neuplanung wieder offen.
  const snapshot = await getDoc(doc(db, COLLECTIONS.agendaItems, id))
  if (meetingId && snapshot.exists() && snapshot.data().status === 'deferred') {
    patch.status = 'open'
  }
  await updateDoc(doc(db, COLLECTIONS.agendaItems, id), patch)
}

/** Neue Reihenfolge einer Traktandenliste in einem Rutsch speichern. */
export async function reorderItems(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, COLLECTIONS.agendaItems, id), { order: (index + 1) * 100 })
  })
  await batch.commit()
}

/**
 * Übernimmt alle offenen Traktanden ohne Sitzung in die angegebene Sitzung.
 * Das ist der Schritt «Pendenzen aus der letzten Sitzung mitnehmen».
 */
export async function carryOverOpenItems(meetingId: string, actor: Actor): Promise<number> {
  const snapshot = await getDocs(
    query(
      itemsRef,
      where('meetingId', '==', null),
      where('status', 'in', ['open', 'in_progress', 'deferred']),
    ),
  )
  if (snapshot.empty) return 0

  const batch = writeBatch(db)
  snapshot.docs.forEach((item, index) => {
    const data = item.data() as AgendaItem
    batch.update(item.ref, {
      meetingId,
      status: data.status === 'deferred' ? 'open' : data.status,
      order: (index + 1) * 100,
      history: arrayUnion(historyEntry('In die Sitzung übernommen', actor)),
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
  return snapshot.size
}

export async function deleteAgendaItem(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.agendaItems, id))
}

/** Sortierung für die Sitzungsansicht: erledigte ans Ende, sonst nach `order`. */
export function sortForMeeting(items: AgendaItem[]): AgendaItem[] {
  const rank = (item: AgendaItem) =>
    item.status === 'done' || item.status === 'cancelled' ? 1 : 0
  return [...items].sort((a, b) => rank(a) - rank(b) || (a.order ?? 0) - (b.order ?? 0))
}

/** Sortierung für die Pendenzenliste: überfällig zuerst, dann nach Priorität. */
export function sortForPendenzen(items: AgendaItem[]): AgendaItem[] {
  const priorityRank: Record<Priority, number> = { high: 0, normal: 1, low: 2 }
  return [...items].sort((a, b) => {
    const dateA = toDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY
    const dateB = toDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY
    if (dateA !== dateB) return dateA - dateB
    return priorityRank[a.priority] - priorityRank[b.priority]
  })
}
