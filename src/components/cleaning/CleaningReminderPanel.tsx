import { useEffect, useMemo, useState } from 'react'
import { BellOff, BellRing, Share } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCleaningReminder } from '@/hooks/useCleaningReminder'
import { useNow } from '@/hooks/useNow'
import {
  cleaningGroupNumber,
  groupOfMember,
  responsibleEntry,
  sortedGroups,
} from '@/lib/cleaningGroups'
import {
  CLEANING_REMINDER_DAYS,
  DEFAULT_CLEANING_REMINDER,
  cleaningReminderDayLabel,
  cleaningReminderLabel,
  cleaningReminderWhen,
  cleaningWeekSpan,
  nextCleaningReminder,
  type CleaningReminderSchedule,
} from '@/lib/cleaningReminder'
import { isIos, isStandalone } from '@/lib/install'
import { NOTIFY_TIMES } from '@/lib/notifications'
import {
  CleaningReminderError,
  removeCleaningReminder,
  saveCleaningReminder,
} from '@/services/cleaningReminder'
import { pushConfigured, pushDenied, pushSupported } from '@/services/push'
import type { CleaningGroup, CleaningWeek } from '@/lib/types'

/**
 * Die wählbaren Gruppen: aus der Einteilung, mit der zuständigen Familie
 * dahinter – und was der Plan sonst noch nennt, falls die Einteilung (noch)
 * fehlt.
 */
function groupOptions(
  groups: readonly CleaningGroup[],
  weeks: readonly CleaningWeek[],
): { number: number; label: string }[] {
  const options = new Map<number, string>()
  for (const group of sortedGroups(groups)) {
    const responsible = responsibleEntry(group)?.label
    options.set(
      group.number,
      responsible ? `Gruppe ${group.number} – ${responsible}` : `Gruppe ${group.number}`,
    )
  }
  for (const week of weeks) {
    const number = cleaningGroupNumber(week.group)
    if (number !== null && !options.has(number)) options.set(number, `Gruppe ${number}`)
  }
  return [...options].sort((a, b) => a[0] - b[0]).map(([number, label]) => ({ number, label }))
}

/**
 * Die Erinnerung an die Putzwoche einrichten – auf diesem Gerät, ohne Konto.
 *
 * Steht im Dialog über dem Putzplan und, für angemeldete Konten, unter den
 * Benachrichtigungen. Gefragt wird nur, was es braucht: welche Gruppe, an
 * welchem Tag und um welche Zeit. Darunter steht, wann die nächste
 * Erinnerung tatsächlich kommt – so lässt sich die Einstellung prüfen,
 * bevor man sich auf sie verlässt.
 *
 * Ist ein Konto mit einem Mitglied verknüpft, steht dessen Gruppe aus der
 * Einteilung schon da – wählen muss man dann nur noch die Zeit.
 *
 * Was gerade nicht geht, wird angeschrieben statt versteckt: der Browser
 * ohne Web-Push, das iPhone, auf dem die App erst installiert sein muss,
 * und die Erlaubnis, die der Browser schon verweigert hat.
 */
