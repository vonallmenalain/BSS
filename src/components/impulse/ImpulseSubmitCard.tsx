import { useState } from 'react'
import { Check, Eye, Pencil, Plus, Send, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNow } from '@/hooks/useNow'
import { impulseWeekKey, readyProblems } from '@/lib/impulse'
import { ImpulseEditorPreview } from '@/components/impulse/ImpulseEditorPreview'
import { ImpulseItemFields } from '@/components/impulse/ImpulseItemFields'
import {
  createImpulseSubmission,
  deleteImpulseSubmission,
  emptyImpulseItem,
  submissionToInput,
  submissionToItem,
  updateImpulseSubmission,
  type ImpulseItemInput,
} from '@/services/impulse'
import { IMPULSE_SUBMISSION_KIND_LABELS, type ImpulseSubmission } from '@/lib/types'

/**
 * Die Mitmach-Ecke: Die AP's liefern selbst – und zwar die fixfertige
 * Karte, im selben Formular, das auch die Bischofschaft benutzt
 * (`ImpulseItemFields`): Wer die Art wechselt, bekommt die Felder der
 * Art – das Bilderrätsel sein Bild, das Quiz seine Antworten samt
 * Lösung. Wer eine Frage baut, muss die Quelle genau lesen – die
 * lehrreichste Übung von allen, versteckt als Spiel.
 *
 * Die eigenen Einreichungen bleiben lebendig: Die **Vorschau** zeigt
 * jede als echte Vollbild-Karte («so wird sie aussehen»), und solange
 * eine Einreichung offen ist, lässt sie sich **bearbeiten** oder
 * zurückziehen. Veröffentlicht wird nie direkt: Die Bischofschaft
 * prüft, plant die Woche – und auf der fertigen Karte steht
 * «Eingereicht von …». Einen Zustand «abgelehnt» gibt es bewusst nicht –
 * was nicht passt, verschwindet still (Leitgedanke 1).
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
  const now = useNow()
  const todayKey = impulseWeekKey(now)

  /* Das Formular – neu (die Feed-Karte zuerst, sie ist die einfachste
     Tür) oder als Nachbesserung einer offenen Einreichung. */
  const [editor, setEditor] = useState<{ id: string | null; input: ImpulseItemInput } | null>(null)
  const [busy, setBusy] = useState(false)
  /* Die eigene Karte in der echten Vorschau – nichts wird gespeichert. */
  const [preview, setPreview] = useState<ImpulseSubmission | null>(null)

  const uid = profile?.id ?? ''
  const mine = submissions.filter((submission) => submission.uid === uid)

  /* Was der Karte noch fehlt – als Hinweis, nicht als Sperre: Die
     Bischofschaft vervollständigt gern, nur der Titel muss stehen. */
  const problems = editor
    ? readyProblems({
        kind: editor.input.kind,
        title: editor.input.title,
        source: editor.input.sourceLabel.trim()
          ? { label: editor.input.sourceLabel, url: editor.input.sourceUrl }
          : null,
        quiz:
          editor.input.kind === 'quiz' || editor.input.kind === 'bilderraetsel'
            ? editor.input.quiz
            : null,
        image: editor.input.imageUrl.trim() ? { url: editor.input.imageUrl } : null,
      })
    : []

  const setInput: React.Dispatch<React.SetStateAction<ImpulseItemInput>> = (action) =>
    setEditor((value) =>
      value
        ? { ...value, input: typeof action === 'function' ? action(value.input) : action }
        : value,
    )

  const submit = async () => {
    if (!profile || !editor || busy || !editor.input.title.trim()) return
    setBusy(true)
    try {
      const outcome = editor.id
        ? await updateImpulseSubmission(editor.id, editor.input)
        : await createImpulseSubmission(
            { uid: profile.id, displayName: profile.displayName },
            editor.input,
          )
      toast.saved(
        editor.id
          ? 'Deine Karte ist aktualisiert.'
          : 'Eingereicht – die Bischofschaft schaut es an.',
        outcome,
      )
      setEditor(null)
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
          Baue deine eigene Karte. Die Bischofschaft schaltet sie für alle auf – mit deinem Namen
          darauf.
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setEditor({ id: null, input: emptyImpulseItem('feed', null) })}
        >
          <Plus className="size-4" aria-hidden />
          Einreichen
        </button>
      </div>

      {mine.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {mine.map((submission) => (
            <li
              key={submission.id}
              className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
            >
              <span className="block truncate text-sm">{submission.text}</span>
              <span className="hint block">
                {IMPULSE_SUBMISSION_KIND_LABELS[submission.kind]}
                {' · '}
                {submission.status === 'accepted' ? (
                  <span className="text-emerald-700 dark:text-emerald-300">übernommen</span>
                ) : (
                  'bei der Bischofschaft'
                )}
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setPreview(submission)}
                  title="So wird deine Karte aussehen"
                >
                  <Eye className="size-4" aria-hidden />
                  Vorschau
                </button>
                {submission.status === 'open' && (
                  <>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() =>
                        setEditor({ id: submission.id, input: submissionToInput(submission) })
                      }
                    >
                      <Pencil className="size-4" aria-hidden />
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                      onClick={() => void withdraw(submission)}
                    >
                      <X className="size-4" aria-hidden />
                      Zurückziehen
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <Modal
          open
          onClose={() => setEditor(null)}
          title={editor.id ? 'Deine Karte bearbeiten' : 'Karte einreichen'}
          description="So, wie sie nachher für alle aussieht."
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditor(null)}
                disabled={busy}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submit()}
                disabled={busy || !editor.input.title.trim()}
              >
                <Check className="size-4" aria-hidden />
                {editor.id ? 'Speichern' : 'Einreichen'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <ImpulseItemFields input={editor.input} setInput={setInput} idPrefix="submission" />
            {problems.length > 0 && (
              <p className="hint">{problems.join(' ')} Einreichen geht trotzdem.</p>
            )}
          </div>
        </Modal>
      )}

      {preview && (
        <ImpulseEditorPreview
          week={todayKey}
          items={[submissionToItem(preview)]}
          label="Deine Karte"
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  )
}
