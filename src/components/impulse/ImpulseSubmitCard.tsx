import { useState } from 'react'
import { Check, Lightbulb, Plus, Search, Send, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { createImpulseSubmission, deleteImpulseSubmission } from '@/services/impulse'
import {
  IMPULSE_SUBMISSION_KIND_LABELS,
  type ImpulseSubmission,
  type ImpulseSubmissionKind,
} from '@/lib/types'

/**
 * Die Mitmach-Ecke: Die AP's liefern selbst – eine Lieblingsschriftstelle,
 * einen Gedanken, eine Quizidee. Formlos eingereicht, von der Redaktion
 * geprüft und in Form gebracht; auf der fertigen Karte steht dann
 * «Eingereicht von …». Wer eine Frage baut, muss die Quelle genau lesen –
 * die lehrreichste Übung von allen, versteckt als Spiel.
 *
 * Zu sehen sind hier nur die **eigenen** Einreichungen samt Stand:
 * «Bei der Redaktion» oder «Übernommen». Einen Zustand «abgelehnt» gibt es
 * bewusst nicht – was nicht passt, verschwindet still (Leitgedanke 1).
 */
export function ImpulseSubmitCard({ submissions }: { submissions: ImpulseSubmission[] }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ImpulseSubmissionKind>('gedanke')
  const [text, setText] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const uid = profile?.id ?? ''
  const mine = submissions.filter((submission) => submission.uid === uid)

  const submit = async () => {
    if (!profile || busy || !text.trim()) return
    setBusy(true)
    try {
      const outcome = await createImpulseSubmission(
        { uid: profile.id, displayName: profile.displayName },
        { kind, text, sourceLabel, sourceUrl },
      )
      toast.saved('Eingereicht – die Redaktion schaut es an.', outcome)
      setText('')
      setSourceLabel('')
      setSourceUrl('')
      setOpen(false)
    } catch (error) {
      console.error(error)
      toast.error('Die Einreichung konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (submission: ImpulseSubmission) => {
    try {
      const outcome = await deleteImpulseSubmission(submission.id)
      toast.saved('Einreichung zurückgezogen.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    }
  }

  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <Send className="size-4" aria-hidden />
        Mitmach-Ecke
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
          Deine Lieblingsschriftstelle oder eine Quizidee – die Redaktion schaut sie an, und auf
          der Karte steht dann dein Name.
        </p>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Einreichen
        </button>
      </div>

      {mine.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {mine.map((submission) => (
            <li
              key={submission.id}
              className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{submission.text}</span>
                <span className="hint block">
                  {IMPULSE_SUBMISSION_KIND_LABELS[submission.kind]}
                  {' · '}
                  {submission.status === 'accepted' ? (
                    <span className="text-emerald-700 dark:text-emerald-300">übernommen</span>
                  ) : (
                    'bei der Redaktion'
                  )}
                </span>
              </span>
              {submission.status === 'open' && (
                <button
                  type="button"
                  className="btn-ghost shrink-0 p-1.5"
                  onClick={() => void withdraw(submission)}
                  aria-label="Einreichung zurückziehen"
                  title="Einreichung zurückziehen"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Einreichen" size="md">
        <div className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="label">Was bringst du mit?</legend>
            {(Object.keys(IMPULSE_SUBMISSION_KIND_LABELS) as ImpulseSubmissionKind[]).map(
              (value) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition',
                    kind === value
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
                  )}
                >
                  <input
                    type="radio"
                    name="submission-kind"
                    className="size-4"
                    checked={kind === value}
                    onChange={() => setKind(value)}
                  />
                  {value === 'gedanke' ? (
                    <Lightbulb className="size-4 text-slate-400" aria-hidden />
                  ) : (
                    <Search className="size-4 text-slate-400" aria-hidden />
                  )}
                  {IMPULSE_SUBMISSION_KIND_LABELS[value]}
                </label>
              ),
            )}
          </fieldset>

          <div>
            <label className="label" htmlFor="submission-text">
              {kind === 'gedanke' ? 'Dein Vers oder Gedanke' : 'Deine Frage – mit der Lösung'}
            </label>
            <textarea
              id="submission-text"
              className="input min-h-24"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                kind === 'gedanke'
                  ? 'Schreib den Vers oder Gedanken auf, so wie er auf der Karte stehen soll …'
                  : 'Frage, mögliche Antworten und die Lösung – formlos, die Redaktion baut daraus die Quizkarte …'
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="submission-source">
                Quelle (wenn vorhanden)
              </label>
              <input
                id="submission-source"
                className="input"
                value={sourceLabel}
                onChange={(event) => setSourceLabel(event.target.value)}
                placeholder="Alma 37:6 · Generalkonferenz …"
              />
            </div>
            <div>
              <label className="label" htmlFor="submission-source-url">
                Link (optional)
              </label>
              <input
                id="submission-source-url"
                className="input"
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://www.churchofjesuschrist.org/…"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void submit()}
              disabled={busy || !text.trim()}
            >
              <Check className="size-4" aria-hidden />
              Einreichen
            </button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
