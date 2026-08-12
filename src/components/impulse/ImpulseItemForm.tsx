import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { formatWeekRange, readyProblems } from '@/lib/impulse'
import {
  deleteImpulseItem,
  saveImpulseItem,
  type ImpulseItemInput,
} from '@/services/impulse'
import {
  IMPULSE_KIND_LABELS,
  IMPULSE_QUIZ_FORM_LABELS,
  type ImpulseKind,
  type ImpulseQuiz,
  type ImpulseQuizForm,
} from '@/lib/types'

/**
 * Das Formular der Redaktion – für neue Inhalte und bestehende.
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
  todayKey,
}: {
  open: boolean
  onClose: () => void
  /** `null` heisst: ein neuer Inhalt entsteht. */
  itemId: string | null
  initial: ImpulseItemInput
  /** Die Wochen, die zur Wahl stehen – die laufende zuerst. */
  weekChoices: string[]
  /** Antworten auf diese Frage – beim Löschen werden sie mitgeräumt. */
  answerIds: string[]
  todayKey: string
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [input, setInput] = useState<ImpulseItemInput>(initial)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const quiz = input.quiz
  const setQuiz = (patch: Partial<ImpulseQuiz>) =>
    setInput((value) => ({ ...value, quiz: { ...value.quiz, ...patch } }))

  const setOption = (index: number, text: string) => {
    const options = [...quiz.options]
    options[index] = text
    setQuiz({ options })
  }

  const addOption = () => {
    if (quiz.options.length >= 6) return
    setQuiz({ options: [...quiz.options, ''] })
  }

  const removeOption = (index: number) => {
    if (quiz.options.length <= 2) return
    const options = quiz.options.filter((_, i) => i !== index)
    // Die Markierung wandert mit ihrer Antwort – oder auf die nächste, wenn
    // genau die markierte wegfällt.
    const answerIndex =
      index < quiz.answerIndex
        ? quiz.answerIndex - 1
        : Math.min(quiz.answerIndex, options.length - 1)
    setQuiz({ options, answerIndex })
  }

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
    quiz: input.kind === 'quiz' ? quiz : null,
  })
  const blocked = input.status === 'ready' && problems.length > 0

  const save = async () => {
    if (busy || blocked || !input.title.trim()) return
    setBusy(true)
    try {
      const outcome = await saveImpulseItem(itemId, input, profile?.id)
      toast.saved(`«${input.title.trim()}» gespeichert.`, outcome)
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
      const outcome = await deleteImpulseItem(itemId, answerIds)
      toast.saved('Inhalt entfernt.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Der Inhalt konnte nicht entfernt werden.')
    }
  }

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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="impulse-kind">
              Art
            </label>
            <select
              id="impulse-kind"
              className="input"
              value={input.kind}
              onChange={(event) =>
                setInput((value) => ({ ...value, kind: event.target.value as ImpulseKind }))
              }
            >
              {(Object.keys(IMPULSE_KIND_LABELS) as ImpulseKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {IMPULSE_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>

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
        </div>

        <div>
          <label className="label" htmlFor="impulse-title">
            {input.kind === 'quiz' ? 'Frage' : 'Titel'}
          </label>
          <input
            id="impulse-title"
            className="input"
            value={input.title}
            onChange={(event) => setInput((value) => ({ ...value, title: event.target.value }))}
            placeholder={
              input.kind === 'quiz'
                ? 'Wie heisst der Hund, von dem in der Ansprache erzählt wird?'
                : 'Kraft aus den Schriften'
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="impulse-body">
            {input.kind === 'quiz' ? 'Ergänzung (optional)' : 'Hinführung'}
          </label>
          <textarea
            id="impulse-body"
            className="input min-h-20"
            value={input.body}
            onChange={(event) => setInput((value) => ({ ...value, body: event.target.value }))}
            placeholder={
              input.kind === 'quiz'
                ? 'Ein Hinweis, wo sich das Suchen lohnt …'
                : 'Zwei, drei Sätze, die zur Schriftstelle hinführen …'
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="impulse-source">
              Quelle
            </label>
            <input
              id="impulse-source"
              className="input"
              value={input.sourceLabel}
              onChange={(event) =>
                setInput((value) => ({ ...value, sourceLabel: event.target.value }))
              }
              placeholder="Alma 32:21 · Generalkonferenz Okt. 2025 …"
            />
          </div>
          <div>
            <label className="label" htmlFor="impulse-source-url">
              Link zur Quelle
            </label>
            <input
              id="impulse-source-url"
              className="input"
              type="url"
              value={input.sourceUrl}
              onChange={(event) =>
                setInput((value) => ({ ...value, sourceUrl: event.target.value }))
              }
              placeholder="https://www.churchofjesuschrist.org/…"
            />
          </div>
        </div>

        {input.kind === 'quiz' && (
          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <legend className="label px-1">Quiz</legend>

            <div>
              <label className="label" htmlFor="impulse-quiz-form">
                Form
              </label>
              <select
                id="impulse-quiz-form"
                className="input"
                value={quiz.form}
                onChange={(event) => setQuiz({ form: event.target.value as ImpulseQuizForm })}
              >
                {(Object.keys(IMPULSE_QUIZ_FORM_LABELS) as ImpulseQuizForm[]).map((form) => (
                  <option key={form} value={form}>
                    {IMPULSE_QUIZ_FORM_LABELS[form]}
                  </option>
                ))}
              </select>
            </div>

            {quiz.form === 'choice' ? (
              <div className="space-y-1.5">
                <p className="label">Antworten – die richtige markieren</p>
                {quiz.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="impulse-correct"
                      className="size-4 shrink-0"
                      checked={quiz.answerIndex === index}
                      onChange={() => setQuiz({ answerIndex: index })}
                      aria-label={`Antwort ${index + 1} ist richtig`}
                    />
                    <input
                      className="input"
                      value={option}
                      onChange={(event) => setOption(index, event.target.value)}
                      placeholder={`Antwort ${index + 1}`}
                    />
                    <button
                      type="button"
                      className={cn(
                        'btn-ghost p-1.5',
                        quiz.options.length <= 2 && 'invisible',
                      )}
                      onClick={() => removeOption(index)}
                      aria-label={`Antwort ${index + 1} entfernen`}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
                {quiz.options.length < 6 && (
                  <button type="button" className="btn-ghost btn-sm" onClick={addOption}>
                    <Plus className="size-4" aria-hidden />
                    Antwort
                  </button>
                )}
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="impulse-solution">
                  Lösung
                </label>
                <input
                  id="impulse-solution"
                  className="input"
                  value={quiz.answerText}
                  onChange={(event) => setQuiz({ answerText: event.target.value })}
                  placeholder="So steht sie nachher in der Auflösung"
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="impulse-explanation">
                Erklärung für die Auflösung
              </label>
              <textarea
                id="impulse-explanation"
                className="input min-h-16"
                value={quiz.explanation}
                onChange={(event) => setQuiz({ explanation: event.target.value })}
                placeholder="Zwei, drei Sätze, warum die Antwort stimmt – der Lernmoment."
              />
            </div>
          </fieldset>
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
          answerIds.length > 0 ? (
            <>
              «{input.title || 'Ohne Titel'}» wird gelöscht – mitsamt{' '}
              {answerIds.length === 1 ? 'der einen Antwort' : `den ${answerIds.length} Antworten`},
              die dazu abgegeben wurden.
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
