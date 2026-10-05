import type { ImpulseProgress } from './types.ts'

/*
 * Eine Woche zurücksetzen – für die Redaktion, etwa nach dem Testen und
 * bevor der Link an alle geht.
 *
 * Zurückgesetzt wird, was die Leute in der Woche getan haben, nicht was
 * die Redaktion gebaut hat: Die Karten bleiben stehen. Danach ist die
 * Woche für die Betroffenen wieder wie neu – keine Karte angeschaut, das
 * Wappen leer, keine Haken, keine Antworten, kein Eintrag in der
 * Rangliste. Wahlweise für alle oder nur für einzelne Personen, und
 * wahlweise nur Teile davon (`ImpulseResetPart`).
 *
 * Hier wird nur gerechnet, ohne Datenbank: wer in der Woche Spuren hat,
 * wie viele – und welche Dokumente und Felder ein Zurücksetzen anfasst.
 * Das Fenster der Redaktion zeigt damit vorher, was geschieht; der Dienst
 * (`resetImpulseWeek`) rechnet dasselbe mit dem frischen Stand vom Server
 * noch einmal und schreibt es.
 *
 * Was an der Woche hängt, steht an drei Orten:
 *
 * - **im Fortschritt** der Person, unter `weeks[woche]`: angeschaute
 *   Karten und Vertiefungen, das Wappen samt Tag der Vollendung, die
 *   Haken bei Wochenziel, Tages-Challenge und Teilen-Aufgabe. Dazu die
 *   Woche, in der zuletzt bzw. zuerst geschaut wurde, wenn es diese ist.
 * - **an den Inhalten der Woche**: Antworten, Beiträge zur Frage der Woche
 *   und Ranglisten-Einträge tragen die Inhalts-ID.
 * - **in den Reaktionen**: Amen und Gemerktes nennen Inhalts-IDs, Amen und
 *   Meldungen zu Beiträgen deren ID – `{inhalt}_{konto}`.
 */

/** Was sich einzeln zurücksetzen lässt. */
export type ImpulseResetPart = 'progress' | 'answers' | 'comments' | 'game' | 'reactions'

export const IMPULSE_RESET_PARTS: readonly {
  key: ImpulseResetPart
  label: string
  hint: string
}[] = [
  {
    key: 'progress',
    label: 'Angeschaute Karten, Wappen und Haken',
    hint: 'Was im Feed angeschaut wurde, das Wappen samt seinen Sternen, die Haken bei Wochenziel, Tages-Challenge und Teilen-Aufgabe.',
  },
  {
    key: 'answers',
    label: 'Antworten',
    hint: 'Quizfragen, Bilderrätsel, Umfragen und Vers-Puzzles – danach lässt sich neu antworten.',
  },
  {
    key: 'comments',
    label: 'Beiträge zur Frage der Woche',
    hint: 'Mitsamt den Amen und Meldungen dazu.',
  },
  {
    key: 'game',
    label: 'Minispiel-Rangliste',
    hint: 'Die Einträge der Woche. Steht danach jemand in keiner Rangliste mehr, fragt das Spiel nach der nächsten Runde wieder nach dem Namen.',
  },
  {
    key: 'reactions',
    label: 'Amen, Gemerktes und Meldungen',
    hint: 'Zu den Karten und Beiträgen dieser Woche.',
  },
]

/** Antworten, Beiträge und Ranglisten-Einträge – alle tragen Inhalt und Konto. */
export interface ImpulseResetResponse {
  id: string
  itemId: string
  uid: string
  /** Der Vorname, falls mitgeschrieben – leer bei anonymen Beiträgen und Umfragen. */
  firstName?: string
}

export type ImpulseResetProgress = Pick<
  ImpulseProgress,
  | 'uid'
  | 'firstName'
  | 'weeks'
  | 'amens'
  | 'favorites'
  | 'reports'
  | 'lastSeenWeek'
  | 'firstSeenWeek'
  | 'gameName'
>

/** Der Bestand, aus dem gerechnet wird – der ganze, nicht nur die Woche. */
export interface ImpulseResetSource {
  /** Die Woche, «2026-W41». */
  week: string
  /** Alle Inhalte der Woche, Entwürfe eingeschlossen. */
  itemIds: readonly string[]
  progress: readonly ImpulseResetProgress[]
  answers: readonly ImpulseResetResponse[]
  comments: readonly ImpulseResetResponse[]
  scores: readonly ImpulseResetResponse[]
}

/** Was zurückgesetzt wird: wessen Spuren und welche Teile davon. */
export interface ImpulseResetSelection {
  /** `null`: alle, die in der Woche Spuren haben – sonst genau diese Konten. */
  people: ReadonlySet<string> | null
  parts: ReadonlySet<ImpulseResetPart>
}

