import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CalendarDays, Plus, MapPin, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useAllItems, useMeetings, useOpenItems } from '@/hooks/useFirestore'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useNow } from '@/hooks/useNow'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { MeetingStatusBadge } from '@/components/ui/Badge'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { AssigneePicker, PageHeader } from '@/components/ui/Pickers'
import { AddButton, MenuChoice, MenuToggle, ViewMenu } from '@/components/ui/ViewMenu'
import { AgendaItemPreview } from '@/components/agenda/AgendaItemPreview'
import { AgendaItemDialog } from '@/components/agenda/AgendaItemDialog'
import {
  formatDateLong,
  formatTime,
  toDate,
  toDateInput,
  toTimeInput,
  fromDateTimeInput,
} from '@/lib/dates'
import { cn } from '@/lib/utils'
import { groupByKind } from '@/services/agenda'
import { createMeeting, suggestNextMeetingDate } from '@/services/meetings'
import {
  DEFAULT_MEETINGS_VIEW,
  ITEM_KIND_PLURAL,
  MEETING_DETAIL_LABELS,
  MEETING_LIST_MODE_LABELS,
  MEETING_SCOPE_LABELS,
  normalizePendenzenSort,
  type AgendaItem,
  type Meeting,
  type MeetingDetailLevel,
  type MeetingListMode,
  type MeetingScope,
  type MeetingsView,
} from '@/lib/types'

/**
 * Die Sitzungen – als Terminliste oder mit ihrem Inhalt.
 *
 * Welcher Zeitraum gezeigt wird und wie viel von jeder Sitzung dasteht, sagt
 * der Knopf «Ansicht» oben rechts. Früher stand der Zeitraum als breite
 * Knopfleiste über der Liste; er hat sie nicht verdient: Fast immer bleibt es
 * bei «Anstehend», und eine Leiste, die man selten anfasst, nimmt der Liste
 * die oberste Zeile weg.
 *
 * «Kompakt» stellt unter jeden Termin, worum es geht – die Traktanden und, auf
 * Wunsch, die Pendenzen. Je Gruppe lässt sich sagen, ob die Titel genügen oder
 * der ganze Eintrag zu lesen sein soll. Damit wird die Liste zum Programm
 * mehrerer Sitzungen, ohne dass man eine nach der anderen öffnen muss.
 */
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
  const [formOpen, setFormOpen] = useState(false)
  /** Der Eintrag, der gerade im Fenster bearbeitet wird. */
  const [openItem, setOpenItem] = useState<AgendaItem | null>(null)

  /* Steht die Pendenzenliste von Hand, folgt ihr auch der Inhalt einer
     Sitzung – dieselbe Reihenfolge wie unter «Pendenzen». */
  const manualPendenzen = useMemo(
    () => normalizePendenzenSort(settings.pendenzenSort).field === 'manual',
    [settings.pendenzenSort],
  )

  const [view, setView] = useLocalStorage<MeetingsView>(
    'bss:sitzungen:ansicht',
    DEFAULT_MEETINGS_VIEW,
  )
  const filter = view.scope
  const compact = view.mode === 'compact'
  const patch = (changes: Partial<MeetingsView>) => setView({ ...view, ...changes })

  /* Die Traktanden aller Sitzungen – nur für die kompakte Ansicht gelesen.
     In der Terminliste wären es Hunderte Datensätze für nichts. */
  const { data: allItems } = useAllItems(800, compact)

  /*
   * Der Eintrag im Fenster wird aus dem Bestand nachgeschlagen, nicht
   * festgehalten: Was das Formular speichert, kommt über den Bestand zurück,
   * und ein eingefrorener Stand zeigte danach wieder das Alte.
   */
  const dialogItem = openItem ? (allItems.find((i) => i.id === openItem.id) ?? openItem) : null

  const itemsByMeeting = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const item of allItems) {
      if (!item.meetingId) continue
      const list = map.get(item.meetingId)
      if (list) list.push(item)
      else map.set(item.meetingId, [item])
    }
    return map
  }, [allItems])

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

  /* Ziel für «Verschieben» aus dem Fenster heraus – die nächste offene Sitzung. */
  const nextMeetingRef = useMemo(() => {
    const next = meetings
      .filter((m) => m.status !== 'closed')
      .map((m) => ({ id: m.id, date: toDate(m.date) }))
      .filter((entry): entry is { id: string; date: Date } => entry.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
    return next ?? null
  }, [meetings])

  const visible =
    filter === 'upcoming' ? upcoming : filter === 'past' ? past : [...upcoming, ...past]
  const unassignedCount = openItems.filter((item) => !item.meetingId).length

  /*
   * In der kompakten Ansicht wird nur ein Ausschnitt gezeichnet.
   *
   * Eine Terminzeile ist billig; das ganze Programm einer Sitzung ist es
   * nicht. «Alle» zählt mit den übernommenen Protokollen über hundert
   * Sitzungen – vollständig gezeichnet stünde der Browser still. Der Rest
   * kommt auf Knopfdruck nach.
   *
   * Zurückgesetzt wird beim Zeichnen und nicht in einem Effekt: Sonst stünde
   * für einen Durchgang der alte Ausschnitt an der neuen Liste.
   */
  const pageSize = compact ? 20 : visible.length
  const listKey = `${filter}|${view.mode}`
  const [shown, setShown] = useState(pageSize)
  const [shownFor, setShownFor] = useState(listKey)
  if (shownFor !== listKey) {
    setShownFor(listKey)
    setShown(pageSize)
  }
  const page = compact ? visible.slice(0, shown) : visible
  const rest = visible.length - page.length

  return (
    <>
      <PageHeader
        title="Sitzungen"
        actions={
          <>
            <MeetingsMenu
              view={view}
              onChange={patch}
              counts={{ upcoming: upcoming.length, past: past.length, all: meetings.length }}
            />
            <AddButton label="Sitzung planen" onClick={() => setFormOpen(true)} />
          </>
        }
      />

      {unassignedCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          {unassignedCount} Pendenz{unassignedCount === 1 ? '' : 'en'} warte
          {unassignedCount === 1 ? 't' : 'n'} auf eine Sitzung. Öffne die nächste Sitzung, um sie zu
          übernehmen.
        </div>
      )}

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
        <>
          <ul className="space-y-2">
            {page.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                openCount={itemCounts.get(meeting.id) ?? 0}
                items={compact ? (itemsByMeeting.get(meeting.id) ?? []) : undefined}
                manualPendenzen={manualPendenzen}
                view={view}
                onOpenItem={setOpenItem}
              />
            ))}
          </ul>

          {rest > 0 && (
            <button
              type="button"
              className="btn-secondary mt-3 w-full"
              onClick={() => setShown((current) => current + pageSize)}
            >
              Weitere anzeigen · noch {rest}
            </button>
          )}
        </>
      )}

      {/* Ein Griff auf ein Traktandum oder eine Pendenz öffnet es hier –
          ohne dass die Liste verlassen werden muss. */}
      <AgendaItemDialog
        item={dialogItem}
        onClose={() => setOpenItem(null)}
        nextMeeting={nextMeetingRef}
      />

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

