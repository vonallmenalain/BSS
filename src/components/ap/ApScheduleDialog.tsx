import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { toDateInput } from '@/lib/dates'
import { createApActivities } from '@/services/apActivities'
import { FHV_TITLE, generateApSchedule, type ApScheduleOptions } from '@/services/apSchedule'
import type { ApActivity } from '@/lib/types'

/**
 * Das Grundgerüst eines Zeitraums anlegen.
 *
 * Die Jahresplanung besteht zum grössten Teil aus Terminen, an denen
 * nichts weiter steht als das Datum: Mittwoch für Mittwoch, dazwischen die
 * Klassen am 2. und 4. Sonntag. Die von Hand zu erfassen, wäre eine
 * Fleissarbeit ohne Erkenntnis – also erzeugt die App sie, und was an
 * einem Abend stattfindet, kommt später dazu.
 *
 * Tage, an denen schon etwas im Plan steht, bleiben unangetastet. Der
 * Knopf lässt sich deshalb gefahrlos ein zweites Mal drücken: Er füllt
 * dann nur die Lücken.
 */
export function ApScheduleDialog({
  open,
  onClose,
  activities,
}: {
  open: boolean
  onClose: () => void
  activities: ApActivity[]
}) {
  const { profile } = useAuth()
  const toast = useToast()

  const [options, setOptions] = useState<ApScheduleOptions>(() => defaults())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setOptions(defaults())
  }, [open])

  const taken = useMemo(() => {
    const dates = new Set<string>()
    for (const activity of activities) dates.add(activity.date)
    return dates
  }, [activities])

  const entries = useMemo(() => generateApSchedule(options, taken), [options, taken])

  const counts = useMemo(
    () => ({
      activity: entries.filter((entry) => entry.kind === 'activity').length,
      class: entries.filter((entry) => entry.kind === 'class').length,
      cancelled: entries.filter((entry) => entry.kind === 'cancelled').length,
    }),
    [entries],
  )

  const update = <K extends keyof ApScheduleOptions>(key: K, value: ApScheduleOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }))

  const start = async () => {
    if (entries.length === 0) return
    setBusy(true)
    try {
      const count = await createApActivities(entries, profile?.id ?? null)
      toast.success(`${count} ${count === 1 ? 'Termin' : 'Termine'} angelegt.`)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : 'Die Termine konnten nicht angelegt werden.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Termine erzeugen"
      description="Den gewohnten Takt für einen Zeitraum anlegen"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void start()}
            disabled={busy || entries.length === 0}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CalendarPlus className="size-4" aria-hidden />
            )}
            {entries.length} {entries.length === 1 ? 'Termin' : 'Termine'} anlegen
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ap-gen-from">
              Von
            </label>
            <input
              id="ap-gen-from"
              type="date"
              className="input"
              value={options.from}
              onChange={(event) => update('from', event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="ap-gen-to">
              Bis
            </label>
            <input
              id="ap-gen-to"
              type="date"
              className="input"
              value={options.to}
              onChange={(event) => update('to', event.target.value)}
            />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="label">Was angelegt wird</legend>

          <Choice
            checked={options.activities}
            onChange={(next) => update('activities', next)}
            label="Aktivität an jedem Mittwoch"
            hint="Ohne den 3. Mittwoch im Monat – dann ist FHV."
            count={counts.activity}
          />
          <Choice
            checked={options.classes}
            onChange={(next) => update('classes', next)}
            label="AP-Klasse am 2. und 4. Sonntag"
            count={counts.class}
          />
          <Choice
            checked={options.fhv}
            onChange={(next) => update('fhv', next)}
            label={`«${FHV_TITLE}» am 3. Mittwoch`}
            hint="Steht als «fällt aus» im Plan, damit die Lücke erklärt ist."
            count={counts.cancelled}
          />
        </fieldset>

        <p className="hint">
          Tage, an denen bereits etwas im Plan steht, bleiben unverändert – auch bei einem zweiten
          Durchlauf. Die Termine entstehen ohne Titel; was stattfindet, wird danach eingetragen.
        </p>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

/** Ab dem heutigen Tag bis zum Ende des kommenden Jahres. */
function defaults(): ApScheduleOptions {
  const today = new Date()
  const end = new Date(today.getFullYear(), 11, 31)
  // Im letzten Quartal plant man bereits das Folgejahr.
  if (today.getMonth() >= 9) end.setFullYear(today.getFullYear() + 1)

  return {
    from: toDateInput(today),
    to: toDateInput(end),
    activities: true,
    classes: true,
    fhv: true,
  }
}

function Choice({
  checked,
  onChange,
  label,
  hint,
  count,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
  count: number
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60">
      <input
        type="checkbox"
        className="mt-0.5 size-4 rounded border-slate-300 dark:border-slate-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="hint block">{hint}</span>}
      </span>
      <span className="tabular shrink-0 text-sm font-semibold text-slate-400">
        {checked ? count : '–'}
      </span>
    </label>
  )
}
