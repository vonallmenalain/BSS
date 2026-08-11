import { doc, serverTimestamp, setDoc } from '@/lib/db'
import { db, COLLECTIONS } from '@/lib/firebase'
import { commit, type SaveOutcome } from '@/lib/sync'
import { normalizeSettings, type AppSettings } from '@/lib/types'

export async function saveSettings(patch: Partial<AppSettings>): Promise<SaveOutcome> {
  // Kein leeres Zeitfeld, keine null Ansprachen-Plätze in die Datenbank –
  // siehe `normalizeSettings`.
  const clean = normalizeSettings(patch)
  const keys = Object.keys(patch) as (keyof AppSettings)[]
  const sanitized = Object.fromEntries(keys.map((key) => [key, clean[key]]))

  return commit(
    setDoc(
      doc(db, COLLECTIONS.settings, 'app'),
      { ...sanitized, updatedAt: serverTimestamp() },
      { merge: true },
    ),
  )
}
