import {
  addDoc,
  arrayRemove,
  arrayUnion,
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
import { impulseAnswerId } from '@/lib/impulse'
import type { StarterPlan } from '@/lib/impulseStarter'
import type {
  ImpulseItem,
  ImpulseKind,
  ImpulseQuiz,
  ImpulseStatus,
} from '@/lib/types'

/*
 * Der Bereich «Impuls» in Firestore (docs/KONZEPT-IMPULS.md).
 *
 * Zwei Sammlungen: die Inhalte der Redaktion (`impulseItems`) und die
 * Antworten der AP's auf Quizfragen (`impulseAnswers`). Die Inhalte tragen
 * eine eigene ID und die Woche als Feld – eine Woche kann mehrere Inhalte
 * haben (Impuls und Quizfrage), und ein Inhalt kann die Woche wechseln,
 * ohne seine Antworten zu verlieren. Die Antworten dagegen tragen Frage
 * und Konto in der ID: eine Antwort pro Person und Frage, erzwungen durch
 * den Schlüssel selbst.
 */

/**
 * Das Formular der Redaktion – flach, damit die Felder direkt an den
 * Eingaben hängen. Zusammengebaut (Quelle, Quiz) wird erst beim Speichern.
 */
export interface ImpulseItemInput {
  week: string | null
  kind: ImpulseKind
  status: ImpulseStatus
  title: string
  body: string
  sourceLabel: string
  sourceUrl: string
  /** Platz im Feed – nur für Feed-Karten von Belang. */
  order: number | null
  quiz: ImpulseQuiz
}

export const EMPTY_IMPULSE_QUIZ: ImpulseQuiz = {
  form: 'choice',
  options: ['', ''],
  answerIndex: 0,
  answerText: '',
  explanation: '',
}

/** Leeres Formular – zugleich die Vorlage für neue Inhalte. */
export function emptyImpulseItem(
  kind: ImpulseKind,
  week: string | null,
  order: number | null = null,
): ImpulseItemInput {
  return {
    week,
    kind,
    status: 'draft',
    title: '',
    body: '',
    sourceLabel: '',
    sourceUrl: '',
    order,
    quiz: { ...EMPTY_IMPULSE_QUIZ, options: [...EMPTY_IMPULSE_QUIZ.options] },
  }
}

/** Einen bestehenden Inhalt ins Formular legen. */
export function toImpulseInput(item: ImpulseItem): ImpulseItemInput {
  return {
    week: item.week ?? null,
    kind: item.kind,
    status: item.status,
    title: item.title ?? '',
    body: item.body ?? '',
    sourceLabel: item.source?.label ?? '',
    sourceUrl: item.source?.url ?? '',
    order: typeof item.order === 'number' ? item.order : null,
    quiz: item.quiz
      ? { ...item.quiz, options: [...item.quiz.options] }
      : { ...EMPTY_IMPULSE_QUIZ, options: [...EMPTY_IMPULSE_QUIZ.options] },
  }
}

/** Anlegen oder ändern. Ohne `id` entsteht ein neuer Inhalt. */
export async function saveImpulseItem(
  id: string | null,
  input: ImpulseItemInput,
  userId?: string | null,
): Promise<SaveOutcome> {
  const sourceLabel = input.sourceLabel.trim()
  const data = {
    week: input.week,
    kind: input.kind,
    status: input.status,
    title: input.title.trim(),
    body: input.body.trim(),
    order: typeof input.order === 'number' && Number.isFinite(input.order) ? input.order : null,
    source: sourceLabel ? { label: sourceLabel, url: input.sourceUrl.trim() } : null,
    // Das Quiz bleibt am Datensatz, auch wenn die Art wechselt – wie beim
    // variablen Layout wirft das Umschalten nichts weg.
    quiz:
      input.kind === 'quiz'
        ? {
            form: input.quiz.form,
            options: input.quiz.options.map((option) => option.trim()),
            answerIndex: input.quiz.answerIndex,
            answerText: input.quiz.answerText.trim(),
            explanation: input.quiz.explanation.trim(),
          }
        : null,
    updatedAt: serverTimestamp(),
  }

  if (id) return commit(updateDoc(doc(db, COLLECTIONS.impulseItems, id), data))

  return commit(
    addDoc(collection(db, COLLECTIONS.impulseItems), {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: userId ?? null,
    }),
  )
}

/**
 * Einen Inhalt entfernen – mitsamt seinen Antworten.
 *
 * Die Antworten kommen vom Aufrufer: Der hat den Bestand ohnehin abonniert,
 * und so funktioniert das Löschen auch ohne Verbindung. Eine verwaiste
 * Antwort wäre kein Schaden, nur Unordnung.
 */
export async function deleteImpulseItem(
  id: string,
  answerIds: string[] = [],
): Promise<SaveOutcome> {
  const outcome = await commit(
    Promise.all([
      deleteDoc(doc(db, COLLECTIONS.impulseItems, id)),
      ...answerIds.map((answerId) => deleteDoc(doc(db, COLLECTIONS.impulseAnswers, answerId))),
    ]),
  )
  forgetDoc(COLLECTIONS.impulseItems, id)
  for (const answerId of answerIds) forgetDoc(COLLECTIONS.impulseAnswers, answerId)
  return outcome
}

/**
 * Das Wochenziel abhaken – oder den Haken zurücknehmen.
 *
 * Selbstauskunft, gespeichert am eigenen Fortschrittsdokument (die UID
 * ist die Dokument-ID, die Regeln lassen niemanden für andere abhaken).
 * Der Vorname wird mitgeschrieben, damit die Gruppenleiste Namen zeigen
 * kann, ohne fremde Profile zu lesen.
 */
export async function setImpulseWeekGoal(
  user: { uid: string; displayName: string },
  week: string,
  done: boolean,
): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        weeks: { [week]: { goal: done } },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/** Einen Tag der Tages-Challenge abhaken – oder den Haken zurücknehmen. */
export async function setImpulseChallengeDay(
  user: { uid: string; displayName: string },
  week: string,
  day: string,
  checked: boolean,
): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        weeks: { [week]: { days: checked ? arrayUnion(day) : arrayRemove(day) } },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/** Die Schlusskarte erreicht: Der Feed der Woche ist durchgetippt. */
export async function markImpulseFeedDone(
  user: { uid: string; displayName: string },
  week: string,
): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        weeks: { [week]: { feed: true } },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/**
 * «Amen» zu einer Karte – oder das Amen zurücknehmen.
 *
 * Gespeichert am eigenen Fortschrittsdokument, nicht am Inhalt: Inhalte
 * schreibt nur die Redaktion, und so bleibt die Reaktion dort, wo alles
 * Persönliche liegt. Dasselbe gilt fürs Merken.
 */
export async function setImpulseAmen(
  user: { uid: string; displayName: string },
  itemId: string,
  on: boolean,
): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        amens: on ? arrayUnion(itemId) : arrayRemove(itemId),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/** Eine Karte merken – oder aus der Favoritensammlung nehmen. */
export async function setImpulseFavorite(
  user: { uid: string; displayName: string },
  itemId: string,
  on: boolean,
): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        favorites: on ? arrayUnion(itemId) : arrayRemove(itemId),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/**
 * Das Startpaket anlegen – vier Wochen Inhalt in einem Zug.
 *
 * Die festen Dokument-IDs («starter-w1-impuls» …) machen den Lauf
 * gefahrlos: Ein zweiter würde dieselben Dokumente treffen statt Dubletten
 * anzulegen – und die Redaktion blendet den Knopf ohnehin aus, sobald das
 * Paket einmal da ist.
 */
export async function createStarterItems(
  plans: StarterPlan[],
  userId?: string | null,
): Promise<SaveOutcome> {
  const batch = writeBatch(db)
  for (const plan of plans) {
    const { id, ...data } = plan
    batch.set(doc(db, COLLECTIONS.impulseItems, id), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId ?? null,
    })
  }
  return commit(batch.commit())
}

