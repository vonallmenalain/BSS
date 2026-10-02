import type { ReactNode } from 'react'
import { Bell, CalendarClock, CalendarPlus, CalendarRange, Home, Users } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { cleaningGroupName, cleaningGroupNumber, responsibleEntry } from '@/lib/cleaningGroups'
import { cn } from '@/lib/utils'
import { cleaningPeriod, cleaningWeekNumber } from '@/services/cleaningPdf'
import type { CleaningGroup, CleaningWeek } from '@/lib/types'

/** Wie viele kommende Termine die Übersicht nennt – der Rest steht im Plan. */
const UPCOMING_SHOWN = 8

const DAY = 86_400_000

function dayValue(key: string): number {
  const [year, month, date] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

/** «in 3 Wochen», «morgen», «läuft» – vom heutigen Tag aus. */
function untilLabel(startDate: string, today: string): string {
  const days = Math.round((dayValue(startDate) - dayValue(today)) / DAY)
  if (days <= 0) return 'läuft'
  if (days === 1) return 'morgen'
  if (days < 7) return `in ${days} Tagen`
  const weeks = Math.round(days / 7)
  return weeks === 1 ? 'in einer Woche' : `in ${weeks} Wochen`
}

/**
 * Die Übersicht einer Putzgruppe – für alle, die den Putzplan öffnen.
 *
 * Oben, wer zuständig ist; darunter, wann die Gruppe das nächste Mal dran
 * ist, wie viele Haushalte sie zählt und wer dazugehört; zuletzt die
 * kommenden Termine. Die Namen stehen,
 * wie sie in der Einteilung stehen («Bader Roger & Sylvie») – das
 * Mitgliederverzeichnis braucht es dafür nicht, und es bleibt zu.
 *
 * Die Termine kommen aus dem Plan selbst: Jede Woche, in der «Gruppe N»
 * steht, gehört dazu – auch die zweite Woche um eine Konferenz, mit ihrem
 * Grund.
 *
 * Zuunterst die kurzen Wege zur Erinnerung und in den eigenen Kalender:
 * Wer nachschaut, wann die eigene Gruppe dran ist, will es meist auch nicht
 * vergessen.
 */
export function CleaningGroupDialog({
  number,
  weeks,
  groups,
  today,
  onClose,
  onRemind,
  onCalendar,
}: {
  number: number
  weeks: readonly CleaningWeek[]
  groups: readonly CleaningGroup[]
  /** «2026-10-02» */
  today: string
  onClose: () => void
  /** Die Erinnerung für diese Gruppe einrichten – fehlt, wo es keine gibt. */
  onRemind?: (number: number) => void
  /** Die Wochen dieser Gruppe in den eigenen Kalender holen. */
  onCalendar?: (number: number) => void
}) {
  const group = groups.find((entry) => entry.number === number) ?? null
  const own = weeks
    .filter((week) => cleaningGroupNumber(week.group) === number)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const upcoming = own.filter((week) => week.endDate >= today)
  const current = upcoming.find((week) => week.startDate <= today) ?? null
  const next = upcoming.find((week) => week.startDate > today) ?? null
  const responsible = responsibleEntry(group)?.label || upcoming[0]?.team || own.at(-1)?.team || ''
  const others = group?.entries.slice(1) ?? []
  const households = group?.entries.length ?? (responsible ? 1 : 0)

  return (
    <Modal
      open
      onClose={onClose}
      title={cleaningGroupName(number)}
      description="Putzgruppe"
      size="lg"
    >
      <div className="space-y-4">
        {/* Wer zuständig ist – gross, wie auf der Liste fett zuoberst. */}
        <section className="bg-brand-50 dark:bg-brand-950/40 relative overflow-hidden rounded-xl p-4 sm:p-5">
          <span className="bg-brand-600 absolute inset-y-0 left-0 w-1" aria-hidden />
          <p className="text-brand-700 dark:text-brand-300 text-sm font-semibold">Zuständig</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            {responsible || 'Noch niemand eingetragen'}
          </p>
        </section>

        {/* Der nächste Einsatz breit, daneben die Zahl der Haushalte. */}
        <div className="grid grid-cols-3 gap-2">
          <Tile
            icon={CalendarClock}
            label={current ? 'Diese Woche dran' : 'Nächster Einsatz'}
            highlight={Boolean(current)}
            className="col-span-2"
          >
            {current ? (
              <>
                <span className="block">{cleaningPeriod(current)}</span>
                {current.note?.trim() && (
                  <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                    {current.note.trim()}
                  </span>
                )}
              </>
            ) : next ? (
              <>
                <span className="block">{cleaningPeriod(next)}</span>
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                  {untilLabel(next.startDate, today)}
                </span>
              </>
            ) : (
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                Noch nicht im Plan
              </span>
            )}
          </Tile>
          <Tile icon={Home} label="Haushalte">
            <span className="tabular text-2xl">{households}</span>
          </Tile>
        </div>

        {others.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-slate-400" aria-hidden />
              Dazu gehören
            </h3>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {others.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"
                >
                  {entry.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="size-4 text-slate-400" aria-hidden />
            Kommende Termine
          </h3>
          {upcoming.length === 0 ? (
            <p className="hint mt-0">Im Plan steht noch kein weiterer Einsatz.</p>
          ) : (
            <ul className="divide-list overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              {upcoming.slice(0, UPCOMING_SHOWN).map((week) => (
                <li
                  key={week.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm',
                    week === current && 'bg-brand-50/60 dark:bg-brand-950/40',
                  )}
                >
                  <span className="tabular w-12 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    KW {cleaningWeekNumber(week)}
                  </span>
                  <span className="tabular flex-1">{cleaningPeriod(week)}</span>
                  {week.note?.trim() && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {week.note.trim()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > UPCOMING_SHOWN && (
            <p className="hint">
              Dazu {upcoming.length - UPCOMING_SHOWN} weitere bis zum Ende des Plans.
            </p>
          )}
        </section>

        {(onRemind || onCalendar) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {onRemind && (
              <button type="button" className="btn-secondary" onClick={() => onRemind(number)}>
                <Bell className="size-4" aria-hidden />
                Erinnern, wenn {cleaningGroupName(number)} dran ist
              </button>
            )}
            {onCalendar && (
              <button type="button" className="btn-secondary" onClick={() => onCalendar(number)}>
                <CalendarPlus className="size-4" aria-hidden />
                Im Kalender eintragen
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function Tile({
  icon: Icon,
  label,
  highlight = false,
  className,
  children,
}: {
  icon: typeof Users
  label: string
  highlight?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        highlight
          ? 'border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40'
          : 'border-slate-200 dark:border-slate-800',
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold">{children}</div>
    </div>
  )
}
