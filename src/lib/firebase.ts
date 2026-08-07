import { initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  getAuth,
  browserLocalPersistence,
  connectAuthEmulator,
  setPersistence,
} from 'firebase/auth'
import {
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

/**
 * Firebase-Konfiguration.
 *
 * Die Werte stammen aus den Umgebungsvariablen (siehe `.env.example`).
 * Firebase-Web-Keys sind **keine** Geheimnisse – sie identifizieren nur das
 * Projekt. Der eigentliche Schutz der Daten passiert über die
 * Firestore-Sicherheitsregeln (`firestore.rules`).
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** Fehlende Konfiguration früh und verständlich melden statt kryptisch zu scheitern. */
export const missingConfigKeys = (
  Object.entries({
    VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
    VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
    VITE_FIREBASE_APP_ID: firebaseConfig.appId,
  }) as [string, string | undefined][]
)
  .filter(([, value]) => !value)
  .map(([key]) => key)

export const isFirebaseConfigured = missingConfigKeys.length === 0

export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

/**
 * Offline-Persistenz: Firestore legt eine lokale IndexedDB-Kopie an.
 * Dadurch funktioniert die App auch ohne Netz – Änderungen werden gepuffert
 * und synchronisieren sich automatisch, sobald wieder Verbindung besteht.
 * Genau das brauchen wir im Sitzungszimmer mit schwachem Empfang.
 *
 * Die Kopie wird bewusst **nicht** aufgeräumt (`CACHE_SIZE_UNLIMITED`). Sie ist
 * seit `lib/collectionStore` nicht mehr nur ein Notvorrat für den Offline-Fall,
 * sondern die Quelle, aus der die App startet: Was gestern schon gelesen wurde,
 * wird heute nicht noch einmal beim Server geholt. Räumte Firestore darin auf,
 * wären ausgerechnet die alten Daten wieder weg – und würden erneut abgefragt.
 * Der ganze Bestand einer Gemeinde bleibt dabei im einstelligen Megabyte-Bereich.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
})

/**
 * Lokale Entwicklung gegen die Firebase-Emulatoren.
 *
 * Mit `VITE_USE_EMULATOR=true` in der `.env` arbeitet die App gegen
 * `firebase emulators:start` statt gegen das Produktivprojekt – so lässt sich
 * gefahrlos mit Testdaten arbeiten, ohne echte Personendaten anzufassen.
 */
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1'
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
  console.info(`[firebase] Emulatoren aktiv (${host})`)
}

/** Anmeldung über Browser-Neustarts hinweg behalten. */
void setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[firebase] Persistenz konnte nicht gesetzt werden:', error)
})

/** Namen der Firestore-Sammlungen an einer Stelle, um Tippfehler zu vermeiden. */
export const COLLECTIONS = {
  users: 'users',
  meetings: 'meetings',
  agendaItems: 'agendaItems',
  members: 'members',
  talks: 'talks',
  callings: 'callings',
  settings: 'settings',
  /** Programm je Abendmahlsversammlung, Dokument-ID ist das Datum */
  sacramentMeetings: 'sacramentMeetings',
  prayers: 'prayers',
  hymns: 'hymns',
  notes: 'notes',
  /** Wiederkehrende Bekanntmachungen – gelten für viele Sonntage zugleich */
  announcementSeries: 'announcementSeries',
  /** Aufgaben, die zur Leitung eines Monats gehören – die Vorlagen dazu */
  monthlyDuties: 'monthlyDuties',
  /** Putzplan der Gemeinde, Dokument-ID ist der erste Tag der Woche */
  cleaningWeeks: 'cleaningWeeks',
  /** Aktivitätenplan der Priestertumskollegien (AP) */
  apActivities: 'apActivities',
  /** Führendes Kollegium je Monat, Dokument-ID ist «yyyy-MM» */
  apMonths: 'apMonths',
  /** Links, unter denen der Aktivitätenplan als Kalender abonniert werden kann */
  calendarFeeds: 'calendarFeeds',
} as const
