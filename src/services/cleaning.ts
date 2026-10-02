import { deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from '@/lib/db'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { cleaningGroupId, normalizedEntries } from '@/lib/cleaningGroups'
import { commit, requireOnline, type SaveOutcome } from '@/lib/sync'
import type { GeneratedWeek } from '@/lib/cleaningPlan'
import type { CleaningGroupEntry, CleaningWeek } from '@/lib/types'

/*
 * Der Putzplan und die Putzgruppen in Firestore.
 *
 * Die Dokument-ID einer Woche ist ihr erster Tag, die einer Gruppe ihre
 * Nummer. Damit schreibt dieselbe Woche immer dasselbe Dokument: Ein neu
 * generierter Zeitraum ersetzt den alten, statt eine zweite Fassung
 * danebenzustellen.
 *
 * Gelesen wird über `useCleaningWeeks()` und `useCleaningGroups()` – beide
 * gehören zu den Daten, die eine Ansicht mitlaufen sehen will.
 */

const CHUNK_SIZE = 400

/**
 * Einen generierten Zeitraum übernehmen: die Wochen schreiben und entfernen,
 * was es darin nicht mehr gibt (siehe `diffCleaningPlan`).
 *
 * Jede Woche wird ganz geschrieben, nicht zusammengeführt – eine Bemerkung
 * von früher gehört nicht mehr zu einer Woche, die jetzt eine andere Gruppe
 * putzt.
 */
export async function applyCleaningPlan(
  weeks: readonly GeneratedWeek[],
  removedIds: readonly string[],
): Promise<void> {
  requireOnline()
  const writes = [
    ...weeks.map((week) => ({ kind: 'set' as const, week })),
    ...removedIds.map((id) => ({ kind: 'delete' as const, id })),
  ]
  for (let offset = 0; offset < writes.length; offset += CHUNK_SIZE) {
    const batch = writeBatch(db)
    for (const write of writes.slice(offset, offset + CHUNK_SIZE)) {
      if (write.kind === 'delete') {
        batch.delete(doc(db, COLLECTIONS.cleaningWeeks, write.id))
      } else {
        batch.set(doc(db, COLLECTIONS.cleaningWeeks, write.week.startDate), {
          startDate: write.week.startDate,
          endDate: write.week.endDate,
          group: write.week.group,
          team: write.week.team,
          note: write.week.note,
          updatedAt: serverTimestamp(),
        })
      }
    }
    await batch.commit()
  }
  removedIds.forEach((id) => forgetDoc(COLLECTIONS.cleaningWeeks, id))
}

/* ------------------------------------------------------------------ */
/* Putzgruppen                                                         */
/* ------------------------------------------------------------------ */

/** Eine Gruppe samt ihrer Einträge schreiben – der oberste ist zuständig. */
export async function saveCleaningGroup(
  number: number,
  entries: readonly CleaningGroupEntry[],
): Promise<SaveOutcome> {
  return commit(
    setDoc(doc(db, COLLECTIONS.cleaningGroups, cleaningGroupId(number)), {
      number,
      entries: normalizedEntries(entries),
      updatedAt: serverTimestamp(),
    }),
  )
}

export async function deleteCleaningGroup(number: number): Promise<SaveOutcome> {
  const id = cleaningGroupId(number)
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.cleaningGroups, id)))
  forgetDoc(COLLECTIONS.cleaningGroups, id)
  return outcome
}

/**
 * Die ganze Einteilung ersetzen – für den Import. Gruppen, die in der neuen
 * Einteilung fehlen, fallen weg.
 */
export async function replaceCleaningGroups(
  groups: readonly { number: number; entries: readonly CleaningGroupEntry[] }[],
  existingNumbers: readonly number[],
): Promise<void> {
  requireOnline()
  const batch = writeBatch(db)
  const kept = new Set(groups.map((group) => group.number))
  for (const group of groups) {
    batch.set(doc(db, COLLECTIONS.cleaningGroups, cleaningGroupId(group.number)), {
      number: group.number,
      entries: normalizedEntries(group.entries),
      updatedAt: serverTimestamp(),
    })
  }
  const dropped = existingNumbers.filter((number) => !kept.has(number))
  for (const number of dropped) {
    batch.delete(doc(db, COLLECTIONS.cleaningGroups, cleaningGroupId(number)))
  }
  await batch.commit()
  dropped.forEach((number) => forgetDoc(COLLECTIONS.cleaningGroups, cleaningGroupId(number)))
}

/* ------------------------------------------------------------------ */
/* Einzelne Wochen                                                     */
/* ------------------------------------------------------------------ */

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
