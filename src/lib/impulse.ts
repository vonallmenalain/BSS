import {
  addDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
} from 'date-fns'
import { formatDayMonth, formatDayMonthYear, formatDayShort } from './dates.ts'
import type {
  ImpulseAnswer,
  ImpulseItem,
  ImpulseKind,
  ImpulsePoll,
  ImpulseProgress,
  ImpulsePuzzle,
  ImpulseQuiz,
  ImpulseSource,
} from './types.ts'

/*
 * Die Wochenrechnung des Bereichs «Anti Doom» (docs/KONZEPT-IMPULS.md).
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
 * Die verschobenen Wochenstarts, in Millisekunden je Woche – aus den
 * bereiten Wochenthemen, die einen eigenen Start tragen (`startsAt`).
 *
 * Gezählt wird ein Start nur, wenn er zur Woche des Themas gehört und in
 * ihrem Rahmen liegt (`weekStartBounds`): Wandert ein Wochenthema in eine
 * andere Woche, bleibt sein alter Start ohne Wirkung. Ein Entwurf
 * verschiebt nichts – sonst begänne eine Woche, deren Thema noch gar
 * nicht zu sehen ist.
 */
export function impulseWeekStarts(
  items: {
    kind: ImpulseKind
    status: string
    week: string | null
    startsAt?: { week: string; at: { toMillis(): number } } | null
  }[],
): Map<string, number> {
  const starts = new Map<string, number>()
  for (const item of items) {
    if (item.kind !== 'impuls' || item.status !== 'ready' || typeof item.week !== 'string') continue
    const shifted = item.startsAt
    if (!shifted || shifted.week !== item.week) continue
    const time = shifted.at.toMillis()
    const bounds = weekStartBounds(item.week)
    if (!bounds || time < bounds.earliest.getTime() || time > bounds.latest.getTime()) continue
    starts.set(item.week, time)
  }
  return starts
}

/**
 * Die laufende Woche des Bereichs.
 *
 * Normalerweise die Kalenderwoche: Montag, 00:00, beginnt die neue. Die
 * Redaktion kann den Start einer Woche aber verschieben (`startsAt` am
 * Wochenthema, gesammelt von `impulseWeekStarts`): früher, damit das neue
 * Thema etwa schon am Sonntagabend da ist, oder später, damit die alte
 * Woche länger läuft. Geschaut wird auf die Nachbarn – die nächste Woche
 * kann vorgezogen, die eigene verschoben werden.
 */
export function impulseCurrentWeek(
  now: Date | number,
  starts: ReadonlyMap<string, number>,
): string {
  const calendar = impulseWeekKey(now)
  const time = typeof now === 'number' ? now : now.getTime()
  const next = weekKeyOffset(calendar, 1)
  const nextStart = next ? starts.get(next) : undefined
  if (next && nextStart !== undefined && time >= nextStart) return next
  const ownStart = starts.get(calendar)
  if (ownStart !== undefined && time < ownStart) return weekKeyOffset(calendar, -1) ?? calendar
  return calendar
}

/**
 * Wann eine Woche beginnen darf, wenn die Redaktion sie verschiebt: frühestens
 * am Montag der Woche davor (so weit schaut `impulseCurrentWeek` voraus),
 * spätestens am Sonntag der Woche selbst.
 */