/** Eine Person mit Spuren in der Woche – für die Liste im Fenster. */
export interface ImpulseResetPerson {
  uid: string
  firstName: string
  /** Angeschaute Karten. */
  cards: number
  /** Haken: Wochenziel, Tage der Tages-Challenge, Teilen-Aufgabe. */
  ticks: number
  /** Das Wappen war vollendet. */
  crest: boolean
  /** Etwas aus dem Fortschritt der Woche – auch bloss der erste Blick hinein. */
  progress: boolean
  answers: number
  comments: number
  scores: number
  /** Amen, Gemerktes und Meldungen zu Karten und Beiträgen der Woche. */
  reactions: number
}

/** Was an einem Fortschrittsdokument wegkommt. */
export interface ImpulseProgressReset {
  uid: string
  /** Die ganze Woche aus `weeks`. */
  week: boolean
  amens: string[]
  favorites: string[]
  reports: string[]
  /** `lastSeenWeek` ist diese Woche – das Feld kommt weg. */
  lastSeenWeek: boolean
  /** `firstSeenWeek` ist diese Woche – das Feld kommt weg. */
  firstSeenWeek: boolean
  /** Der Name in den Ranglisten – wenn danach kein Eintrag mehr bleibt. */
  gameName: boolean
}

export interface ImpulseResetPlan {
  answerIds: string[]
  commentIds: string[]
  scoreIds: string[]
  /** Nur Dokumente, an denen sich wirklich etwas ändert. */
  progress: ImpulseProgressReset[]
  /** Die Konten, deren eigene Spuren zurückgesetzt werden. */
  people: string[]
}

/** Gehört ein Eintrag aus Amen, Gemerktem oder Meldungen zur Woche? */
function weekReference(itemIds: ReadonlySet<string>) {
  const prefixes = [...itemIds].map((id) => `${id}_`)
  return (entry: string) =>
    itemIds.has(entry) || prefixes.some((prefix) => entry.startsWith(prefix))
}

/** Was ein Fortschrittsdokument in der Woche trägt. */
function progressTrace(progress: ImpulseResetProgress, week: string) {
  const state = progress.weeks?.[week]
  return {
    hasWeek: Boolean(state),
    cards: state?.cards?.length ?? 0,
    ticks:
      (state?.goal === true ? 1 : 0) +
      Math.min(state?.days?.length ?? 0, 7) +
      (state?.share === true ? 1 : 0),
    crest: Boolean(state?.crest),
    lastSeenWeek: progress.lastSeenWeek === week,
    firstSeenWeek: progress.firstSeenWeek === week,
  }
}

/**
 * Wer in der Woche Spuren hat – sortiert nach Vornamen, mit den Zahlen
 * je Teil. Spuren sind alles, was ein Zurücksetzen entfernen würde.
 */
export function impulseResetPeople(source: ImpulseResetSource): ImpulseResetPerson[] {
  const items = new Set(source.itemIds)
  const ofWeek = weekReference(items)
  const people = new Map<string, ImpulseResetPerson>()
  const person = (uid: string): ImpulseResetPerson => {
    const known = people.get(uid)
    if (known) return known
    const fresh: ImpulseResetPerson = {
      uid,
      firstName: '',
      cards: 0,
      ticks: 0,
      crest: false,
      progress: false,
      answers: 0,
      comments: 0,
      scores: 0,
      reactions: 0,
    }
    people.set(uid, fresh)
    return fresh
  }

  for (const progress of source.progress) {
    if (!progress.uid) continue
    const trace = progressTrace(progress, source.week)
    const reactions = [
      ...(progress.amens ?? []),
      ...(progress.favorites ?? []),
      ...(progress.reports ?? []),
    ].filter(ofWeek).length
    const hasProgress = trace.hasWeek || trace.lastSeenWeek || trace.firstSeenWeek
    if (!hasProgress && reactions === 0) continue
    const entry = person(progress.uid)
    entry.firstName = progress.firstName || entry.firstName
    entry.cards = trace.cards
    entry.ticks = trace.ticks
    entry.crest = trace.crest
    entry.progress = hasProgress
    entry.reactions = reactions
  }

  const count = (
    responses: readonly ImpulseResetResponse[],
    key: 'answers' | 'comments' | 'scores',
  ) => {
    for (const response of responses) {
      if (!items.has(response.itemId) || !response.uid) continue
      const entry = person(response.uid)
      entry[key] += 1
      if (!entry.firstName && response.firstName) entry.firstName = response.firstName
    }
  }
  count(source.answers, 'answers')
  count(source.comments, 'comments')
  count(source.scores, 'scores')

  /* Die Vornamen aus dem Fortschritt gelten auch für Personen, die nur
     über eine Antwort in die Liste kamen. */
  const names = new Map(source.progress.map((progress) => [progress.uid, progress.firstName]))
  return [...people.values()]
    .map((entry) => ({ ...entry, firstName: entry.firstName || names.get(entry.uid) || '' }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName, 'de') || a.uid.localeCompare(b.uid))
}

