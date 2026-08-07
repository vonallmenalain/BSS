import type { ComponentType } from 'react'
import { CalendarOff, ChevronRight, GraduationCap, Sparkles, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateLong, formatDayShort, formatDateShort } from '@/lib/dates'
import { fromIsoDate } from '@/services/importHistory'
import {
  AP_ACTIVITY_KIND_LABELS,
  apEndTime,
  apTimeLabel,
  type ApActivity,
  type ApActivityKind,
  type ApView,
} from '@/lib/types'

/** Die drei Abstufungen von «wie viel Luft» – siehe `AP_SPACING`. */
export type ApDensity = ApView['density']

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
/* Abstand                                                             */
/* ------------------------------------------------------------------ */

/**
 * Wie viel Luft der Plan bekommt.
 *
 * Derselbe Plan wird sehr verschieden gelesen: am Telefon unterwegs, wo
 * jede Zeile zählt, und am Küchentisch, wo man ihn überfliegt. Deshalb
 * nicht ein Kompromiss für beide, sondern drei Stufen – sie ändern Polster,
 * Abstände und Schriftgrad zugleich, denn einzeln ergäbe keine davon ein
 * stimmiges Bild.
 */
export interface ApSpacing {
  /** Polster einer Listenzeile */
  row: string
  /** Polster einer Kachel */
  card: string
  /** Schriftgrad des Titels */
  title: string
  /** Schriftgrad der Angaben darunter */
  details: string
  /** Abstand zwischen den Monatsgruppen */
  sections: string
  /**
   * Raster der Kachelansicht, samt Abstand.
   *
   * Wie viele Kacheln nebeneinander stehen, hängt an derselben Stufe wie
   * Polster und Schriftgrad – und zwar umgekehrt: «Kompakt» will viel auf
   * einen Blick und stellt bis zu drei nebeneinander, «Weit» will eine
   * Kachel lesen und stellt sie über die ganze Breite. Zwei Stufen, die
   * beide drei Spalten zeigen, wären zweimal dieselbe Ansicht.
   */
  grid: string
}

