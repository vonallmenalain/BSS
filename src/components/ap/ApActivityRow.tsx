import type { ComponentType } from 'react'
import {
  CalendarOff,
  ChevronRight,
  Clock,
  GraduationCap,
  Info,
  MapPin,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateLong, formatDayShort, formatDateShort } from '@/lib/dates'
import { fromIsoDate } from '@/services/importHistory'
import { AP_ACTIVITY_KIND_LABELS, type ApActivity, type ApActivityKind } from '@/lib/types'

/**
 * Die Darstellung eines Termins – einmal als Zeile im Plan, einmal gross
 * als «das kommt als Nächstes».
 *
 * Beide zeigen dasselbe und unterscheiden sich nur im Gewicht. Der Plan
 * ist eine Liste, eine Zeile je Termin – so wie die Tabelle, aus der er
 * stammt: Datum steht unter Datum, Treffpunkt unter Treffpunkt, und ein
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

function Detail({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  className?: string
}) {
  if (!value.trim()) return null
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)} title={label}>
      <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden />
      <span className="truncate">{value.trim()}</span>
    </span>
  )
}

/**
 * Treffpunkt, Leitung und wer dabei ist.
 *
 * Alles in einer Zeile und nur, was ausgefüllt ist: Der Plan ist an vielen
 * Stellen lückenhaft, und leere Beschriftungen machen eine Karte unruhig,
 * ohne etwas zu sagen.
 */
export function ApDetails({ activity, className }: { activity: ApActivity; className?: string }) {
  const hasAny = [activity.location, activity.leader, activity.bishopric, activity.advisor].some(
    (value) => (value ?? '').trim(),
  )
  if (!hasAny) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <Detail icon={MapPin} label="Treffpunkt" value={activity.location ?? ''} />
      <Detail icon={UserRound} label="Leitung" value={activity.leader ?? ''} />
      <Detail icon={Users} label="Teilnahme Bischofschaft" value={activity.bishopric ?? ''} />
      <Detail icon={UserRound} label="Teilnahme Berater" value={activity.advisor ?? ''} />
    </div>
  )
}

/**
 * Eine Spalte der Zeile.
 *
 * Eine leere Angabe lässt die Spalte trotzdem stehen, statt die folgenden
 * aufrücken zu lassen: Sonst steht in derselben Spalte einmal der
 * Treffpunkt und einmal die Leitung, und die Liste ist keine mehr. Wo es
 * für Spalten zu schmal wird und die Angaben ohnehin umbrechen,
 * verschwindet die leere Spalte ganz.
 */
function Column({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  if (!value.trim()) return <span className="hidden @4xl:block" aria-hidden />
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={label}>
      <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden />
      <span className="truncate">{value.trim()}</span>
    </span>
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

      {/* Ob die Angaben nebeneinander in Spalten stehen, entscheidet die
          Breite der Zeile selbst und nicht die des Fensters: Mit
          Seitenleiste bleibt vom Fenster deutlich weniger übrig, und eine
          gequetschte Spalte ist schlechter als eine umgebrochene Zeile. */}
      <span className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 @4xl:grid-cols-[7rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Datum – der Monat steht über der Gruppe, hier genügen Wochentag und Tag. */}
        <span
          className="tabular flex items-center gap-2 text-sm font-medium whitespace-nowrap text-slate-600 dark:text-slate-300"
          title={AP_ACTIVITY_KIND_LABELS[activity.kind]}
        >
          <Icon className={cn('size-4 shrink-0', style.text)} aria-hidden />
          {formatDayShort(start)}
        </span>

        {/* Aktivität – Uhrzeit und mehrtägige Anlässe stehen daneben, weil
            beides selten vorkommt und keine eigene Spalte verdient. */}
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={cn(
                'min-w-0 truncate text-sm font-semibold',
                cancelled && 'text-slate-500 line-through dark:text-slate-400',
                !activity.title.trim() && !cancelled && 'font-normal text-slate-400 italic',
              )}
            >
              {apTitle(activity)}
            </span>
            {activity.time?.trim() && (
              <span
                className="tabular inline-flex shrink-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
                title="Uhrzeit"
              >
                <Clock className="size-3.5 opacity-60" aria-hidden />
                {activity.time.trim()}
              </span>
            )}
            {multiDay && (
              <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400">
                bis {formatDateShort(fromIsoDate(activity.endDate ?? activity.date))}
              </span>
            )}
          </span>

          {note && (
            <span
              className="mt-0.5 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400"
              title={note}
            >
              <Info className="mt-px size-3.5 shrink-0 opacity-60" aria-hidden />
              {/* Im Ansichtsmodus führt kein Klick weiter – dort steht die
                  Bemerkung ganz da, statt hinter drei Punkten. */}
              <span className={onOpen ? 'truncate' : 'whitespace-pre-line'}>{note}</span>
            </span>
          )}
        </span>

        {/* Die Angaben aus der Tabelle: auf breiten Geräten je eine Spalte,
            sonst umgebrochen unter der Aktivität. */}
        <span className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 @4xl:contents dark:text-slate-300">
          <Column icon={MapPin} label="Treffpunkt" value={activity.location ?? ''} />
          <Column icon={UserRound} label="Leitung" value={activity.leader ?? ''} />
          <Column
            icon={Users}
            label="Teilnahme Bischofschaft / Berater"
            value={[activity.bishopric, activity.advisor]
              .map((value) => (value ?? '').trim())
              .filter(Boolean)
              .join(' · ')}
          />
        </span>
      </span>
    </>
  )

  const shell = cn(
    '@container relative flex w-full items-center gap-2 py-2.5 pr-3 pl-4 text-left',
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
        className="size-4 shrink-0 self-center text-slate-300 transition group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}
