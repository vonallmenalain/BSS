import { addDays, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import { formatDayMonth, formatDayMonthYear } from './dates.ts'
import type { ImpulseItem, ImpulseKind, ImpulseQuiz, ImpulseSource } from './types.ts'

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

/** Impuls vor Quiz – die Lesereihenfolge innerhalb einer Woche. */
export const IMPULSE_KIND_ORDER: ImpulseKind[] = ['impuls', 'quiz']

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
 * bloss als Entwurf. Die Quelle ist Pflicht: Der Bereich lebt von
 * offiziellem Material, und der Sprung zur Quelle ist sein Ziel.
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
  if (!item.source?.label.trim()) problems.push('Die Quelle fehlt.')

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
