import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  terminate,
} from 'firebase/firestore'
import { auth, db, COLLECTIONS, isFirebaseConfigured } from '@/lib/firebase'
import { getInitials } from '@/lib/utils'
import { commit } from '@/lib/sync'
import { clearSyncWatermarks, stopCollectionStores } from '@/lib/collectionStore'
import { accessOf } from '@/lib/access'
import { BISHOPRIC_ROLES, type AppUser, type AssistantArea, type Role } from '@/lib/types'

interface AuthContextValue {
  /** Firebase-Auth-Benutzer (Anmeldeidentität) */
  firebaseUser: FirebaseUser | null
  /** Profil aus Firestore inkl. Rolle – `null`, solange kein Profil existiert */
  profile: AppUser | null
  /**
   * Anmeldung oder Profil sind noch nicht geklärt.
   *
   * Das gilt auch für den Augenblick nach dem Anmelden, in dem das Konto
   * schon bekannt ist, sein Profil aber noch nicht: Ohne Profil sähe es wie
   * ein Konto ohne Rolle aus, und die App zeigte kurz den Wartebereich.
   */
  loading: boolean
  /**
   * Angemeldet, aktiv und freigeschaltet.
   *
   * Damit ist zugleich der volle Zugriff verbunden: Bischof, beide Ratgeber
   * und die Sekretäre sehen und dürfen dasselbe. Nur `pending` sieht nichts.
   */
  isApproved: boolean
  /** Gehört zur Bischofschaft im engeren Sinn (leitet die Versammlung). */
  isBishopric: boolean
  isBishop: boolean
  /** Das Administrator-Konto – verwaltet als Einziges Benutzer und Rollen. */
  isAdmin: boolean
  /**
   * Niemand ist angemeldet – der öffentliche Blick auf den Aktivitätenplan.
   *
   * Genau eine Seite steht ohne Konto offen (`/ap`), und sie steht offen,
   * weil der Plan das Anschlagbrett der AP's ist (siehe `firestore.rules`).
   * Alles andere führt weiterhin zur Anmeldung.
   *
   * Erst wahr, wenn die Anmeldung geprüft ist: Solange `loading` gilt, weiss
   * niemand, ob da ein Konto ist – und die Hülle der App soll nicht erst als
   * Besuch erscheinen und einen Augenblick später als angemeldetes Konto.
   */
  isGuest: boolean
  /** Darf «Aktivitäten AP’s» sehen – Vollzugriff eingeschlossen. */
  canViewAp: boolean
  /** Darf im AP-Kalender auch schreiben. */
  canEditAp: boolean
  /** Sieht ausschliesslich den AP-Kalender und sonst nichts von der App. */
  isApOnly: boolean
  /**
   * Assistenz der Abendmahlsversammlung – sieht einzelne Bereiche daraus.
   *
   * Welche, sagt `assistantAreas`; die Rolle allein öffnet nichts. Ein
   * Konto mit der Rolle, aber ohne einen einzigen Bereich, kommt nicht in
   * die App – der Zugang ist dann entzogen, ohne dass die Rolle geändert
   * wurde.
   */
  isAssistant: boolean
  /** Die freigeschalteten Bereiche – leer bei jedem anderen Konto. */
  assistantAreas: AssistantArea[]
  /**
   * Die Bereiche, in denen die Assistenz auch schreiben darf.
   *
   * Immer eine Teilmenge von `assistantAreas`; ohne die Rolle leer.
   */
  assistantWriteAreas: AssistantArea[]
  /**
   * Darf dieser Bereich der Abendmahlsversammlung geöffnet werden?
   *
   * Vollzugriff darf alles; die Assistenz genau das, was angehakt ist.
   * Gefragt wird an drei Stellen – im Menü, an der Route und in der
   * Reiterleiste –, und drei Antworten darauf wären ein Fehler.
   */
  canSeeSacramentArea: (area: AssistantArea) => boolean
  /**
   * Darf in diesem Bereich auch geändert werden?
   *
   * Das Gegenstück zu `canSeeSacramentArea`: Sehen und Ändern sind bei der
   * Assistenz zwei Fragen, und jede Sparte beantwortet sie für sich. Der
   * Vollzugriff bejaht beide, für jeden Bereich.
   *
   * Es ist die Höflichkeit der Oberfläche und nicht die Sperre: Was jemand
   * tatsächlich schreiben darf, entscheiden die Zugriffsregeln. Ohne diese
   * Auskunft stünden dort aber Knöpfe, die beim Drücken bloss «Speichern
   * fehlgeschlagen» sagen.
   */
  canEditSacramentArea: (area: AssistantArea) => boolean
  /**
   * Wohin dieses Konto gehört, wenn es nichts anderes verlangt hat.
   *
   * Der Vollzugriff auf die Übersicht, ein AP-Zugang in den Kalender, die
   * Assistenz in ihren ersten Bereich. Ohne diese eine Auskunft müsste jede
   * Weiche die Frage neu beantworten – und eine davon käme zu einem anderen
   * Schluss.
   */
  homePath: string
  /**
   * Darf den Bereich «Anti Doom» sehen – den geistigen Bereich für die AP’s.
   *
   * Hängt am Schalter `impulse` des Profils und nicht an der Rolle –
   * ausser bei der Rolle «Nur Anti Doom», die den Bereich von sich aus
   * mitbringt. Vergeben wird beides in der Benutzerverwaltung, und zwar
   * allein vom Administrator-Konto. Das Administrator-Konto selbst sieht den Bereich
   * immer – so bleibt er beim Aufbau ohne einen einzigen gesetzten
   * Schalter erst einmal nur dort sichtbar.
   */
  canViewImpulse: boolean
  /**
   * Darf im Bereich «Anti Doom» Inhalte pflegen und moderieren – die
   * Redaktion. Das Administrator-Konto und, wer in der Benutzerverwaltung
   * die Stufe «Anti Doom + Redaktion» hat (Schalter `impulseEditor`). Hängt
   * nicht an der Rolle: Auch bei Vollzugriff heisst «Anti Doom» allein nur
   * ansehen.
   */
  canEditImpulse: boolean
  /**
   * Die Rolle des Kontos ist dieser Fassung der App unbekannt – sie ist
   * neuer als die App auf dem Gerät (siehe `accessOf`).
   */
  unknownRole: boolean
  role: Role | null
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Wie lange ein Profil aus dem Gerätespeicher, das keinen Zugang gibt, auf
 * die Bestätigung des Servers wartet. Danach gilt es trotzdem – eine
 * langsame Verbindung soll nicht in einem endlosen Ladebildschirm enden.
 */
const CACHED_PROFILE_GRACE_MS = 4000

/** Firebase-Fehlercodes in verständliche deutsche Meldungen übersetzen. */
function translateAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''

