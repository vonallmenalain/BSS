import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  collectionSnapshot,
  subscribeToCollection,
  IDLE_STATE,
  type StoreState,
} from '@/lib/collectionStore'
import { toDate } from '@/lib/dates'
import {
  isWithdrawnTalk,
  OPEN_STATUSES,
  toItemKind,
  toItemStatus,
  toTalkStatus,
  type AgendaItem,
  type AnnouncementSeries,
  type ApActivity,
  type ApMonth,
  type Calling,
  type CleaningWeek,
  type Meeting,
  type Note,
  type Prayer,
  type SacramentMeeting,
  type Talk,
} from '@/lib/types'

/**
 * Zugriff auf eine Sammlung.
 *
 * Gelesen wird aus `lib/collectionStore`: Jede Sammlung wird genau einmal
 * abonniert und danach nur noch nachgeführt. Die Hooks hier filtern und
 * sortieren im Client – was früher eine eigene Firestore-Abfrage je Ansicht
 * war (und je Ansichtswechsel neue Lesevorgänge kostete), ist jetzt ein
 * `filter()` über bereits vorhandene Daten.
 */
function useCollection<T>(name: string, enabled = true): StoreState<T> {
  const subscribe = useCallback(
    (listener: () => void) => (enabled ? subscribeToCollection(name, listener) : () => {}),
    [name, enabled],
  )
  const snapshot = useCallback(
    () => (enabled ? collectionSnapshot<T>(name) : (IDLE_STATE as StoreState<T>)),
    [name, enabled],
  )
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** Nach einem Zeitfeld sortieren – Datensätze ohne Datum ans Ende. */
function byDate<T>(items: T[], field: keyof T, dir: 'asc' | 'desc' = 'desc'): T[] {
  return [...items].sort((a, b) => {
    const at = toDate(a[field] as never)?.getTime()
    const bt = toDate(b[field] as never)?.getTime()
    if (at === undefined) return bt === undefined ? 0 : 1
    if (bt === undefined) return -1
    return dir === 'asc' ? at - bt : bt - at
  })
}

/**
 * Die Obergrenzen der Hooks bleiben bestehen – jetzt aber im Client.
 *
 * Sie kosten nichts mehr (die Sammlung liegt ohnehin vollständig vor) und
 * halten die Listen so kurz wie bisher: Was in der Ansicht nie sichtbar wird,
 * muss auch nicht gezeichnet werden.
 */
function capped<T>(items: T[], limitCount: number): T[] {
  return items.length > limitCount ? items.slice(0, limitCount) : items
}

/* ------------------------------------------------------------------ */
/* Sitzungen                                                           */
/* ------------------------------------------------------------------ */

function useMeetingsStore() {
  const { isApproved } = useAuth()
  return useCollection<Meeting>(COLLECTIONS.meetings, isApproved)
}

export function useMeetings(limitCount = 100) {
  const state = useMeetingsStore()
  return useMemo(
    () => ({ ...state, data: capped(byDate(state.data, 'date'), limitCount) }),
    [state, limitCount],
  )
}

/** Einzelne Sitzung – aus demselben Bestand wie die Liste. */
export function useMeeting(meetingId: string | undefined) {
  const state = useMeetingsStore()
  return useMemo(
    () => ({
      meeting: meetingId ? (state.data.find((m) => m.id === meetingId) ?? null) : null,
      loading: state.loading,
    }),
    [state, meetingId],
  )
}

/* ------------------------------------------------------------------ */
/* Traktanden und Pendenzen                                            */
/* ------------------------------------------------------------------ */

/**
 * Alle Traktanden und Pendenzen.
 *
 * Status und Art werden dabei einmal zurechtgerückt: In der Datenbank stehen
 * noch Jahre an «Offen», «In Arbeit» und «Zurückgestellt», und die Art
 * («Traktandum» oder «Pendenz») fehlt an allem, was vor dieser Unterscheidung
 * erfasst wurde. Hier zu übersetzen erspart es jeder Ansicht, die Frage
 * erneut zu stellen – und dem Bestand eine Wanderung über alle Dokumente.
 */
function useAgendaStore() {
  const { isApproved } = useAuth()
  const state = useCollection<AgendaItem>(COLLECTIONS.agendaItems, isApproved)
  return useMemo(
    () => ({
      ...state,
      data: state.data.map((item) => ({
        ...item,
        status: toItemStatus(item.status),
        kind: toItemKind(item),
      })),
    }),
    [state],
  )
}

/** Alle Traktanden und Pendenzen einer bestimmten Sitzung. */
export function useMeetingItems(meetingId: string | undefined) {
  const state = useAgendaStore()
  return useMemo(
    () => ({
      ...state,
      data: meetingId
        ? state.data
            .filter((item) => item.meetingId === meetingId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : [],
    }),
    [state, meetingId],
  )
}

/**
 * Einträge ohne Sitzungszuordnung, die noch offen sind – der «Sammelkorb».
 * Genau diese werden beim Planen der nächsten Sitzung angeboten.
 */
export function useUnassignedItems() {
  const state = useAgendaStore()
  return useMemo(
    () => ({
      ...state,
      data: state.data.filter((item) => !item.meetingId && OPEN_STATUSES.includes(item.status)),
    }),
    [state],
  )
}

/** Sämtliche offenen Einträge – unabhängig von der Sitzungszuordnung. */
export function useOpenItems() {
  const state = useAgendaStore()
  return useMemo(
    () => ({
      ...state,
      data: state.data.filter((item) => OPEN_STATUSES.includes(item.status)),
    }),
    [state],
  )
}

/** Sämtliche erledigten Einträge – das Archiv unter «Pendenzen». */
export function useDoneItems(enabled = true) {
  const state = useAgendaStore()
  return useMemo(
    () => ({
      ...state,
      data: enabled ? state.data.filter((item) => item.status === 'done') : [],
    }),
    [state, enabled],
  )
}

/**
 * Alle Berufungsrunden – Traktanden und Pendenzen mit den beiden Tabellen.
 *
 * Gebraucht im Mitgliederprofil: Dort steht unter «Potentielle
 * Berufungsänderungen», in welchen Runden eine Person vorkommt. Zuletzt
 * bearbeitete zuoberst – was gestern besprochen wurde, zählt mehr als eine
 * Idee von vor zwei Jahren.
 */
export function useCallingRounds() {
  const state = useAgendaStore()
  return useMemo(
    () => ({
      ...state,
      data: byDate(
        state.data.filter((item) => Boolean(item.callingChanges)),
        'updatedAt',
      ),
    }),
    [state],
  )
}

/** Traktanden für die Archiv-/Suchansicht, zuletzt geändertes zuerst. */
export function useAllItems(limitCount = 500, enabled = true) {
  const state = useAgendaStore()
  return useMemo(
    () => ({
      ...state,
      data: enabled ? capped(byDate(state.data, 'updatedAt'), limitCount) : [],
    }),
    [state, limitCount, enabled],
  )
}

/* ------------------------------------------------------------------ */
/* Ansprachen & Berufungen                                             */
/* ------------------------------------------------------------------ */

/**
 * Ansprachen und Zeugnisse.
 *
 * Der Status wird beim Lesen zurechtgerückt: «Gehalten» aus dem übernommenen
 * Verlauf zählt als Zusage. Einträge, die als «abgesagt» oder «gestrichen»
 * erfasst wurden, fallen ganz weg – sie beschreiben eine Ansprache, die nicht
 * stattgefunden hat, und ein Platz im Programm ist damit frei. In Firestore
 * bleiben sie stehen; gelesen werden sie nicht mehr.
 */
export function useTalks(limitCount = 300) {
  const { isApproved } = useAuth()
  const state = useCollection<Talk>(COLLECTIONS.talks, isApproved)
  return useMemo(
    () => ({
      ...state,
      data: capped(
        byDate(
          state.data
            .filter((talk) => !isWithdrawnTalk(talk.status))
            .map((talk) => ({ ...talk, status: toTalkStatus(talk.status) })),
          'date',
        ),
        limitCount,
      ),
    }),
    [state, limitCount],
  )
}

function useCallingsStore() {
  const { isApproved } = useAuth()
  return useCollection<Calling>(COLLECTIONS.callings, isApproved)
}

export function useCallings(limitCount = 300) {
  const state = useCallingsStore()
  return useMemo(
    () => ({ ...state, data: capped(byDate(state.data, 'updatedAt'), limitCount) }),
    [state, limitCount],
  )
}

/**
 * Sämtliche Berufungen einer Person – ohne Obergrenze.
 *
 * Auf eine Person gerechnet bleibt es eine kurze Liste, und weil der ganze
 * Bestand ohnehin vorliegt, ist es ein Filter statt einer eigenen Abfrage.
 */
export function useMemberCallings(memberId: string | undefined) {
  const state = useCallingsStore()
  return useMemo(
    () => ({
      ...state,
      data: memberId ? state.data.filter((calling) => calling.memberId === memberId) : [],
    }),
    [state, memberId],
  )
}

/* ------------------------------------------------------------------ */
/* Abendmahlsversammlung                                               */
/* ------------------------------------------------------------------ */

function useSacramentStore() {
  const { isApproved } = useAuth()
  return useCollection<SacramentMeeting>(COLLECTIONS.sacramentMeetings, isApproved)
}

/**
 * Programm eines einzelnen Sonntags.
 *
 * `dateKey` ist das Datum als «yyyy-MM-dd» und zugleich die Dokument-ID.
 * Existiert noch kein Dokument, liefert der Hook `null` – die Seiten zeigen
 * dann den leeren Zustand und legen beim ersten Speichern an.
 */
export function useSacramentMeeting(dateKey: string | undefined) {
  const state = useSacramentStore()
  return useMemo(
    () => ({
      meeting: dateKey ? (state.data.find((m) => m.id === dateKey) ?? null) : null,
      loading: state.loading,
    }),
    [state, dateKey],
  )
}

/** Die zuletzt bearbeiteten Programme – für Übersichten über mehrere Sonntage. */
export function useSacramentMeetings(limitCount = 30) {
  const state = useSacramentStore()
  return useMemo(
    () => ({ ...state, data: capped(byDate(state.data, 'date'), limitCount) }),
    [state, limitCount],
  )
}

/**
 * Gehaltene und geplante Gebete.
 *
 * Die Voreinstellung deckt mehrere Jahre ab (zwei Gebete pro Sonntag) und
 * reicht damit für die Frage «wann hat diese Person zuletzt gebetet?».
 */
export function usePrayers(limitCount = 400) {
  const { isApproved } = useAuth()
  const state = useCollection<Prayer>(COLLECTIONS.prayers, isApproved)
  return useMemo(
    () => ({ ...state, data: capped(byDate(state.data, 'date'), limitCount) }),
    [state, limitCount],
  )
}

/** Wiederkehrende Bekanntmachungen – wenige, dafür jede für viele Sonntage. */
export function useAnnouncementSeries() {
  const { isApproved } = useAuth()
  const state = useCollection<AnnouncementSeries>(COLLECTIONS.announcementSeries, isApproved)
  return useMemo(() => ({ ...state, data: byDate(state.data, 'createdAt', 'asc') }), [state])
}

/**
 * Der Putzplan – sortiert nach dem ersten Tag der Woche, der zugleich die
 * Dokument-ID ist.
 */
export function useCleaningWeeks(limitCount = 400) {
  const { isApproved } = useAuth()
  const state = useCollection<CleaningWeek>(COLLECTIONS.cleaningWeeks, isApproved)
  return useMemo(
    () => ({
      ...state,
      data: capped(
        [...state.data].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))),
        limitCount,
      ),
    }),
    [state, limitCount],
  )
}

