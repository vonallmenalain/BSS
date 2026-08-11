import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from '@/lib/db'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { commit, type SaveOutcome } from '@/lib/sync'
import type { Note } from '@/lib/types'

const notesRef = collection(db, COLLECTIONS.notes)

/** Was an einer Notiz geschrieben wird – mehr gibt es nicht. */
export interface NoteInput {
  title: string
  body: string
  /**
   * Formatierung zu Titel und Text – als JSON neben dem Text, `null` heisst
   * unformatiert (siehe `lib/richtext`). Der Text bleibt das führende Feld.
   */
  titleRich?: string | null
  bodyRich?: string | null
}

/**
 * Legt eine Notiz an.
 *
 * Die ID entsteht im Client, damit sie auch ohne Netz sofort feststeht: Der
 * Editor speichert beim Tippen weiter und muss wissen, welche Notiz er meint –
 * sonst entstünde bei jedem Schreibvorgang eine zweite.
 */
export async function createNote(
  input: NoteInput,
  authorId: string | null,
): Promise<{ id: string; outcome: SaveOutcome }> {
  const ref = doc(notesRef)
  const outcome = await commit(
    setDoc(ref, {
      title: input.title.trim(),
      body: input.body,
      titleRich: input.titleRich ?? null,
      bodyRich: input.bodyRich ?? null,
      createdById: authorId,
      updatedById: authorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      editedAt: serverTimestamp(),
    }),
  )
  return { id: ref.id, outcome }
}

export async function updateNote(
  id: string,
  input: NoteInput,
  authorId: string | null,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.notes, id), {
      title: input.title.trim(),
      body: input.body,
      titleRich: input.titleRich ?? null,
      bodyRich: input.bodyRich ?? null,
      updatedById: authorId,
      updatedAt: serverTimestamp(),
      editedAt: serverTimestamp(),
    }),
  )
}

export async function deleteNote(id: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.notes, id)))
  forgetDoc(COLLECTIONS.notes, id)
  return outcome
}

/**
 * Hält eine von Hand gewählte Reihenfolge fest – die Liste in der Reihenfolge,
 * in der sie stehen soll.
 *
 * Geschrieben wird die Position **jeder** Notiz, nicht nur der verschobenen:
 * Vor dem ersten Umsortieren trägt keine eine, die Liste steht nach «zuletzt
 * bearbeitet». Erst wenn alle eine Position haben, bleibt die Reihenfolge auch
 * dann stehen, wenn jemand eine Notiz bearbeitet.
 *
 * `editedAt` und `updatedById` bleiben unangetastet: Umsortieren ist kein
 * Bearbeiten. Sonst stünde nachher überall dieselbe Zeit, und die andere
 * Ansicht hätte nichts mehr, wonach sie ordnen könnte. `updatedAt` wird
 * dagegen mitgeschrieben – daran erkennt der Abgleich beim Start, dass sich
 * am Datensatz etwas getan hat (siehe `lib/collectionStore`).
 */
export async function saveNoteOrder(notes: Note[]): Promise<SaveOutcome | null> {
  const batch = writeBatch(db)
  let changed = 0

  notes.forEach((note, index) => {
    if (note.order === index) return
    batch.update(doc(db, COLLECTIONS.notes, note.id), {
      order: index,
      updatedAt: serverTimestamp(),
    })
    changed++
  })

  if (changed === 0) return null
  return commit(batch.commit())
}
