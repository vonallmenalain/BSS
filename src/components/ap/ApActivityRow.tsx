import type { ComponentType } from 'react'
import { CalendarOff, ChevronRight, GraduationCap, Sparkles, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateLong, formatDayShort, formatDateShort } from '@/lib/dates'
import { fromIsoDate } from '@/services/importHistory'
import { AP_ACTIVITY_KIND_LABELS, type ApActivity, type ApActivityKind } from '@/lib/types'

/**
 * Die Darstellung eines Termins – einmal als Zeile im Plan, einmal gross
 * als «das kommt als Nächstes».
 *
 * Beide zeigen dasselbe und unterscheiden sich nur im Gewicht. Der Plan
 * ist eine Liste, ein Eintrag je Termin – oben das Datum und der Titel,
 * darunter die Angaben aus der Tabelle, jede mit ihrer Beschriftung. Ein
 * Blick von oben nach unten sagt, was der Monat bringt.
 */

/* ------------------------------------------------------------------ */
/* Art des Termins                                                     */
/* ------------------------------------------------------------------ */

interface KindStyle {
  icon: ComponentType<{ className?: string }>
  /** Etikett in der grossen Karte */
  chip: string
  /** Farbiger Streifen am linken Rand */
  bar: string
  /** Farbige Fläche hinter einem Symbol */
  block: string
  /** Farbe des Symbols in der Zeile */
  text: string
}

export const AP_KIND_STYLES: Record<ApActivityKind, KindStyle> = {
  activity: {
    icon: Users,
    chip: 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-100',
    bar: 'bg-brand-500',
    block: 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100',
    text: 'text-brand-600 dark:text-brand-300',
  },
  class: {
    icon: GraduationCap,
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    bar: 'bg-violet-500',
    block: 'bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    text: 'text-violet-600 dark:text-violet-300',
  },
  special: {
    icon: Sparkles,
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    bar: 'bg-amber-500',
    block: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    text: 'text-amber-600 dark:text-amber-400',
  },
  cancelled: {
    icon: CalendarOff,
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    bar: 'bg-slate-300 dark:bg-slate-700',
    block: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
    text: 'text-slate-400 dark:text-slate-500',
  },
}

/* ------------------------------------------------------------------ */
/* Beschriftungen                                                      */
/* ------------------------------------------------------------------ */

/**
 * Was in der Zeile steht, wenn noch kein Titel erfasst ist.
 *
 * «Noch offen» statt eines leeren Felds: Ein Mittwoch ohne Aktivität ist
 * keine Lücke im Plan, sondern eine Aufgabe – und die soll man sehen. Bei
 * der Klasse ist offen nur das Thema; dass sie stattfindet, steht fest.
 */
export function apTitle(activity: Pick<ApActivity, 'title' | 'kind'>): string {
  if (activity.title.trim()) return activity.title.trim()
  return activity.kind === 'class' ? 'Thema noch offen' : 'Noch offen'
}

/** «Mittwoch, 7. Januar 2026» – oder «Fr, 30.01. – Sa, 31.01.2026» */
export function apDateLabel(activity: Pick<ApActivity, 'date' | 'endDate'>): string {
  const start = fromIsoDate(activity.date)
  if (!activity.endDate || activity.endDate === activity.date) return formatDateLong(start)
  return `${formatDayShort(start)} – ${formatDateShort(fromIsoDate(activity.endDate))}`
}

/** «Heute», «Morgen», «In 5 Tagen», «Läuft» – oder «Vor 3 Tagen». */
export function apCountdown(days: number, running: boolean): string {
  if (running) return 'Läuft'
  if (days === 0) return 'Heute'
  if (days === 1) return 'Morgen'
  if (days === 2) return 'Übermorgen'
  if (days > 0) return `In ${days} Tagen`
  if (days === -1) return 'Gestern'
  return `Vor ${Math.abs(days)} Tagen`
}

/* ------------------------------------------------------------------ */
/* Einzelne Angabe                                                     */
/* ------------------------------------------------------------------ */

/**
 * «Treffpunkt: Gemeindehaus» – Beschriftung und Wert.
 *
 * Ausgeschrieben und nicht als Symbol: Der Plan trägt fünf Angaben, die
 * einander ähnlich sehen – wer leitet, wer aus der Bischofschaft kommt, wer
 * von den Beratern. Ein Symbol dafür müsste man erst lernen; ein Wort nicht.
 *
 * Eine leere Angabe fällt weg. Der Plan ist an vielen Stellen lückenhaft,
 * und eine Beschriftung ohne Wert sagt nichts.
 */
function Angabe({ label, value }: { label: string; value?: string | null }) {
  const text = (value ?? '').trim()
  if (!text) return null
  return (
    <span className="min-w-0">
      <span className="text-slate-400 dark:text-slate-500">{label}: </span>
      <span className="break-words">{text}</span>
    </span>
  )
}

