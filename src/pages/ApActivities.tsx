import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CalendarSync,
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
import { useApView } from '@/hooks/useApView'
import { useNow } from '@/hooks/useNow'
import {
  ApActivityCard,
  ApActivityRow,
  ApDetails,
  AP_KIND_STYLES,
  AP_SPACING,
  apCountdown,
  apDateLabel,
  apTitle,
} from '@/components/ap/ApActivityRow'
import { ApActivityForm } from '@/components/ap/ApActivityForm'
import { ApCalendar } from '@/components/ap/ApCalendar'
import { ApScheduleDialog } from '@/components/ap/ApScheduleDialog'
import { ApFeedDialog } from '@/components/ap/ApFeedDialog'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/Pickers'
import { MenuChips, MenuChoice, MenuDivider, MenuToggle, ViewMenu } from '@/components/ui/ViewMenu'
import { cn } from '@/lib/utils'
import { differenceInCalendarDays, formatMonth, startOfDay, toDateInput } from '@/lib/dates'
import { apActivityEnd, saveApMonth } from '@/services/apActivities'
import { nextFreeApDate } from '@/services/apSchedule'
import { fromIsoDate } from '@/services/importHistory'
import {
  AP_ACTIVITY_KIND_LABELS,
  AP_DENSITY_LABELS,
  AP_FILTER_KINDS,
  AP_SCOPE_LABELS,
  AP_VIEW_MODE_LABELS,
  apVisibleActivities,
  isApCalendarMode,
  type ApActivity,
  type ApActivityKind,
  type ApView,
} from '@/lib/types'

