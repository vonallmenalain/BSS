import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Plus,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Mic,
  ListTodo,
  Play,
  Cake,
  CheckCircle2,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import {
  useApActivities,
  useMeetings,
  useOpenItems,
  useSacramentMeetings,
  useTalks,
} from '@/hooks/useFirestore'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useOwnItem } from '@/hooks/useOwnItem'
import { MemberLink } from '@/components/ui/MemberLink'
import { AgendaItemCard } from '@/components/agenda/AgendaItemCard'
import { AgendaItemForm } from '@/components/agenda/AgendaItemForm'
import { FOCUS_PARAM } from '@/components/agenda/MeetingFocus'
import { AP_KIND_STYLES, apDateLabel, apTitle } from '@/components/ap/ApActivityRow'
import { MeetingStatusBadge } from '@/components/ui/Badge'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/Pickers'
import {
  AddButton,
  MenuCounter,
  MenuDivider,
  MenuSection,
  MenuToggle,
  ViewMenu,
} from '@/components/ui/ViewMenu'
import {
  formatDateLong,
  formatDateShort,
  formatDayShort,
  formatTime,
  hasBirthdaySoon,
  toDate,
  toDateInput,
  differenceInCalendarDays,
  startOfDay,
  upcomingWeekdays,
} from '@/lib/dates'
import { isDutyItem } from '@/lib/monthlyDuties'
import { cn } from '@/lib/utils'
import { sortForMeeting, sortForPendenzen } from '@/services/agenda'
import { apActivityEnd } from '@/services/apActivities'
import {
  openTalkSlots,
  sacramentDocId,
  sundayProgram,
  talksForDate,
  talksWithoutConfirmation,
} from '@/services/sacrament'
import {
  AP_ACTIVITY_KIND_LABELS,
  DASHBOARD_AREA_LABELS,
  DASHBOARD_TILE_LABELS,
  DEFAULT_DASHBOARD_VIEW,
  normalizeDashboardView,
  normalizePendenzenSort,
  toItemKind,
  type AgendaItem,
  type DashboardArea,
  type DashboardTileId,
  type DashboardView,
} from '@/lib/types'

/**
 * Die Übersicht – und was jede und jeder darauf sehen will.
 *
 * Die Seite besteht aus Kacheln, und welche davon erscheinen, sagt der Knopf
 * «Ansicht» oben rechts: Jede lässt sich ausblenden, verschieben und
 * zwischen der breiten Hauptspalte, der schmalen Spalte daneben und der
 * ganzen Breite darunter umhängen. Wo etwas gezählt wird – Traktanden der
 * nächsten Sitzung, eigene Pendenzen, Sonntage, AP-Termine –, steht dort
 * auch, wie viele es sein sollen.
 *
 * Die Wahl liegt im Browser: Sie gehört zum Gerät, an dem man sitzt, und ist
 * schon da, bevor der erste Schnappschuss aus Firestore eintrifft.
 */
