import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  limit as fbLimit,
  type QueryConstraint,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  DONE_STATUS_QUERY,
  isWithdrawnTalk,
  OPEN_STATUS_QUERY,
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

interface CollectionState<T> {
  data: T[]
  loading: boolean
  error: Error | null
}

/**
 * Abonniert eine Firestore-Sammlung und hält die Daten aktuell.
 * `constraints` muss stabil referenziert sein (z. B. via `useMemo`),
 * sonst wird bei jedem Render neu abonniert.
 */
function useCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  enabled = true,
): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({
    data: [],
    loading: enabled,
    error: null,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null })
      return
    }

    // Bewusst kein `loading: true` beim Wechsel der Abfrage: Firestore
    // beantwortet die neue Abfrage dank lokalem Cache meist sofort. Die alten
    // Daten kurz stehen zu lassen wirkt ruhiger als ein aufblitzender Skeleton.
    //
    // Steht dagegen noch gar nichts da – eine Abfrage, die eben erst
    // eingeschaltet wurde –, wird geladen. Sonst meldete der Hook für einen
    // Durchgang «fertig, nichts gefunden», und die Ansicht zeigte kurz ihren
    // leeren Zustand, bevor der erste Schnappschuss eintraf.
    setState((current) =>
      current.data.length === 0 && !current.loading ? { ...current, loading: true } : current,
    )

    return onSnapshot(
      query(collection(db, collectionName), ...constraints),
      (snapshot) => {
        setState({
          data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
          loading: false,
          error: null,
        })
      },
      (error) => {
        console.error(`[firestore] ${collectionName}:`, error)
        setState({ data: [], loading: false, error })
      },
    )
  }, [collectionName, constraints, enabled])

  return state
}

/* ------------------------------------------------------------------ */
/* Sitzungen                                                           */
/* ------------------------------------------------------------------ */

export function useMeetings(limitCount = 100) {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [orderBy('date', 'desc'), fbLimit(limitCount)], [limitCount])
  return useCollection<Meeting>(COLLECTIONS.meetings, constraints, isApproved)
}

/** Einzelne Sitzung live beobachten. */
export function useMeeting(meetingId: string | undefined) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(Boolean(meetingId))
  const { isApproved } = useAuth()

  useEffect(() => {
    if (!meetingId || !isApproved) {
      setMeeting(null)
      setLoading(false)
      return
    }
    return onSnapshot(
      doc(db, COLLECTIONS.meetings, meetingId),
      (snapshot) => {
        setMeeting(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Meeting) : null)
        setLoading(false)
      },
      (error) => {
        console.error('[firestore] Sitzung:', error)
        setLoading(false)
      },
    )
  }, [meetingId, isApproved])

  return { meeting, loading }
}

/* ------------------------------------------------------------------ */
/* Traktanden und Pendenzen                                            */
/* ------------------------------------------------------------------ */

/**
 * Wie eine Sammlung von Traktanden gelesen wird.
 *
 * Status und Art werden dabei einmal zurechtgerückt: In der Datenbank stehen
 * noch Jahre an «Offen», «In Arbeit» und «Zurückgestellt», und die Art
 * («Traktandum» oder «Pendenz») fehlt an allem, was vor dieser Unterscheidung
 * erfasst wurde. Hier zu übersetzen erspart es jeder Ansicht, die Frage
 * erneut zu stellen – und dem Bestand eine Wanderung über alle Dokumente.
 */
function useAgendaItems(constraints: QueryConstraint[], enabled: boolean) {
  const state = useCollection<AgendaItem>(COLLECTIONS.agendaItems, constraints, enabled)
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
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => (meetingId ? [where('meetingId', '==', meetingId), orderBy('order')] : []),
    [meetingId],
  )
  return useAgendaItems(constraints, isApproved && Boolean(meetingId))
}

/**
 * Einträge ohne Sitzungszuordnung, die noch offen sind – der «Sammelkorb».
 * Genau diese werden beim Planen der nächsten Sitzung angeboten.
 */
