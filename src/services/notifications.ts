// Am Protokoll vorbei – wie bei den Geräte-Adressen: Was jemand
// benachrichtigt bekommen will, ändert nichts am Bestand der Gemeinde.
import { doc as fbDoc, serverTimestamp, setDoc as fbSetDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/lib/notifications'
import type { NotificationSettings } from '@/lib/types'

/**
 * Die Benachrichtigungs-Einstellungen einer Person – ein Dokument je Konto.
 *
 * Geschrieben wird immer zusammenführend und immer vollständig genug, dass
 * das Dokument auch beim ersten Mal entsteht: Die Zugriffsregel verlangt
 * die eigene UID im Dokument, und ein `merge` ohne sie schlüge fehl.
 *
 * `updatedAt` ist hier mehr als Buchhaltung. Der Versand nimmt es als
 * Anfangspunkt für die Traktanden-Meldung: Was vor der letzten Änderung
 * an den Einstellungen erfasst wurde, gilt als altbekannt. So beginnt das
 * Einschalten bei null, statt einen Schwall über alles Vergangene
 * auszulösen.
 */
export async function saveNotificationSettings(
  uid: string,
  patch: Partial<Pick<NotificationSettings, 'impuls' | 'agenda' | 'meeting' | 'ap'>>,
): Promise<void> {
  await fbSetDoc(
    fbDoc(db, COLLECTIONS.notificationSettings, uid),
    { uid, ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/** Die Einstellungen mit allen Standardwerten aufgefüllt. */
export function withDefaults(
  settings: NotificationSettings | null,
): Omit<NotificationSettings, 'id' | 'uid'> {
  return {
    impuls: { ...DEFAULT_NOTIFICATION_SETTINGS.impuls, ...(settings?.impuls ?? {}) },
    agenda: { ...DEFAULT_NOTIFICATION_SETTINGS.agenda, ...(settings?.agenda ?? {}) },
    meeting: { ...DEFAULT_NOTIFICATION_SETTINGS.meeting, ...(settings?.meeting ?? {}) },
    ap: { ...DEFAULT_NOTIFICATION_SETTINGS.ap, ...(settings?.ap ?? {}) },
  }
}
