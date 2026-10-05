import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from '@/lib/db'
// Am Protokoll vorbei – warum, steht bei `setImpulseLastSeenWeek`.
import { setDoc as fbSetDoc, writeBatch as fbWriteBatch } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { commit, requireOnline, type SaveOutcome } from '@/lib/sync'
import { impulseAnswerId, impulseFirstName, quizAnswerCorrect } from '@/lib/impulse'
import { cleanGameName, cleanGameScore } from '@/lib/impulseGame'
import type { PackPlan } from '@/lib/impulsePack'
import type {
  ImpulseCrestPalette,
  ImpulseCrestSymbol,
  ImpulseGameId,
  ImpulseImageCrop,
  ImpulseItem,
  ImpulseKind,
  ImpulsePoll,
  ImpulseQuiz,
  ImpulseStatus,
  ImpulseSubmission,
} from '@/lib/types'

/*
 * Der Bereich «Anti Doom» in Firestore (docs/KONZEPT-IMPULS.md).
 *
 * Zwei Sammlungen: die Inhalte der Redaktion (`impulseItems`) und die
 * Antworten der AP's auf Quizfragen (`impulseAnswers`). Die Inhalte tragen
 * eine eigene ID und die Woche als Feld – eine Woche kann mehrere Inhalte
 * haben (Wochenthema und Quizfrage), und ein Inhalt kann die Woche wechseln,
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
  /** Eigener Titel der Vertiefung – leer heisst: der der Hauptkarte. */
  deepeningTitle: string
  /** Eigene Quelle der Vertiefung – leer heisst: die der Hauptkarte. */
  deepeningSourceLabel: string
  deepeningSourceUrl: string
  sourceLabel: string
  sourceUrl: string
  /** Das Bild der Karte – ein Link in die Mediathek der Kirche. */
  imageUrl: string
  imageAlt: string
  /** Der gewählte Ausschnitt des Bildes – `null` heisst: das ganze Bild. */
  imageCrop: ImpulseImageCrop | null
  /** Der Videolink der Video-Karte (YouTube, Vimeo oder eine Videodatei). */
  videoUrl: string
  /** Zwei Wische statt einem: der Text über dem Video (nur Video-Karten). */
  videoTextPage: boolean
  /** Platz innerhalb der Art – für Feed, Quizfrage und Bilderrätsel. */
  order: number | null
  /** «Eingereicht von Luca» – wenn der Inhalt aus der Mitmach-Ecke stammt. */
  contributor: string
  quiz: ImpulseQuiz
  /** Die Umfrage – bei der Art `umfrage`. */
  poll: ImpulsePoll
  /** Das Vers-Puzzle: der Vers mit « / » zwischen den Teilen, und die Auflösung. */
  puzzleText: string
  puzzleExplanation: string
  /** Ein grosses Emoji über dem Titel – leer heisst keines. */
  emoji: string
  /** Wochenthema: die Zeile über dem Titel (Monatsthema). */
  kicker: string
  /** Wochenthema: die Lektion am Sonntag, auf die die Woche vorbereitet. */
  lessonLabel: string
  lessonUrl: string
  /** Wochenthema: wie das Wochen-Wappen aussieht – leeres Zeichen heisst: Standard. */
  crestSymbol: ImpulseCrestSymbol | ''
  crestPalette: ImpulseCrestPalette
  crestMotto: string
  /** Minispiel: welches Spiel die Karte spielt. */
  game: ImpulseGameId
}

export const EMPTY_IMPULSE_QUIZ: ImpulseQuiz = {
  form: 'choice',
  options: ['', ''],
  answerIndex: 0,
  answerText: '',
  explanation: '',
}

export const EMPTY_IMPULSE_POLL: ImpulsePoll = {
  form: 'choice',
  options: ['', ''],
  min: 1,
  max: 10,
  minLabel: '',
  maxLabel: '',
  unit: '',
  explanation: '',
}

/** Eine frische Kopie – die Vorlage selbst darf nie im Formular landen. */
function freshPoll(poll: ImpulsePoll = EMPTY_IMPULSE_POLL): ImpulsePoll {
  return { ...EMPTY_IMPULSE_POLL, ...poll, options: [...poll.options] }
}

