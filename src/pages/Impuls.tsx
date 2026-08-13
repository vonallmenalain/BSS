import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Bookmark, Check, ChevronRight, History, Inbox, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNow } from '@/hooks/useNow'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  useImpulseAnswers,
  useImpulseComments,
  useImpulseItems,
  useImpulseProgress,
  useImpulseSubmissions,
} from '@/hooks/useFirestore'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/Pickers'
import { AppMenuButton } from '@/components/AppMenuButton'
import { ContributorLine, QuizCard, SourceLink } from '@/components/impulse/ImpulseCards'
import { ChallengeCard, GoalCard, GroupCard } from '@/components/impulse/ImpulseProgressCards'
import { ImpulseQuestionCard } from '@/components/impulse/ImpulseQuestionCard'
import { ImpulseSubmitCard } from '@/components/impulse/ImpulseSubmitCard'
import { ImpulseFeedCard } from '@/components/impulse/ImpulseFeedCard'
import {
  ImpulseDeck,
  type ImpulseDeckCard,
  type ImpulseDeckTarget,
} from '@/components/impulse/ImpulseDeck'
import { MitmachRow, ProgressRow } from '@/components/impulse/ImpulseHomeRows'
import { ImpulseSettingsModal, type ImpulseOrder } from '@/components/impulse/ImpulseSettingsModal'
import { ImpulseScreen, type ScreenOrigin } from '@/components/impulse/ImpulseScreen'
import { ImpulseStats } from '@/components/impulse/ImpulseStats'
import { markImpulseFeedDone, setImpulseLastSeenWeek } from '@/services/impulse'
import {
  IMPULSE_BADGES,
  computeStreak,
  earnedImpulseBadges,
  formatWeekRange,
  impulseAnswerId,
  impulseWeekKey,
  itemsForWeek,
  participatedWeeks,
  seededShuffle,
  visibleImpulseItems,
  weekParticipants,
} from '@/lib/impulse'
import {
  IMPULSE_KIND_SECTION,
  IMPULSE_SECTIONS,
  isDeckSection,
  isImpulseSection,
  isRoomSection,
  sectionForItem,
  type ImpulseRoomSectionKey,
  type ImpulseSectionKey,
} from '@/lib/impulseSections'
import { recordImpulseOpen, trackImpulseTime } from '@/lib/impulseUsage'
import {
  IMPULSE_KIND_LABELS,
  type ImpulseAnswer,
  type ImpulseComment,
  type ImpulseItem,
  type ImpulseKind,
  type ImpulseWeekProgress,
} from '@/lib/types'

/**
 * «Impuls» – der geistige Bereich für die AP's (docs/KONZEPT-IMPULS.md).
 *
 * Der Einstieg ist ein **Wischstapel**: Zuoberst liegt der Wochenimpuls,
 * gross wie eh – ein Wisch nach unten bringt die nächste Karte der Woche
 * (Quizfrage, Wochenziel, Tages-Challenge, Frage der Woche, die
 * Feed-Karten). Kein Endlos-Feed: Nach der letzten Karte ist Schluss.
 * Unter dem Stapel stehen die ruhigen Zeilen, die keine Wochenkarten
 * sind – Mein Fortschritt, die Mitmach-Ecke, «Diese Woche dabei».
 *
 * Die Navigation wohnt im App-Menü: «Impuls» klappt dort auf wie die
 * Abendmahlsversammlung, ein Punkt pro Karte – ein Tipp springt im
 * Stapel genau dorthin (`/impuls/<bereich>`). Fortschritt, Gemerkt und
 * Mitmach-Ecke öffnen weiterhin ihren Vollbild-Raum. Zuunterst im Menü
 * liegen die **Impuls-Einstellungen**: die Reihenfolge der Karten (der
 * Reihe nach oder gemischt, gemerkt am Gerät) und der Rückblick in eine
 * frühere Woche – er gilt nur für diesen Besuch, Standard bleibt immer
 * die laufende Woche.
 *
 * Veröffentlicht wird weiterhin durch den Kalender – ein Inhalt
 * erscheint, sobald seine Woche beginnt (`visibleImpulseItems`);
 * geplant und erfasst wird in der Redaktion. Für die Redaktion sieht
 * die Seite gleich aus wie für die AP's – einzig der Knopf «Redaktion»
 * kommt dazu.
 */

