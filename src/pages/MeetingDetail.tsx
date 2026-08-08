import { useMemo, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Inbox,
  LayoutList,
  MapPin,
  Megaphone,
  Play,
  Plus,
  Printer,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useBack } from '@/hooks/useBack'
import {
  useMeeting,
  useMeetingItems,
  useMeetings,
  useOpenItems,
  useUnassignedItems,
} from '@/hooks/useFirestore'
import { AgendaItemCard } from '@/components/agenda/AgendaItemCard'
import { AgendaItemForm } from '@/components/agenda/AgendaItemForm'
import { AgendaItemRow } from '@/components/agenda/AgendaItemRow'
import { FOCUS_PARAM, MeetingFocus } from '@/components/agenda/MeetingFocus'
import {
  QuickAnnouncementDialog,
  QuickBusinessDialog,
} from '@/components/sacrament/QuickSundayEntry'
import { MeetingStatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { EmptyState, LoadingScreen } from '@/components/ui/Feedback'
import { PeopleChoice, PersonChoice, SegmentedControl } from '@/components/ui/Pickers'
import { MeetingForm } from '@/pages/Meetings'
import { callingChangesToText } from '@/lib/callingChanges'
import { formatDateLong, formatDateShort, formatTime, toDate } from '@/lib/dates'
import { plainText } from '@/lib/textFormat'
import {
  assignToMeeting,
  carryOverOpenItems,
  groupByKind,
  ITEM_KIND_ORDER,
  reorderItems,
  reorderWithinPendenzen,
  savePendenzenOrder,
  sortByPendenzOrder,
  sortForMeeting,
} from '@/services/agenda'
import {
  closeMeeting,
  deleteMeeting,
  reopenMeeting,
  startMeeting,
  suggestNextMeetingDate,
  updateMeeting,
} from '@/services/meetings'
import {
  ITEM_KIND_PLURAL,
  normalizePendenzenSort,
  toItemKind,
  type AgendaItem,
  type ItemKind,
  type Meeting,
} from '@/lib/types'

type ViewMode = 'focus' | 'list'

export function MeetingDetail() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const { profile } = useAuth()
  const { settings, userName, memberName } = useData()
  const toast = useToast()
  const navigate = useNavigate()

  const { meeting, loading } = useMeeting(meetingId)
  const { data: items } = useMeetingItems(meetingId)
  const { data: poolItems } = useUnassignedItems()
  const { data: openItems } = useOpenItems()
  const { data: meetings } = useMeetings(50)

  /* Datum einer Sitzung als Text – für die Angaben im aufgeklappten Eintrag. */
  const meetingDates = useMemo(() => {
    const map = new Map<string, string>()
    meetings.forEach((entry) => map.set(entry.id, formatDateShort(entry.date)))
    return map
  }, [meetings])

  // Die gewählte Ansicht überlebt den Ausflug auf eine Mitgliederseite –
  // sonst käme man aus dem «Zurück» in einer anderen Ansicht heraus, als man
  // sie verlassen hat.
  /*
   * Zurück führt einen Schritt im Verlauf und nicht stur auf die Liste.
   *
   * Wer aus einem Suchtreffer hierhergekommen ist, will zur Suche zurück –
   * mit dem Wort, das er getippt hat. Ein fester Verweis auf `/sitzungen`
   * warf es weg; `useBack()` bringt die vorige Adresse samt allem, was in
   * ihr steht (siehe `hooks/useBack`).
   */
  const back = useBack({ to: '/sitzungen', label: 'Sitzungen' })

  const [view, setView] = useLocalStorage<ViewMode>('bss:sitzung:ansicht', 'focus')
  const [searchParams, setSearchParams] = useSearchParams()
  const [formOpen, setFormOpen] = useState(false)
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [businessOpen, setBusinessOpen] = useState(false)
  const [poolOpen, setPoolOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)

  /*
   * Die Pendenzen dieser Sitzung sind ein Ausschnitt der Pendenzenliste.
   *
   * Wurde die dort von Hand gelegt, gilt sie auch hier: «der dritte Punkt»
   * ist nur dann eine Angabe, wenn er in beiden Ansichten der dritte ist.
   * Steht die Liste nach einem Datum, ordnet die Sitzung wie bisher nach
   * ihrer eigenen Position.
   */
  const manualPendenzen = useMemo(
    () => normalizePendenzenSort(settings.pendenzenSort).field === 'manual',
    [settings.pendenzenSort],
  )

  /**
   * Die ganze Pendenzenliste, in ihrer jetzigen Reihenfolge.
   *
   * Nur fürs Umsortieren: Was hier verschoben wird, verschiebt sich in der
   * gemeinsamen Liste – und alles, was nicht in dieser Sitzung steht, soll
   * dabei liegen bleiben, wo es liegt.
   */
  const allPendenzen = useMemo(
    () => sortByPendenzOrder(openItems.filter((item) => toItemKind(item) === 'pendenz')),
    [openItems],
  )

  const sortedItems = useMemo(
    () => sortForMeeting(items, manualPendenzen),
    [items, manualPendenzen],
  )
  const groups = useMemo(() => groupByKind(items, manualPendenzen), [items, manualPendenzen])
  const actor = profile ? { id: profile.id, name: profile.displayName } : null

  /** Der aufgeklappte Eintrag – dieselbe Angabe wie im Sitzungsmodus. */
  const openId = searchParams.get(FOCUS_PARAM)
  const toggleOpen = (id: string) =>
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        if (next.get(FOCUS_PARAM) === id) next.delete(FOCUS_PARAM)
        else next.set(FOCUS_PARAM, id)
        return next
      },
      { replace: true },
    )

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

  /*
   * Umsortiert wird innerhalb einer Gruppe; geschrieben wird die ganze
   * Sitzung. Die neuen Traktanden behalten dabei ihren Platz vor den
   * Pendenzen – das ist die Reihenfolge, in der eine Sitzung durchgeht.
   *
   * Folgen die Pendenzen der von Hand gelegten Liste, wird ein Zug an ihnen
   * auch dort festgehalten: Schriebe er bloss die Position in der Sitzung,
   * spränge die Gruppe gleich wieder zurück, denn gezeigt wird die Liste.
   * Die übrigen Pendenzen behalten dabei ihre Plätze (siehe
   * `reorderWithinPendenzen`).
   */
  const saveOrder = async (kind: ItemKind, ordered: AgendaItem[]) => {
    try {
      if (kind === 'pendenz' && manualPendenzen) {
        await savePendenzenOrder(reorderWithinPendenzen(allPendenzen, ordered))
        return
      }
      const all =
        kind === 'traktandum' ? [...ordered, ...groups.pendenz] : [...groups.traktandum, ...ordered]
      await reorderItems(all.map((item) => item.id))
    } catch (error) {
      console.error(error)
      toast.error('Reihenfolge konnte nicht gespeichert werden.')
    }
  }

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
  const doneCount = items.filter((item) => item.status === 'done').length
  const openCount = items.length - doneCount

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
          ? `Sitzung abgeschlossen. ${carried} Punkt${carried === 1 ? '' : 'e'} bleiben als Pendenzen.`
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
          to={back.to}
          onClick={(event) => {
            // Mittelklick und «in neuem Tab öffnen» sollen weiterhin die
            // Adresse benutzen – abgefangen wird nur der gewöhnliche Klick.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
            event.preventDefault()
            back.go()
          }}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {meeting.status === 'planned' && (
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  void startMeeting(meetingId).catch((error: unknown) => {
                    console.error(error)
                    toast.error('Sitzung konnte nicht gestartet werden.')
                  })
                }
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
                onClick={() =>
                  void reopenMeeting(meetingId).catch((error: unknown) => {
                    console.error(error)
                    toast.error('Sitzung konnte nicht geöffnet werden.')
                  })
                }
              >
                Wieder öffnen
              </button>
            )}

            <MeetingMenu onPrint={() => window.print()} onDelete={() => setConfirmDelete(true)} />
          </div>
        </div>
      </div>

      {/* ---------- Anwesenheit, Gebete, geistiger Gedanke ---------- */}
      <MeetingBasics meetingId={meetingId} meeting={meeting} readOnly={isClosed} />

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
            <>
              {/* Beides fällt in der Sitzung laufend an – «das sagen wir am
                  Sonntag an», «den bestätigen wir». Dafür die Sitzung zu
                  verlassen, den Sonntag zu suchen und zurückzufinden, sind
                  drei Handgriffe für einen Satz. */}
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setAnnouncementOpen(true)}
              >
                <Megaphone className="size-4" aria-hidden />
                Bekanntmachung
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setBusinessOpen(true)}
              >
                <ClipboardList className="size-4" aria-hidden />
                Angelegenheit
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                Traktandum
              </button>
            </>
          )}
        </div>
      </div>

      {/* ---------- Inhalt ---------- */}
      {view === 'focus' ? (
        <MeetingFocus
          items={sortedItems}
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
        <div className="space-y-5">
          {/* Erst das Neue, danach das Liegengebliebene – dieselbe Folge wie
              im Sitzungsmodus. */}
          <ItemGroup
            kind="traktandum"
            hint="Für diese Sitzung neu erfasst"
            items={groups.traktandum}
            openId={openId}
            onToggle={toggleOpen}
            onReorder={(ordered) => void saveOrder('traktandum', ordered)}
            readOnly={isClosed}
            nextMeeting={nextMeetingRef}
            meetingDate={(id) => meetingDates.get(id)}
          />
          <ItemGroup
            kind="pendenz"
            hint="Aus früheren Sitzungen übernommen"
            items={groups.pendenz}
            openId={openId}
            onToggle={toggleOpen}
            onReorder={(ordered) => void saveOrder('pendenz', ordered)}
            readOnly={isClosed}
            nextMeeting={nextMeetingRef}
            meetingDate={(id) => meetingDates.get(id)}
          />
          <p className="text-center text-xs text-slate-400">
            {doneCount} von {items.length} erledigt
          </p>
        </div>
      )}

      {/* ---------- Dialoge ---------- */}
      <AgendaItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        meetingId={meetingId}
        defaultStatus={meeting.status === 'planned' ? 'new' : 'pending'}
      />

      {/* Nur gezeichnet, solange offen – so beginnt jedes Erfassen mit
          leeren Feldern, ohne dass sie jemand zurücksetzen müsste. */}
      {announcementOpen && <QuickAnnouncementDialog onClose={() => setAnnouncementOpen(false)} />}
      {businessOpen && <QuickBusinessDialog onClose={() => setBusinessOpen(false)} />}

      <PoolDialog
        open={poolOpen}
        onClose={() => setPoolOpen(false)}
        items={poolItems}
        meetingId={meetingId}
        onCarryAll={handleCarryOver}
      />

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => void handleClose()}
        title="Sitzung abschliessen?"
        message={
          <>
            {openCount > 0 ? (
              <>
                {openCount} Punkt{openCount === 1 ? '' : 'e'} {openCount === 1 ? 'ist' : 'sind'}{' '}
                nicht erledigt. {openCount === 1 ? 'Er wird' : 'Sie werden'} zur Pendenz und
                erscheint{openCount === 1 ? '' : 'en'} in der nächsten Sitzung wieder.
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
          void deleteMeeting(meetingId)
            .then(() => {
              toast.success('Sitzung gelöscht. Die Traktanden bleiben als Pendenzen erhalten.')
              navigate('/sitzungen')
            })
            .catch((error: unknown) => {
              console.error(error)
              toast.error('Sitzung konnte nicht gelöscht werden.')
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
      <PrintProtocol
        meeting={meeting}
        groups={groups}
        userName={userName}
        memberName={memberName}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Eine der beiden Gruppen der Sitzungsliste.
 *
 * Umsortiert wird nur innerhalb der Gruppe: Eine Pendenz zwischen die neuen
 * Traktanden zu ziehen hiesse, sie zurückzudatieren – und genau die
 * Unterscheidung soll die Liste ja zeigen.
 */
function ItemGroup({
  kind,
  hint,
  items,
  openId,
  onToggle,
  onReorder,
  readOnly,
  nextMeeting,
  meetingDate,
}: {
  kind: ItemKind
  hint: string
  items: AgendaItem[]
  openId: string | null
  onToggle: (id: string) => void
  onReorder: (ordered: AgendaItem[]) => void
  readOnly: boolean
  nextMeeting: { id: string; date: Date } | null
  meetingDate: (meetingId: string) => string | undefined
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  if (items.length === 0) return null

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onReorder(next)
  }

  const drop = (targetId: string) => {
    setOverId(null)
    if (!dragId || dragId === targetId) return
    move(
      items.findIndex((item) => item.id === dragId),
      items.findIndex((item) => item.id === targetId),
    )
    setDragId(null)
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-sm font-semibold">{ITEM_KIND_PLURAL[kind]}</h2>
        <span className="tabular text-xs text-slate-400">{items.length}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">· {hint}</span>
      </div>

      <ul className="space-y-2">
        {items.map((item, index) => (
          <AgendaItemRow
            key={item.id}
            item={item}
            position={index + 1}
            expanded={openId === item.id}
            onToggle={() => onToggle(item.id)}
            onMove={readOnly ? undefined : (delta) => move(index, index + delta)}
            first={index === 0}
            last={index === items.length - 1}
            readOnly={readOnly}
            nextMeeting={nextMeeting}
            meetingDate={meetingDate}
            onDragStart={
              readOnly
                ? undefined
                : (event: DragEvent<HTMLElement>) => {
                    setDragId(item.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }
            }
            onDragOver={
              readOnly
                ? undefined
                : (event: DragEvent<HTMLElement>) => {
                    if (!dragId) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setOverId(item.id)
                  }
            }
            onDrop={
              readOnly
                ? undefined
                : (event: DragEvent<HTMLElement>) => {
                    event.preventDefault()
                    drop(item.id)
                  }
            }
            onDragEnd={() => {
              setDragId(null)
              setOverId(null)
            }}
            dragging={dragId === item.id}
            dropTarget={overId === item.id && dragId !== item.id}
          />
        ))}
      </ul>
    </section>
  )
}

function MeetingMenu({ onPrint, onDelete }: { onPrint: () => void; onDelete: () => void }) {
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
      description="Diese Einträge sind keiner Sitzung zugeordnet."
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

/**
 * Anwesenheit, Gebete und geistiger Gedanke – gleich oben, nicht im Fenster.
 *
 * Diese vier Angaben werden am Anfang jeder Sitzung festgehalten, in einer
 * halben Minute und meist von der Person, die ohnehin schon schreibt. Ein
 * Fenster, das sich dafür öffnet, ist ein Umweg. Deshalb stehen sie hier als
 * Knopfleiste: ein Griff je Person, gespeichert wird sofort.
 *
 * Zur Wahl stehen der Bischof, beide Ratgeber und die Sekretäre. Beim Gebet
 * und beim geistigen Gedanken wird der ausgeschriebene Name gespeichert, bei
 * der Anwesenheit die UID – dieselbe Person bekommt schliesslich auch
 * Traktanden zugewiesen.
 */
function MeetingBasics({
  meetingId,
  meeting,
  readOnly,
}: {
  meetingId: string
  meeting: Meeting
  readOnly: boolean
}) {
  const toast = useToast()

  const save = async (patch: Partial<Meeting>) => {
    try {
      await updateMeeting(meetingId, patch)
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  const leer =
    (meeting.attendees?.length ?? 0) === 0 &&
    !meeting.openingPrayer &&
    !meeting.closingPrayer &&
    !meeting.spiritualThought

  // Bei einer abgeschlossenen Sitzung ohne Angaben gibt es nichts zu zeigen.
  if (readOnly && leer) return null

  return (
    <section className="card no-print mb-4 space-y-2 p-3">
      <PeopleChoice
        label="Anwesend"
        value={meeting.attendees ?? []}
        onChange={(next) => void save({ attendees: next })}
        readOnly={readOnly}
      />
      <PersonChoice
        label="Anfangsgebet"
        value={meeting.openingPrayer ?? ''}
        onChange={(next) => void save({ openingPrayer: next })}
        readOnly={readOnly}
      />
      <PersonChoice
        label="Schlussgebet"
        value={meeting.closingPrayer ?? ''}
        onChange={(next) => void save({ closingPrayer: next })}
        readOnly={readOnly}
      />
      <PersonChoice
        label="Geistiger Gedanke"
        value={meeting.spiritualThought ?? ''}
        onChange={(next) => void save({ spiritualThought: next })}
        readOnly={readOnly}
      />
    </section>
  )
}

/** Reine Druckansicht – am Bildschirm ausgeblendet. */
function PrintProtocol({
  meeting,
  groups,
  userName,
  memberName,
}: {
  meeting: {
    title: string
    date: unknown
    location?: string
    attendees?: string[]
    openingPrayer?: string
    closingPrayer?: string
    spiritualThought?: string
  }
  groups: Record<ItemKind, AgendaItem[]>
  userName: (id: string) => string
  memberName: (id: string) => string
}) {
  // Konten und Mitglieder stehen in denselben Feldern einer Berufungsrunde;
  // gedruckt wird der Name, gleich woher er kommt.
  const anyName = (id: string) => {
    const user = userName(id)
    return user === 'Unbekannt' ? memberName(id) : user
  }

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
      {(meeting.openingPrayer || meeting.closingPrayer || meeting.spiritualThought) && (
        <p className="text-sm">
          {[
            meeting.openingPrayer && `Anfangsgebet: ${meeting.openingPrayer}`,
            meeting.closingPrayer && `Schlussgebet: ${meeting.closingPrayer}`,
            meeting.spiritualThought && `Geistiger Gedanke: ${meeting.spiritualThought}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {ITEM_KIND_ORDER.map((kind) =>
        groups[kind].length === 0 ? null : (
          <section key={kind} className="mt-4">
            <h2 className="text-sm font-bold uppercase">{ITEM_KIND_PLURAL[kind]}</h2>
            <ol className="mt-1 space-y-3">
              {groups[kind].map((item, index) => (
                <li key={item.id}>
                  <p className="font-semibold">
                    {index + 1}. {item.title}
                    {item.status === 'done' && ' ✓'}
                  </p>
                  {item.description && <p className="text-sm">{plainText(item.description)}</p>}
                  {/* Eine Berufungsrunde hat keine Beschreibung – ohne das
                      stünde im Protokoll nur ihr Titel. */}
                  {item.callingChanges && (
                    <p className="text-sm whitespace-pre-wrap">
                      {callingChangesToText(item.callingChanges, anyName)}
                    </p>
                  )}
                  {item.assignees?.length > 0 && (
                    <p className="text-sm">Zuständig: {item.assignees.map(userName).join(', ')}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ),
      )}
    </div>
  )
}