export function weekStartBounds(week: string): { earliest: Date; latest: Date } | null {
  const start = weekStart(week)
  if (!start) return null
  const latest = addDays(start, 6)
  latest.setHours(23, 59, 0, 0)
  return { earliest: addDays(start, -7), latest }
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
 * Die Ordnung der Arten innerhalb einer Woche – zuerst der Impuls, dann
 * die beiden Aufgaben neben dem Feed (Ziel und Tages-Challenge), dann die
 * übrigen Feed-Karten: Umfrage, Quiz, Puzzle, Bilderrätsel, Video, Frage,
 * Feed – und zum Schluss die Teilen-Aufgabe, die Einladung zum
 * Weitererzählen. So gruppiert die Redaktion ihre Sparten; der Feed
 * selbst folgt dem Platz, den die Redaktion jeder Karte gibt
 * (`deckOrder`).
 */
export const IMPULSE_KIND_ORDER: ImpulseKind[] = [
  'impuls',
  'wochenziel',
  'tageschallenge',
  'umfrage',
  'quiz',
  'puzzle',
  'bilderraetsel',
  'video',
  'frage',
  'feed',
  'teilen',
]

/**
 * Die beiden Aufgaben neben dem Feed – sie sind Kacheln, keine Karten.
 * Alles andere liegt als Karte im Vollbild-Feed.
 */
const TASK_KINDS: readonly ImpulseKind[] = ['wochenziel', 'tageschallenge']

/** Liegt ein Inhalt dieser Art als Karte im Feed (und nicht als Kachel daneben)? */
export function isFeedCardKind(kind: ImpulseKind): boolean {
  return !TASK_KINDS.includes(kind)
}

export function impulseKindRank(kind: ImpulseKind): number {
  const index = IMPULSE_KIND_ORDER.indexOf(kind)
  return index === -1 ? IMPULSE_KIND_ORDER.length : index
}

/**
 * Die drei Arten, die eine Woche genau einmal trägt – nicht aus
 * Sparsamkeit, sondern weil ihr Haken an der **Woche** hängt und nicht an
 * der Karte: das Wochenziel ist erledigt oder nicht, die Tages-Challenge
 * hat ihre sieben Tage, die Teilen-Aufgabe ist besprochen oder nicht. Eine
 * zweite von ihnen hätte keinen eigenen Haken – und die Kacheln zeigten
 * sie gar nicht erst.
 *
 * Für alles andere gibt es **keine Obergrenze**: Wie viele Feed-Karten,
 * Quizfragen, Bilderrätsel, Wochenthemen, Fragen oder Aufgaben eine Woche
 * trägt, entscheidet die Redaktion – nicht eine Zahl im Code.
 */
export const IMPULSE_SINGLE_KINDS: readonly ImpulseKind[] = [
  'wochenziel',
  'tageschallenge',
  'teilen',
]

/** Darf eine Woche mehrere Karten dieser Art tragen? */
export function allowsMultiple(kind: ImpulseKind): boolean {
  return !IMPULSE_SINGLE_KINDS.includes(kind)
}

/**
 * Der Platz, an dem eine neue Karte einsteigt: hinter der letzten.
 * Karten des Feeds teilen sich **eine** Reihe über alle Arten hinweg –
 * eine neue Umfrage landet also am Ende des Feeds, nicht hinter der
 * letzten Umfrage. Gezählt wird über die vergebenen Plätze **und** die
 * Zahl der Karten – so rutscht auch dann nichts nach vorn, wenn eine
 * Karte noch ohne Platz dasteht oder die Reihe eine Lücke hat.
 */
export function nextImpulseOrder(
  items: Pick<ImpulseItem, 'week' | 'kind' | 'order'>[],
  week: string,
  kind: ImpulseKind,
): number {
  const card = isFeedCardKind(kind)
  const same = items.filter(
    (item) => item.week === week && (card ? isFeedCardKind(item.kind) : item.kind === kind),
  )
  return same.reduce((max, item) => Math.max(max, item.order ?? 0), same.length) + 1
}

/**
 * Die Reihenfolge des Feeds – so, wie die Redaktion sie gelegt hat.
 *
 * Das Wochenthema steht immer vorn (es ist die Tür in die Woche), die
 * Teilen-Aufgabe immer hinten (erst lesen, dann weitergeben). Dazwischen
 * zählt der Platz (`order`) **über alle Arten hinweg**: Umfrage, Fakt,
 * Quiz, Geschichte, Puzzle – der Wechsel hält wach, ein Block aus zehn
 * gleichen Karten nicht. Ohne Platz kommt eine Karte ans Ende, und bei
 * gleichem Platz entscheidet die gewohnte Ordnung der Arten.
 */
export function deckOrder<T extends Pick<ImpulseItem, 'kind' | 'order'>>(items: T[]): T[] {
  const band = (kind: ImpulseKind) => (kind === 'impuls' ? 0 : kind === 'teilen' ? 2 : 1)
  return [...items].sort(
    (a, b) =>
      band(a.kind) - band(b.kind) ||
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      impulseKindRank(a.kind) - impulseKindRank(b.kind),
  )
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

/**
 * Die Inhalte einer Woche, in Lesereihenfolge – und innerhalb der
 * Feed-Karten in der Reihenfolge der Redaktion (`order`); ohne Angabe
 * kommt eine Karte ans Ende.
 */
export function itemsForWeek(items: ImpulseItem[], week: string): ImpulseItem[] {
  return items
    .filter((item) => item.week === week)
    .sort(
      (a, b) =>
        impulseKindRank(a.kind) - impulseKindRank(b.kind) ||
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    )
}

/**
 * Dokument-ID einer Antwort: eine Antwort pro Person und Frage – die ID
 * selbst erzwingt es, und die Zugriffsregeln prüfen beide Bestandteile.
 */
export function impulseAnswerId(itemId: string, uid: string): string {
  return `${itemId}_${uid}`
}

/** Der Vorname – mehr braucht der Bereich nicht von einem Namen. */
export function impulseFirstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName
}

/**
 * Ob eine Quizantwort stimmt – bestimmt bei der Auswahl selbst. Die
 * Suchfrage bleibt unbewertet (`null`), es zählt die Teilnahme.
 */
export function quizAnswerCorrect(
  item: Pick<ImpulseItem, 'quiz'>,
  reply: { choiceIndex?: number },
): boolean | null {
  const quiz = item.quiz
  return quiz && quiz.form === 'choice' && typeof reply.choiceIndex === 'number'
    ? reply.choiceIndex === quiz.answerIndex
    : null
}

/**
 * Was noch fehlt, bevor ein Inhalt «bereit» sein darf.
 *
 * Leer heisst: nichts – er kann veröffentlicht werden. Die Redaktion sieht
 * die Liste im Formular; gespeichert wird ein unfertiger Inhalt trotzdem,
 * bloss als Entwurf. Beim Wochenthema und bei der Quizfrage ist die Quelle
 * Pflicht: Der Bereich lebt von offiziellem Material, und der Sprung zur
 * Quelle ist sein Ziel. Das Bilderrätsel braucht sein Bild – aus der
 * offiziellen Mediathek der Kirche – und wie das Quiz eine Auflösung.
 * Wochenziel, Tages-Challenge und die Teilen-Aufgabe sind Aufgaben, kein
 * Material – «Bete jeden Abend» hat keine Fundstelle; eine Quelle darf
 * trotzdem dranstehen und wird dann gezeigt.
 *
 * Die Umfrage braucht ihre Möglichkeiten bzw. eine brauchbare Skala, aber
 * keine Quelle – sie fragt nach Meinungen, nicht nach Fakten. Das
 * Vers-Puzzle dagegen ist ein Vers: Es braucht mindestens drei Teile und
 * seine Fundstelle.
 */
export function readyProblems(item: {
  kind: ImpulseKind
  title: string
  source?: ImpulseSource | null
  quiz?: ImpulseQuiz | null
  poll?: ImpulsePoll | null
  puzzle?: ImpulsePuzzle | null
  image?: { url: string } | null
  videoUrl?: string | null
}): string[] {
  const problems: string[] = []
  if (!item.title.trim())
    problems.push(
      item.kind === 'quiz' ||
        item.kind === 'frage' ||
        item.kind === 'bilderraetsel' ||
        item.kind === 'umfrage'
        ? 'Die Frage fehlt.'
        : 'Der Titel fehlt.',
    )
  const sourceRequired = item.kind === 'impuls' || item.kind === 'quiz' || item.kind === 'puzzle'
  if (sourceRequired && !item.source?.label.trim()) problems.push('Die Quelle fehlt.')

  if (item.kind === 'umfrage') {
    const poll = item.poll
    if (!poll) {
      problems.push('Die Umfrage fehlt.')
    } else if (poll.form === 'choice') {
      const options = poll.options.map((option) => option.trim())
      if (options.filter(Boolean).length < 2)
        problems.push('Es braucht mindestens zwei Möglichkeiten.')
      else if (options.some((option) => !option)) problems.push('Eine Möglichkeit ist noch leer.')
    } else if (
      !Number.isInteger(poll.min) ||
      !Number.isInteger(poll.max) ||
      poll.max <= poll.min ||
      poll.max - poll.min > POLL_SCALE_MAX_STEPS
    ) {
      problems.push(
        `Die Skala braucht zwei ganze Zahlen, höchstens ${POLL_SCALE_MAX_STEPS} Schritte auseinander.`,
      )
    }
    return problems
  }

  if (item.kind === 'puzzle') {
    if (puzzlePieces(item.puzzle?.text ?? '').length < 3)
      problems.push('Das Puzzle braucht mindestens drei Teile.')
    return problems
  }

  if (item.kind === 'bilderraetsel' && !item.image?.url.trim()) problems.push('Das Bild fehlt.')

  /* Die Video-Karte ist ihr Video – ohne Link bleibt eine leere Fläche.
     Ein Bild darf jede Karte tragen, keine braucht eines: Beim Video ist
     es das Vorschaubild, sonst das Bild zum Thema. */
  if (item.kind === 'video' && !item.videoUrl?.trim()) problems.push('Der Videolink fehlt.')

  if (item.kind === 'quiz' || item.kind === 'bilderraetsel') {
    const quiz = item.quiz
    if (!quiz) {
      problems.push('Die Quizangaben fehlen.')
      return problems
    }
    if (quiz.form === 'choice') {
      const options = quiz.options.map((option) => option.trim())
      if (options.filter(Boolean).length < 2) problems.push('Es braucht mindestens zwei Antworten.')
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
/* Umfrage und Vers-Puzzle                                             */
/* ------------------------------------------------------------------ */

/**
 * Wie weit eine Skala höchstens reicht – zwanzig Schritte passen noch
 * als Balken auf ein Telefon, mehr wären ein Strich neben dem anderen.
 */
export const POLL_SCALE_MAX_STEPS = 20

/** Ein Balken des Ergebnisses: was gewählt werden konnte, wie oft – und welcher Anteil. */
export interface ImpulsePollBar {
  /** Bei der Auswahl der Index der Möglichkeit, bei der Skala der Wert. */
  value: number
  label: string
  count: number
  /** Anteil an allen Stimmen, 0 bis 1. */
  share: number
}

export interface ImpulsePollResult {
  total: number
  bars: ImpulsePollBar[]
  /** Bei der Skala: der Schnitt aller Stimmen, eine Stelle nach dem Komma – sonst `null`. */
  average: number | null
}

/**
 * Das Ergebnis einer Umfrage – nur Zahlen, keine Namen.
 *
 * Gezählt wird, was in den Rahmen passt: Eine Stimme ausserhalb der
 * Möglichkeiten (weil die Redaktion die Umfrage nachträglich gekürzt
 * hat) fällt still heraus, statt einen Balken über hundert Prozent zu
 * schieben.
 */
export function pollResults(
  poll: ImpulsePoll,
  answers: Pick<ImpulseAnswer, 'choiceIndex'>[],
): ImpulsePollResult {
  const choices =
    poll.form === 'choice'
      ? poll.options.map((label, index) => ({ value: index, label }))
      : Array.from({ length: Math.max(poll.max - poll.min + 1, 0) }, (_, index) => ({
          value: poll.min + index,
          label: String(poll.min + index),
        }))
  const counts = new Map(choices.map((choice) => [choice.value, 0]))
  let sum = 0
  for (const answer of answers) {
    const value = answer.choiceIndex
    if (typeof value !== 'number' || !counts.has(value)) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
    sum += value
  }
  const total = [...counts.values()].reduce((all, count) => all + count, 0)
  return {
    total,
    bars: choices.map((choice) => {
      const count = counts.get(choice.value) ?? 0
      return { ...choice, count, share: total > 0 ? count / total : 0 }
    }),
    average: poll.form === 'scale' && total > 0 ? Math.round((sum / total) * 10) / 10 : null,
  }
}

/**
 * Die Teile eines Vers-Puzzles: durch « / » getrennt – oder, ohne
 * Trennzeichen, Wort für Wort. Leerräume innerhalb eines Teils werden
 * zu einem einzigen, leere Teile fallen weg.
 */
export function puzzlePieces(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const parts = trimmed.includes('/') ? trimmed.split('/') : trimmed.split(/\s+/)
  return parts.map((part) => part.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** Der fertige Satz – die Teile in der richtigen Reihenfolge. */
export function puzzleSolution(text: string): string {
  return puzzlePieces(text).join(' ')
}

/**
 * Stimmt der gebaute Satz? Verglichen wird ohne Gross- und
 * Kleinschreibung, Satzzeichen und doppelte Leerräume – zwei gleiche
 * Wörter («und», «und») sind austauschbar, und das ist gewollt: Es zählt
 * der Satz, nicht welcher Knopf.
 */
export function puzzleSolved(text: string, attempt: string): boolean {
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase('de-CH')
      .replace(/[.,;:!?«»"„“”'’()–—-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const solution = normalize(puzzleSolution(text))
  return solution.length > 0 && normalize(attempt) === solution
}

/**
 * Die Teile gemischt – für jede Karte immer gleich (der Schlüssel ist
 * die Karte), damit der Stapel beim Wiederkommen so liegt wie verlassen.
 * Läge er zufällig schon richtig, wird er um eins weitergedreht: Ein
 * Puzzle, das gelöst beginnt, wäre keines.
 */
export function shuffledPuzzlePieces(text: string, seed: string): string[] {
  const pieces = puzzlePieces(text)
  if (pieces.length < 2) return pieces
  const mixed = seededShuffle(pieces, seed)
  if (mixed.join('\u0000') !== pieces.join('\u0000')) return mixed
  return [...mixed.slice(1), mixed[0]]
}

/* ------------------------------------------------------------------ */
/* Aufräumen: Schwierigkeitsansagen in Quiz-Hinweisen                  */
/* ------------------------------------------------------------------ */

/*
 * Die Hinweise unter Quizfragen und Bilderrätseln begannen früher mit
 * einer Schwierigkeitsansage – «Zum Aufwärmen:», «Schon schwieriger:»,
 * «Für Profis:». Die Redaktion will keinen Schwierigkeitsgrad ansagen:
 * Unter der Frage steht höchstens ein Hinweis zur Sache, oder gar
 * nichts. Das Startpaket kommt seither ohne die Ansagen; für Inhalte,
 * die schon in der Datenbank liegen, rechnet `planDifficultyCleanup`
 * aus, was sich ändern würde – die Redaktion spielt es mit einem Klick
 * ein. Erkannt wird nur die Ansage mit Doppelpunkt oder Gedankenstrich
 * (oder allein auf weiter Flur) – ein Satz, der zufällig so beginnt
 * («Schon schwieriger wird es …»), bleibt unangetastet.
 */
const DIFFICULTY_TAG = /^\s*(?:zum aufwärmen|schon schwieriger|für profis)\s*(?:[:–—-]+\s*|$)/i

/** Den Hinweis von seiner Schwierigkeitsansage befreien – gross weiter. */
export function stripDifficultyTag(text: string): string {
  const match = DIFFICULTY_TAG.exec(text)
  if (!match) return text
  const rest = text.slice(match[0].length)
  return rest.charAt(0).toLocaleUpperCase('de-CH') + rest.slice(1)
}

/** Welche Inhalte noch eine Ansage tragen – und wie ihr Hinweis danach lautet. */
export function planDifficultyCleanup(
  items: Pick<ImpulseItem, 'id' | 'body'>[],
): { id: string; body: string }[] {
  return items.flatMap((item) => {
    const body = item.body ?? ''
    const cleaned = stripDifficultyTag(body)
    return cleaned === body ? [] : [{ id: item.id, body: cleaned }]
  })
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
 * Tages-Challenge, die Teilen-Aufgabe besprochen – oder eine Quizfrage
 * beantwortet. Die Antworten liegen in ihrer eigenen Sammlung und werden
 * hier über den Inhalt der Woche zugeordnet (`weekOfItem`); nichts davon
 * steht doppelt im Fortschrittsdokument.
 */
export function participatedWeeks(
  progress: Pick<ImpulseProgress, 'weeks'> | null | undefined,
  answers: Pick<ImpulseAnswer, 'itemId'>[],
  weekOfItem: (itemId: string) => string | null,
): Set<string> {
  const weeks = new Set<string>()
  for (const [week, state] of Object.entries(progress?.weeks ?? {})) {
    if (
      state?.goal === true ||
      (state?.days?.length ?? 0) > 0 ||
      state?.feed === true ||
      state?.share === true
    )
      weeks.add(week)
  }
  for (const answer of answers) {
    const week = weekOfItem(answer.itemId)
    if (week) weeks.add(week)
  }
  return weeks
}

/**
 * Die Serie: Wochen in Folge mit Beteiligung – ohne Milde-Mechanik.
 *
 * Eine Jokerwoche pro Monat gab es hier einmal; sie ist bewusst wieder
 * ausgebaut: Die Serie soll genau das sagen, was sie zählt. Nur die
 * **laufende** Woche ist neutral, solange sie nicht abgehakt ist: Sie
 * läuft ja noch, und eine Serie, die am Montagmorgen auf null fiele,
 * wäre kein Zählen, sondern ein Fehler.
 */
export function computeStreak(
  participated: ReadonlySet<string>,
  todayKey: string,
): { current: number; best: number } {
  const past = [...participated].filter((week) => week <= todayKey).sort()
  if (past.length === 0) return { current: 0, best: 0 }

  let run = 0
  let best = 0

  let cursor: string | null = past[0]
  let guard = 0
  while (cursor && cursor <= todayKey && guard < 600) {
    guard += 1
    if (participated.has(cursor)) {
      run += 1
      if (run > best) best = run
    } else if (cursor !== todayKey) {
      run = 0
    }
    cursor = weekKeyOffset(cursor, 1)
  }

  return { current: run, best }
}

/**
 * Die Meilensteine **pro Woche** – jede Woche beginnen sie neu.
 *
 * Kein Sammeln über Monate (die Vier- und Acht-Wochen-Abzeichen sind
 * bewusst weggefallen): Vier kleine Ziele für die laufende Woche, am
 * Montag wieder offen. Erzählt wird, **was** diese Woche geschah, samt
 * Stand («1 von 7») – ein leerer Stand mahnt nicht, er wartet.
 *
 * Jeder Meilenstein trägt seine Begründung bei sich: `how` sagt in einem
 * Satz, wie er zustande kommt, und `steps` zählt auf, woraus er sich
 * zusammensetzt – die einzelnen Tage, die einzelnen Karten. Damit kann
 * die Anzeige beantworten, was «21 von 22» eigentlich heisst und welche
 * Karte noch fehlt, statt nur eine Zahl hinzustellen.
 */
export interface ImpulseMilestoneStep {
  /** Eindeutig innerhalb des Meilensteins – reicht als Schlüssel. */
  id: string
  label: string
  done: boolean
  /** Ein kleiner Zusatz zur Zeile – «Vertiefung», «heute», «kommt noch». */
  note?: string
}

export interface ImpulseWeekMilestone {
  id: 'dabei' | 'mitgeredet' | 'challenge' | 'scroller'
  label: string
  hint: string
  earned: boolean
  /** Der Stand für die Anzeige – «1 von 7». */
  progress: { value: number; max: number }
  /** Wie er zustande kommt – ein Satz für das Detailfenster. */
  how: string
  /** Woraus er sich zusammensetzt – leer, wo es nichts aufzuzählen gibt. */
  steps: ImpulseMilestoneStep[]
}

export function impulseWeekMilestones(input: {
  /** Diese Woche eingeloggt – der erste Blick in den Bereich zählt. */
  seen: boolean
  /** Die Frage der Woche – Titel und ob die eigene Antwort dasteht. */
  question: { title: string; answered: boolean } | null
  /** Die laufende Woche («2026-W33») – sie gibt die sieben Tage vor. */
  week: string
  /** Der heutige Tag («2026-08-11») – für «heute» und «kommt noch». */
  today: string
  /** Die abgehakten Tage der Tages-Challenge, als «2026-08-11». */
  challengeDays: readonly string[]
  /** Die Karten der Woche – mit Vertiefung, wo es eine gibt. */
  cards: readonly {
    id: string
    title: string
    seen: boolean
    deepening: boolean
    deepeningSeen: boolean
  }[]
}): ImpulseWeekMilestone[] {
  /* Gezählt werden nur Haken, die zu dieser Woche gehören – ein Tag aus
     einer anderen Woche hat hier nichts zu suchen. */
  const checked = new Set(input.challengeDays)
  const start = weekStart(input.week)
  const dayDates = start ? Array.from({ length: 7 }, (_, index) => addDays(start, index)) : []
  const daySteps: ImpulseMilestoneStep[] = dayDates.map((date) => {
    const key = format(date, 'yyyy-MM-dd')
    const done = checked.has(key)
    return {
      id: key,
      label: formatDayShort(date),
      done,
      note: done
        ? undefined
        : key === input.today
          ? 'heute'
          : key > input.today
            ? 'kommt noch'
            : undefined,
    }
  })
  const daysDone = daySteps.filter((step) => step.done).length

  /* Karte und Vertiefung sind zwei Schritte – so summieren sich die
     Zeilen genau auf den Nenner des Scrollers («21 von 22»). */
  const cardSteps: ImpulseMilestoneStep[] = input.cards.flatMap((card) => [
    { id: card.id, label: card.title, done: card.seen },
    ...(card.deepening
      ? [
          {
            id: `${card.id}:vertiefung`,
            label: card.title,
            done: card.deepeningSeen,
            note: 'Vertiefung',
          },
        ]
      : []),
  ])
  const scrollerSeen = cardSteps.filter((step) => step.done).length

  return [
    {
      id: 'dabei',
      label: 'Dabei!',
      hint: 'Diese Woche in Anti Doom hineingeschaut.',
      earned: input.seen,
      progress: { value: input.seen ? 1 : 0, max: 1 },
      how:
        'Der erste Blick genügt: Einmal in dieser Woche «Anti Doom» geöffnet, ' +
        'und der Meilenstein gehört dir. Am Montag beginnt die Woche neu.',
      steps: [],
    },
    {
      id: 'mitgeredet',
      label: 'Mitgeredet',
      hint: 'Bei der Frage der Woche geantwortet.',
      earned: input.question?.answered === true,
      progress: { value: input.question?.answered ? 1 : 0, max: 1 },
      how: input.question
        ? 'Sobald deine eigene Antwort bei der Frage der Woche steht. ' +
          'Danach siehst du auch, was die anderen geschrieben haben.'
        : 'Diese Woche ist keine Frage aufgeschaltet – der Meilenstein wartet auf die nächste.',
      steps: input.question
        ? [{ id: 'frage', label: input.question.title, done: input.question.answered }]
        : [],
    },
    {
      id: 'challenge',
      label: 'Tageschallenge erreicht',
      hint: 'Alle sieben Tage der Tages-Challenge abgehakt.',
      earned: daysDone >= 7,
      progress: { value: daysDone, max: 7 },
      how:
        'Für jeden Tag ein Haken auf der Tages-Challenge; alle sieben ergeben ' +
        'den Meilenstein. Künftige Tage warten, bis sie da sind.',
      steps: daySteps,
    },
    {
      id: 'scroller',
      label: 'Anti Doom Scroller',
      hint: 'Alle Karten der Woche samt Vertiefungen angeschaut.',
      earned: cardSteps.length > 0 && scrollerSeen >= cardSteps.length,
      progress: { value: scrollerSeen, max: cardSteps.length },
      how: cardSteps.length
        ? 'Jede Karte der Woche zählt, sobald sie im Feed offen war – Karten mit ' +
          'Vertiefung zusätzlich mit ihrer Vertiefung.'
        : 'Diese Woche stehen noch keine Karten – sobald welche da sind, zählt jede angeschaute mit.',
      steps: cardSteps,
    },
  ]
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
  /** Antworten und Beiträge – beides trägt Konto, Vorname und Inhalt. */
  answers: Pick<ImpulseAnswer, 'itemId' | 'uid' | 'firstName'>[],
  weekOfItem: (itemId: string) => string | null,
  week: string,
): { uid: string; firstName: string }[] {
  const byUid = new Map<string, string>()
  for (const progress of progressDocs) {
    const state = progress.weeks?.[week]
    if (
      state?.goal === true ||
      (state?.days?.length ?? 0) > 0 ||
      state?.feed === true ||
      state?.share === true
    ) {
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

/**
 * Eine Liste mischen – gleich gemischt, solange der Schlüssel gleich bleibt.
 *
 * Für die Zufalls-Reihenfolge der Anti-Doom-Karten: Der Schlüssel ist Konto
 * plus Woche, darum liegt der Stapel die ganze Woche über gleich – wer die
 * Seite neu öffnet, findet die Karten wieder, wo sie waren, und der Sprung
 * aus dem Menü zu einer bestimmten Karte trifft. Erst die neue Woche
 * mischt neu. Fisher-Yates über einem kleinen eingebetteten
 * Zufallsgenerator (mulberry32), gefüttert mit einem FNV-1a-Hash des
 * Schlüssels – gut genug zum Kartenmischen, und ohne Abhängigkeit.
 */
export function seededShuffle<T>(list: readonly T[], seed: string): T[] {
  let state = 2166136261
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i)
    state = Math.imul(state, 16777619)
  }
  const random = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Das Wochen-Wappen                                                   */
/* ------------------------------------------------------------------ */

/*
 * Das Wappen der Woche baut sich mit jeder geschafften Karte auf – und
 * steht erst ganz da, wenn **alle** Karten des Feeds geschafft sind.
 * Geschafft heisst «vollständig»: angeschaut, und wo es etwas zu tun
 * gibt, auch getan – die Frage beantwortet, die Umfrage abgestimmt, das
 * Puzzle gebaut, die Teilen-Aufgabe abgehakt –, und eine Vertiefung, wo
 * es eine gibt, ebenfalls angeschaut. Das Wochenziel und die
 * Tages-Challenge liegen nicht im Feed; sie bringen die Sterne über dem
 * Wappen (`impulseCrestStars`).
 *
 * Gerechnet wird beim Lesen, wie bei Serie und Meilensteinen: Was fehlt,
 * lässt sich jederzeit aufzählen – und für die Gruppenleiste genauso für
 * alle anderen, aus denselben Daten.
 */

/** Arten, bei denen Anschauen nicht genügt – es braucht eine Antwort. */
const ANSWER_KINDS: readonly ImpulseKind[] = ['quiz', 'bilderraetsel', 'umfrage', 'puzzle', 'frage']

export interface ImpulseCrestStep {
  itemId: string
  kind: ImpulseKind
  title: string
  done: boolean
  /** Was an dieser Karte noch fehlt – «anschauen», «antworten», «Vertiefung», «abhaken». */
  missing: string[]
}

export function impulseCrestSteps(input: {
  /** Die Karten des Feeds, in Feed-Reihenfolge. */
  cards: readonly Pick<ImpulseItem, 'id' | 'kind' | 'title' | 'deepening'>[]
  /** Angeschaute Karten und Vertiefungen der Woche (Inhalts-IDs). */
  seen: ReadonlySet<string>
  deepened: ReadonlySet<string>
  /** Beantwortete Karten: Quiz, Umfrage, Puzzle, Frage der Woche (Inhalts-IDs). */
  answered: ReadonlySet<string>
  /** Die Teilen-Aufgabe der Woche abgehakt. */
  shared: boolean
}): ImpulseCrestStep[] {
  return input.cards.map((card) => {
    const missing: string[] = []
    if (card.kind === 'teilen') {
      if (!input.shared) missing.push('abhaken')
    } else if (ANSWER_KINDS.includes(card.kind)) {
      if (!input.answered.has(card.id))
        missing.push(
          card.kind === 'umfrage' ? 'abstimmen' : card.kind === 'puzzle' ? 'lösen' : 'antworten',
        )
    } else if (!input.seen.has(card.id)) {
      missing.push('anschauen')
    }
    if (card.deepening && !input.deepened.has(card.id)) missing.push('Vertiefung')
    return {
      itemId: card.id,
      kind: card.kind,
      title: card.title,
      done: missing.length === 0,
      missing,
    }
  })
}

/** Steht das Wappen ganz da? Eine Woche ohne Karten hat keines. */
export function crestComplete(steps: readonly Pick<ImpulseCrestStep, 'done'>[]): boolean {
  return steps.length > 0 && steps.every((step) => step.done)
}

/**
 * Die drei Sterne über dem Wappen – je einer für:
 *
 * - **Bereit für Sonntag:** das Wappen vor dem Sonntag vollendet. Genau
 *   das ist der Sinn der Woche – vorbereitet in die Klasse kommen.
 * - **Wochenziel** geschafft.
 * - **Tages-Challenge** an allen sieben Tagen.
 *
 * `null` heisst: Diesen Stern gibt es diese Woche nicht (kein Wochenziel,
 * keine Tages-Challenge) – die Anzeige lässt ihn dann weg, statt einen
 * Stern zu zeigen, den niemand holen kann.
 */
export interface ImpulseCrestStars {
  sunday: boolean
  goal: boolean | null
  challenge: boolean | null
}

export function impulseCrestStars(input: {
  week: string
  complete: boolean
  /** Der Tag, an dem das Wappen zuerst ganz dastand («2026-10-08») – oder `null`. */
  completedOn: string | null
  goal: boolean | null
  /** Abgehakte Tage der Tages-Challenge – oder `null`, wenn es keine gibt. */
  challengeDays: number | null
}): ImpulseCrestStars {
  const end = weekEnd(input.week)
  const sunday = end ? format(end, 'yyyy-MM-dd') : null
  return {
    sunday:
      input.complete && sunday !== null && input.completedOn !== null && input.completedOn < sunday,
    goal: input.goal,
    challenge: input.challengeDays === null ? null : input.challengeDays >= 7,
  }
}

/**
 * Wer sein Wappen diese Woche schon vollendet hat – für die
 * Gruppenleiste. Gerechnet für jede Person aus ihrem Fortschritt und
 * ihren Antworten, mit denselben Regeln wie für einen selbst. Nur wer
 * es geschafft hat, steht da; wer noch unterwegs ist, wird nicht genannt.
 */
export function crestCompleters(input: {
  week: string
  cards: readonly Pick<ImpulseItem, 'id' | 'kind' | 'title' | 'deepening'>[]
  progressDocs: readonly ImpulseProgress[]
  /** Antworten (Quiz, Umfrage, Puzzle) und Beiträge (Frage der Woche) aller. */
  answers: readonly Pick<ImpulseAnswer, 'itemId' | 'uid'>[]
}): { uid: string; firstName: string }[] {
  if (input.cards.length === 0) return []
  const cardIds = new Set(input.cards.map((card) => card.id))
  const answeredBy = new Map<string, Set<string>>()
  for (const answer of input.answers) {
    if (!cardIds.has(answer.itemId)) continue
    const set = answeredBy.get(answer.uid) ?? new Set<string>()
    set.add(answer.itemId)
    answeredBy.set(answer.uid, set)
  }
  return input.progressDocs
    .filter((progress) => {
      const state = progress.weeks?.[input.week]
      if (!state) return false
      return crestComplete(
        impulseCrestSteps({
          cards: input.cards,
          seen: new Set(state.cards ?? []),
          deepened: new Set(state.deepened ?? []),
          answered: answeredBy.get(progress.uid) ?? new Set(),
          shared: state.share === true,
        }),
      )
    })
    .map((progress) => ({ uid: progress.uid, firstName: progress.firstName || '–' }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName, 'de'))
}

/**
 * Wie viele Tage es noch bis zum Sonntag der Woche sind – 6 am Montag,
 * 0 am Sonntag selbst; `null` für einen unbrauchbaren Schlüssel. Eine
 * vergangene Woche ergibt eine negative Zahl.
 */
export function daysUntilSunday(week: string, today: Date | number): number | null {
  const end = weekEnd(week)
  return end ? differenceInCalendarDays(end, today) : null
}
