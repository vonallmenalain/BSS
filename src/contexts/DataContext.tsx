import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
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

export function DataProvider({ children }: { children: ReactNode }) {
  const { isApproved } = useAuth()

  const [users, setUsers] = useState<AppUser[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [hymns, setHymns] = useState<Hymn[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [membersLoaded, setMembersLoaded] = useState(false)

  /* Team ------------------------------------------------------------- */
  useEffect(() => {
    if (!isApproved) {
      setUsers([])
      setUsersLoaded(false)
      return
    }
    return onSnapshot(
      query(collection(db, COLLECTIONS.users), orderBy('displayName')),
      (snapshot) => {
        setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppUser))
        setUsersLoaded(true)
      },
      (error) => {
        console.error('[data] Benutzer konnten nicht geladen werden:', error)
        setUsersLoaded(true)
      },
    )
  }, [isApproved])

  /* Mitglieder ------------------------------------------------------- */
  useEffect(() => {
    if (!isApproved) {
      setMembers([])
      setMembersLoaded(false)
      return
    }
    return onSnapshot(
      query(collection(db, COLLECTIONS.members), orderBy('lastName')),
      (snapshot) => {
        setMembers(
          snapshot.docs.map((d) => {
            const data = d.data()
            // Alte Datensätze tragen noch «weniger aktiv» oder «weggezogen».
            // Sie hier einmal zurückzuführen erspart jeder Ansicht die Frage.
            return { id: d.id, ...data, status: toMemberStatus(data.status) } as Member
          }),
        )
        setMembersLoaded(true)
      },
      (error) => {
        console.error('[data] Mitglieder konnten nicht geladen werden:', error)
        setMembersLoaded(true)
      },
    )
  }, [isApproved])

  /* Liederliste ------------------------------------------------------ */
  useEffect(() => {
    if (!isApproved) {
      setHymns([])
      return
    }
    return onSnapshot(
      query(collection(db, COLLECTIONS.hymns), orderBy('number')),
      (snapshot) => setHymns(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Hymn)),
      (error) => console.error('[data] Liederliste konnte nicht geladen werden:', error),
    )
  }, [isApproved])

  /* Einstellungen ---------------------------------------------------- */
  useEffect(() => {
    if (!isApproved) return
    return onSnapshot(
      doc(db, COLLECTIONS.settings, 'app'),
      (snapshot) => {
        if (snapshot.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<AppSettings>) })
        }
      },
      (error) => console.error('[data] Einstellungen konnten nicht geladen werden:', error),
    )
  }, [isApproved])

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
      loading: isApproved && (!usersLoaded || !membersLoaded),
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
  }, [users, members, hymns, settings, usersLoaded, membersLoaded, isApproved])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData muss innerhalb von <DataProvider> verwendet werden.')
  return context
}
