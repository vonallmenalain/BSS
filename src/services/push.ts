import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
// Am Protokoll vorbei – dieselbe Abwägung wie bei `saveApView`: Ob ein Gerät
// Nachrichten empfängt, ändert nichts am Bestand der Gemeinde.
import {
  deleteDoc as fbDeleteDoc,
  doc as fbDoc,
  serverTimestamp,
  setDoc as fbSetDoc,
} from 'firebase/firestore'
import { app, db, COLLECTIONS } from '@/lib/firebase'

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
const SW_URL = '/push-sw.js'
const SW_SCOPE = '/push/'

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

  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
  const messaging = getMessaging(app)
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string,
    serviceWorkerRegistration: registration,
  })

  await fbSetDoc(
    fbDoc(db, COLLECTIONS.pushTokens, token),
    { uid: user.uid, token, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  )
  localStorage.setItem(TOKEN_KEY, token)
  return 'granted'
}

/** Abmelden: Adresse zurückgeben und das Dokument wegräumen. */
export async function disablePush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_KEY)

  try {
    await deleteToken(getMessaging(app))
  } catch (error) {
    // Ein Token, das sich nicht zurückgeben lässt, ist meist schon weg.
    console.warn('[push] Token konnte nicht zurückgegeben werden:', error)
  }

  if (token) {
    await fbDeleteDoc(fbDoc(db, COLLECTIONS.pushTokens, token)).catch((error) =>
      console.warn('[push] Adresse konnte nicht entfernt werden:', error),
    )
  }
}
