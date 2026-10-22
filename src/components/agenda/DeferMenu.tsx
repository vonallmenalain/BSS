import { useState } from 'react'
import { ArrowRight, CalendarClock, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { formatDateShort } from '@/lib/dates'
import { deferMarkIn, deferMarkOf } from '@/lib/standing'
import type { AgendaItem } from '@/lib/types'
import { deferToNextMeeting, undoDefer } from '@/services/agenda'

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
 * «Auf die nächste Sitzung» – ein Knopf, kein Menü mehr.
 *
 * Früher standen hier fünf Ziele: nächste Sitzung, eine Woche, ein Monat,
 * drei Monate, freies Datum. Vier davon setzten bloss ein Fälligkeitsdatum,
 * an dem nichts geschah – der Punkt lag weiter im Sammelkorb und wartete auf
 * einen Termin, den niemand einberief. Ein Traktandum gehört in eine
 * Sitzung, und «nicht heute» heisst: in der nächsten.
 *
 * Steht noch keine nächste Sitzung fest, wandert der Punkt in den
 * Sammelkorb und erscheint unter «Pendenzen», bis eine Sitzung ihn aufnimmt.
 *
 * In der Sitzung, aus der er kommt, bleibt er trotzdem stehen – grau und mit
 * einem Pfeil (siehe `DeferredBadge`). «Rückgängig» in der Meldung und
 * «Zurückholen» am Punkt nehmen das Verschieben zurück.
 */
export function DeferMenu({ item, nextMeeting, className, compact = false, onDone }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!profile) return
    const actor = { id: profile.id, name: profile.displayName }
    // Der Stand von jetzt – festgehalten, bevor das Verschieben ihn ändert.
    const from = item.meetingId
    const mark = deferMarkOf(item)
    setBusy(true)
    try {
      await deferToNextMeeting(item, nextMeeting?.id ?? null, actor, mark)
      const message = nextMeeting
        ? `Auf die Sitzung vom ${formatDateShort(nextMeeting.date)} verschoben.`
        : 'In die Pendenzen verschoben – es ist noch keine Sitzung geplant.'
      // Zurück geht es nur dorthin, woher der Punkt kam: in eine Sitzung.
      if (from && from !== nextMeeting?.id) {
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
      onDone?.()
    } catch (error) {
      console.error(error)
      toast.error('Verschieben fehlgeschlagen.')
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
      title={
        nextMeeting
          ? `Auf die Sitzung vom ${formatDateShort(nextMeeting.date)}`
          : 'Es ist keine weitere Sitzung geplant – der Punkt bleibt unter «Pendenzen».'
      }
    >
      <CalendarClock className="size-4" aria-hidden />
      <span className={compact ? 'hidden sm:inline' : undefined}>Auf nächste Sitzung</span>
    </button>
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
