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
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, COLLECTIONS, isFirebaseConfigured } from '@/lib/firebase'
import { getInitials } from '@/lib/utils'
import { BISHOPRIC_ROLES, FULL_ACCESS_ROLES, type AppUser, type Role } from '@/lib/types'

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
   * Neue Konten starten immer mit der Rolle `pending`; erst ein Bischof oder
   * Ratgeber schaltet sie frei. So kommt niemand ungeprüft an Personendaten.
   */
  const ensureProfile = useCallback(async (user: FirebaseUser, displayName?: string) => {
    const ref = doc(db, COLLECTIONS.users, user.uid)
    const existing = await getDoc(ref)
    const name = displayName || user.displayName || user.email?.split('@')[0] || 'Unbenannt'

    if (!existing.exists()) {
      await setDoc(ref, {
        email: user.email ?? '',
        displayName: name,
        initials: getInitials(name),
        role: 'pending' satisfies Role,
        active: true,
        memberId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      })
    } else {
      await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true })
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
    await fbSignOut(auth)
    setProfile(null)
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
    const isApproved = Boolean(
      profile && profile.active && role && FULL_ACCESS_ROLES.includes(role),
    )
    return {
      firebaseUser,
      profile,
      loading,
      isApproved,
      isBishopric: Boolean(role && BISHOPRIC_ROLES.includes(role)),
      isBishop: role === 'bishop',
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
