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
// Am Protokoll vorbei – warum, steht bei `setImpulseLastSeenWeek`.
import { setDoc as fbSetDoc } from 'firebase/firestore'
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
  ImpulseSubmission,
  ImpulseSubmissionKind,
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
  /** Die Vertiefung – erscheint im Feed beim Wisch nach links. */
  deepening: string
  sourceLabel: string
  sourceUrl: string
  /** Das Bild des Bilderrätsels – ein Link in die Mediathek der Kirche. */
  imageUrl: string
  imageAlt: string
  /** Platz innerhalb der Art – für Feed, Quizfrage und Bilderrätsel. */
  order: number | null
  /** «Eingereicht von Luca» – wenn der Inhalt aus der Mitmach-Ecke stammt. */
  contributor: string
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
    deepening: '',
    sourceLabel: '',
    sourceUrl: '',
    imageUrl: '',
    imageAlt: '',
    order,
    contributor: '',
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
    deepening: item.deepening ?? '',
    sourceLabel: item.source?.label ?? '',
    sourceUrl: item.source?.url ?? '',
    imageUrl: item.image?.url ?? '',
    imageAlt: item.image?.alt ?? '',
    order: typeof item.order === 'number' ? item.order : null,
    contributor: item.contributor ?? '',
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
  const imageUrl = input.imageUrl.trim()
  const data = {
    week: input.week,
    kind: input.kind,
    status: input.status,
    title: input.title.trim(),
    body: input.body.trim(),
    deepening: input.deepening.trim() || null,
    order: typeof input.order === 'number' && Number.isFinite(input.order) ? input.order : null,
    contributor: input.contributor.trim() || null,
    source: sourceLabel ? { label: sourceLabel, url: input.sourceUrl.trim() } : null,
    // Das Bild gehört zum Bilderrätsel; andere Arten speichern keines.
    image:
      input.kind === 'bilderraetsel' && imageUrl
        ? { url: imageUrl, alt: input.imageAlt.trim() }
        : null,
    // Das Quiz bleibt am Datensatz, auch wenn die Art wechselt – wie beim
    // variablen Layout wirft das Umschalten nichts weg. Das Bilderrätsel
    // nutzt dieselbe Mechanik: Frage, Antworten, Auflösung.
    quiz:
      input.kind === 'quiz' || input.kind === 'bilderraetsel'
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
 * Einen Inhalt entfernen – mitsamt seinen Antworten und Beiträgen.
 *
 * Beides kommt vom Aufrufer: Der hat den Bestand ohnehin abonniert, und so
 * funktioniert das Löschen auch ohne Verbindung. Ein verwaister Rest wäre
 * kein Schaden, nur Unordnung.
 */
export async function deleteImpulseItem(
  id: string,
  answerIds: string[] = [],
  commentIds: string[] = [],
): Promise<SaveOutcome> {
  const outcome = await commit(
    Promise.all([
      deleteDoc(doc(db, COLLECTIONS.impulseItems, id)),
      ...answerIds.map((answerId) => deleteDoc(doc(db, COLLECTIONS.impulseAnswers, answerId))),
      ...commentIds.map((commentId) =>
        deleteDoc(doc(db, COLLECTIONS.impulseComments, commentId)),
      ),
    ]),
  )
  forgetDoc(COLLECTIONS.impulseItems, id)
  for (const answerId of answerIds) forgetDoc(COLLECTIONS.impulseAnswers, answerId)
  for (const commentId of commentIds) forgetDoc(COLLECTIONS.impulseComments, commentId)
  return outcome
}

/**
 * Die eigene Antwort zur Frage der Woche – anlegen oder nachbessern.
 *
 * Dieselbe Dokument-ID wie bei den Quizantworten: eine pro Person und
 * Frage. Anders als dort ist Nachbessern erlaubt – ein persönliches Wort
 * darf reifen.
 */
export async function saveImpulseComment(
  item: ImpulseItem,
  user: { uid: string; displayName: string },
  text: string,
  isNew: boolean,
): Promise<SaveOutcome> {
  const ref = doc(db, COLLECTIONS.impulseComments, impulseAnswerId(item.id, user.uid))
  if (!isNew) {
    return commit(updateDoc(ref, { text: text.trim(), updatedAt: serverTimestamp() }))
  }
  return commit(
    setDoc(ref, {
      itemId: item.id,
      uid: user.uid,
      firstName: impulseFirstName(user.displayName),
      text: text.trim(),
      hidden: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}

/** Moderation: einen Beitrag ausblenden – oder wieder zeigen. */
export async function setImpulseCommentHidden(
  commentId: string,
  hidden: boolean,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.impulseComments, commentId), {
      hidden,
      updatedAt: serverTimestamp(),
    }),
  )
}

/** Einen Beitrag melden – oder die Meldung zurücknehmen. */
export async function setImpulseReport(
  user: { uid: string; displayName: string },
  commentId: string,
  on: boolean,
): Promise<SaveOutcome> {
  return commit(
    setDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        reports: on ? arrayUnion(commentId) : arrayRemove(commentId),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
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

/**
 * Die Teilen-Aufgabe abhaken – oder den Haken zurücknehmen.
 *
 * Dieselbe Selbstauskunft wie beim Wochenziel: Wer das Gespräch mit
 * Familie oder Freunden geführt hat, hakt es selbst ab – niemand prüft
 * nach, und der Haken zählt als Beteiligung der Woche.
 */
export async function setImpulseWeekShare(
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
        weeks: { [week]: { share: done } },
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
 * Eine Einreichung für die Mitmach-Ecke – formlos, die Redaktion bringt
 * sie in Form. Angelegt wird immer als «offen»; die Regeln lassen nichts
 * anderes zu.
 */
export async function createImpulseSubmission(
  user: { uid: string; displayName: string },
  input: { kind: ImpulseSubmissionKind; text: string; sourceLabel: string; sourceUrl: string },
): Promise<SaveOutcome> {
  return commit(
    addDoc(collection(db, COLLECTIONS.impulseSubmissions), {
      uid: user.uid,
      firstName: impulseFirstName(user.displayName),
      kind: input.kind,
      text: input.text.trim(),
      sourceLabel: input.sourceLabel.trim(),
      sourceUrl: input.sourceUrl.trim(),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}

/** Eine Einreichung zurückziehen bzw. wegräumen. */
export async function deleteImpulseSubmission(id: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.impulseSubmissions, id)))
  forgetDoc(COLLECTIONS.impulseSubmissions, id)
  return outcome
}

/** Die Redaktion hat übernommen – die Einreichung ist «accepted». */
export async function markImpulseSubmissionAccepted(id: string): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.impulseSubmissions, id), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Aus einer Einreichung das Redaktionsformular vorbefüllen.
 *
 * Ein «Gedanke» wird zur Feed-Karte, eine «Quizfrage-Idee» zur Quizfrage
 * (die Redaktion ergänzt Antworten und Lösung). Beides landet als Entwurf
 * im Fragenpool – geplant wird wie gewohnt, und der Vorname wandert als
 * «Eingereicht von …» mit.
 */
export function submissionToInput(submission: ImpulseSubmission): ImpulseItemInput {
  const input = emptyImpulseItem(submission.kind === 'frage' ? 'quiz' : 'feed', null)
  input.title = submission.text.trim()
  input.sourceLabel = submission.sourceLabel?.trim() ?? ''
  input.sourceUrl = submission.sourceUrl?.trim() ?? ''
  input.contributor = submission.firstName
  return input
}

/**
 * Die zuletzt angeschaute Woche vermerken – daran hängt der stille Punkt
 * am Navigationseintrag.
 *
 * Wie `saveApView` geht dieser eine Schreibvorgang **nicht** ins
 * Zugriffsprotokoll: Wer den Bereich öffnet, ändert nichts am Bestand der
 * Gemeinde – im Protokoll stünde sonst eine Zeile je Besuch und begrübe
 * die Änderungen, wegen derer man es aufschlägt.
 */
export async function setImpulseLastSeenWeek(
  user: { uid: string; displayName: string },
  week: string,
): Promise<SaveOutcome> {
  return commit(
    fbSetDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        lastSeenWeek: week,
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
