import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  Eye,
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
  ApActivityRow,
  ApDetails,
  AP_KIND_STYLES,
  apCountdown,
  apDateLabel,
  apTitle,
} from '@/components/ap/ApActivityRow'
import { ApActivityForm } from '@/components/ap/ApActivityForm'
import { ApScheduleDialog } from '@/components/ap/ApScheduleDialog'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { cn } from '@/lib/utils'
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
 * gross, über die volle Breite, mit allem, was man dafür wissen muss –
 * Treffpunkt, Leitung, wer aus der Bischofschaft dabei ist. Darunter der
 * Plan im Ganzen: eine Zeile je Termin, nach Monaten gruppiert wie in der
 * Tabelle, aus der er stammt.
 *
 * Ausgefallene Abende bleiben stehen, zählen aber nicht als «das
 * Nächste»: Sie erklären eine Lücke, statt eine zu sein.
 *
 * Die Seite hat zwei Zustände, und sie sind bewusst getrennt: Der
 * **Ansichtsmodus** zeigt den Plan zum Lesen – nichts ist anklickbar,
 * nichts lässt sich verstellen. Wer Schreibrecht hat, wechselt mit einem
 * Knopf in den **Bearbeitungsmodus**; erst dort öffnen sich Termine und
 * erscheinen die Knöpfe zum Anlegen. Gestartet wird immer im
 * Ansichtsmodus, denn gelesen wird der Plan hundertmal öfter, als er
 * geändert wird.
 *
 * Der Bereich ist der einzige, den auch Konten ohne Vollzugriff sehen –
 * Berater und Jugendführung, die den Plan lesen oder pflegen, ohne je
 * Personendaten zu Gesicht zu bekommen. Wer nur zusehen darf, bleibt im
 * Ansichtsmodus und sieht den Umschalter gar nicht erst.
 */
export function ApActivities() {
  const { canEditAp } = useAuth()
  const { data: activities, loading } = useApActivities()
  const { data: months } = useApMonths()
  const now = useNow(300_000)

  const [scope, setScope] = useState<Scope>('upcoming')
  const [wantsEdit, setWantsEdit] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApActivity | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  /* Der Modus hängt am Recht, nicht nur am Knopf: Wird das Schreibrecht
     entzogen, während die Seite offen ist, fällt sie sofort zurück. */
  const editMode = canEditAp && wantsEdit

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
  }, [activities, scope, today])

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

  /* Der Weg zurück schliesst alles, was zum Bearbeiten offen war. */
  const leaveEditMode = () => {
    setWantsEdit(false)
    setFormOpen(false)
    setEditing(null)
    setScheduleOpen(false)
  }

  const startSchedule = () => {
    setWantsEdit(true)
    setScheduleOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Aktivitäten AP’s"
        subtitle={
          editMode ? 'Bearbeitungsmodus – ein Klick auf einen Termin öffnet ihn' : undefined
        }
        actions={
          canEditAp &&
          (editMode ? (
            <>
              <button type="button" className="btn-secondary" onClick={leaveEditMode}>
                <Eye className="size-4" aria-hidden />
                Ansichtsmodus
              </button>
              <button type="button" className="btn-secondary" onClick={() => setScheduleOpen(true)}>
                <CalendarPlus className="size-4" aria-hidden />
                <span className="hidden sm:inline">Termine erzeugen</span>
              </button>
              <button type="button" className="btn-primary" onClick={() => open(null)}>
                <Plus className="size-4" aria-hidden />
                <span className="hidden sm:inline">Termin</span>
              </button>
            </>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setWantsEdit(true)}>
              <Pencil className="size-4" aria-hidden />
              Bearbeitungsmodus
            </button>
          ))
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
                <button type="button" className="btn-primary" onClick={startSchedule}>
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
            <NextCard
              activity={next}
              today={today}
              leadership={leadershipOf.get(next.date.slice(0, 7)) ?? ''}
              onOpen={editMode ? () => open(next) : undefined}
            />
          )}

          {/* ---------- Zeitraum ---------- */}
          <div className="mb-4">
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
                description="In diesem Zeitraum steht nichts im Plan."
              />
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(([month, entries]) => (
                <section key={month}>
                  <MonthHeader
                    month={month}
                    leadership={leadershipOf.get(month) ?? ''}
                    editable={editMode}
                  />
                  <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                    {entries.map((activity) => (
                      <ApActivityRow
                        key={activity.id}
                        activity={activity}
                        onOpen={editMode ? () => open(activity) : undefined}
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
 * Die grosse Karte, über die ganze Breite.
 *
 * Sie zeigt dasselbe wie eine Zeile, nur ohne dass man etwas suchen muss:
 * Wie lange es noch dauert, was stattfindet, wo man sich trifft und wer
 * dabei ist – in dieser Reihenfolge, weil man sie in dieser Reihenfolge
 * fragt.
 *
 * Ohne `onOpen` – im Ansichtsmodus – ist sie eine Karte und keine
 * Schaltfläche: kein Zeigefinger, kein «Öffnen», nichts, was ins Leere
 * führt.
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
  onOpen?: () => void
}) {
  const style = AP_KIND_STYLES[activity.kind]
  const Icon = style.icon
  const days = differenceInCalendarDays(fromIsoDate(activity.date), startOfDay(fromIsoDate(today)))
  const running = activity.date <= today && apActivityEnd(activity) >= today

  const content = (
    <>
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

      {(onOpen || leadership) && (
        <span className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {onOpen && (
            <span className="text-brand-600 dark:text-brand-300 inline-flex items-center gap-1 text-sm font-medium">
              Öffnen
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          )}
          {leadership && (
            <span className="ml-auto text-xs text-slate-400">
              {formatMonth(fromIsoDate(activity.date))} · {leadership}
            </span>
          )}
        </span>
      )}
    </>
  )

  const shell = 'card relative mb-5 flex w-full flex-col overflow-hidden p-5 text-left'

  if (!onOpen) return <div className={shell}>{content}</div>

  return (
    <button type="button" onClick={onOpen} className={cn(shell, 'card-hover group')}>
      {content}
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
 * Zwischenüberschrift – und steht hier an derselben Stelle. Im
 * Bearbeitungsmodus genügt ein Klick zum Ändern; ein eigener Dialog wäre
 * für ein einzelnes Wort zu viel.
 */
function MonthHeader({
  month,
  leadership,
  editable,
}: {
  month: string
  leadership: string
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

      {editable && editing ? (
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
    </div>
  )
}
