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
import { OPEN_STATUSES, type AgendaItem, type Calling, type Meeting, type Talk } from '@/lib/types'

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
  const constraints = useMemo(
    () => [orderBy('date', 'desc'), fbLimit(limitCount)],
    [limitCount],
  )
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

/**
 * Zusatzbedingung für vertrauliche Traktanden.
 *
 * Die Sicherheitsregeln lassen Sekretäre nur Dokumente mit
 * `confidential == false` lesen – und prüfen das bei einer Abfrage für
 * jedes einzelne Ergebnis. Ohne diesen Filter würde die gesamte Abfrage
 * mit «permission denied» scheitern, statt bloss weniger zu liefern.
 */
function useConfidentialFilter(): QueryConstraint[] {
  const { isLeadership } = useAuth()
  return useMemo(
    () => (isLeadership ? [] : [where('confidential', '==', false)]),
    [isLeadership],
  )
}

/** Alle Traktanden einer bestimmten Sitzung. */
export function useMeetingItems(meetingId: string | undefined) {
  const { isApproved } = useAuth()
  const visibility = useConfidentialFilter()
  const constraints = useMemo(
    () =>
      meetingId ? [where('meetingId', '==', meetingId), ...visibility, orderBy('order')] : [],
    [meetingId, visibility],
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
  const visibility = useConfidentialFilter()
  const constraints = useMemo(
    () => [where('meetingId', '==', null), where('status', 'in', OPEN_STATUSES), ...visibility],
    [visibility],
  )
  return useCollection<AgendaItem>(COLLECTIONS.agendaItems, constraints, isApproved)
}

/** Sämtliche offenen Traktanden – unabhängig von der Sitzungszuordnung. */
export function useOpenItems() {
  const { isApproved } = useAuth()
  const visibility = useConfidentialFilter()
  const constraints = useMemo(
    () => [where('status', 'in', OPEN_STATUSES), ...visibility],
    [visibility],
  )
  return useCollection<AgendaItem>(COLLECTIONS.agendaItems, constraints, isApproved)
}

/** Traktanden für die Archiv-/Suchansicht. */
export function useAllItems(limitCount = 500) {
  const { isApproved } = useAuth()
  const visibility = useConfidentialFilter()
  const constraints = useMemo(
    () => [...visibility, orderBy('updatedAt', 'desc'), fbLimit(limitCount)],
    [limitCount, visibility],
  )
  return useCollection<AgendaItem>(COLLECTIONS.agendaItems, constraints, isApproved)
}

/* ------------------------------------------------------------------ */
/* Ansprachen & Berufungen                                             */
/* ------------------------------------------------------------------ */

export function useTalks(limitCount = 300) {
  const { isApproved } = useAuth()
  const constraints = useMemo(
    () => [orderBy('date', 'desc'), fbLimit(limitCount)],
    [limitCount],
  )
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
