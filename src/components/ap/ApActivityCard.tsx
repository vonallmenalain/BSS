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
 * Die Darstellung eines Termins – einmal als Kachel im Plan, einmal gross
 * als «das kommt als Nächstes».
 *
 * Beide zeigen dasselbe und unterscheiden sich nur im Gewicht. Das ist
 * Absicht: Wer die grosse Karte gelesen hat, findet in der Kachel dieselben
 * Angaben an derselben Stelle wieder.
 */

/* ------------------------------------------------------------------ */
/* Art des Termins                                                     */
/* ------------------------------------------------------------------ */

interface KindStyle {
  icon: ComponentType<{ className?: string }>
  /** Etikett in der Kachel */
  chip: string
  /** Farbiger Streifen am linken Rand */
  bar: string
  /** Datumsblock der Kachel */
  block: string
}

export const AP_KIND_STYLES: Record<ApActivityKind, KindStyle> = {
  activity: {
    icon: Users,
    chip: 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-100',
    bar: 'bg-brand-500',
    block: 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100',
  },
  class: {
    icon: GraduationCap,
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    bar: 'bg-violet-500',
    block: 'bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  },
  special: {
    icon: Sparkles,
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    bar: 'bg-amber-500',
    block: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  },
  cancelled: {
    icon: CalendarOff,
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    bar: 'bg-slate-300 dark:bg-slate-700',
    block: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  },
}

/* ------------------------------------------------------------------ */
/* Beschriftungen                                                      */
/* ------------------------------------------------------------------ */

/**
 * Was in der Kachel steht, wenn noch kein Titel erfasst ist.
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
 * Stellen lückenhaft, und leere Beschriftungen machen eine Kachel unruhig,
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

/* ------------------------------------------------------------------ */
/* Kachel                                                              */
/* ------------------------------------------------------------------ */

export function ApActivityCard({
  activity,
  onOpen,
  highlight = false,
  past = false,
}: {
  activity: ApActivity
  onOpen: () => void
  /** Der nächste Termin – bekommt einen Ring, damit er in der Liste auffällt */
  highlight?: boolean
  past?: boolean
}) {
  const style = AP_KIND_STYLES[activity.kind]
  const Icon = style.icon
  const start = fromIsoDate(activity.date)
  const cancelled = activity.kind === 'cancelled'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'card card-hover group relative flex w-full gap-3 overflow-hidden p-3 text-left',
        highlight && 'ring-brand-500 ring-2',
        past && 'opacity-60',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', style.bar)} aria-hidden />

      {/* Datumsblock – Wochentag und Tag genügen, der Monat steht über der Gruppe. */}
      <span
        className={cn(
          'ml-1 grid size-12 shrink-0 place-items-center rounded-lg leading-none',
          style.block,
        )}
        aria-hidden
      >
        <span className="text-[10px] font-medium uppercase opacity-70">
          {formatDayShort(start).slice(0, 2)}
        </span>
        <span className="tabular text-lg font-semibold">{activity.date.slice(8)}</span>
      </span>

      <span className="min-w-0 flex-1">
        {/* Der Titel bekommt die ganze Breite und darf umbrechen: Er ist das
            Einzige, was man aus der Ferne liest, und «Dienstprojekt: Frauenh…»
            beantwortet keine Frage. Die Art steht darunter bei den übrigen
            Angaben – die Farbe des Datumsblocks sagt sie ohnehin schon. */}
        <span
          className={cn(
            'line-clamp-2 block text-sm leading-snug font-semibold text-balance',
            cancelled && 'text-slate-500 line-through dark:text-slate-400',
            !activity.title.trim() && !cancelled && 'font-normal text-slate-400 italic',
          )}
        >
          {apTitle(activity)}
        </span>

        {activity.endDate && activity.endDate !== activity.date && (
          <span className="mt-0.5 block text-xs font-medium text-amber-700 dark:text-amber-400">
            bis {formatDateShort(fromIsoDate(activity.endDate))}
          </span>
        )}

        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <span className={cn('badge', style.chip)}>
            <Icon className="size-3" aria-hidden />
            {AP_ACTIVITY_KIND_LABELS[activity.kind]}
          </span>
          {activity.time?.trim() && (
            <span className="tabular inline-flex items-center gap-1.5" title="Uhrzeit">
              <Clock className="size-3.5 shrink-0 opacity-60" aria-hidden />
              {activity.time.trim()}
            </span>
          )}
        </span>

        <ApDetails
          activity={activity}
          className="mt-1 text-xs text-slate-600 dark:text-slate-300"
        />

        {activity.note?.trim() && (
          <span className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Info className="mt-0.5 size-3.5 shrink-0 opacity-60" aria-hidden />
            <span className="line-clamp-2 whitespace-pre-line">{activity.note.trim()}</span>
          </span>
        )}
      </span>

      <ChevronRight
        className="size-4 shrink-0 self-center text-slate-300 transition group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}
