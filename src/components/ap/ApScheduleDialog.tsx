import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { formatDate, toDateInput } from '@/lib/dates'
import { SCHOOL_HOLIDAYS_UNTIL } from '@/lib/schoolHolidays'
import { createApActivities } from '@/services/apActivities'
import { fromIsoDate } from '@/services/importHistory'
import {
  CONFERENCE_TITLE,
  FHV_TITLE,
  HOLIDAY_TITLE,
  generateApSchedule,
  type ApScheduleOptions,
  type ApScheduleReason,
} from '@/services/apSchedule'
import type { ApActivity } from '@/lib/types'

/**
 * Das Grundgerüst eines Zeitraums anlegen.
 *
 * Die Jahresplanung besteht zum grössten Teil aus Terminen, an denen
 * nichts weiter steht als das Datum: Mittwoch für Mittwoch, dazwischen die
 * Klassen am Sonntag. Die von Hand zu erfassen, wäre eine Fleissarbeit ohne
 * Erkenntnis – also erzeugt die App sie, und was an einem Abend
 * stattfindet, kommt später dazu.
 *
 * Dazu die drei Abende, an denen **nichts** stattfindet: die FHV am 3.
 * Mittwoch, die Schulferien und die Generalkonferenz. Sie stehen als «fällt
 * aus» im Plan, weil ein fehlendes Datum wie eine offene Aufgabe aussieht
 * und ein erklärter Ausfall wie eine Antwort.
 *
 * Die Themen der Klasse kommen nicht von hier: Sie stehen monatlich in «Für
 * eine starke Jugend» und werden eingelesen (**Einstellungen › Importe ›
 * Themen AP-Klasse**). Bis dahin steht «Thema noch offen» im Plan.
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

  /** Je Regel eine Zahl – drei Ausfälle sehen im Plan gleich aus. */
  const counts = useMemo(() => {
    const byReason = {} as Record<ApScheduleReason, number>
    for (const entry of entries) byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1
    return byReason
  }, [entries])

  /**
   * Reicht der Ferienplan über den Zeitraum hinaus?
   *
   * Ein Plan, der bis 2031 erzeugt wird, bekäme ab 2029 lautlos keine
   * Ferien mehr – und niemand würde es merken. Also steht es da.
   */
  const beyondHolidays = options.holidays && options.to > SCHOOL_HOLIDAYS_UNTIL

  const update = <K extends keyof ApScheduleOptions>(key: K, value: ApScheduleOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }))

  const start = async () => {
    if (entries.length === 0) return
    setBusy(true)
    try {
      // Ohne `reason`: Der Grund gehört dem Dialog, nicht dem Termin.
      const count = await createApActivities(
        entries.map(({ date, kind, title, time, endTime }) => ({
          date,
          kind,
          title,
          time,
          endTime,
        })),
        profile?.id ?? null,
      )
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
            hint="Ohne den 3. Mittwoch im Monat und ohne die Schulferien."
            count={counts.activity ?? 0}
          />
          <Choice
            checked={options.classes}
            onChange={(next) => update('classes', next)}
            label="AP-Klasse an den Sonntagen"
            hint="Ab September 2026 jeden Sonntag von 11:35 bis 12:00 – davor am 2. und 4. von 11 bis 12."
            count={counts.class ?? 0}
          />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="label">Wann nichts stattfindet</legend>

          <Choice
            checked={options.fhv}
            onChange={(next) => update('fhv', next)}
            label={`«${FHV_TITLE}» am 3. Mittwoch`}
            hint="Steht als «fällt aus» im Plan, damit die Lücke erklärt ist."
            count={counts.fhv ?? 0}
          />
          <Choice
            checked={options.holidays}
            onChange={(next) => update('holidays', next)}
            label={`«${HOLIDAY_TITLE}» in den Ferien`}
            hint="An jedem Mittwoch der Schulferien – auch am 3., die Ferien gehen der FHV vor. Die AP-Klasse am Sonntag bleibt."
            count={counts.holiday ?? 0}
          />
          <Choice
            checked={options.conference}
            onChange={(next) => update('conference', next)}
            label={`«${CONFERENCE_TITLE}» am 1. Sonntag im April und Oktober`}
            hint="An diesem Wochenende ist Generalkonferenz – in der Gemeinde findet nichts statt."
            count={counts.conference ?? 0}
          />
        </fieldset>

        {beyondHolidays && (
          <p className="hint">
            Der Ferienplan von Burgdorf ist bis zum {formatDate(fromIsoDate(SCHOOL_HOLIDAYS_UNTIL))}{' '}
            erfasst – danach werden keine Ferien eingetragen.
          </p>
        )}

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
    holidays: true,
    conference: true,
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
