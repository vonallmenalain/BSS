import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
// Am Protokoll vorbei – dieselbe Abwägung wie bei `saveApView`: Ob ein Gerät
// Nachrichten empfängt, ändert nichts am Bestand der Gemeinde.
import {
  deleteDoc as fbDeleteDoc,
  doc as fbDoc,
  serverTimestamp,
  setDoc as fbSetDoc,
} from 'firebase/firestore'
import { app, auth, db, COLLECTIONS } from '@/lib/firebase'

/*
 * Das Gerät an- und abmelden: Erlaubnis, Adresse, Stand.
 *
 * Ein eigener Service Worker mit eigenem Geltungsbereich nimmt die
 * Zustellung entgegen (`public/push-sw.js`); die Geräte-Adresse (das
 * FCM-Token) wandert nach `pushTokens`, wo die geplante Netlify-Function
 * sie abholt. Das Token ist zugleich die Dokument-ID – ein Gerät, ein
 * Dokument, und das Abmelden findet seines wieder.
 *
 * Die Zweiteilung ist Absicht: **Ob** dieses Gerät Nachrichten empfängt,
 * steht hier und gilt je Browser – die Erlaubnis lässt sich gar nicht
 * anders vergeben. **Was** und **wann** verschickt wird, steht in
 * `notificationSettings` und gilt für die Person. Wer auf dem Telefon
 * Nachrichten mag und am Laptop nicht, bekommt genau das, ohne seine
 * Einstellungen doppelt pflegen zu müssen.
 */

const TOKEN_KEY = 'bss-push-token'
/** Für welches Konto das Gerät angemeldet ist – damit eine neue Adresse beim richtigen landet. */
const UID_KEY = 'bss-push-uid'
const SW_URL = '/push-sw.js'
const SW_SCOPE = '/push/'

/**
 * Die Putzplan-Erinnerung dieses Geräts (`services/cleaningReminder`).
 *
 * Sie braucht kein Konto, aber dieselbe Adresse: Ein Browser hat bei Cloud
 * Messaging nur eine. Wer die Benachrichtigungen des Kontos ausschaltet,
 * darf die Adresse deshalb nicht zurückgeben, solange die Erinnerung sie
 * noch braucht – und umgekehrt.
 */
export const CLEANING_REMINDER_KEY = 'bss-putzplan-erinnerung'

/** Ist der öffentliche VAPID-Schlüssel hinterlegt (`VITE_FIREBASE_VAPID_KEY`)? */
export function pushConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY)
}

/**
 * Kann dieser Browser Web-Push?
 *
 * Auf dem iPhone erst, wenn die App installiert ist («Zum Home-Bildschirm») –
 * im Safari-Tab fehlt die Schnittstelle, und genau das meldet diese Prüfung.
 */
export async function pushSupported(): Promise<boolean> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return false
  return isSupported().catch(() => false)
}

/** Empfängt dieses Gerät Nachrichten? */
export function pushEnabled(): boolean {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY))
  } catch {
    return false
  }
}

/** Hat der Browser Benachrichtigungen für diese App ausdrücklich verweigert? */
export function pushDenied(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'denied'
}

/**
 * Anmelden: Erlaubnis erfragen, Adresse holen, hinterlegen.
 *
 * `denied` heisst, der Browser hat die Erlaubnis verweigert – dann hilft
 * nur der Weg über die Browser-Einstellungen, und die Karte sagt das.
 */
export async function enablePush(user: { uid: string }): Promise<'granted' | 'denied'> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const token = await deviceToken()

  await fbSetDoc(
    fbDoc(db, COLLECTIONS.pushTokens, token),
    { uid: user.uid, token, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  )
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(UID_KEY, user.uid)
  return 'granted'
}

/**
 * Die Adresse dieses Geräts bei Cloud Messaging – setzt die Erlaubnis voraus.
 *
 * Solange der Browser sie nicht neu vergibt, ist es bei jedem Aufruf
 * dieselbe; die Benachrichtigungen des Kontos und die Putzplan-Erinnerung
 * teilen sie sich.
 */
export async function deviceToken(): Promise<string> {
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
  const token = await getToken(getMessaging(app), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string,
    serviceWorkerRegistration: registration,
  })
  await followAccountToken(token)
  return token
}

/**
 * Hat der Browser eine neue Adresse vergeben, zieht die Anmeldung des
 * Kontos mit.
 *
 * Die Putzplan-Erinnerung fragt bei jedem Öffnen des Plans nach der
 * Adresse, und dabei kann der Browser eine neue ausgeben. Bliebe die
 * Anmeldung des Kontos unter der alten stehen, verstummten seine
 * Benachrichtigungen, sobald der Versand die alte als abgelaufen wegräumt –
 * während der Schalter weiter «Eingeschaltet» zeigt.
 *
 * Umgeschrieben wird nur für das Konto, das das Gerät angemeldet hat: Wer
 * sich auf einem geteilten Gerät mit einem anderen Konto anmeldet, wird
 * nicht stillschweigend selbst zum Empfänger. Ohne Anmeldung geht es gar
 * nicht – das holt der nächste Aufruf mit Konto nach. Scheitert es, bleibt
 * die Adresse trotzdem brauchbar; die Erinnerung soll daran nicht hängen.
 */
async function followAccountToken(token: string): Promise<void> {
  try {
    const previous = localStorage.getItem(TOKEN_KEY)
    if (!previous || previous === token) return
    const uid = auth.currentUser?.uid
    const owner = localStorage.getItem(UID_KEY)
    if (!uid || (owner && owner !== uid)) return

    await fbSetDoc(
      fbDoc(db, COLLECTIONS.pushTokens, token),
      { uid, token, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true },
    )
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(UID_KEY, uid)
    await fbDeleteDoc(fbDoc(db, COLLECTIONS.pushTokens, previous)).catch((error) =>
      console.warn('[push] Alte Adresse konnte nicht entfernt werden:', error),
    )
  } catch (error) {
    console.warn('[push] Anmeldung des Kontos nicht nachgeführt:', error)
  }
}

/** Die Adresse zurückgeben – danach erreicht dieses Gerät keine Nachricht mehr. */
export async function releaseDeviceToken(): Promise<void> {
  try {
    await deleteToken(getMessaging(app))
  } catch (error) {
    // Ein Token, das sich nicht zurückgeben lässt, ist meist schon weg.
    console.warn('[push] Token konnte nicht zurückgegeben werden:', error)
  }
}

/** Braucht die Putzplan-Erinnerung die Adresse dieses Geräts noch? */
function cleaningReminderActive(): boolean {
  try {
    return Boolean(localStorage.getItem(CLEANING_REMINDER_KEY))
  } catch {
    return false
  }
}

/**
 * Abmelden: das Dokument wegräumen – und die Adresse zurückgeben, sofern
 * die Putzplan-Erinnerung sie nicht noch braucht.
 */
export async function disablePush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(UID_KEY)

  if (!cleaningReminderActive()) await releaseDeviceToken()

  if (token) {
    await fbDeleteDoc(fbDoc(db, COLLECTIONS.pushTokens, token)).catch((error) =>
      console.warn('[push] Adresse konnte nicht entfernt werden:', error),
    )
  }
}
