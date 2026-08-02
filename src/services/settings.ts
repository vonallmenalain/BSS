import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import type { AppSettings } from '@/lib/types'

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.settings, 'app'),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}
