import { useMemo, useState } from 'react'
import { Apple, Calendar, CalendarSync, Copy, Download } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCleaningReminder } from '@/hooks/useCleaningReminder'
import { Modal } from '@/components/ui/Modal'
import { CalendarInstructions } from '@/components/ui/CalendarInstructions'
import { cleaningGroupChoices, groupOfMember } from '@/lib/cleaningGroups'
import { weeksOfGroup } from '@/lib/cleaningIcs'
import { toDate, toDateInput } from '@/lib/dates'
import {
  cleaningFeedUrl,
  cleaningFeedWebcalUrl,
  downloadCleaningIcs,
  googleSubscribeUrl,
} from '@/services/cleaningCalendar'
import type { CleaningGroup, CleaningWeek } from '@/lib/types'

/**
 * Die Putzwochen einer Gruppe im eigenen Kalender – für alle, mit und ohne
 * Konto, wie der Putzplan selbst.
 *
 * Jede Putzwoche steht als ein ganztägiger Termin von Montag bis Samstag
 * im Kalender (`lib/cleaningIcs`). Zwei Wege führen dorthin:
 *
 * **Abonnieren** ist der empfohlene. Google und Apple holen die Termine
 * unter der Adresse immer wieder selbst; wird der Plan neu generiert oder
 * eine Woche getauscht, zieht der Kalender von selbst nach. Wer einmal
 * abonniert hat, muss nie wieder etwas tun.
 *
 * **Herunterladen** ist der Ausweg für Kalender, die kein Abo können, und
 * für wen die Termine lieber fest eingetragen hat. Die Datei ist eine Kopie
 * dessen, was heute im Plan steht – ändert sich der Plan, ändern sich diese
 * Termine nicht mit. Darum steht der Weg an zweiter Stelle und sagt das
 * dazu.
 *
 * Vorgewählt ist die Gruppe, aus deren Übersicht man kommt, sonst die der
 * Erinnerung auf diesem Gerät, sonst die eigene aus der Einteilung.
 */
export function CleaningCalendarDialog({
  groups,
  weeks,
  initialGroup = null,
  onClose,
}: {
  groups: readonly CleaningGroup[]
  weeks: readonly CleaningWeek[]
  /** Vorgewählt, wenn man aus der Übersicht einer Gruppe kommt. */
  initialGroup?: number | null
  onClose: () => void
}) {
  const toast = useToast()
  const { profile } = useAuth()
  const reminder = useCleaningReminder()
  const options = useMemo(() => cleaningGroupChoices(groups, weeks), [groups, weeks])
  const own = profile?.memberId ? (groupOfMember(groups, profile.memberId)?.group.number ?? 0) : 0

  // 0 heisst «noch keine gewählt». Die eigene Gruppe abgeleitet statt
  // gesetzt – die Einteilung kommt oft erst nach dem ersten Zeichnen an.
  const [chosen, setChosen] = useState(() => initialGroup ?? reminder?.group ?? 0)
  const group = chosen > 0 ? chosen : own

  const today = toDateInput(new Date())
  const ahead = group > 0 ? weeksOfGroup(weeks, group).filter((week) => week.endDate >= today) : []

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${what} kopiert.`)
    } catch {
      // Ohne Zwischenablage bleibt der Text im Feld – markieren geht immer.
      toast.info('Kopieren nicht möglich – bitte den Text im Feld von Hand markieren.')
    }
  }

  const download = () => {
    const count = downloadCleaningIcs(
      weeks.map((week) => ({
        startDate: week.startDate,
        endDate: week.endDate,
        group: week.group,
        team: week.team,
        note: week.note,
        updatedAt: toDate(week.updatedAt),
      })),
      group,
      today,
    )
    toast.success(
      count === 1
        ? 'Eine Putzwoche als Datei heruntergeladen.'
        : `${count} Putzwochen als Datei heruntergeladen.`,
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Im Kalender eintragen"
      description="Die Putzwochen einer Gruppe in Google Calendar, Apple Kalender oder Outlook – Montag bis Samstag, ganztägig."
      size="lg"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Schliessen
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="calendar-group">
            Gruppe
          </label>
          <select
            id="calendar-group"
            className="input"
            value={group}
            onChange={(event) => setChosen(Number(event.target.value))}
          >
            {group === 0 && <option value={0}>Gruppe wählen …</option>}
            {options.map((option) => (
              <option key={option.number} value={option.number}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {group > 0 && (
          <>
            {/* Der empfohlene Weg – zuoberst und hervorgehoben. */}
            <section className="border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30 space-y-3 rounded-xl border p-4">
              <div>
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <CalendarSync className="size-4" aria-hidden />
                  Abonnieren
                  <span className="badge bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                    empfohlen
                  </span>
                </h3>
                <p className="hint mt-0.5">
                  Bleibt aktuell: Wird der Plan neu generiert oder eine Woche getauscht, zieht der
                  Kalender von selbst nach.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a className="btn-primary" href={cleaningFeedWebcalUrl(group)}>
                  <Apple className="size-4" aria-hidden />
                  Apple Kalender
                </a>
                <a
                  className="btn-secondary"
                  href={googleSubscribeUrl(group)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Calendar className="size-4" aria-hidden />
                  Google Calendar
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input w-full font-mono text-xs sm:w-auto sm:min-w-0 sm:flex-1"
                  readOnly
                  value={cleaningFeedUrl(group)}
                  aria-label="Adresse des Kalenders"
                  onFocus={(event) => event.target.select()}
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void copy(cleaningFeedUrl(group), 'Link')}
                  title="Für Google Calendar und Outlook"
                >
                  <Copy className="size-3.5" aria-hidden />
                  Kopieren
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void copy(cleaningFeedWebcalUrl(group), 'webcal-Link')}
                  title="Öffnet am Mac und am iPhone direkt den Kalender"
                >
                  <Apple className="size-3.5" aria-hidden />
                  webcal
                </button>
              </div>
            </section>

            {/* Der Ausweg – eine Kopie, die nicht mitzieht. */}
            <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Download className="size-4" aria-hidden />
                Einmalig herunterladen
              </h3>
              <p className="hint mt-0">
                {ahead.length === 0
                  ? 'Im Plan steht für diese Gruppe noch keine weitere Woche.'
                  : `${ahead.length === 1 ? 'Die eine bekannte Woche' : `Die ${ahead.length} bekannten Wochen`} ab heute als Datei, für Kalender ohne Abo. Ändert sich der Plan später, ändern sich diese Termine nicht mit.`}
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={download}
                disabled={ahead.length === 0}
              >
                <Download className="size-4" aria-hidden />
                Datei herunterladen (.ics)
              </button>
            </section>

            <CalendarInstructions />
          </>
        )}
      </div>
    </Modal>
  )
}
