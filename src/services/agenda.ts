import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { addMonths, startOfDay, toDate } from '@/lib/dates'
import { stripUndefined, uid } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import type { AgendaItem, HistoryEntry, ItemKind, ItemStatus, Priority } from '@/lib/types'
import { ITEM_STATUS_LABELS, OPEN_STATUS_QUERY, toItemKind } from '@/lib/types'

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
  assignees?: string[]
  memberRefs?: string[]
  dueDate?: Date | null
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
  // Die ID entsteht im Client, damit sie auch ohne Netz sofort feststeht.
  const docRef = doc(itemsRef)
  await commit(
    setDoc(docRef, {
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      meetingId: input.meetingId ?? null,
      firstMeetingId: input.meetingId ?? null,
      order: input.order ?? Date.now(),
      // Was neu erfasst wird, ist ein Traktandum. Zur Pendenz wird es erst,
      // wenn es eine Sitzung überlebt (siehe `closeMeeting`).
      kind: 'traktandum' satisfies ItemKind,
      status: input.status ?? 'new',
      priority: input.priority ?? 'normal',
      assignees: input.assignees ?? [],
      memberRefs: input.memberRefs ?? [],
      dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
      deferCount: 0,
      history: [historyEntry('Traktandum erstellt', actor)],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor.id,
      completedAt: null,
      completedBy: null,
    }),
  )
  return docRef.id
}

export async function updateAgendaItem(
  id: string,
  patch: Partial<Omit<AgendaItem, 'id' | 'dueDate'>> & { dueDate?: Date | null },
): Promise<SaveOutcome> {
  const data: Record<string, unknown> = stripUndefined(patch as Record<string, unknown>)
  if ('dueDate' in patch) {
    data.dueDate = patch.dueDate ? Timestamp.fromDate(patch.dueDate) : null
  }
  return commit(
    updateDoc(doc(db, COLLECTIONS.agendaItems, id), {
      ...data,
      updatedAt: serverTimestamp(),
    }),
  )
}

/** Status ändern und den Wechsel im Verlauf festhalten. */
export async function setItemStatus(
  id: string,
  status: ItemStatus,
  actor: Actor,
): Promise<SaveOutcome> {
  const isDone = status === 'done'
  return commit(
    updateDoc(doc(db, COLLECTIONS.agendaItems, id), {
      status,
      completedAt: isDone ? serverTimestamp() : null,
      completedBy: isDone ? actor.id : null,
      history: arrayUnion(historyEntry(`Status: ${ITEM_STATUS_LABELS[status]}`, actor)),
      updatedAt: serverTimestamp(),
    }),
  )
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
  options: {
    customDate?: Date | null
    nextMeetingId?: string | null
    nextMeetingDate?: Date | null
  } = {},
): Promise<SaveOutcome | null> {
  const ref = doc(db, COLLECTIONS.agendaItems, id)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null

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

  return commit(
    updateDoc(ref, {
      // Wer verschoben wird, ist nicht erledigt – und damit von jetzt an eine
      // Pendenz, auch wenn er in dieser Sitzung neu aufgetaucht ist.
      kind: 'pendenz' satisfies ItemKind,
      status: 'pending' satisfies ItemStatus,
      meetingId,
      dueDate: newDueDate ? Timestamp.fromDate(newDueDate) : null,
      deferCount: (current.deferCount ?? 0) + 1,
      history: arrayUnion(historyEntry(label, actor)),
      updatedAt: serverTimestamp(),
    }),
  )
}

