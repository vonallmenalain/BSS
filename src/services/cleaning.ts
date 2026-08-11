import { deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from '@/lib/db'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { commit, requireOnline, type SaveOutcome } from '@/lib/sync'
import type { ParsedCleaningWeek } from '@/services/importCleaning'
import type { CleaningWeek } from '@/lib/types'

/*
 * Der Putzplan in Firestore.
 *
 * Die Dokument-ID ist der erste Tag der Woche. Das macht jeden Import
 * folgenlos wiederholbar: Dieselbe Woche schreibt dasselbe Dokument, und
 * eine korrigierte Tabelle ersetzt die alte Fassung, statt eine zweite
 * danebenzustellen.
 *
 * Gelesen wird über `useCleaningWeeks()` – der Plan gehört zu den Daten, die
 * eine Ansicht mitlaufen sehen will, nicht zu denen, die man einmal abholt.
 */

const CHUNK_SIZE = 400

/** Schreibt einen eingelesenen Plan. Vorhandene Wochen werden ersetzt. */
export async function importCleaningWeeks(
  weeks: ParsedCleaningWeek[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  requireOnline()

  for (let offset = 0; offset < weeks.length; offset += CHUNK_SIZE) {
    const chunk = weeks.slice(offset, offset + CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const week of chunk) {
      batch.set(
        doc(db, COLLECTIONS.cleaningWeeks, week.startDate),
        {
          startDate: week.startDate,
          endDate: week.endDate,
          group: week.group,
          team: week.team,
          note: week.note,
          updatedAt: serverTimestamp(),
        },
        // Zusammenführen statt ersetzen: Was von Hand nachgetragen wurde,
        // überlebt einen zweiten Import derselben Tabelle.
        { merge: true },
      )
    }

    await batch.commit()
    onProgress?.(Math.min(offset + chunk.length, weeks.length), weeks.length)
  }

  return weeks.length
}

/** Eine einzelne Woche anlegen oder ändern – für Korrekturen von Hand. */
export async function saveCleaningWeek(week: Omit<CleaningWeek, 'id'>): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.cleaningWeeks, week.startDate),
      { ...week, updatedAt: serverTimestamp() },
      { merge: true },
    ),
  )
}

export async function deleteCleaningWeek(id: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.cleaningWeeks, id)))
  forgetDoc(COLLECTIONS.cleaningWeeks, id)
  return outcome
}
