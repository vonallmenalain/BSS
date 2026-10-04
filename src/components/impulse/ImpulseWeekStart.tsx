import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarClock, Check, RotateCcw, Zap } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useNow } from '@/hooks/useNow'
import { formatDayShort, formatTime, toDate } from '@/lib/dates'
import { weekStart, weekStartBounds } from '@/lib/impulse'
import { setImpulseWeekStart } from '@/services/impulse'
import type { ImpulseItem } from '@/lib/types'

/** «So., 11.10., 19:00» */
function formatStart(date: Date): string {
  return `${formatDayShort(date)}, ${formatTime(date)}`
}

/** Der Wert eines `datetime-local`-Felds – Ortszeit, auf die Minute. */
function toLocalInput(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

/**
 * Der Start einer Woche, in der Redaktion.
 *
 * Normalerweise beginnt die neue Woche am Montag, 00:00. Hier lässt er sich
 * verschieben: früher – das neue Thema schon am Sonntagabend freischalten –
 * oder später, damit die alte Woche länger läuft. Gespeichert wird am
 * Wochenthema (`startsAt`); ohne Wochenthema bleibt es beim Montag, und ein
 * Entwurf verschiebt noch nichts (siehe `impulseWeekStarts`).
 */
export function ImpulseWeekStart({ week, theme }: { week: string; theme: ImpulseItem | null }) {
  const toast = useToast()
  const now = useNow()
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const monday = weekStart(week)
  const bounds = weekStartBounds(week)
  if (!monday || !bounds) return null

  const custom = toDate(theme?.startsAt ?? null)
  const start = custom ?? monday
  const shifted = custom
    ? custom.getTime() < monday.getTime()
      ? 'vorgezogen'
      : 'verschoben'
    : null

  /* Die schnellen Wege – nur, wo sie etwas bewirken: «Jetzt», solange die
     Woche noch nicht läuft; «Heute, 19:00», solange der Abend noch kommt
     und vor dem gewohnten Start liegt. */
  const inBounds = (time: number) =>
    time >= bounds.earliest.getTime() && time <= bounds.latest.getTime()
  const tonight = new Date(now)
  tonight.setHours(19, 0, 0, 0)
  const canNow = inBounds(now) && now < start.getTime()
  const canTonight =
    inBounds(tonight.getTime()) &&
    tonight.getTime() > now &&
    tonight.getTime() < monday.getTime() &&
    tonight.getTime() !== custom?.getTime()

  const parsed = draft ? new Date(draft) : null
  const draftValid = Boolean(
    parsed && !Number.isNaN(parsed.getTime()) && inBounds(parsed.getTime()),
  )

  const save = async (next: Date | null) => {
    if (!theme || busy) return
    // Montag, 00:00, ist der gewohnte Start – dafür braucht es keinen Eintrag.
    const value = next && next.getTime() !== monday.getTime() ? next : null
    setBusy(true)
    try {
      const outcome = await setImpulseWeekStart(theme.id, value)
      toast.saved(
        value
          ? `Die Woche startet ${formatStart(value)}.`
          : 'Die Woche startet wieder am Montag, 00:00.',
        outcome,
      )
      setDraft(null)
    } catch (error) {
      console.error(error)
      toast.error('Der Start konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <CalendarClock className="size-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            Start: <strong className="font-medium">{formatStart(start)}</strong>
            {shifted && (
              <span className="ms-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                {shifted}
              </span>
            )}
          </span>
        </p>
        {theme && draft === null && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setDraft(toLocalInput(start))}
          >
            Start ändern
          </button>
        )}
      </div>

      {!theme && (
        <p className="hint mt-1">
          Verschieben lässt sich der Start, sobald die Woche ein Wochenthema hat.
        </p>
      )}
      {theme && custom && theme.status !== 'ready' && (
        <p className="hint mt-1">Gilt, sobald das Wochenthema bereit ist.</p>
      )}

      {theme && draft !== null && (
        <div className="mt-2 space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex flex-wrap gap-2">
            {canNow && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void save(new Date())}
                disabled={busy}
              >
                <Zap className="size-4" aria-hidden />
                Jetzt freischalten
              </button>
            )}
            {canTonight && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void save(tonight)}
                disabled={busy}
              >
                Heute, 19:00
              </button>
            )}
            {custom && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => void save(null)}
                disabled={busy}
              >
                <RotateCcw className="size-4" aria-hidden />
                Zurück auf Montag, 00:00
              </button>
            )}
          </div>
          <div>
            <label className="label" htmlFor={`start-${week}`}>
              Oder selbst wählen
            </label>
            <input
              id={`start-${week}`}
              type="datetime-local"
              className="input"
              value={draft}
              min={toLocalInput(bounds.earliest)}
              max={toLocalInput(bounds.latest)}
              onChange={(event) => setDraft(event.target.value)}
            />
            <p className="hint mt-1">
              Frühestens am Montag der Woche davor, spätestens am Sonntag dieser Woche. Die Woche
              davor endet dann entsprechend früher oder später.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setDraft(null)}
              disabled={busy}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => void save(parsed)}
              disabled={busy || !draftValid}
            >
              <Check className="size-4" aria-hidden />
              Speichern
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