export function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const { settings, members, users } = useData()
  const navigate = useNavigate()
  const { data: meetings, loading: meetingsLoading } = useMeetings(20)
  const { data: openItems, loading: itemsLoading } = useOpenItems()
  const { data: talks } = useTalks(100)
  const { data: sacramentMeetings } = useSacramentMeetings(20)
  const { data: apActivities } = useApActivities()
  const [formOpen, setFormOpen] = useState(false)

  const [storedView, setView] = useLocalStorage<DashboardView>(
    'bss:uebersicht:ansicht',
    DEFAULT_DASHBOARD_VIEW,
  )
  const view = useMemo(() => normalizeDashboardView(storedView), [storedView])

  /* Nächste Sitzung: die zeitlich nächste, die noch nicht abgeschlossen ist. */
  const nextMeeting = useMemo(() => {
    const upcoming = meetings
      .filter((m) => m.status !== 'closed')
      .sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0))
    return upcoming.find((m) => m.status === 'running') ?? upcoming[0] ?? null
  }, [meetings])

  const nextMeetingRef = useMemo(() => {
    const date = toDate(nextMeeting?.date)
    return nextMeeting && date ? { id: nextMeeting.id, date } : null
  }, [nextMeeting])

  const daysToMeeting = nextMeetingRef
    ? differenceInCalendarDays(startOfDay(nextMeetingRef.date), startOfDay(new Date()))
    : null

  /*
   * Pendenzen: was liegengeblieben ist.
   *
   * Neue Traktanden zählen nicht mit – sie stehen in ihrer Sitzung und
   * werden erst zur Pendenz, wenn diese abgeschlossen wird, ohne dass der
   * Haken gesetzt ist. Sonst zeigte «Meine Pendenzen» bloss, was für die
   * nächste Sitzung schon vorbereitet ist.
   */
  const pendenzen = useMemo(
    () => openItems.filter((item) => toItemKind(item) === 'pendenz'),
    [openItems],
  )

  /*
   * «Meine» ist mehr als «mir zugewiesen»: Eine Berufungsrunde gehört auch
   * dem, der darin eine Zeile trägt oder namentlich darin steht. Dieselbe
   * Frage beantwortet die Pendenzenliste (siehe `hooks/useOwnItem`).
   */
  const ownItem = useOwnItem()

  const myItems = useMemo(() => sortForPendenzen(pendenzen.filter(ownItem)), [pendenzen, ownItem])

  // Dieselbe Reihenfolge wie in der Sitzung: zuerst die neuen Traktanden,
  // danach die Pendenzen aus früheren Sitzungen – diese in der Reihenfolge
  // der Pendenzenliste, wenn sie dort von Hand gelegt ist.
  const manualPendenzen = normalizePendenzenSort(settings.pendenzenSort).field === 'manual'
  const meetingItems = useMemo(
    () =>
      sortForMeeting(
        openItems.filter((item) => item.meetingId === nextMeeting?.id),
        manualPendenzen,
      ),
    [openItems, nextMeeting?.id, manualPendenzen],
  )

  /* Ohne die Monatspendenzen: Die warten auf keine Sitzung, sondern
     gehören dem Monat (siehe `lib/monthlyDuties`). */
  const unassignedCount = pendenzen.filter((item) => !item.meetingId && !isDutyItem(item)).length

  /* Ansprachen: die nächsten Sonntage und ihre Lücken ---------------- */
  const talkGaps = useMemo(() => {
    const byKey = new Map(sacramentMeetings.map((meeting) => [meeting.id, meeting]))
    return upcomingWeekdays(settings.sacramentWeekday, 6).map((sunday) => {
      const assigned = talksForDate(talks, sunday)
      const meeting = byKey.get(sacramentDocId(sunday)) ?? null
      const program = sundayProgram(sunday, meeting)
      return {
        date: sunday,
        assigned: assigned.length,
        program,
        // Berücksichtigt eine abweichende Anzahl Ansprachen und Sonntage,
        // an denen gar keine vorgesehen sind.
        open: openTalkSlots(sunday, meeting, assigned, settings.talksPerSunday),
        // Besetzt heisst noch nicht zugesagt – auch das ist offene Arbeit.
        pending: talksWithoutConfirmation(assigned),
      }
    })
  }, [talks, sacramentMeetings, settings.sacramentWeekday, settings.talksPerSunday])

  const openTalkCount = talkGaps.reduce((sum, gap) => sum + gap.open, 0)

  /* Aktivitätenplan: die nächsten Termine, ohne die abgesagten Abende. */
  const nextApActivities = useMemo(() => {
    const today = toDateInput(new Date())
    return apActivities
      .filter((activity) => apActivityEnd(activity) >= today && activity.kind !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, view.apActivities)
  }, [apActivities, view.apActivities])

  /* Geburtstage ------------------------------------------------------ */
  const birthdays = useMemo(
    () =>
      members
        .filter((m) => m.status === 'active' && hasBirthdaySoon(m.birthDate, 10))
        .sort((a, b) => {
          const dayOf = (value: typeof a.birthDate) => {
            const date = toDate(value)
            if (!date) return 999
            const today = startOfDay(new Date())
            const candidate = new Date(today.getFullYear(), date.getMonth(), date.getDate())
            if (candidate < today) candidate.setFullYear(today.getFullYear() + 1)
            return differenceInCalendarDays(candidate, today)
          }
          return dayOf(a.birthDate) - dayOf(b.birthDate)
        })
        .slice(0, 5),
    [members],
  )

  /*
   * Wer sich registriert hat, sieht bis zur Freigabe nichts – und merkt es
   * nur selbst. Deshalb steht die offene Registrierung hier, wo die
   * Bischofschaft ohnehin hinschaut, statt in einer Einstellungsseite, die
   * man aufsuchen müsste.
   */
  const pendingUsers = useMemo(() => users.filter((user) => user.role === 'pending'), [users])

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Guten Morgen'
    if (hour < 18) return 'Guten Tag'
    return 'Guten Abend'
  })()

  /*
   * Ein Eintrag wird dort geöffnet, wo er zu Hause ist – und gleich
   * aufgeklappt: In der Sitzung ist das der Punkt im Sitzungsmodus, sonst die
   * Zeile in der Pendenzenliste.
   */
  const handleOpenItem = (item: AgendaItem) => {
    if (item.meetingId) navigate(`/sitzungen/${item.meetingId}?${FOCUS_PARAM}=${item.id}`)
    else navigate(`/pendenzen?pendenz=${item.id}`)
  }

  /* ---------- Die Kacheln ---------- */

  const tiles: Record<DashboardTileId, ReactNode> = {
    meeting: meetingsLoading ? (
      <SkeletonList rows={1} />
    ) : nextMeeting && nextMeetingRef ? (
      <div className="card overflow-hidden">
        <div className="from-brand-600 to-brand-700 bg-gradient-to-br p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-brand-100 text-xs font-medium tracking-wide uppercase">
                {nextMeeting.status === 'running'
                  ? 'Sitzung läuft'
                  : daysToMeeting === 0
                    ? 'Heute'
                    : daysToMeeting === 1
                      ? 'Morgen'
                      : daysToMeeting != null && daysToMeeting > 0
                        ? `In ${daysToMeeting} Tagen`
                        : 'Überfällig'}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold">{nextMeeting.title}</h2>
              <p className="text-brand-100 mt-0.5 text-sm">
                {formatDateLong(nextMeeting.date)} · {formatTime(nextMeeting.date)}
                {nextMeeting.location && ` · ${nextMeeting.location}`}
              </p>
            </div>
            <MeetingStatusBadge status={nextMeeting.status} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/sitzungen/${nextMeeting.id}`}
              className="btn text-brand-800 bg-white hover:bg-brand-50"
            >
              {nextMeeting.status === 'running' ? (
                <>
                  <Play className="size-4" aria-hidden />
                  Weiterführen
                </>
              ) : (
                <>
                  <CalendarDays className="size-4" aria-hidden />
                  Sitzung öffnen
                </>
              )}
            </Link>
            {unassignedCount > 0 && (
              <Link
                to={`/sitzungen/${nextMeeting.id}`}
                className="btn border border-white/30 text-white hover:bg-white/10"
              >
                {unassignedCount} Pendenz{unassignedCount === 1 ? '' : 'en'} übernehmen
              </Link>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Traktanden dieser Sitzung</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {meetingItems.length} offen
            </span>
          </div>
          {meetingItems.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-500 dark:text-slate-400">
              Noch nichts traktandiert.
            </p>
          ) : (
            <div className="space-y-2">
              {meetingItems.slice(0, view.meetingItems).map((item) => (
                <AgendaItemCard
                  key={item.id}
                  item={item}
                  compact
                  showDoneToggle={false}
                  onOpen={handleOpenItem}
                />
              ))}
              {meetingItems.length > view.meetingItems && (
                <Link
                  to={`/sitzungen/${nextMeeting.id}`}
                  className="text-brand-600 dark:text-brand-300 flex items-center justify-center gap-1 py-2 text-sm hover:underline"
                >
                  Alle {meetingItems.length} anzeigen
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="card">
        <EmptyState
          icon={CalendarDays}
          title="Keine Sitzung geplant"
          description="Lege den nächsten Termin fest, damit Traktanden zugeordnet werden können."
          action={
            <Link to="/sitzungen" className="btn-primary">
              <Plus className="size-4" aria-hidden />
              Sitzung planen
            </Link>
          }
        />
      </div>
    ),

    stats: <StatRow pendenzen={pendenzen.length} mine={myItems.length} openTalks={openTalkCount} />,

    talks: (
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Mic className="size-4 text-slate-400" aria-hidden />
            Ansprachen
          </h3>
          <Link
            to="/abendmahl/ansprachen"
            className="text-brand-600 dark:text-brand-300 text-xs hover:underline"
          >
            Planen
          </Link>
        </div>
        <ul className="divide-list -mx-1">
          {talkGaps.slice(0, view.talkSundays).map((gap) => (
            <li
              key={gap.date.toISOString()}
              className="flex items-center justify-between px-1 py-2 text-sm"
            >
              <span>{formatDateShort(gap.date)}</span>
              {!gap.program.plansTalks ? (
                /* Zeugnisversammlung, Konferenz, Darbietung der Kinder:
                   Hier fehlt nichts – hier ist nichts vorgesehen. */
                <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {gap.program.label}
                </span>
              ) : gap.open > 0 ? (
                <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {gap.open} offen
                </span>
              ) : gap.pending > 0 ? (
                /* Alle Plätze besetzt, aber noch nicht alle haben zugesagt –
                   vollständig ist der Sonntag damit noch nicht. */
                <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {gap.pending} ohne Zusage
                </span>
              ) : (
                <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  <CheckCircle2 className="size-3" aria-hidden />
                  Vollständig
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    ),

    ap: (
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-slate-400" aria-hidden />
            Aktivitäten AP’s
          </h3>
          <Link to="/ap" className="text-brand-600 dark:text-brand-300 text-xs hover:underline">
            Zum Plan
          </Link>
        </div>
        {nextApActivities.length === 0 ? (
          <p className="py-2 text-sm text-slate-500 dark:text-slate-400">Nichts geplant.</p>
        ) : (
          <ul className="divide-list -mx-1">
            {nextApActivities.map((activity) => {
              const style = AP_KIND_STYLES[activity.kind]
              const Icon = style.icon
              return (
                <li key={activity.id} className="px-1 py-2">
                  <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className={cn('badge', style.chip)}>
                      <Icon className="size-3" aria-hidden />
                      {AP_ACTIVITY_KIND_LABELS[activity.kind]}
                    </span>
                    <span className="truncate">{apDateLabel(activity)}</span>
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium">{apTitle(activity)}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    ),

    birthdays:
      birthdays.length === 0 ? null : (
        <section className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Cake className="size-4 text-slate-400" aria-hidden />
            Geburtstage
          </h3>
          <ul className="space-y-2 text-sm">
            {birthdays.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2">
                <MemberLink
                  memberId={member.id}
                  label="Übersicht"
                  className="min-w-0 truncate hover:underline"
                >
                  {member.firstName} {member.lastName}
                </MemberLink>
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {/* «Do., 06.08.» – ohne Jahr, aber vollständig. Früher stand
                      hier ein abgeschnittenes Datum mit einer Null am Ende. */}
                  {formatDayShort(
                    (() => {
                      const date = toDate(member.birthDate)!
                      const today = startOfDay(new Date())
                      const next = new Date(today.getFullYear(), date.getMonth(), date.getDate())
                      if (next < today) next.setFullYear(today.getFullYear() + 1)
                      return next
                    })(),
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ),

    /* Eine Spalte, seit die zweite weggefallen ist: Dort stand «Überfällig»,
       und ein Fälligkeitsdatum gibt es nicht mehr. */
    pendenzen: (
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ListTodo className="size-4 text-slate-400" aria-hidden />
            Meine Pendenzen
          </h2>
          {/* «Alle» heisst hier: alle meine – die Kachel zeigt nur die
              ersten paar. Der Ausschnitt steht deshalb in der Adresse. */}
          <Link
            to="/pendenzen?ansicht=meine"
            className="text-brand-600 dark:text-brand-300 text-xs hover:underline"
          >
            Alle anzeigen
          </Link>
        </div>
        {itemsLoading ? (
          <SkeletonList rows={2} />
        ) : myItems.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={CheckCircle2}
              title="Nichts offen"
              description="Dir ist aktuell keine Pendenz zugewiesen."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {myItems.slice(0, view.myItems).map((item) => (
              <AgendaItemCard
                key={item.id}
                item={item}
                compact
                showDoneToggle={false}
                onOpen={handleOpenItem}
              />
            ))}
          </div>
        )}
      </section>
    ),
  }

  /*
   * Die Kacheln in Bänder aufteilen – in der gewählten Reihenfolge.
   *
   * Früher wurden zuerst Haupt- und Seitenspalte gezeichnet und alles Breite
   * danach. Wer «Nächste Sitzung» nach oben stellte und auf «Breit» setzte,
   * fand sie deshalb ganz unten wieder: Der Platz überstimmte die
   * Reihenfolge. Jetzt wandert die Liste von oben nach unten durch und
   * beginnt bei jedem Wechsel zwischen «breit» und «zweispaltig» ein neues
   * Band. Die Reihenfolge gilt damit immer, und nebeneinander steht, was
   * ohnehin nebeneinander gehört.
   */
  const bands = useMemo(() => {
    type Band =
      | { kind: 'full'; ids: DashboardTileId[] }
      | { kind: 'columns'; main: DashboardTileId[]; side: DashboardTileId[] }

    const result: Band[] = []
    for (const tile of view.tiles) {
      if (!tile.visible) continue
      const last = result[result.length - 1]
      if (tile.area === 'full') {
        if (last?.kind === 'full') last.ids.push(tile.id)
        else result.push({ kind: 'full', ids: [tile.id] })
      } else {
        const band =
          last?.kind === 'columns' ? last : ({ kind: 'columns', main: [], side: [] } as Band)
        if (band !== last) result.push(band)
        if (band.kind === 'columns') band[tile.area].push(tile.id)
      }
    }
    return result
  }, [view.tiles])

  const nothingVisible = bands.length === 0

  return (
    <>
      <PageHeader
        title={`${greeting}, ${profile?.displayName.split(' ')[0] ?? ''}`}
        subtitle={settings.wardName}
        hidden={!view.greeting}
        actions={
          <>
            <DashboardMenu view={view} onChange={setView} />
            <AddButton label="Traktandum" onClick={() => setFormOpen(true)} />
          </>
        }
      />

      {/* Freischalten kann nur das Administrator-Konto – allen anderen
          würde der Hinweis eine Tür zeigen, die für sie zu ist. */}
      {isAdmin && pendingUsers.length > 0 && (
        <Link
          to="/einstellungen#benutzer"
          className="card card-hover mb-4 flex items-center gap-3 border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
            <UserPlus className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-amber-900 dark:text-amber-100">
              {pendingUsers.length === 1
                ? 'Eine neue Registrierung wartet auf Freigabe'
                : `${pendingUsers.length} neue Registrierungen warten auf Freigabe`}
            </span>
            <span className="block truncate text-xs text-amber-800 dark:text-amber-200">
              {pendingUsers.map((user) => user.displayName || user.email).join(', ')} – sieht noch
              nichts, bis jemand den Zugriff festlegt.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        </Link>
      )}

      {nothingVisible ? (
        <div className="card">
          <EmptyState
            icon={LayoutDashboard}
            title="Alle Kacheln ausgeblendet"
            description="Unter «Ansicht» oben rechts lässt sich wieder einblenden, was hier stehen soll."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {bands.map((band, index) =>
            band.kind === 'full' ? (
              <div key={index} className="space-y-6">
                {band.ids.map((id) => (
                  <div key={id} className="min-w-0">
                    {tiles[id]}
                  </div>
                ))}
              </div>
            ) : (
              /*
               * `grid-cols-1` statt gar keiner Angabe: Ohne sie richtet sich
               * die Spalte nach dem längsten Inhalt, den sie enthält – ein
               * Name, der nicht umbrechen darf, machte die Spalte breiter als
               * den Bildschirm. Die Kachel schob sich dann über den rechten
               * Rand hinaus, während links der gewohnte Abstand stehen blieb.
               * `minmax(0, 1fr)` lässt die Spalte enden, wo die Seite endet –
               * und die Namen darin abgeschnitten werden, wie vorgesehen.
               */
              <div
                key={index}
                className={cn(
                  'grid grid-cols-1 gap-4',
                  band.main.length > 0 && band.side.length > 0 && 'lg:grid-cols-3',
                )}
              >
                {band.main.length > 0 && (
                  <div className={cn('min-w-0 space-y-4', band.side.length > 0 && 'lg:col-span-2')}>
                    {band.main.map((id) => (
                      <div key={id} className="min-w-0">
                        {tiles[id]}
                      </div>
                    ))}
                  </div>
                )}
                {band.side.length > 0 && (
                  <div className="min-w-0 space-y-4">
                    {band.side.map((id) => (
                      <div key={id} className="min-w-0">
                        {tiles[id]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}

      <AgendaItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        meetingId={nextMeeting?.id ?? null}
        defaultStatus={nextMeeting?.status === 'running' ? 'pending' : 'new'}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Ansicht anpassen                                                    */
/* ------------------------------------------------------------------ */

/**
 * Das Ansichtsmenü der Übersicht.
 *
 * Oben die Kacheln, je eine Zeile: verschieben, an einen anderen Platz
 * hängen, ein- und ausblenden. Darunter die Zahlen, die sich einstellen
 * lassen – und zwar nur die, deren Kachel überhaupt sichtbar ist. Eine
 * Einstellung für etwas Ausgeblendetes ist eine Frage ohne Wirkung.
 */
function DashboardMenu({
  view,
  onChange,
}: {
  view: DashboardView
  onChange: (next: DashboardView) => void
}) {
  const patch = (changes: Partial<DashboardView>) => onChange({ ...view, ...changes })

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= view.tiles.length) return
    const tiles = [...view.tiles]
    const [tile] = tiles.splice(index, 1)
    tiles.splice(target, 0, tile)
    patch({ tiles })
  }

  const update = (index: number, changes: Partial<DashboardView['tiles'][number]>) =>
    patch({ tiles: view.tiles.map((tile, i) => (i === index ? { ...tile, ...changes } : tile)) })

  const shown = (id: DashboardTileId) => view.tiles.some((tile) => tile.id === id && tile.visible)

  return (
    <ViewMenu width="sm:w-[24rem]">
      <MenuToggle
        label="Begrüssung und Gemeinde"
        checked={view.greeting}
        onChange={(greeting) => patch({ greeting })}
        hint="Abgewählt beginnt die Seite gleich mit der ersten Kachel."
      />

      <MenuDivider />

      <MenuSection
        label="Kacheln"
        hint="Haken blendet ein, die Pfeile ordnen, «Haupt / Seite / Breit» bestimmt den Platz."
      >
        <ul>
          {view.tiles.map((tile, index) => (
            <li key={tile.id} className="flex items-center gap-1">
              <span className="-my-1 flex shrink-0 flex-col">
                <button
                  type="button"
                  className="btn-ghost px-2 py-1.5"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`${DASHBOARD_TILE_LABELS[tile.id]} nach oben`}
                >
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1.5"
                  onClick={() => move(index, 1)}
                  disabled={index === view.tiles.length - 1}
                  aria-label={`${DASHBOARD_TILE_LABELS[tile.id]} nach unten`}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </span>

              {/* Haken und Name gehören zusammen: Der Griff auf den Namen
                  blendet die Kachel ebenso ein wie der auf das Kästchen. Am
                  Telefon trifft man das Kästchen allein kaum. */}
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg py-2.5 pl-1 transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={tile.visible}
                  onChange={(event) => update(index, { visible: event.target.checked })}
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    !tile.visible && 'text-slate-400 dark:text-slate-500',
                  )}
                >
                  {DASHBOARD_TILE_LABELS[tile.id]}
                </span>
              </label>

              <select
                className="input w-auto shrink-0 px-2 py-1.5 text-xs"
                value={tile.area}
                onChange={(event) => update(index, { area: event.target.value as DashboardArea })}
                aria-label={`${DASHBOARD_TILE_LABELS[tile.id]}: Platz`}
                disabled={!tile.visible}
              >
                {(Object.keys(DASHBOARD_AREA_LABELS) as DashboardArea[]).map((area) => (
                  <option key={area} value={area}>
                    {DASHBOARD_AREA_LABELS[area]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </MenuSection>

      <MenuSection label="Wie viel je Kachel">
        <div className="space-y-1.5">
          {shown('meeting') && (
            <MenuCounter
              label="Traktanden der nächsten Sitzung"
              value={view.meetingItems}
              onChange={(meetingItems) => patch({ meetingItems })}
              min={1}
              max={20}
            />
          )}
          {shown('pendenzen') && (
            <MenuCounter
              label="Eigene Pendenzen"
              value={view.myItems}
              onChange={(myItems) => patch({ myItems })}
              min={1}
              max={20}
            />
          )}
          {shown('talks') && (
            <MenuCounter
              label="Sonntage bei den Ansprachen"
              value={view.talkSundays}
              onChange={(talkSundays) => patch({ talkSundays })}
              min={1}
              max={6}
            />
          )}
          {shown('ap') && (
            <MenuCounter
              label="AP-Termine"
              value={view.apActivities}
              onChange={(apActivities) => patch({ apActivities })}
              min={1}
              max={4}
            />
          )}
        </div>
      </MenuSection>
    </ViewMenu>
  )
}

function StatRow({
  pendenzen,
  mine,
  openTalks,
}: {
  pendenzen: number
  mine: number
  openTalks: number
}) {
  /*
   * Jede Zahl führt auf die Liste, die sie gezählt hat.
   *
   * Der Ausschnitt steht dafür in der Adresse: Ohne ihn landete «Meine» auf
   * der Liste, die zuletzt offen war – und wer eben auf die 3 unter «Meine»
   * gedrückt hat, sucht nicht die 27 unter «Pendent».
   */
  const stats = [
    { label: 'Pendenzen', value: pendenzen, to: '/pendenzen?ansicht=pendent', danger: false },
    { label: 'Meine', value: mine, to: '/pendenzen?ansicht=meine' },
    { label: 'Ansprachen offen', value: openTalks, to: '/abendmahl/ansprachen' },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <Link key={stat.label} to={stat.to} className="card card-hover p-3 text-center">
          <p
            className={`tabular text-2xl font-semibold ${
              stat.danger ? 'text-rose-600 dark:text-rose-400' : ''
            }`}
          >
            {stat.value}
          </p>
          {/* «Ansprachen offen» braucht am Telefon zwei Zeilen – eng gesetzt
              bleiben die drei Kacheln trotzdem gleich hoch. */}
          <p className="mt-0.5 text-xs leading-tight text-slate-500 dark:text-slate-400">
            {stat.label}
          </p>
        </Link>
      ))}
    </div>
  )
}