/** Was eine Navigation dem Ziel mitgibt – alles davon ist optional. */
interface ImpulsLocationState {
  /** Der Klickpunkt der Zeile – dort beginnt der Vollbild-Übergang. */
  origin?: ScreenOrigin
  /** Die Woche einer gemerkten Feed-Karte – der Weg aus «Gemerkt». */
  feedWeek?: string
  /** … und dort gleich bei dieser Karte einsteigen. */
  feedItem?: string
}

/** Die Lesereihenfolge des Stapels – der Wochenimpuls zuerst. */
const DECK_KIND_ORDER: ImpulseKind[] = [
  'impuls',
  'quiz',
  'wochenziel',
  'tageschallenge',
  'frage',
  'feed',
]

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
  /* Nur die Raum-Bereiche öffnen noch ein Vollbild – die Stapel-Bereiche
     sind Sprungziele im Stapel der Hauptseite. */
  const roomKey: ImpulseRoomSectionKey | null =
    sectionKey && isRoomSection(sectionKey) ? sectionKey : null
  const settingsOpen = bereich === 'einstellungen'
  const state = (location.state ?? null) as ImpulsLocationState | null

  const todayKey = impulseWeekKey(now)
  const visible = visibleImpulseItems(itemsState.data, todayKey)
  const thisWeekAll = itemsForWeek(visible, todayKey)
  const feedCards = thisWeekAll.filter((entry) => entry.kind === 'feed')

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

  /* -------------- Einstellungen: Reihenfolge und Woche -------------- */

  /* Die Reihenfolge merkt sich das Gerät; die Woche gilt nur für diesen
     Besuch – beim nächsten Öffnen steht wieder die laufende da. */
  const [order, setOrder] = useLocalStorage<ImpulseOrder>('bss:impuls:reihenfolge', 'geordnet')
  const [weekOverride, setWeekOverride] = useState<string | null>(() => {
    // Eine gemerkte Karte aus einer früheren Woche schlägt gleich dort auf.
    const initial = (location.state ?? null) as ImpulsLocationState | null
    return initial?.feedWeek ?? null
  })
  const viewWeek =
    weekOverride && weekOverride !== todayKey && pastWeeks.includes(weekOverride)
      ? weekOverride
      : todayKey

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
    setImpulseLastSeenWeek({ uid: profile.id, displayName: profile.displayName }, todayKey).catch(
      (error) => console.error('[impuls] Woche konnte nicht vermerkt werden:', error),
    )
  }, [seenPending, profile, todayKey])

  /*
   * Die stille Statistik: Zeit und Besuche, nur auf diesem Gerät
   * (`lib/impulseUsage`). Die Uhr läuft, solange die Seite offen ist;
   * die Stapel-Karten vermerkt der Stapel selbst (`onDeckActive`), die
   * Räume und die Übersicht vermerkt dieser Effekt.
   */
  useEffect(() => {
    if (!uid) return
    return trackImpulseTime(uid)
  }, [uid])
  useEffect(() => {
    if (!uid) return
    recordImpulseOpen(uid, roomKey ?? 'uebersicht')
  }, [uid, roomKey])

  /* ---------------- Der Stapel: die Karten der Woche ---------------- */

  const deckWeekItems = viewWeek === todayKey ? thisWeekAll : itemsForWeek(visible, viewWeek)

  /** Eine Karte der laufenden Woche – lebendig, mit allen Handgriffen. */
  const liveNode = (item: ImpulseItem) => {
    switch (item.kind) {
      case 'quiz':
        return <QuizCard item={item} answer={answerFor(item)} plain />
      case 'wochenziel':
        return <GoalCard item={item} week={todayKey} done={myWeek(todayKey).goal === true} plain />
      case 'tageschallenge':
        return (
          <ChallengeCard item={item} week={todayKey} days={myWeek(todayKey).days ?? []} plain />
        )
      case 'frage':
        return (
          <ImpulseQuestionCard
            item={item}
            comments={commentsState.data.filter((comment) => comment.itemId === item.id)}
            progressDocs={progressState.data}
            plain
          />
        )
      case 'feed':
        return <ImpulseFeedCard item={item} progressDocs={progressState.data} />
      default:
        return <WocheDeckCard item={item} />
    }
  }

  /**
   * Eine Karte aus dem Rückblick – zum Nachlesen, nicht zum Nachholen:
   * Aufgaben einer vergangenen Woche lassen sich nicht rückwirkend
   * abhaken, das hielte weder Serie noch Beteiligung sauber. Nur Amen
   * und Merken auf Feed-Karten bleiben lebendig – sie hängen am Inhalt,
   * nicht an der Woche.
   */
  const pastNode = (item: ImpulseItem) => {
    switch (item.kind) {
      case 'quiz':
        return (
          <div className="card p-5">
            <PastQuiz item={item} answer={answerFor(item)} />
          </div>
        )
      case 'wochenziel':
        return (
          <div className="card p-5">
            <PastTask
              item={item}
              label="Wochenziel"
              note={myWeek(viewWeek).goal === true ? 'geschafft' : null}
            />
          </div>
        )
      case 'tageschallenge': {
        const count = Math.min((myWeek(viewWeek).days ?? []).length, 7)
        return (
          <div className="card p-5">
            <PastTask
              item={item}
              label="Tages-Challenge"
              note={count > 0 ? `${count} von 7 Tagen` : null}
            />
          </div>
        )
      }
      case 'frage': {
        const mine = myComments.some((comment) => comment.itemId === item.id)
        return (
          <PastFrageCard
            item={item}
            comments={commentsState.data.filter((comment) => comment.itemId === item.id)}
            mine={mine}
            reveal={mine || canEditImpulse}
          />
        )
      }
      case 'feed':
        return <ImpulseFeedCard item={item} progressDocs={progressState.data} />
      default:
        return <WocheDeckCard item={item} />
    }
  }

  const deckEntries: ImpulseDeckCard[] = DECK_KIND_ORDER.flatMap((kind) =>
    deckWeekItems.filter((item) => item.kind === kind),
  ).map((item) => ({
    id: `${item.kind}-${item.id}`,
    section: IMPULSE_KIND_SECTION[item.kind],
    node: viewWeek === todayKey ? liveNode(item) : pastNode(item),
  }))
  /* Gemischt bleibt gemischt: Der Schlüssel Konto+Woche hält den Stapel
     die Woche über in derselben Ordnung (siehe `seededShuffle`). */
  const deckCards =
    order === 'zufall' ? seededShuffle(deckEntries, `${uid}:${viewWeek}`) : deckEntries

  /* ---------------- Sprünge in den Stapel ---------------- */

  /* Der Einstieg über eine Karten-Adresse (`/impuls/quiz` – App-Menü oder
     Lesezeichen): vor dem ersten Bild bestimmt, ohne Anlauf. */
  const [initialDeckTarget] = useState<ImpulseDeckTarget | null>(() => {
    if (!isImpulseSection(bereich) || !isDeckSection(bereich)) return null
    const initial = (location.state ?? null) as ImpulsLocationState | null
    if (bereich === 'feed' && initial?.feedItem) {
      return { section: 'feed', cardId: `feed-${initial.feedItem}` }
    }
    return { section: bereich }
  })

  /* Spätere Sprünge: Jeder Griff ins Menü setzt ein neues Zielobjekt –
     auch derselbe Punkt zweimal hintereinander fährt wieder hin. */
  const [deckTarget, setDeckTarget] = useState<ImpulseDeckTarget | null>(null)
  const firstNav = useRef(true)
  useEffect(() => {
    if (firstNav.current) {
      // Der Aufbau ist bereits über `initialDeckTarget` positioniert.
      firstNav.current = false
      return
    }
    if (!isImpulseSection(bereich) || !isDeckSection(bereich)) return
    const navState = (location.state ?? null) as ImpulsLocationState | null
    if (navState?.feedWeek) {
      setWeekOverride(navState.feedWeek === todayKey ? null : navState.feedWeek)
    }
    setDeckTarget({
      section: bereich,
      cardId: bereich === 'feed' && navState?.feedItem ? `feed-${navState.feedItem}` : null,
    })
  }, [bereich, location.key, location.state, todayKey])

  /* -------------- Der Stand: durchgetippt und gezählt -------------- */

  /*
   * «Durchgetippt» heisst jetzt: Alle Feed-Karten der Woche waren einmal
   * im Bild – egal in welcher Reihenfolge, auch quer durch einen
   * gemischten Stapel. Vermerkt wird einmal und still, wie bisher.
   */
  const recordedDeckSections = useRef(new Set<string>())
  const seenFeedCards = useRef(new Set<string>())
  const feedMarkPending = useRef(false)
  const feedDone = myWeek(todayKey).feed === true
  const onDeckActive = (card: ImpulseDeckCard) => {
    if (uid && !recordedDeckSections.current.has(card.section)) {
      recordedDeckSections.current.add(card.section)
      recordImpulseOpen(uid, card.section)
    }
    if (!profile || viewWeek !== todayKey || card.section !== 'feed') return
    seenFeedCards.current.add(card.id)
    const allSeen =
      feedCards.length > 0 &&
      feedCards.every((entry) => seenFeedCards.current.has(`feed-${entry.id}`))
    if (!allSeen || feedDone || feedMarkPending.current) return
    feedMarkPending.current = true
    markImpulseFeedDone({ uid: profile.id, displayName: profile.displayName }, todayKey).catch(
      (error) => {
        console.error(error)
        feedMarkPending.current = false
      },
    )
  }

  /* ---------------- Navigation zwischen den Räumen ---------------- */

  /** Von der Zeile in den Raum – ein Schritt in der Chronik. */
  const openSection = (key: ImpulseSectionKey, origin?: ScreenOrigin) =>
    navigate(`/impuls/${key}`, { state: origin ? { origin } : undefined })

  /** Von Raum zu Raum – ersetzt den Schritt, Zurück führt zur Übersicht. */
  const switchSection = (key: ImpulseSectionKey) => navigate(`/impuls/${key}`, { replace: true })

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

  /* Die Einstellungen schliessen immer auf die Übersicht – auch wer sie
     aus einem anderen Bereich der App heraus aufgeschlagen hat, landet
     im Impuls, nicht wieder draussen. */
  const closeSettings = () => navigate('/impuls', { replace: true })

  const chooseOrder = (next: ImpulseOrder) => {
    setOrder(next)
    // Ein alter Sprungbefehl soll den frisch gelegten Stapel nicht anfahren.
    setDeckTarget(null)
  }
  const chooseWeek = (week: string) => {
    setWeekOverride(week === todayKey ? null : week)
    setDeckTarget(null)
  }

  /** Aus «Gemerkt» zurück zur Karte – bei früheren Wochen samt Rückblick. */
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

  /* Welche Räume der Wechsler anbietet – die Werkzeuge, nicht die Karten. */
  const availableSections: ImpulseSectionKey[] = (
    ['fortschritt', 'gemerkt', 'wochen', 'mitmachen'] as const
  ).filter((key) => {
    switch (key) {
      case 'gemerkt':
        return favoriteItems.length > 0
      case 'wochen':
        return pastWeeks.length > 0
      default:
        return true
    }
  })

  /* Ein unbekannter Routenteil führt still zur Übersicht zurück. */
  if (bereich && !sectionKey && bereich !== 'einstellungen') {
    return <Navigate to="/impuls" replace />
  }

  /* ---------------- Die Inhalte der Räume ---------------- */

  const sectionContent = (key: ImpulseRoomSectionKey) => {
    switch (key) {
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
      {/* Kopf, Stapel und die ruhigen Zeilen teilen sich die schmale
          Mittelspalte: Die Hülle der App ist hier ausgeblendet (siehe
          Layout), ihr Menüknopf der einzige Rest der Navigation. */}
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader
          title="Impuls"
          subtitle={formatWeekRange(viewWeek)}
          leading={<AppMenuButton />}
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

        {/* Der Rückblick sagt, dass er einer ist – und der Weg zurück in
            die laufende Woche steht gleich daneben. */}
        {viewWeek !== todayKey && (
          <div className="animate-imp-rise mb-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
            <History className="size-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              Rückblick auf {formatWeekRange(viewWeek)}
            </span>
            <button
              type="button"
              className="btn-ghost btn-sm -me-1.5 shrink-0"
              onClick={() => chooseWeek(todayKey)}
            >
              Zur aktuellen Woche
            </button>
          </div>
        )}

        {deckCards.length > 0 ? (
          /* Wechselt Konto, Woche oder Reihenfolge, beginnt der Stapel
             sauber von vorn – darum der Schlüssel. */
          <ImpulseDeck
            key={`${uid}:${viewWeek}:${order}`}
            cards={deckCards}
            initialTarget={initialDeckTarget}
            target={deckTarget}
            onActive={onDeckActive}
          />
        ) : (
          <section className="card animate-imp-rise grid place-items-center rounded-2xl border-dashed px-4 py-14 text-center">
            <Inbox className="size-6 text-slate-400" aria-hidden />
            <p className="mt-2 text-sm font-medium">
              {itemsState.loading
                ? 'Wird geladen …'
                : viewWeek === todayKey
                  ? 'Diese Woche ist noch nichts aufgeschaltet'
                  : 'In dieser Woche war nichts aufgeschaltet'}
            </p>
            {!itemsState.loading && viewWeek === todayKey && (
              <p className="hint max-w-sm">
                Schau später wieder vorbei – der nächste Impuls kommt. Dein Fortschritt und der
                Rückblick sind trotzdem da.
              </p>
            )}
          </section>
        )}

        {/* Unter dem Stapel, bewusst nicht Teil des Wischens: der eigene
            Weg, das Einreichen – und wer diese Woche dabei war. */}
        <div className="mt-3 space-y-3">
          <ProgressRow
            streak={streak}
            badgeCount={badges.length}
            badgeTotal={IMPULSE_BADGES.length}
            delay="60ms"
            onOpen={openSection}
          />
          <MitmachRow
            openSubmissions={
              submissionsState.data.filter(
                (submission) => submission.uid === uid && submission.status === 'open',
              ).length
            }
            delay="105ms"
            onOpen={openSection}
          />
          {!itemsState.loading && (
            <div className="animate-imp-rise" style={{ animationDelay: '150ms' }}>
              <GroupCard participants={participants} total={total} />
            </div>
          )}
        </div>
      </div>

      {roomKey && (
        <ImpulseScreen
          section={roomKey}
          sections={availableSections}
          origin={state?.origin ?? null}
          onSelect={switchSection}
          onClose={closeSection}
          onToAp={canViewAp ? () => navigate('/ap') : null}
        >
          {sectionContent(roomKey)}
        </ImpulseScreen>
      )}

      <ImpulseSettingsModal
        open={settingsOpen}
        onClose={closeSettings}
        order={order}
        onOrder={chooseOrder}
        weeks={pastWeeks}
        week={viewWeek}
        currentWeek={todayKey}
        onWeek={chooseWeek}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Die Karten des Stapels                                              */
/* ------------------------------------------------------------------ */

/** Der Wochenimpuls als Stapelkarte – gross und ruhig, wie eh und je. */
function WocheDeckCard({ item }: { item: ImpulseItem }) {
  return (
    <article className="card p-6 text-center sm:p-8">
      {item.week && <p className="hint">{formatWeekRange(item.week)}</p>}
      <h2 className="mt-2 text-2xl leading-snug font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-3 whitespace-pre-line text-slate-600 dark:text-slate-300">{item.body}</p>
      )}
      <div className="mt-5 flex flex-col items-center gap-1">
        <SourceLink item={item} />
        <ContributorLine item={item} />
      </div>
    </article>
  )
}

