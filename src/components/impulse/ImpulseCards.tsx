import { useState, type FormEvent } from 'react'
import { Check, Lightbulb, Link2, RotateCcw, Search, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { answerImpulseQuiz } from '@/services/impulse'
import type { ImpulseAnswer, ImpulseItem } from '@/lib/types'

/*
 * Die Karten des Bereichs «Impuls» – Wochenimpuls und Quizfrage.
 *
 * Sie stehen hier und nicht in der Seite, weil zwei Orte sie zeichnen:
 * der Bereich selbst und die Wochen-Vorschau der Redaktion. Beide sollen
 * pixelgleich aussehen – eine Vorschau, die anders aussieht als das
 * Original, wäre keine.
 */

/** «Eingereicht von Luca» – die Ehre der Mitmach-Ecke, still und klein. */
export function ContributorLine({ item }: { item: ImpulseItem }) {
  if (!item.contributor) return null
  return <p className="hint mt-1">Eingereicht von {item.contributor}</p>
}

/** Die Quellenangabe – kurzer Auszug in der App, der Rest hinter dem Link. */
export function SourceLink({ item }: { item: ImpulseItem }) {
  const source = item.source
  if (!source?.label) return null
  if (!source.url) {
    return <p className="hint">Quelle: {source.label}</p>
  }
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
    >
      <Link2 className="size-4" aria-hidden />
      {source.label}
    </a>
  )
}

/** Der Wochenimpuls: eine Schriftstelle oder ein Gedanke, mit Quelle. */
export function ImpulseCard({ item }: { item: ImpulseItem }) {
  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <Lightbulb className="size-4" aria-hidden />
        Wochenimpuls
      </p>
      <h2 className="mt-2 text-lg font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      <div className="mt-3">
        <SourceLink item={item} />
        <ContributorLine item={item} />
      </div>
    </section>
  )
}

/**
 * Die Quizfrage der Woche.
 *
 * Erst wählen bzw. tippen, dann «Antworten» – ein Versuch, darum kein
 * Antworten mit einem einzigen Tippen. Nach der Antwort kommt sofort die
 * Auflösung: Sie ist der Lernmoment, mit Erklärung und Quelle. Gewertet
 * wird die Teilnahme, nicht die Richtigkeit.
 *
 * Im Vorschau-Modus (`preview`) wird nichts gespeichert: Die Antwort lebt
 * nur im Fenster, die Auflösung rechnet lokal, und ein Knopf setzt alles
 * zurück – so lässt sich eine Frage durchspielen, ohne eine echte Antwort
 * zu hinterlassen.
 */
export function QuizCard({
  item,
  answer,
  preview = false,
}: {
  item: ImpulseItem
  answer: ImpulseAnswer | null
  preview?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [choice, setChoice] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewAnswer, setPreviewAnswer] = useState<ImpulseAnswer | null>(null)

  const quiz = item.quiz
  if (!quiz) return null

  const shown = preview ? previewAnswer : answer

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (quiz.form === 'choice' && choice === null) return
    if (quiz.form === 'text' && !text.trim()) return

    if (preview) {
      setPreviewAnswer({
        id: 'vorschau',
        itemId: item.id,
        uid: 'vorschau',
        firstName: 'Vorschau',
        choiceIndex: quiz.form === 'choice' ? choice : null,
        text: text.trim(),
        correct: quiz.form === 'choice' ? choice === quiz.answerIndex : null,
      })
      return
    }

    if (!profile || busy) return
    setBusy(true)
    try {
      const outcome = await answerImpulseQuiz(
        item,
        { uid: profile.id, displayName: profile.displayName },
        quiz.form === 'choice' ? { choiceIndex: choice ?? 0 } : { text },
      )
      toast.saved('Antwort festgehalten.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Die Antwort konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPreviewAnswer(null)
    setChoice(null)
    setText('')
  }

  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <Search className="size-4" aria-hidden />
        Quizfrage der Woche
      </p>
      <h2 className="mt-2 text-lg font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      <ContributorLine item={item} />

      {shown ? (
        <>
          <QuizResolution item={item} answer={shown} />
          {preview && (
            <button type="button" className="btn-ghost btn-sm mt-3" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden />
              Vorschau zurücksetzen
            </button>
          )}
        </>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
          {quiz.form === 'choice' ? (
            <div className="space-y-1.5" role="radiogroup" aria-label="Antworten">
              {quiz.options.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  role="radio"
                  aria-checked={choice === index}
                  onClick={() => setChoice(index)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border p-3 text-left text-sm transition',
                    choice === index
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded-full border',
                      choice === index
                        ? 'border-brand-600 bg-brand-600'
                        : 'border-slate-300 dark:border-slate-600',
                    )}
                    aria-hidden
                  >
                    {choice === index && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <label className="label" htmlFor={`quiz-${item.id}${preview ? '-vorschau' : ''}`}>
                Deine Antwort
              </label>
              <input
                id={`quiz-${item.id}${preview ? '-vorschau' : ''}`}
                className="input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Die Antwort steht in der Quelle …"
                autoComplete="off"
              />
            </div>
          )}

          {/* Die Quelle steht schon vor dem Antworten da – bei der
              Suchfrage ist der Weg dorthin die eigentliche Aufgabe. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SourceLink item={item} />
            <button
              type="submit"
              className="btn-primary ms-auto"
              disabled={
                busy || (quiz.form === 'choice' ? choice === null : text.trim().length === 0)
              }
            >
              <Check className="size-4" aria-hidden />
              Antworten
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

/** Die Auflösung – der Lernmoment nach der Antwort. */
export function QuizResolution({ item, answer }: { item: ImpulseItem; answer: ImpulseAnswer }) {
  const quiz = item.quiz
  if (!quiz) return null

  return (
    <div className="mt-4 space-y-3">
      {quiz.form === 'choice' ? (
        <>
          <p
            className={cn(
              'text-sm font-medium',
              answer.correct
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-600 dark:text-slate-300',
            )}
          >
            {answer.correct
              ? 'Richtig beantwortet – stark!'
              : 'Gut versucht – die richtige Antwort ist markiert.'}
          </p>
          <div className="space-y-1.5">
            {quiz.options.map((option, index) => {
              const isSolution = index === quiz.answerIndex
              const isChosen = index === (answer.choiceIndex ?? -1)
              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border p-3 text-sm',
                    isSolution
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                      : isChosen
                        ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                        : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400',
                  )}
                >
                  {isSolution ? (
                    <Check
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                      aria-hidden
                    />
                  ) : isChosen ? (
                    <X className="size-4 shrink-0 text-rose-500" aria-hidden />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden />
                  )}
                  {option}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Deine Antwort: <span className="font-medium">{answer.text || '–'}</span>
          </p>
          <p>
            Lösung:{' '}
            <span className="font-medium text-emerald-700 dark:text-emerald-300">
              {quiz.answerText}
            </span>
          </p>
        </div>
      )}

      {quiz.explanation && (
        <p className="text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {quiz.explanation}
        </p>
      )}
      <SourceLink item={item} />
    </div>
  )
}
