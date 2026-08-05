import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { formatDateShort } from '@/lib/dates'
import { deferToNextMeeting } from '@/services/agenda'

interface Props {
  itemId: string
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
 */
export function DeferMenu({ itemId, nextMeeting, className, compact = false, onDone }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!profile) return
    setBusy(true)
    try {
      await deferToNextMeeting(itemId, nextMeeting?.id ?? null, {
        id: profile.id,
        name: profile.displayName,
      })
      toast.success(
        nextMeeting
          ? `Auf die Sitzung vom ${formatDateShort(nextMeeting.date)} verschoben.`
          : 'In die Pendenzen verschoben – es ist noch keine Sitzung geplant.',
      )
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
