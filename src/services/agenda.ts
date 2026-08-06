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
import { forgetDoc } from '@/lib/collectionStore'
import { stripUndefined, uid } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import type {
  AgendaItem,
  CallingChanges,
  HistoryEntry,
  ItemKind,
  ItemLayout,
  ItemStatus,
} from '@/lib/types'
import { ITEM_KIND_LABELS, ITEM_STATUS_LABELS, OPEN_STATUS_QUERY, toItemKind } from '@/lib/types'

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
  /**
   * Traktandum oder Pendenz.
   *
   * Normalerweise entsteht ein Eintrag als **Traktandum** und wird erst zur
   * Pendenz, wenn er eine Sitzung übersteht. Wer unter «Pendenzen» etwas
   * erfasst, meint dagegen von Anfang an eine Pendenz: eine Aufgabe, die
   * jemand mitnimmt, und kein Thema, über das gesprochen wird. Beides landet
   * in derselben Sitzung, aber unter der richtigen Überschrift.
   */
  kind?: ItemKind
  /** Selbst gebautes Raster statt der Beschreibung – siehe `lib/layout` */
  layout?: ItemLayout | null
  /** Die beiden Berufungstabellen statt der Beschreibung – siehe `lib/callingChanges` */
  callingChanges?: CallingChanges | null
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
  // Was neu erfasst wird, ist normalerweise ein Traktandum. Zur Pendenz wird
  // es erst, wenn es eine Sitzung überlebt (siehe `closeMeeting`) – es sei
  // denn, es wurde ausdrücklich als solche erfasst.
  const kind: ItemKind = input.kind ?? 'traktandum'
  await commit(
    setDoc(docRef, {
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      meetingId: input.meetingId ?? null,
      firstMeetingId: input.meetingId ?? null,
      order: input.order ?? Date.now(),
      kind,
      // Eine Pendenz ist nie «neu»: Sie steht von Anfang an auf der Liste
      // dessen, was noch zu tun ist.
      status: input.status ?? (kind === 'pendenz' ? 'pending' : 'new'),
      assignees: input.assignees ?? [],
      memberRefs: input.memberRefs ?? [],
      layout: input.layout ?? null,
      callingChanges: input.callingChanges ?? null,
      deferCount: 0,
      history: [historyEntry(`${ITEM_KIND_LABELS[kind]} erstellt`, actor)],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      editedAt: serverTimestamp(),
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
      ...touch(),
    }),
  )
}

/**
 * Die beiden Zeitstempel, die jede inhaltliche Änderung setzt.
 *
 * `updatedAt` ist der **Stand des Datensatzes** – daran erkennt der Abgleich
 * beim Start, was seit dem letzten Mal neu ist (siehe `lib/collectionStore`).
 * Es muss deshalb jede Änderung mitbekommen, auch das blosse Umsortieren.
 *
 * `editedAt` ist, was jemanden interessiert: wann zuletzt am Eintrag
 * **gearbeitet** wurde. Ein Punkt, der beim Vorbereiten einer Sitzung
 * dreimal an eine andere Stelle gezogen wurde, ist deswegen nicht bearbeitet
 * worden – stünde nur `updatedAt` da, sprängen beim Sortieren nach
 * «Bearbeitungsdatum» lauter unveränderte Punkte nach oben.
 */
function touch(): Record<string, unknown> {
  return { updatedAt: serverTimestamp(), editedAt: serverTimestamp() }
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
      ...touch(),
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
      ...touch(),
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
    ...touch(),
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
    // Nur `updatedAt`: Umsortieren ist kein Bearbeiten (siehe `touch()`).
    batch.update(doc(db, COLLECTIONS.agendaItems, id), {
      order: (index + 1) * 100,
      updatedAt: serverTimestamp(),
    })
  })
  return commit(batch.commit())
}

/**
 * Wie viele Änderungen höchstens in einen Firestore-Stapel gehen.
 *
 * Die Grenze liegt bei 500; etwas Luft darunter schadet nicht. Für eine
 * Sitzung spielt das keine Rolle – die Pendenzenliste sammelt dagegen über
 * alle Sitzungen hinweg und zählt nach einem Import der alten Protokolle
 * durchaus mehrere Hundert Punkte.
 */
const BATCH_LIMIT = 400

/**
 * Hält die von Hand gelegte Reihenfolge der **Pendenzenliste** fest – die
 * Liste in der Reihenfolge, in der sie stehen soll.
 *
 * Geschrieben wird `pendenzOrder` und nicht `order`: Das eine ist der Platz in
 * der Pendenzenliste, das andere der Platz in einer einzelnen Sitzung. Beides
 * in dasselbe Feld zu schreiben hiesse, mit jedem Zug hier die Traktandenliste
 * einer Sitzung umzustellen.
 *
 * Eine Position bekommt **jeder** Eintrag der Liste, nicht nur der verschobene:
 * Vor dem ersten Umsortieren trägt keiner eine. Erst wenn alle eine haben,
 * bleibt die Reihenfolge auch dann stehen, wenn jemand einen Punkt bearbeitet.
 * Geschrieben wird trotzdem nur, was sich tatsächlich ändert.
 *
 * Nur `updatedAt`, kein `editedAt`: Umsortieren ist kein Bearbeiten (siehe
 * `touch()`). Sonst sprängen nach jedem Zug lauter unveränderte Punkte an den
 * Anfang der nach «Bearbeitungsdatum» sortierten Liste.
 */
