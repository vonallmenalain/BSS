import { useMemo, useState } from 'react'
import { ArrowRight, CalendarClock, ChevronRight, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useMeetings } from '@/hooks/useFirestore'
import { Modal } from '@/components/ui/Modal'
import { formatDateShort, toDate } from '@/lib/dates'
import {
  DEFER_WEEKS,
  deferBase,
  deferByWeeks,
  deferWaits,
  fromDayKey,
  meetingFrom,
  weeksLabel,
} from '@/lib/defer'
import {
  addDays,
  dayKey,
  deferMarkIn,
  deferMarkOf,
  isDayKey,
  type StandingMeeting,
} from '@/lib/standing'
import type { AgendaItem } from '@/lib/types'
import { deferItem, undoDefer } from '@/services/agenda'

interface Props {
  item: AgendaItem
  /** Sitzung, auf die verschoben wird – ohne sie geht es in den Sammelkorb */
  nextMeeting?: { id: string; date: Date } | null
  className?: string
  /** Nur das Symbol, ohne Beschriftung – für schmale Leisten */
  compact?: boolean
  onDone?: () => void
}

/**
 * «Verschieben» – der Knopf, der das Fenster mit den Zielen öffnet.
 *
 * Früher war es ein einziger Griff: auf die nächste Sitzung. Davor gab es
 * schon einmal mehr Ziele – eine Woche, einen Monat, ein freies Datum –, die
 * aber bloss ein Fälligkeitsdatum setzten, an dem nichts geschah. Jetzt
 * stehen sie wieder da, und diesmal mit Folgen: Wer um zwei Wochen oder auf
 * den 1. Januar verschiebt, findet den Punkt in der ersten Sitzung an oder
 * nach diesem Tag (siehe `lib/defer`). Ist so spät noch keine geplant,
 * wartet er unter «Pendenzen» und kommt mit der ersten Sitzung mit, die spät
 * genug liegt – einer früheren wird er gar nicht erst angeboten.
 *
 * In der Sitzung, aus der er kommt, bleibt er trotzdem stehen – grau und mit
 * einem Pfeil (siehe `DeferredBadge`). «Rückgängig» in der Meldung und
 * «Zurückholen» am Punkt nehmen das Verschieben zurück.
 */
export function DeferMenu({ item, nextMeeting, className, compact = false, onDone }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={cn('btn-secondary shrink-0', className)}
        onClick={() => setOpen(true)}
        title="Auf die nächste Sitzung, um ein paar Wochen oder auf ein Datum"
      >
        <CalendarClock className="size-4" aria-hidden />
        <span className={compact ? 'hidden sm:inline' : undefined}>Verschieben</span>
      </button>

      {/* Erst gezeichnet, wenn jemand hinsieht – so rechnet das Fenster mit
          dem heutigen Tag und den Sitzungen von jetzt. */}
      {open && (
        <DeferDialog
          item={item}
          nextMeeting={nextMeeting ?? null}
          onClose={() => setOpen(false)}
          onDone={onDone}
        />
      )}
    </>
  )
}

/** Wohin ein Ziel führt – in eine Sitzung oder, ohne sie, in den Sammelkorb. */
interface Target {
  /** Die Sitzung, in der der Punkt damit steht; `null` heisst: Sammelkorb */
  meeting: StandingMeeting | null
  /** Ab diesem Tag wieder dran; `null` heisst: einfach die nächste Sitzung */
  until: string | null
}

/** «Fr, 13.11.2026» aus «2026-11-13» */
function dayLabel(key: string): string {
  return formatDateShort(fromDayKey(key))
}

/** Was unter einem Ziel steht – wohin der Punkt damit kommt. */
function targetHint(target: Target): string {
  if (target.meeting) return `In die Sitzung vom ${dayLabel(target.meeting.date)}`
  if (target.until) {
    return `Noch keine Sitzung ab ${dayLabel(target.until)} geplant – wartet bis dahin unter «Pendenzen»`
  }
  return 'Noch keine Sitzung geplant – bleibt unter «Pendenzen»'
}

/**
 * Das Fenster mit den Zielen: die nächste Sitzung, ein bis vier Wochen
 * später oder ein Tag nach Wahl.
 *
 * Bei jedem Ziel steht, wo der Punkt damit landet. «Zwei Wochen» ist bei
 * einer Sitzung alle vierzehn Tage dieselbe Sitzung wie «eine Woche», und
 * ohne diese Zeile wäre das erst nach dem Griff zu sehen.
 *
 * Ein Griff auf eines der festen Ziele verschiebt sofort – wie früher der
 * Knopf allein. Nur das freie Datum braucht einen zweiten.
 */