export const AP_SPACING: Record<ApDensity, ApSpacing> = {
  compact: {
    row: 'py-2 pr-3 pl-3.5',
    card: 'p-3',
    title: 'text-sm',
    details: 'mt-0.5 text-[11px]',
    sections: 'space-y-4',
    grid: 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3',
  },
  normal: {
    row: 'py-3.5 pr-3 pl-4',
    card: 'p-4',
    title: 'text-sm',
    details: 'mt-1 text-xs',
    sections: 'space-y-6',
    grid: 'grid gap-3 sm:grid-cols-2',
  },
  wide: {
    row: 'py-5 pr-4 pl-5',
    card: 'p-5',
    title: 'text-base',
    details: 'mt-2 text-sm',
    sections: 'space-y-9',
    grid: 'grid gap-4',
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
 * Treffpunkt, Zuständigkeit und wer dabei ist.
 *
 * «Zuständig» steht bei jeder Art von Termin. Früher nur bei der Klasse:
 * Bei den übrigen führe ohnehin das Kollegium des Monats, hiess es. Das
 * stimmt für die Führung, nicht für die Zuständigkeit – wer eine Aktivität
 * organisiert, steht im Plan, und wer ihn liest, sucht genau diesen Namen.
 */
export function ApDetails({
  activity,
  className,
  columns = true,
  withTime = true,
}: {
  activity: ApActivity
  className?: string
  /** Zwei Spalten, sobald Platz ist – in einer schmalen Kachel eine */
  columns?: boolean
  /**
   * Die Startzeit mit aufführen.
   *
   * Aus: Wo die Zeit schon vor dem Titel steht – im Kalender etwa, der sich
   * wie ein Fahrplan liest –, stünde sie hier ein zweites Mal.
   */
  withTime?: boolean
}) {
  /* Die übliche Zeit zählt mit: Bei der Klasse steht «11:00 – 12:00» auch
     dann da, wenn am Termin nichts erfasst ist. Steht kein Ende im Plan,
     bleibt es beim Beginn – und die Beschriftung sagt es. */
  const time = apTimeLabel(activity)

  const hasAny = [
    withTime ? time : '',
    activity.location,
    activity.leader,
    activity.bishopric,
    activity.advisor,
  ].some((value) => (value ?? '').trim())
  if (!hasAny) return null

  return (
    <div className={cn('grid gap-x-6 gap-y-1', columns && 'sm:grid-cols-2', className)}>
      {withTime && <Angabe label={apEndTime(activity) ? 'Zeit' : 'Startzeit'} value={time} />}
      <Angabe label="Treffpunkt" value={activity.location} />
      <Angabe label="Zuständig" value={activity.leader} />
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
  density = 'normal',
}: {
  activity: ApActivity
  /** Nur im Bearbeitungsmodus gesetzt – ohne bleibt die Zeile reine Anzeige. */
  onOpen?: () => void
  /** Der nächste Termin – bekommt in der Liste einen ruhigen Farbton */
  highlight?: boolean
  past?: boolean
  density?: ApDensity
}) {
  const spacing = AP_SPACING[density]
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
              'block font-semibold break-words',
              spacing.title,
              cancelled && 'text-slate-500 line-through dark:text-slate-400',
              !activity.title.trim() && !cancelled && 'font-normal text-slate-400 italic',
            )}
          >
            {apTitle(activity)}
          </span>

          <ApDetails
            activity={activity}
            className={cn(spacing.details, 'text-slate-600 dark:text-slate-300')}
          />

          {note && (
            <span className={cn('block text-slate-600 dark:text-slate-300', spacing.details)}>
              <span className="text-slate-400 dark:text-slate-500">Bemerkung: </span>
              <span className="break-words whitespace-pre-line">{note}</span>
            </span>
          )}
        </span>
      </span>
    </>
  )

  const shell = cn(
    // Wie viel Luft, entscheidet die gewählte Stufe: Ein Termin trägt bis zu
    // sechs Angaben, und der Plan wird ebenso am Telefon gelesen wie zu
    // Hause am Küchentisch.
    '@container relative flex w-full items-start gap-2 text-left',
    spacing.row,
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

/* ------------------------------------------------------------------ */
/* Kachel                                                              */
/* ------------------------------------------------------------------ */

/**
 * Derselbe Termin als Kachel.
 *
 * Die Liste ist ein Fahrplan – ein Blick von oben nach unten sagt, was der
 * Monat bringt. Die Kachel ist das Gegenstück: Sie stellt jeden Termin für
 * sich hin, mit Datum, Art und allen Angaben untereinander. Auf einem
 * breiten Bildschirm stehen mehrere nebeneinander, und man sieht mehr
 * Wochen auf einmal, als eine Liste zeigen könnte.
 *
 * Es fehlt nichts, was die Zeile hat: Datum samt Enddatum, Art, Titel, die
 * fünf Angaben und die Bemerkung. Was in der Liste nur ein farbiger
 * Streifen ist, wird hier zum angeschriebenen Etikett – ohne die
 * Nachbarzeilen daneben liesse sich eine Farbe allein nicht deuten.
 */
export function ApActivityCard({
  activity,
  onOpen,
  highlight = false,
  past = false,
  density = 'normal',
}: {
  activity: ApActivity
  onOpen?: () => void
  highlight?: boolean
  past?: boolean
  density?: ApDensity
}) {
  const spacing = AP_SPACING[density]
  const style = AP_KIND_STYLES[activity.kind]
  const Icon = style.icon
  const cancelled = activity.kind === 'cancelled'
  const note = activity.note?.trim() ?? ''

  const content = (
    <>
      <span className={cn('absolute inset-x-0 top-0 h-1', style.bar)} aria-hidden />

      <span className="flex flex-wrap items-center gap-2">
        <span className={cn('badge', style.chip)}>
          <Icon className="size-3" aria-hidden />
          {AP_ACTIVITY_KIND_LABELS[activity.kind]}
        </span>
        <span className="tabular ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
          {apDateLabel(activity)}
        </span>
      </span>

      <span
        className={cn(
          'mt-2 block font-semibold break-words',
          spacing.title,
          cancelled && 'text-slate-500 line-through dark:text-slate-400',
          !activity.title.trim() && !cancelled && 'font-normal text-slate-400 italic',
        )}
      >
        {apTitle(activity)}
      </span>

      <ApDetails
        activity={activity}
        columns={false}
        className={cn(spacing.details, 'text-slate-600 dark:text-slate-300')}
      />

      {note && (
        <span className={cn('block text-slate-600 dark:text-slate-300', spacing.details)}>
          <span className="text-slate-400 dark:text-slate-500">Bemerkung: </span>
          <span className="break-words whitespace-pre-line">{note}</span>
        </span>
      )}
    </>
  )

  const shell = cn(
    'card relative flex w-full flex-col overflow-hidden text-left',
    spacing.card,
    highlight && 'border-brand-300 dark:border-brand-800',
    past && 'opacity-60',
  )

  if (!onOpen) return <div className={shell}>{content}</div>

  return (
    <button type="button" onClick={onOpen} className={cn(shell, 'card-hover group')}>
      {content}
    </button>
  )
}
