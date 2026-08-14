import { useState } from 'react'
import { Check } from 'lucide-react'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { allowsMultiple, formatWeekRange, readyProblems } from '@/lib/impulse'
import { ImpulseItemFields } from '@/components/impulse/ImpulseItemFields'
import {
  deleteImpulseItem,
  saveImpulseItem,
  type ImpulseItemInput,
} from '@/services/impulse'
import { IMPULSE_KIND_LABELS } from '@/lib/types'

/**
 * Das Formular der Redaktion – für neue Inhalte und bestehende.
 *
 * Die Felder der Karte selbst (Art, Frage, Bild, Quiz …) stellt der
 * gemeinsame Baustein `ImpulseItemFields` – dasselbe Formular, mit dem
 * die AP's in der Mitmach-Ecke einreichen. Hier kommt das Redaktionelle
 * dazu: die Woche, der Platz, «Eingereicht von» und der Haken «Bereit».
 *
 * Gespeichert wird auch Unfertiges, bloss als Entwurf: Die Liste unter dem
 * Haken «Bereit» sagt, was bis zur Veröffentlichung noch fehlt
 * (`readyProblems`), und erst wenn sie leer ist, lässt sich «bereit»
 * sichern. So bleibt der Fragenpool ein Sammelbecken für halbe Ideen,
 * ohne dass je eine halbe Idee bei den AP's erscheint.
 *
 * Die aufrufende Seite setzt einen `key` pro Inhalt – das Formular startet
 * dadurch mit frischem Stand, statt einen Vorgänger weiterzuschleppen.
 */
export function ImpulseItemForm({
  open,
  onClose,
  itemId,
  initial,
  weekChoices,
  answerIds,
  commentIds = [],
  todayKey,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  /** Nach erfolgreichem Speichern – etwa um eine Einreichung als übernommen zu markieren. */
  onSaved?: () => void
  /** `null` heisst: ein neuer Inhalt entsteht. */
  itemId: string | null
  initial: ImpulseItemInput
  /** Die Wochen, die zur Wahl stehen – die laufende zuerst. */
  weekChoices: string[]
  /** Quizantworten zu diesem Inhalt – beim Löschen werden sie mitgeräumt. */
  answerIds: string[]
  /** Beiträge zur Frage der Woche – ebenso. */
  commentIds?: string[]
  todayKey: string
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [input, setInput] = useState<ImpulseItemInput>(initial)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  /*
   * Die Woche des Inhalts steht immer zur Wahl – auch wenn sie nicht mehr
   * im Planungsfenster liegt: Sonst verschöbe das blosse Öffnen eines
   * älteren Inhalts seine Woche.
   */
  const weeks =
    input.week && !weekChoices.includes(input.week)
      ? [input.week, ...weekChoices]
      : weekChoices

  const problems = readyProblems({
    kind: input.kind,
    title: input.title,
    source: input.sourceLabel.trim()
      ? { label: input.sourceLabel, url: input.sourceUrl }
      : null,
    quiz: input.kind === 'quiz' || input.kind === 'bilderraetsel' ? input.quiz : null,
    image: input.imageUrl.trim() ? { url: input.imageUrl } : null,
    videoUrl: input.videoUrl,
  })
  const blocked = input.status === 'ready' && problems.length > 0

  /* Arten mit mehreren Karten je Woche tragen einen Platz. */
  const hasOrder = allowsMultiple(input.kind)

  const save = async () => {
    if (busy || blocked || !input.title.trim()) return
    setBusy(true)
    try {
      const outcome = await saveImpulseItem(itemId, input, profile?.id)
      toast.saved(`«${input.title.trim()}» gespeichert.`, outcome)
      onSaved?.()
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Der Inhalt konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!itemId) return
    try {
      const outcome = await deleteImpulseItem(itemId, answerIds, commentIds)
      toast.saved('Inhalt entfernt.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Der Inhalt konnte nicht entfernt werden.')
    }
  }

  const attachedCount = answerIds.length + commentIds.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={itemId ? IMPULSE_KIND_LABELS[input.kind] : `${IMPULSE_KIND_LABELS[input.kind]} erfassen`}
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {itemId && (
            <button
              type="button"
              className="btn-ghost text-rose-600 dark:text-rose-400"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              Löschen
            </button>
          )}
          <div className="flex-1" />
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={busy || blocked || !input.title.trim()}
          >
            <Check className="size-4" aria-hidden />
            Speichern
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <ImpulseItemFields
          input={input}
          setInput={setInput}
          kindSibling={
            <div>
              <label className="label" htmlFor="impulse-week">
                Woche
              </label>
              <select
                id="impulse-week"
                className="input"
                value={input.week ?? ''}
                onChange={(event) =>
                  setInput((value) => ({ ...value, week: event.target.value || null }))
                }
              >
                <option value="">Fragenpool – noch keine Woche</option>
                {weeks.map((week) => (
                  <option key={week} value={week}>
                    {formatWeekRange(week)}
                    {week === todayKey ? ' · diese Woche' : ''}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        <div>
          <label className="label" htmlFor="impulse-contributor">
            Eingereicht von (optional)
          </label>
          <input
            id="impulse-contributor"
            className="input"
            value={input.contributor}
            onChange={(event) =>
              setInput((value) => ({ ...value, contributor: event.target.value }))
            }
            placeholder="Vorname – erscheint auf der Karte"
          />
        </div>

        {hasOrder && (
          <div>
            <label className="label" htmlFor="impulse-order">
              {input.kind === 'feed' ? 'Platz im Feed' : 'Platz innerhalb der Woche'}
            </label>
            <input
              id="impulse-order"
              className="input w-24"
              type="number"
              min={1}
              value={input.order ?? ''}
              onChange={(event) =>
                setInput((value) => ({
                  ...value,
                  order: event.target.value === '' ? null : Number(event.target.value),
                }))
              }
            />
            <p className="hint mt-1">
              Die Reihenfolge legt die Redaktion – kein Algorithmus. Ohne Zahl kommt die Karte
              ans Ende.
            </p>
          </div>
        )}

        <div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={input.status === 'ready'}
              onChange={(event) =>
                setInput((value) => ({
                  ...value,
                  status: event.target.checked ? 'ready' : 'draft',
                }))
              }
            />
            Bereit – erscheint, sobald die Woche beginnt
          </label>
          {problems.length > 0 && (
            <ul
              className={cn(
                'mt-1.5 space-y-0.5 text-xs',
                blocked ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {problems.map((problem) => (
                <li key={problem}>· {problem}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title="Inhalt entfernen?"
        message={
          attachedCount > 0 ? (
            <>
              «{input.title || 'Ohne Titel'}» wird gelöscht – mitsamt{' '}
              {attachedCount === 1 ? 'der einen Antwort' : `den ${attachedCount} Antworten`}, die
              dazu abgegeben wurden.
            </>
          ) : (
            <>«{input.title || 'Ohne Titel'}» wird gelöscht.</>
          )
        }
        confirmLabel="Entfernen"
        danger
      />
    </Modal>
  )
}