/** Traktandum einer Sitzung zuordnen (oder mit `null` in den Pool zurücklegen). */
export async function assignToMeeting(
  id: string,
  meetingId: string | null,
  actor: Actor,
  order?: number,
): Promise<SaveOutcome> {
  const patch: Record<string, unknown> = {
    meetingId,
    updatedAt: serverTimestamp(),
    history: arrayUnion(
      historyEntry(meetingId ? 'Einer Sitzung zugeordnet' : 'Aus der Sitzung entfernt', actor),
    ),
  }
  if (order !== undefined) patch.order = order

  const snapshot = await getDoc(doc(db, COLLECTIONS.agendaItems, id))
  if (meetingId && snapshot.exists()) {
    const data = snapshot.data() as AgendaItem
    // Steht die Art noch nicht am Datensatz, wird sie hier festgehalten –
    // danach entscheidet nicht mehr die Vorgeschichte, sondern das Feld.
    patch.kind = toItemKind(data)
    // Die erste Sitzung, in der ein Eintrag stand, macht ihn später zur
    // Pendenz. Wer aus dem Sammelkorb kommt, hat sie noch nicht.
    if (!data.firstMeetingId) patch.firstMeetingId = meetingId
  }
  return commit(updateDoc(doc(db, COLLECTIONS.agendaItems, id), patch))
}

/** Neue Reihenfolge einer Traktandenliste in einem Rutsch speichern. */
export async function reorderItems(orderedIds: string[]): Promise<SaveOutcome> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, COLLECTIONS.agendaItems, id), { order: (index + 1) * 100 })
  })
  return commit(batch.commit())
}

/**
 * Übernimmt alle offenen Einträge ohne Sitzung in die angegebene Sitzung.
 * Das ist der Schritt «Pendenzen aus der letzten Sitzung mitnehmen».
 *
 * Die Art wird dabei nicht angetastet: Wer als Pendenz im Sammelkorb lag,
 * erscheint in der neuen Sitzung als Pendenz, und was noch nie traktandiert
 * war, bleibt ein Traktandum.
 */
export async function carryOverOpenItems(meetingId: string, actor: Actor): Promise<number> {
  const snapshot = await getDocs(
    query(itemsRef, where('meetingId', '==', null), where('status', 'in', OPEN_STATUS_QUERY)),
  )
  if (snapshot.empty) return 0

  const batch = writeBatch(db)
  snapshot.docs.forEach((item, index) => {
    const data = item.data() as AgendaItem
    batch.update(item.ref, {
      meetingId,
      kind: toItemKind(data),
      firstMeetingId: data.firstMeetingId ?? meetingId,
      order: (index + 1) * 100,
      history: arrayUnion(historyEntry('In die Sitzung übernommen', actor)),
      updatedAt: serverTimestamp(),
    })
  })
  await commit(batch.commit())
  return snapshot.size
}

export async function deleteAgendaItem(id: string): Promise<SaveOutcome> {
  return commit(deleteDoc(doc(db, COLLECTIONS.agendaItems, id)))
}

/**
 * Sortierung für die Sitzungsansicht: zuerst die neuen Traktanden, danach die
 * Pendenzen – innerhalb der beiden Gruppen nach `order`.
 *
 * Die Sitzung beginnt mit dem, was ansteht, und arbeitet danach ab, was
 * liegengeblieben ist. Umgekehrt wäre der erste Teil jeder Sitzung eine
 * Wiederholung der letzten.
 *
 * Erledigtes bleibt bewusst stehen, wo es steht. Früher rutschte es ans Ende;
 * seit sich die Reihenfolge von Hand festlegen lässt, wäre das ein Ärgernis:
 * Ein Haken verschöbe die halbe Liste, und der eben mühsam einsortierte Punkt
 * wäre woanders.
 */
export function sortForMeeting(items: AgendaItem[]): AgendaItem[] {
  const rank = (item: AgendaItem) => (toItemKind(item) === 'traktandum' ? 0 : 1)
  return [...items].sort((a, b) => rank(a) - rank(b) || (a.order ?? 0) - (b.order ?? 0))
}

/** Die Reihenfolge der beiden Gruppen – neue Traktanden zuerst. */
export const ITEM_KIND_ORDER: ItemKind[] = ['traktandum', 'pendenz']

/** Dieselbe Liste, aufgeteilt in neue Traktanden und Pendenzen. */
export function groupByKind(items: AgendaItem[]): Record<ItemKind, AgendaItem[]> {
  const sorted = sortForMeeting(items)
  return {
    traktandum: sorted.filter((item) => toItemKind(item) === 'traktandum'),
    pendenz: sorted.filter((item) => toItemKind(item) === 'pendenz'),
  }
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
