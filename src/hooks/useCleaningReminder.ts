import { useSyncExternalStore } from 'react'
import {
  storedCleaningReminder,
  subscribeCleaningReminder,
  type StoredCleaningReminder,
} from '@/services/cleaningReminder'

/**
 * Die Putzplan-Erinnerung dieses Geräts, laufend nachgeführt – für den
 * Knopf über dem Plan und den Dialog dahinter. `null`, solange keine
 * eingeschaltet ist.
 */
export function useCleaningReminder(): StoredCleaningReminder | null {
  return useSyncExternalStore(subscribeCleaningReminder, storedCleaningReminder, () => null)
}
