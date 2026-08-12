import { useEffect } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Bookmark, Check, ChevronRight, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNow } from '@/hooks/useNow'
import {
  useImpulseAnswers,
  useImpulseComments,
  useImpulseItems,
  useImpulseProgress,
  useImpulseSubmissions,
} from '@/hooks/useFirestore'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/Pickers'
import { ContributorLine, QuizCard, SourceLink } from '@/components/impulse/ImpulseCards'
import { ChallengeCard, GoalCard } from '@/components/impulse/ImpulseProgressCards'
import { ImpulseQuestionCard } from '@/components/impulse/ImpulseQuestionCard'
import { ImpulseSubmitCard } from '@/components/impulse/ImpulseSubmitCard'
import { ImpulseFeed } from '@/components/impulse/ImpulseFeed'
import { ImpulseDashboard } from '@/components/impulse/ImpulseDashboard'
import { ImpulseScreen, type ScreenOrigin } from '@/components/impulse/ImpulseScreen'
import { ImpulseStats } from '@/components/impulse/ImpulseStats'
import { setImpulseLastSeenWeek } from '@/services/impulse'
import {
  IMPULSE_BADGES,
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
import {
  IMPULSE_SECTIONS,
  IMPULSE_SECTION_ORDER,
  isImpulseSection,
  sectionForItem,
  type ImpulseSectionKey,
} from '@/lib/impulseSections'
import { recordImpulseOpen, trackImpulseTime } from '@/lib/impulseUsage'
import {
  IMPULSE_KIND_LABELS,
  type ImpulseAnswer,
  type ImpulseItem,
  type ImpulseKind,
  type ImpulseWeekProgress,
} from '@/lib/types'

/**
 * «Impuls» – der geistige Bereich für die AP's (docs/KONZEPT-IMPULS.md).
 *
 * Der Einstieg ist ein **Dashboard**: eine Kachel pro Bereich, jede in
 * ihrer Farbe, jede mit dem eigenen Stand. Ein Tipp öffnet den Bereich
 * im **Vollbild** (`/impuls/:bereich`) – die Form, die der Feed
 * vorgemacht hat: ein Raum, eine Sache, volle Aufmerksamkeit. Unten im
 * Raum liegt der Wechsler zu den anderen Bereichen und zurück zum
 * AP-Kalender; der Zurück-Pfeil (und die Zurück-Geste des Geräts, denn
 * der Bereich ist eine echte Route) führt zur Übersicht.
 *
 * Veröffentlicht wird weiterhin durch den Kalender – ein Inhalt
 * erscheint, sobald seine Woche beginnt (`visibleImpulseItems`);
 * geplant und erfasst wird in der Redaktion. Für die Redaktion sieht
 * die Seite gleich aus wie für die AP's – einzig der Knopf «Redaktion»
 * kommt dazu.
 */

/** Was eine Navigation dem Ziel mitgibt – alles davon ist optional. */
interface ImpulsLocationState {
  /** Der Klickpunkt der Kachel – dort beginnt der Vollbild-Übergang. */
  origin?: ScreenOrigin
  /** Der Feed einer bestimmten Woche – der Weg aus «Gemerkt». */
  feedWeek?: string
  /** … und dort gleich bei dieser Karte einsteigen. */
  feedItem?: string
}

export function Impuls() {
  const { profile, canEditImpulse, canViewAp } = useAuth()
  const now = useNow()
  const navigate = useNavigate()
  const location = useLocation()
  const { bereich } = useParams()
  const itemsState = useImpulseItems()
  const answersState = useImpulseAnswers()
  const progressState = useImpulseProgress()
  const commentsState = useImpulseComments()
  const submissionsState = useImpulseSubmissions()

  const sectionKey: ImpulseSectionKey | null = isImpulseSection(bereich) ? bereich : null
  const state = (location.state ?? null) as ImpulsLocationState | null

  const todayKey = impulseWeekKey(now)
  const visible = visibleImpulseItems(itemsState.data, todayKey)
  const thisWeekAll = itemsForWeek(visible, todayKey)
  const feedCards = thisWeekAll.filter((entry) => entry.kind === 'feed')
  const thisWeek = thisWeekAll.filter((entry) => entry.kind !== 'feed')
  const ofKind = (kind: ImpulseKind) => thisWeek.filter((item) => item.kind === kind)
  const impulsItems = ofKind('impuls')
  const quizItems = ofKind('quiz')
  const goalItems = ofKind('wochenziel')
  const challengeItems = ofKind('tageschallenge')
  const frageItems = ofKind('frage')

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
  const myComments = commentsState.data.filter((comment) => comment.uid === uid)
  // Antworten und Beiträge zählen gleichermassen als Beteiligung.
  const participated = participatedWeeks(myProgress, [...myAnswers, ...myComments], weekOfItem)
  const streak = computeStreak(participated, todayKey)
  const badges = earnedImpulseBadges({
    participated,
    bestStreak: streak.best,
    quizAnswers: myAnswers.length,
    comments: myComments.length,
    weeks: myProgress?.weeks,
  })
  const participants = weekParticipants(
    progressState.data,
    [...answersState.data, ...commentsState.data],
    weekOfItem,
    todayKey,
  )
  // Der Nenner der Gruppenleiste: alle, die je mitgemacht haben.
  const total = new Set([
    ...progressState.data.map((progress) => progress.uid),
    ...answersState.data.map((answer) => answer.uid),
    ...commentsState.data.map((comment) => comment.uid),
  ]).size

  const myWeek = (week: string): ImpulseWeekProgress => myProgress?.weeks?.[week] ?? {}

  /* Die Favoritensammlung – in der Reihenfolge des Merkens. */
  const favoriteItems = (myProgress?.favorites ?? [])
    .map((itemId) => itemsById.get(itemId))
    .filter((entry): entry is ImpulseItem => Boolean(entry))

  /*
   * Der erste Blick auf eine Woche mit Inhalt nimmt den stillen Punkt aus
   * der Navigation. Vermerkt wird erst, wenn der Bestand geladen ist und
   * wirklich etwas dasteht – ein leerer Montag ist nichts Neues.
   */
  const seenPending =
    Boolean(profile) &&
    !itemsState.loading &&
    thisWeekAll.length > 0 &&
    myProgress?.lastSeenWeek !== todayKey
  useEffect(() => {
    if (!seenPending || !profile) return
    setImpulseLastSeenWeek(
      { uid: profile.id, displayName: profile.displayName },
      todayKey,
    ).catch((error) => console.error('[impuls] Woche konnte nicht vermerkt werden:', error))
  }, [seenPending, profile, todayKey])

  /*
   * Die stille Statistik: Zeit und Besuche, nur auf diesem Gerät
   * (`lib/impulseUsage`). Die Uhr läuft, solange die Seite offen ist;
   * ein Strich fällt bei jedem Bereichswechsel.
   */
  useEffect(() => {
    if (!uid) return
    return trackImpulseTime(uid)
  }, [uid])
  useEffect(() => {
    if (!uid) return
    recordImpulseOpen(uid, sectionKey ?? 'uebersicht')
  }, [uid, sectionKey])

  /* ---------------- Navigation zwischen den Räumen ---------------- */

  /** Von der Kachel in den Raum – ein Schritt in der Chronik. */
  const openSection = (key: ImpulseSectionKey, origin?: ScreenOrigin) =>
    navigate(`/impuls/${key}`, { state: origin ? { origin } : undefined })

  /** Von Raum zu Raum – ersetzt den Schritt, Zurück führt zur Übersicht. */
  const switchSection = (key: ImpulseSectionKey) =>
    navigate(`/impuls/${key}`, { replace: true })

  /**
   * Zurück zur Übersicht: der Schritt zurück in der Chronik, damit die
   * Zurück-Geste und der Pfeil dasselbe tun. Wer den Raum direkt
   * aufgeschlagen hat (Lesezeichen), hat keinen Schritt – dann ersetzt
   * die Übersicht den Eintrag.
   */
  const closeSection = () => {
    if (location.key === 'default') navigate('/impuls', { replace: true })
    else navigate(-1)
  }

  /** Aus «Gemerkt» zurück in den Bereich, in dem die Karte lebt. */
  const openFavorite = (item: ImpulseItem) => {
    const key = sectionForItem(item, todayKey)
    if (key === 'feed') {
      navigate('/impuls/feed', {
        replace: true,
        state: { feedWeek: item.week ?? todayKey, feedItem: item.id },
      })
    } else {
      navigate(`/impuls/${key}`, { replace: true })
    }
  }

  /* Welche Räume der Wechsler anbietet – nur, was es diese Woche gibt. */
  const availableSections = IMPULSE_SECTION_ORDER.filter((key) => {
    switch (key) {
      case 'woche':
        return impulsItems.length > 0
      case 'quiz':
        return quizItems.length > 0
      case 'ziel':
        return goalItems.length > 0
      case 'challenge':
        return challengeItems.length > 0
      case 'frage':
        return frageItems.length > 0
      case 'feed':
        return feedCards.length > 0
      case 'gemerkt':
        return favoriteItems.length > 0
      case 'wochen':
        return pastWeeks.length > 0
      default:
        return true
    }
  })

  /* Ein unbekannter Routenteil führt still zur Übersicht zurück. */
  if (bereich && !sectionKey) return <Navigate to="/impuls" replace />

  /* Der Feed einer bestimmten Woche – normal die laufende. */
  const feedWeek = state?.feedWeek ?? todayKey
  const feedWeekCards =
    feedWeek === todayKey
      ? feedCards
      : itemsForWeek(visible, feedWeek).filter((item) => item.kind === 'feed')

  /* ---------------- Die Inhalte der Räume ---------------- */

  const sectionContent = (key: Exclude<ImpulseSectionKey, 'feed'>) => {
    switch (key) {
      case 'woche':
        return impulsItems.length > 0 ? (
          <div className="space-y-4">
            {impulsItems.map((item) => (
              <article key={item.id} className="card p-6 text-center sm:p-8">
                {item.week && <p className="hint">{formatWeekRange(item.week)}</p>}
                <h2 className="mt-2 text-2xl leading-snug font-semibold text-balance">
                  {item.title}
                </h2>
                {item.body && (
                  <p className="mt-3 whitespace-pre-line text-slate-600 dark:text-slate-300">
                    {item.body}
                  </p>
                )}
                <div className="mt-5 flex flex-col items-center gap-1">
                  <SourceLink item={item} />
                  <ContributorLine item={item} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyScreenNote
            text={
              itemsState.loading ? 'Wird geladen …' : 'Diese Woche gibt es keinen Wochenimpuls.'
            }
          />
        )
      case 'quiz':
        return quizItems.length > 0 ? (
          <div className="space-y-4">
            {quizItems.map((item) => (
              <QuizCard key={item.id} item={item} answer={answerFor(item)} plain />
            ))}
          </div>
        ) : (
          <EmptyScreenNote text="Diese Woche gibt es keine Quizfrage." />
        )
      case 'ziel':
        return goalItems.length > 0 ? (
          <div className="space-y-4">
            {goalItems.map((item) => (
              <GoalCard
                key={item.id}
                item={item}
                week={todayKey}
                done={myWeek(todayKey).goal === true}
                plain
              />
            ))}
          </div>
        ) : (
          <EmptyScreenNote text="Diese Woche gibt es kein Wochenziel." />
        )
      case 'challenge':
        return challengeItems.length > 0 ? (
          <div className="space-y-4">
            {challengeItems.map((item) => (
              <ChallengeCard
                key={item.id}
                item={item}
                week={todayKey}
                days={myWeek(todayKey).days ?? []}
                plain
              />
            ))}
          </div>
        ) : (
          <EmptyScreenNote text="Diese Woche gibt es keine Tages-Challenge." />
        )
      case 'frage':
        return frageItems.length > 0 ? (
          <div className="space-y-4">
            {frageItems.map((item) => (
              <ImpulseQuestionCard
                key={item.id}
                item={item}
                comments={commentsState.data.filter((comment) => comment.itemId === item.id)}
                progressDocs={progressState.data}
                plain
              />
            ))}
          </div>
        ) : (
          <EmptyScreenNote text="Diese Woche gibt es keine Frage der Woche." />
        )
      case 'fortschritt':
        return (
          <ImpulseStats
            uid={uid}
            todayKey={todayKey}
            streak={streak}
            participated={participated}
            progress={myProgress}
            answers={myAnswers}
            commentsCount={myComments.length}
            favoritesCount={favoriteItems.length}
            badges={badges}
          />
        )
      case 'gemerkt':
        return <GemerktList items={favoriteItems} onOpen={openFavorite} />
      case 'wochen':
        return pastWeeks.length > 0 ? (
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
                    case 'frage': {
                      const count = commentsState.data.filter(
                        (comment) => comment.itemId === item.id && !comment.hidden,
                      ).length
                      return (
                        <PastTask
                          key={item.id}
                          item={item}
                          label={`Frage der Woche · ${count} ${count === 1 ? 'Antwort' : 'Antworten'}`}
                          note={
                            myComments.some((comment) => comment.itemId === item.id)
                              ? 'mitgeredet'
                              : null
                          }
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
        ) : (
          <EmptyScreenNote text="Noch keine früheren Wochen – alles beginnt mit dieser." />
        )
      case 'mitmachen':
        return <ImpulseSubmitCard submissions={submissionsState.data} plain />
    }
  }

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

      <div className="mx-auto max-w-2xl">
        <ImpulseDashboard
          model={{
            loading: itemsState.loading,
            hero: impulsItems[0] ?? null,
            quiz: quizItems[0]
              ? { item: quizItems[0], answered: Boolean(answerFor(quizItems[0])) }
              : null,
            goal: goalItems[0]
              ? { item: goalItems[0], done: myWeek(todayKey).goal === true }
              : null,
            challenge: challengeItems[0]
              ? {
                  item: challengeItems[0],
                  done: Math.min((myWeek(todayKey).days ?? []).length, 7),
                }
              : null,
            frage: frageItems[0]
              ? {
                  item: frageItems[0],
                  mine: myComments.some((comment) => comment.itemId === frageItems[0].id),
                  count: commentsState.data.filter(
                    (comment) => comment.itemId === frageItems[0].id && !comment.hidden,
                  ).length,
                }
              : null,
            feed:
              feedCards.length > 0
                ? { count: feedCards.length, done: myWeek(todayKey).feed === true }
                : null,
            streak,
            badgeCount: badges.length,
            badgeTotal: IMPULSE_BADGES.length,
            favoritesCount: favoriteItems.length,
            latestFavorite: favoriteItems.at(-1)?.title ?? null,
            openSubmissions: submissionsState.data.filter(
              (submission) => submission.uid === uid && submission.status === 'open',
            ).length,
            pastWeeksCount: pastWeeks.length,
            participants,
            participantsTotal: total,
          }}
          onOpen={openSection}
        />
      </div>

      {sectionKey === 'feed' && (
        <ImpulseFeed
          week={feedWeek}
          cards={feedWeekCards}
          progressDocs={progressState.data}
          feedDone={myWeek(feedWeek).feed === true}
          initialItemId={state?.feedItem ?? null}
          origin={state?.origin ?? null}
          onClose={closeSection}
        />
      )}

      {sectionKey && sectionKey !== 'feed' && (
        <ImpulseScreen
          section={sectionKey}
          sections={availableSections}
          origin={state?.origin ?? null}
          onSelect={switchSection}
          onClose={closeSection}
          onToAp={canViewAp ? () => navigate('/ap') : null}
        >
          {sectionContent(sectionKey)}
        </ImpulseScreen>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Gemerkt                                                             */
/* ------------------------------------------------------------------ */

/**
 * Die Favoritensammlung, jüngste zuerst – und jede Karte führt zurück in
 * den Bereich, in dem sie gemerkt wurde (heute: der Feed ihrer Woche,
 * aufgeschlagen genau bei ihr).
 */
function GemerktList({
  items,
  onOpen,
}: {
  items: ImpulseItem[]
  onOpen: (item: ImpulseItem) => void
}) {
  const theme = IMPULSE_SECTIONS.gemerkt
  if (items.length === 0) {
    return (
      <EmptyScreenNote text="Noch nichts gemerkt – beim Durchtippen des Feeds wartet der Knopf «Merken»." />
    )
  }
  return (
    <div className="space-y-3">
      <p className="hint">
        Was dir beim Durchtippen begegnet ist – ein Tipp führt zurück zur Karte.
      </p>
      {[...items].reverse().map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item)}
          className="card group block w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs"
        >
          <span className="hint flex items-center gap-1.5">
            <Bookmark className="size-3.5" aria-hidden />
            {IMPULSE_KIND_LABELS[item.kind]}
            {item.week && ` · ${formatWeekRange(item.week)}`}
          </span>
          <span className="mt-1.5 block font-medium text-balance">{item.title}</span>
          {item.body && (
            <span className="mt-1 line-clamp-2 block text-sm text-slate-500 dark:text-slate-400">
              {item.body}
            </span>
          )}
          <span className={cn('mt-2.5 flex items-center gap-0.5 text-xs font-medium', theme.text)}>
            Zur Karte
            <ChevronRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </button>
      ))}
    </div>
  )
}

/** Ein leerer Raum, freundlich angeschrieben – kein Fehler, nur Stille. */
function EmptyScreenNote({ text }: { text: string }) {
  return (
    <div className="card grid place-items-center border-dashed px-4 py-10 text-center">
      <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
    </div>
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
