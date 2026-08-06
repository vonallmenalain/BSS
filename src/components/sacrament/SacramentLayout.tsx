import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, TriangleAlert, UserCog } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useSacramentMeeting } from '@/hooks/useFirestore'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  addWeeks,
  formatDateLong,
  toDateInput,
  upcomingWeekdays,
  weekdaysAround,
} from '@/lib/dates'
import { cn } from '@/lib/utils'
import { sacramentDocId, sundayProgram } from '@/services/sacrament'
import { SundayProgramBadge } from '@/components/sacrament/SundayProgram'
import { type SacramentMeeting } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Gewählter Sonntag                                                   */
/* ------------------------------------------------------------------ */

interface SacramentContextValue {
  /** Der gewählte Sonntag, auf Mitternacht normiert */
  date: Date
  /** Datum als «yyyy-MM-dd» – zugleich die Dokument-ID */
  dateKey: string
  setDate: (next: Date) => void
  /** Programm aus Firestore; `null`, solange für diesen Sonntag nichts erfasst ist */
  meeting: SacramentMeeting | null
  loading: boolean
}

const SacramentContext = createContext<SacramentContextValue | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export function useSacrament(): SacramentContextValue {
  const context = useContext(SacramentContext)
  if (!context) {
    throw new Error('useSacrament muss innerhalb von <SacramentLayout> verwendet werden.')
  }
  return context
}

const SUBPAGES = [
  { to: 'leitung', label: 'Leitung' },
  { to: 'bekanntmachungen', label: 'Bekanntmachungen' },
  { to: 'angelegenheiten', label: 'Angelegenheiten' },
  { to: 'ansprachen', label: 'Ansprachen' },
  { to: 'musik', label: 'Musik' },
  { to: 'gebet', label: 'Gebet' },
]

/**
 * Rahmen für alle Bereiche der Abendmahlsversammlung.
 *
 * Der gewählte Sonntag gilt für sämtliche Unterseiten: Wer unter «Musik»
 * einen Sonntag einstellt und dann zu «Gebet» wechselt, bleibt beim selben
 * Datum. Er steht in der Adresse (`?sonntag=…`), damit sich eine Ansicht
 * teilen lässt, und wird zusätzlich gemerkt, damit er einen Neustart übersteht.
 */
