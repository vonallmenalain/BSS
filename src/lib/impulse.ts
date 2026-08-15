import { addDays, format, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import { formatDayMonth, formatDayMonthYear, formatDayShort } from './dates.ts'
import type {
  ImpulseAnswer,
  ImpulseItem,
  ImpulseKind,
  ImpulseProgress,
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
 * Die Lesereihenfolge innerhalb einer Woche – zuerst der Impuls, dann die
 * beiden Aufgaben neben dem Feed (Ziel und Tages-Challenge), dann die
 * übrigen Feed-Karten: Quiz, Bilderrätsel, Frage, Feed – und zum Schluss
 * die Teilen-Aufgabe, die Einladung zum Weitererzählen.
 */
export const IMPULSE_KIND_ORDER: ImpulseKind[] = [
  'impuls',
  'wochenziel',
  'tageschallenge',
  'quiz',
  'bilderraetsel',
  'video',
  'frage',
  'feed',
  'teilen',
]

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
 * Der Platz, an dem eine neue Karte dieser Art einsteigt: hinter der
 * letzten. Gezählt wird über die vergebenen Plätze **und** die Zahl der
 * Karten – so rutscht auch dann nichts nach vorn, wenn eine Karte noch
 * ohne Platz dasteht oder die Reihe eine Lücke hat.
 */
export function nextImpulseOrder(
  items: Pick<ImpulseItem, 'week' | 'kind' | 'order'>[],
  week: string,
  kind: ImpulseKind,
): number {
  const same = items.filter((item) => item.week === week && item.kind === kind)
  return same.reduce((max, item) => Math.max(max, item.order ?? 0), same.length) + 1
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
 */
export function readyProblems(item: {
  kind: ImpulseKind
  title: string
  source?: ImpulseSource | null
  quiz?: ImpulseQuiz | null
  image?: { url: string } | null
  videoUrl?: string | null
}): string[] {
  const problems: string[] = []
  if (!item.title.trim())
    problems.push(
      item.kind === 'quiz' || item.kind === 'frage' || item.kind === 'bilderraetsel'
        ? 'Die Frage fehlt.'
        : 'Der Titel fehlt.',
    )
  const sourceRequired = item.kind === 'impuls' || item.kind === 'quiz'
  if (sourceRequired && !item.source?.label.trim()) problems.push('Die Quelle fehlt.')

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
