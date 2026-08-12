import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Check, Inbox, LayoutList, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNow } from '@/hooks/useNow'
import { useImpulseAnswers, useImpulseItems, useImpulseProgress } from '@/hooks/useFirestore'
import { PageHeader } from '@/components/ui/Pickers'
import { ImpulseCard, QuizCard, SourceLink } from '@/components/impulse/ImpulseCards'
import { ImpulseFeed } from '@/components/impulse/ImpulseFeed'
import {
  ChallengeCard,
  GoalCard,
  GroupCard,
  StreakCard,
} from '@/components/impulse/ImpulseProgressCards'
import {
  computeStreak,
  earnedImpulseBadges,
  formatWeekRange,
  impulseAnswerId,
  impulseWeekKey,
  itemsForWeek,
  participatedWeeks,
  visibleImpulseItems,
  weekParticipants,
} from '@/lib/impulse'
import type { ImpulseAnswer, ImpulseItem, ImpulseWeekProgress } from '@/lib/types'

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
  const progressState = useImpulseProgress()

  const todayKey = impulseWeekKey(now)
  const visible = visibleImpulseItems(itemsState.data, todayKey)
  const thisWeekAll = itemsForWeek(visible, todayKey)
  /* Die Feed-Karten erscheinen nicht einzeln, sondern hinter ihrem
     Einstieg – der Feed ist ein eigener Raum, keine Kartenreihe. */
  const feedCards = thisWeekAll.filter((entry) => entry.kind === 'feed')
  const thisWeek = thisWeekAll.filter((entry) => entry.kind !== 'feed')
  const [feedOpen, setFeedOpen] = useState(false)

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

  /*
   * Serie, Abzeichen und Gruppenleiste – alles beim Lesen gerechnet, aus
   * dem eigenen Fortschritt und den Antworten. Die Zuordnung Antwort →
   * Woche läuft über den Inhalt; Antworten auf Gelöschtes fallen still
   * heraus. Bewusst ohne manuelles Memoisieren: Bei Kollegiumsgrösse
   * kostet die Rechnung nichts, und den Rest erledigt der Compiler.
   */
  const myProgress = progressState.byUid.get(uid) ?? null
  const itemsById = new Map(itemsState.data.map((item) => [item.id, item]))
  const weekOfItem = (itemId: string) => itemsById.get(itemId)?.week ?? null
  const myAnswers = answersState.data.filter((answer) => answer.uid === uid)
  const participated = participatedWeeks(myProgress, myAnswers, weekOfItem)
  const streak = computeStreak(participated, todayKey)
  const badges = earnedImpulseBadges({
    participated,
    bestStreak: streak.best,
    quizAnswers: myAnswers.length,
    weeks: myProgress?.weeks,
  })
  const participants = weekParticipants(
    progressState.data,
    answersState.data,
    weekOfItem,
    todayKey,
  )
  // Der Nenner der Gruppenleiste: alle, die je mitgemacht haben.
  const total = new Set([
    ...progressState.data.map((progress) => progress.uid),
    ...answersState.data.map((answer) => answer.uid),
  ]).size

  const myWeek = (week: string): ImpulseWeekProgress => myProgress?.weeks?.[week] ?? {}

  /* Die Favoritensammlung – in der Reihenfolge des Merkens. */
  const favoriteItems = (myProgress?.favorites ?? [])
    .map((itemId) => itemsById.get(itemId))
    .filter((entry): entry is ImpulseItem => Boolean(entry))

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
        {thisWeekAll.length === 0 ? (
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
          thisWeek.map((item) => {
            switch (item.kind) {
              case 'quiz':
                return <QuizCard key={item.id} item={item} answer={answerFor(item)} />
              case 'wochenziel':
                return (
                  <GoalCard
                    key={item.id}
                    item={item}
                    week={todayKey}
                    done={myWeek(todayKey).goal === true}
                  />
                )
              case 'tageschallenge':
                return (
                  <ChallengeCard
                    key={item.id}
                    item={item}
                    week={todayKey}
                    days={myWeek(todayKey).days ?? []}
                  />
                )
              default:
                return <ImpulseCard key={item.id} item={item} />
            }
          })
        )}

        {/* Der Einstieg in den Feed – kurz und endlich. */}
        {feedCards.length > 0 && (
          <section className="card p-5">
            <p className="hint flex items-center gap-1.5 font-medium">
              <LayoutList className="size-4" aria-hidden />
              Impuls-Feed
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
                {feedCards.length} {feedCards.length === 1 ? 'Karte' : 'Karten'} für diese Woche
                – dann ist Schluss.
                {myWeek(todayKey).feed === true && ' Durchgetippt – stark!'}
              </p>
              <button type="button" className="btn-primary" onClick={() => setFeedOpen(true)}>
                {myWeek(todayKey).feed === true ? 'Nochmals ansehen' : 'Durchtippen'}
              </button>
            </div>
          </section>
        )}

        {/* Serie und Gruppenleiste – unter der Woche, wie im Konzept. */}
        {!itemsState.loading && (
          <>
            <StreakCard current={streak.current} best={streak.best} badges={badges} />
            <GroupCard participants={participants} total={total} />
          </>
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
                  {itemsForWeek(visible, week).map((item) => {
                    switch (item.kind) {
                      case 'quiz':
                        return <PastQuiz key={item.id} item={item} answer={answerFor(item)} />
                      case 'wochenziel':
                        return (
                          <PastTask
                            key={item.id}
                            item={item}
                            label="Wochenziel"
                            note={myWeek(week).goal === true ? 'geschafft' : null}
                          />
                        )
                      case 'tageschallenge': {
                        const count = Math.min((myWeek(week).days ?? []).length, 7)
                        return (
                          <PastTask
                            key={item.id}
                            item={item}
                            label="Tages-Challenge"
                            note={count > 0 ? `${count} von 7 Tagen` : null}
                          />
                        )
                      }
                      case 'feed':
                        return <PastFeed key={item.id} item={item} />
                      default:
                        return <PastImpulse key={item.id} item={item} />
                    }
                  })}
                </section>
              ))}
            </div>
          </section>
        )}

        {/* Die eigene Favoritensammlung – was beim Durchtippen ein
            «Merken» bekommen hat, bleibt hier greifbar. */}
        {favoriteItems.length > 0 && (
          <section>
            <h2 className="mt-6 mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Bookmark className="size-4" aria-hidden />
              Gemerkt
            </h2>
            <section className="card space-y-4 p-5">
              {favoriteItems.map((item) => (
                <PastImpulse key={item.id} item={item} />
              ))}
            </section>
          </section>
        )}
      </div>

      {feedOpen && (
        <ImpulseFeed
          week={todayKey}
          cards={feedCards}
          progressDocs={progressState.data}
          feedDone={myWeek(todayKey).feed === true}
          onClose={() => setFeedOpen(false)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Frühere Wochen                                                      */
/* ------------------------------------------------------------------ */

/**
 * Wochenziel oder Tages-Challenge aus einer früheren Woche.
 *
 * Gezeigt wird, was war – und beim eigenen Stand nur das Erreichte: Ein
 * leerer Vermerk mahnt nicht, er fehlt einfach (Leitgedanke 1).
 */
function PastTask({
  item,
  label,
  note,
}: {
  item: ImpulseItem
  label: string
  note: string | null
}) {
  return (
    <div>
      <p className="text-sm font-medium">{item.title}</p>
      <p className="hint mt-0.5">
        {label}
        {note && (
          <>
            {' · '}
            <Check
              className="inline size-3.5 text-emerald-600 dark:text-emerald-300"
              aria-hidden
            />{' '}
            {note}
          </>
        )}
      </p>
    </div>
  )
}

/** Eine Feed-Karte aus einer früheren Woche – nur Titel und Herkunft. */
function PastFeed({ item }: { item: ImpulseItem }) {
  return (
    <div>
      <p className="text-sm">{item.title}</p>
      <p className="hint mt-0.5">
        Feed-Karte
        {item.source?.label && ` · ${item.source.label}`}
      </p>
    </div>
  )
}

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