export function useUnassignedItems() {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => [where('meetingId', '==', null), where('status', 'in', OPEN_STATUS_QUERY)],
    [],
  )
  return useAgendaItems(constraints, isApproved)
}

/** Sämtliche offenen Einträge – unabhängig von der Sitzungszuordnung. */
export function useOpenItems() {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [where('status', 'in', OPEN_STATUS_QUERY)], [])
  return useAgendaItems(constraints, isApproved)
}

/**
 * Sämtliche erledigten Einträge – das Archiv unter «Pendenzen».
 *
 * Gelesen wird erst, wenn jemand hinsieht (`enabled`): Was offen ist, bleibt
 * eine kurze Liste, das Erledigte wächst dagegen mit jeder Sitzung weiter.
 * Sortiert und durchsucht wird im Client – damit kommt die Abfrage ohne
 * zusammengesetzten Index aus, und die Reihenfolge lässt sich umstellen, ohne
 * dass neu geladen werden muss.
 */
export function useDoneItems(enabled = true) {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [where('status', 'in', DONE_STATUS_QUERY)], [])
  return useAgendaItems(constraints, isApproved && enabled)
}

/**
 * Traktanden für die Archiv-/Suchansicht.
 *
 * `enabled` steht dort, wo sie nur in einer bestimmten Ansicht gebraucht
 * werden – etwa in der kompakten Sitzungsliste, die den Inhalt jeder Sitzung
 * mitzeigt. Solange die gewöhnliche Terminliste steht, wird nichts gelesen.
 */
export function useAllItems(limitCount = 500, enabled = true) {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => [orderBy('updatedAt', 'desc'), fbLimit(limitCount)],
    [limitCount],
  )
  return useAgendaItems(constraints, isApproved && enabled)
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
  const constraints = useMemo(() => [orderBy('date', 'desc'), fbLimit(limitCount)], [limitCount])
  const state = useCollection<Talk>(COLLECTIONS.talks, constraints, isApproved)
  return useMemo(
    () => ({
      ...state,
      data: state.data
        .filter((talk) => !isWithdrawnTalk(talk.status))
        .map((talk) => ({ ...talk, status: toTalkStatus(talk.status) })),
    }),
    [state],
  )
}

export function useCallings(limitCount = 300) {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => [orderBy('updatedAt', 'desc'), fbLimit(limitCount)],
    [limitCount],
  )
  return useCollection<Calling>(COLLECTIONS.callings, constraints, isApproved)
}

/**
 * Sämtliche Berufungen einer Person – ohne Obergrenze.
 *
 * Eine eigene Abfrage, seit die Berufungshistorie mitkommt: Die Sammlung
 * zählt dann Hunderte von Einträgen, und ein Ausschnitt der zuletzt
 * geänderten träfe ausgerechnet den Verlauf nicht, um den es hier geht.
 * Auf eine Person gerechnet bleibt es dagegen eine kurze Liste.
 */
export function useMemberCallings(memberId: string | undefined) {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => (memberId ? [where('memberId', '==', memberId)] : []),
    [memberId],
  )
  return useCollection<Calling>(COLLECTIONS.callings, constraints, isApproved && Boolean(memberId))
}

/* ------------------------------------------------------------------ */
/* Abendmahlsversammlung                                               */
/* ------------------------------------------------------------------ */

/**
 * Programm eines einzelnen Sonntags live beobachten.
 *
 * `dateKey` ist das Datum als «yyyy-MM-dd» und zugleich die Dokument-ID.
 * Existiert noch kein Dokument, liefert der Hook `null` – die Seiten zeigen
 * dann den leeren Zustand und legen beim ersten Speichern an.
 */
