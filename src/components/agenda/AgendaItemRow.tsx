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
import { deleteAgendaItem, setItemStatus } from '@/services/agenda'
import { ITEM_KIND_LABELS, toItemKind, type AgendaItem } from '@/lib/types'

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
  nextMeeting?: { id: string; date: Date } | null
  /** Zu welcher Sitzung der Eintrag gehört – ausserhalb der Sitzung nützlich */
  meetingLabel?: string
  meetingHref?: string
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
  nextMeeting,
  meetingLabel,
  meetingHref,
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
      <div className="flex items-start gap-2 p-2.5">
        {onDragStart && (
          <span
            className="mt-1 hidden cursor-grab text-slate-300 active:cursor-grabbing sm:block dark:text-slate-600"
            aria-hidden
          >
            <GripVertical className="size-4" />
          </span>
        )}

        {/* Erledigt-Schalter: die häufigste Aktion, deshalb ganz vorne */}
        <button
          type="button"
          onClick={() => void toggleDone()}
          disabled={readOnly}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition',
            isDone
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-300 hover:border-emerald-500 dark:border-slate-600',
          )}
          aria-label={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
          aria-pressed={isDone}
        >
          {isDone && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
        </button>

        <button
          type="button"
          onClick={onToggle}
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
              {item.status === 'new' && <StatusBadge status="new" />}
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
          {!expanded && <AssigneeAvatars userIds={item.assignees ?? []} />}

          {onMove && (
            <span className="-my-1 flex flex-col">
              <button
                type="button"
                className="btn-ghost p-1"
                onClick={() => onMove(-1)}
                disabled={first}
                aria-label={`«${item.title}» nach oben`}
              >
                <ChevronUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-ghost p-1"
                onClick={() => onMove(1)}
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
            onClick={onToggle}
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
          <AgendaItemEditor key={item.id} item={item} readOnly={readOnly} />

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
              <button
                type="button"
                className={isDone ? 'btn-secondary btn-sm' : 'btn-success btn-sm'}
                onClick={() => void toggleDone()}
              >
                <Check className="size-4" aria-hidden />
                {isDone ? 'Wieder offen' : 'Erledigt'}
              </button>

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
