import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  Inbox,
  LayoutList,
  MapPin,
  Play,
  Plus,
  Presentation,
  Printer,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useMeeting, useMeetingItems, useMeetings, useUnassignedItems } from '@/hooks/useFirestore'
import { AgendaItemCard } from '@/components/agenda/AgendaItemCard'
import { AgendaItemForm } from '@/components/agenda/AgendaItemForm'
import { MeetingFocus } from '@/components/agenda/MeetingFocus'
import { MeetingStatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { EmptyState, LoadingScreen } from '@/components/ui/Feedback'
import { AssigneePicker, SegmentedControl } from '@/components/ui/Pickers'
import { AssigneeAvatars } from '@/components/ui/Avatar'
import { MeetingForm } from '@/pages/Meetings'
import { formatDateLong, formatTime, toDate } from '@/lib/dates'
import { assignToMeeting, carryOverOpenItems, sortForMeeting } from '@/services/agenda'
import {
  closeMeeting,
  deleteMeeting,
  reopenMeeting,
  startMeeting,
  suggestNextMeetingDate,
  updateMeeting,
} from '@/services/meetings'
import type { AgendaItem } from '@/lib/types'

type ViewMode = 'focus' | 'list'

export function MeetingDetail() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const { profile } = useAuth()
  const { settings, userName } = useData()
  const toast = useToast()
  const navigate = useNavigate()

  const { meeting, loading } = useMeeting(meetingId)
  const { data: items } = useMeetingItems(meetingId)
  const { data: poolItems } = useUnassignedItems()
  const { data: meetings } = useMeetings(50)

  const [view, setView] = useState<ViewMode>('focus')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<AgendaItem | null>(null)
  const [poolOpen, setPoolOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)

  const sortedItems = useMemo(() => sortForMeeting(items), [items])
  const actor = profile ? { id: profile.id, name: profile.displayName } : null

  /** Die nächste geplante Sitzung nach dieser – Ziel beim Verschieben. */
  const nextMeetingRef = useMemo(() => {
    const currentDate = toDate(meeting?.date)?.getTime() ?? 0
    const next = meetings
      .filter((m) => m.id !== meetingId && m.status !== 'closed')
      .map((m) => ({ meeting: m, date: toDate(m.date) }))
      .filter(
        (entry): entry is { meeting: typeof entry.meeting; date: Date } => entry.date !== null,
      )
      .filter((entry) => entry.date.getTime() > currentDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
    return next ? { id: next.meeting.id, date: next.date } : null
  }, [meetings, meetingId, meeting?.date])

  if (loading) return <LoadingScreen label="Sitzung wird geladen …" />

  if (!meeting || !meetingId) {
    return (
      <div className="card">
        <EmptyState
          title="Sitzung nicht gefunden"
          description="Sie wurde möglicherweise gelöscht."
          action={
            <Link to="/sitzungen" className="btn-primary">
              Zur Übersicht
            </Link>
          }
        />
      </div>
    )
  }

  const isClosed = meeting.status === 'closed'
  const doneCount = items.filter((i) => i.status === 'done' || i.status === 'cancelled').length

  const handleCarryOver = async () => {
    if (!actor) return
    try {
      const count = await carryOverOpenItems(meetingId, actor)
      toast.success(
        count === 0
          ? 'Es warten keine Pendenzen.'
          : `${count} Pendenz${count === 1 ? '' : 'en'} übernommen.`,
      )
      setPoolOpen(false)
    } catch (error) {
      console.error(error)
      toast.error('Übernehmen fehlgeschlagen.')
    }
  }

  const handleClose = async () => {
    try {
      const carried = await closeMeeting(meetingId)
      toast.success(
        carried > 0
          ? `Sitzung abgeschlossen. ${carried} offene Traktanden bleiben als Pendenzen.`
          : 'Sitzung abgeschlossen – alles erledigt.',
      )
      // Direkt zur Folgeplanung anbieten, solange die Sitzung präsent ist.
      if (!nextMeetingRef) setFollowUpOpen(true)
    } catch (error) {
      console.error(error)
      toast.error('Abschliessen fehlgeschlagen.')
    }
  }

  return (
    <>
      {/* ---------- Kopf ---------- */}
      <div className="no-print mb-4">
        <Link
          to="/sitzungen"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Sitzungen
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{meeting.title}</h1>
              <MeetingStatusBadge status={meeting.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-500 dark:text-slate-400">
              <span>
                {formatDateLong(meeting.date)}, {formatTime(meeting.date)}
              </span>
              {meeting.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {meeting.location}
                </span>
              )}
            </p>
            {meeting.attendees?.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Anwesend:</span>
                <AssigneeAvatars userIds={meeting.attendees} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {meeting.status === 'planned' && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void startMeeting(meetingId)}
              >
                <Play className="size-4" aria-hidden />
                Sitzung starten
              </button>
            )}
            {meeting.status === 'running' && (
              <button type="button" className="btn-success" onClick={() => setConfirmClose(true)}>
                <CheckCircle2 className="size-4" aria-hidden />
                Abschliessen
              </button>
            )}
            {isClosed && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void reopenMeeting(meetingId)}
              >
                Wieder öffnen
              </button>
            )}

            <MeetingMenu
              onDetails={() => setDetailsOpen(true)}
              onPrint={() => window.print()}
              onDelete={() => setConfirmDelete(true)}
            />
          </div>
        </div>
      </div>

      {/* ---------- Werkzeugleiste ---------- */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl<ViewMode>
          value={view}
          onChange={setView}
          options={[
            { value: 'focus', label: 'Sitzungsmodus' },
            { value: 'list', label: 'Liste', count: items.length },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          {poolItems.length > 0 && !isClosed && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setPoolOpen(true)}
            >
              <Inbox className="size-4" aria-hidden />
              {poolItems.length} Pendenz{poolItems.length === 1 ? '' : 'en'}
            </button>
          )}
          {!isClosed && (
            <button type="button" className="btn-primary btn-sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Traktandum
            </button>
          )}
        </div>
      </div>

      {/* ---------- Inhalt ---------- */}
      {view === 'focus' ? (
        <MeetingFocus
          items={sortedItems}
          onEdit={setEditItem}
          onAdd={() => setFormOpen(true)}
          nextMeeting={nextMeetingRef}
          readOnly={isClosed}
        />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={LayoutList}
            title="Noch keine Traktanden"
            description="Trage ein, was besprochen werden soll – oder übernimm offene Pendenzen."
            action={
              !isClosed && (
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                    <Plus className="size-4" aria-hidden />
                    Traktandum
                  </button>
                  {poolItems.length > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void handleCarryOver()}
                    >
                      {poolItems.length} Pendenzen übernehmen
                    </button>
                  )}
                </div>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item) => (
            <AgendaItemCard
              key={item.id}
              item={item}
              onEdit={setEditItem}
              nextMeeting={nextMeetingRef}
            />
          ))}
          <p className="pt-2 text-center text-xs text-slate-400">
            {doneCount} von {items.length} erledigt
          </p>
        </div>
      )}

      {/* ---------- Protokollnotizen ---------- */}
      {(meeting.notes || meeting.spiritualThought) && (
        <section className="card mt-6 p-4">
          {meeting.spiritualThought && (
            <div className="mb-3">
              <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Geistiger Gedanke
              </h3>
              <p className="mt-1 text-sm whitespace-pre-wrap">{meeting.spiritualThought}</p>
            </div>
          )}
          {meeting.notes && (
            <div>
              <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Sitzungsnotizen
              </h3>
              <p className="mt-1 text-sm whitespace-pre-wrap">{meeting.notes}</p>
            </div>
          )}
        </section>
      )}

      {/* ---------- Dialoge ---------- */}
      <AgendaItemForm open={formOpen} onClose={() => setFormOpen(false)} meetingId={meetingId} />

      <AgendaItemForm
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        item={editItem}
        meetingId={meetingId}
      />

      <PoolDialog
        open={poolOpen}
        onClose={() => setPoolOpen(false)}
        items={poolItems}
        meetingId={meetingId}
        onCarryAll={handleCarryOver}
      />

      <MeetingDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        meetingId={meetingId}
        meeting={meeting}
      />

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => void handleClose()}
        title="Sitzung abschliessen?"
        message={
          <>
            {items.length - doneCount > 0 ? (
              <>
                {items.length - doneCount} Traktand
                {items.length - doneCount === 1 ? 'um bleibt' : 'en bleiben'} offen und erscheint
                {items.length - doneCount === 1 ? '' : 'en'} automatisch als Pendenz in der nächsten
                Sitzung.
              </>
            ) : (
              <>Alle Traktanden sind erledigt.</>
            )}
          </>
        }
        confirmLabel="Abschliessen"
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteMeeting(meetingId).then(() => {
            toast.success('Sitzung gelöscht. Die Traktanden bleiben als Pendenzen erhalten.')
            navigate('/sitzungen')
          })
        }}
        title="Sitzung löschen?"
        message="Die Traktanden bleiben erhalten und wandern zurück in die Pendenzen."
        confirmLabel="Löschen"
        danger
      />

      <MeetingForm
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        defaultDate={suggestNextMeetingDate(settings, toDate(meeting.date) ?? new Date())}
        defaultTitle={settings.meetingTitle}
        defaultLocation={meeting.location || settings.meetingLocation}
        defaultAttendees={meeting.attendees ?? []}
      />

      {/* Nur für den Ausdruck: kompaktes Protokoll */}
      <PrintProtocol meeting={meeting} items={sortedItems} userName={userName} />
    </>
  )
}