export function useSacramentMeeting(dateKey: string | undefined) {
  const { isApproved } = useAuth()
  const [meeting, setMeeting] = useState<SacramentMeeting | null>(null)
  const [loading, setLoading] = useState(Boolean(dateKey))

  useEffect(() => {
    if (!dateKey || !isApproved) {
      setMeeting(null)
      setLoading(false)
      return
    }
    return onSnapshot(
      doc(db, COLLECTIONS.sacramentMeetings, dateKey),
      (snapshot) => {
        setMeeting(
          snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as SacramentMeeting) : null,
        )
        setLoading(false)
      },
      (error) => {
        console.error('[firestore] Abendmahlsversammlung:', error)
        setLoading(false)
      },
    )
  }, [dateKey, isApproved])

  return { meeting, loading }
}

/** Die zuletzt bearbeiteten Programme – für Übersichten über mehrere Sonntage. */
export function useSacramentMeetings(limitCount = 30) {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [orderBy('date', 'desc'), fbLimit(limitCount)], [limitCount])
  return useCollection<SacramentMeeting>(COLLECTIONS.sacramentMeetings, constraints, isApproved)
}

/**
 * Gehaltene und geplante Gebete.
 *
 * Die Voreinstellung deckt mehrere Jahre ab (zwei Gebete pro Sonntag) und
 * reicht damit für die Frage «wann hat diese Person zuletzt gebetet?».
 */
export function usePrayers(limitCount = 400) {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [orderBy('date', 'desc'), fbLimit(limitCount)], [limitCount])
  return useCollection<Prayer>(COLLECTIONS.prayers, constraints, isApproved)
}

/**
 * Wiederkehrende Bekanntmachungen.
 *
 * Ohne Obergrenze und ohne Filter: Es sind wenige, jede einzelne kann
 * jeden Sonntag betreffen, und ob sie es tut, entscheidet sich erst beim
 * Rechnen – nach Datum liesse sich das nicht abfragen.
 */
export function useAnnouncementSeries() {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [orderBy('createdAt')], [])
  return useCollection<AnnouncementSeries>(COLLECTIONS.announcementSeries, constraints, isApproved)
}

/**
 * Der Putzplan.
 *
 * Ein halbes Jahr umfasst rund 26 Wochen; die Voreinstellung deckt damit
 * mehrere Jahre ab. Sortiert wird nach dem ersten Tag der Woche – der
 * zugleich die Dokument-ID ist.
 */
export function useCleaningWeeks(limitCount = 400) {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [orderBy('startDate'), fbLimit(limitCount)], [limitCount])
  return useCollection<CleaningWeek>(COLLECTIONS.cleaningWeeks, constraints, isApproved)
}

/* ------------------------------------------------------------------ */
/* Aktivitäten AP                                                      */
/* ------------------------------------------------------------------ */

/**
 * Der Aktivitätenplan der Priestertumskollegien.
 *
 * Ohne Filter und über den ganzen Zeitraum: Ein Jahresplan zählt gut
 * hundert Termine, und die Ansicht zeigt Vergangenes und Kommendes im
 * selben Atemzug. Die Obergrenze deckt damit mehrere Jahre ab.
 *
 * Freigegeben ist er auch für Konten, die sonst nichts sehen – deshalb
 * hängt er an `canViewAp` und nicht an `isApproved`.
 */
export function useApActivities(limitCount = 600) {
  const { canViewAp } = useAuth()
  const constraints = useMemo(() => [orderBy('date'), fbLimit(limitCount)], [limitCount])
  return useCollection<ApActivity>(COLLECTIONS.apActivities, constraints, canViewAp)
}

/** Welches Kollegium welchen Monat führt. */
export function useApMonths() {
  const { canViewAp } = useAuth()
  const constraints = useMemo(() => [orderBy('month')], [])
  return useCollection<ApMonth>(COLLECTIONS.apMonths, constraints, canViewAp)
}

/* ------------------------------------------------------------------ */
/* Notizen                                                             */
/* ------------------------------------------------------------------ */

/** Notizen, zuletzt bearbeitete zuoberst. */
export function useNotes(limitCount = 300) {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => [orderBy('updatedAt', 'desc'), fbLimit(limitCount)],
    [limitCount],
  )
  return useCollection<Note>(COLLECTIONS.notes, constraints, isApproved)
}
