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
import { personHues } from '@/lib/personColors'
import { colorForHue, colorIndexForId } from '@/lib/utils'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
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
  /**
   * Der Farbton einer Person (0–7) – für den Kreis mit den Initialen, die
   * Marke an einer Zuweisung und die Unterstreichung eines zugeordneten
   * Textstücks.
   *
   * Gefragt werden darf mit jeder Kennung, unter der eine Person vorkommt:
   * der Konto-UID oder der Kennung ihres Mitgliedersatzes. Die Konten der
   * Bischofschaft tragen einen vergebenen Ton, damit sie sich sicher
   * unterscheiden; alles Übrige fällt auf die Rechnung zurück (siehe
   * `lib/personColors`).
   */
  personHue: (id: string) => number
  /** Derselbe Ton als fertige Klassen – der Normalfall in der Oberfläche. */
  personColor: (id: string) => string
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
  const { isApproved, canViewAp, isAssistant } = useAuth()

  /*
   * Wer die Stammdaten braucht: der Vollzugriff – und die Assistenz.
   *
   * Ansprachen, Musik und Gebet stehen alle auf denselben drei Listen:
   * Wer im Team ist (für Namen an Zuweisungen), wer in der Gemeinde ist
   * (für die Auswahl der Sprecher, Beter und Vortragenden) und welche
   * Lieder es gibt. Ohne sie wäre die Ansicht der Assistenz nicht dieselbe
   * wie die des Vollzugriffs, sondern eine mit lauter «Unbekannt».
   *
   * Dieselbe Grenze steht in `firestore.rules`; hier wird bloss nicht
   * abonniert, was ohnehin nichts herausgäbe.
   */
  const readsDirectory = isApproved || isAssistant

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  /* Team ------------------------------------------------------------- */
  const usersState = useStore<AppUser>(COLLECTIONS.users, readsDirectory)
  const users = useMemo(
    () =>
      [...usersState.data].sort((a, b) =>
        (a.displayName ?? '').localeCompare(b.displayName ?? '', 'de'),
      ),
    [usersState.data],
  )

  /* Mitglieder ------------------------------------------------------- */
  const membersState = useStore<Member>(COLLECTIONS.members, readsDirectory)
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
  const hymnsState = useStore<Hymn>(COLLECTIONS.hymns, readsDirectory)
  const hymns = useMemo(
    () => [...hymnsState.data].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [hymnsState.data],
  )

  /* Einstellungen ---------------------------------------------------- */
  // Auch für Konten, die nur den AP-Kalender sehen: Der Name der Gemeinde
  // steht in der Kopfzeile, und ohne ihn stünde dort «Gemeinde».
  useEffect(() => {
    if (!canViewAp && !isAssistant) return
    return onSnapshot(
      doc(db, COLLECTIONS.settings, 'app'),
      (snapshot) => {
        if (snapshot.exists()) {
          // `normalizeSettings` heilt verunglückte Werte (leere Zeit, 0 Plätze).
          setSettings(normalizeSettings(snapshot.data() as Partial<AppSettings>))
        }
      },
      (error) => console.error('[data] Einstellungen konnten nicht geladen werden:', error),
    )
  }, [canViewAp, isAssistant])

  /*
   * Die Farbtöne der Mannschaft.
   *
   * Einmal für alle gerechnet und nicht an jedem Kreis neu: Die Vergabe
   * schaut auf die ganze Liste – wer welchen Ton bekommt, hängt davon ab,
   * wer sonst noch da ist.
   */
  const hues = useMemo(() => personHues(users), [users])

  const value = useMemo<DataContextValue>(() => {
    const usersById = new Map(users.map((u) => [u.id, u]))
    const membersById = new Map(members.map((m) => [m.id, m]))
    const hymnsByCode = new Map(hymns.map((hymn) => [hymnKey(codeOf(hymn)), hymn]))
    const hymnTitle = (code: string | null | undefined) =>
      code ? (hymnsByCode.get(hymnKey(code))?.title ?? '') : ''

    /*
     * Ein vergebener Ton, sonst die Rechnung.
     *
     * Gefragt wird mit irgendeiner Kennung: Der Kreis rechnet mit dem
     * verknüpften Mitglied, eine Zuweisung mit dem Konto – beide stehen in
     * der Zuordnung, und beide ergeben denselben Ton.
     */
    const personHue = (id: string) => hues.get(id) ?? colorIndexForId(id)

    return {
      users,
      usersById,
      members,
      membersById,
      hymns,
      hymnsByCode,
      settings,
      loading: readsDirectory && (usersState.loading || membersState.loading),
      userName: (id) => usersById.get(id)?.displayName ?? 'Unbekannt',
      memberName: (id) => {
        const member = membersById.get(id)
        return member ? `${member.firstName} ${member.lastName}` : 'Unbekannt'
      },
      personHue,
      personColor: (id) => colorForHue(personHue(id)),
      hymnTitle,
      hymnLabel: (choice) => {
        if (!choice) return ''
        return choice.title || hymnTitle(choice.code ?? String(choice.number ?? ''))
      },
    }
  }, [
    users,
    members,
    hymns,
    hues,
    settings,
    usersState.loading,
    membersState.loading,
    readsDirectory,
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData muss innerhalb von <DataProvider> verwendet werden.')
  return context
}