/**
 * Die Frage der Woche im Rückblick – lesbar, nicht mehr beantwortbar.
 *
 * Die Regel der lebendigen Karte gilt weiter: Die Antworten der anderen
 * sieht nur, wer selbst mitgeredet hat (oder die Redaktion) – auch
 * rückblickend wird die Frage kein Schaufenster.
 */
function PastFrageCard({
  item,
  comments,
  mine,
  reveal,
}: {
  item: ImpulseItem
  comments: ImpulseComment[]
  mine: boolean
  reveal: boolean
}) {
  const shown = comments.filter((comment) => !comment.hidden)
  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      <p className="hint mt-2">
        {shown.length} {shown.length === 1 ? 'Antwort' : 'Antworten'}
        {mine && (
          <>
            {' · '}
            <Check
              className="inline size-3.5 text-emerald-600 dark:text-emerald-300"
              aria-hidden
            />{' '}
            mitgeredet
          </>
        )}
      </p>
      {reveal && shown.length > 0 && (
        <ul className="divide-list mt-3">
          {shown.map((comment) => (
            <li key={comment.id} className="py-2 text-sm">
              <span className="font-medium">{comment.firstName || '–'}</span>{' '}
              <span className="text-slate-600 dark:text-slate-300">{comment.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Gemerkt                                                             */
/* ------------------------------------------------------------------ */

/**
 * Die Favoritensammlung, jüngste zuerst – und jede Karte führt zurück in
 * den Stapel, aufgeschlagen genau bei ihr (Karten aus früheren Wochen
 * samt Wechsel in deren Rückblick).
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
      <EmptyScreenNote text="Noch nichts gemerkt – auf den Feed-Karten wartet der Knopf «Merken»." />
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
