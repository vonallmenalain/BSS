import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { commit, type SaveOutcome } from '@/lib/sync'

const notesRef = collection(db, COLLECTIONS.notes)

/** Was an einer Notiz geschrieben wird – mehr gibt es nicht. */
export interface NoteInput {
  title: string
  body: string
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
      createdById: authorId,
      updatedById: authorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
      updatedById: authorId,
      updatedAt: serverTimestamp(),
    }),
  )
}

export async function deleteNote(id: string): Promise<SaveOutcome> {
  return commit(deleteDoc(doc(db, COLLECTIONS.notes, id)))
}
