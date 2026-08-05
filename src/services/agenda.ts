import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { stripUndefined, uid } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import type { AgendaItem, HistoryEntry, ItemKind, ItemLayout, ItemStatus } from '@/lib/types'
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
  assignees?: string[]
  memberRefs?: string[]
  order?: number
  /** Selbst gebautes Raster statt der Beschreibung – siehe `lib/layout` */
  layout?: ItemLayout | null
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
      assignees: input.assignees ?? [],
      memberRefs: input.memberRefs ?? [],
      layout: input.layout ?? null,
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
  patch: Partial<Omit<AgendaItem, 'id'>>,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.agendaItems, id), {
      ...stripUndefined(patch as Record<string, unknown>),
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

/**
 * Verschiebt einen Punkt auf die nächste Sitzung.
 *
 * Mehr Ziele gibt es nicht mehr. Früher liess sich um eine Woche, einen
 * Monat oder auf ein freies Datum verschieben – das setzte einen Termin,
 * der mit keiner Sitzung zusammenfiel und an dem folglich nichts geschah.
 * Ein Punkt gehört in eine Sitzung, und die nächste ist die Antwort auf
 * «nicht heute».
 *
 * Ist keine Sitzung geplant, landet er im Sammelkorb und steht so lange
 * unter «Pendenzen», bis eine Sitzung ihn aufnimmt. `deferCount` macht
 * sichtbar, welche Themen immer wieder vertagt werden.
 */
export async function deferToNextMeeting(
  id: string,
  meetingId: string | null,
  actor: Actor,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.agendaItems, id), {
      // Wer verschoben wird, ist nicht erledigt – und damit von jetzt an eine
      // Pendenz, auch wenn er in dieser Sitzung neu aufgetaucht ist.
      kind: 'pendenz' satisfies ItemKind,
      status: 'pending' satisfies ItemStatus,
      meetingId,
      deferCount: increment(1),
      history: arrayUnion(
        historyEntry(
          meetingId ? 'Auf die nächste Sitzung verschoben' : 'Aus der Sitzung genommen',
          actor,
        ),
      ),
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

/**
 * Sortierung für die Pendenzenliste: das am längsten Liegengebliebene zuerst.
 *
 * Ohne Fälligkeitsdatum und ohne Priorität bleibt die ehrlichste Auskunft,
 * die der Datensatz hergibt – wie oft ein Punkt schon verschoben wurde und,
 * bei gleichem Stand, seine Reihenfolge in der Sitzung.
 */
export function sortForPendenzen(items: AgendaItem[]): AgendaItem[] {
  return [...items].sort(
    (a, b) => (b.deferCount ?? 0) - (a.deferCount ?? 0) || (a.order ?? 0) - (b.order ?? 0),
  )
}
