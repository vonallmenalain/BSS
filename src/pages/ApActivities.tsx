import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  Info,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApActivities, useApMonths } from '@/hooks/useFirestore'
import { useNow } from '@/hooks/useNow'
import {
  ApActivityCard,
  ApDetails,
  AP_KIND_STYLES,
  apCountdown,
  apDateLabel,
  apTitle,
} from '@/components/ap/ApActivityCard'
import { ApActivityForm } from '@/components/ap/ApActivityForm'
import { ApScheduleDialog } from '@/components/ap/ApScheduleDialog'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { cn, matchesSearch } from '@/lib/utils'
import { differenceInCalendarDays, formatMonth, startOfDay, toDateInput } from '@/lib/dates'
import { apActivityEnd, saveApMonth } from '@/services/apActivities'
import { nextFreeApDate } from '@/services/apSchedule'
import { fromIsoDate } from '@/services/importHistory'
import { AP_ACTIVITY_KIND_LABELS, type ApActivity } from '@/lib/types'

type Scope = 'upcoming' | 'past' | 'all'

/**
 * Der Aktivitätenplan der Priestertumskollegien.
 *
 * Er beantwortet vor allem eine Frage, und die stellt sich jede Woche neu:
 * **Was kommt als Nächstes?** Deshalb steht die Antwort ganz oben und
 * gross, mit allem, was man dafür wissen muss – Treffpunkt, Leitung, wer
 * aus der Bischofschaft dabei ist. Darunter die drei folgenden Termine,
 * und erst danach der Plan im Ganzen, nach Monaten gruppiert wie in der
 * Tabelle, aus der er stammt.
 *
 * Ausgefallene Abende bleiben stehen, zählen aber nicht als «das
 * Nächste»: Sie erklären eine Lücke, statt eine zu sein.
 *
 * Der Bereich ist der einzige, den auch Konten ohne Vollzugriff sehen –
 * Berater und Jugendführung, die den Plan lesen oder pflegen, ohne je
 * Personendaten zu Gesicht zu bekommen.
 */