/** Die Umfrage so, wie sie gespeichert wird – getrimmt, Zahlen ganz. */
function cleanPoll(poll: ImpulsePoll): ImpulsePoll {
  return {
    form: poll.form,
    options: poll.form === 'choice' ? poll.options.map((option) => option.trim()) : [],
    min: Math.round(Number(poll.min)),
    max: Math.round(Number(poll.max)),
    minLabel: poll.minLabel.trim(),
    maxLabel: poll.maxLabel.trim(),
    unit: poll.unit.trim(),
    explanation: poll.explanation.trim(),
  }
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
    deepeningTitle: '',
    deepeningSourceLabel: '',
    deepeningSourceUrl: '',
    sourceLabel: '',
    sourceUrl: '',
    imageUrl: '',
    imageAlt: '',
    imageCrop: null,
    videoUrl: '',
    videoTextPage: false,
    order,
    contributor: '',
    quiz: { ...EMPTY_IMPULSE_QUIZ, options: [...EMPTY_IMPULSE_QUIZ.options] },
    poll: freshPoll(),
    puzzleText: '',
    puzzleExplanation: '',
    emoji: '',
    kicker: '',
    lessonLabel: '',
    lessonUrl: '',
    crestSymbol: '',
    crestPalette: 'smaragd',
    crestMotto: '',
    game: 'sortieren',
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
    deepeningTitle: item.deepeningTitle ?? '',
    deepeningSourceLabel: item.deepeningSource?.label ?? '',
    deepeningSourceUrl: item.deepeningSource?.url ?? '',
    sourceLabel: item.source?.label ?? '',
    sourceUrl: item.source?.url ?? '',
    imageUrl: item.image?.url ?? '',
    imageAlt: item.image?.alt ?? '',
    imageCrop: item.image?.crop ?? null,
    videoUrl: item.videoUrl ?? '',
    videoTextPage: item.videoTextPage ?? false,
    order: typeof item.order === 'number' ? item.order : null,
    contributor: item.contributor ?? '',
    quiz: item.quiz
      ? { ...item.quiz, options: [...item.quiz.options] }
      : { ...EMPTY_IMPULSE_QUIZ, options: [...EMPTY_IMPULSE_QUIZ.options] },
    poll: freshPoll(item.poll ?? undefined),
    puzzleText: item.puzzle?.text ?? '',
    puzzleExplanation: item.puzzle?.explanation ?? '',
    emoji: item.emoji ?? '',
    kicker: item.kicker ?? '',
    lessonLabel: item.lesson?.label ?? '',
    lessonUrl: item.lesson?.url ?? '',
    crestSymbol: item.crest?.symbol ?? '',
    crestPalette: item.crest?.palette ?? 'smaragd',
    crestMotto: item.crest?.motto ?? '',
    game: item.game ?? 'sortieren',
  }
}

