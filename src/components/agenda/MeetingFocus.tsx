import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime, getDueInfo } from '@/lib/dates'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { AssigneeAvatars } from '@/components/ui/Avatar'
import { CategoryBadge, DueBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/Feedback'
import { DeferMenu } from '@/components/agenda/DeferMenu'
import { addNote, removeNote, setItemStatus } from '@/services/agenda'
import type { AgendaItem, ItemStatus } from '@/lib/types'

interface Props {
  items: AgendaItem[]
  onEdit: (item: AgendaItem) => void
  onAdd: () => void
  nextMeeting?: { id: string; date: Date } | null
  /** Sitzung ist abgeschlossen – nur noch lesen */
  readOnly?: boolean
}

/**
 * Sitzungsmodus: ein Traktandum gross im Bild, mit Notizfeld und
 * Statusknöpfen in Daumenreichweite.
 *
 * Der Ablauf ist bewusst linear – während der Sitzung will man nicht suchen,
 * sondern der Reihe nach durchgehen. Die Leiste oben zeigt trotzdem jederzeit,
 * wo man steht, und erlaubt den direkten Sprung.
 */
export function MeetingFocus({ items, onEdit, onAdd, nextMeeting, readOnly = false }: Props) {
  const { profile } = useAuth()
  const { memberName } = useData()
  const toast = useToast()
  const [index, setIndex] = useState(0)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const current = items[index] as AgendaItem | undefined

  // Rutscht das aktuelle Traktandum aus der Liste (z. B. nach dem Löschen),
  // auf den letzten gültigen Eintrag zurückfallen.
  useEffect(() => {
    if (index >= items.length && items.length > 0) setIndex(items.length - 1)
  }, [items.length, index])

  // Beim Wechsel das Notizfeld leeren, damit nichts am falschen Traktandum landet.
  useEffect(() => setNoteText(''), [current?.id])

  const doneCount = useMemo(
    () => items.filter((item) => item.status === 'done' || item.status === 'cancelled').length,
    [items],
  )

  /* Tastatursteuerung – am Laptop geht das Durchgehen so am schnellsten. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'ArrowRight' || event.key === 'j') {
        setIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (event.key === 'ArrowLeft' || event.key === 'k') {
        setIndex((i) => Math.max(i - 1, 0))
      } else if (event.key === 'n') {
        event.preventDefault()
        noteRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [items.length])

  if (items.length === 0) {
    return (
      <EmptyState
        title="Noch keine Traktanden"
        description="Trage ein, was in dieser Sitzung besprochen werden soll."
        action={
          !readOnly && (
            <button type="button" className="btn-primary" onClick={onAdd}>
              <Plus className="size-4" aria-hidden />
              Traktandum hinzufügen
            </button>
          )
        }
      />
    )
  }

  if (!current) return null

  const actor = profile ? { id: profile.id, name: profile.displayName } : null
  const due = getDueInfo(current.dueDate)

  const changeStatus = async (status: ItemStatus) => {
    if (!actor) return
    try {
      await setItemStatus(current.id, status, actor)
      // Nach «erledigt» automatisch weiterrücken – das ist der übliche Ablauf.
      if (status === 'done' && index < items.length - 1) {
        setTimeout(() => setIndex((i) => Math.min(i + 1, items.length - 1)), 250)
      }
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  const submitNote = async () => {
    const text = noteText.trim()
    if (!text || !actor) return
    setSavingNote(true)
    try {
      await addNote(current.id, text, actor)
      setNoteText('')
    } catch (error) {
      console.error(error)
      toast.error('Notiz konnte nicht gespeichert werden.')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- Fortschritt und Sprungleiste ---- */}
      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            Traktandum {index + 1} von {items.length}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {doneCount} erledigt · {items.length - doneCount} offen
          </span>
        </div>

        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {items.map((item, itemIndex) => {
            const isDone = item.status === 'done' || item.status === 'cancelled'
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(itemIndex)}
                title={item.title}
                className={cn(
                  'tabular grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold transition',
                  itemIndex === index
                    ? 'bg-brand-600 text-white'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                {isDone && itemIndex !== index ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  itemIndex + 1
                )}
              </button>
            )
          })}
          {!readOnly && (
            <button
              type="button"
              onClick={onAdd}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition hover:border-slate-400 hover:text-slate-600 dark:border-slate-600"
              aria-label="Traktandum hinzufügen"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* ---- Aktuelles Traktandum ---- */}
      <article className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={current.status} />
          <CategoryBadge category={current.category} />
          <PriorityBadge priority={current.priority} />
          {due && <DueBadge label={due.label} overdue={due.overdue} soon={due.soon} />}
          {current.confidential && (
            <span className="badge bg-slate-800 text-slate-100 dark:bg-slate-700">
              <Lock className="size-3" aria-hidden />
              Vertraulich
            </span>
          )}
          {current.deferCount > 0 && (
            <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {current.deferCount}× verschoben
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-balance sm:text-xl">{current.title}</h2>
          {!readOnly && (
            <button
              type="button"
              className="btn-ghost shrink-0 p-2"
              onClick={() => onEdit(current)}
              aria-label="Traktandum bearbeiten"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {current.description && (
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300">
            {current.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {current.assignees?.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">Zuständig:</span>
              <AssigneeAvatars userIds={current.assignees} showNames />
            </div>
          )}
          {current.memberRefs?.length > 0 && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">Betrifft: </span>
              <span>{current.memberRefs.map(memberName).join(', ')}</span>
            </div>
          )}
        </div>

        {/* ---- Notizen ---- */}
        <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="mb-2 text-sm font-medium">Notizen</h3>

          {current.notes?.length > 0 && (
            <ul className="mb-3 space-y-2">
              {[...current.notes]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((note) => (
                  <li
                    key={note.id}
                    className="group flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap">{note.text}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {note.authorName} · {formatDateTime(note.createdAt)}
                      </p>
                    </div>
                    {!readOnly && note.authorId === profile?.id && (
                      <button
                        type="button"
                        onClick={() => void removeNote(current.id, note.id)}
                        className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-600 focus-visible:opacity-100"
                        aria-label="Notiz löschen"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {!readOnly && (
            <div className="flex items-end gap-2">
              <textarea
                ref={noteRef}
                className="input min-h-11 resize-y py-2.5"
                rows={2}
                placeholder="Was wurde besprochen oder beschlossen?"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                onKeyDown={(event) => {
                  // Enter speichert, Shift+Enter macht einen Zeilenumbruch.
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submitNote()
                  }
                }}
              />
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={() => void submitNote()}
                disabled={!noteText.trim() || savingNote}
                aria-label="Notiz speichern"
              >
                <Send className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </section>
      </article>

      {/* ---- Aktionsleiste ----
           Bleibt beim Scrollen unten stehen, damit Statuswechsel und Blättern
           immer in Daumenreichweite sind. Der Abstandhalter darunter sorgt
           dafür, dass sie nie den letzten Inhalt verdeckt. */}
      {!readOnly && (
        <>
          {/* Der Abstand nach unten entspricht dem Innenabstand des Hauptbereichs
              (pb-24 bzw. lg:pb-8) – sonst bliebe die Leiste am Seitenende kleben
              und würde die letzten Zeilen überdecken. */}
          <div className="card sticky bottom-24 z-20 p-2 lg:bottom-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  'min-w-0 flex-1',
                  current.status === 'done' ? 'btn-secondary' : 'btn-success',
                )}
                onClick={() => void changeStatus(current.status === 'done' ? 'open' : 'done')}
              >
                <Check className="size-4" aria-hidden />
                <span className="truncate">
                  {current.status === 'done' ? 'Wieder offen' : 'Erledigt'}
                </span>
              </button>

              <button
                type="button"
                className="btn-secondary hidden sm:inline-flex"
                onClick={() => void changeStatus('in_progress')}
                disabled={current.status === 'in_progress'}
              >
                In Arbeit
              </button>

              <DeferMenu
                itemId={current.id}
                nextMeeting={nextMeeting}
                triggerClassName="shrink-0"
                trigger={
                  <span className="btn-secondary">
                    <Clock className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Verschieben</span>
                  </span>
                }
              />

              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() => void changeStatus('cancelled')}
                title="Traktandum verwerfen"
                aria-label="Traktandum verwerfen"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm flex-1"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                disabled={index === 0}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Zurück
              </button>
              <span className="tabular shrink-0 px-2 text-xs text-slate-400">
                {index + 1}/{items.length}
              </span>
              <button
                type="button"
                className="btn-secondary btn-sm flex-1"
                onClick={() => setIndex((i) => Math.min(i + 1, items.length - 1))}
                disabled={index === items.length - 1}
              >
                Weiter
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>

            <p className="mt-1.5 hidden text-center text-xs text-slate-400 lg:block">
              Tastatur: ← → blättern · N springt ins Notizfeld
            </p>
          </div>
        </>
      )}
    </div>
  )
}
