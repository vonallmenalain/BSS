import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Repeat,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { AssigneeAvatars } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { AgendaItemEditor } from '@/components/agenda/AgendaItemEditor'
import { DeferMenu } from '@/components/agenda/DeferMenu'
import { AuthorChip } from '@/components/agenda/AuthorChip'
import { deleteAgendaItem, setItemStatus } from '@/services/agenda'
import { callingRowCounts } from '@/lib/callingChanges'
import { formatDate } from '@/lib/dates'
import {
  ITEM_KIND_LABELS,
  lastEditedAt,
  toItemKind,
  type AgendaItem,
  type CallingChanges,
  type TS,
} from '@/lib/types'

interface Props {
  item: AgendaItem
  /**
   * Platz in der Liste – die Nummer, die auch im Protokoll steht. Ohne
   * selbst gewählte Reihenfolge (Pendenzenliste) bleibt sie weg: Eine Zahl,
   * die sich mit dem nächsten Termin verschiebt, bedeutet nichts.
   */
  position?: number
  expanded: boolean
  onToggle: () => void
  /** Um eine Stelle nach oben (-1) oder unten (+1) */
  onMove?: (delta: number) => void
  first?: boolean
  last?: boolean
  readOnly?: boolean
  /**
   * Eine Berufungsrunde aufgeklappt mit «Nur meine» zeigen.
   *
   * Für den Ausschnitt «Meine» der Pendenzenliste: Dort steht die Runde, weil
   * eine ihrer Zeilen mich angeht – und dann sind auch diese Zeilen gemeint
   * und nicht die ganze Runde (siehe `CallingChangesTables`).
   */
  ownRowsOnly?: boolean
  nextMeeting?: { id: string; date: Date } | null
  /** Zu welcher Sitzung der Eintrag gehört – ausserhalb der Sitzung nützlich */
  meetingLabel?: string
  meetingHref?: string
  /**
   * Datum einer Sitzung als Text – für die Angaben im aufgeklappten Eintrag.
   *
   * Der Eintrag selbst kennt nur die IDs seiner Sitzungen; welche Termine
   * dazugehören, weiss die Liste, die ihn zeichnet.
   */
  meetingDate?: (meetingId: string) => string | undefined
  /** Ziehen und Ablegen – am Zeigergerät der schnellere Weg */
  onDragStart?: (event: DragEvent<HTMLElement>) => void
  onDragOver?: (event: DragEvent<HTMLElement>) => void
  onDrop?: (event: DragEvent<HTMLElement>) => void
  onDragEnd?: () => void
  dragging?: boolean
  dropTarget?: boolean
}

/**
 * Eine Zeile der Sitzungsliste – zugeklappt schmal, aufgeklappt vollständig.
 *
 * Die Liste ist zum Vorbereiten da: Man will auf einen Blick sehen, was
 * ansteht, und die Reihenfolge festlegen. Deshalb zeigt die Zeile nur den
 * Titel und das Nötigste daneben. Ein Klick klappt sie auf, und dann steht
 * alles da – Beschreibung und Zuständige – und lässt sich unmittelbar
 * ändern; ein Fenster dazwischen gibt es nicht mehr.
 *
 * Umsortiert wird auf zwei Wegen: mit den Pfeilen (auch am Handy) und durch
 * Ziehen und Ablegen (am Zeigergerät). Beides schreibt dieselbe Reihenfolge.
 *
 * Einen Haken zum sofortigen Abhaken hat die Zeile bewusst nicht mehr. Er
 * stand ganz vorne, wo man ihn beim Blättern und beim Umsortieren streift –
 * und ein Punkt war abgeschlossen, ohne dass jemand es wollte. Abgeschlossen
 * wird deshalb nur noch dort, wo der Eintrag ausgeschrieben steht: mit dem
 * grünen Knopf «Erledigt» im aufgeklappten Eintrag oder im Sitzungsmodus.
 */