function MeetingRow({
  meeting,
  openCount,
  items,
  manualPendenzen,
  view,
  onOpenItem,
}: {
  meeting: Meeting
  openCount: number
  /** Gesetzt heisst: kompakte Ansicht – der Inhalt der Sitzung steht darunter */
  items?: AgendaItem[]
  /** Steht die Pendenzenliste von Hand, folgt ihr auch die Sitzung */
  manualPendenzen: boolean
  view: MeetingsView
  onOpenItem: (item: AgendaItem) => void
}) {
  const date = toDate(meeting.date)
  const isToday = date?.toDateString() === new Date().toDateString()

  const groups = useMemo(
    () => (items ? groupByKind(items, manualPendenzen) : null),
    [items, manualPendenzen],
  )

  return (
    <li className={groups ? 'card overflow-hidden' : undefined}>
      <Link
        to={`/sitzungen/${meeting.id}`}
        className={
          groups
            ? 'flex items-center gap-4 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60'
            : 'card card-hover flex items-center gap-4 p-4'
        }
      >
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

      {groups && (
        <div className="space-y-4 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <ItemGroup
            title={ITEM_KIND_PLURAL.traktandum}
            items={groups.traktandum}
            detail={view.agendaDetail}
            empty="Noch nichts traktandiert."
            onOpen={onOpenItem}
          />
          {view.showPendenzen && (
            <ItemGroup
              title={ITEM_KIND_PLURAL.pendenz}
              items={groups.pendenz}
              detail={view.pendenzenDetail}
              empty="Keine Pendenzen."
              onOpen={onOpenItem}
            />
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Eine Gruppe unter einer Sitzung – Traktanden oder Pendenzen.
 *
 * «Nur Titel» ist eine nummerierte Liste, wie sie auf einer Einladung stünde.
 * «Komplett» stellt jeden Eintrag ganz hin, samt Beschreibung, Raster und
 * Zuständigen – dann ist die Sitzungsliste das Programm selbst.
 */
function ItemGroup({
  title,
  items,
  detail,
  empty,
  onOpen,
}: {
  title: string
  items: AgendaItem[]
  detail: MeetingDetailLevel
  empty: string
  /** Ein Griff auf den Eintrag öffnet ihn zum Bearbeiten */
  onOpen: (item: AgendaItem) => void
}) {
  return (
    <section>
      <h4 className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {title}
        <span className="tabular text-[11px] font-normal text-slate-400">{items.length}</span>
      </h4>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : detail === 'titles' ? (
        <ol className="space-y-1">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-baseline gap-2 text-sm">
              <span className="tabular shrink-0 text-xs text-slate-400">{index + 1}.</span>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className={cn(
                  'min-w-0 rounded text-left transition hover:underline',
                  item.status === 'done' && 'text-slate-500 line-through dark:text-slate-500',
                )}
              >
                {item.title || <span className="text-slate-400">Ohne Titel</span>}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="divide-list">
          {items.map((item, index) => (
            <li key={item.id} className="first:pt-0 last:pb-0">
              {/*
                Der ganze Eintrag ist die Fläche – nicht bloss sein Titel.
                Wer die Sitzungsliste als Programm liest und dabei etwas
                ändern will, soll hineingreifen können, wo er gerade liest.

                Bewusst kein `<button>`: Im Eintrag stehen Verweise – die mit
                «@» eingesetzten Namen führen zur Person –, und ein Verweis
                gehört nicht in einen Knopf. Sie fangen ihren Klick selbst ab
                und führen weiterhin zum Mitglied.
              */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(item)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onOpen(item)
                }}
                className="-mx-2 cursor-pointer rounded-lg px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <AgendaItemPreview item={item} position={index + 1} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Ansicht anpassen                                                    */
/* ------------------------------------------------------------------ */

/**
 * Zeitraum und Darstellung der Sitzungsliste – ein Menü, keine Leiste.
 *
 * Die Angaben zum Umfang stehen nur dort, wo sie etwas bewirken: In der
 * gewöhnlichen Terminliste ist die Frage «nur Titel oder komplett?» ohne
 * Bedeutung, und der Pendenzen-Schalter ebenso.
 */
function MeetingsMenu({
  view,
  onChange,
  counts,
}: {
  view: MeetingsView
  onChange: (patch: Partial<MeetingsView>) => void
  counts: Record<MeetingScope, number>
}) {
  return (
    <ViewMenu width="sm:w-80">
      <MenuChoice<MeetingScope>
        label="Zeitraum"
        value={view.scope}
        onChange={(scope) => onChange({ scope })}
        options={(Object.keys(MEETING_SCOPE_LABELS) as MeetingScope[]).map((value) => ({
          value,
          label: MEETING_SCOPE_LABELS[value],
          count: counts[value],
        }))}
      />

      <MenuChoice<MeetingListMode>
        label="Sitzungsansicht"
        value={view.mode}
        onChange={(mode) => onChange({ mode })}
        options={(Object.keys(MEETING_LIST_MODE_LABELS) as MeetingListMode[]).map((value) => ({
          value,
          label: MEETING_LIST_MODE_LABELS[value],
        }))}
        hint={
          view.mode === 'compact'
            ? undefined
            : 'Titel, Datum und Ort – der Inhalt steht in der Sitzung selbst.'
        }
      />

      {view.mode === 'compact' && (
        <>
          <MenuChoice<MeetingDetailLevel>
            label="Traktanden"
            value={view.agendaDetail}
            onChange={(agendaDetail) => onChange({ agendaDetail })}
            options={(Object.keys(MEETING_DETAIL_LABELS) as MeetingDetailLevel[]).map((value) => ({
              value,
              label: MEETING_DETAIL_LABELS[value],
            }))}
          />

          <MenuToggle
            label="Pendenzen anzeigen"
            checked={view.showPendenzen}
            onChange={(showPendenzen) => onChange({ showPendenzen })}
          />

          {view.showPendenzen && (
            <MenuChoice<MeetingDetailLevel>
              label="Pendenzen"
              value={view.pendenzenDetail}
              onChange={(pendenzenDetail) => onChange({ pendenzenDetail })}
              options={(Object.keys(MEETING_DETAIL_LABELS) as MeetingDetailLevel[]).map(
                (value) => ({ value, label: MEETING_DETAIL_LABELS[value] }),
              )}
            />
          )}
        </>
      )}
    </ViewMenu>
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
          />
        </div>

        <AssigneePicker value={attendees} onChange={setAttendees} label="Anwesend" />
      </form>
    </Modal>
  )
}