  switch (code) {
    case 'auth/invalid-email':
      return 'Die E-Mail-Adresse ist ungültig.'
    case 'auth/user-disabled':
      return 'Dieses Konto wurde deaktiviert.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-Mail-Adresse oder Passwort stimmen nicht.'
    case 'auth/email-already-in-use':
      return 'Für diese E-Mail-Adresse besteht bereits ein Konto.'
    case 'auth/weak-password':
      return 'Das Passwort muss mindestens 6 Zeichen lang sein.'
    case 'auth/too-many-requests':
      return 'Zu viele Versuche. Bitte warte einen Moment.'
    case 'auth/network-request-failed':
      return 'Keine Verbindung zum Server. Prüfe deine Internetverbindung.'
    case 'auth/operation-not-allowed':
      return 'Die E-Mail-Anmeldung ist im Firebase-Projekt nicht aktiviert.'
    default:
      return error instanceof Error ? error.message : 'Unbekannter Fehler bei der Anmeldung.'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  /** Für welches Konto `profile` gilt – siehe `loading`. */
  const [profileUid, setProfileUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* Anmeldestatus beobachten ------------------------------------------ */
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(
      auth,
      (user) => {
        setFirebaseUser(user)
        if (!user) {
          setProfile(null)
          setLoading(false)
        }
      },
      (err) => {
        setError(translateAuthError(err))
        setLoading(false)
      },
    )
  }, [])

