import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { DEFAULT_SETTINGS, type AppSettings, type AppUser, type Member } from '@/lib/types'

/**
 * Stammdaten, die praktisch jede Ansicht braucht: Team, Mitglieder,
 * Einstellungen. Sie werden einmal zentral abonniert statt in jeder Seite neu –
 * das spart Firestore-Leseoperationen und hält die Daten überall konsistent.
 */
interface DataContextValue {
  users: AppUser[]
  usersById: Map<string, AppUser>
  members: Member[]
  membersById: Map<string, Member>
  settings: AppSettings
  loading: boolean
  /** Namen einer UID auflösen, mit Rückfallwert */
  userName: (uid: string) => string
  /** Namen eines Mitglieds auflösen */
  memberName: (id: string) => string
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { isApproved } = useAuth()

  const [users, setUsers] = useState<AppUser[]>([])
  const [members, setMembers] = useState<Member[]>([])
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
        setMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
        setMembersLoaded(true)
      },
      (error) => {
        console.error('[data] Mitglieder konnten nicht geladen werden:', error)
        setMembersLoaded(true)
      },
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
    return {
      users,
      usersById,
      members,
      membersById,
      settings,
      loading: isApproved && (!usersLoaded || !membersLoaded),
      userName: (id) => usersById.get(id)?.displayName ?? 'Unbekannt',
      memberName: (id) => {
        const member = membersById.get(id)
        return member ? `${member.firstName} ${member.lastName}` : 'Unbekannt'
      },
    }
  }, [users, members, settings, usersLoaded, membersLoaded, isApproved])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData muss innerhalb von <DataProvider> verwendet werden.')
  return context
}
