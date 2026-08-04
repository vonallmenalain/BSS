import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDueInfo } from '@/lib/dates'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { DueBadge, KindBadge, StatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Feedback'
import { AgendaItemEditor } from '@/components/agenda/AgendaItemEditor'
import { DeferMenu } from '@/components/agenda/DeferMenu'
import { deleteAgendaItem, setItemStatus } from '@/services/agenda'
import {
  ITEM_KIND_LABELS,
  ITEM_KIND_PLURAL,
  toItemKind,
  type AgendaItem,
  type ItemStatus,
} from '@/lib/types'

interface Props {
  items: AgendaItem[]
  onAdd: () => void
  nextMeeting?: { id: string; date: Date } | null
  /** Sitzung ist abgeschlossen – nur noch lesen */
  readOnly?: boolean
}

/** Der Eintrag, der gerade offen ist, steht in der Adresse. */
export const FOCUS_PARAM = 'traktandum'

/**
 * Sitzungsmodus: ein Punkt gross im Bild, mit Notizfeld und Statusknöpfen in
 * Daumenreichweite.
 *
 * Der Ablauf ist bewusst linear – während der Sitzung will man nicht suchen,
 * sondern der Reihe nach durchgehen: zuerst die neuen Traktanden, danach die
 * Pendenzen aus früheren Sitzungen. Die Leiste oben zeigt trotzdem jederzeit,
 * wo man steht, und erlaubt den direkten Sprung.
 *
 * Bearbeitet wird ohne Umweg: Titel und Beschreibung sind Text, in den man
 * hineingreift, Priorität, Termin und Zuständige stehen darunter. Einen
 * Bearbeiten-Stift gibt es nicht mehr.
 *
 * Welcher Punkt offen ist, steht in der Adresse. Das ist kein Selbstzweck:
 * Ein Klick auf einen erwähnten Namen führt zur Mitgliederseite, und «Zurück»
 * soll von dort nicht irgendwo in der Sitzung landen, sondern genau bei dem
 * Punkt, den man gerade gelesen hat.
 */
export function MeetingFocus({ items, onAdd, nextMeeting, readOnly = false }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const focusId = searchParams.get(FOCUS_PARAM)
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === focusId),
  )
  const current = items[Math.min(index, items.length - 1)] as AgendaItem | undefined

  /*
   * Ersetzt statt angehängt: Beim Blättern durch zwanzig Traktanden soll die
   * Zurück-Geste die Sitzung verlassen und nicht Punkt für Punkt rückwärts
   * gehen.
   */
  const goTo = useCallback(
    (target: AgendaItem | undefined) => {
      if (!target) return
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params)
          next.set(FOCUS_PARAM, target.id)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const step = useCallback(
    (delta: number) => goTo(items[Math.min(Math.max(index + delta, 0), items.length - 1)]),
    [goTo, items, index],
  )

  const doneCount = useMemo(() => items.filter((item) => item.status === 'done').length, [items])

  /*
   * Wo man innerhalb der eigenen Gruppe steht.
   *
   * «Punkt 7 von 12» sagt in einer Sitzung wenig; «Pendenz 2 von 8» sagt,
   * dass die neuen Traktanden durch sind und noch sechs Altlasten warten.
   */
  const place = useMemo(() => {
    const kind = current ? toItemKind(current) : 'traktandum'
    const group = items.filter((item) => toItemKind(item) === kind)
    return {
      kind,
      position: current ? group.findIndex((item) => item.id === current.id) + 1 : 0,
      total: group.length,
    }
  }, [items, current])

  /** Wie viele neue Traktanden vorne stehen – die Pendenzen beginnen danach. */
  const newCount = useMemo(
    () => items.filter((item) => toItemKind(item) === 'traktandum').length,
    [items],
  )

  /* Tastatursteuerung – am Laptop geht das Durchgehen so am schnellsten. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'ArrowRight' || event.key === 'j') step(1)
      else if (event.key === 'ArrowLeft' || event.key === 'k') step(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step])

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
  const kind = toItemKind(current)

  const changeStatus = async (status: ItemStatus) => {
    if (!actor) return
    try {
      await setItemStatus(current.id, status, actor)
      // Nach «erledigt» automatisch weiterrücken – das ist der übliche Ablauf.
      if (status === 'done' && index < items.length - 1) {
        window.setTimeout(() => step(1), 250)
      }
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  const remove = async () => {
    try {
      await deleteAgendaItem(current.id)
      toast.success(`${ITEM_KIND_LABELS[kind]} gelöscht.`)
      goTo(items[Math.max(index - 1, 0)])
    } catch (error) {
      console.error(error)
      toast.error('Löschen fehlgeschlagen.')
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- Fortschritt und Sprungleiste ---- */}
      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            {place.position} von {place.total} {ITEM_KIND_PLURAL[place.kind]}
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

        {/* Die Leiste zählt je Gruppe von vorn und lässt zwischen ihnen eine
            Lücke – so ist auch hier zu sehen, wo das Neue aufhört. */}
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {items.map((item, itemIndex) => {
            const isDone = item.status === 'done'
            const isPendenz = toItemKind(item) === 'pendenz'
            // Die Liste kommt sortiert an: erst die Traktanden, dann die
            // Pendenzen. Daraus ergibt sich die Nummer innerhalb der Gruppe.
            const number = isPendenz ? itemIndex + 1 - newCount : itemIndex + 1
            const first = isPendenz && itemIndex === newCount && itemIndex > 0
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item)}
                title={`${ITEM_KIND_LABELS[isPendenz ? 'pendenz' : 'traktandum']} ${number}: ${item.title}`}
                className={cn(
                  'tabular grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold transition',
                  first && 'ml-3',
                  itemIndex === index
                    ? 'bg-brand-600 text-white'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : isPendenz
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                {isDone && itemIndex !== index ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  number
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

      {/* ---- Aktueller Punkt ---- */}
      <article className="card p-5">
        {/* Angeschrieben wird nur, was vom Normalfall abweicht: «Pendent» neben
            «Pendenz» sagte dasselbe zweimal, und ein neues Traktandum ohne
            Termin braucht gar keine Zeile. */}
        {(kind === 'pendenz' || current.status !== 'pending' || due || current.deferCount > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <KindBadge kind={kind} />
            {current.status !== 'pending' && <StatusBadge status={current.status} />}
            {due && <DueBadge label={due.label} overdue={due.overdue} soon={due.soon} />}
            {current.deferCount > 0 && (
              <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {current.deferCount}× verschoben
              </span>
            )}
          </div>
        )}

        {/* Der Stand gehört dem Eintrag, nicht der Stelle auf dem Bildschirm –
            deshalb baut sich der Editor beim Blättern neu auf. */}
        <AgendaItemEditor key={current.id} item={current} readOnly={readOnly} />
      </article>

      {/* ---- Aktionsleiste ----
           Bleibt beim Scrollen unten stehen, damit Statuswechsel und Blättern
           immer in Daumenreichweite sind. */}
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
                onClick={() => void changeStatus(current.status === 'done' ? 'pending' : 'done')}
              >
                <Check className="size-4" aria-hidden />
                <span className="truncate">
                  {current.status === 'done' ? 'Wieder offen' : 'Erledigt'}
                </span>
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
                onClick={() => setConfirmDelete(true)}
                title="Löschen"
                aria-label="Löschen"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm flex-1"
                onClick={() => step(-1)}
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
                onClick={() => step(1)}
                disabled={index === items.length - 1}
              >
                Weiter
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>

            <p className="mt-1.5 hidden text-center text-xs text-slate-400 lg:block">
              Tastatur: ← → blättern
            </p>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title={`${ITEM_KIND_LABELS[kind]} löschen?`}
        message={
          <>
            «{current.title}» wird endgültig gelöscht – samt Verlauf. Soll der Punkt bloss aus
            dieser Sitzung verschwinden, ist «Verschieben» der richtige Weg.
          </>
        }
        confirmLabel="Endgültig löschen"
        danger
      />
    </div>
  )
}
