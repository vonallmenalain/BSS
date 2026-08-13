import { useState } from 'react'
import { Check, Plus, Send, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createImpulseSubmission, deleteImpulseSubmission } from '@/services/impulse'
import {
  IMPULSE_KIND_LABELS,
  IMPULSE_SUBMISSION_KIND_LABELS,
  type ImpulseKind,
  type ImpulseSubmission,
} from '@/lib/types'

/**
 * Die Mitmach-Ecke: Die AP's liefern selbst – und zwar für jede
 * Kartenart des Bereichs: Impuls, Quizfrage, Bilderrätsel, Wochenziel,
 * Tages-Challenge, Frage der Woche, Feed-Karte oder Teilen-Aufgabe.
 * Eingereicht wird formlos (Freitext plus Quelle); die Redaktion prüft,
 * bringt die Idee im Redaktionsformular in Form – es öffnet gleich in
 * der eingereichten Art – und auf der fertigen Karte steht dann
 * «Eingereicht von …». Wer eine Frage baut, muss die Quelle genau
 * lesen – die lehrreichste Übung von allen, versteckt als Spiel.
 *
 * Zu sehen sind hier nur die **eigenen** Einreichungen samt Stand:
 * «Bei der Redaktion» oder «Übernommen». Einen Zustand «abgelehnt» gibt es
 * bewusst nicht – was nicht passt, verschwindet still (Leitgedanke 1).
 */

/** Die wählbaren Arten – die Feed-Karte zuerst, sie ist die einfachste Tür. */
const SUBMIT_KINDS: ImpulseKind[] = [
  'feed',
  'quiz',
  'bilderraetsel',
  'frage',
  'wochenziel',
  'tageschallenge',
  'teilen',
  'impuls',
]

/** Was das Textfeld je Art erbittet – Anschrift und Beispiel. */
const SUBMIT_PROMPTS: Record<ImpulseKind, { label: string; placeholder: string }> = {
  feed: {
    label: 'Dein Vers, dein Zitat oder dein Gedanke',
    placeholder: 'Schreib ihn auf, so wie er auf der Karte stehen soll …',
  },
  quiz: {
    label: 'Deine Frage – mit der Lösung',
    placeholder:
      'Frage, mögliche Antworten und die Lösung – formlos, die Redaktion baut daraus die Quizkarte …',
  },
  bilderraetsel: {
    label: 'Dein Bilderrätsel – Bild, Frage und Lösung',
    placeholder:
      'Beschreib das Bild (aus der Mediathek der Kirche), die Frage dazu und die Lösung …',
  },
  frage: {
    label: 'Deine Frage der Woche',
    placeholder: 'Eine offene Frage, auf die alle mit ein paar Sätzen antworten können …',
  },
  wochenziel: {
    label: 'Dein Wochenziel',
    placeholder: 'Eine Aufgabe für eine ganze Woche – mit einem Haken abzuhaken …',
  },
  tageschallenge: {
    label: 'Deine Tages-Challenge',
    placeholder: 'Eine kleine Aufgabe, die man jeden Tag der Woche schafft …',
  },
  teilen: {
    label: 'Deine Teilen-Aufgabe',
    placeholder: 'Eine Einladung, etwas mit der Familie oder mit Freunden zu besprechen …',
  },
  impuls: {
    label: 'Dein Wochenthema',
    placeholder: 'Titel und zwei, drei Sätze Hinführung – die Schriftstelle gehört in die Quelle …',
  },
}

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
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ImpulseKind>('feed')
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
      {!plain && (
        <p className="hint flex items-center gap-1.5 font-medium">
          <Send className="size-4" aria-hidden />
          Mitmach-Ecke
        </p>
      )}
      <div className={plain ? 'flex flex-wrap items-center gap-3' : 'mt-2 flex flex-wrap items-center gap-3'}>
        <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
          Deine Idee für jede Art von Karte – Feed, Quiz, Bilderrätsel, Challenge und mehr. Die
          Redaktion schaut sie an, und auf der Karte steht dann dein Name.
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
          <div>
            <label className="label" htmlFor="submission-kind">
              Was bringst du mit?
            </label>
            <select
              id="submission-kind"
              className="input"
              value={kind}
              onChange={(event) => setKind(event.target.value as ImpulseKind)}
            >
              {SUBMIT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {IMPULSE_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="submission-text">
              {SUBMIT_PROMPTS[kind].label}
            </label>
            <textarea
              id="submission-text"
              className="input min-h-24"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={SUBMIT_PROMPTS[kind].placeholder}
            />
            <p className="hint mt-1">
              Formlos genügt – die Redaktion bringt deine Idee in Form, und die Karte trägt deinen
              Namen.
            </p>
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
