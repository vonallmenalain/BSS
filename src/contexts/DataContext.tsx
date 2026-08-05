import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  collectionSnapshot,
  subscribeToCollection,
  IDLE_STATE,
  type StoreState,
} from '@/lib/collectionStore'
import { codeOf, hymnKey } from '@/lib/hymnCode'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type AppUser,
  type Hymn,
  type HymnChoice,
  toMemberStatus,
  type Member,
} from '@/lib/types'

/**
 * Stammdaten, die praktisch jede Ansicht braucht: Team, Mitglieder,
 * Einstellungen, Liederliste. Sie werden einmal zentral abonniert statt in
 * jeder Seite neu – das spart Firestore-Leseoperationen und hält die Daten
 * überall konsistent.
 */
interface DataContextValue {
  users: AppUser[]
  usersById: Map<string, AppUser>
  members: Member[]
  membersById: Map<string, Member>
  hymns: Hymn[]
  /** Code in Vergleichsform («6», «pv18a») → Lied */
  hymnsByCode: Map<string, Hymn>
  settings: AppSettings
  loading: boolean
  /** Namen einer UID auflösen, mit Rückfallwert */
  userName: (uid: string) => string
  /** Namen eines Mitglieds auflösen */
  memberName: (id: string) => string
  /** Liedtitel zu einem Code – leer, wenn er nicht in der Liste steht */
  hymnTitle: (code: string | null | undefined) => string
  /**
   * Titel einer Liedauswahl für die Anzeige. Der gespeicherte Titel gewinnt,
   * damit ein bereits gedrucktes Programm nach einem Neuimport gleich bleibt.
   */
  hymnLabel: (choice: HymnChoice | null | undefined) => string
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

/**
 * Eine Sammlung aus `lib/collectionStore` – einmal abonniert, danach nur noch
 * nachgeführt.
 */
function useStore<T>(name: string, enabled: boolean): StoreState<T> {
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

export function DataProvider({ children }: { children: ReactNode }) {
  const { isApproved, canViewAp } = useAuth()

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  /* Team ------------------------------------------------------------- */
  const usersState = useStore<AppUser>(COLLECTIONS.users, isApproved)
  const users = useMemo(
    () =>
      [...usersState.data].sort((a, b) =>
        (a.displayName ?? '').localeCompare(b.displayName ?? '', 'de'),
      ),
    [usersState.data],
  )

  /* Mitglieder ------------------------------------------------------- */
  const membersState = useStore<Member>(COLLECTIONS.members, isApproved)
  const members = useMemo(
    () =>
      membersState.data
        // Alte Datensätze tragen noch «weniger aktiv» oder «weggezogen».
        // Sie hier einmal zurückzuführen erspart jeder Ansicht die Frage.
        .map((member) => ({ ...member, status: toMemberStatus(member.status) }) as Member)
        .sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? '', 'de')),
    [membersState.data],
  )

  /* Liederliste ------------------------------------------------------ */
  const hymnsState = useStore<Hymn>(COLLECTIONS.hymns, isApproved)
  const hymns = useMemo(
    () => [...hymnsState.data].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [hymnsState.data],
  )

  /* Einstellungen ---------------------------------------------------- */
  // Auch für Konten, die nur den AP-Kalender sehen: Der Name der Gemeinde
  // steht in der Kopfzeile, und ohne ihn stünde dort «Gemeinde».
  useEffect(() => {
    if (!canViewAp) return
    return onSnapshot(
      doc(db, COLLECTIONS.settings, 'app'),
      (snapshot) => {
        if (snapshot.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<AppSettings>) })
        }
      },
      (error) => console.error('[data] Einstellungen konnten nicht geladen werden:', error),
    )
  }, [canViewAp])

  const value = useMemo<DataContextValue>(() => {
    const usersById = new Map(users.map((u) => [u.id, u]))
    const membersById = new Map(members.map((m) => [m.id, m]))
    const hymnsByCode = new Map(hymns.map((hymn) => [hymnKey(codeOf(hymn)), hymn]))
    const hymnTitle = (code: string | null | undefined) =>
      code ? (hymnsByCode.get(hymnKey(code))?.title ?? '') : ''

    return {
      users,
      usersById,
      members,
      membersById,
      hymns,
      hymnsByCode,
      settings,
      loading: isApproved && (usersState.loading || membersState.loading),
      userName: (id) => usersById.get(id)?.displayName ?? 'Unbekannt',
      memberName: (id) => {
        const member = membersById.get(id)
        return member ? `${member.firstName} ${member.lastName}` : 'Unbekannt'
      },
      hymnTitle,
      hymnLabel: (choice) => {
        if (!choice) return ''
        return choice.title || hymnTitle(choice.code ?? String(choice.number ?? ''))
      },
    }
  }, [users, members, hymns, settings, usersState.loading, membersState.loading, isApproved])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData muss innerhalb von <DataProvider> verwendet werden.')
  return context
}