/**
 * Treffpunkt, Leitung und wer dabei ist.
 *
 * Wer die Aktivität leitet, steht nur bei der AP-Klasse: Dort wechselt es
 * von Sonntag zu Sonntag und ist die eigentliche Auskunft. Bei den übrigen
 * Terminen führt ohnehin das Kollegium des Monats – das steht über der
 * Gruppe und muss nicht an jedem Termin wiederholt werden.
 */
export function ApDetails({ activity, className }: { activity: ApActivity; className?: string }) {
  const leader = activity.kind === 'class' ? (activity.leader ?? '') : ''
  const hasAny = [
    activity.time,
    activity.location,
    leader,
    activity.bishopric,
    activity.advisor,
  ].some((value) => (value ?? '').trim())
  if (!hasAny) return null

  return (
    <div className={cn('grid gap-x-6 gap-y-1 sm:grid-cols-2', className)}>
      <Angabe label="Startzeit" value={activity.time} />
      <Angabe label="Treffpunkt" value={activity.location} />
      <Angabe label="Leitung AP" value={leader} />
      <Angabe label="Teilnahme BSS" value={activity.bishopric} />
      <Angabe label="Teilnahme Berater" value={activity.advisor} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Zeile                                                               */
/* ------------------------------------------------------------------ */

export function ApActivityRow({
  activity,
  onOpen,
  highlight = false,
  past = false,
}: {
  activity: ApActivity
  /** Nur im Bearbeitungsmodus gesetzt – ohne bleibt die Zeile reine Anzeige. */
  onOpen?: () => void
  /** Der nächste Termin – bekommt in der Liste einen ruhigen Farbton */
  highlight?: boolean
  past?: boolean
}) {
  const style = AP_KIND_STYLES[activity.kind]
  const Icon = style.icon
  const start = fromIsoDate(activity.date)
  const cancelled = activity.kind === 'cancelled'
  const multiDay = Boolean(activity.endDate && activity.endDate !== activity.date)
  const note = activity.note?.trim() ?? ''

  const content = (
    <>
      <span className={cn('absolute inset-y-0 left-0 w-1', style.bar)} aria-hidden />

      {/* Datum links, alles Übrige rechts – aber erst, wenn die Zeile breit
          genug dafür ist. Ob das der Fall ist, entscheidet die Zeile selbst
          und nicht das Fenster: Mit Seitenleiste bleibt davon deutlich
          weniger übrig. Darunter steht das Datum über dem Titel. */}
      <span className="grid min-w-0 flex-1 gap-x-4 gap-y-1 @2xl:grid-cols-[9rem_minmax(0,1fr)]">
        {/* `self-start`, damit die Spalte nicht auf die Höhe der Angaben
            daneben wächst – sonst rutschte das Symbol in die Mitte und
            stünde unter dem Datum statt davor. */}
        <span className="tabular self-start" title={AP_ACTIVITY_KIND_LABELS[activity.kind]}>
          <span className="flex items-center gap-2 text-sm font-medium whitespace-nowrap text-slate-600 dark:text-slate-300">
            <Icon className={cn('size-4 shrink-0', style.text)} aria-hidden />
            {formatDayShort(start)}
          </span>
          {/* Der Enddatum-Zusatz steht darunter: In einer Zeile mit dem Datum
              liefe er in den Titel hinein. */}
          {multiDay && (
            <span className="block pl-6 text-xs font-medium text-amber-700 dark:text-amber-400">
              bis {formatDateShort(fromIsoDate(activity.endDate ?? activity.date))}
            </span>
          )}
        </span>

        <span className="min-w-0">
          {/* Der Titel bekommt die ganze Zeile und wird nicht abgeschnitten:
              «Kleine Entscheidungen – grosse Konsequenzen» hinter drei
              Punkten sagt nichts mehr. Er bricht lieber um. */}
          <span
            className={cn(
              'block text-sm font-semibold break-words',
              cancelled && 'text-slate-500 line-through dark:text-slate-400',
              !activity.title.trim() && !cancelled && 'font-normal text-slate-400 italic',
            )}
          >
            {apTitle(activity)}
          </span>

          <ApDetails
            activity={activity}
            className="mt-1 text-xs text-slate-600 dark:text-slate-300"
          />

          {note && (
            <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 dark:text-slate-500">Bemerkung: </span>
              <span className="break-words whitespace-pre-line">{note}</span>
            </span>
          )}
        </span>
      </span>
    </>
  )

  const shell = cn(
    // Lieber genug Luft als alles hineingequetscht: Ein Termin trägt bis zu
    // sechs Angaben, und die Liste wird zu Hause am Küchentisch gelesen.
    '@container relative flex w-full items-start gap-2 py-3.5 pr-3 pl-4 text-left',
    highlight && 'bg-brand-50/70 dark:bg-brand-950/40',
    past && 'opacity-60',
  )

  /* Ansichtsmodus: eine Zeile, die nichts verspricht, was sie nicht hält. */
  if (!onOpen) return <div className={shell}>{content}</div>

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(shell, 'group transition hover:bg-slate-50 dark:hover:bg-slate-800/60')}
    >
      {content}
      <ChevronRight
        className="mt-0.5 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}