  /* Profil live mitverfolgen – eine Rollenänderung wirkt sofort ------- */
  useEffect(() => {
    if (!firebaseUser) return

    const { uid, email } = firebaseUser
    const ref = doc(db, COLLECTIONS.users, uid)
    let waiting: ReturnType<typeof setTimeout> | undefined
    const apply = (next: AppUser | null) => {
      clearTimeout(waiting)
      setProfile(next)
      setProfileUid(uid)
      setLoading(false)
    }
    const unsubscribe = onSnapshot(
      ref,
      // Auch die Meldung, dass der Server einen Stand bestätigt hat –
      // gebraucht für die Frist unten.
      { includeMetadataChanges: true },
      (snapshot) => {
        // Ohne Dokument: Das Konto existiert in Auth, aber (noch) kein Profil.
        const next = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as AppUser) : null
        /*
         * Ein Stand aus dem Gerätespeicher kann überholt sein – etwa noch
         * «wartet auf Freigabe», obwohl die Rolle längst vergeben ist. Gibt
         * er keinen Zugang, wartet die App einen Moment auf den Server,
         * statt den Wartebereich aufblitzen zu lassen. Gibt er Zugang, gilt
         * er sofort: So startet die App auch ohne Verbindung. Und ohne
         * Verbindung wartet sie auf nichts, was nicht kommen kann.
         */
        if (snapshot.metadata.fromCache && navigator.onLine && !accessOf(next, email).hasAccess) {
          clearTimeout(waiting)
          waiting = setTimeout(() => apply(next), CACHED_PROFILE_GRACE_MS)
          return
        }
        apply(next)
      },
      (err) => {
        clearTimeout(waiting)
        console.error('[auth] Profil konnte nicht geladen werden:', err)
        setError('Dein Profil konnte nicht geladen werden. Bist du bereits freigeschaltet?')
        setProfileUid(uid)
        setLoading(false)
      },
    )
    return () => {
      clearTimeout(waiting)
      unsubscribe()
    }
  }, [firebaseUser])

  /**
   * Legt das Firestore-Profil an, falls es fehlt.
   *
   * Neue Konten starten immer mit der Rolle `pending`; erst ein bereits
   * freigeschaltetes Konto vergibt eine Rolle. So kommt niemand ungeprüft an
   * Personendaten.
   *
   * Auch hier wird über `commit()` geschrieben: Bricht die Verbindung
   * ausgerechnet zwischen Anmeldung und Profilanlage ab, soll die App nicht
   * auf einer Bestätigung stehen bleiben, die erst später kommt.
   */
  const ensureProfile = useCallback(async (user: FirebaseUser, displayName?: string) => {
    const ref = doc(db, COLLECTIONS.users, user.uid)
    const existing = await getDoc(ref)
    const name = displayName || user.displayName || user.email?.split('@')[0] || 'Unbenannt'

    if (!existing.exists()) {
      await commit(
        setDoc(ref, {
          email: user.email ?? '',
          displayName: name,
          initials: getInitials(name),
          role: 'pending' satisfies Role,
          active: true,
          memberId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        }),
      )
    } else {
      await commit(setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true }))
    }
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null)
      try {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
        await ensureProfile(credential.user)
      } catch (err) {
        const message = translateAuthError(err)
        setError(message)
        throw new Error(message, { cause: err })
      }
    },
    [ensureProfile],
  )

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      setError(null)
      try {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(credential.user, { displayName: displayName.trim() })
        await ensureProfile(credential.user, displayName.trim())
      } catch (err) {
        const message = translateAuthError(err)
        setError(message)
        throw new Error(message, { cause: err })
      }
    },
    [ensureProfile],
  )

  const signOut = useCallback(async () => {
    setError(null)
    /*
     * Zuerst die Sammlungen abmelden.
     *
     * Sie bleiben seit `lib/collectionStore` über den ganzen Aufenthalt in der
     * App abonniert – auch wenn gerade keine Ansicht sie braucht. Ohne diesen
     * Schritt liefen die Abfragen des abgemeldeten Kontos weiter und schlügen
     * mit «keine Berechtigung» fehl; ausserdem stünden die Daten der einen
     * Person noch da, wenn sich die nächste anmeldet.
     */
    stopCollectionStores()
    await fbSignOut(auth)
    setProfile(null)

    /*
     * Dann die lokale Datenkopie löschen.
     *
     * Die Offline-Persistenz legt den ganzen Bestand – Mitglieder, Traktanden,
     * Berufungen – in der IndexedDB des Browsers ab. Wer sich abmeldet, will
     * die Daten nicht auf dem Gerät zurücklassen; gerade auf einem fremden
     * oder geteilten Gerät ist das der Sinn des Abmeldens. Solange man
     * angemeldet bleibt, bleibt auch die Kopie – die Anmeldung selbst
     * überdauert Browser-Neustarts (`browserLocalPersistence`).
     *
     * `terminate` muss vor `clearIndexedDbPersistence` kommen; danach ist die
     * Datenbankverbindung dieser Sitzung beendet, deshalb schliesst ein
     * vollständiges Neuladen der Anmeldeseite den Vorgang ab. Ist die App in
     * einem zweiten Tab offen, verweigert der Browser das Löschen – das
     * bleibt ein Behelf, bis auch dieser Tab abgemeldet wird.
     */
    clearSyncWatermarks()
    try {
      await terminate(db)
      await clearIndexedDbPersistence(db)
    } catch (err) {
      console.warn('[auth] Lokale Datenkopie konnte nicht gelöscht werden:', err)
    }
    window.location.replace('/anmelden')
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email.trim())
    } catch (err) {
      const message = translateAuthError(err)
      setError(message)
      throw new Error(message, { cause: err })
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const access = accessOf(profile, firebaseUser?.email)
    const { role, isApproved, canViewAp, assistantAreas, assistantWriteAreas } = access
    // Angemeldet, das Profil aber noch nicht da (siehe `loading`).
    const profilePending = Boolean(firebaseUser) && profileUid !== firebaseUser?.uid
    const pending = loading || profilePending

    return {
      firebaseUser,
      profile,
      loading: pending,
      isGuest: !pending && !firebaseUser,
      isApproved,
      isBishopric: Boolean(role && BISHOPRIC_ROLES.includes(role)),
      isBishop: role === 'bishop',
      isAdmin: access.isAdmin,
      canViewAp,
      canEditAp: access.canEditAp,
      isApOnly: canViewAp && !isApproved,
      isAssistant: access.isAssistant,
      assistantAreas,
      assistantWriteAreas,
      canSeeSacramentArea: (area: AssistantArea) => isApproved || assistantAreas.includes(area),
      canEditSacramentArea: (area: AssistantArea) =>
        isApproved || assistantWriteAreas.includes(area),
      homePath: access.homePath,
      // Dieselben Bedingungen stehen in `firestore.rules` (siehe `accessOf`).
      canViewImpulse: access.canViewImpulse,
      canEditImpulse: access.canEditImpulse,
      unknownRole: access.unknownRole,
      role,
      error,
      signIn,
      signUp,
      signOut,
      resetPassword,
      clearError: () => setError(null),
    }
  }, [firebaseUser, profile, profileUid, loading, error, signIn, signUp, signOut, resetPassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden.')
  return context
}