export function SacramentLayout() {
  const { settings, userName } = useData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [remembered, setRemembered] = useLocalStorage<string>('bss:abendmahl:sonntag', '')

  const defaultKey = useMemo(
    () => toDateInput(upcomingWeekdays(settings.sacramentWeekday, 1)[0]),
    [settings.sacramentWeekday],
  )

  /*
   * Ein gemerkter Sonntag gilt nur, solange er nicht vorbei ist. Sonst
   * landet man nach einer Woche Pause auf der letzten Versammlung statt auf
   * der kommenden – das wäre beim Planen die falsche Ausgangslage.
   * ISO-Datumstexte lassen sich dafür direkt vergleichen.
   */
  const stillUseful = remembered >= defaultKey
  const dateKey = searchParams.get('sonntag') || (stillUseful ? remembered : '') || defaultKey

  const date = useMemo(() => {
    // Mittags, damit Zeitzonen den Tag nicht verschieben.
    const parsed = new Date(`${dateKey}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? new Date(`${defaultKey}T12:00:00`) : parsed
  }, [dateKey, defaultKey])

  const setDate = useCallback(
    (next: Date) => {
      const key = sacramentDocId(next)
      setRemembered(key)
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current)
          params.set('sonntag', key)
          return params
        },
        { replace: true },
      )
    },
    [setRemembered, setSearchParams],
  )

  const { meeting, loading } = useSacramentMeeting(sacramentDocId(date))

  const value = useMemo<SacramentContextValue>(
    () => ({ date, dateKey: sacramentDocId(date), setDate, meeting, loading }),
    [date, setDate, meeting, loading],
  )

  return (
    <SacramentContext.Provider value={value}>
      {/* Auf dem gedruckten Ablaufblatt steht der Kopf bereits im Blatt
          selbst – hier stünde er ein zweites Mal (siehe `sheet-page`). */}
      <div className="no-print-sheet mb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Abendmahlsversammlung
            </h1>
            {/* Was an diesem Sonntag stattfindet, steht neben dem Datum –
                auf jeder Unterseite, weil es überall dieselbe Auskunft ist. */}
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              {formatDateLong(date)}
              <SundayProgramBadge program={sundayProgram(date, meeting)} />
              {/* Wer sich um diesen Sonntag kümmert – festgelegt wird das
                  unter «Leitung» und unter «Ansprachen». */}
              {meeting?.responsibleId && (
                <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <UserCog className="size-3" aria-hidden />
                  {userName(meeting.responsibleId)}
                </span>
              )}
            </p>
          </div>
          <SundayPicker date={date} onChange={setDate} weekday={settings.sacramentWeekday} />
        </div>

        <nav className="no-scrollbar no-print -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {SUBPAGES.map((page) => (
            <NavLink
              key={page.to}
              // Der gewählte Sonntag steht in der Adresse und muss beim
              // Wechsel des Bereichs erhalten bleiben.
              to={{ pathname: page.to, search: `?sonntag=${sacramentDocId(date)}` }}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )
              }
            >
              {page.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Der Schlüssel setzt die Unterseite beim Sonntagswechsel zurück.
          So kann kein Entwurf versehentlich am falschen Datum landen. */}
      <Outlet key={value.dateKey} />
    </SacramentContext.Provider>
  )
}

/* ------------------------------------------------------------------ */

/** Auswahl des Sonntags: Pfeile für den Wochensprung, Liste für weitere Termine. */
function SundayPicker({
  date,
  onChange,
  weekday,
}: {
  date: Date
  onChange: (next: Date) => void
  weekday: number
}) {
  const options = useMemo(() => weekdaysAround(weekday, 6, 16), [weekday])
  const value = toDateInput(date)
  // Ein nachgetragener Sonntag ausserhalb des Fensters muss wählbar bleiben.
  const known = options.some((option) => toDateInput(option) === value)

  return (
    <div className="no-print flex items-center gap-1">
      <button
        type="button"
        className="btn-secondary p-2"
        onClick={() => onChange(addWeeks(date, -1))}
        aria-label="Vorheriger Sonntag"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>

      <select
        className="input w-auto min-w-44 py-1.5"
        value={value}
        onChange={(event) => onChange(new Date(`${event.target.value}T12:00:00`))}
        aria-label="Sonntag auswählen"
      >
        {!known && <option value={value}>{formatDateLong(date)}</option>}
        {options.map((option) => (
          <option key={toDateInput(option)} value={toDateInput(option)}>
            {formatDateLong(option)}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn-secondary p-2"
        onClick={() => onChange(addWeeks(date, 1))}
        aria-label="Nächster Sonntag"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Hinweis, dass jemand anders denselben Sonntag geändert hat, während hier
 * noch getippt wurde.
 *
 * Firestore entscheidet solche Fälle nach «wer zuletzt schreibt, gewinnt».
 * Bei ganzen Listen verschwänden die fremden Einträge dabei stillschweigend –
 * deshalb wird gefragt, statt einfach zu überschreiben.
 */
export function ConflictNotice({ onDiscard }: { onDiscard: () => void }) {
  return (
    <div className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="min-w-48 flex-1 text-amber-900 dark:text-amber-100">
        Jemand hat diesen Sonntag inzwischen geändert. Wenn du jetzt speicherst, ersetzt deine
        Fassung die andere.
      </p>
      <button type="button" className="btn-secondary btn-sm" onClick={onDiscard}>
        Meine Änderungen verwerfen
      </button>
    </div>
  )
}

/** Überschrift einer Unterseite – hält die Bereiche optisch beieinander. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
