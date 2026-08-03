import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarPlus,
  Check,
  Clock,
  Mic,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useSacramentMeetings, useTalks } from '@/hooks/useFirestore'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { SegmentedControl } from '@/components/ui/Pickers'
import { SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { TalkStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import {
  formatDate,
  formatDateLong,
  toDate,
  toDateInput,
  upcomingWeekdays,
  WEEKDAYS,
} from '@/lib/dates'
import { formatPhone, matchesSearch, telHref } from '@/lib/utils'
import {
  createTalk,
  deleteTalk,
  rankTalkCandidates,
  setTalkStatus,
  updateTalk,
} from '@/services/talks'
import {
  sacramentDocId,
  saveSacramentMeeting,
  talkSlotsFor,
  talksForDate,
} from '@/services/sacrament'
import {
  TALK_KIND_LABELS,
  TALK_STATUS_LABELS,
  type Member,
  type Talk,
  type TalkKind,
  type TalkStatus,
} from '@/lib/types'

type Tab = 'plan' | 'candidates' | 'history'

export function Talks() {
  const { settings, members } = useData()
  const { date: selectedDate } = useSacrament()
  const { data: talks, loading } = useTalks(400)
  const { data: sacramentMeetings } = useSacramentMeetings(40)
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('plan')
  const [assignFor, setAssignFor] = useState<{ date: Date; slot: number; kind: TalkKind } | null>(
    null,
  )
  const [editTalk, setEditTalk] = useState<Talk | null>(null)
  /** Aus der Vorschlagsliste vorgewähltes Mitglied für den Zuteilungs-Dialog */
  const [presetMember, setPresetMember] = useState<Member | null>(null)

  const meetingByKey = useMemo(
    () => new Map(sacramentMeetings.map((meeting) => [meeting.id, meeting])),
    [sacramentMeetings],
  )

  /*
   * Acht Versammlungen ab dem oben gewählten Sonntag.
   *
   * Der gewählte Sonntag steht damit immer zuoberst – wer ihn im Kopf der
   * Seite wechselt, sieht sofort dessen Programm, kann aber wie bisher
   * mehrere Wochen im Voraus planen.
   */
  const schedule = useMemo(() => {
    const sundays = upcomingWeekdays(settings.sacramentWeekday, 8, selectedDate)
    return sundays.map((date) => {
      const assigned = talksForDate(talks, date)
      const meeting = meetingByKey.get(sacramentDocId(date)) ?? null
      // Standard aus den Einstellungen, für diesen Sonntag übersteuerbar.
      const planned = talkSlotsFor(meeting, settings.talksPerSunday)
      const highest = assigned.reduce((max, talk) => Math.max(max, talk.slot), 0)

      const slots = Array.from({ length: Math.max(planned, highest) }, (_, index) => ({
        slot: index + 1,
        talk: assigned.find((talk) => talk.slot === index + 1) ?? null,
        /** Über die vorgesehene Anzahl hinaus – ein Zusatzpunkt */
        extra: index + 1 > planned,
      }))

      return {
        date,
        meeting,
        planned,
        slots,
        // Nur die regulären Plätze gelten als «offen»; Zusatzpunkte sind freiwillig.
        openCount: slots.filter((entry) => !entry.talk && !entry.extra).length,
      }
    })
  }, [talks, meetingByKey, selectedDate, settings.sacramentWeekday, settings.talksPerSunday])

  const openSlots = schedule.reduce((sum, sunday) => sum + sunday.openCount, 0)

  /** Zusätzlichen Programmplatz für einen einzelnen Sonntag vorsehen. */
  const changeSlots = async (date: Date, next: number) => {
    try {
      await saveSacramentMeeting(date, {
        talkSlots: next === settings.talksPerSunday ? null : next,
      })
    } catch (error) {
      console.error(error)
      toast.error('Anzahl konnte nicht gespeichert werden.')
    }
  }

  // Die beiden Filter gehören der Seite, nicht der Liste: Sie bestimmen,
  // wer überhaupt bewertet wird.
  const [onlyActive, setOnlyActive] = useState(true)
  const [hideChildren, setHideChildren] = useState(true)

  const candidates = useMemo(
    () =>
      rankTalkCandidates(members, talks, {
        gapMonths: settings.talkGapMonths,
        onlyActive,
        minAge: hideChildren ? settings.talkMinAge : 0,
      }),
    [members, talks, settings.talkGapMonths, settings.talkMinAge, onlyActive, hideChildren],
  )

  const history = useMemo(
    () =>
      talks
        .filter((talk) => talk.status === 'held')
        .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0)),
    [talks],
  )

  return (
    <>
      <SectionHeader
        title="Ansprachen und Zeugnisse"
        description={`${WEEKDAYS[settings.sacramentWeekday]}s · ${settings.talksPerSunday} Ansprachen pro Versammlung als Standard`}
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              setAssignFor({ date: schedule[0]?.date ?? new Date(), slot: 1, kind: 'talk' })
            }
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Zuteilen</span>
          </button>
        }
      />

      <SegmentedControl<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'plan', label: 'Programm', count: openSlots },
          { value: 'candidates', label: 'Vorschläge' },
          { value: 'history', label: 'Verlauf', count: history.length },
        ]}
      />

      {loading ? (
        <SkeletonList rows={4} />
      ) : tab === 'plan' ? (
        <div className="space-y-3">
          {schedule.map((sunday) => {
            // Erst eine bestehende Lücke füllen, sonst hinten anhängen –
            // sonst entstünde beim Nachtragen ein Loch im Programm.
            const nextSlot =
              sunday.slots.find((entry) => !entry.talk)?.slot ?? sunday.slots.length + 1
            return (
              <section key={sunday.date.toISOString()} className="card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{formatDateLong(sunday.date)}</h2>
                  <div className="flex items-center gap-2">
                    {sunday.planned !== settings.talksPerSunday && (
                      <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {sunday.planned} statt {settings.talksPerSunday}
                      </span>
                    )}
                    {sunday.openCount === 0 ? (
                      <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        <Check className="size-3" aria-hidden />
                        Vollständig
                      </span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        {sunday.openCount} offen
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2">
                  {sunday.slots.map(({ slot, talk, extra }) => (
                    <li key={slot}>
                      {talk ? (
                        <TalkRow talk={talk} onEdit={() => setEditTalk(talk)} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAssignFor({ date: sunday.date, slot, kind: 'talk' })}
                          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50"
                        >
                          <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                            {slot}
                          </span>
                          <CalendarPlus className="size-4" aria-hidden />
                          {extra ? 'Zusätzlichen Platz vergeben' : 'Ansprache vergeben'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Für einen einzelnen Sonntag lässt sich mehr vorsehen als der
                    Standard – etwa eine zusätzliche Ansprache oder ein Zeugnis. */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      setAssignFor({ date: sunday.date, slot: nextSlot, kind: 'talk' })
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Ansprache
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      setAssignFor({ date: sunday.date, slot: nextSlot, kind: 'testimony' })
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Zeugnis
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => void changeSlots(sunday.date, sunday.planned + 1)}
                  >
                    Leeren Platz hinzufügen
                  </button>
                  {sunday.planned !== settings.talksPerSunday && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => void changeSlots(sunday.date, settings.talksPerSunday)}
                    >
                      Auf Standard zurücksetzen
                    </button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ) : tab === 'candidates' ? (
        <CandidateList
          candidates={candidates}
          gapMonths={settings.talkGapMonths}
          minAge={settings.talkMinAge}
          onlyActive={onlyActive}
          onOnlyActive={setOnlyActive}
          hideChildren={hideChildren}
          onHideChildren={setHideChildren}
          onAssign={(member) => {
            // Den nächsten freien Programmplatz vorschlagen.
            const target = schedule.find((sunday) => sunday.openCount > 0)
            const slot = target?.slots.find((s) => !s.talk && !s.extra)?.slot ?? 1
            setPresetMember(member)
            setAssignFor({ date: target?.date ?? new Date(), slot, kind: 'talk' })
          }}
        />
      ) : (
        <HistoryList talks={history} />
      )}

      <AssignDialog
        open={Boolean(assignFor)}
        onClose={() => {
          setAssignFor(null)
          setPresetMember(null)
        }}
        date={assignFor?.date ?? new Date()}
        slot={assignFor?.slot ?? 1}
        kind={assignFor?.kind ?? 'talk'}
        presetMember={presetMember}
      />

      <EditTalkDialog talk={editTalk} onClose={() => setEditTalk(null)} />
    </>
  )
}

/* ------------------------------------------------------------------ */

function TalkRow({ talk, onEdit }: { talk: Talk; onEdit: () => void }) {
  const { membersById } = useData()
  const member = membersById.get(talk.memberId)
  const kind: TalkKind = talk.kind ?? 'talk'

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
    >
      <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
        {talk.slot}
      </span>
      <Avatar name={talk.memberName} id={talk.memberId} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {talk.memberName}
          {kind === 'testimony' && (
            <span className="ml-1.5 align-middle text-xs font-normal text-slate-500 dark:text-slate-400">
              · {TALK_KIND_LABELS.testimony}
            </span>
          )}
        </span>
        {talk.topic && (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {talk.topic}
          </span>
        )}
      </span>
      {member?.mobile && (
        <a
          href={telHref(member.mobile) ?? '#'}
          onClick={(event) => event.stopPropagation()}
          className="btn-ghost hidden p-1.5 sm:inline-flex"
          aria-label={`${talk.memberName} anrufen`}
          title={formatPhone(member.mobile)}
        >
          <Phone className="size-3.5" aria-hidden />
        </a>
      )}
      <TalkStatusBadge status={talk.status} />
    </button>
  )
}

/* ------------------------------------------------------------------ */

function CandidateList({
  candidates,
  gapMonths,
  minAge,
  onlyActive,
  onOnlyActive,
  hideChildren,
  onHideChildren,
  onAssign,
}: {
  candidates: ReturnType<typeof rankTalkCandidates>
  gapMonths: number
  minAge: number
  onlyActive: boolean
  onOnlyActive: (next: boolean) => void
  hideChildren: boolean
  onHideChildren: (next: boolean) => void
  onAssign: (member: Member) => void
}) {
  const [search, setSearch] = useState('')
  const [onlyOverdue, setOnlyOverdue] = useState(true)

  const visible = useMemo(() => {
    let result = candidates
    if (onlyOverdue) {
      result = result.filter((c) => c.monthsSince === null || c.monthsSince >= gapMonths)
    }
    if (search.trim()) {
      result = result.filter((c) =>
        matchesSearch(`${c.member.firstName} ${c.member.lastName}`, search),
      )
    }
    return result
  }, [candidates, onlyOverdue, gapMonths, search])

  if (candidates.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={Mic}
          title="Keine Kandidaten"
          description="Erfasse zuerst Mitglieder – dann erscheinen hier Vorschläge."
          action={
            <Link to="/mitglieder" className="btn-primary">
              Zu den Mitgliedern
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="input max-w-xs"
          placeholder="Name suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded"
            checked={onlyOverdue}
            onChange={(event) => setOnlyOverdue(event.target.checked)}
          />
          Nur seit über {gapMonths} Monaten
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded"
            checked={hideChildren}
            onChange={(event) => onHideChildren(event.target.checked)}
          />
          Erst ab {minAge} Jahren
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded"
            checked={onlyActive}
            onChange={(event) => onOnlyActive(event.target.checked)}
          />
          Nur Aktive
        </label>
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Sparkles className="size-3.5" aria-hidden />
        Sortiert nach Dringlichkeit: wer noch nie gesprochen hat, steht zuoberst.
      </p>

      <ul className="card divide-list overflow-hidden">
        {visible.slice(0, 60).map(({ member, age, monthsSince: months, alreadyPlanned }) => (
          <li
            key={member.id}
            className={`flex items-center gap-3 px-4 py-3 ${alreadyPlanned ? 'opacity-50' : ''}`}
          >
            <Avatar name={`${member.firstName} ${member.lastName}`} id={member.id} size="md" />

            <div className="min-w-0 flex-1">
              <Link
                to={`/mitglieder/${member.id}`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {member.firstName} {member.lastName}
              </Link>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {months === null ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    Noch nie gesprochen
                  </span>
                ) : (
                  <>
                    Zuletzt vor {months} Monaten
                    {member.lastTalkDate && ` (${formatDate(member.lastTalkDate)})`}
                  </>
                )}
                {age !== null && ` · ${age} Jahre`}
                {member.status !== 'active' && ' · inaktiv'}
                {alreadyPlanned && ' · bereits eingeplant'}
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary btn-sm shrink-0"
              onClick={() => onAssign(member)}
              disabled={alreadyPlanned}
            >
              <Plus className="size-3.5" aria-hidden />
              Anfragen
            </button>
          </li>
        ))}
      </ul>

      {visible.length > 60 && (
        <p className="mt-2 text-center text-xs text-slate-400">
          {visible.length - 60} weitere ausgeblendet – grenze die Suche ein.
        </p>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

function HistoryList({ talks }: { talks: Talk[] }) {
  if (talks.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={Clock} title="Noch keine gehaltenen Ansprachen erfasst" />
      </div>
    )
  }

  return (
    <ul className="card divide-list overflow-hidden">
      {talks.map((talk) => (
        <li key={talk.id} className="flex items-center gap-3 px-4 py-3">
          <Avatar name={talk.memberName} id={talk.memberId} size="sm" />
          <div className="min-w-0 flex-1">
            <Link
              to={`/mitglieder/${talk.memberId}`}
              className="block truncate text-sm font-medium hover:underline"
            >
              {talk.memberName}
            </Link>
            {talk.topic && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{talk.topic}</p>
            )}
          </div>
          <span className="tabular shrink-0 text-xs text-slate-500 dark:text-slate-400">
            {formatDate(talk.date)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Zuteilen                                                            */
/* ------------------------------------------------------------------ */

function AssignDialog({
  open,
  onClose,
  date,
  slot,
  kind: initialKind,
  presetMember: preset,
}: {
  open: boolean
  onClose: () => void
  date: Date
  slot: number
  kind: TalkKind
  presetMember: Member | null
}) {
  const { members, settings } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const { data: talks } = useTalks(200)

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  const [dateValue, setDateValue] = useState('')
  const [slotValue, setSlotValue] = useState(1)
  const [kind, setKind] = useState<TalkKind>('talk')
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState<number | ''>(10)
  const [status, setStatus] = useState<TalkStatus>('asked')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDateValue(toDateInput(date))
    setSlotValue(slot)
    setKind(initialKind)
    setSelected(preset)
    setSearch('')
    setTopic('')
    // Zeugnisse sind deutlich kürzer als eine Ansprache.
    setDuration(initialKind === 'testimony' ? 5 : 10)
    setStatus('asked')
  }, [open, date, slot, initialKind, preset])

  const ranked = useMemo(
    () =>
      rankTalkCandidates(members, talks, {
        gapMonths: settings.talkGapMonths,
        minAge: settings.talkMinAge,
      }),
    [members, talks, settings.talkGapMonths, settings.talkMinAge],
  )

  const results = useMemo(() => {
    if (!search.trim()) return ranked.slice(0, 8)
    return ranked
      .filter((c) => matchesSearch(`${c.member.firstName} ${c.member.lastName}`, search))
      .slice(0, 8)
  }, [ranked, search])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) {
      toast.error('Bitte wähle ein Mitglied aus.')
      return
    }

    setSaving(true)
    try {
      const { outcome } = await createTalk({
        memberId: selected.id,
        memberName: `${selected.firstName} ${selected.lastName}`,
        date: new Date(`${dateValue}T${settings.sacramentTime}:00`),
        slot: slotValue,
        kind,
        topic: topic.trim(),
        durationMinutes: typeof duration === 'number' ? duration : undefined,
        status,
        askedById: profile?.id ?? null,
      })
      toast.saved(`${TALK_KIND_LABELS[kind]} eingetragen.`, outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Eintragen fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${TALK_KIND_LABELS[kind]} vergeben`}
      description={formatDateLong(date)}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="submit"
            form="talk-form"
            className="btn-primary"
            disabled={saving || !selected}
          >
            {saving ? 'Wird gespeichert …' : 'Eintragen'}
          </button>
        </>
      }
    >
      <form id="talk-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <span className="label">Wer spricht?</span>
          {selected ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <Avatar
                name={`${selected.firstName} ${selected.lastName}`}
                id={selected.id}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selected.lastTalkDate
                    ? `Zuletzt ${formatDate(selected.lastTalkDate)}`
                    : 'Noch keine Ansprache'}
                  {selected.mobile && ` · ${formatPhone(selected.mobile)}`}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost p-1.5"
                onClick={() => setSelected(null)}
                aria-label="Auswahl aufheben"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                className="input"
                placeholder="Name eingeben oder aus den Vorschlägen wählen"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {results.map(({ member, monthsSince: months, alreadyPlanned }) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(member)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Avatar
                        name={`${member.firstName} ${member.lastName}`}
                        id={member.id}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {alreadyPlanned ? (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <TriangleAlert className="size-3" aria-hidden />
                            eingeplant
                          </span>
                        ) : months === null ? (
                          'nie'
                        ) : (
                          `${months} Mt.`
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <span className="label">Art des Programmpunkts</span>
          <div className="flex flex-wrap gap-2">
            {(['talk', 'testimony'] as TalkKind[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={kind === value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              >
                {TALK_KIND_LABELS[value]}
              </button>
            ))}
          </div>
          <p className="hint">
            Ein Zeugnis belegt wie eine Ansprache einen Platz im Programm, dauert aber kürzer.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="talk-date">
              Datum
            </label>
            <input
              id="talk-date"
              type="date"
              className="input"
              value={dateValue}
              onChange={(event) => setDateValue(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="talk-slot">
              Position
            </label>
            <input
              id="talk-slot"
              type="number"
              min={1}
              max={10}
              className="input"
              value={slotValue}
              onChange={(event) => setSlotValue(Number.parseInt(event.target.value, 10) || 1)}
            />
          </div>
          <div>
            <label className="label" htmlFor="talk-duration">
              Minuten
            </label>
            <input
              id="talk-duration"
              type="number"
              min={1}
              max={45}
              className="input"
              value={duration}
              onChange={(event) =>
                setDuration(event.target.value ? Number.parseInt(event.target.value, 10) : '')
              }
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="talk-topic">
            Thema
          </label>
          <input
            id="talk-topic"
            className="input"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="z. B. Glaube an Jesus Christus"
          />
        </div>

        <div>
          <label className="label" htmlFor="talk-status">
            Status
          </label>
          <select
            id="talk-status"
            className="input"
            value={status}
            onChange={(event) => setStatus(event.target.value as TalkStatus)}
          >
            {(['planned', 'asked', 'confirmed'] as TalkStatus[]).map((value) => (
              <option key={value} value={value}>
                {TALK_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Bearbeiten                                                          */
/* ------------------------------------------------------------------ */

function EditTalkDialog({ talk, onClose }: { talk: Talk | null; onClose: () => void }) {
  const toast = useToast()
  const [kind, setKind] = useState<TalkKind>('talk')
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!talk) return
    setKind(talk.kind ?? 'talk')
    setTopic(talk.topic ?? '')
    setNotes(talk.notes ?? '')
  }, [talk])

  if (!talk) return null

  const changeStatus = async (status: TalkStatus) => {
    try {
      await setTalkStatus(talk.id, status)
      if (status === 'held') {
        toast.success('Als gehalten vermerkt – die Mitgliederstatistik wurde nachgeführt.')
      }
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  const save = async () => {
    try {
      const outcome = await updateTalk(talk.id, {
        kind,
        topic: topic.trim(),
        notes: notes.trim(),
      })
      toast.saved('Gespeichert.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={talk.memberName}
        description={`${formatDate(talk.date)} · Position ${talk.slot} · ${TALK_KIND_LABELS[talk.kind ?? 'talk']}`}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost mr-auto text-rose-600 dark:text-rose-400"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Entfernen
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Schliessen
            </button>
            <button type="button" className="btn-primary" onClick={() => void save()}>
              Speichern
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <span className="label">Status</span>
            <div className="flex flex-wrap gap-2">
              {(
                ['planned', 'asked', 'confirmed', 'held', 'declined', 'cancelled'] as TalkStatus[]
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void changeStatus(value)}
                  className={talk.status === value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                >
                  {TALK_STATUS_LABELS[value]}
                </button>
              ))}
            </div>
            <p className="hint">
              «Gehalten» aktualisiert automatisch das Datum der letzten Ansprache beim Mitglied.
            </p>
          </div>

          <div>
            <span className="label">Art</span>
            <div className="flex flex-wrap gap-2">
              {(['talk', 'testimony'] as TalkKind[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  aria-pressed={kind === value}
                  className={kind === value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                >
                  {TALK_KIND_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="edit-topic">
              Thema
            </label>
            <input
              id="edit-topic"
              className="input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="edit-notes">
              Notiz
            </label>
            <textarea
              id="edit-notes"
              className="input min-h-20 resize-y"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Absprachen, Rückmeldungen …"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteTalk(talk.id).then((outcome) => {
            toast.saved('Eintrag entfernt.', outcome)
            onClose()
          })
        }}
        title="Ansprache entfernen?"
        message="Der Programmplatz wird wieder frei."
        confirmLabel="Entfernen"
        danger
      />
    </>
  )
}
