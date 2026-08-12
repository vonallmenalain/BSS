import { Link } from 'react-router-dom'
import { Inbox, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNow } from '@/hooks/useNow'
import { useImpulseAnswers, useImpulseItems } from '@/hooks/useFirestore'
import { PageHeader } from '@/components/ui/Pickers'
import { ImpulseCard, QuizCard, SourceLink } from '@/components/impulse/ImpulseCards'
import {
  formatWeekRange,
  impulseAnswerId,
  impulseWeekKey,
  itemsForWeek,
  visibleImpulseItems,
} from '@/lib/impulse'
import type { ImpulseAnswer, ImpulseItem } from '@/lib/types'

/**
 * «Impuls» – der geistige Bereich für die AP's (docs/KONZEPT-IMPULS.md).
 *
 * Die Seite zeigt die laufende Woche: den Wochenimpuls und die Quizfrage,
 * darunter die früheren Wochen mit ihren Auflösungen. Veröffentlicht wird
 * durch den Kalender – ein Inhalt erscheint, sobald seine Woche beginnt
 * (`visibleImpulseItems`); geplant und erfasst wird in der Redaktion.
 *
 * Für die Redaktion sieht die Seite gleich aus wie für die AP's – einzig
 * der Knopf «Redaktion» kommt dazu. Wie eine künftige Woche aussehen wird,
 * zeigt die Vorschau in der Redaktion.
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
/* Frühere Wochen                                                      */
/* ------------------------------------------------------------------ */

/** Ein Impuls aus einer früheren Woche – kompakt, mit Quelle. */
function PastImpulse({ item }: { item: ImpulseItem }) {
  return (
    <div>
      <p className="text-sm font-medium">{item.title}</p>
      {item.body && <p className="hint mt-0.5 whitespace-pre-line">{item.body}</p>}
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
