import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CalendarDays, Plus, MapPin, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useMeetings, useOpenItems } from '@/hooks/useFirestore'
import { useNow } from '@/hooks/useNow'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { MeetingStatusBadge } from '@/components/ui/Badge'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { AssigneePicker, PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import {
  formatDateLong,
  formatTime,
  toDate,
  toDateInput,
  toTimeInput,
  fromDateTimeInput,
  WEEKDAYS,
} from '@/lib/dates'
import { createMeeting, suggestNextMeetingDate } from '@/services/meetings'
import type { Meeting } from '@/lib/types'

type Filter = 'upcoming' | 'past' | 'all'

export function Meetings() {
  const { profile } = useAuth()
  const { settings } = useData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Reichlich bemessen: Mit den übernommenen Protokollen stehen hier über
  // hundert vergangene Sitzungen, und das Archiv soll vollständig bleiben.
  const { data: meetings, loading } = useMeetings(400)
  const { data: openItems } = useOpenItems()
  const now = useNow()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [formOpen, setFormOpen] = useState(false)

  /* Über den PWA-Schnellzugriff direkt in die nächste Sitzung springen. */
  useEffect(() => {
    if (searchParams.get('shortcut') !== 'next' || loading) return
    const next = meetings
      .filter((m) => m.status !== 'closed')
      .sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0))[0]
    setSearchParams({}, { replace: true })
    if (next) navigate(`/sitzungen/${next.id}`, { replace: true })
  }, [searchParams, meetings, loading, navigate, setSearchParams])

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    openItems.forEach((item) => {
      if (item.meetingId) counts.set(item.meetingId, (counts.get(item.meetingId) ?? 0) + 1)
    })
    return counts
  }, [openItems])

  const { upcoming, past } = useMemo(() => {
    const sorted = [...meetings].sort(
      (a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0),
    )
    return {
      // Laufende Sitzungen bleiben oben, auch wenn ihr Termin bereits vorbei ist.
      upcoming: sorted
        .filter((m) => m.status === 'running' || (toDate(m.date)?.getTime() ?? 0) >= now - 86400000)
        .reverse(),
      past: sorted.filter(
        (m) => m.status !== 'running' && (toDate(m.date)?.getTime() ?? 0) < now - 86400000,
      ),
    }
  }, [meetings, now])

  const visible =
    filter === 'upcoming' ? upcoming : filter === 'past' ? past : [...upcoming, ...past]
  const unassignedCount = openItems.filter((item) => !item.meetingId).length

  return (
    <>
      <PageHeader
        title="Sitzungen"
        subtitle={`Regulär ${WEEKDAYS[settings.meetingWeekday]}s um ${settings.meetingTime} Uhr`}
        actions={
          <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Sitzung planen
          </button>
        }
      />

      {unassignedCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          {unassignedCount} Pendenz{unassignedCount === 1 ? '' : 'en'} warte
          {unassignedCount === 1 ? 't' : 'n'} auf eine Sitzung. Öffne die nächste Sitzung, um sie zu
          übernehmen.
        </div>
      )}

      <SegmentedControl<Filter>
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'upcoming', label: 'Anstehend', count: upcoming.length },
          { value: 'past', label: 'Vergangen', count: past.length },
          { value: 'all', label: 'Alle' },
        ]}
      />

      {loading ? (
        <SkeletonList rows={3} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title={filter === 'past' ? 'Noch keine vergangenen Sitzungen' : 'Keine Sitzung geplant'}
            description={
              filter === 'past'
                ? 'Abgeschlossene Sitzungen erscheinen hier als Protokoll.'
                : 'Lege den nächsten Termin fest.'
            }
            action={
              filter !== 'past' && (
                <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  Sitzung planen
                </button>
              )
            }
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              openCount={itemCounts.get(meeting.id) ?? 0}
            />
          ))}
        </ul>
      )}

      <MeetingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        defaultDate={suggestNextMeetingDate(settings)}
        defaultTitle={settings.meetingTitle}
        defaultLocation={settings.meetingLocation}
        defaultAttendees={profile ? [profile.id] : []}
      />
    </>
  )
}

function MeetingRow({ meeting, openCount }: { meeting: Meeting; openCount: number }) {
  const date = toDate(meeting.date)
  const isToday = date?.toDateString() === new Date().toDateString()

  return (
    <li>
      <Link to={`/sitzungen/${meeting.id}`} className="card card-hover flex items-center gap-4 p-4">
        <div
          className={`grid size-12 shrink-0 place-items-center rounded-xl ${
            isToday || meeting.status === 'running'
              ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          <span className="text-[10px] leading-none uppercase">
            {date?.toLocaleDateString('de-CH', { month: 'short' })}
          </span>
          <span className="tabular text-lg leading-tight font-semibold">{date?.getDate()}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium">{meeting.title}</h3>
            <MeetingStatusBadge status={meeting.status} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {formatDateLong(meeting.date)}, {formatTime(meeting.date)}
            </span>
            {meeting.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {meeting.location}
              </span>
            )}
          </p>
        </div>

        {openCount > 0 && (
          <span className="badge shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {openCount} offen
          </span>
        )}
      </Link>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Sitzung anlegen                                                     */
/* ------------------------------------------------------------------ */

export function MeetingForm({
  open,
  onClose,
  defaultDate,
  defaultTitle,
  defaultLocation,
  defaultAttendees,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  defaultDate: Date
  defaultTitle: string
  defaultLocation: string
  defaultAttendees: string[]
  onCreated?: (id: string) => void
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(toDateInput(defaultDate))
    setTime(toTimeInput(defaultDate))
    setTitle(defaultTitle)
    setLocation(defaultLocation)
    setAttendees(defaultAttendees)
  }, [open, defaultDate, defaultTitle, defaultLocation, defaultAttendees])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile) return

    const when = fromDateTimeInput(date, time)
    if (!when) {
      toast.error('Bitte gib ein gültiges Datum an.')
      return
    }

    setSaving(true)
    try {
      const { id, outcome } = await createMeeting(
        { date: when, title: title.trim() || 'Bischofschaftssitzung', location, attendees },
        profile.id,
      )
      toast.saved('Sitzung geplant.', outcome)
      onClose()
      if (onCreated) onCreated(id)
      else navigate(`/sitzungen/${id}`)
    } catch (error) {
      console.error(error)
      toast.error('Sitzung konnte nicht angelegt werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sitzung planen"
      description="Offene Pendenzen kannst du danach mit einem Klick übernehmen."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" form="meeting-form" className="btn-primary" disabled={saving}>
            {saving ? 'Wird angelegt …' : 'Sitzung anlegen'}
          </button>
        </>
      }
    >
      <form id="meeting-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="meeting-date">
              Datum
            </label>
            <input
              id="meeting-date"
              type="date"
              className="input"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="meeting-time">
              Uhrzeit
            </label>
            <input
              id="meeting-time"
              type="time"
              className="input"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="meeting-title">
            Titel
          </label>
          <input
            id="meeting-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Bischofschaftssitzung"
          />
        </div>

        <div>
          <label className="label" htmlFor="meeting-location">
            Ort
          </label>
          <input
            id="meeting-location"
            className="input"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Bischofsbüro"
          />
        </div>

        <AssigneePicker value={attendees} onChange={setAttendees} label="Anwesend" />
      </form>
    </Modal>
  )
}
