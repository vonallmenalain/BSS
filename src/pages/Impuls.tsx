import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpToLine,
  Bookmark,
  Check,
  ChevronRight,
  History,
  Inbox,
  PartyPopper,
  Pencil,
  RotateCcw,
  Send,
  type LucideIcon,
} from 'lucide-react'
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
import {
  ImpulseDeepeningCard,
  ImpulseItemImage,
  QuizCard,
  SourceLink,
  WocheDeckCard,
} from '@/components/impulse/ImpulseCards'
import { ChallengeCard, GoalCard, GroupCard } from '@/components/impulse/ImpulseProgressCards'
import { ImpulseQuestionCard } from '@/components/impulse/ImpulseQuestionCard'
import { ImpulseShareCard } from '@/components/impulse/ImpulseShareCard'
import { ImpulseSubmitCard } from '@/components/impulse/ImpulseSubmitCard'
import { ImpulseFeedCard } from '@/components/impulse/ImpulseFeedCard'
import {
  ImpulseFeedScreen,
  type ImpulseDeckCard,
  type ImpulseDeckTarget,
} from '@/components/impulse/ImpulseFeedScreen'
import { SectionTile } from '@/components/impulse/ImpulseHomeTiles'
import { ImpulseSettingsModal, type ImpulseOrder } from '@/components/impulse/ImpulseSettingsModal'
import { ImpulseScreen, type ScreenOrigin } from '@/components/impulse/ImpulseScreen'
import { ImpulseStats } from '@/components/impulse/ImpulseStats'
import {
  markImpulseCardSeen,
  markImpulseDeepeningSeen,
  markImpulseFeedDone,
  setImpulseLastSeenWeek,
} from '@/services/impulse'
import {
  computeStreak,
  formatWeekRange,
  impulseAnswerId,
  impulseWeekKey,
  impulseWeekMilestones,
  itemsForWeek,
  participatedWeeks,
  seededShuffle,
  visibleImpulseItems,
  weekParticipants,
} from '@/lib/impulse'
import {
  IMPULSE_DECK_KINDS,
  IMPULSE_KIND_SECTION,
  IMPULSE_SECTIONS,
  isDeckKind,
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
  type ImpulseWeekProgress,
} from '@/lib/types'

