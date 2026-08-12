import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
// Am Protokoll vorbei – dieselbe Abwägung wie bei `saveApView`: Ob ein Gerät
// die Erinnerung mag, ändert nichts am Bestand der Gemeinde.
import {
  deleteDoc as fbDeleteDoc,
  doc as fbDoc,
  serverTimestamp,
  setDoc as fbSetDoc,
} from 'firebase/firestore'
import { app, db, COLLECTIONS } from '@/lib/firebase'

/*
 * Die Montags-Erinnerung: einschalten, ausschalten, Stand kennen.
 *
 * Ein eigener Service Worker mit eigenem Geltungsbereich nimmt die
 * Zustellung entgegen (`public/impuls-push-sw.js`); die Geräte-Adresse
 * (das FCM-Token) wandert nach `impulsePushTokens`, wo die geplante
 * Netlify-Function sie montags abholt. Das Token ist zugleich die
 * Dokument-ID – ein Gerät, ein Dokument, und das Ausschalten findet
 * seines wieder.
 *
 * Der Schalter gilt **je Gerät**, nicht je Konto: Wer die Erinnerung auf
 * dem Telefon mag und am Laptop nicht, bekommt genau das. Der Stand dafür
 * liegt im Browser (localStorage), nicht in Firestore.
 */

const TOKEN_KEY = 'impuls-push-token'
const SW_URL = '/impuls-push-sw.js'
const SW_SCOPE = '/impuls-push/'

/** Ist der öffentliche VAPID-Schlüssel hinterlegt (`VITE_FIREBASE_VAPID_KEY`)? */
export function impulsePushConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY)
}

/**
 * Kann dieser Browser Web-Push?
 *
 * Auf dem iPhone erst, wenn die App installiert ist («Zum Home-Bildschirm») –
 * im Safari-Tab fehlt die Schnittstelle, und genau das meldet diese Prüfung.
 */
export async function impulsePushSupported(): Promise<boolean> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return false
  return isSupported().catch(() => false)
}

/** Hat dieses Gerät die Erinnerung eingeschaltet? */
export function impulsePushEnabled(): boolean {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY))
  } catch {
    return false
  }
}

/**
 * Einschalten: Erlaubnis erfragen, Adresse holen, hinterlegen.
 *
 * `denied` heisst, der Browser hat die Erlaubnis verweigert – dann hilft
 * nur der Weg über die Browser-Einstellungen, und die Karte sagt das.
 */
export async function enableImpulsePush(user: { uid: string }): Promise<'granted' | 'denied'> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
  const messaging = getMessaging(app)
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string,
    serviceWorkerRegistration: registration,
  })

  await fbSetDoc(
    fbDoc(db, COLLECTIONS.impulsePushTokens, token),
    { uid: user.uid, token, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  )
  localStorage.setItem(TOKEN_KEY, token)
  return 'granted'
}

/** Ausschalten: Adresse zurückgeben und das Dokument wegräumen. */
export async function disableImpulsePush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_KEY)

  try {
    await deleteToken(getMessaging(app))
  } catch (error) {
    // Ein Token, das sich nicht zurückgeben lässt, ist meist schon weg.
    console.warn('[impuls-push] Token konnte nicht zurückgegeben werden:', error)
  }

  if (token) {
    await fbDeleteDoc(fbDoc(db, COLLECTIONS.impulsePushTokens, token)).catch((error) =>
      console.warn('[impuls-push] Adresse konnte nicht entfernt werden:', error),
    )
  }
}
