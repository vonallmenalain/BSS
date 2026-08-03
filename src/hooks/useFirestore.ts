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
  OPEN_STATUSES,
  type AgendaItem,
  type Calling,
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
/* Traktanden                                                          */
/* ------------------------------------------------------------------ */

/** Alle Traktanden einer bestimmten Sitzung. */
export function useMeetingItems(meetingId: string | undefined) {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => (meetingId ? [where('meetingId', '==', meetingId), orderBy('order')] : []),
    [meetingId],
  )
  return useCollection<AgendaItem>(
    COLLECTIONS.agendaItems,
    constraints,
    isApproved && Boolean(meetingId),
  )
}

/**
 * Traktanden ohne Sitzungszuordnung, die noch offen sind – der «Pool».
 * Genau diese Einträge werden beim Planen der nächsten Sitzung angeboten.
 */
export function useUnassignedItems() {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => [where('meetingId', '==', null), where('status', 'in', OPEN_STATUSES)],
    [],
  )
  return useCollection<AgendaItem>(COLLECTIONS.agendaItems, constraints, isApproved)
}

/** Sämtliche offenen Traktanden – unabhängig von der Sitzungszuordnung. */
export function useOpenItems() {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [where('status', 'in', OPEN_STATUSES)], [])
  return useCollection<AgendaItem>(COLLECTIONS.agendaItems, constraints, isApproved)
}

/** Traktanden für die Archiv-/Suchansicht. */
export function useAllItems(limitCount = 500) {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => [orderBy('updatedAt', 'desc'), fbLimit(limitCount)],
    [limitCount],
  )
  return useCollection<AgendaItem>(COLLECTIONS.agendaItems, constraints, isApproved)
}

/* ------------------------------------------------------------------ */
/* Ansprachen & Berufungen                                             */
/* ------------------------------------------------------------------ */

export function useTalks(limitCount = 300) {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [orderBy('date', 'desc'), fbLimit(limitCount)], [limitCount])
  return useCollection<Talk>(COLLECTIONS.talks, constraints, isApproved)
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
 * Berufungen in Vorbereitung – genehmigt oder ausgesprochen, aber noch
 * nicht bestätigt.
 *
 * Eine eigene Abfrage statt eines Ausschnitts der zuletzt geänderten: Es
 * sind stets wenige, und sie sollen auch dann vollständig erscheinen, wenn
 * die Sammlung durch die übernommene Berufungshistorie auf Hunderte
 * angewachsen ist.
 */
export function useCallingsInPreparation() {
  const { isApproved } = useAuth()
  const constraints = useMemo(() => [where('status', 'in', ['approved', 'extended'])], [])
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