export function AgendaItemRow({
  item,
  position,
  expanded,
  onToggle,
  onMove,
  first = false,
  last = false,
  readOnly = false,
  ownRowsOnly = false,
  nextMeeting,
  meetingLabel,
  meetingHref,
  meetingDate,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragging = false,
  dropTarget = false,
}: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isDone = item.status === 'done'
  const kind = toItemKind(item)

  /*
   * Eine Berufungsrunde hakt sich nicht in einem Zug ab.
   *
   * Sie ist ein Eintrag mit zwanzig Zeilen, die untereinander verteilt
   * werden; erledigt wird deshalb Zeile für Zeile, im Menü rechts an jeder
   * von ihnen. Der ganze Eintrag ist genau dann fertig, wenn keine Zeile mehr
   * offen ist – erst dann steht der grüne Knopf da. Alles andere (ein
   * Traktandum mit einer Beschreibung, ein Raster) ist wie bisher mit einem
   * Griff erledigt.
   *
   * Wieder öffnen geht immer: Ein versehentlich abgehakter Eintrag muss
   * zurückzuholen sein, auch wenn inzwischen wieder eine Zeile offen ist.
   *
   * Gezählt wird am Stand im Editor und nicht am gespeicherten: Gespeichert
   * wird erst beim Verlassen des Eintrags, und bis dahin fehlte der Knopf
   * noch, nachdem man eben die letzte Zeile abgehakt hat. Beim Zuklappen
   * fällt der Merkwert weg – dann gilt wieder, was in der Datenbank steht.
   */
  const [live, setLive] = useState<CallingChanges | null>(null)
  const [liveWhileOpen, setLiveWhileOpen] = useState(expanded)
  if (liveWhileOpen !== expanded) {
    setLiveWhileOpen(expanded)
    setLive(null)
  }

  const openRows = callingRowCounts(live ?? item.callingChanges).open
  const closable = isDone || openRows === 0

  const toggleDone = async () => {
    if (!profile) return
    try {
      await setItemStatus(item.id, isDone ? 'pending' : 'done', {
        id: profile.id,
        name: profile.displayName,
      })
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  const remove = async () => {
    try {
      await deleteAgendaItem(item.id)
      toast.success(`${ITEM_KIND_LABELS[kind]} gelöscht.`)
    } catch (error) {
      console.error(error)
      toast.error('Löschen fehlgeschlagen.')
    }
  }

  return (
    <li
      // Gezogen wird nur die zugeklappte Zeile: Im aufgeklappten Zustand wird
      // geschrieben, und ein Text, den man markieren will, darf nicht davonfliegen.
      draggable={Boolean(onDragStart) && !expanded}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'card transition',
        dragging && 'opacity-40',
        dropTarget && 'border-brand-500 border-dashed',
      )}
    >
      {/*
        Die ganze Kopfzeile klappt auf und zu – nicht nur der Titel.
        Zugeklappt ist das die Zeile, aufgeklappt der Bereich bis zur
        Trennlinie. Vorher lagen dazwischen tote Flächen (rechts neben dem
        Titel, unter den Kennzeichnungen), und ein Griff dorthin tat nichts.
        Die Knöpfe darin halten ihren Klick bei sich (`stopPropagation`).
      */}
      <div className="flex cursor-pointer items-start gap-2 p-2.5" onClick={onToggle}>
        {onDragStart && (
          <span
            className="mt-1 hidden cursor-grab text-slate-300 active:cursor-grabbing sm:block dark:text-slate-600"
            aria-hidden
          >
            <GripVertical className="size-4" />
          </span>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggle()
          }}
          aria-expanded={expanded}
          className="min-w-0 flex-1 text-left"
        >
          {/* Aufgeklappt steht der Titel gross darunter und lässt sich dort
              ändern – zweimal dasselbe zu lesen bringt niemandem etwas. */}
          {expanded ? (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular">
                {ITEM_KIND_LABELS[kind]}
                {position !== undefined && ` ${position}`}
              </span>
              {/* «Pendent» neben «Pendenz» sagt dasselbe zweimal – angeschrieben
                  wird nur, was vom Normalfall abweicht. */}
              {item.status !== 'pending' && <StatusBadge status={item.status} />}
              {item.deferCount > 0 && (
                <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <Repeat className="size-3" aria-hidden />
                  {item.deferCount}× verschoben
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-baseline gap-2">
              {position !== undefined && (
                <span className="tabular shrink-0 text-xs text-slate-400">{position}.</span>
              )}
              <span
                className={cn(
                  'line-clamp-1 min-w-0 text-sm leading-snug font-medium',
                  isDone && 'text-slate-500 line-through dark:text-slate-500',
                )}
              >
                {item.title || <span className="text-slate-400">Ohne Titel</span>}
              </span>
            </span>
          )}

          {!expanded && (
            <span
              className={cn(
                'mt-1 flex flex-wrap items-center gap-1.5',
                position !== undefined && 'pl-6',
              )}
            >
              {/* Ohne den Haken vorne trägt die Zeile den Stand selbst: «Neu»
                  vor dem Start der Sitzung, «Erledigt» danach. «Pendent» ist
                  der Normalfall und bleibt ungeschrieben. */}
              {item.status !== 'pending' && <StatusBadge status={item.status} />}
              {item.deferCount > 0 && !isDone && (
                <span
                  className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  title={`Wurde ${item.deferCount}× verschoben`}
                >
                  <Repeat className="size-3" aria-hidden />
                  {item.deferCount}×
                </span>
              )}
              {meetingLabel && (
                <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <CalendarClock className="size-3" aria-hidden />
                  {meetingLabel}
                </span>
              )}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {/* In der Liste steht das Kürzel der Zuständigen und sonst keines:
              Beim Durchgehen zählt, wer etwas zu tun hat. Wer den Punkt
              erfasst und wer zuletzt daran gearbeitet hat, steht aufgeklappt
              bei den Daten (siehe `ItemDates`). */}
          {!expanded && <AssigneeAvatars userIds={item.assignees ?? []} />}

          {onMove && (
            <span className="-my-1 flex flex-col">
              <button
                type="button"
                className="btn-ghost p-1"
                onClick={(event) => {
                  event.stopPropagation()
                  onMove(-1)
                }}
                disabled={first}
                aria-label={`«${item.title}» nach oben`}
              >
                <ChevronUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-ghost p-1"
                onClick={(event) => {
                  event.stopPropagation()
                  onMove(1)
                }}
                disabled={last}
                aria-label={`«${item.title}» nach unten`}
              >
                <ChevronDown className="size-4" aria-hidden />
              </button>
            </span>
          )}

          <button
            type="button"
            className="btn-ghost p-1.5"
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
            aria-label={expanded ? 'Zuklappen' : 'Aufklappen'}
          >
            <ChevronDown
              className={cn('size-4 transition', expanded && 'rotate-180')}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="animate-slide-up border-t border-slate-200 px-3 pt-3 pb-3 dark:border-slate-800">
          {/* Der Stand gehört dem Eintrag – deshalb baut sich der Editor je
              Eintrag neu auf. */}
          <AgendaItemEditor
            key={item.id}
            item={item}
            readOnly={readOnly}
            ownRowsOnly={ownRowsOnly}
            onCallingChanges={setLive}
          />

          <ItemDates item={item} meetingDate={meetingDate} />

          {meetingHref && (
            <Link
              to={meetingHref}
              className="text-brand-600 dark:text-brand-300 mt-3 inline-flex items-center gap-1 text-sm hover:underline"
            >
              Zur Sitzung
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}

          {!readOnly && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* Eine Berufungsrunde wird zeilenweise erledigt (im Menü rechts
                  an jeder Zeile). Der ganze Eintrag ist erst fertig, wenn
                  keine Zeile mehr offen ist – bis dahin stünde hier ein Knopf,
                  der mehr abhakte, als besprochen wurde. */}
              {closable && (
                <button
                  type="button"
                  className={isDone ? 'btn-secondary btn-sm' : 'btn-success btn-sm'}
                  onClick={() => void toggleDone()}
                >
                  <Check className="size-4" aria-hidden />
                  {isDone ? 'Wieder offen' : 'Erledigt'}
                </button>
              )}

              <DeferMenu itemId={item.id} nextMeeting={nextMeeting} className="btn-sm" />

              <button
                type="button"
                className="btn-ghost btn-sm ml-auto text-rose-600 dark:text-rose-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                Löschen
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title={`${ITEM_KIND_LABELS[kind]} löschen?`}
        message={
          <>
            «{item.title}» wird endgültig gelöscht – samt Verlauf. Soll der Punkt bloss aus dieser
            Sitzung verschwinden, ist «Verschieben» der richtige Weg.
          </>
        }
        confirmLabel="Endgültig löschen"
        danger
      />
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Die Daten eines Eintrags                                            */
/* ------------------------------------------------------------------ */

/**
 * Wann behandelt, wann erfasst, wann zum ersten Mal traktandiert, wann
 * zuletzt bearbeitet.
 *
 * Zugeklappt steht neben dem Titel nur das eine Datum, das die Zeile
 * einordnet. Aufgeklappt geht es um den Eintrag selbst, und dann zählt seine
 * Geschichte: Eine Pendenz, die seit einem halben Jahr mitläuft, sieht anders
 * aus als eine von gestern – auch wenn beide auf derselben Sitzung stehen.
 *
 * Was fehlt, steht nicht da. Ein «–» hinter einer Beschriftung sagt nichts,
 * das die leere Stelle nicht auch sagt.
 */
function ItemDates({
  item,
  meetingDate,
}: {
  item: AgendaItem
  meetingDate?: (meetingId: string) => string | undefined
}) {
  const next = item.meetingId ? meetingDate?.(item.meetingId) : undefined
  // Die Sitzung, in der der Punkt zum ersten Mal stand. Ist es dieselbe wie
  // die kommende, steht sie nur einmal da – zweimal dasselbe Datum
  // nebeneinander liest sich wie ein Fehler.
  const first =
    item.firstMeetingId && item.firstMeetingId !== item.meetingId
      ? meetingDate?.(item.firstMeetingId)
      : undefined

  /*
   * Wer dahintersteht, gehört zum Datum und nicht in eine eigene Zeile:
   * «Erfasst 12.03.2026 AR» ist eine Angabe. Der volle Name und die Uhrzeit
   * stehen im Tooltip des Kürzels (siehe `ItemAuthors`).
   */
  const entries: { label: string; value: string; by?: string; at?: TS }[] = []
  if (next) entries.push({ label: 'Nächste Sitzung', value: next })
  if (item.createdAt)
    entries.push({
      label: 'Erfasst',
      value: formatDate(item.createdAt),
      by: item.createdBy,
      at: item.createdAt,
    })
  if (first) entries.push({ label: 'Ursprünglich', value: first })
  const edited = lastEditedAt(item)
  if (edited)
    entries.push({
      label: 'Zuletzt bearbeitet',
      value: formatDate(edited),
      by: item.editedBy,
      at: edited,
    })

  if (entries.length === 0) return null

  return (
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
      {entries.map(({ label, value, by, at }) => (
        <div key={label} className="flex items-center gap-1.5">
          <dt>{label}</dt>
          <dd className="tabular flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            {value}
            {by && <AuthorChip userId={by} label={label} date={at} />}
          </dd>
        </div>
      ))}
    </dl>
  )
}
