import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { commit, type SaveOutcome } from '@/lib/sync'
import type { AppSettings } from '@/lib/types'

export async function saveSettings(patch: Partial<AppSettings>): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.settings, 'app'),
      { ...patch, updatedAt: serverTimestamp() },
      { merge: true },
    ),
  )
}