export async function savePendenzenOrder(items: AgendaItem[]): Promise<SaveOutcome | null> {
  const changed = items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => item.pendenzOrder !== index)

  if (changed.length === 0) return null

  const batches = []
  for (let start = 0; start < changed.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    changed.slice(start, start + BATCH_LIMIT).forEach(({ item, index }) => {
      batch.update(doc(db, COLLECTIONS.agendaItems, item.id), {
        pendenzOrder: index,
        updatedAt: serverTimestamp(),
      })
    })
    batches.push(batch)
  }

  return commit(Promise.all(batches.map((batch) => batch.commit())))
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
      ...touch(),
    })
  })
  await commit(batch.commit())
  return snapshot.size
}

export async function deleteAgendaItem(id: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.agendaItems, id)))
  forgetDoc(COLLECTIONS.agendaItems, id)
  return outcome
}

/**
 * Sortierung für die Sitzungsansicht: zuerst die neuen Traktanden, danach die
 * Pendenzen – innerhalb der beiden Gruppen nach `order`.
 *
 * Mit `manualPendenzen` folgt die zweite Gruppe stattdessen der von Hand
 * gelegten Reihenfolge der Pendenzenliste (`pendenzOrder`). Es ist dieselbe
 * Liste, bloss auf eine Sitzung eingeschränkt: Wer sie unter «Pendenzen»
 * geordnet hat, will sie am Sitzungstisch nicht anders vorfinden.
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
export function sortForMeeting(items: AgendaItem[], manualPendenzen = false): AgendaItem[] {
  const rank = (item: AgendaItem) => (toItemKind(item) === 'traktandum' ? 0 : 1)
  return [...items].sort((a, b) => {
    const group = rank(a) - rank(b)
    if (group !== 0) return group
    // Die Pendenzen einer Sitzung sind ein Ausschnitt der Pendenzenliste.
    // Ist die dort von Hand gelegt, gilt sie auch hier.
    if (manualPendenzen && rank(a) === 1) {
      const place = pendenzPlace(a) - pendenzPlace(b)
      if (place !== 0) return place
    }
    return (a.order ?? 0) - (b.order ?? 0)
  })
}

/**
 * Platz in der Pendenzenliste – noch nie einsortiert heisst «zuoberst».
 *
 * Dieselbe Auskunft wie unter «Pendenzen»: Ein Punkt ohne Position ist neu
 * und stünde dort ebenfalls zuoberst, statt am Ende zu verschwinden.
 */
function pendenzPlace(item: AgendaItem): number {
  return typeof item.pendenzOrder === 'number' ? item.pendenzOrder : -1
}

/**
 * Die Pendenzenliste in der von Hand gelegten Reihenfolge.
 *
 * Bei gleichem Stand entscheidet die Position in der Sitzung – zwei Punkte
 * ohne eigenen Platz stünden sonst beliebig zueinander.
 */
export function sortByPendenzOrder(items: AgendaItem[]): AgendaItem[] {
  return [...items].sort(
    (a, b) => pendenzPlace(a) - pendenzPlace(b) || (a.order ?? 0) - (b.order ?? 0),
  )
}

/**
 * Einen Ausschnitt der Pendenzenliste neu ordnen, ohne den Rest umzustellen.
 *
 * Eine Sitzung zeigt nur ihre eigenen Pendenzen. Schriebe man deren neue
 * Folge als Plätze 0…n, stünde alles Übrige plötzlich dahinter – die halbe
 * Liste wäre verschoben, weil in einer Sitzung zwei Punkte getauscht wurden.
 * Deshalb behalten die Punkte des Ausschnitts die Plätze, die sie in der
 * ganzen Liste belegen; neu ist nur, wer an welchem steht.
 *
 * `all` steht dabei in seiner jetzigen Reihenfolge (siehe
 * `sortByPendenzOrder`); was in der Sitzung steht, aber nicht mehr offen ist,
 * bleibt aussen vor.
 */
export function reorderWithinPendenzen(all: AgendaItem[], ordered: AgendaItem[]): AgendaItem[] {
  const known = new Set(all.map((item) => item.id))
  const queue = ordered.filter((item) => known.has(item.id))
  const moving = new Set(queue.map((item) => item.id))
  return all.map((item) => (moving.has(item.id) ? (queue.shift() ?? item) : item))
}

/** Die Reihenfolge der beiden Gruppen – neue Traktanden zuerst. */
export const ITEM_KIND_ORDER: ItemKind[] = ['traktandum', 'pendenz']

/** Dieselbe Liste, aufgeteilt in neue Traktanden und Pendenzen. */
export function groupByKind(
  items: AgendaItem[],
  manualPendenzen = false,
): Record<ItemKind, AgendaItem[]> {
  const sorted = sortForMeeting(items, manualPendenzen)
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
