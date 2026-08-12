import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Inbox, Lightbulb, Link2, Pencil, Search, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNow } from '@/hooks/useNow'
import { useImpulseAnswers, useImpulseItems } from '@/hooks/useFirestore'
import { PageHeader } from '@/components/ui/Pickers'
import { cn } from '@/lib/utils'
import {
  formatWeekRange,
  impulseAnswerId,
  impulseWeekKey,
  itemsForWeek,
  visibleImpulseItems,
} from '@/lib/impulse'
import { answerImpulseQuiz } from '@/services/impulse'
import type { ImpulseAnswer, ImpulseItem } from '@/lib/types'

/**
 * «Impuls» – der geistige Bereich für die AP's (docs/KONZEPT-IMPULS.md).
 *
 * Die Seite zeigt die laufende Woche: den Wochenimpuls und die Quizfrage,
 * darunter die früheren Wochen mit ihren Auflösungen. Veröffentlicht wird
 * durch den Kalender – ein Inhalt erscheint, sobald seine Woche beginnt
 * (`visibleImpulseItems`); geplant und erfasst wird in der Redaktion.
 */
export function Impuls() {
  const { profile, canEditImpulse } = useAuth()
  const now = useNow()
  const itemsState = useImpulseItems()
  const answersState = useImpulseAnswers()

  const todayKey = impulseWeekKey(now)
  const visible = visibleImpulseItems(itemsState.data, todayKey)
  const thisWeek = itemsForWeek(visible, todayKey)

  /*
   * Frühere Wochen, jüngste zuerst. Der Bestand kommt bereits nach Woche
   * absteigend sortiert – das Set behält diese Reihenfolge.
   */
  const pastWeeks = [
    ...new Set(
      visible
        .filter((item) => item.week !== todayKey)
        .map((item) => item.week)
        .filter((week): week is string => typeof week === 'string'),
    ),
  ]

  const uid = profile?.id ?? ''
  const answerFor = (item: ImpulseItem): ImpulseAnswer | null =>
    answersState.byId.get(impulseAnswerId(item.id, uid)) ?? null

  return (
    <>
      <PageHeader
        title="Impuls"
        subtitle={formatWeekRange(todayKey)}
        actions={
          canEditImpulse ? (
            <Link to="/impuls/redaktion" className="btn-secondary">
              <Pencil className="size-4" aria-hidden />
              <span className="hidden sm:inline">Redaktion</span>
              <span className="sr-only sm:hidden">Redaktion</span>
            </Link>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-2xl space-y-4">
        {thisWeek.length === 0 ? (
          <section className="card p-5">
            <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
              <Inbox className="size-6 text-slate-400" aria-hidden />
              <p className="mt-2 text-sm font-medium">
                {itemsState.loading ? 'Wird geladen …' : 'Diese Woche ist noch nichts aufgeschaltet'}
              </p>
              {!itemsState.loading && (
                <p className="hint mt-1 max-w-sm">
                  {canEditImpulse
                    ? 'In der Redaktion lässt sich die Woche planen – der Inhalt erscheint hier, sobald er bereit ist.'
                    : 'Schau später wieder vorbei – der nächste Impuls kommt.'}
                </p>
              )}
            </div>
          </section>
        ) : (
          thisWeek.map((item) =>
            item.kind === 'quiz' ? (
              <QuizCard key={item.id} item={item} answer={answerFor(item)} />
            ) : (
              <ImpulseCard key={item.id} item={item} />
            ),
          )
        )}

        {pastWeeks.length > 0 && (
          <section>
            <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Frühere Wochen
            </h2>
            <div className="space-y-4">
              {pastWeeks.map((week) => (
                <section key={week} className="card space-y-4 p-5">
                  <h3 className="hint font-medium">{formatWeekRange(week)}</h3>
                  {itemsForWeek(visible, week).map((item) =>
                    item.kind === 'quiz' ? (
                      <PastQuiz key={item.id} item={item} answer={answerFor(item)} />
                    ) : (
                      <PastImpulse key={item.id} item={item} />
                    ),
                  )}
                </section>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/** Die Quellenangabe – kurzer Auszug in der App, der Rest hinter dem Link. */
function SourceLink({ item }: { item: ImpulseItem }) {
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
function ImpulseCard({ item }: { item: ImpulseItem }) {
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
 */
function QuizCard({ item, answer }: { item: ImpulseItem; answer: ImpulseAnswer | null }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [choice, setChoice] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const quiz = item.quiz
  if (!quiz) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile || busy) return
    if (quiz.form === 'choice' && choice === null) return
    if (quiz.form === 'text' && !text.trim()) return

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

      {answer ? (
        <QuizResolution item={item} answer={answer} />
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
              <label className="label" htmlFor={`quiz-${item.id}`}>
                Deine Antwort
              </label>
              <input
                id={`quiz-${item.id}`}
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
function QuizResolution({ item, answer }: { item: ImpulseItem; answer: ImpulseAnswer }) {
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
                    <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
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

/** Ein Impuls aus einer früheren Woche – kompakt, mit Quelle. */
function PastImpulse({ item }: { item: ImpulseItem }) {
  return (
    <div>
      <p className="text-sm font-medium">{item.title}</p>
      {item.body && (
        <p className="hint mt-0.5 whitespace-pre-line">{item.body}</p>
      )}
      <div className="mt-1">
        <SourceLink item={item} />
      </div>
    </div>
  )
}

/**
 * Eine Quizfrage aus einer früheren Woche.
 *
 * Die Woche ist vorbei, deshalb steht die Lösung offen da – wer geantwortet
 * hat, sieht dazu, wie es ausgegangen ist.
 */
function PastQuiz({ item, answer }: { item: ImpulseItem; answer: ImpulseAnswer | null }) {
  const quiz = item.quiz
  if (!quiz) return null
  const solution = quiz.form === 'choice' ? (quiz.options[quiz.answerIndex] ?? '') : quiz.answerText

  return (
    <div>
      <p className="text-sm font-medium">{item.title}</p>
      <p className="hint mt-0.5">
        Lösung: <span className="font-medium">{solution}</span>
        {answer &&
          (quiz.form === 'choice'
            ? answer.correct
              ? ' · richtig beantwortet'
              : ` · deine Antwort: ${quiz.options[answer.choiceIndex ?? -1] ?? '–'}`
            : ` · deine Antwort: ${answer.text || '–'}`)}
      </p>
      {quiz.explanation && <p className="hint mt-0.5 whitespace-pre-line">{quiz.explanation}</p>}
      <div className="mt-1">
        <SourceLink item={item} />
      </div>
    </div>
  )
}