export function ApActivities() {
  const { canEditAp } = useAuth()
  const { data: activities, loading } = useApActivities()
  const { data: months } = useApMonths()
  const now = useNow(300_000)

  const [scope, setScope] = useState<Scope>('upcoming')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApActivity | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const today = useMemo(() => toDateInput(new Date(now)), [now])

  const leadershipOf = useMemo(
    () => new Map(months.map((month) => [month.month, month.leadership])),
    [months],
  )

  /* Was kommt – ohne die abgesagten Abende. */
  const upcoming = useMemo(
    () =>
      activities
        .filter((activity) => apActivityEnd(activity) >= today && activity.kind !== 'cancelled')
        .sort((a, b) => a.date.localeCompare(b.date)),
    [activities, today],
  )

  const next = upcoming[0] ?? null
  const following = upcoming.slice(1, 4)

  const counts = useMemo(
    () => ({
      upcoming: activities.filter((activity) => apActivityEnd(activity) >= today).length,
      past: activities.filter((activity) => apActivityEnd(activity) < today).length,
      all: activities.length,
    }),
    [activities, today],
  )

  /* Der Plan, gefiltert und nach Monaten gruppiert. */
  const groups = useMemo(() => {
    let visible = activities
    if (scope === 'upcoming') {
      visible = visible.filter((activity) => apActivityEnd(activity) >= today)
    } else if (scope === 'past') {
      visible = visible.filter((activity) => apActivityEnd(activity) < today)
    }

    if (search.trim()) {
      visible = visible.filter((activity) =>
        matchesSearch(
          [
            activity.title,
            activity.location,
            activity.leader,
            activity.bishopric,
            activity.advisor,
            activity.note,
            AP_ACTIVITY_KIND_LABELS[activity.kind],
          ]
            .filter(Boolean)
            .join(' '),
          search,
        ),
      )
    }

    const sorted = [...visible].sort((a, b) => a.date.localeCompare(b.date))
    // Vergangenes andersherum: Das zuletzt Gewesene interessiert zuerst.
    if (scope === 'past') sorted.reverse()

    const byMonth = new Map<string, ApActivity[]>()
    for (const activity of sorted) {
      const month = activity.date.slice(0, 7)
      const list = byMonth.get(month)
      if (list) list.push(activity)
      else byMonth.set(month, [activity])
    }
    return [...byMonth.entries()]
  }, [activities, scope, search, today])

  /* Vorschlag für einen neuen Termin: der nächste freie Mittwoch bzw. Sonntag. */
  const suggestedDate = useMemo(
    () =>
      nextFreeApDate(
        activities.map((activity) => activity.date),
        new Date(now),
      ),
    [activities, now],
  )

  const open = (activity: ApActivity | null) => {
    setEditing(activity)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Aktivitäten AP’s"
        subtitle={
          activities.length === 0
            ? 'Noch kein Plan erfasst'
            : `${counts.all} Termine · ${counts.upcoming} kommend`
        }
        actions={
          canEditAp && (
            <>
              <button type="button" className="btn-secondary" onClick={() => setScheduleOpen(true)}>
                <CalendarPlus className="size-4" aria-hidden />
                <span className="hidden sm:inline">Termine erzeugen</span>
              </button>
              <button type="button" className="btn-primary" onClick={() => open(null)}>
                <Plus className="size-4" aria-hidden />
                <span className="hidden sm:inline">Termin</span>
              </button>
            </>
          )
        }
      />

      {loading && activities.length === 0 ? (
        <SkeletonList rows={4} />
      ) : activities.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title="Noch kein Aktivitätenplan"
            description={
              canEditAp
                ? 'Der bisherige Excel-Plan lässt sich unter «Einstellungen › Importe › Aktivitäten AP» einlesen. Alternativ legt «Termine erzeugen» den gewohnten Takt an: Mittwochaktivität, AP-Klasse am 2. und 4. Sonntag.'
                : 'Sobald die Bischofschaft den Plan erfasst hat, steht er hier.'
            }
            action={
              canEditAp && (
                <button type="button" className="btn-primary" onClick={() => setScheduleOpen(true)}>
                  <CalendarPlus className="size-4" aria-hidden />
                  Termine erzeugen
                </button>
              )
            }
          />
        </div>
      ) : (
        <>
          {/* ---------- Was als Nächstes kommt ---------- */}
          {next && (
            <div className="mb-5 grid gap-3 lg:grid-cols-3">
              <NextCard
                activity={next}
                today={today}
                leadership={leadershipOf.get(next.date.slice(0, 7)) ?? ''}
                onOpen={() => open(next)}
              />

              {following.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="px-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    Danach
                  </p>
                  {following.map((activity) => (
                    <FollowingRow
                      key={activity.id}
                      activity={activity}
                      today={today}
                      onOpen={() => open(activity)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------- Filter ---------- */}
          <div className="mb-4 space-y-3">
            <input
              type="search"
              className="input"
              placeholder="Aktivität, Ort, Leitung oder Bemerkung suchen …"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <SegmentedControl<Scope>
              value={scope}
              onChange={setScope}
              options={[
                { value: 'upcoming', label: 'Kommend', count: counts.upcoming },
                { value: 'past', label: 'Vergangen', count: counts.past },
                { value: 'all', label: 'Ganzer Plan', count: counts.all },
              ]}
            />
          </div>

          {/* ---------- Der Plan ---------- */}
          {groups.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={CalendarDays}
                title="Nichts gefunden"
                description="Passe Suche oder Auswahl an."
              />
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(([month, entries]) => (
                <section key={month}>
                  <MonthHeader
                    month={month}
                    leadership={leadershipOf.get(month) ?? ''}
                    count={entries.length}
                    editable={canEditAp}
                  />
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {entries.map((activity) => (
                      <ApActivityCard
                        key={activity.id}
                        activity={activity}
                        onOpen={() => open(activity)}
                        highlight={activity.id === next?.id}
                        past={apActivityEnd(activity) < today}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <ApActivityForm
        open={formOpen}
        activity={editing}
        defaultDate={suggestedDate}
        all={activities}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      />

      <ApScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        activities={activities}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Der nächste Termin                                                  */
/* ------------------------------------------------------------------ */

/**
 * Die grosse Karte.
 *
 * Sie zeigt dasselbe wie eine Kachel, nur ohne dass man etwas suchen muss:
 * Wie lange es noch dauert, was stattfindet, wo man sich trifft und wer
 * dabei ist – in dieser Reihenfolge, weil man sie in dieser Reihenfolge
 * fragt.
 */
function NextCard({
  activity,
  today,
  leadership,
  onOpen,
}: {
  activity: ApActivity
  today: string
  /** Welches Kollegium den Monat führt – «Leitung Lehrer» */
  leadership: string
  onOpen: () => void
}) {
  const style = AP_KIND_STYLES[activity.kind]
  const Icon = style.icon
  const days = differenceInCalendarDays(fromIsoDate(activity.date), startOfDay(fromIsoDate(today)))
  const running = activity.date <= today && apActivityEnd(activity) >= today

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card card-hover group relative flex flex-col overflow-hidden p-5 text-left lg:col-span-2"
    >
      <span className={cn('absolute inset-x-0 top-0 h-1', style.bar)} aria-hidden />

      <div className="flex flex-wrap items-center gap-2">
        <span className="badge bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
          <Sparkles className="size-3" aria-hidden />
          Als Nächstes
        </span>
        <span className={cn('badge', style.chip)}>
          <Icon className="size-3" aria-hidden />
          {AP_ACTIVITY_KIND_LABELS[activity.kind]}
        </span>
        <span className="ml-auto text-sm font-semibold text-slate-500 dark:text-slate-400">
          {apCountdown(days, running)}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
        {apDateLabel(activity)}
        {activity.time?.trim() && <span className="tabular"> · {activity.time.trim()} Uhr</span>}
      </p>

      <h2
        className={cn(
          'mt-1 text-xl font-semibold tracking-tight text-balance sm:text-2xl',
          !activity.title.trim() && 'text-slate-400 italic',
        )}
      >
        {apTitle(activity)}
      </h2>

      <ApDetails activity={activity} className="mt-3 text-sm text-slate-600 dark:text-slate-300" />

      {activity.note?.trim() && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <Info className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden />
          <span className="whitespace-pre-line">{activity.note.trim()}</span>
        </p>
      )}

      {/* Die Fusszeile sitzt unten, auch wenn oben wenig steht: Zwei Karten
          nebeneinander sollen unten auf einer Linie enden. */}
      <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <span className="text-brand-600 dark:text-brand-300 inline-flex items-center gap-1 text-sm font-medium">
          Öffnen
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
        {leadership && (
          <span className="text-xs text-slate-400">
            {formatMonth(fromIsoDate(activity.date))} · {leadership}
          </span>
        )}
      </span>
    </button>
  )
}

/** Ein Termin aus «Danach» – knapp, aber mit demselben Aufbau. */
function FollowingRow({
  activity,
  today,
  onOpen,
}: {
  activity: ApActivity
  today: string
  onOpen: () => void
}) {
  const style = AP_KIND_STYLES[activity.kind]
  const Icon = style.icon
  const days = differenceInCalendarDays(fromIsoDate(activity.date), startOfDay(fromIsoDate(today)))

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card card-hover flex flex-1 items-center gap-3 p-3 text-left"
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', style.block)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm font-medium',
            !activity.title.trim() && 'text-slate-400 italic',
          )}
        >
          {apTitle(activity)}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
          {apDateLabel(activity)}
        </span>
      </span>
      <span className="shrink-0 text-xs font-medium text-slate-400">
        {apCountdown(days, false)}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Monatsüberschrift                                                   */
/* ------------------------------------------------------------------ */

/**
 * «März 2026 · Leitung Diakone».
 *
 * Welches Kollegium den Monat führt, stand im Excel-Plan als
 * Zwischenüberschrift – und steht hier an derselben Stelle. Anklicken
 * genügt zum Ändern; ein eigener Dialog wäre für ein einzelnes Wort zu
 * viel.
 */
function MonthHeader({
  month,
  leadership,
  count,
  editable,
}: {
  month: string
  leadership: string
  count: number
  editable: boolean
}) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(leadership)
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setValue(leadership)
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const outcome = await saveApMonth(month, value)
      toast.saved('Leitung gespeichert.', outcome)
      setEditing(false)
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 className="text-base font-semibold tracking-tight">
        {formatMonth(fromIsoDate(`${month}-01`))}
      </h2>

      {editing ? (
        <span className="flex items-center gap-1">
          <input
            className="input w-48 py-1 text-sm"
            value={value}
            autoFocus
            placeholder="z. B. «Leitung Lehrer»"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void save()
              if (event.key === 'Escape') {
                setValue(leadership)
                setEditing(false)
              }
            }}
          />
          <button
            type="button"
            className="btn-ghost p-1.5"
            onClick={() => void save()}
            disabled={saving}
            aria-label="Leitung speichern"
          >
            <Check className="size-4" aria-hidden />
          </button>
        </span>
      ) : editable ? (
        <button
          type="button"
          onClick={startEditing}
          className={cn(
            'badge transition',
            leadership
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
          )}
        >
          <Pencil className="size-3" aria-hidden />
          {leadership || 'Leitung festlegen'}
        </button>
      ) : (
        leadership && (
          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {leadership}
          </span>
        )
      )}

      <span className="tabular ml-auto text-xs text-slate-400">
        {count} {count === 1 ? 'Termin' : 'Termine'}
      </span>
    </div>
  )
}
