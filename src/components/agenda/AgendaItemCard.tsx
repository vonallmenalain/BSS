import { useState } from 'react'
import {
  Check,
  Clock,
  Lock,
  MessageSquare,
  MoreVertical,
  Pencil,
  Play,
  Repeat,
  Trash2,
  X,
  CalendarClock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDueInfo, formatDate } from '@/lib/dates'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { AssigneeAvatars } from '@/components/ui/Avatar'
import { CategoryBadge, DueBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { DeferMenu } from '@/components/agenda/DeferMenu'
import { deleteAgendaItem, setItemStatus } from '@/services/agenda'
import type { AgendaItem, ItemStatus } from '@/lib/types'

interface Props {
  item: AgendaItem
  /** Öffnet die Detailansicht bzw. den Sitzungsmodus */
  onOpen?: (item: AgendaItem) => void
  onEdit?: (item: AgendaItem) => void
  /** Zeigt an, zu welcher Sitzung das Traktandum gehört */
  meetingLabel?: string
  compact?: boolean
  /** Datum der nächsten Sitzung – für «auf nächste Sitzung verschieben» */
  nextMeeting?: { id: string; date: Date } | null
}

export function AgendaItemCard({
  item,
  onOpen,
  onEdit,
  meetingLabel,
  compact = false,
  nextMeeting,
}: Props) {
  const { profile } = useAuth()
  const { memberName } = useData()
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const due = getDueInfo(item.dueDate)
  const isDone = item.status === 'done'
  const isCancelled = item.status === 'cancelled'
  const actor = profile ? { id: profile.id, name: profile.displayName } : null

  const changeStatus = async (status: ItemStatus) => {
    if (!actor) return
    try {
      await setItemStatus(item.id, status, actor)
      if (status === 'done') toast.success('Als erledigt markiert.')
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteAgendaItem(item.id)
      toast.success('Traktandum gelöscht.')
    } catch (error) {
      console.error(error)
      toast.error('Löschen fehlgeschlagen.')
    }
  }

  return (
    <article
      className={cn(
        'card card-hover group relative',
        compact ? 'p-3' : 'p-4',
        isDone && 'opacity-65',
        isCancelled && 'opacity-50',
        due?.overdue && !isDone && 'border-l-4 border-l-rose-500',
        item.priority === 'high' && !isDone && !due?.overdue && 'border-l-4 border-l-amber-500',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Erledigt-Schalter: die häufigste Aktion, deshalb ganz vorne */}
        <button
          type="button"
          onClick={() => void changeStatus(isDone ? 'open' : 'done')}
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
                (isDone || isCancelled) && 'text-slate-500 line-through dark:text-slate-500',
              )}
            >
              {item.confidential && (
                <Lock
                  className="mr-1 -mt-0.5 inline size-3.5 text-slate-400"
                  aria-label="Vertraulich"
                />
              )}
              {item.title}
            </h3>

            {!compact && item.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                {item.description}
              </p>
            )}
          </button>

          {/* Kennzeichnungen */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {item.status !== 'open' && <StatusBadge status={item.status} />}
            <PriorityBadge priority={item.priority} />
            {!compact && <CategoryBadge category={item.category} />}
            {due && !isDone && (
              <DueBadge label={due.label} overdue={due.overdue} soon={due.soon} />
            )}
            {item.deferCount > 0 && !isDone && (
              <span
                className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                title={`Wurde ${item.deferCount}× verschoben`}
              >
                <Repeat className="size-3" aria-hidden />
                {item.deferCount}×
              </span>
            )}
            {item.notes?.length > 0 && (
              <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <MessageSquare className="size-3" aria-hidden />
                {item.notes.length}
              </span>
            )}
            {meetingLabel && (
              <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <CalendarClock className="size-3" aria-hidden />
                {meetingLabel}
              </span>
            )}
          </div>

          {/* Betroffene Mitglieder */}
          {!compact && item.memberRefs?.length > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Betrifft: {item.memberRefs.map(memberName).join(', ')}
            </p>
          )}
        </div>

        {/* Zuständige und Menü */}
        <div className="flex shrink-0 items-center gap-2">
          <AssigneeAvatars userIds={item.assignees ?? []} />

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="btn-ghost -mr-1 p-1.5"
              aria-label="Weitere Aktionen"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="size-4" aria-hidden />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div className="animate-scale-in absolute right-0 z-20 mt-1 w-52 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {onEdit && (
                    <MenuButton
                      icon={Pencil}
                      label="Bearbeiten"
                      onClick={() => {
                        setMenuOpen(false)
                        onEdit(item)
                      }}
                    />
                  )}
                  {item.status !== 'in_progress' && !isDone && (
                    <MenuButton
                      icon={Play}
                      label="In Arbeit"
                      onClick={() => {
                        setMenuOpen(false)
                        void changeStatus('in_progress')
                      }}
                    />
                  )}
                  {!isDone && (
                    <DeferMenu
                      itemId={item.id}
                      nextMeeting={nextMeeting}
                      onDone={() => setMenuOpen(false)}
                      trigger={
                        <span className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Clock className="size-4" aria-hidden />
                          Verschieben …
                        </span>
                      }
                    />
                  )}
                  {!isCancelled && (
                    <MenuButton
                      icon={X}
                      label="Verwerfen"
                      onClick={() => {
                        setMenuOpen(false)
                        void changeStatus('cancelled')
                      }}
                    />
                  )}
                  <MenuButton
                    icon={Trash2}
                    label="Löschen"
                    danger
                    onClick={() => {
                      setMenuOpen(false)
                      setConfirmDelete(true)
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isDone && item.completedAt && (
        <p className="mt-2 pl-8 text-xs text-slate-400">
          Erledigt am {formatDate(item.completedAt)}
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
        title="Traktandum löschen?"
        message={
          <>
            «{item.title}» wird endgültig gelöscht – samt Notizen und Verlauf.
            Möchtest du es stattdessen nur verwerfen, bleibt es im Archiv erhalten.
          </>
        }
        confirmLabel="Endgültig löschen"
        danger
      />
    </article>
  )
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Check
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950'
          : 'hover:bg-slate-100 dark:hover:bg-slate-700',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}
