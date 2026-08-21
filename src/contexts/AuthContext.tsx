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
import {
  ADMIN_EMAIL,
  AP_ACCESS_ROLES,
  AP_WRITE_ROLES,
  ASSISTANT_AREA_PATHS,
  assistantAreasOf,
  BISHOPRIC_ROLES,
  FULL_ACCESS_ROLES,
  type AppUser,
  type AssistantArea,
  type Role,
} from '@/lib/types'

interface AuthContextValue {
  /** Firebase-Auth-Benutzer (Anmeldeidentität) */
  firebaseUser: FirebaseUser | null
  /** Profil aus Firestore inkl. Rolle – `null`, solange kein Profil existiert */
  profile: AppUser | null
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
   * Darf dieser Bereich der Abendmahlsversammlung geöffnet werden?
   *
   * Vollzugriff darf alles; die Assistenz genau das, was angehakt ist.
   * Gefragt wird an drei Stellen – im Menü, an der Route und in der
   * Reiterleiste –, und drei Antworten darauf wären ein Fehler.
   */
  canSeeSacramentArea: (area: AssistantArea) => boolean
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
   * Hängt am Schalter `impulse` des Profils und nicht an der Rolle;
   * vergeben wird er in der Benutzerverwaltung, und zwar allein vom
   * Administrator-Konto. Das Administrator-Konto selbst sieht den Bereich
   * immer – so bleibt er beim Aufbau ohne einen einzigen gesetzten
   * Schalter erst einmal nur dort sichtbar.
   */
  canViewImpulse: boolean
  /**
   * Darf im Bereich «Anti Doom» Inhalte pflegen und moderieren – die
   * Redaktion. Vorerst ist das allein das Administrator-Konto; der
   * Schalter `impulseEditor` steht bereit, um sie später zu öffnen.
   */
  canEditImpulse: boolean
  role: Role | null
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

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

    const ref = doc(db, COLLECTIONS.users, firebaseUser.uid)
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile({ id: snapshot.id, ...snapshot.data() } as AppUser)
        } else {
          // Konto existiert in Auth, aber (noch) kein Profil in Firestore.
          setProfile(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('[auth] Profil konnte nicht geladen werden:', err)
        setError('Dein Profil konnte nicht geladen werden. Bist du bereits freigeschaltet?')
        setLoading(false)
      },
    )
    return unsubscribe
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
    const role = profile?.role ?? null
    const active = Boolean(profile && profile.active && role)
    const isApproved = active && Boolean(role && FULL_ACCESS_ROLES.includes(role))
    const canViewAp = active && Boolean(role && AP_ACCESS_ROLES.includes(role))
    const isAdmin = firebaseUser?.email?.toLowerCase() === ADMIN_EMAIL

    /*
     * Die Bereiche der Assistenz.
     *
     * `assistantAreasOf` prüft Rolle und Aktivstatus gleich mit – ein Feld
     * aus einer früheren Fassung öffnet damit nichts, solange die Rolle
     * nicht dazu passt.
     */
    const assistantAreas = assistantAreasOf(profile)
    const isAssistant = assistantAreas.length > 0

    const canViewImpulse =
      isAdmin ||
      (active &&
        role !== 'pending' &&
        (profile?.impulse === true || profile?.impulseEditor === true))

    /*
     * Der Ort, an dem dieses Konto zu Hause ist.
     *
     * Die Reihenfolge ist die des Zugriffs: Wer alles sieht, beginnt auf der
     * Übersicht; wer nur Bereiche der Abendmahlsversammlung hat, im ersten
     * davon; wer nur den Kalender hat, dort. Bleibt nichts übrig, führt der
     * Weg auf die Startseite – dort steht dann der Wartebereich.
     */
    const homePath = isApproved
      ? '/'
      : isAssistant
        ? ASSISTANT_AREA_PATHS[assistantAreas[0]]
        : canViewAp
          ? '/ap'
          : canViewImpulse
            ? '/anti-doom'
            : '/'

    return {
      firebaseUser,
      profile,
      loading,
      isApproved,
      isBishopric: Boolean(role && BISHOPRIC_ROLES.includes(role)),
      isBishop: role === 'bishop',
      isAdmin,
      canViewAp,
      canEditAp: active && Boolean(role && AP_WRITE_ROLES.includes(role)),
      isApOnly: canViewAp && !isApproved,
      isAssistant,
      assistantAreas,
      canSeeSacramentArea: (area: AssistantArea) => isApproved || assistantAreas.includes(area),
      homePath,
      // Ein wartendes Konto bleibt draussen, selbst wenn ein Feld gesetzt
      // sein sollte – freigeschaltet wird zuerst, der Schalter kommt danach.
      // Die Redaktion sieht den Bereich immer: Wer ihn pflegt, muss ihn
      // lesen können. Dieselben Bedingungen stehen in `firestore.rules`.
      canViewImpulse,
      canEditImpulse: isAdmin || (active && role !== 'pending' && profile?.impulseEditor === true),
      role,
      error,
      signIn,
      signUp,
      signOut,
      resetPassword,
      clearError: () => setError(null),
    }
  }, [firebaseUser, profile, loading, error, signIn, signUp, signOut, resetPassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden.')
  return context
}