/* ------------------------------------------------------------------ */
/* Aktivitäten AP                                                      */
/* ------------------------------------------------------------------ */

/**
 * Der Aktivitätenplan der Priestertumskollegien.
 *
 * Freigegeben ist er auch für Konten, die sonst nichts sehen – deshalb hängt
 * er an `canViewAp` und nicht an `isApproved`.
 */
export function useApActivities(limitCount = 600) {
  const { canViewAp } = useAuth()
  const state = useCollection<ApActivity>(COLLECTIONS.apActivities, canViewAp)
  return useMemo(
    () => ({ ...state, data: capped(byDate(state.data, 'date', 'asc'), limitCount) }),
    [state, limitCount],
  )
}

/** Welches Kollegium welchen Monat führt. */
export function useApMonths() {
  const { canViewAp } = useAuth()
  const state = useCollection<ApMonth>(COLLECTIONS.apMonths, canViewAp)
  return useMemo(
    () => ({
      ...state,
      data: [...state.data].sort((a, b) => String(a.month).localeCompare(String(b.month))),
    }),
    [state],
  )
}

/* ------------------------------------------------------------------ */
/* Notizen                                                             */
/* ------------------------------------------------------------------ */

/** Notizen, zuletzt bearbeitete zuoberst. */
export function useNotes(limitCount = 300) {
  const { isApproved } = useAuth()
  const state = useCollection<Note>(COLLECTIONS.notes, isApproved)
  return useMemo(
    () => ({ ...state, data: capped(byDate(state.data, 'updatedAt'), limitCount) }),
    [state, limitCount],
  )
}