/**
 * Eine Quizfrage beantworten – ein Versuch, auf den eigenen Namen.
 *
 * Richtig oder falsch wird bei der Auswahl gleich hier bestimmt; die
 * Suchfrage bleibt unbewertet (`correct: null`), es zählt die Teilnahme.
 * Der Vorname wird mitgeschrieben, damit die Antwort lesbar bleibt, auch
 * wenn das Konto später verschwindet – die AP's können keine fremden
 * Profile nachschlagen.
 */
/** Der Vorname – mehr braucht der Bereich nicht von einem Namen. */
function impulseFirstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName
}

export async function answerImpulseQuiz(
  item: ImpulseItem,
  user: { uid: string; displayName: string },
  reply: { choiceIndex?: number; text?: string },
): Promise<SaveOutcome> {
  const quiz = item.quiz
  const correct =
    quiz && quiz.form === 'choice' && typeof reply.choiceIndex === 'number'
      ? reply.choiceIndex === quiz.answerIndex
      : null

  const firstName = impulseFirstName(user.displayName)

  return commit(
    setDoc(doc(db, COLLECTIONS.impulseAnswers, impulseAnswerId(item.id, user.uid)), {
      itemId: item.id,
      uid: user.uid,
      firstName,
      choiceIndex: typeof reply.choiceIndex === 'number' ? reply.choiceIndex : null,
      text: reply.text?.trim() ?? '',
      correct,
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}
