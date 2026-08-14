import { useState } from 'react'
import { Check, Plus, Send, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { readyProblems } from '@/lib/impulse'
import { ImpulseItemFields } from '@/components/impulse/ImpulseItemFields'
import {
  createImpulseSubmission,
  deleteImpulseSubmission,
  emptyImpulseItem,
  type ImpulseItemInput,
} from '@/services/impulse'
import { IMPULSE_SUBMISSION_KIND_LABELS, type ImpulseSubmission } from '@/lib/types'

/**
 * Die Mitmach-Ecke: Die AP's liefern selbst – und zwar die fixfertige
 * Karte, im selben Formular, das auch die Redaktion benutzt
 * (`ImpulseItemFields`): Wer die Art wechselt, bekommt die Felder der
 * Art – das Bilderrätsel sein Bild, das Quiz seine Antworten samt
 * Lösung. Wer eine Frage baut, muss die Quelle genau lesen – die
 * lehrreichste Übung von allen, versteckt als Spiel.
 *
 * Veröffentlicht wird trotzdem nie direkt: Die Redaktion prüft,
 * übernimmt die Karte vorbefüllt und plant die Woche – auf der fertigen
 * Karte steht «Eingereicht von …». Halbfertiges ist erlaubt (die Liste
 * unter dem Formular sagt, was der Redaktion noch fehlt); nur der Titel
 * muss stehen.
 *
 * Zu sehen sind hier nur die **eigenen** Einreichungen samt Stand:
 * «Bei der Redaktion» oder «Übernommen». Einen Zustand «abgelehnt» gibt es
 * bewusst nicht – was nicht passt, verschwindet still (Leitgedanke 1).
 */
export function ImpulseSubmitCard({
  submissions,
  plain = false,
}: {
  submissions: ImpulseSubmission[]
  /** Ohne Bereichszeile – im Vollbild steht der Bereich schon im Kopf. */
  plain?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  /* Die Feed-Karte zuerst – sie ist die einfachste Tür. */
  const [input, setInput] = useState<ImpulseItemInput | null>(null)
  const [busy, setBusy] = useState(false)

  const uid = profile?.id ?? ''
  const mine = submissions.filter((submission) => submission.uid === uid)

  /* Was der Karte noch fehlt – als Hinweis, nicht als Sperre: Die
     Redaktion vervollständigt gern, nur der Titel muss stehen. */
  const problems = input
    ? readyProblems({
        kind: input.kind,
        title: input.title,
        source: input.sourceLabel.trim()
          ? { label: input.sourceLabel, url: input.sourceUrl }
          : null,
        quiz: input.kind === 'quiz' || input.kind === 'bilderraetsel' ? input.quiz : null,
        image: input.imageUrl.trim() ? { url: input.imageUrl } : null,
      })
    : []

  const submit = async () => {
    if (!profile || !input || busy || !input.title.trim()) return
    setBusy(true)
    try {
      const outcome = await createImpulseSubmission(
        { uid: profile.id, displayName: profile.displayName },
        input,
      )
      toast.saved('Eingereicht – die Redaktion schaut es an.', outcome)
      setInput(null)
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
      {!plain && (
        <p className="hint flex items-center gap-1.5 font-medium">
          <Send className="size-4" aria-hidden />
          Mitmach-Ecke
        </p>
      )}
      <div className={plain ? 'flex flex-wrap items-center gap-3' : 'mt-2 flex flex-wrap items-center gap-3'}>
        <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
          Baue deine eigene Karte – Feed, Quiz, Bilderrätsel, Challenge und mehr, im selben
          Formular wie die Redaktion. Sie schaut deine Karte an, und auf der fertigen Karte steht
          dein Name.
        </p>
        <button type="button" className="btn-secondary" onClick={() => setInput(emptyImpulseItem('feed', null))}>
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

      {input && (
        <Modal
          open
          onClose={() => setInput(null)}
          title="Karte einreichen"
          description="Dieselben Felder wie in der Redaktion – deine Karte, fixfertig."
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setInput(null)}
                disabled={busy}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submit()}
                disabled={busy || !input.title.trim()}
              >
                <Check className="size-4" aria-hidden />
                Einreichen
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <ImpulseItemFields
              input={input}
              setInput={setInput as React.Dispatch<React.SetStateAction<ImpulseItemInput>>}
              idPrefix="submission"
            />
            {problems.length > 0 && (
              <p className="hint">
                Noch nicht fertig? Kein Problem – einreichen geht trotzdem, die Redaktion
                vervollständigt. Es {problems.length === 1 ? 'fehlt' : 'fehlen'} noch:{' '}
                {problems.map((problem) => problem.replace(/\.$/, '')).join(', ')}.
              </p>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}