/**
 * «Anti Doom» – der geistige Bereich für die AP's (docs/KONZEPT-IMPULS.md;
 * in Code und Datenbank heisst er aus historischen Gründen `impulse`).
 *
 * Der Einstieg ist das **Dashboard**: Im Zentrum steht das Wochenthema,
 * gross und ruhig, noch ohne Wischen. Erst der Tipp
 * darauf öffnet den **Vollbild-Feed**: Alle Kacheln verschwinden, nur
 * noch die Karte und der Menüknopf oben links. Die erste Karte ist das
 * Wochenthema, ein Wisch nach unten bringt die nächste (Quizfrage,
 * Bilderrätsel, Frage der Woche, die Feed-Karten, die Teilen-Aufgabe) –
 * und ein Wisch nach links vertieft die Karte, wenn die Redaktion eine
 * Vertiefung erfasst hat. Kein Endlos-Feed: Nach der letzten Karte ist
 * Schluss.
 *
 * Unter dem Wochenthema liegen die **Kacheln**, die bewusst nicht Teil
 * des Feeds sind: Wochenziel, Tages-Challenge, Mein Fortschritt, Gemerkt,
 * Mitmach-Ecke – und «Diese Woche dabei». Jede Kachel öffnet ihren
 * Vollbild-Raum; im Feed sind sie verschwunden.
 *
 * Die Navigation wohnt im App-Menü: «Anti Doom» klappt dort auf, ein
 * Punkt pro Bereich – die Feed-Bereiche springen im Feed genau zur Karte
 * (`/anti-doom/<bereich>`), die übrigen öffnen ihren Raum. Zuunterst liegen
 * die **Anti-Doom-Einstellungen**: die Reihenfolge der Karten (der Reihe
 * nach oder gemischt, gemerkt am Gerät) und der Rückblick in eine
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
  /** Der Klickpunkt der Kachel – dort beginnt der Vollbild-Übergang. */
  origin?: ScreenOrigin
  /** Die Woche einer gemerkten Feed-Karte – der Weg aus «Gemerkt». */
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
  /* Feed-Bereiche öffnen den Vollbild-Feed, Raum-Bereiche ihren Raum. */
  const roomKey: ImpulseRoomSectionKey | null =
    sectionKey && isRoomSection(sectionKey) ? sectionKey : null
  const feedOpen = sectionKey !== null && isDeckSection(sectionKey)
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

  /*
   * Die Meilensteine der laufenden Woche – vier kleine Ziele, am Montag
   * wieder offen (`impulseWeekMilestones`). «Dabei» hängt am ersten
   * Blick in die Woche (`lastSeenWeek`), «Mitgeredet» an der Frage der
   * Woche, die Tageschallenge zählt ihre Haken – und der «Anti Doom
   * Scroller» braucht alle Karten samt Vertiefungen; angeschaut wird im
   * Feed vermerkt (`onDeckActive`/`onDeckDeepening`).
   */
  const frageItem = thisWeekAll.find((item) => item.kind === 'frage') ?? null
  const deckItemsThisWeek = thisWeekAll.filter((item) => isDeckKind(item.kind))
  const deepeningItemsThisWeek = deckItemsThisWeek.filter((item) => Boolean(item.deepening))
  const seenCardIds = new Set(myWeek(todayKey).cards ?? [])
  const seenDeepeningIds = new Set(myWeek(todayKey).deepened ?? [])
  const milestones = impulseWeekMilestones({
    seen: myProgress?.lastSeenWeek === todayKey,
    answeredQuestion: frageItem
      ? myComments.some((comment) => comment.itemId === frageItem.id)
      : false,
    challengeDays: (myWeek(todayKey).days ?? []).length,
    cardsSeen: deckItemsThisWeek.filter((item) => seenCardIds.has(item.id)).length,
    cardsTotal: deckItemsThisWeek.length,
    deepeningsSeen: deepeningItemsThisWeek.filter((item) => seenDeepeningIds.has(item.id)).length,
    deepeningsTotal: deepeningItemsThisWeek.length,
  })
  const milestonesEarned = milestones.filter((milestone) => milestone.earned).length

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
   * die Feed-Karten vermerkt der Feed selbst (`onDeckActive`), die
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

  /* ---------------- Der Feed: die Karten der Woche ---------------- */

  const deckWeekItems = viewWeek === todayKey ? thisWeekAll : itemsForWeek(visible, viewWeek)

  /** Eine Karte der laufenden Woche – lebendig, mit allen Handgriffen. */
  const liveNode = (item: ImpulseItem) => {
    switch (item.kind) {
      case 'quiz':
      case 'bilderraetsel':
        return <QuizCard item={item} answer={answerFor(item)} plain />
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
      case 'teilen':
        return (
          <ImpulseShareCard
            item={item}
            week={todayKey}
            done={myWeek(todayKey).share === true}
            plain
          />
        )
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
      case 'bilderraetsel':
        return (
          <div className="card p-5">
            <PastQuiz item={item} answer={answerFor(item)} />
          </div>
        )
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
      case 'teilen':
        return (
          <div className="card p-5">
            <PastTask
              item={item}
              label="Teilen"
              note={myWeek(viewWeek).share === true ? 'besprochen' : null}
            />
          </div>
        )
      default:
        return <WocheDeckCard item={item} />
    }
  }

  const deckEntries: ImpulseDeckCard[] = IMPULSE_DECK_KINDS.flatMap((kind) =>
    deckWeekItems
      .filter((item) => item.kind === kind)
      .map((item) => {
        /* Die Vertiefung einer noch offenen Quiz- oder Rätselkarte
           bleibt zu – sie könnte die Lösung verraten. Mit der Antwort
           (und im Rückblick) geht sie auf; der Pfeil «Vertiefen»
           erscheint dann als kleine Belohnung. */
        const spoiler =
          viewWeek === todayKey &&
          (item.kind === 'quiz' || item.kind === 'bilderraetsel') &&
          !answerFor(item)
        return {
          id: `${item.kind}-${item.id}`,
          itemId: item.id,
          section: IMPULSE_KIND_SECTION[kind],
          node: viewWeek === todayKey ? liveNode(item) : pastNode(item),
          /* Die zweite Seite der Karte – nur wenn die Redaktion eine
             Vertiefung erfasst hat; sonst gibt es sie gar nicht. */
          deepening:
            item.deepening && !spoiler ? <ImpulseDeepeningCard item={item} /> : null,
        }
      }),
  )
  /* Gemischt bleibt gemischt: Der Schlüssel Konto+Woche hält den Feed
     die Woche über in derselben Ordnung (siehe `seededShuffle`) – nur
     das Wochenthema bleibt immer die erste Karte. */
  const wocheEntries = deckEntries.filter((card) => card.section === 'woche')
  const restEntries = deckEntries.filter((card) => card.section !== 'woche')
  const deckCards =
    order === 'zufall'
      ? [...wocheEntries, ...seededShuffle(restEntries, `${uid}:${viewWeek}`)]
      : deckEntries

  /* ---------------- Sprünge in den Feed ---------------- */

  /* Der Einstieg über eine Karten-Adresse (`/anti-doom/quiz` – App-Menü oder
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
   * «Durchgetippt» heisst: Alle Feed-Karten der Woche waren einmal im
   * Bild – egal in welcher Reihenfolge, auch quer durch einen gemischten
   * Feed. Vermerkt wird einmal und still, wie bisher.
   */
  const recordedDeckSections = useRef(new Set<string>())
  const seenFeedCards = useRef(new Set<string>())
  const feedMarkPending = useRef(false)
  /* Je Karte bzw. Vertiefung höchstens ein Schreibvorgang pro Besuch –
     was das Fortschrittsdokument schon kennt, wird gar nicht erst
     angefasst (der Meilenstein «Anti Doom Scroller» zählt daraus). */
  const recordedCards = useRef(new Set<string>())
  const recordedDeepenings = useRef(new Set<string>())
  const feedDone = myWeek(todayKey).feed === true
  const onDeckActive = (card: ImpulseDeckCard) => {
    if (uid && !recordedDeckSections.current.has(card.section)) {
      recordedDeckSections.current.add(card.section)
      recordImpulseOpen(uid, card.section)
    }
    if (!profile || viewWeek !== todayKey) return

    const itemId = card.itemId
    if (itemId && !recordedCards.current.has(itemId) && !seenCardIds.has(itemId)) {
      recordedCards.current.add(itemId)
      markImpulseCardSeen(
        { uid: profile.id, displayName: profile.displayName },
        todayKey,
        itemId,
      ).catch((error) => {
        console.error(error)
        recordedCards.current.delete(itemId)
      })
    }

    if (card.section !== 'feed') return
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

  /** Der Wisch nach links: die Vertiefung war im Bild – einmal vermerken. */
  const onDeckDeepening = (card: ImpulseDeckCard) => {
    const itemId = card.itemId
    if (!profile || viewWeek !== todayKey || !itemId) return
    if (recordedDeepenings.current.has(itemId) || seenDeepeningIds.has(itemId)) return
    recordedDeepenings.current.add(itemId)
    markImpulseDeepeningSeen(
      { uid: profile.id, displayName: profile.displayName },
      todayKey,
      itemId,
    ).catch((error) => {
      console.error(error)
      recordedDeepenings.current.delete(itemId)
    })
  }

  /* ---------------- Navigation zwischen den Räumen ---------------- */

  /** Von der Kachel in den Raum – ein Schritt in der Chronik. */
  const openSection = (key: ImpulseSectionKey, origin?: ScreenOrigin) =>
    navigate(`/anti-doom/${key}`, { state: origin ? { origin } : undefined })

  /** Der Tipp auf das Wochenthema: der Feed geht auf, bei der ersten Karte. */
  const openFeed = (origin?: ScreenOrigin) =>
    navigate('/anti-doom/woche', { state: origin ? { origin } : undefined })

  /** Von Raum zu Raum – ersetzt den Schritt, Zurück führt zur Übersicht. */
  const switchSection = (key: ImpulseSectionKey) => navigate(`/anti-doom/${key}`, { replace: true })

  /**
   * Zurück zur Übersicht: der Schritt zurück in der Chronik, damit die
   * Zurück-Geste und der Pfeil dasselbe tun. Wer den Bereich direkt
   * aufgeschlagen hat (Lesezeichen), hat keinen Schritt – dann ersetzt
   * die Übersicht den Eintrag.
   */
  const closeSection = () => {
    if (location.key === 'default') navigate('/anti-doom', { replace: true })
    else navigate(-1)
  }

  /* Die Einstellungen schliessen immer auf die Übersicht – auch wer sie
     aus einem anderen Bereich der App heraus aufgeschlagen hat, landet
     im Bereich, nicht wieder draussen. */
  const closeSettings = () => navigate('/anti-doom', { replace: true })

  const chooseOrder = (next: ImpulseOrder) => {
    setOrder(next)
    // Ein alter Sprungbefehl soll den frisch gelegten Feed nicht anfahren.
    setDeckTarget(null)
  }
  const chooseWeek = (week: string) => {
    setWeekOverride(week === todayKey ? null : week)
    setDeckTarget(null)
  }

  /* «Noch einmal von vorn» auf der Abschlusskarte: die erste Karte als
     frisches Sprungziel – derselbe Weg, den auch das Menü nimmt. */
  const restartFeed = () => {
    const first = deckCards[0]
    if (first) setDeckTarget({ section: first.section, cardId: first.id })
  }

  /** Aus «Gemerkt» zurück zur Karte – bei früheren Wochen samt Rückblick. */
  const openFavorite = (item: ImpulseItem) => {
    const key = sectionForItem(item, todayKey)
    if (key === 'feed') {
      navigate('/anti-doom/feed', {
        replace: true,
        state: { feedWeek: item.week ?? todayKey, feedItem: item.id },
      })
    } else {
      navigate(`/anti-doom/${key}`, { replace: true })
    }
  }

  /* Die Aufgaben der laufenden Woche – für die Kacheln und ihre Räume. */
  const goalItem = thisWeekAll.find((item) => item.kind === 'wochenziel') ?? null
  const challengeItem = thisWeekAll.find((item) => item.kind === 'tageschallenge') ?? null
  const challengeDays = Math.min((myWeek(todayKey).days ?? []).length, 7)

  /* Welche Räume der Wechsler anbietet – die Kacheln, nicht die Karten. */
  const availableSections: ImpulseSectionKey[] = (
    ['ziel', 'challenge', 'fortschritt', 'gemerkt', 'wochen', 'mitmachen'] as const
  ).filter((key) => {
    switch (key) {
      case 'ziel':
        return goalItem !== null
      case 'challenge':
        return challengeItem !== null
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
    return <Navigate to="/anti-doom" replace />
  }

  /* ---------------- Die Inhalte der Räume ---------------- */

  const sectionContent = (key: ImpulseRoomSectionKey) => {
    switch (key) {
      case 'ziel':
        return goalItem ? (
          <GoalCard item={goalItem} week={todayKey} done={myWeek(todayKey).goal === true} plain />
        ) : (
          <EmptyScreenNote text="Diese Woche ist kein Wochenziel aufgeschaltet." />
        )
      case 'challenge':
        return challengeItem ? (
          <ChallengeCard
            item={challengeItem}
            week={todayKey}
            days={myWeek(todayKey).days ?? []}
            plain
          />
        ) : (
          <EmptyScreenNote text="Diese Woche ist keine Tages-Challenge aufgeschaltet." />
        )
      case 'fortschritt':
        return (
          <ImpulseStats
            todayKey={todayKey}
            streak={streak}
            participated={participated}
            progress={myProgress}
            answers={myAnswers}
            commentsCount={myComments.length}
            favoritesCount={favoriteItems.length}
            milestones={milestones}
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
                    case 'bilderraetsel':
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
                    case 'teilen':
                      return (
                        <PastTask
                          key={item.id}
                          item={item}
                          label="Teilen"
                          note={myWeek(week).share === true ? 'besprochen' : null}
                        />
                      )
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
      {/* Kopf, Wochenthema und Kacheln teilen sich die schmale
          Mittelspalte: Die Hülle der App ist hier ausgeblendet (siehe
          Layout), ihr Menüknopf der einzige Rest der Navigation. */}
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader
          title="Anti Doom"
          subtitle={formatWeekRange(viewWeek)}
          leading={<AppMenuButton />}
          actions={
            canEditImpulse ? (
              <Link to="/anti-doom/redaktion" className="btn-secondary">
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

        {/* Das Wochenthema im Zentrum – gross, ruhig, noch ohne Wischen.
            Erst der Tipp darauf öffnet den Vollbild-Feed. */}
        {deckCards.length > 0 ? (
          <WochenimpulsHero
            item={deckWeekItems.find((item) => item.kind === 'impuls') ?? null}
            onOpen={openFeed}
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
                Schau später wieder vorbei – das nächste Wochenthema kommt. Dein Fortschritt und der
                Rückblick sind trotzdem da.
              </p>
            )}
          </section>
        )}

        {/* Die Kacheln unter dem Wochenthema – Aufgaben und Werkzeuge,
            bewusst nicht Teil des Feeds: Im Vollbild sind sie weg. */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {goalItem && (
            <SectionTile
              section="ziel"
              status={goalItem.title}
              done={myWeek(todayKey).goal === true}
              delay="60ms"
              onOpen={openSection}
            />
          )}
          {challengeItem && (
            <SectionTile
              section="challenge"
              status={challengeItem.title}
              badge={`${challengeDays}/7`}
              done={challengeDays >= 7}
              delay="90ms"
              onOpen={openSection}
            />
          )}
          <SectionTile
            section="fortschritt"
            status={
              streak.current > 0
                ? `${streak.current} ${streak.current === 1 ? 'Woche' : 'Wochen'} in Folge · ${milestonesEarned} von ${milestones.length} Meilensteinen`
                : 'Deine Serie beginnt mit dem ersten Haken.'
            }
            delay="120ms"
            onOpen={openSection}
          />
          <SectionTile
            section="gemerkt"
            status={
              favoriteItems.length > 0
                ? `${favoriteItems.length} ${favoriteItems.length === 1 ? 'Karte' : 'Karten'} gesammelt`
                : 'Auf den Feed-Karten wartet «Merken».'
            }
            delay="150ms"
            onOpen={openSection}
          />
          <div className="col-span-2">
            <SectionTile
              section="mitmachen"
              status="Deine Idee für jede Kartenart – auf der fertigen Karte steht dein Name."
              badge={
                submissionsState.data.filter(
                  (submission) => submission.uid === uid && submission.status === 'open',
                ).length > 0
                  ? `${
                      submissionsState.data.filter(
                        (submission) => submission.uid === uid && submission.status === 'open',
                      ).length
                    } eingereicht`
                  : undefined
              }
              delay="180ms"
              onOpen={openSection}
            />
          </div>
        </div>

        {!itemsState.loading && (
          <div className="animate-imp-rise mt-3" style={{ animationDelay: '210ms' }}>
            <GroupCard participants={participants} total={total} />
          </div>
        )}
      </div>

      {/* Der Vollbild-Feed: nur die Karte und der Menüknopf – alle
          Kacheln sind verschwunden. Wechselt Konto, Woche oder
          Reihenfolge, beginnt der Feed sauber von vorn (Key). */}
      {feedOpen && (
        <ImpulseFeedScreen
          key={`${uid}:${viewWeek}:${order}`}
          cards={deckCards}
          initialTarget={initialDeckTarget}
          target={deckTarget}
          origin={state?.origin ?? null}
          onActive={onDeckActive}
          onDeepening={onDeckDeepening}
          onClose={closeSection}
          finale={
            <FeedFinale
              week={viewWeek}
              isCurrent={viewWeek === todayKey}
              pastWeeks={pastWeeks.filter((week) => week !== viewWeek)}
              sections={[
                ...(goalItem ? (['ziel'] as const) : []),
                ...(challengeItem ? (['challenge'] as const) : []),
                'fortschritt',
                'gemerkt',
              ]}
              onRestart={restartFeed}
              onMitmachen={() => navigate('/anti-doom/mitmachen', { replace: true })}
              onSection={(key) => navigate(`/anti-doom/${key}`, { replace: true })}
              onWeek={chooseWeek}
              onCurrentWeek={() => chooseWeek(todayKey)}
              onAllWeeks={() => navigate('/anti-doom/einstellungen', { replace: true })}
            />
          }
        />
      )}

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
/* Das Wochenthema im Zentrum                                          */
/* ------------------------------------------------------------------ */

/**
 * Das Wochenthema als Herzstück des Dashboards: gross im Zentrum – noch
 * ohne Wischen. Der ganze Kasten ist ein Knopf; der Tipp öffnet den
 * Vollbild-Feed bei der ersten Karte, und der Klickpunkt wird zum
 * Ursprung des Übergangs. Fehlt das Wochenthema (aber andere Karten sind
 * da), lädt der Kasten trotzdem in den Feed ein.
 */
function WochenimpulsHero({
  item,
  onOpen,
}: {
  item: ImpulseItem | null
  onOpen: (origin: ScreenOrigin) => void
}) {
  const theme = IMPULSE_SECTIONS.woche
  return (
    <button
      type="button"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onOpen({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      }}
      className="card animate-imp-rise group relative w-full overflow-hidden rounded-2xl px-5 py-10 text-center transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] active:shadow-xs sm:px-8 sm:py-12"
    >
      {/* Der Farbschleier des Wochenthemas – dieselbe Sprache wie im Feed. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent',
          theme.wash,
        )}
      />
      <span className="relative block">
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', theme.text)}>
          <span
            className={cn('grid size-6 shrink-0 place-items-center rounded-md', theme.iconBox)}
            aria-hidden
          >
            <theme.icon className="size-3.5" />
          </span>
          Anti Doom Wochenthema
        </span>
        <span className="mt-4 block text-3xl leading-tight font-semibold text-balance sm:text-4xl">
          {item ? item.title : 'Die Karten der Woche'}
        </span>
        {item?.body && (
          <span className="mx-auto mt-3 line-clamp-3 block max-w-md text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
            {item.body}
          </span>
        )}
        <span className="mt-6 inline-flex items-center gap-1 rounded-full bg-slate-900/5 px-3.5 py-1.5 text-xs font-medium text-slate-600 transition group-hover:bg-slate-900/10 dark:bg-white/10 dark:text-slate-300 dark:group-hover:bg-white/15">
          Antippen zum Eintauchen
          <ChevronRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Die Abschlusskarte des Feeds                                        */
/* ------------------------------------------------------------------ */

/**
 * «Alle Karten durchgeschaut» – die Karte nach der letzten Karte.
 *
 * Sie gratuliert (der Feed ist endlich, das darf man feiern) und zeigt
 * die Wege weiter: den Feed der Woche noch einmal von vorn, die eigene
 * Idee in der Mitmach-Ecke, die Kacheln des Dashboards (Wochenziel,
 * Tages-Challenge, Mein Fortschritt, Gemerkt) – und den Feed früherer
 * Wochen, direkt anwählbar (der Wechsel baut den Feed in jener Woche neu
 * auf). Im Rückblick führt der oberste Weg zurück in die laufende Woche.
 */
function FeedFinale({
  week,
  isCurrent,
  pastWeeks,
  sections,
  onRestart,
  onMitmachen,
  onSection,
  onWeek,
  onCurrentWeek,
  onAllWeeks,
}: {
  week: string
  isCurrent: boolean
  /** Frühere Wochen ohne die gerade angezeigte, jüngste zuerst. */
  pastWeeks: string[]
  /** Die Kacheln des Dashboards, die es diese Woche gibt – als Schnellzugriff. */
  sections: ImpulseSectionKey[]
  onRestart: () => void
  onMitmachen: () => void
  onSection: (key: ImpulseSectionKey) => void
  onWeek: (week: string) => void
  onCurrentWeek: () => void
  onAllWeeks: () => void
}) {
  const shownWeeks = pastWeeks.slice(0, 3)
  return (
    <article className="card p-6 text-center sm:p-8">
      <span
        className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500 text-white"
        aria-hidden
      >
        <PartyPopper className="size-6" />
      </span>
      <h2 className="mt-4 text-2xl leading-snug font-semibold text-balance">
        Alle Karten durchgeschaut – stark!
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {isCurrent
          ? 'Das war Anti Doom für diese Woche. Am Montag liegt das nächste Wochenthema bereit – bis dahin:'
          : `Das war der Rückblick auf ${formatWeekRange(week)}.`}
      </p>

      <div className="mt-6 space-y-2 text-left">
        {!isCurrent && (
          <FinaleAction
            icon={ArrowUpToLine}
            label="Zur aktuellen Woche"
            hint="Zurück zum Feed der laufenden Woche."
            onClick={onCurrentWeek}
          />
        )}
        <FinaleAction
          icon={RotateCcw}
          label="Noch einmal von vorn"
          hint="Den Feed dieser Woche neu starten."
          onClick={onRestart}
        />
        <FinaleAction
          icon={Send}
          label="Eigene Karte einreichen"
          hint="Mitmach-Ecke: deine Idee – auf der Karte steht dein Name."
          onClick={onMitmachen}
        />
      </div>

      {/* Die Kacheln des Dashboards, hier als Schnellzugriff: Aufgaben
          abhaken und Gesammeltes anschauen, ohne den Feed zu verlassen
          und wieder hineinzufinden – unangeschrieben, die Kacheln sagen
          selbst, was sie sind. */}
      {sections.length > 0 && (
        <div className="mt-5 text-left">
          <div className="grid grid-cols-2 gap-1.5">
            {sections.map((key) => {
              const theme = IMPULSE_SECTIONS[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSection(key)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-left text-sm transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-lg',
                      theme.iconBox,
                    )}
                    aria-hidden
                  >
                    <theme.icon className="size-4" />
                  </span>
                  <span className="min-w-0 truncate font-medium">{theme.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {shownWeeks.length > 0 && (
        <div className="mt-5 text-left">
          <p className="hint mb-1.5 flex items-center gap-1.5 font-medium">
            <History className="size-3.5" aria-hidden />
            Feed früherer Wochen
          </p>
          <div className="space-y-1.5">
            {shownWeeks.map((pastWeek) => (
              <FinaleAction
                key={pastWeek}
                icon={History}
                label={formatWeekRange(pastWeek)}
                onClick={() => onWeek(pastWeek)}
              />
            ))}
            {pastWeeks.length > shownWeeks.length && (
              <FinaleAction
                icon={History}
                label="Alle früheren Wochen"
                hint="Die ganze Liste in den Anti-Doom-Einstellungen."
                onClick={onAllWeeks}
              />
            )}
          </div>
        </div>
      )}
    </article>
  )
}

/** Ein Weg weiter auf der Abschlusskarte – eine ruhige, volle Zeile. */
function FinaleAction({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 p-3 text-left text-sm transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:hover:bg-slate-800/60"
    >
      <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="hint mt-0 block">{hint}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Die Karten des Feeds                                                */
/* ------------------------------------------------------------------ */

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
 * den Feed, aufgeschlagen genau bei ihr (Karten aus früheren Wochen
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
 * Eine Aufgabe aus einer früheren Woche – Wochenziel, Tages-Challenge
 * oder Teilen-Aufgabe.
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

/** Ein Wochenthema aus einer früheren Woche – kompakt, mit Quelle. */
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
 * Eine Quizfrage oder ein Bilderrätsel aus einer früheren Woche.
 *
 * Die Woche ist vorbei, deshalb steht die Lösung offen da – wer geantwortet
 * hat, sieht dazu, wie es ausgegangen ist. Beim Bilderrätsel bleibt das
 * Bild dabei, klein.
 */
function PastQuiz({ item, answer }: { item: ImpulseItem; answer: ImpulseAnswer | null }) {
  const quiz = item.quiz
  if (!quiz) return null
  const solution = quiz.form === 'choice' ? (quiz.options[quiz.answerIndex] ?? '') : quiz.answerText

  return (
    <div>
      <ImpulseItemImage item={item} className="max-h-40" />
      <p className={cn('text-sm font-medium', item.image?.url && 'mt-2')}>{item.title}</p>
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