export function CleaningReminderPanel({
  groups,
  weeks,
  initialGroup = null,
  onSaved,
}: {
  groups: readonly CleaningGroup[]
  weeks: readonly CleaningWeek[]
  /** Vorgewählt, wenn man aus der Übersicht einer Gruppe kommt. */
  initialGroup?: number | null
  /** Nach dem Einschalten oder Ändern – ein Dialog schliesst sich dann. */
  onSaved?: () => void
}) {
  const toast = useToast()
  const { profile } = useAuth()
  const stored = useCleaningReminder()
  const now = useNow()
  const options = useMemo(() => groupOptions(groups, weeks), [groups, weeks])
  /** Die eigene Gruppe – wenn das Konto mit einem Mitglied verknüpft ist. */
  const own = profile?.memberId ? (groupOfMember(groups, profile.memberId)?.group.number ?? 0) : 0

  const [supported, setSupported] = useState<boolean | null>(null)
  const [denied, setDenied] = useState(pushDenied)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CleaningReminderSchedule>(() => ({
    // 0 heisst «noch keine gewählt» – die Auswahl verlangt dann eine.
    group: initialGroup ?? stored?.group ?? 0,
    day: stored?.day ?? DEFAULT_CLEANING_REMINDER.day,
    time: stored?.time ?? DEFAULT_CLEANING_REMINDER.time,
  }))

  useEffect(() => {
    let active = true
    void pushSupported().then((value) => {
      if (active) setSupported(value)
    })
    return () => {
      active = false
    }
  }, [])

  // Noch keine gewählt: die eigene. Abgeleitet statt gesetzt – die
  // Einteilung kommt oft erst nach dem ersten Zeichnen an.
  const schedule = form.group > 0 || !own ? form : { ...form, group: own }
  const changed =
    !stored ||
    stored.group !== schedule.group ||
    stored.day !== schedule.day ||
    stored.time !== schedule.time
  const next = schedule.group > 0 ? nextCleaningReminder(weeks, schedule, new Date(now)) : null

  const fail = (error: unknown) => {
    console.error(error)
    toast.error(
      error instanceof CleaningReminderError
        ? error.message
        : 'Das liess sich gerade nicht einrichten. Bitte später noch einmal.',
    )
  }

  const save = async () => {
    if (busy || schedule.group <= 0) return
    setBusy(true)
    try {
      const outcome = await saveCleaningReminder(schedule)
      if (outcome === 'denied') {
        setDenied(true)
        return
      }
      toast.success(
        stored
          ? 'Die Erinnerung ist angepasst.'
          : `Erinnerung eingeschaltet – für Gruppe ${schedule.group}.`,
      )
      onSaved?.()
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy) return
    setBusy(true)
    try {
      await removeCleaningReminder()
      toast.success('Die Erinnerung ist ausgeschaltet.')
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  if (!pushConfigured()) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Erinnerungen sind hier noch nicht eingerichtet.
      </p>
    )
  }

  if (supported === false) {
    // Das iPhone kann Web-Push – aber nur in der installierten App.
    return isIos() && !isStandalone() ? (
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Auf dem iPhone und dem iPad kommen Erinnerungen nur in der installierten App an. So geht
          es:
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Unten in Safari auf das Teilen-Symbol{' '}
            <Share className="inline size-4 align-text-bottom" aria-label="(Teilen)" /> tippen.
          </li>
          <li>«Zum Home-Bildschirm» wählen und hinzufügen.</li>
          <li>Den Putzplan über das neue Symbol öffnen und die Erinnerung dort einschalten.</li>
        </ol>
      </div>
    ) : (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Dieser Browser kann keine Benachrichtigungen empfangen. Mit Chrome, Edge, Firefox oder
        Safari geht es.
      </p>
    )
  }

  if (denied) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Der Browser hat Benachrichtigungen für diese Seite blockiert – ein Knopf hier hilft dann
        nicht weiter. Erlauben lässt es sich in der Adresszeile über das Schloss- oder Info-Symbol →
        Berechtigungen → «Benachrichtigungen» auf «Zulassen». Danach diesen Dialog einmal schliessen
        und wieder öffnen.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {stored && (
        <p className="bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200 flex items-start gap-2 rounded-lg px-3 py-2 text-sm">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Eingeschaltet für <strong>Gruppe {stored.group}</strong> –{' '}
            {cleaningReminderLabel(stored)}.
          </span>
        </p>
      )}

      <div>
        <label className="label" htmlFor="putzplan-gruppe">
          Welche Gruppe
        </label>
        <select
          id="putzplan-gruppe"
          className="input"
          value={schedule.group}
          onChange={(event) => setForm({ ...form, group: Number(event.target.value) })}
        >
          {schedule.group === 0 && <option value={0}>Gruppe wählen …</option>}
          {/* Eine gespeicherte Gruppe, die es nicht mehr gibt, bleibt wählbar. */}
          {schedule.group > 0 && !options.some((option) => option.number === schedule.group) && (
            <option value={schedule.group}>Gruppe {schedule.group}</option>
          )}
          {options.map((option) => (
            <option key={option.number} value={option.number}>
              {option.label}
            </option>
          ))}
        </select>
        {form.group === 0 && own > 0 && <p className="hint">Deine Gruppe laut Einteilung.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="putzplan-tag">
            Wann
          </label>
          <select
            id="putzplan-tag"
            className="input"
            value={schedule.day}
            onChange={(event) => setForm({ ...schedule, day: Number(event.target.value) })}
          >
            {CLEANING_REMINDER_DAYS.map((day) => (
              <option key={day} value={day}>
                {cleaningReminderDayLabel(day)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="putzplan-zeit">
            Uhrzeit
          </label>
          <select
            id="putzplan-zeit"
            className="input"
            value={schedule.time}
            onChange={(event) => setForm({ ...schedule, time: event.target.value })}
          >
            {NOTIFY_TIMES.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Was die Einstellung bedeutet – am Plan gemessen, nicht beschrieben. */}
      {schedule.group > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {next ? (
            <>
              Nächste Erinnerung: <strong>{cleaningReminderWhen(next.at)}</strong> – für die Woche
              vom {cleaningWeekSpan(next.week)}.
            </>
          ) : (
            <>
              Gruppe {schedule.group} steht im Plan noch nicht wieder. Die Erinnerung kommt, sobald
              ihre nächste Woche eingetragen ist.
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(changed || !stored) && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={busy || supported === null || schedule.group <= 0}
          >
            <BellRing className="size-4" aria-hidden />
            {stored ? 'Änderung speichern' : 'Erinnerung einschalten'}
          </button>
        )}
        {stored && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void remove()}
            disabled={busy}
          >
            <BellOff className="size-4" aria-hidden />
            Ausschalten
          </button>
        )}
      </div>

      <p className="hint">
        Gilt für dieses Gerät und braucht kein Konto. Gespeichert werden nur die Gruppe, Tag und
        Uhrzeit – und die Adresse, über die das Gerät Nachrichten empfängt.
      </p>
    </div>
  )
}
