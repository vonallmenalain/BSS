import { useSyncExternalStore } from 'react'
import { installPromptAvailable, subscribeInstallPrompt } from '@/lib/install'

/** Lässt sich die App gerade mit einem Knopf installieren (siehe `lib/install`)? */
export function useInstallPrompt(): boolean {
  return useSyncExternalStore(subscribeInstallPrompt, installPromptAvailable, () => false)
}
