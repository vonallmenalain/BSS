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
import { impulseKindRank } from '@/lib/impulse'
import { isDutyItem, monthLeaders } from '@/lib/monthlyDuties'
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
  type CalendarFeed,
  type Calling,
  type CleaningWeek,
  type ImpulseAnswer,
  type ImpulseComment,
  type ImpulseItem,
  type ImpulseProgress,
  type ImpulseSubmission,
  type Meeting,
  type MonthlyDuty,
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
 *
 * Ohne die Monatspendenzen: Die haben ebenfalls keine Sitzung, warten aber
 * auf keine. Sie gehören dem Monat und der Person, die ihn führt – in eine
 * Traktandenliste übernommen wären sie an genau dem Ort, an dem sie nie
 * stehen sollten (siehe `lib/monthlyDuties`).
 */
export function useUnassignedItems() {
  const state = useAgendaStore()
  return useMemo(
    () => ({
      ...state,
      data: state.data.filter(
        (item) => !item.meetingId && !isDutyItem(item) && OPEN_STATUSES.includes(item.status),
      ),
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

/**
 * Alles, was aus einer Monatspendenz entstanden ist – in jedem Zustand.
 *
 * Auch das Erledigte: Gefragt wird «steht für diesen Monat schon etwas da?»,
 * und ein abgehakter Eintrag steht da (siehe `hooks/useMonthlyDuties`).
 */
export function useDutyItems() {
  const state = useAgendaStore()
  return useMemo(() => ({ ...state, data: state.data.filter(isDutyItem) }), [state])
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
  // Auch für die Assistenz «Ansprachen»: Sie arbeitet genau an dieser Liste.
  const { isApproved, assistantAreas } = useAuth()
  const state = useCollection<Talk>(
    COLLECTIONS.talks,
    isApproved || assistantAreas.includes('talks'),
  )
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

/*
 * Die Sonntage – für den Vollzugriff und für jede Assistenz.
 *
 * Alle drei Bereiche brauchen sie: Die Lieder und die Musikeinlagen stehen
 * im Sonntagsdokument, die Ansprachenplanung liest daraus, was an diesem
 * Sonntag stattfindet und wie viele Plätze es gibt, und das Gebet braucht
 * dieselbe Auskunft.
 */
function useSacramentStore() {
  const { isApproved, isAssistant } = useAuth()
  return useCollection<SacramentMeeting>(COLLECTIONS.sacramentMeetings, isApproved || isAssistant)
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
 * Wer welchen Monat führt – als Karte «2026-08» → UID.
 *
 * Gerechnet und nicht gespeichert: Die Angabe steht bereits an den Sonntagen
 * («Abendmahl → Leitung → Zuständig», Haken «Für den ganzen Monat»). Eine
 * zweite Liste daneben liefe irgendwann auseinander, und dann gäbe es zwei
 * Antworten auf die Frage, wer den August hat.
 *
 * Der ganze Bestand, nicht die letzten dreissig: Die Monatspendenzen fragen
 * nach dem laufenden Monat, und der ist im Sommer nicht unter den zuletzt
 * bearbeiteten Sonntagen, wenn jemand gerade den Herbst plant.
 */
export function useMonthLeaders() {
  const state = useSacramentStore()
  return useMemo(() => ({ ...state, leaders: monthLeaders(state.data) }), [state])
}

/**
 * Die Aufgaben, die zur Leitung eines Monats gehören – die Vorlagen.
 *
 * Die laufenden zuerst, danach die beendeten; innerhalb der beiden Gruppen
 * die zuletzt begonnene zuoberst. So steht in der Liste vorn, was noch jeden
 * Monat anfällt.
 */
export function useMonthlyDuties() {
  const { isApproved } = useAuth()
  const state = useCollection<MonthlyDuty>(COLLECTIONS.monthlyDuties, isApproved)
  return useMemo(
    () => ({
      ...state,
      data: [...state.data].sort(
        (a, b) =>
          Number(Boolean(a.endMonth)) - Number(Boolean(b.endMonth)) ||
          String(b.startMonth).localeCompare(String(a.startMonth)),
      ),
    }),
    [state],
  )
}

/**
 * Gehaltene und geplante Gebete.
 *
 * Die Voreinstellung deckt mehrere Jahre ab (zwei Gebete pro Sonntag) und
 * reicht damit für die Frage «wann hat diese Person zuletzt gebetet?».
 */
export function usePrayers(limitCount = 400) {
  /*
   * Auch für die Assistenz «Gebet» – und für die Assistenz «Ansprachen»:
   * Unter «Mitglieder» steht das letzte Gebet neben der letzten Ansprache,
   * und die Vorschlagslisten der beiden Bereiche lesen dieselbe Frage
   * («wer war lange nicht dran?»).
   */
  const { isApproved, assistantAreas } = useAuth()
  const state = useCollection<Prayer>(
    COLLECTIONS.prayers,
    isApproved || assistantAreas.includes('prayers'),
  )
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

/**
 * Die Links, unter denen der Plan als Kalender abonniert werden kann.
 *
 * Hängt an `canViewAp` wie der Plan selbst: Wer ihn sieht, darf ihn sich
 * auch in den eigenen Kalender holen und braucht dafür den Link. Anlegen und
 * widerrufen bleibt dem Schreibrecht vorbehalten – das entscheidet nicht
 * dieser Hook, sondern `firestore.rules`.
 *
 * Zuletzt angelegte zuoberst – der eben erzeugte Link ist der, den man sucht.
 */
export function useCalendarFeeds() {
  const { canViewAp } = useAuth()
  const state = useCollection<CalendarFeed>(COLLECTIONS.calendarFeeds, canViewAp)
  return useMemo(() => ({ ...state, data: byDate(state.data, 'createdAt') }), [state])
}

/* ------------------------------------------------------------------ */
/* Anti Doom                                                           */
/* ------------------------------------------------------------------ */

/**
 * Die Inhalte des Bereichs «Anti Doom».
 *
 * Freigegeben pro Konto – deshalb hängt die Sammlung an `canViewImpulse`
 * und nicht an einer Rolle. Entwürfe und der Fragenpool liegen mit im
 * Bestand (die Zugriffsregeln erklären die Abwägung); was die AP's zu
 * sehen bekommen, entscheidet die Ansicht über `visibleImpulseItems`.
 *
 * Sortiert nach Woche, die jüngste zuerst, der Fragenpool (ohne Woche)
 * am Ende – und innerhalb der Woche das Wochenthema vor der Quizfrage.
 */
export function useImpulseItems() {
  const { canViewImpulse } = useAuth()
  const state = useCollection<ImpulseItem>(COLLECTIONS.impulseItems, canViewImpulse)
  return useMemo(
    () => ({
      ...state,
      data: [...state.data].sort(
        (a, b) =>
          String(b.week ?? '').localeCompare(String(a.week ?? '')) ||
          impulseKindRank(a.kind) - impulseKindRank(b.kind),
      ),
    }),
    [state],
  )
}

/**
 * Alle Antworten auf Quizfragen.
 *
 * Der ganze Bestand, nicht nur die eigenen: Die Auflösung vergangener
 * Wochen und später das Gruppenbild lesen daraus. Bei einem Kollegium
 * bleibt das eine kurze Liste.
 */
export function useImpulseAnswers() {
  const { canViewImpulse } = useAuth()
  const state = useCollection<ImpulseAnswer>(COLLECTIONS.impulseAnswers, canViewImpulse)
  return useMemo(
    () => ({ ...state, byId: new Map(state.data.map((answer) => [answer.id, answer])) }),
    [state],
  )
}

/**
 * Der persönliche Fortschritt aller im Bereich – Wochenziel und
 * Tages-Challenge. Der ganze Bestand, nicht nur der eigene: Serie und
 * Abzeichen brauchen bloss das eigene Dokument, die Gruppenleiste aber
 * alle. Bei einem Kollegium bleibt das eine Handvoll Dokumente.
 */
export function useImpulseProgress() {
  const { canViewImpulse } = useAuth()
  const state = useCollection<ImpulseProgress>(COLLECTIONS.impulseProgress, canViewImpulse)
  return useMemo(
    () => ({ ...state, byUid: new Map(state.data.map((progress) => [progress.uid, progress])) }),
    [state],
  )
}

/** Beiträge zur Frage der Woche – die ältesten zuerst, wie ein Gespräch. */
export function useImpulseComments() {
  const { canViewImpulse } = useAuth()
  const state = useCollection<ImpulseComment>(COLLECTIONS.impulseComments, canViewImpulse)
  return useMemo(() => ({ ...state, data: byDate(state.data, 'createdAt', 'asc') }), [state])
}

/**
 * Einreichungen aus der Mitmach-Ecke – die ältesten zuerst, damit die
 * Redaktion in der Reihenfolge des Eintreffens prüft.
 */
export function useImpulseSubmissions() {
  const { canViewImpulse } = useAuth()
  const state = useCollection<ImpulseSubmission>(COLLECTIONS.impulseSubmissions, canViewImpulse)
  return useMemo(() => ({ ...state, data: byDate(state.data, 'createdAt', 'asc') }), [state])
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
