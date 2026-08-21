import { doc, serverTimestamp, setDoc } from '@/lib/db'
import { deleteField } from 'firebase/firestore'
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

/**
 * Das Monatsthema der Abendmahlsversammlung setzen oder entfernen.
 *
 * Ein eigener Schreibvorgang und nicht `saveSettings`: Der zusammenführende
 * Schreibmodus (`merge: true`) führt auch verschachtelte Objekte zusammen –
 * ein Monat, der im neuen Objekt fehlt, bliebe stehen. Geschrieben wird
 * deshalb genau der eine Monat, und ein geleertes Thema wird gelöscht statt
 * als leerer Text abgelegt (wie bei den Liedplätzen, siehe
 * `services/sacrament`).
 */
export async function saveSacramentTheme(monthKey: string, theme: string): Promise<SaveOutcome> {
  const clean = theme.trim()
  return commit(
    setDoc(
      doc(db, COLLECTIONS.settings, 'app'),
      {
        sacramentThemes: { [monthKey]: clean === '' ? deleteField() : clean },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}
