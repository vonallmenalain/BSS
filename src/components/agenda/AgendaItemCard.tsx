import { CalendarClock, Check, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/dates'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { AssigneeAvatars } from '@/components/ui/Avatar'
import { KindBadge, StatusBadge } from '@/components/ui/Badge'
import { setItemStatus } from '@/services/agenda'
import { hasOpenCallingRows } from '@/lib/callingChanges'
import { plainText } from '@/lib/textFormat'
import { toItemKind, type AgendaItem } from '@/lib/types'

interface Props {
  item: AgendaItem
  /** Öffnet den Eintrag dort, wo er zu Hause ist – in seiner Sitzung oder in den Pendenzen */
  onOpen?: (item: AgendaItem) => void
  /** Zeigt an, zu welcher Sitzung der Eintrag gehört */
  meetingLabel?: string
  compact?: boolean
  /**
   * Den Haken zum Abschliessen mitzeigen.
   *
   * Auf der Übersicht steht er nicht: Dort wird gelesen, was ansteht, und ein
   * Haken ganz vorne wird beim Blättern gestreift – der Punkt wäre erledigt,
   * ohne dass jemand es wollte. Abgeschlossen wird dort, wo der Eintrag
   * ausgeschrieben steht: in der Sitzung oder im aufgeklappten Eintrag.
   */
  showDoneToggle?: boolean
}

/**
 * Ein Traktandum bzw. eine Pendenz als Karte – zum Anschauen, nicht zum
 * Bearbeiten.
 *
 * Für Übersichten, die nur zeigen, was ansteht: die Startseite, der
 * Sammelkorb beim Planen einer Sitzung. Mehr als ein Griff gehört hier nicht
 * hin – alles Weitere geschieht dort, wo der Eintrag ausgeschrieben steht.
 */
export function AgendaItemCard({
  item,
  onOpen,
  meetingLabel,
  compact = false,
  showDoneToggle = true,
}: Props) {
  const { profile } = useAuth()
  const toast = useToast()

  const isDone = item.status === 'done'
  /** Offene Zeilen einer Berufungsrunde – dann wird hier nicht abgehakt. */
  const openRows = !isDone && hasOpenCallingRows(item.callingChanges)

  const toggleDone = async () => {
    if (!profile) return
    try {
      const outcome = await setItemStatus(item.id, isDone ? 'pending' : 'done', {
        id: profile.id,
        name: profile.displayName,
      })
      if (!isDone) toast.saved('Als erledigt markiert.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  return (
    <article
      className={cn(
        'card card-hover group relative',
        compact ? 'p-3' : 'p-4',
        isDone && 'opacity-65',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Erledigt-Schalter: die häufigste Aktion, deshalb ganz vorne.
            Eine Berufungsrunde mit offenen Zeilen lässt sich hier nicht
            abhaken – sie wird zeilenweise erledigt (siehe
            `hasOpenCallingRows`). */}
        {showDoneToggle && (
          <button
            type="button"
            onClick={() => void toggleDone()}
            disabled={openRows}
            className={cn(
              'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition',
              isDone
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-300 hover:border-emerald-500 dark:border-slate-600',
              openRows && 'cursor-default opacity-50 hover:border-slate-300',
            )}
            aria-label={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
            aria-pressed={isDone}
          >
            {isDone && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpen?.(item)}
            className="w-full text-left"
            disabled={!onOpen}
          >
            <h3
              className={cn(
                'text-sm leading-snug font-medium',
                isDone && 'text-slate-500 line-through dark:text-slate-500',
              )}
            >
              {item.title}
            </h3>

            {/* Zwei Zeilen Vorschau, und die ohne Auszeichnung: Sie steht in
                einem Knopf, in dem ein Verweis nichts zu suchen hat, und ein
                halber gelber Balken sagt hier nichts. */}
            {!compact && item.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                {plainText(item.description)}
              </p>
            )}
          </button>

          {/* Kennzeichnungen */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <KindBadge kind={toItemKind(item)} />
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
          </div>
        </div>

        <AssigneeAvatars userIds={item.assignees ?? []} />
      </div>

      {isDone && item.completedAt && (
        <p className={cn('mt-2 text-xs text-slate-400', showDoneToggle && 'pl-8')}>
          Erledigt am {formatDate(item.completedAt)}
        </p>
      )}
    </article>
  )
}
