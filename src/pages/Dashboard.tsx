import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Plus,
  ArrowRight,
  AlertTriangle,
  Mic,
  ListTodo,
  Play,
  Cake,
  CheckCircle2,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useMeetings, useOpenItems, useSacramentMeetings, useTalks } from '@/hooks/useFirestore'
import { AgendaItemCard } from '@/components/agenda/AgendaItemCard'
import { AgendaItemForm } from '@/components/agenda/AgendaItemForm'
import { FOCUS_PARAM } from '@/components/agenda/MeetingFocus'
import { MeetingStatusBadge } from '@/components/ui/Badge'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/Pickers'
import {
  formatDateLong,
  formatDateShort,
  formatDayShort,
  formatTime,
  getDueInfo,
  hasBirthdaySoon,
  toDate,
  differenceInCalendarDays,
  startOfDay,
  upcomingWeekdays,
} from '@/lib/dates'
import { sortForMeeting, sortForPendenzen } from '@/services/agenda'
import { openTalkSlots, sacramentDocId, sundayProgram, talksForDate } from '@/services/sacrament'
import type { AgendaItem } from '@/lib/types'

export function Dashboard() {
  const { profile } = useAuth()
  const { settings, members, users } = useData()
  const navigate = useNavigate()
  const { data: meetings, loading: meetingsLoading } = useMeetings(20)
  const { data: openItems, loading: itemsLoading } = useOpenItems()
  const { data: talks } = useTalks(100)
  const { data: sacramentMeetings } = useSacramentMeetings(20)
  const [formOpen, setFormOpen] = useState(false)

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

  /* Pendenzen ------------------------------------------------------- */
  const myItems = useMemo(
    () => sortForPendenzen(openItems.filter((item) => item.assignees?.includes(profile?.id ?? ''))),
    [openItems, profile?.id],
  )

  const overdueItems = useMemo(
    () => sortForPendenzen(openItems.filter((item) => getDueInfo(item.dueDate)?.overdue)),
    [openItems],
  )

  // Dieselbe Reihenfolge wie in der Sitzung: zuerst die neuen Traktanden,
  // danach die Pendenzen aus früheren Sitzungen.
  const meetingItems = useMemo(
    () => sortForMeeting(openItems.filter((item) => item.meetingId === nextMeeting?.id)),
    [openItems, nextMeeting?.id],
  )

  const unassignedCount = openItems.filter((item) => !item.meetingId).length

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
      }
    })
  }, [talks, sacramentMeetings, settings.sacramentWeekday, settings.talksPerSunday])

  const openTalkCount = talkGaps.reduce((sum, gap) => sum + gap.open, 0)

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

  return (
    <>
      <PageHeader
        title={`${greeting}, ${profile?.displayName.split(' ')[0] ?? ''}`}
        subtitle={settings.wardName}
        actions={
          <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Traktandum</span>
          </button>
        }
      />

      {pendingUsers.length > 0 && (
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

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------- Nächste Sitzung ---------- */}
        <section className="lg:col-span-2">
          {meetingsLoading ? (
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
                    {meetingItems.slice(0, 4).map((item) => (
                      <AgendaItemCard key={item.id} item={item} compact onOpen={handleOpenItem} />
                    ))}
                    {meetingItems.length > 4 && (
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
          )}
        </section>

        {/* ---------- Rechte Spalte ---------- */}
        <div className="space-y-4">
          <StatRow overdue={overdueItems.length} mine={myItems.length} openTalks={openTalkCount} />

          {/* Ansprachen */}
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
              {talkGaps.slice(0, 4).map((gap) => (
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
                  ) : gap.open === 0 ? (
                    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      <CheckCircle2 className="size-3" aria-hidden />
                      Vollständig
                    </span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {gap.open} offen
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Geburtstage */}
          {birthdays.length > 0 && (
            <section className="card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Cake className="size-4 text-slate-400" aria-hidden />
                Geburtstage
              </h3>
              <ul className="space-y-2 text-sm">
                {birthdays.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2">
                    <Link
                      to={`/mitglieder/${member.id}`}
                      className="min-w-0 truncate hover:underline"
                    >
                      {member.firstName} {member.lastName}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {/* «Do., 06.08.» – ohne Jahr, aber vollständig. Früher stand
                          hier ein abgeschnittenes Datum mit einer Null am Ende. */}
                      {formatDayShort(
                        (() => {
                          const date = toDate(member.birthDate)!
                          const today = startOfDay(new Date())
                          const next = new Date(
                            today.getFullYear(),
                            date.getMonth(),
                            date.getDate(),
                          )
                          if (next < today) next.setFullYear(today.getFullYear() + 1)
                          return next
                        })(),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* ---------- Pendenzen ---------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ListTodo className="size-4 text-slate-400" aria-hidden />
              Meine Pendenzen
            </h2>
            <Link
              to="/pendenzen"
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
              {myItems.slice(0, 5).map((item) => (
                <AgendaItemCard key={item.id} item={item} compact onOpen={handleOpenItem} />
              ))}
            </div>
          )}
        </section>

        {overdueItems.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-4" aria-hidden />
              Überfällig ({overdueItems.length})
            </h2>
            <div className="space-y-2">
              {overdueItems.slice(0, 5).map((item) => (
                <AgendaItemCard key={item.id} item={item} compact onOpen={handleOpenItem} />
              ))}
            </div>
          </section>
        )}
      </div>

      <AgendaItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        meetingId={nextMeeting?.id ?? null}
        defaultStatus={nextMeeting?.status === 'running' ? 'pending' : 'new'}
      />
    </>
  )
}

function StatRow({
  overdue,
  mine,
  openTalks,
}: {
  overdue: number
  mine: number
  openTalks: number
}) {
  const stats = [
    { label: 'Überfällig', value: overdue, to: '/pendenzen', danger: overdue > 0 },
    { label: 'Meine', value: mine, to: '/pendenzen' },
    { label: 'Reden offen', value: openTalks, to: '/abendmahl/ansprachen' },
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
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
        </Link>
      ))}
    </div>
  )
}
