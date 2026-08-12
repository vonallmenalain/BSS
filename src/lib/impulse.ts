import { addDays, format, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import { formatDayMonth, formatDayMonthYear } from './dates.ts'
import type {
  ImpulseAnswer,
  ImpulseItem,
  ImpulseKind,
  ImpulseProgress,
  ImpulseQuiz,
  ImpulseSource,
} from './types.ts'

/*
 * Die Wochenrechnung des Bereichs «Impuls» (docs/KONZEPT-IMPULS.md).
 *
 * Die Woche ist die tragende Einheit: Inhalte gehören zu einer ISO-Woche
 * («2026-W34», Montag bis Sonntag), veröffentlicht wird am Montag durch den
 * Kalender – nicht von Hand. Der Schlüssel sortiert als Zeichenkette
 * richtig, weil das Jahr vorangeht und die Woche zweistellig ist; für die
 * Frage «hat diese Woche schon begonnen?» genügt deshalb ein
 * Stringvergleich.
 */

const WEEK_KEY = /^(\d{4})-W(\d{2})$/

/** «2026-W33» für ein Datum – die ISO-Woche, Montag bis Sonntag. */
export function impulseWeekKey(date: Date | number): string {
  const week = getISOWeek(date)
  const year = getISOWeekYear(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/**
 * Montag der Woche – `null`, wenn der Schlüssel keiner ist.
 *
 * Der 4. Januar liegt in jedem Jahr in der ISO-Woche 1; von dessen Montag
 * aus ist jede Woche des Jahres ein Vielfaches von sieben Tagen entfernt.
 */
export function weekStart(key: string): Date | null {
  const match = WEEK_KEY.exec(key)
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  if (week < 1 || week > 53) return null
  const firstMonday = startOfISOWeek(new Date(year, 0, 4))
  return addDays(firstMonday, (week - 1) * 7)
}

/** Sonntag der Woche – `null`, wenn der Schlüssel keiner ist. */
export function weekEnd(key: string): Date | null {
  const start = weekStart(key)
  return start ? addDays(start, 6) : null
}

/** Der Schlüssel `offset` Wochen neben `key` – über Jahresgrenzen hinweg. */
export function weekKeyOffset(key: string, offset: number): string | null {
  const start = weekStart(key)
  return start ? impulseWeekKey(addDays(start, offset * 7)) : null
}

/**
 * «10.–16. August 2026»; über Monatsgrenzen «31. August – 6. September
 * 2026», über Jahresgrenzen mit beiden Jahren. Ein unbrauchbarer Schlüssel
 * bleibt stehen, wie er ist – besser als ein leerer Kopf.
 */
export function formatWeekRange(key: string): string {
  const start = weekStart(key)
  const end = weekEnd(key)
  if (!start || !end) return key
  if (start.getFullYear() !== end.getFullYear())
    return `${formatDayMonthYear(start)} – ${formatDayMonthYear(end)}`
  if (start.getMonth() !== end.getMonth())
    return `${formatDayMonth(start)} – ${formatDayMonthYear(end)}`
  return `${start.getDate()}.–${formatDayMonthYear(end)}`
}

/** Die laufende Woche und die folgenden – die Zeilen des Wochenplans. */
export function upcomingWeekKeys(from: Date | number, count: number): string[] {
  const first = startOfISOWeek(from)
  const keys: string[] = []
  for (let i = 0; i < count; i += 1) keys.push(impulseWeekKey(addDays(first, i * 7)))
  return keys
}

/**
 * Die Lesereihenfolge innerhalb einer Woche – wie im Konzept: zuerst der
 * Impuls, dann das Ziel mit dem Haken, dann die Frage, zuletzt die
 * tägliche Kleinigkeit.
 */
export const IMPULSE_KIND_ORDER: ImpulseKind[] = ['impuls', 'wochenziel', 'quiz', 'tageschallenge']

export function impulseKindRank(kind: ImpulseKind): number {
  const index = IMPULSE_KIND_ORDER.indexOf(kind)
  return index === -1 ? IMPULSE_KIND_ORDER.length : index
}

/**
 * Was die AP's zu sehen bekommen: bereit, geplant – und die Woche hat
 * begonnen. Entwürfe und der Fragenpool bleiben der Redaktion; künftige
 * Wochen warten auf ihren Montag.
 */
export function visibleImpulseItems(items: ImpulseItem[], todayKey: string): ImpulseItem[] {
  return items.filter(
    (item) => item.status === 'ready' && typeof item.week === 'string' && item.week <= todayKey,
  )
}

/** Die Inhalte einer Woche, in Lesereihenfolge. */
export function itemsForWeek(items: ImpulseItem[], week: string): ImpulseItem[] {
  return items
    .filter((item) => item.week === week)
    .sort((a, b) => impulseKindRank(a.kind) - impulseKindRank(b.kind))
}

/**
 * Dokument-ID einer Antwort: eine Antwort pro Person und Frage – die ID
 * selbst erzwingt es, und die Zugriffsregeln prüfen beide Bestandteile.
 */
export function impulseAnswerId(itemId: string, uid: string): string {
  return `${itemId}_${uid}`
}

/**
 * Was noch fehlt, bevor ein Inhalt «bereit» sein darf.
 *
 * Leer heisst: nichts – er kann veröffentlicht werden. Die Redaktion sieht
 * die Liste im Formular; gespeichert wird ein unfertiger Inhalt trotzdem,
 * bloss als Entwurf. Beim Impuls und bei der Quizfrage ist die Quelle
 * Pflicht: Der Bereich lebt von offiziellem Material, und der Sprung zur
 * Quelle ist sein Ziel. Wochenziel und Tages-Challenge sind Aufgaben,
 * kein Material – «Bete jeden Abend» hat keine Fundstelle; eine Quelle
 * darf trotzdem dranstehen und wird dann gezeigt.
 */
export function readyProblems(item: {
  kind: ImpulseKind
  title: string
  source?: ImpulseSource | null
  quiz?: ImpulseQuiz | null
}): string[] {
  const problems: string[] = []
  if (!item.title.trim())
    problems.push(item.kind === 'quiz' ? 'Die Frage fehlt.' : 'Der Titel fehlt.')
  const sourceRequired = item.kind === 'impuls' || item.kind === 'quiz'
  if (sourceRequired && !item.source?.label.trim()) problems.push('Die Quelle fehlt.')

  if (item.kind === 'quiz') {
    const quiz = item.quiz
    if (!quiz) {
      problems.push('Die Quizangaben fehlen.')
      return problems
    }
    if (quiz.form === 'choice') {
      const options = quiz.options.map((option) => option.trim())
      if (options.filter(Boolean).length < 2)
        problems.push('Es braucht mindestens zwei Antworten.')
      else if (options.some((option) => !option)) problems.push('Eine Antwort ist noch leer.')
      if (quiz.answerIndex < 0 || quiz.answerIndex >= options.length || !options[quiz.answerIndex])
        problems.push('Die richtige Antwort ist nicht markiert.')
    } else if (!quiz.answerText.trim()) {
      problems.push('Die Lösung fehlt.')
    }
  }

  return problems
}

/* ------------------------------------------------------------------ */
/* Beteiligung, Serie und Abzeichen                                    */
/* ------------------------------------------------------------------ */

/** Die sieben Tage einer Woche als «2026-08-10», Montag zuerst. */
export function weekDays(key: string): string[] {
  const start = weekStart(key)
  if (!start) return []
  return Array.from({ length: 7 }, (_, index) => format(addDays(start, index), 'yyyy-MM-dd'))
}

/** Der Kalendermonat, in dem die Woche beginnt – «2026-08». */
export function monthOfWeek(key: string): string | null {
  const start = weekStart(key)
  return start ? format(start, 'yyyy-MM') : null
}

/**
 * In welchen Wochen jemand dabei war.
 *
 * Dabei heisst: Wochenziel abgehakt, mindestens ein Tag der
 * Tages-Challenge – oder eine Quizfrage beantwortet. Die Antworten
 * liegen in ihrer eigenen Sammlung und werden hier über den Inhalt der
 * Woche zugeordnet (`weekOfItem`); nichts davon steht doppelt im
 * Fortschrittsdokument.
 */
export function participatedWeeks(
  progress: Pick<ImpulseProgress, 'weeks'> | null | undefined,
  answers: Pick<ImpulseAnswer, 'itemId'>[],
  weekOfItem: (itemId: string) => string | null,
): Set<string> {
  const weeks = new Set<string>()
  for (const [week, state] of Object.entries(progress?.weeks ?? {})) {
    if (state?.goal === true || (state?.days?.length ?? 0) > 0) weeks.add(week)
  }
  for (const answer of answers) {
    const week = weekOfItem(answer.itemId)
    if (week) weeks.add(week)
  }
  return weeks
}

/**
 * Die Serie: Wochen in Folge mit Beteiligung – mit eingebauter Milde.
 *
 * Pro Kalendermonat verzeiht eine **Jokerwoche** eine verpasste Woche
 * (Lager, Prüfungen, Ferien); erst die zweite verpasste Woche im selben
 * Monat reisst die Serie. Der Joker überbrückt, zählt aber nicht mit –
 * die Serie ist die Zahl der Wochen, in denen jemand wirklich dabei war.
 * Die **laufende** Woche ist neutral, solange sie nicht abgehakt ist:
 * Sie läuft ja noch, und eine Serie, die am Montagmorgen auf null fiele,
 * wäre keine Milde, sondern ein Fehler.
 */
export function computeStreak(
  participated: ReadonlySet<string>,
  todayKey: string,
): { current: number; best: number } {
  const past = [...participated].filter((week) => week <= todayKey).sort()
  if (past.length === 0) return { current: 0, best: 0 }

  let run = 0
  let best = 0
  const jokerMonths = new Set<string>()

  let cursor: string | null = past[0]
  let guard = 0
  while (cursor && cursor <= todayKey && guard < 600) {
    guard += 1
    if (participated.has(cursor)) {
      run += 1
      if (run > best) best = run
    } else if (cursor !== todayKey) {
      const month = monthOfWeek(cursor)
      if (!month || jokerMonths.has(month)) {
        run = 0
      } else {
        jokerMonths.add(month)
      }
    }
    cursor = weekKeyOffset(cursor, 1)
  }

  return { current: run, best }
}

/**
 * Die Abzeichen – Meilensteine statt Punkte.
 *
 * Ein Abzeichen erzählt, **was** jemand getan hat, nicht wie viel. Einmal
 * erreicht, bleibt es: Gerechnet wird über die ganze Geschichte (beste
 * Serie, alle Antworten), nicht über den heutigen Stand.
 */
export interface ImpulseBadge {
  id: string
  label: string
  hint: string
}

export const IMPULSE_BADGES: ImpulseBadge[] = [
  { id: 'dabei', label: 'Dabei!', hint: 'Die erste Woche mitgemacht.' },
  {
    id: 'volle-woche',
    label: 'Volle Woche',
    hint: 'Eine Tages-Challenge an allen sieben Tagen abgehakt.',
  },
  { id: 'vier-wochen', label: '4 Wochen in Folge', hint: 'Vier Wochen am Stück dabei.' },
  { id: 'acht-wochen', label: '8 Wochen in Folge', hint: 'Acht Wochen am Stück dabei.' },
  { id: 'zehn-fragen', label: '10 Fragen', hint: 'Zehn Quizfragen beantwortet.' },
]

export function earnedImpulseBadges(input: {
  participated: ReadonlySet<string>
  bestStreak: number
  quizAnswers: number
  weeks: Record<string, { days?: string[] }> | undefined
}): ImpulseBadge[] {
  const fullWeek = Object.values(input.weeks ?? {}).some(
    (state) => new Set(state?.days ?? []).size >= 7,
  )
  const earned = new Set<string>()
  if (input.participated.size > 0) earned.add('dabei')
  if (fullWeek) earned.add('volle-woche')
  if (input.bestStreak >= 4) earned.add('vier-wochen')
  if (input.bestStreak >= 8) earned.add('acht-wochen')
  if (input.quizAnswers >= 10) earned.add('zehn-fragen')
  return IMPULSE_BADGES.filter((badge) => earned.has(badge.id))
}

/**
 * Wer in einer Woche dabei war – für die Gruppenleiste.
 *
 * Die Namen kommen aus dem Fortschrittsdokument bzw. der Antwort selbst
 * (beide schreiben den Vornamen mit); fremde Profile braucht es dafür
 * nicht. Sortiert nach Vornamen, damit die Reihe stabil bleibt.
 */
export function weekParticipants(
  progressDocs: ImpulseProgress[],
  answers: ImpulseAnswer[],
  weekOfItem: (itemId: string) => string | null,
  week: string,
): { uid: string; firstName: string }[] {
  const byUid = new Map<string, string>()
  for (const progress of progressDocs) {
    const state = progress.weeks?.[week]
    if (state?.goal === true || (state?.days?.length ?? 0) > 0) {
      byUid.set(progress.uid, progress.firstName || '–')
    }
  }
  for (const answer of answers) {
    if (weekOfItem(answer.itemId) === week && !byUid.has(answer.uid)) {
      byUid.set(answer.uid, answer.firstName || '–')
    }
  }
  return [...byUid.entries()]
    .map(([uid, firstName]) => ({ uid, firstName }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName, 'de'))
}
