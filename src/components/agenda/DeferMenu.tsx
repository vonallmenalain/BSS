import { useState, type ReactNode } from 'react'
import { CalendarClock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { formatDateShort } from '@/lib/dates'
import { DEFER_LABELS, deferItem, type DeferTarget } from '@/services/agenda'

interface Props {
  itemId: string
  /** Sitzung, auf die «auf nächste Sitzung» verschiebt */
  nextMeeting?: { id: string; date: Date } | null
  trigger: ReactNode
  /**
   * Klassen für das auslösende Element. In einer Menüliste soll es die volle
   * Breite einnehmen, in einer Knopfleiste dagegen nur so breit sein wie nötig.
   */
  triggerClassName?: string
  onDone?: () => void
}

/**
 * Verschiebe-Dialog mit den vier Fällen, die im Sitzungsalltag vorkommen:
 * auf die nächste Sitzung, um eine Woche, um einen Monat, um drei Monate –
 * plus ein freies Datum, wenn es doch etwas anderes sein soll.
 */
export function DeferMenu({
  itemId,
  nextMeeting,
  trigger,
  triggerClassName = 'w-full text-left',
  onDone,
}: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (target: DeferTarget, customDateValue?: Date | null) => {
    if (!profile) return
    setBusy(true)
    try {
      await deferItem(
        itemId,
        target,
        { id: profile.id, name: profile.displayName },
        {
          customDate: customDateValue,
          nextMeetingId: nextMeeting?.id ?? null,
          nextMeetingDate: nextMeeting?.date ?? null,
        },
      )
      toast.success('Traktandum verschoben.')
      setOpen(false)
      onDone?.()
    } catch (error) {
      console.error(error)
      toast.error('Verschieben fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {trigger}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Traktandum verschieben"
        description="Es verschwindet aus der laufenden Sitzung und taucht zum gewählten Zeitpunkt wieder auf."
        size="sm"
      >
        <div className="space-y-2">
          <button
            type="button"
            className="btn-secondary w-full justify-between"
            disabled={busy || !nextMeeting}
            onClick={() => void run('next_meeting')}
          >
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4" aria-hidden />
              {DEFER_LABELS.next_meeting}
            </span>
            <span className="text-xs text-slate-500">
              {nextMeeting ? formatDateShort(nextMeeting.date) : 'keine geplant'}
            </span>
          </button>

          {(['one_week', 'one_month', 'three_months'] as const).map((target) => (
            <button
              key={target}
              type="button"
              className="btn-secondary w-full justify-start"
              disabled={busy}
              onClick={() => void run(target)}
            >
              {DEFER_LABELS[target]}
            </button>
          ))}

          <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
            <label className="label" htmlFor="defer-date">
              Eigenes Datum
            </label>
            <div className="flex gap-2">
              <input
                id="defer-date"
                type="date"
                className="input"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !customDate}
                onClick={() => void run('custom', new Date(`${customDate}T12:00:00`))}
              >
                Setzen
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
