import { useSyncExternalStore } from 'react'
import { pendingWrites, subscribePendingWrites } from '@/lib/sync'

/**
 * Anzahl Änderungen, die lokal gespeichert sind, aber noch auf die
 * Übertragung warten.
 *
 * Damit lässt sich in der Kopfzeile zeigen, dass noch etwas unterwegs ist –
 * unabhängig davon, welche Meldung beim Speichern erschienen ist. Wer das
 * Gerät aus der Hand legt, sieht so, ob alles durch ist.
 */
export function usePendingWrites(): number {
  return useSyncExternalStore(subscribePendingWrites, pendingWrites, () => 0)
}