/** Anlegen oder ändern. Ohne `id` entsteht ein neuer Inhalt. */
export async function saveImpulseItem(
  id: string | null,
  input: ImpulseItemInput,
  userId?: string | null,
): Promise<SaveOutcome> {
  const sourceLabel = input.sourceLabel.trim()
  const deepeningSourceLabel = input.deepeningSourceLabel.trim()
  const imageUrl = input.imageUrl.trim()
  const data = {
    week: input.week,
    kind: input.kind,
    status: input.status,
    title: input.title.trim(),
    body: input.body.trim(),
    deepening: input.deepening.trim() || null,
    deepeningTitle: input.deepeningTitle.trim() || null,
    deepeningSource: deepeningSourceLabel
      ? { label: deepeningSourceLabel, url: input.deepeningSourceUrl.trim() }
      : null,
    order: typeof input.order === 'number' && Number.isFinite(input.order) ? input.order : null,
    contributor: input.contributor.trim() || null,
    source: sourceLabel ? { label: sourceLabel, url: input.sourceUrl.trim() } : null,
    /* Ein Bild darf jede Karte tragen – beim Bilderrätsel ist es das
       Rätsel, beim Video das Vorschaubild, sonst das Bild zum Thema. */
    image: imageUrl
      ? { url: imageUrl, alt: input.imageAlt.trim(), crop: input.imageCrop ?? null }
      : null,
    // Das Video gehört zur Video-Karte; andere Arten speichern keines.
    videoUrl: input.kind === 'video' ? input.videoUrl.trim() || null : null,
    videoTextPage: input.kind === 'video' ? input.videoTextPage : null,
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
    // Umfrage und Puzzle gehören zu ihrer Art – wie das Quiz.
    poll: input.kind === 'umfrage' ? cleanPoll(input.poll) : null,
    puzzle:
      input.kind === 'puzzle'
        ? { text: input.puzzleText.trim(), explanation: input.puzzleExplanation.trim() }
        : null,
    emoji: input.emoji.trim() || null,
    // Monatsthema, Sonntagslektion und Wappen trägt das Wochenthema.
    kicker: input.kind === 'impuls' ? input.kicker.trim() || null : null,
    lesson:
      input.kind === 'impuls' && input.lessonLabel.trim()
        ? { label: input.lessonLabel.trim(), url: input.lessonUrl.trim() }
        : null,
    crest:
      input.kind === 'impuls' && input.crestSymbol
        ? {
            symbol: input.crestSymbol,
            palette: input.crestPalette,
            motto: input.crestMotto.trim(),
          }
        : null,
    // Das Spiel gehört zum Minispiel.
    game: input.kind === 'spiel' ? input.game : null,
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
 * Einen Inhalt entfernen – mitsamt seinen Antworten, Beiträgen und, beim
 * Minispiel, seiner Rangliste.
 *
 * Alles kommt vom Aufrufer: Der hat den Bestand ohnehin abonniert, und so
 * funktioniert das Löschen auch ohne Verbindung. Ein verwaister Rest wäre
 * kein Schaden, nur Unordnung.
 */
export async function deleteImpulseItem(
  id: string,
  answerIds: string[] = [],
  commentIds: string[] = [],
  scoreIds: string[] = [],
): Promise<SaveOutcome> {
  const outcome = await commit(
    Promise.all([
      deleteDoc(doc(db, COLLECTIONS.impulseItems, id)),
      ...answerIds.map((answerId) => deleteDoc(doc(db, COLLECTIONS.impulseAnswers, answerId))),
      ...commentIds.map((commentId) =>
        deleteDoc(doc(db, COLLECTIONS.impulseComments, commentId)),
      ),
      ...scoreIds.map((scoreId) => deleteDoc(doc(db, COLLECTIONS.impulseGameScores, scoreId))),
    ]),
  )
  forgetDoc(COLLECTIONS.impulseItems, id)
  for (const answerId of answerIds) forgetDoc(COLLECTIONS.impulseAnswers, answerId)
  for (const commentId of commentIds) forgetDoc(COLLECTIONS.impulseComments, commentId)
  for (const scoreId of scoreIds) forgetDoc(COLLECTIONS.impulseGameScores, scoreId)
  return outcome
}

/**
 * Die eigene Antwort zur Frage der Woche – anlegen oder nachbessern.
 *
 * Dieselbe Dokument-ID wie bei den Quizantworten: eine pro Person und
 * Frage. Anders als dort ist Nachbessern erlaubt – ein persönliches Wort
 * darf reifen.
 *
 * `anonymous`: ohne Namen. Dann steht der Vorname gar nicht erst im
 * Beitrag, und die anderen sehen «Anonym»; die Wahl lässt sich beim
 * Nachbessern ändern.
 */
export async function saveImpulseComment(
  item: ImpulseItem,
  user: { uid: string; displayName: string },
  text: string,
  isNew: boolean,
  anonymous = false,
): Promise<SaveOutcome> {
  const ref = doc(db, COLLECTIONS.impulseComments, impulseAnswerId(item.id, user.uid))
  const author = { firstName: anonymous ? '' : impulseFirstName(user.displayName), anonymous }
  if (!isNew) {
    return commit(updateDoc(ref, { text: text.trim(), ...author, updatedAt: serverTimestamp() }))
  }
  return commit(
    setDoc(ref, {
      itemId: item.id,
      uid: user.uid,
      ...author,
      text: text.trim(),
      hidden: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Den Start einer Woche verschieben – am Wochenthema (`startsAt`). Früher,
 * damit das neue Thema schon am Sonntagabend da ist, oder später; `null`
 * setzt ihn auf Montag, 00:00, zurück. Was die Jugendlichen daraus sehen,
 * rechnet `impulseCurrentWeek`.
 */
export async function setImpulseWeekStart(
  themeId: string,
  week: string,
  startsAt: Date | null,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.impulseItems, themeId), {
      // Mit der Woche, für die er gilt – wandert das Thema, wirkt er nicht mit.
      startsAt: startsAt ? { week, at: Timestamp.fromDate(startsAt) } : deleteField(),
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
 * Eine Einreichung für die Mitmach-Ecke – die fixfertige Karte.
 *
 * Eingereicht wird mit denselben Feldern wie in der Redaktion
 * (`ImpulseItemFields`); der Titel wandert nach `text` (die Zeile in den
 * Listen), alles Übrige nach `card`. Angelegt wird immer als «offen»;
 * die Regeln lassen nichts anderes zu – veröffentlicht wird erst, wenn
 * die Redaktion daraus einen Inhalt macht.
 */
export async function createImpulseSubmission(
  user: { uid: string; displayName: string },
  input: ImpulseItemInput,
  /** Ohne Namen veröffentlichen – die Karte trägt dann kein «Eingereicht von …». */
  anonymous = false,
): Promise<SaveOutcome> {
  return commit(
    addDoc(collection(db, COLLECTIONS.impulseSubmissions), {
      uid: user.uid,
      firstName: impulseFirstName(user.displayName),
      anonymous,
      kind: input.kind,
      text: input.title.trim(),
      sourceLabel: input.sourceLabel.trim(),
      sourceUrl: input.sourceUrl.trim(),
      card: submissionCard(input),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}

/** Die Kartenfelder einer Einreichung, aus dem Formular gelesen. */
export function submissionCard(input: ImpulseItemInput) {
  return {
    body: input.body.trim(),
    deepening: input.deepening.trim(),
    deepeningTitle: input.deepeningTitle.trim(),
    deepeningSourceLabel: input.deepeningSourceLabel.trim(),
    deepeningSourceUrl: input.deepeningSourceUrl.trim(),
    imageUrl: input.imageUrl.trim(),
    imageAlt: input.imageAlt.trim(),
    imageCrop: input.imageCrop ?? null,
    videoUrl: input.kind === 'video' ? input.videoUrl.trim() : '',
    videoTextPage: input.kind === 'video' ? input.videoTextPage : false,
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
    poll: input.kind === 'umfrage' ? cleanPoll(input.poll) : null,
    puzzle:
      input.kind === 'puzzle'
        ? { text: input.puzzleText.trim(), explanation: input.puzzleExplanation.trim() }
        : null,
    emoji: input.emoji.trim(),
  }
}

/**
 * Die eigene Einreichung nachbessern – solange sie offen ist.
 *
 * Dieselben Felder wie beim Anlegen; Konto und Zustand bleiben
 * unangetastet (die Regeln bestehen darauf). Auch die Redaktion nutzt
 * diesen Weg nicht – sie übernimmt in einen Inhalt, statt an der
 * Einreichung zu schrauben.
 */
export async function updateImpulseSubmission(
  id: string,
  input: ImpulseItemInput,
  anonymous = false,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.impulseSubmissions, id), {
      anonymous,
      kind: input.kind,
      text: input.title.trim(),
      sourceLabel: input.sourceLabel.trim(),
      sourceUrl: input.sourceUrl.trim(),
      card: submissionCard(input),
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Eine Einreichung als Karte, wie sie später aussehen würde – für die
 * echte Vorschau (`ImpulseEditorPreview`), ohne dass je ein Inhalt
 * entsteht. Die ID trägt ein Präfix, damit sie mit keiner echten
 * Inhalts-ID zusammenfällt; Amen und Merken laufen in der Vorschau
 * ohnehin nur im Fenster.
 */
export function submissionToItem(submission: ImpulseSubmission): ImpulseItem {
  const kind: ImpulseKind = submission.kind === 'gedanke' ? 'feed' : submission.kind
  const card = submission.card
  const sourceLabel = submission.sourceLabel?.trim() ?? ''
  const deepeningSourceLabel = card?.deepeningSourceLabel?.trim() ?? ''
  return {
    id: `einreichung-${submission.id}`,
    week: null,
    kind,
    status: 'ready',
    title: submission.text,
    body: card?.body || undefined,
    deepening: card?.deepening || null,
    deepeningTitle: card?.deepeningTitle || null,
    deepeningSource: deepeningSourceLabel
      ? { label: deepeningSourceLabel, url: card?.deepeningSourceUrl?.trim() ?? '' }
      : null,
    source: sourceLabel ? { label: sourceLabel, url: submission.sourceUrl?.trim() ?? '' } : null,
    image: card?.imageUrl
      ? { url: card.imageUrl, alt: card.imageAlt ?? '', crop: card.imageCrop ?? null }
      : null,
    videoUrl: card?.videoUrl?.trim() || null,
    videoTextPage: card?.videoTextPage ?? false,
    quiz: card?.quiz ?? null,
    poll: card?.poll ?? null,
    puzzle: card?.puzzle ?? null,
    emoji: card?.emoji?.trim() || null,
    contributor: submission.anonymous ? null : submission.firstName,
  }
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
 * Neue Einreichungen bringen die fixfertige Karte mit (`card`) – das
 * Formular öffnet vollständig vorbefüllt, mitsamt Quiz und Bild; die
 * Redaktion prüft, wählt die Woche und hakt «bereit» an. Alte
 * Freitext-Einreichungen (ohne `card`) öffnen wie bisher mit Titel und
 * Quelle, und der «Gedanke» aus der ersten Fassung wird zur Feed-Karte.
 * `week` sagt, wo die Karte landen soll – die Redaktion übergibt die
 * gerade angezeigte Woche; im Formular bleibt sie wählbar. Der Vorname
 * wandert als «Eingereicht von …» mit.
 */
export function submissionToInput(
  submission: ImpulseSubmission,
  week: string | null = null,
): ImpulseItemInput {
  const kind: ImpulseKind = submission.kind === 'gedanke' ? 'feed' : submission.kind
  const input = emptyImpulseItem(kind, week)
  input.title = submission.text.trim()
  input.sourceLabel = submission.sourceLabel?.trim() ?? ''
  input.sourceUrl = submission.sourceUrl?.trim() ?? ''
  // Wer ohne Namen einreicht, steht auch auf der fertigen Karte nicht.
  input.contributor = submission.anonymous ? '' : submission.firstName
  const card = submission.card
  if (card) {
    input.body = card.body ?? ''
    input.deepening = card.deepening ?? ''
    input.deepeningTitle = card.deepeningTitle ?? ''
    input.deepeningSourceLabel = card.deepeningSourceLabel ?? ''
    input.deepeningSourceUrl = card.deepeningSourceUrl ?? ''
    input.imageUrl = card.imageUrl ?? ''
    input.imageAlt = card.imageAlt ?? ''
    input.imageCrop = card.imageCrop ?? null
    input.videoUrl = card.videoUrl ?? ''
    input.videoTextPage = card.videoTextPage ?? false
    if (card.quiz) input.quiz = { ...card.quiz, options: [...card.quiz.options] }
    if (card.poll) input.poll = freshPoll(card.poll)
    if (card.puzzle) {
      input.puzzleText = card.puzzle.text ?? ''
      input.puzzleExplanation = card.puzzle.explanation ?? ''
    }
    input.emoji = card.emoji ?? ''
  }
  return input
}

/**
 * Eine Karte des Feeds als angeschaut vermerken – für den Meilenstein
 * «Anti Doom Scroller» (alle Karten samt Vertiefungen gesehen).
 *
 * Wie `setImpulseLastSeenWeek` geht das Anschauen **nicht** ins
 * Zugriffsprotokoll: Wer durch den Feed tippt, ändert nichts am Bestand –
 * im Protokoll stünde sonst eine Zeile je Karte. Die Seite ruft nur für
 * noch nicht vermerkte Karten an (ein Vermerk je Karte und Besuch).
 */
export async function markImpulseCardSeen(
  user: { uid: string; displayName: string },
  week: string,
  itemId: string,
): Promise<SaveOutcome> {
  return commit(
    fbSetDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        weeks: { [week]: { cards: arrayUnion(itemId) } },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/** Die Vertiefung einer Karte als angeschaut vermerken – gleiche Regeln. */
export async function markImpulseDeepeningSeen(
  user: { uid: string; displayName: string },
  week: string,
  itemId: string,
): Promise<SaveOutcome> {
  return commit(
    fbSetDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        weeks: { [week]: { deepened: arrayUnion(itemId) } },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
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
  /** Nur beim ersten Mal: die Woche, mit der der Verlauf beginnt (`firstSeenWeek`). */
  firstSeenWeek?: string,
): Promise<SaveOutcome> {
  return commit(
    fbSetDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        lastSeenWeek: week,
        ...(firstSeenWeek ? { firstSeenWeek } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/** Wie viele Schreibvorgänge ein Stapel höchstens trägt – Firestore erlaubt 500. */
const BATCH_LIMIT = 450

/** Eine Liste in Häppchen, die je in einen Stapel passen. */
function chunks<T>(list: T[], size = BATCH_LIMIT): T[][] {
  const result: T[][] = []
  for (let index = 0; index < list.length; index += size) result.push(list.slice(index, index + size))
  return result
}

/** Die Inhalte eines Pakets als Stapel – feste IDs, ein zweiter Lauf trifft dieselben Dokumente. */
function planBatches(plans: PackPlan[], userId?: string | null): WriteBatch[] {
  return chunks(plans).map((part) => {
    const batch = writeBatch(db)
    for (const plan of part) {
      const { id, ...data } = plan
      batch.set(doc(db, COLLECTIONS.impulseItems, id), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId ?? null,
      })
    }
    return batch
  })
}

/**
 * Stapel der Reihe nach schreiben – jeder erst, wenn der Server den
 * vorigen bestätigt hat, wie bei den Importen.
 *
 * Reisst die Verbindung mittendrin ab, liegt so höchstens ein Anfang der
 * Folge in der Warteschlange, nie ein späterer Stapel ohne die früheren;
 * lehnt der Server einen Stapel ab, gehen die folgenden gar nicht erst
 * hinaus. Die Reihenfolge der Stapel trägt damit die Sicherheit.
 */
async function commitInOrder(batches: WriteBatch[]): Promise<void> {
  for (const batch of batches) await batch.commit()
}

/**
 * Das Themenpaket einspielen – die geplanten Wochen in einem Zug.
 *
 * Die festen Dokument-IDs («fsy26-w41-umfrage-1» …) machen den Lauf
 * gefahrlos: Ein zweiter würde dieselben Dokumente treffen statt
 * Dubletten anzulegen – und die Redaktion blendet den Knopf ohnehin
 * aus, sobald das Paket ganz da ist. Darum darf `commit()` hier nach
 * zwei Sekunden «zwischengespeichert» melden: Ginge ein späterer Stapel
 * verloren, holt der nächste Lauf nach, was fehlt.
 */
export async function createPackItems(
  plans: PackPlan[],
  userId?: string | null,
): Promise<SaveOutcome> {
  requireOnline()
  return commit(commitInOrder(planBatches(plans, userId)))
}

/**
 * Neu starten: alle bisherigen Inhalte löschen – mitsamt ihren Antworten,
 * Beiträgen und Ranglisten – und das Themenpaket einspielen.
 *
 * Das ist der eine Handgriff, der nicht rückgängig zu machen ist; die
 * Redaktion bestätigt ihn ausdrücklich. Bewusst stehen bleiben der
 * Fortschritt (Serie, Gemerktes, Amen), die Einreichungen der
 * Mitmach-Ecke und alles ausserhalb des Bereichs.
 *
 * Wie die Importe verlangt er eine Verbindung und kehrt erst zurück, wenn
 * der Server jeden Stapel bestätigt hat – kein «zwischengespeichert» nach
 * zwei Sekunden, das mehr verspräche, als schon sicher liegt. Zuerst geht
 * das Paket hinaus, dann die Antworten, die Beiträge und zuletzt die
 * alten Karten (siehe `commitInOrder`): Reisst die Verbindung ab, stehen
 * schlimmstenfalls Altes und Neues nebeneinander – nie eine Löschung ohne
 * Paket und nie eine Antwort ohne ihre Karte.
 *
 * Welche Antworten und Beiträge zu den Karten gehören, steht nicht in den
 * Abos der Seite, sondern wird frisch beim Server erfragt: Die Abos laden
 * vielleicht noch oder hinken nach, und was sie nicht kennen, bliebe
 * sonst verwaist zurück. Erreicht die Abfrage den Server nicht, bricht
 * der Neustart ab, bevor etwas geschrieben ist.
 */
export async function restartImpulseContent(input: {
  itemIds: string[]
  plans: PackPlan[]
  userId?: string | null
}): Promise<void> {
  requireOnline()
  const itemIds = new Set(input.itemIds)
  const [answers, comments, scores] = await Promise.all([
    getDocsFromServer(collection(db, COLLECTIONS.impulseAnswers)),
    getDocsFromServer(collection(db, COLLECTIONS.impulseComments)),
    getDocsFromServer(collection(db, COLLECTIONS.impulseGameScores)),
  ])
  const ofItems = (snapshot: typeof answers) =>
    snapshot.docs
      .filter((entry) => itemIds.has(String(entry.get('itemId'))))
      .map((entry) => entry.id)
  const answerIds = ofItems(answers)
  const commentIds = ofItems(comments)
  const scoreIds = ofItems(scores)

  const deletions = [
    ...answerIds.map((id) => doc(db, COLLECTIONS.impulseAnswers, id)),
    ...commentIds.map((id) => doc(db, COLLECTIONS.impulseComments, id)),
    ...scoreIds.map((id) => doc(db, COLLECTIONS.impulseGameScores, id)),
    ...input.itemIds.map((id) => doc(db, COLLECTIONS.impulseItems, id)),
  ]
  const deletionBatches = chunks(deletions).map((part) => {
    const batch = writeBatch(db)
    for (const reference of part) batch.delete(reference)
    return batch
  })
  await commitInOrder([...planBatches(input.plans, input.userId), ...deletionBatches])
  for (const id of input.itemIds) forgetDoc(COLLECTIONS.impulseItems, id)
  for (const id of answerIds) forgetDoc(COLLECTIONS.impulseAnswers, id)
  for (const id of commentIds) forgetDoc(COLLECTIONS.impulseComments, id)
  for (const id of scoreIds) forgetDoc(COLLECTIONS.impulseGameScores, id)
}

/**
 * Die Schwierigkeitsansagen aus bestehenden Hinweisen räumen – ein Klick.
 *
 * Was zu ändern ist, rechnet `planDifficultyCleanup` (lib/impulse) aus
 * dem abonnierten Bestand; hier wird nur noch geschrieben. Ein Stapel
 * statt einzelner Schreibvorgänge: alles oder nichts, wie beim
 * Startpaket.
 */
export async function applyDifficultyCleanup(
  updates: { id: string; body: string }[],
): Promise<SaveOutcome> {
  const batch = writeBatch(db)
  for (const update of updates) {
    batch.update(doc(db, COLLECTIONS.impulseItems, update.id), {
      body: update.body,
      updatedAt: serverTimestamp(),
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
export async function answerImpulseQuiz(
  item: ImpulseItem,
  user: { uid: string; displayName: string },
  reply: { choiceIndex?: number; text?: string },
): Promise<SaveOutcome> {
  const correct = quizAnswerCorrect(item, reply)
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

/**
 * Bei einer Umfrage abstimmen – eine Stimme, auf den eigenen Namen.
 *
 * Dieselbe Sammlung und dieselbe ID wie beim Quiz: eine Stimme pro
 * Person, und umentscheiden gibt es nicht (die Regeln lassen keine
 * Änderung zu). Bei der Auswahl ist der Wert der Index der Möglichkeit,
 * bei der Skala der Wert selbst. Richtig oder falsch gibt es nicht.
 *
 * Abgestimmt wird anonym: Der Vorname bleibt leer – gezeigt wird ohnehin
 * nur das Ergebnis, und so steht er auch in der Stimme selbst nicht.
 */
export async function answerImpulsePoll(
  item: ImpulseItem,
  user: { uid: string; displayName: string },
  value: number,
): Promise<SaveOutcome> {
  return commit(
    setDoc(doc(db, COLLECTIONS.impulseAnswers, impulseAnswerId(item.id, user.uid)), {
      itemId: item.id,
      uid: user.uid,
      firstName: '',
      choiceIndex: value,
      text: '',
      correct: null,
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Ein Vers-Puzzle abgeben – der gebaute Satz und ob er stimmt. Ein
 * Versuch, wie beim Quiz; gezählt wird die Teilnahme.
 */
export async function answerImpulsePuzzle(
  item: ImpulseItem,
  user: { uid: string; displayName: string },
  attempt: string,
  correct: boolean,
): Promise<SaveOutcome> {
  return commit(
    setDoc(doc(db, COLLECTIONS.impulseAnswers, impulseAnswerId(item.id, user.uid)), {
      itemId: item.id,
      uid: user.uid,
      firstName: impulseFirstName(user.displayName),
      choiceIndex: null,
      text: attempt.trim(),
      correct,
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Den Tag vermerken, an dem das Wochen-Wappen zum ersten Mal ganz
 * dastand – für den Stern «Vor Sonntag vollendet». Wie das Anschauen von
 * Karten geht das nicht ins Zugriffsprotokoll: Es ist ein Spielstand,
 * keine Änderung am Bestand.
 */
export async function markImpulseCrest(
  user: { uid: string; displayName: string },
  week: string,
  day: string,
): Promise<SaveOutcome> {
  return commit(
    fbSetDoc(
      doc(db, COLLECTIONS.impulseProgress, user.uid),
      {
        uid: user.uid,
        firstName: impulseFirstName(user.displayName),
        weeks: { [week]: { crest: day } },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Minispiele                                                          */
/* ------------------------------------------------------------------ */

/**
 * Der beste Lauf in einem Minispiel – der eigene Eintrag der Rangliste.
 *
 * Geschrieben wird nur, was besser ist als der bisherige Bestwert: Das
 * entscheidet der Aufrufer aus dem abonnierten Bestand, und die
 * Zugriffsregeln lassen ohnehin nichts sinken. Wie oft jemand gespielt
 * hat, steht nirgends. `hidden` schreibt die App nie – das gehört der
 * Redaktion, und ein neuer Bestwert holt einen ausgeblendeten Eintrag
 * nicht zurück.
 *
 * Am Protokoll vorbei wie der Spielstand des Wappens: Eine Runde ist
 * keine Änderung am Bestand der Gemeinde.
 */
export async function saveImpulseGameScore(
  item: Pick<ImpulseItem, 'id' | 'week' | 'game'>,
  user: { uid: string; displayName: string },
  points: number,
  name: string,
): Promise<SaveOutcome> {
  return commit(
    fbSetDoc(
      doc(db, COLLECTIONS.impulseGameScores, impulseAnswerId(item.id, user.uid)),
      {
        itemId: item.id,
        uid: user.uid,
        week: item.week ?? '',
        game: item.game ?? 'sortieren',
        name: cleanGameName(name),
        best: cleanGameScore(points),
        bestAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  )
}

/**
 * Der Name in den Ranglisten – am eigenen Fortschritt, und gleich in jedem
 * eigenen Eintrag nachgeführt (`scoreIds`, alle bestehenden): Wer sich
 * umbenennt, steht überall unter dem neuen Namen und nicht in einer Liste
 * so und in der nächsten anders. Ein Stapel, damit beides zusammen gilt.
 */
export async function setImpulseGameName(
  user: { uid: string; displayName: string },
  name: string,
  scoreIds: readonly string[],
): Promise<SaveOutcome> {
  const clean = cleanGameName(name)
  const batch = fbWriteBatch(db)
  batch.set(
    doc(db, COLLECTIONS.impulseProgress, user.uid),
    {
      uid: user.uid,
      firstName: impulseFirstName(user.displayName),
      gameName: clean,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  for (const scoreId of scoreIds) {
    batch.update(doc(db, COLLECTIONS.impulseGameScores, scoreId), {
      name: clean,
      updatedAt: serverTimestamp(),
    })
  }
  return commit(batch.commit())
}

/**
 * Einen Eintrag der Rangliste aus- oder wieder einblenden – allein die
 * Redaktion, etwa bei einem Namen, der nicht in die Liste gehört. Die
 * Person selbst sieht ihren Eintrag weiterhin.
 */
export async function setImpulseGameScoreHidden(
  scoreId: string,
  hidden: boolean,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.impulseGameScores, scoreId), {
      hidden,
      updatedAt: serverTimestamp(),
    }),
  )
}