/* ------------------------------------------------------------------ */

function MeetingMenu({
  onDetails,
  onPrint,
  onDelete,
}: {
  onDetails: () => void
  onPrint: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen((v) => !v)}
        aria-label="Weitere Aktionen"
        aria-expanded={open}
      >
        <Settings2 className="size-4" aria-hidden />
        <ChevronDown className="size-3" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="animate-scale-in absolute right-0 z-20 mt-1 w-52 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onDetails()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Presentation className="size-4" aria-hidden />
              Sitzungsdetails
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onPrint()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Printer className="size-4" aria-hidden />
              Protokoll drucken
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
            >
              <Trash2 className="size-4" aria-hidden />
              Sitzung löschen
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Sammelkorb: offene Pendenzen einzeln oder gesamthaft übernehmen. */
function PoolDialog({
  open,
  onClose,
  items,
  meetingId,
  onCarryAll,
}: {
  open: boolean
  onClose: () => void
  items: AgendaItem[]
  meetingId: string
  onCarryAll: () => Promise<void>
}) {
  const { profile } = useAuth()
  const toast = useToast()

  const add = async (item: AgendaItem) => {
    if (!profile) return
    try {
      const outcome = await assignToMeeting(item.id, meetingId, {
        id: profile.id,
        name: profile.displayName,
      })
      toast.saved('Zur Sitzung hinzugefügt.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Hinzufügen fehlgeschlagen.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Offene Pendenzen"
      description="Diese Traktanden sind keiner Sitzung zugeordnet."
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Schliessen
          </button>
          <button type="button" className="btn-primary" onClick={() => void onCarryAll()}>
            <Download className="size-4" aria-hidden />
            Alle übernehmen
          </button>
        </>
      }
    >
      {items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Keine offenen Pendenzen" />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <AgendaItemCard item={item} compact />
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm mt-1 shrink-0"
                onClick={() => void add(item)}
              >
                <Plus className="size-3.5" aria-hidden />
                Aufnehmen
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

/** Anwesenheit, Gebete, geistiger Gedanke und Protokollnotizen. */
function MeetingDetailsDialog({
  open,
  onClose,
  meetingId,
  meeting,
}: {
  open: boolean
  onClose: () => void
  meetingId: string
  meeting: {
    attendees?: string[]
    openingPrayer?: string
    closingPrayer?: string
    spiritualThought?: string
    notes?: string
  }
}) {
  const toast = useToast()
  const [attendees, setAttendees] = useState(meeting.attendees ?? [])
  const [openingPrayer, setOpeningPrayer] = useState(meeting.openingPrayer ?? '')
  const [closingPrayer, setClosingPrayer] = useState(meeting.closingPrayer ?? '')
  const [spiritualThought, setSpiritualThought] = useState(meeting.spiritualThought ?? '')
  const [notes, setNotes] = useState(meeting.notes ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const outcome = await updateMeeting(meetingId, {
        attendees,
        openingPrayer,
        closingPrayer,
        spiritualThought,
        notes,
      })
      toast.saved('Gespeichert.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sitzungsdetails"
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={saving}
          >
            Speichern
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <AssigneePicker value={attendees} onChange={setAttendees} label="Anwesend" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="opening-prayer">
              Anfangsgebet
            </label>
            <input
              id="opening-prayer"
              className="input"
              value={openingPrayer}
              onChange={(event) => setOpeningPrayer(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="closing-prayer">
              Schlussgebet
            </label>
            <input
              id="closing-prayer"
              className="input"
              value={closingPrayer}
              onChange={(event) => setClosingPrayer(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="spiritual-thought">
            Geistiger Gedanke
          </label>
          <textarea
            id="spiritual-thought"
            className="input min-h-20 resize-y"
            value={spiritualThought}
            onChange={(event) => setSpiritualThought(event.target.value)}
            placeholder="Schriftstelle, Gedanke, wer den Beitrag hält …"
          />
        </div>

        <div>
          <label className="label" htmlFor="meeting-notes">
            Allgemeine Sitzungsnotizen
          </label>
          <textarea
            id="meeting-notes"
            className="input min-h-24 resize-y"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}

/** Reine Druckansicht – am Bildschirm ausgeblendet. */
function PrintProtocol({
  meeting,
  items,
  userName,
}: {
  meeting: {
    title: string
    date: unknown
    location?: string
    attendees?: string[]
    openingPrayer?: string
    closingPrayer?: string
  }
  items: AgendaItem[]
  userName: (id: string) => string
}) {
  return (
    <div className="hidden print:block">
      <h1 className="text-xl font-bold">{meeting.title}</h1>
      <p className="text-sm">
        {formatDateLong(meeting.date as never)}, {formatTime(meeting.date as never)}
        {meeting.location && ` · ${meeting.location}`}
      </p>
      {meeting.attendees && meeting.attendees.length > 0 && (
        <p className="mt-1 text-sm">Anwesend: {meeting.attendees.map(userName).join(', ')}</p>
      )}
      {(meeting.openingPrayer || meeting.closingPrayer) && (
        <p className="text-sm">
          {meeting.openingPrayer && `Anfangsgebet: ${meeting.openingPrayer}`}
          {meeting.openingPrayer && meeting.closingPrayer && ' · '}
          {meeting.closingPrayer && `Schlussgebet: ${meeting.closingPrayer}`}
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={item.id}>
            <p className="font-semibold">
              {index + 1}. {item.title}
              {item.status === 'done' && ' ✓'}
            </p>
            {item.description && <p className="text-sm">{item.description}</p>}
            {item.assignees?.length > 0 && (
              <p className="text-sm">Zuständig: {item.assignees.map(userName).join(', ')}</p>
            )}
            {item.notes?.map((note) => (
              <p key={note.id} className="mt-1 text-sm">
                – {note.text} <em>({note.authorName})</em>
              </p>
            ))}
          </li>
        ))}
      </ol>
    </div>
  )
}