/**
 * Was ein Zurücksetzen anfasst: welche Dokumente gelöscht werden und was
 * an welchem Fortschritt wegkommt.
 *
 * Werden Beiträge gelöscht, verschwinden auch die Amen und Meldungen
 * **aller** dazu – sonst hinge an einem neuen Beitrag derselben Person
 * (er bekommt dieselbe ID) das Amen von gestern. Das gilt unabhängig
 * davon, ob die Reaktionen der Woche sonst mit zurückgesetzt werden.
 *
 * Der Name in den Ranglisten gehört zum Konto, nicht zur Woche. Er kommt
 * nur weg, wenn danach kein einziger Eintrag der Person mehr bleibt –
 * dann fragt das Spiel nach der nächsten Runde wieder danach, wie beim
 * ersten Mal.
 */
export function planImpulseReset(
  source: ImpulseResetSource,
  selection: ImpulseResetSelection,
): ImpulseResetPlan {
  const items = new Set(source.itemIds)
  const ofWeek = weekReference(items)
  const parts = selection.parts
  const selected = (uid: string) => selection.people === null || selection.people.has(uid)
  const pick = (responses: readonly ImpulseResetResponse[]) =>
    responses.filter((response) => items.has(response.itemId) && selected(response.uid))

  const answers = parts.has('answers') ? pick(source.answers) : []
  const comments = parts.has('comments') ? pick(source.comments) : []
  const scores = parts.has('game') ? pick(source.scores) : []
  const removedComments = new Set(comments.map((comment) => comment.id))
  const removedScores = new Set(scores.map((score) => score.id))

  const people = new Set<string>()
  for (const response of [...answers, ...comments, ...scores]) people.add(response.uid)

  const progress: ImpulseProgressReset[] = []
  for (const doc of source.progress) {
    if (!doc.uid) continue
    const own = selected(doc.uid)
    const trace = progressTrace(doc, source.week)
    const resetProgress = own && parts.has('progress')
    const resetReactions = own && parts.has('reactions')
    /* Eigene Reaktionen der Woche – und die aller zu gelöschten Beiträgen. */
    const drop = (list: readonly string[] | undefined, withComments: boolean) =>
      (list ?? []).filter(
        (entry) =>
          (resetReactions && ofWeek(entry)) || (withComments && removedComments.has(entry)),
      )
    const ownScores = source.scores.filter((score) => score.uid === doc.uid)
    const entry: ImpulseProgressReset = {
      uid: doc.uid,
      week: resetProgress && trace.hasWeek,
      amens: drop(doc.amens, true),
      favorites: drop(doc.favorites, false),
      reports: drop(doc.reports, true),
      lastSeenWeek: resetProgress && trace.lastSeenWeek,
      firstSeenWeek: resetProgress && trace.firstSeenWeek,
      gameName:
        own &&
        Boolean(doc.gameName) &&
        ownScores.some((score) => removedScores.has(score.id)) &&
        ownScores.every((score) => removedScores.has(score.id)),
    }
    const changes =
      entry.week ||
      entry.lastSeenWeek ||
      entry.firstSeenWeek ||
      entry.gameName ||
      entry.amens.length + entry.favorites.length + entry.reports.length > 0
    if (!changes) continue
    progress.push(entry)
    /* Wer bloss eine Reaktion auf einen gelöschten Beitrag verliert, wird
       nicht zurückgesetzt – er zählt nicht zu den Betroffenen. */
    if (own) people.add(doc.uid)
  }

  return {
    answerIds: answers.map((answer) => answer.id),
    commentIds: comments.map((comment) => comment.id),
    scoreIds: scores.map((score) => score.id),
    progress,
    people: [...people],
  }
}

/**
 * Ein Plan in Worten – für die Zusammenfassung im Fenster und die
 * Rückmeldung danach: «2 Personen: Karten, Wappen und Haken, 5 Antworten,
 * 2 Beiträge, 2 Ranglisten-Einträge, 5 Amen/Gemerkt».
 */
export function describeImpulseReset(plan: ImpulseResetPlan): string {
  const reactions = plan.progress.reduce(
    (sum, entry) => sum + entry.amens.length + entry.favorites.length + entry.reports.length,
    0,
  )
  const count = (n: number, one: string, many: string) => n > 0 && `${n} ${n === 1 ? one : many}`
  const parts = [
    plan.progress.some((entry) => entry.week) && 'Karten, Wappen und Haken',
    count(plan.answerIds.length, 'Antwort', 'Antworten'),
    count(plan.commentIds.length, 'Beitrag', 'Beiträge'),
    count(plan.scoreIds.length, 'Ranglisten-Eintrag', 'Ranglisten-Einträge'),
    reactions > 0 && `${reactions} Amen/Gemerkt`,
  ].filter((part): part is string => Boolean(part))
  const who = `${plan.people.length} ${plan.people.length === 1 ? 'Person' : 'Personen'}`
  return parts.length > 0 ? `${who}: ${parts.join(', ')}` : who
}