function DeferDialog({
  item,
  nextMeeting,
  onClose,
  onDone,
}: {
  item: AgendaItem
  nextMeeting: { id: string; date: Date } | null
  onClose: () => void
  onDone?: () => void
}) {
  const { profile } = useAuth()
  const toast = useToast()
  // Weit genug voraus für jedes Datum, das jemand wählt – aus dem
  // gemeinsamen Bestand, ohne zusätzliche Abfrage (siehe `useStandingRound`).
  const { data: meetings } = useMeetings(200)
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState('')

  const today = dayKey(new Date())

  /** Die Sitzungen, die noch ein Ziel sein können – abgeschlossene nicht. */
  const open = useMemo<StandingMeeting[]>(
    () =>
      meetings
        .filter((meeting) => meeting.status !== 'closed')
        .map((meeting) => ({ id: meeting.id, date: toDate(meeting.date) }))
        .filter((entry): entry is { id: string; date: Date } => entry.date !== null)
        .map((entry) => ({ id: entry.id, date: dayKey(entry.date) }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    [meetings],
  )

  /** Der Tag der Sitzung, in der der Punkt gerade steht. */
  const currentDay = useMemo(() => {
    const date = toDate(meetings.find((meeting) => meeting.id === item.meetingId)?.date)
    return date ? dayKey(date) : null
  }, [meetings, item.meetingId])

  /*
   * «Nächste Sitzung» – die, die der Aufrufer meint, sofern sie nach der
   * Sitzung des Punktes liegt.
   *
   * In der Pendenzenliste ist das die erste geplante Sitzung überhaupt. Steht
   * der Punkt schon in ihr, wäre der Griff wirkungslos; steht er in einer
   * späteren, holte er ihn sogar nach vorn. Gemeint ist in beiden Fällen die
   * Sitzung nach der, in der er steht – und gibt es keine, der Sammelkorb.
   */
  const next = useMemo<Target>(() => {
    const index = open.findIndex((meeting) => meeting.id === item.meetingId)
    const own = index >= 0 ? open[index] : null
    if (nextMeeting && nextMeeting.id !== item.meetingId) {
      const day = dayKey(nextMeeting.date)
      if (!own || day >= own.date)
        return { meeting: { id: nextMeeting.id, date: day }, until: null }
    }
    return { meeting: own ? (open[index + 1] ?? null) : null, until: null }
  }, [nextMeeting, item.meetingId, open])

  const base = deferBase(currentDay, today)
  const byDay = (until: string): Target => ({
    meeting: meetingFrom(until, open, item.meetingId),
    until,
  })
  const weeks = DEFER_WEEKS.map((count) => ({
    count,
    target: byDay(deferByWeeks(base, count)),
  }))

  // Frühestens morgen: Auf heute zu verschieben hiesse, gar nicht zu verschieben.
  const earliest = addDays(today, 1)
  const customTarget = isDayKey(custom) && custom >= earliest ? byDay(custom) : null

  const run = async (target: Target) => {
    if (!profile) return
    const actor = { id: profile.id, name: profile.displayName }
    // Der Stand von jetzt – festgehalten, bevor das Verschieben ihn ändert.
    const from = item.meetingId
    const mark = deferMarkOf(item)
    const meetingId = target.meeting?.id ?? null
    setBusy(true)
    try {
      await deferItem(item, meetingId, actor, mark, target.until)
      const message = target.meeting
        ? `Auf die Sitzung vom ${dayLabel(target.meeting.date)} verschoben.`
        : target.until
          ? `Verschoben – erscheint in der ersten Sitzung ab ${dayLabel(target.until)}.`
          : 'In die Pendenzen verschoben – es ist noch keine Sitzung geplant.'
      // Zurück geht es nur dorthin, woher der Punkt kam: in eine Sitzung.
      if (from && from !== meetingId) {
        toast.undo(message, () =>
          undoDefer(item.id, from, mark, actor).then(
            () => undefined,
            (error: unknown) => {
              console.error(error)
              toast.error('Zurückholen fehlgeschlagen.')
            },
          ),
        )
      } else {
        toast.success(message)
      }
      onClose()
      onDone?.()
    } catch (error) {
      console.error(error)
      toast.error('Verschieben fehlgeschlagen.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Verschieben"
      description="Der Punkt erscheint in der ersten Sitzung an oder nach dem gewählten Tag."
      size="sm"
    >
      <div className="space-y-2">
        <DeferChoice
          label="Nächste Sitzung"
          hint={targetHint(next)}
          disabled={busy}
          onClick={() => void run(next)}
          autoFocus
        />
        {weeks.map(({ count, target }) => (
          <DeferChoice
            key={count}
            label={`${weeksLabel(count)} später`}
            hint={targetHint(target)}
            disabled={busy}
            onClick={() => void run(target)}
          />
        ))}

        <div className="rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-700">
          <label className="text-sm font-medium" htmlFor={`defer-date-${item.id}`}>
            Auf ein Datum
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={`defer-date-${item.id}`}
              type="date"
              className="input min-w-0 flex-1"
              min={earliest}
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
            <button
              type="button"
              className="btn-primary shrink-0"
              disabled={busy || !customTarget}
              onClick={() => customTarget && void run(customTarget)}
            >
              Verschieben
            </button>
          </div>
          <p className="hint mt-2">
            {customTarget
              ? `${targetHint(customTarget)}.`
              : 'Ab diesem Tag gehört der Punkt wieder in eine Sitzung.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}

/** Ein Ziel im Fenster – was es ist und wohin der Punkt damit kommt. */
function DeferChoice({
  label,
  hint,
  disabled,
  onClick,
  autoFocus = false,
}: {
  label: string
  hint: string
  disabled: boolean
  onClick: () => void
  /** Das Fenster beginnt hier und nicht im Datumsfeld (siehe `Modal`). */
  autoFocus?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-left transition',
        'hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60',
        'dark:border-slate-700 dark:hover:bg-brand-950',
      )}
      disabled={disabled}
      onClick={onClick}
      data-autofocus={autoFocus ? true : undefined}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
    </button>
  )
}

/**
 * «ab Fr, 01.01.2027» – ein Punkt, der auf einen späteren Tag verschoben
 * wurde und noch auf seine Sitzung wartet.
 *
 * Er steht ohne Sitzung unter «Pendenzen», und ohne dieses Etikett wäre
 * nicht zu erklären, warum ihn die nächste Sitzung nicht übernimmt. Steht er
 * in einer Sitzung, sagt deren Datum bereits, wann es weitergeht – dann fehlt
 * das Etikett.
 */
export function WaitingBadge({ item, className }: { item: AgendaItem; className?: string }) {
  const until = item.deferredUntil
  if (item.meetingId || !until || !deferWaits(item, dayKey(new Date()))) return null
  const label = dayLabel(until)
  return (
    <span
      className={cn(
        'badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        className,
      )}
      title={`Verschoben – erscheint in der ersten Sitzung ab ${label}`}
    >
      <CalendarClock className="size-3" aria-hidden />
      ab {label}
    </span>
  )
}

/**
 * «Verschoben» – das Gegenstück zum grünen Haken.
 *
 * Ein verschobener Punkt bleibt in der Sitzung stehen, aus der er kommt, und
 * trägt dort dieses graue Etikett mit dem Pfeil nach rechts: erledigt ist er
 * nicht, besprochen für heute schon. Wohin er gegangen ist, steht dabei,
 * sofern es die Liste weiss.
 */
export function DeferredBadge({
  item,
  meetingDate,
  className,
}: {
  item: AgendaItem
  /** Datum einer Sitzung als Text – für «auf den 28.10.» */
  meetingDate?: (meetingId: string) => string | undefined
  className?: string
}) {
  const target = item.meetingId ? meetingDate?.(item.meetingId) : undefined
  const label = item.meetingId
    ? target
      ? `Verschoben auf ${target}`
      : 'Auf nächste Sitzung verschoben'
    : 'In die Pendenzen verschoben'
  return (
    <span
      className={cn(
        'badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        className,
      )}
      title={label}
    >
      <ArrowRight className="size-3" aria-hidden />
      {label}
    </span>
  )
}

/**
 * «Zurückholen» – an einem Punkt, der aus dieser Sitzung verschoben wurde.
 *
 * Er kehrt zurück, wie er war: unter derselben Überschrift, am selben Platz.
 * Ist er inzwischen anderswo erledigt worden, gibt es nichts mehr
 * zurückzuholen – dann fehlt der Knopf.
 */
export function UndoDeferButton({
  item,
  className,
  compact = false,
}: {
  item: AgendaItem
  className?: string
  compact?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const meetingId = item.deferredInMeeting
  const mark = meetingId ? deferMarkIn(item, meetingId) : null
  if (!meetingId || !mark || item.status === 'done') return null

  const run = async () => {
    if (!profile) return
    setBusy(true)
    try {
      await undoDefer(item.id, meetingId, mark, { id: profile.id, name: profile.displayName })
      toast.success('Zurückgeholt – der Punkt steht wieder in dieser Sitzung.')
    } catch (error) {
      console.error(error)
      toast.error('Zurückholen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={cn('btn-secondary shrink-0', className)}
      disabled={busy}
      onClick={() => void run()}
      title="Das Verschieben zurücknehmen – der Punkt steht wieder in dieser Sitzung."
    >
      <Undo2 className="size-4" aria-hidden />
      <span className={compact ? 'hidden sm:inline' : undefined}>Zurückholen</span>
    </button>
  )
}