/**
 * Der Aktivitätenplan der Priestertumskollegien.
 *
 * Er beantwortet vor allem eine Frage, und die stellt sich jede Woche neu:
 * **Was kommt als Nächstes?** Deshalb steht die Antwort ganz oben und
 * gross, über die volle Breite, mit allem, was man dafür wissen muss –
 * Treffpunkt, Zuständigkeit, wer aus der Bischofschaft dabei ist. Darunter
 * der Plan im Ganzen, nach Monaten gruppiert wie in der Tabelle, aus der er
 * stammt.
 *
 * Wie er dargestellt wird, sagt ein Knopf oben rechts: als **Liste** – ein
 * Fahrplan, von oben nach unten zu lesen –, als **Kacheln**, die jeden
 * Termin für sich hinstellen, oder als **Kalender** über eine Woche oder
 * einen ganzen Monat. Die beiden Kalenderansichten beantworten die andere
 * Frage: nicht «was kommt?», sondern «wann ist noch nichts?» – sie zeigen
 * auch die leeren Tage, die eine Liste stillschweigend überspringt (siehe
 * `lib/apCalendar`). Ein Griff auf einen Tag öffnet ihn samt allem, was an
 * ihm ansteht. Dazu drei Abstufungen, wie viel Luft der Plan bekommt, und
 * der Zeitraum. Die Wahl bleibt: im Browser und am Konto.
 *
 * Ebenfalls hinter dem Knopf: **welche Arten** der Plan zeigt. Wer alle
 * Klassen des Halbjahrs sucht, blendet die Aktivitäten weg – und mit der
 * ersten Einschränkung fallen die ausgefallenen Abende von selbst heraus:
 * Sie erklären eine Lücke im vollständigen Plan, in einer Auswahl erklären
 * sie nichts. Und ein Schalter für die grosse Karte: Wer den Plan
 * überarbeitet, statt ihn zu lesen, kennt den nächsten Termin längst.
 *
 * Der Seitenkopf bleibt beim Blättern stehen. Der Plan geht über Monate,
 * und die Knöpfe werden unterwegs gebraucht – am Telefon sind sie deshalb
 * bis auf «Ansicht» nur Symbole und bleiben mit dem Titel auf einer Zeile.
 *
 * Ausgefallene Abende bleiben sonst stehen, zählen aber nicht als «das
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

  const [view, setView] = useApView()
  const scope = view.scope
  const spacing = AP_SPACING[view.density]
  const calendar = isApCalendarMode(view.mode)

  const [wantsEdit, setWantsEdit] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApActivity | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  /*
   * Welche Woche bzw. welcher Monat im Kalender steht.
   *
   * Bewusst nicht in der gemerkten Ansicht: Wer die App morgen wieder
   * aufmacht, will den laufenden Monat sehen und nicht den, in dem er
   * zuletzt geblättert hat.
   */
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))

  /* Der Modus hängt am Recht, nicht nur am Knopf: Wird das Schreibrecht
     entzogen, während die Seite offen ist, fällt sie sofort zurück. */
  const editMode = canEditAp && wantsEdit

  const today = useMemo(() => toDateInput(new Date(now)), [now])

  const leadershipOf = useMemo(
    () => new Map(months.map((month) => [month.month, month.leadership])),
    [months],
  )

  /*
   * Der Plan, auf die gewählten Arten eingeschränkt.
   *
   * Die Einschränkung gilt für die ganze Seite und nicht bloss für die Liste
   * darunter: Stünde über einem auf Klassen eingeschränkten Plan als
   * Nächstes eine Aktivität, widerspräche die Seite sich selbst.
   */
  const shown = useMemo(() => apVisibleActivities(activities, view.kinds), [activities, view.kinds])

  /* Was kommt – ohne die abgesagten Abende. */
  const upcoming = useMemo(
    () =>
      shown
        .filter((activity) => apActivityEnd(activity) >= today && activity.kind !== 'cancelled')
        .sort((a, b) => a.date.localeCompare(b.date)),
    [shown, today],
  )

  const next = upcoming[0] ?? null

  const counts = useMemo(
    () => ({
      upcoming: shown.filter((activity) => apActivityEnd(activity) >= today).length,
      past: shown.filter((activity) => apActivityEnd(activity) < today).length,
      all: shown.length,
    }),
    [shown, today],
  )

  /* Der Plan, nach Zeitraum gefiltert und nach Monaten gruppiert. */
  const groups = useMemo(() => {
    let visible = shown
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
  }, [shown, scope, today])

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
      {/* Der Kopf bleibt stehen: Der Plan geht über Monate, und wer im
          Dezember die Ansicht wechseln oder einen Termin anlegen will, soll
          dafür nicht erst wieder nach oben blättern. */}
      <PageHeader
        sticky
        title="Aktivitäten AP’s"
        subtitle={
          editMode ? 'Bearbeitungsmodus – ein Klick auf einen Termin öffnet ihn' : undefined
        }
        actions={
          <>
            <ApViewMenu view={view} onChange={setView} counts={counts} />

            {/*
             * Das Abo steht neben der Ansicht und nicht im Bearbeitungsmodus:
             * Einen Kalender einzurichten heisst nicht, den Plan zu ändern –
             * und wer den Link weitergibt, tut das meist genau dann, wenn er
             * den Plan gerade jemandem zeigt. Auf schmalen Bildschirmen
             * bleibt nur das Symbol; die Kopfzeile trägt sonst vier Knöpfe.
             */}
            {canEditAp && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFeedOpen(true)}
                title="Den Plan in Google Calendar oder Apple Kalender abonnieren"
              >
                <CalendarSync className="size-4" aria-hidden />
                <span className="hidden lg:inline">Abonnieren</span>
                <span className="sr-only lg:hidden">Kalender abonnieren</span>
              </button>
            )}

            {canEditAp &&
              (editMode ? (
                <>
                  {/* Die Beschriftungen weichen am Telefon: Sonst rutscht die
                      Knopfreihe unter den Titel, und der Kopf, der ohnehin
                      stehen bleibt, nimmt zwei Zeilen weg. */}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={leaveEditMode}
                    aria-label="Ansichtsmodus"
                    title="Ansichtsmodus"
                  >
                    <Eye className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Ansichtsmodus</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setScheduleOpen(true)}
                    aria-label="Termine erzeugen"
                    title="Termine erzeugen"
                  >
                    <CalendarPlus className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Termine erzeugen</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => open(null)}
                    aria-label="Termin"
                    title="Termin"
                  >
                    <Plus className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Termin</span>
                  </button>
                </>
              ) : (
                /* Nur der Stift: Er steht in der App überall für «bearbeiten»,
                   und die Beschriftung war das längste Wort im Kopf. */
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setWantsEdit(true)}
                  aria-label="Bearbeitungsmodus"
                  title="Bearbeitungsmodus"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              ))}
          </>
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
          {next && view.showNext !== false && (
            <NextCard
              activity={next}
              today={today}
              leadership={leadershipOf.get(next.date.slice(0, 7)) ?? ''}
              onOpen={editMode ? () => open(next) : undefined}
            />
          )}

          {/* ---------- Der Plan ---------- */}
          {calendar ? (
            /* Der Kalender braucht weder Zeitraum noch Monatsgruppen: Er zeigt
               genau die Woche bzw. den Monat, in dem man gerade blättert –
               samt der Tage, an denen nichts ansteht. */
            <ApCalendar
              activities={shown}
              mode={view.mode === 'week' ? 'week' : 'month'}
              cursor={cursor}
              onCursor={setCursor}
              today={today}
              nextId={next?.id}
              onOpen={editMode ? open : undefined}
            />
          ) : groups.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={CalendarDays}
                title="Nichts gefunden"
                description={
                  view.kinds?.length
                    ? 'Mit dieser Auswahl an Arten steht in diesem Zeitraum nichts im Plan.'
                    : 'In diesem Zeitraum steht nichts im Plan.'
                }
              />
            </div>
          ) : (
            <div className={spacing.sections}>
              {groups.map(([month, entries]) => (
                <section key={month}>
                  <MonthHeader
                    month={month}
                    leadership={leadershipOf.get(month) ?? ''}
                    editable={editMode}
                  />
                  {view.mode === 'cards' ? (
                    <div className={spacing.grid}>
                      {entries.map((activity) => (
                        <ApActivityCard
                          key={activity.id}
                          activity={activity}
                          onOpen={editMode ? () => open(activity) : undefined}
                          highlight={activity.id === next?.id}
                          past={apActivityEnd(activity) < today}
                          density={view.density}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                      {entries.map((activity) => (
                        <ApActivityRow
                          key={activity.id}
                          activity={activity}
                          onOpen={editMode ? () => open(activity) : undefined}
                          highlight={activity.id === next?.id}
                          past={apActivityEnd(activity) < today}
                          density={view.density}
                        />
                      ))}
                    </div>
                  )}
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

      <ApFeedDialog open={feedOpen} onClose={() => setFeedOpen(false)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Ansicht                                                             */
/* ------------------------------------------------------------------ */

/**
 * Ein Knopf oben rechts, hinter dem alles steht, was die Darstellung
 * betrifft: Liste oder Kacheln, wie viel Luft, welcher Zeitraum.
 *
 * Der Zeitraum stand früher als breite Knopfleiste über dem Plan. Er hat
 * sie nicht verdient: Fast immer bleibt es bei «Kommend», und eine Leiste,
 * die man einmal im Jahr anfasst, nimmt dem Plan die oberste Zeile weg.
 * Hier steht sie mit den beiden anderen Wahlmöglichkeiten zusammen – alle
 * drei beantworten dieselbe Frage, nämlich wie man den Plan gerade ansehen
 * will.
 *
 * Der Knopf heisst «Ansicht» wie auf jeder anderen Seite und nicht mehr nach
 * dem gewählten Zeitraum: Was dahintersteckt, ist überall dasselbe, und ein
 * Knopf, dessen Beschriftung wechselt, ist zweimal derselbe Knopf mit zwei
 * Namen. Das Menü ist zugleich breit genug, dass «Ganzer Plan» ganz
 * hineinpasst – vorher stand es halb abgeschnitten am Rand.
 *
 * Die getroffene Wahl bleibt: im Browser und am Konto (siehe
 * `hooks/useApView`).
 */
function ApViewMenu({
  view,
  onChange,
  counts,
}: {
  view: ApView
  onChange: (patch: Partial<ApView>) => void
  counts: Record<ApView['scope'], number>
}) {
  /*
   * Zeitraum und Abstand gehören zum fortlaufenden Plan.
   *
   * Im Kalender hätten sie nichts zu bestimmen: Er zeigt die Woche bzw. den
   * Monat, in dem geblättert wird, und ein Raster hat den Abstand, den seine
   * Zellen brauchen. Ein Umschalter, der nichts bewirkt, ist schlimmer als
   * keiner – man dreht daran und sucht danach den Fehler.
   */
  const calendar = isApCalendarMode(view.mode)

  return (
    <ViewMenu width="sm:w-[24rem]">
      <MenuChoice<ApView['mode']>
        label="Darstellung"
        value={view.mode}
        onChange={(mode) => onChange({ mode })}
        options={(Object.keys(AP_VIEW_MODE_LABELS) as ApView['mode'][]).map((value) => ({
          value,
          label: AP_VIEW_MODE_LABELS[value],
        }))}
      />

      {!calendar && (
        <>
          <MenuChoice<ApView['scope']>
            label="Zeitraum"
            value={view.scope}
            onChange={(scope) => onChange({ scope })}
            options={(Object.keys(AP_SCOPE_LABELS) as ApView['scope'][]).map((value) => ({
              value,
              label: AP_SCOPE_LABELS[value],
              count: counts[value],
            }))}
          />
          <MenuChoice<ApView['density']>
            label="Abstand"
            value={view.density}
            onChange={(density) => onChange({ density })}
            options={(Object.keys(AP_DENSITY_LABELS) as ApView['density'][]).map((value) => ({
              value,
              label: AP_DENSITY_LABELS[value],
            }))}
          />
        </>
      )}

      <MenuDivider />

      {/* Ohne Erklärtext: Die Chips zeigen selbst, was gewählt ist, und was
          mit «Fällt aus» geschieht, sieht man am Plan darunter. */}
      <MenuChips<ApActivityKind>
        label="Arten"
        values={view.kinds ?? []}
        onChange={(kinds) => onChange({ kinds })}
        options={AP_FILTER_KINDS.map((value) => ({
          value,
          label: AP_ACTIVITY_KIND_LABELS[value],
        }))}
      />

      <MenuDivider />

      {/* Fehlt die Angabe, steht die Karte da – so sah der Plan immer aus. */}
      <MenuToggle
        label="Nächste Aktivität anzeigen"
        checked={view.showNext !== false}
        onChange={(showNext) => onChange({ showNext })}
      />
    </ViewMenu>
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
