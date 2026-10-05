import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpToLine,
  Bookmark,
  CalendarClock,
  Check,
  ChevronRight,
  History,
  Inbox,
  PartyPopper,
  Pencil,
  RotateCcw,
  Send,
  Shield,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useImpulseAppearance, useLocalStorage } from '@/hooks/useLocalStorage'
import {
  useImpulseAuth,
  useImpulseNavigate,
  useImpulseNow,
  useImpulsePreview,
  useImpulseWrites,
} from '@/hooks/useImpulseRuntime'
import {
  useImpulseAnswers,
  useImpulseGameScores,
  useImpulseComments,
  useImpulseItems,
  useImpulseProgress,
  useImpulseSubmissions,
} from '@/hooks/useFirestore'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/Pickers'
import { AppMenuButton } from '@/components/AppMenuButton'
import {
  ImpulseDeepeningCard,
  ImpulseImageBackdrop,
  ImpulseItemImage,
  QuizCard,
  SourceLink,
  VideoDeckCard,
  WocheDeckCard,
} from '@/components/impulse/ImpulseCards'
import { ChallengeCard, GoalCard, GroupCard } from '@/components/impulse/ImpulseProgressCards'
import { ImpulsePollCard } from '@/components/impulse/ImpulsePollCard'
import { ImpulsePuzzleCard } from '@/components/impulse/ImpulsePuzzleCard'
import { ImpulseCrestEmblem } from '@/components/impulse/ImpulseCrest'
import { CREST_PALETTES, defaultCrest } from '@/lib/impulseCrest'
import { ImpulseCrestCelebration } from '@/components/impulse/ImpulseCrestCelebration'
import { ImpulseQuestionCard } from '@/components/impulse/ImpulseQuestionCard'
import { ImpulseShareCard } from '@/components/impulse/ImpulseShareCard'
import { ImpulseVideoPlayer } from '@/components/impulse/ImpulseVideoPlayer'
import { ImpulseSubmitCard } from '@/components/impulse/ImpulseSubmitCard'
import { ImpulseFeedCard } from '@/components/impulse/ImpulseFeedCard'
import { ImpulseGameCard } from '@/components/impulse/game/ImpulseGameCard'
import {
  ImpulseFeedScreen,
  type ImpulseDeckCard,
  type ImpulseDeckTarget,
} from '@/components/impulse/ImpulseFeedScreen'
import { SectionTile } from '@/components/impulse/ImpulseHomeTiles'
import { ImpulseMissionTasks } from '@/components/impulse/ImpulseMissionTasks'
import { ImpulseSettingsModal, type ImpulseOrder } from '@/components/impulse/ImpulseSettingsModal'
import { ImpulseScreen, type ScreenOrigin } from '@/components/impulse/ImpulseScreen'
import { ImpulseStats } from '@/components/impulse/ImpulseStats'
import { ImpulsePreviewProvider } from '@/components/impulse/ImpulsePreviewMode'
import { withPreviewDocs } from '@/lib/impulsePreview'
import {
  computeStreak,
  crestCompleters,
  crestComplete,
  daysUntilSunday,
  deckOrder,
  formatWeekRange,
  impulseAnswerId,
  impulseCrestStars,
  impulseCrestSteps,
  impulseCurrentWeek,
  impulseWeekMilestones,
  impulseWeeksSince,
  impulseWeekStarts,
  impulseWeekToday,
  itemsForWeek,
  participatedWeeks,
  puzzleSolution,
  seededShuffle,
  visibleImpulseItems,
  weekParticipants,
  type ImpulseCrestStars,
  type ImpulseCrestStep,
} from '@/lib/impulse'
import {
  IMPULSE_KIND_SECTION,
  IMPULSE_SECTIONS,
  isDeckKind,
  isDeckSection,
  isImpulseSection,
  isRoomSection,
  sectionForItem,
  type ImpulseDeckKind,
  type ImpulseRoomSectionKey,
  type ImpulseSectionKey,
} from '@/lib/impulseSections'
import { recordImpulseOpen, trackImpulseTime } from '@/lib/impulseUsage'
import { refreshImpulseResponses } from '@/services/impulse'
import { impulseVideoSource } from '@/lib/impulseVideo'
import {
  IMPULSE_KIND_LABELS,
  type ImpulseAnswer,
  type ImpulseComment,
  type ImpulseCrest,
  type ImpulseItem,
  type ImpulseWeekProgress,
} from '@/lib/types'

/**
 * Wie lange eine Karte im Bild stehen muss, bis sie als angeschaut zählt.
 * Wer quer durch den Feed springt (Menü, «Weiter swipen»), rauscht an den
 * Karten dazwischen vorbei – die sollen nicht als geschafft gelten.
 */
const SEEN_DWELL_MS = 900

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
 * In der Mission der Woche stehen auch die beiden **Aufgaben** –
 * Wochenziel und Tages-Challenge, gleich abhakbar. Darunter liegen die
 * **Kacheln**, die bewusst nicht Teil des Feeds sind: Mein Fortschritt,
 * Gemerkt, Mitmach-Ecke – und «Diese Woche dabei». Jede Kachel und jede
 * Aufgabe öffnet ihren Vollbild-Raum; im Feed sind sie verschwunden.
 *
 * Die Navigation wohnt im App-Menü: «Anti Doom» klappt dort auf, ein
 * Punkt pro Bereich – die Feed-Bereiche springen im Feed genau zur Karte
 * (`/anti-doom/<bereich>`), die übrigen öffnen ihren Raum. Zuunterst liegen
 * die **Anti-Doom-Einstellungen**: die Darstellung des Bereichs (dunkel
 * oder hell, gemerkt am Gerät), die Reihenfolge der Karten (der Reihe
 * nach oder gemischt) und der Rückblick in eine frühere Woche – er gilt
 * nur für diesen Besuch, Standard bleibt immer die laufende Woche. Sie
 * sind ein Fenster über dem Bereich, in dem man steht: Beim Schliessen
 * steht man wieder dort, bei derselben Karte.
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
  /** Eine bestimmte Karte des Feeds (`art-inhaltsId`) – der Weg von «Weiter swipen». */
  cardId?: string
  /**
   * Die Vorschau der Redaktion für diese Woche («2026-W41») – gesetzt von
   * «Vorschau der Woche» und in der Vorschau von jedem Schritt
   * mitgetragen (`useImpulseNavigate`).
   */
  vorschau?: string
}

/**
 * Der Bereich – oder, aus der Redaktion geöffnet, seine Vorschau.
 *
 * Die Vorschau ist dieselbe Seite in einer gespielten Umgebung
 * (`ImpulsePreviewProvider`): Sie zeigt die gewählte Woche, als liefe sie,
 * genau so, wie sie die Jugendlichen sehen – nur mit der Leiste
 * «Vorschau verlassen» oben, und ohne dass etwas gespeichert wird.
 * Begonnen wird sie über den Verlauf (`state.vorschau`); nur wer die
 * Redaktion führen darf, bekommt sie.
 *
 * Einmal begonnen, bleibt sie, solange man im Bereich ist: Die Seite
 * bleibt beim Springen zwischen Karten und Räumen montiert, und auch ein
 * Schritt ohne Vermerk – etwa über das App-Menü – führt so nicht still in
 * die echte Ansicht, wo das Anschauen gespeichert würde. Sie endet mit
 * «Vorschau verlassen» oder wenn der Bereich verlassen wird.
 */
export function Impuls() {
  const { canEditImpulse } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const requested = (location.state as ImpulsLocationState | null)?.vorschau
  const [startedWeek, setStartedWeek] = useState(typeof requested === 'string' ? requested : null)
  if (typeof requested === 'string' && requested !== startedWeek) setStartedWeek(requested)
  const previewWeek = canEditImpulse ? startedWeek : null
  const exitPreview = useCallback(
    () => navigate('/anti-doom/redaktion', { replace: true }),
    [navigate],
  )

  if (!previewWeek) return <ImpulsPage />
  return (
    <ImpulsePreviewProvider key={previewWeek} week={previewWeek} onExit={exitPreview}>
      <ImpulsPage />
    </ImpulsePreviewProvider>
  )
}

function ImpulsPage() {
  const { profile, canEditImpulse, canViewAp } = useImpulseAuth()
  const now = useImpulseNow()
  const navigate = useImpulseNavigate()
  const location = useLocation()
  const { bereich } = useParams()
  const preview = useImpulsePreview()
  const writes = useImpulseWrites()
  const itemsState = useImpulseItems()

  /*
   * Der Bestand – in der Vorschau mit ihrem Stand darüber: Was die
   * gespielte Person beantwortet, abgehakt oder eingereicht hat, liegt im
   * Arbeitsspeicher (`lib/impulsePreview`) und kommt hier dazu, als stünde
   * es in der Datenbank. Ausserhalb der Vorschau bleiben die Listen
   * dieselben Objekte.
   */
  const realAnswers = useImpulseAnswers()
  const realProgress = useImpulseProgress()
  const realComments = useImpulseComments()
  const realSubmissions = useImpulseSubmissions()
  const previewData = preview?.data ?? null
  const answersData = previewData
    ? withPreviewDocs(realAnswers.data, previewData.answers)
    : realAnswers.data
  const answersState =
    answersData === realAnswers.data
      ? realAnswers
      : {
          ...realAnswers,
          data: answersData,
          byId: new Map(answersData.map((answer) => [answer.id, answer])),
        }
  const progressData = previewData?.progress
    ? withPreviewDocs(realProgress.data, [previewData.progress])
    : realProgress.data
  const progressState =
    progressData === realProgress.data
      ? realProgress
      : {
          ...realProgress,
          data: progressData,
          byUid: new Map(progressData.map((progress) => [progress.uid, progress])),
        }
  const commentsState = previewData
    ? { ...realComments, data: withPreviewDocs(realComments.data, previewData.comments) }
    : realComments
  const submissionsState = previewData
    ? { ...realSubmissions, data: withPreviewDocs(realSubmissions.data, previewData.submissions) }
    : realSubmissions
  /* Die Ranglisten der Minispiele – in der Vorschau mit ihrem Lauf darüber. */
  const realScores = useImpulseGameScores()
  const scoresData = previewData
    ? withPreviewDocs(realScores.data, previewData.gameScores)
    : realScores.data

  const sectionKey: ImpulseSectionKey | null = isImpulseSection(bereich) ? bereich : null
  const settingsOpen = bereich === 'einstellungen'

  /*
   * Die Einstellungen sind ein Fenster, kein Ortswechsel.
   *
   * Sie legen sich über das, was gerade offen ist: Wer sie aus dem Feed
   * heraus aufschlägt, steht beim Schliessen wieder im Feed – bei
   * derselben Karte, nicht auf der Übersicht. Die Adresse allein kann das
   * nicht sagen (sie heisst währenddessen «einstellungen»), darum merkt
   * sich die Seite den Bereich darunter.
   */
  const [beneath, setBeneath] = useState<ImpulseSectionKey | null>(sectionKey)
  if (!settingsOpen && beneath !== sectionKey) setBeneath(sectionKey)
  const openKey = settingsOpen ? beneath : sectionKey

  /* Feed-Bereiche öffnen den Vollbild-Feed, Raum-Bereiche ihren Raum. */
  const roomKey: ImpulseRoomSectionKey | null = openKey && isRoomSection(openKey) ? openKey : null
  const feedOpen = openKey !== null && isDeckSection(openKey)
  const state = (location.state ?? null) as ImpulsLocationState | null

  /* Die laufende Woche – meist die Kalenderwoche; die Redaktion kann den
     Start einer Woche verschieben (`impulseCurrentWeek`). Die Vorschau
     zeigt immer die Woche, die sie spielt. */
  const weekStarts = impulseWeekStarts(itemsState.data)
  const todayKey = preview ? preview.week : impulseCurrentWeek(now, weekStarts)
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
  /* Die eigenen Einträge in den Ranglisten – die erste Runde eines
     Minispiels zählt wie eine Antwort, und ein neuer Name gilt in allen. */
  const myScores = scoresData.filter((score) => score.uid === uid)
  const myScoreIds = myScores.map((score) => score.id)
  /* Alle Antworten je Karte – Quiz, Umfrage und Puzzle zeigen nach der
     eigenen, wie das Kollegium geantwortet hat. */
  const answersByItem = new Map<string, ImpulseAnswer[]>()
  for (const answer of answersState.data) {
    const list = answersByItem.get(answer.itemId) ?? []
    list.push(answer)
    answersByItem.set(answer.itemId, list)
  }
  const answersOf = (item: ImpulseItem) => answersByItem.get(item.id) ?? []
  /* Was ich beantwortet habe – Quiz, Umfrage, Puzzle, Frage der Woche und
     die Minispiele, die ich gespielt habe. */
  const myAnswered = new Set(
    [...myAnswers, ...myComments, ...myScores].map((entry) => entry.itemId),
  )
  // Antworten, Beiträge und Runden zählen gleichermassen als Beteiligung.
  const participated = participatedWeeks(
    myProgress,
    [...myAnswers, ...myComments, ...myScores],
    weekOfItem,
  )
  const streak = computeStreak(participated, todayKey)
  /* Der Verlauf in «Mein Fortschritt»: so viele Wochen, wie ich dabei bin.
     Beginnt mit der ersten geöffneten Woche (`firstSeenWeek`) – oder, wo
     das Feld noch fehlt, mit der frühesten, die mein Fortschritt kennt. */
  const myWeeks = impulseWeeksSince(todayKey, [
    myProgress?.firstSeenWeek,
    myProgress?.lastSeenWeek,
    ...participated,
    ...Object.keys(myProgress?.weeks ?? {}),
  ])
  /* Wer gespielt hat, war dabei – mit dem Vornamen aus dem Fortschritt,
     nicht dem Namen der Rangliste (der ist frei gewählt). */
  const scorePeople = scoresData.map((score) => ({
    itemId: score.itemId,
    uid: score.uid,
    firstName: progressState.byUid.get(score.uid)?.firstName ?? '',
  }))
  const participants = weekParticipants(
    progressState.data,
    [...answersState.data, ...commentsState.data, ...scorePeople],
    weekOfItem,
    todayKey,
  )
  // Der Nenner der Gruppenleiste: alle, die je mitgemacht haben.
  const total = new Set([
    ...progressState.data.map((progress) => progress.uid),
    ...answersState.data.map((answer) => answer.uid),
    ...commentsState.data.map((comment) => comment.uid),
    ...scoresData.map((score) => score.uid),
  ]).size

  const myWeek = (week: string): ImpulseWeekProgress => myProgress?.weeks?.[week] ?? {}

  /*
   * Die Meilensteine der laufenden Woche – vier kleine Ziele, am Montag
   * wieder offen (`impulseWeekMilestones`). «Dabei» hängt am ersten
   * Blick in die Woche (`lastSeenWeek`), «Mitgeredet» an der Frage der
   * Woche, die Tageschallenge zählt ihre Haken – und der «Anti Doom
   * Scroller» braucht alle Karten samt Vertiefungen; angeschaut wird im
   * Feed vermerkt (`onDeckActive`/`onDeckDeepening`).
   *
   * Übergeben werden nicht nur Zahlen, sondern die Einzelteile – Frage,
   * Tage, Karten mit Titel. Daraus baut `impulseWeekMilestones` die
   * Schritte, die «Mein Fortschritt» im Detailfenster aufzählt: welche
   * Karte noch fehlt, welcher Tag noch offen ist.
   */
  const frageItem = thisWeekAll.find((item) => item.kind === 'frage') ?? null
  const deckItemsThisWeek = thisWeekAll.filter((item) => isDeckKind(item.kind))
  const seenCardIds = new Set(myWeek(todayKey).cards ?? [])
  const seenDeepeningIds = new Set(myWeek(todayKey).deepened ?? [])
  const milestones = impulseWeekMilestones({
    seen: myProgress?.lastSeenWeek === todayKey,
    question: frageItem
      ? {
          title: frageItem.title,
          answered: myComments.some((comment) => comment.itemId === frageItem.id),
        }
      : null,
    week: todayKey,
    today: impulseWeekToday(todayKey, now),
    challengeDays: myWeek(todayKey).days ?? [],
    cards: deckItemsThisWeek.map((item) => ({
      id: item.id,
      title: item.title,
      seen: seenCardIds.has(item.id),
      deepening: Boolean(item.deepening),
      deepeningSeen: seenDeepeningIds.has(item.id),
    })),
  })
  const milestonesEarned = milestones.filter((milestone) => milestone.earned).length

  /*
   * Das Wochen-Wappen: Jede geschaffte Karte färbt Felder, erst mit der
   * letzten steht es ganz da (`impulseCrestSteps`). Geschafft heisst
   * vollständig – angeschaut, beantwortet, die Vertiefung gesehen. Wie es
   * aussieht, sagt das Wochenthema; ohne Angabe leitet es sich aus der
   * Woche ab.
   */
  const themeItem = thisWeekAll.find((item) => item.kind === 'impuls') ?? null
  const crestCards = deckOrder(deckItemsThisWeek)
  const crestSteps = impulseCrestSteps({
    cards: crestCards,
    seen: seenCardIds,
    deepened: seenDeepeningIds,
    answered: myAnswered,
    shared: myWeek(todayKey).share === true,
  })
  const crestDone = crestSteps.filter((step) => step.done).length
  const crestIsComplete = crestComplete(crestSteps)
  const crestDesign: ImpulseCrest = themeItem?.crest ?? defaultCrest(todayKey)
  const doneItemIds = new Set(crestSteps.filter((step) => step.done).map((step) => step.itemId))
  /* Wer aus dem Kollegium sein Wappen schon vollendet hat – ohne mich. */
  const crestNames = crestCompleters({
    week: todayKey,
    cards: crestCards,
    progressDocs: progressState.data,
    answers: [...answersState.data, ...commentsState.data, ...scoresData],
  })

  /* Die Favoritensammlung – in der Reihenfolge des Merkens. */
  const favoriteItems = (myProgress?.favorites ?? [])
    .map((itemId) => itemsById.get(itemId))
    .filter((entry): entry is ImpulseItem => Boolean(entry))

  /* -------------- Einstellungen: Reihenfolge und Woche -------------- */

  /* Die Reihenfolge merkt sich das Gerät; die Woche gilt nur für diesen
     Besuch – beim nächsten Öffnen steht wieder die laufende da. */
  const [order, setOrder] = useLocalStorage<ImpulseOrder>('bss:impuls:reihenfolge', 'geordnet')
  /* Die Darstellung des Bereichs (dunkel, wenn nichts gewählt ist) legt
     die Hülle an das `<html>` – hier steht nur die Wahl (siehe `Layout`). */
  const [look, setLook] = useImpulseAppearance()
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
   *
   * Mit dem ersten Blick bekommt der Fortschritt auch seine erste Woche
   * (`firstSeenWeek`) – einmal, dann bleibt sie stehen. Wer schon vorher
   * dabei war, bekommt die früheste Woche, die sein Fortschritt kennt.
   */
  const firstSeenMissing = Boolean(profile) && !progressState.loading && !myProgress?.firstSeenWeek
  const seenPending =
    Boolean(profile) &&
    !itemsState.loading &&
    thisWeekAll.length > 0 &&
    (myProgress?.lastSeenWeek !== todayKey || firstSeenMissing)
  const firstSeenWeek = firstSeenMissing ? myWeeks[0] : undefined
  useEffect(() => {
    if (!seenPending || !profile) return
    writes
      .setImpulseLastSeenWeek(
        { uid: profile.id, displayName: profile.displayName },
        todayKey,
        firstSeenWeek,
      )
      .catch((error) => console.error('[impuls] Woche konnte nicht vermerkt werden:', error))
  }, [seenPending, profile, todayKey, firstSeenWeek, writes])

  /*
   * Die stille Statistik: Zeit und Besuche, nur auf diesem Gerät
   * (`lib/impulseUsage`). Die Uhr läuft, solange die Seite offen ist;
   * die Feed-Karten vermerkt der Feed selbst (`onDeckActive`), die
   * Räume und die Übersicht vermerkt dieser Effekt.
   */
  /* Die Vorschau zählt nicht mit – sie ist kein Besuch. */
  const counted = Boolean(uid) && !preview
  useEffect(() => {
    if (!counted) return
    return trackImpulseTime(uid)
  }, [counted, uid])
  useEffect(() => {
    if (!counted) return
    recordImpulseOpen(uid, roomKey ?? 'uebersicht')
  }, [counted, uid, roomKey])

  /* ---------------- Der Feed: die Karten der Woche ---------------- */

  const deckWeekItems = viewWeek === todayKey ? thisWeekAll : itemsForWeek(visible, viewWeek)

  /**
   * Im Feed liegt das Bild als Fläche hinter der Karte (siehe
   * `mediaLayer`) – die Karte selbst zeigt es darum nicht ein zweites
   * Mal. Ausserhalb des Feeds, in den Räumen und im Rückblick, bleibt
   * das Bild im Inhalt, wo es hingehört.
   */
  const withoutImage = (item: ImpulseItem): ImpulseItem =>
    item.image?.url ? { ...item, image: null } : item

  /**
   * Die Fläche einer Karte – das Bild oder das Video, über den ganzen
   * Bildschirm. Wer eine hat, bekommt im Feed die zweistufige Karte:
   * erst die Fläche allein, dann der Text darüber.
   *
   * Die Ausnahme ist die Video-Karte: Sie steht standardmässig für sich
   * allein, ein Wisch, und weiter geht's – der Text kommt nur dazu, wenn
   * die Redaktion ihn will (`videoTextPage`).
   */
  const mediaLayer = (
    item: ImpulseItem,
  ): { media: ImpulseDeckCard['media']; mediaOnly: boolean } => {
    const source = impulseVideoSource(item.videoUrl)
    if (item.kind === 'video' && source) {
      return {
        media: ({ active }) => (
          <ImpulseVideoPlayer
            source={source}
            poster={item.image?.url ?? null}
            title={item.title}
            active={active}
          />
        ),
        mediaOnly: !item.videoTextPage,
      }
    }
    if (item.image?.url) {
      const image = item.image
      return { media: () => <ImpulseImageBackdrop image={image} />, mediaOnly: false }
    }
    return { media: null, mediaOnly: false }
  }

  /** Eine Karte der laufenden Woche – lebendig, mit allen Handgriffen. */
  const liveNode = (raw: ImpulseItem) => {
    const item = withoutImage(raw)
    switch (item.kind) {
      case 'quiz':
      case 'bilderraetsel':
        return (
          <QuizCard
            item={item}
            answer={answerFor(item)}
            answers={answersOf(item)}
            plain
            progressDocs={progressState.data}
          />
        )
      case 'umfrage':
        return (
          <ImpulsePollCard
            item={item}
            answers={answersOf(item)}
            plain
            progressDocs={progressState.data}
          />
        )
      case 'puzzle':
        return (
          <ImpulsePuzzleCard
            item={item}
            answer={answerFor(item)}
            answers={answersOf(item)}
            plain
            progressDocs={progressState.data}
          />
        )
      case 'video':
        return <VideoDeckCard item={item} progressDocs={progressState.data} />
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
            progressDocs={progressState.data}
          />
        )
      case 'spiel':
        return (
          <ImpulseGameCard
            item={item}
            scores={scoresData.filter((score) => score.itemId === item.id)}
            gameName={myProgress?.gameName ?? ''}
            ownScoreIds={myScoreIds}
            plain
          />
        )
      default:
        return <WocheDeckCard item={item} progressDocs={progressState.data} />
    }
  }

  /**
   * Eine Karte aus dem Rückblick – zum Nachlesen, nicht zum Nachholen:
   * Aufgaben einer vergangenen Woche lassen sich nicht rückwirkend
   * abhaken, das hielte weder Serie noch Beteiligung sauber. Nur Amen
   * und Merken auf Feed-Karten bleiben lebendig – sie hängen am Inhalt,
   * nicht an der Woche.
   */
  const pastNode = (raw: ImpulseItem) => {
    const item = withoutImage(raw)
    switch (item.kind) {
      case 'quiz':
      case 'bilderraetsel':
        return <PastQuiz item={item} answer={answerFor(item)} />
      case 'umfrage':
        return (
          <ImpulsePollCard
            item={item}
            answers={answersOf(item)}
            plain
            closed
            progressDocs={progressState.data}
          />
        )
      case 'puzzle':
        return (
          <ImpulsePuzzleCard
            item={item}
            answer={answerFor(item)}
            answers={answersOf(item)}
            plain
            closed
            progressDocs={progressState.data}
          />
        )
      case 'video':
        return <VideoDeckCard item={item} progressDocs={progressState.data} />

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
          <PastTask
            item={item}
            label="Teilen"
            note={myWeek(viewWeek).share === true ? 'besprochen' : null}
          />
        )
      case 'spiel':
        /* Der Endstand der Woche – gespielt wird nur in der laufenden. */
        return (
          <ImpulseGameCard
            item={item}
            scores={scoresData.filter((score) => score.itemId === item.id)}
            gameName={myProgress?.gameName ?? ''}
            ownScoreIds={myScoreIds}
            closed
            plain
          />
        )
      default:
        /* Amen und Merken bleiben auch rückblickend lebendig – sie
           hängen am Inhalt, nicht an der Woche. */
        return <WocheDeckCard item={item} progressDocs={progressState.data} />
    }
  }

  /* Der Feed in der Reihenfolge der Redaktion – über alle Arten hinweg,
     das Wochenthema vorn, die Teilen-Aufgabe hinten (`deckOrder`). */
  const deckEntries: ImpulseDeckCard[] = deckOrder(
    deckWeekItems.filter((item) => isDeckKind(item.kind)),
  ).map((item) => {
        /* Die Vertiefung einer noch offenen Quiz-, Rätsel-, Puzzle- oder
           Umfragekarte bleibt zu – sie könnte die Lösung verraten oder
           die Stimme lenken. Mit der Antwort (und im Rückblick) geht sie
           auf; der Pfeil «Vertiefen» erscheint dann als kleine Belohnung. */
        const spoiler =
          viewWeek === todayKey &&
          (item.kind === 'quiz' ||
            item.kind === 'bilderraetsel' ||
            item.kind === 'puzzle' ||
            item.kind === 'umfrage') &&
          !answerFor(item)
        const { media, mediaOnly } = mediaLayer(item)
        return {
          id: `${item.kind}-${item.id}`,
          itemId: item.id,
          section: IMPULSE_KIND_SECTION[item.kind as ImpulseDeckKind],
          node: viewWeek === todayKey ? liveNode(item) : pastNode(item),
          /* Bild oder Video füllen den Bildschirm – und machen aus der
             Karte zwei Bühnen: erst die Fläche, dann der Text darüber.
             Nur die Video-Karte bleibt einstufig, wenn sie keinen Text
             über dem Video tragen soll. */
          media,
          mediaOnly,
          /* Die zweite Seite der Karte – nur wenn die Redaktion eine
             Vertiefung erfasst hat; sonst gibt es sie gar nicht. */
          deepening: item.deepening && !spoiler ? <ImpulseDeepeningCard item={item} /> : null,
        }
      })
  /* Gemischt bleibt gemischt: Der Schlüssel Konto+Woche hält den Feed
     die Woche über in derselben Ordnung (siehe `seededShuffle`) – nur
     das Wochenthema bleibt immer die erste Karte und das Minispiel die
     letzte. */
  const wocheEntries = deckEntries.filter((card) => card.section === 'woche')
  const gameEntries = deckEntries.filter((card) => card.section === 'spiel')
  const restEntries = deckEntries.filter(
    (card) => card.section !== 'woche' && card.section !== 'spiel',
  )
  const deckCards =
    order === 'zufall'
      ? [...wocheEntries, ...seededShuffle(restEntries, `${uid}:${viewWeek}`), ...gameEntries]
      : deckEntries

  /* ---------------- Sprünge in den Feed ---------------- */

  /* Der Einstieg in den Feed: über eine Karten-Adresse (`/anti-doom/quiz` –
     App-Menü oder Lesezeichen), aus «Gemerkt» oder über «Weiter swipen»
     bei der ersten offenen Karte. Der Feed liest das Ziel nur beim
     Aufgehen – vor dem ersten Bild, ohne Anlauf und ohne an den Karten
     dazwischen vorbeizurauschen. */
  const initialDeckTarget: ImpulseDeckTarget | null =
    !isImpulseSection(bereich) || !isDeckSection(bereich)
      ? null
      : state?.cardId
        ? { section: bereich, cardId: state.cardId }
        : bereich === 'feed' && state?.feedItem
          ? { section: 'feed', cardId: `feed-${state.feedItem}` }
          : { section: bereich }

  /* Spätere Sprünge: Jeder Griff ins Menü setzt ein neues Zielobjekt –
     auch derselbe Punkt zweimal hintereinander fährt wieder hin. */
  const [deckTarget, setDeckTarget] = useState<ImpulseDeckTarget | null>(null)
  /* Das Wappen gross – ein Tipp aufs kleine Wappen oben rechts im Feed. */
  const [crestOpen, setCrestOpen] = useState(false)
  const firstNav = useRef(true)
  /* Eine Navigation, die gar keine sein soll: das Schliessen der
     Einstellungen (siehe `closeSettings`). Die Karte im Bild bleibt
     stehen, statt an den Anfang ihres Bereichs zu fahren. */
  const stayPut = useRef(false)
  useEffect(() => {
    if (firstNav.current) {
      // Der Aufbau ist bereits über `initialDeckTarget` positioniert.
      firstNav.current = false
      return
    }
    if (stayPut.current) {
      stayPut.current = false
      return
    }
    if (!isImpulseSection(bereich) || !isDeckSection(bereich)) return
    const navState = (location.state ?? null) as ImpulsLocationState | null
    if (navState?.feedWeek) {
      setWeekOverride(navState.feedWeek === todayKey ? null : navState.feedWeek)
    }
    setDeckTarget({
      section: bereich,
      cardId:
        navState?.cardId ??
        (bereich === 'feed' && navState?.feedItem ? `feed-${navState.feedItem}` : null),
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
  /* Angeschaut ist eine Karte erst, wenn sie einen Moment im Bild stand
     (`SEEN_DWELL_MS`) – der Wecker wird bei jedem Kartenwechsel neu
     gestellt, und wer weiterwischt, bevor er klingelt, hat nur
     vorbeigeschaut. */
  const seenTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (seenTimer.current !== null) window.clearTimeout(seenTimer.current)
    },
    [],
  )
  const onDeckActive = (card: ImpulseDeckCard) => {
    if (counted && !recordedDeckSections.current.has(card.section)) {
      recordedDeckSections.current.add(card.section)
      recordImpulseOpen(uid, card.section)
    }
    if (seenTimer.current !== null) window.clearTimeout(seenTimer.current)
    seenTimer.current = window.setTimeout(() => {
      seenTimer.current = null
      markDeckCardSeen(card)
    }, SEEN_DWELL_MS)
  }

  /** Die Karte stand lange genug im Bild – vermerken, einmal je Besuch. */
  const markDeckCardSeen = (card: ImpulseDeckCard) => {
    if (!profile || viewWeek !== todayKey) return

    const itemId = card.itemId
    if (itemId && !recordedCards.current.has(itemId) && !seenCardIds.has(itemId)) {
      recordedCards.current.add(itemId)
      writes
        .markImpulseCardSeen(
          { uid: profile.id, displayName: profile.displayName },
          todayKey,
          itemId,
        )
        .catch((error) => {
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
    writes
      .markImpulseFeedDone({ uid: profile.id, displayName: profile.displayName }, todayKey)
      .catch((error) => {
        console.error(error)
        feedMarkPending.current = false
      })
  }

  /** Der Wisch nach links: die Vertiefung war im Bild – einmal vermerken. */
  const onDeckDeepening = (card: ImpulseDeckCard) => {
    const itemId = card.itemId
    if (!profile || viewWeek !== todayKey || !itemId) return
    if (recordedDeepenings.current.has(itemId) || seenDeepeningIds.has(itemId)) return
    recordedDeepenings.current.add(itemId)
    writes
      .markImpulseDeepeningSeen(
        { uid: profile.id, displayName: profile.displayName },
        todayKey,
        itemId,
      )
      .catch((error) => {
        console.error(error)
        recordedDeepenings.current.delete(itemId)
      })
  }

  /* ---------------- Navigation zwischen den Räumen ---------------- */

  /** Von der Kachel in den Raum – ein Schritt in der Chronik. */
  const openSection = (key: ImpulseSectionKey, origin?: ScreenOrigin) =>
    navigate(`/anti-doom/${key}`, { state: origin ? { origin } : undefined })

  /**
   * Der Feed geht auf – bei der ersten Karte oder, mit `cardId`, genau
   * dort (der Weg von «Weiter swipen» zur ersten offenen Karte).
   */
  const openFeed = (origin?: ScreenOrigin, cardId?: string) =>
    navigate('/anti-doom/woche', {
      state: origin || cardId ? { origin, cardId } : undefined,
    })

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

  /* Die Einstellungen schliessen dorthin zurück, wo sie geöffnet wurden:
     auf den Bereich unter dem Fenster – und ohne dessen Feed anzufahren,
     die Karte im Bild bleibt stehen (`stayPut`). Wer sie aus einem
     anderen Teil der App heraus aufgeschlagen hat, landet auf der
     Übersicht des Bereichs, nicht wieder draussen. */
  const closeSettings = () => {
    stayPut.current = true
    navigate(beneath ? `/anti-doom/${beneath}` : '/anti-doom', { replace: true })
  }

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

  /* Die Aufgaben der laufenden Woche – in der Mission und in ihren Räumen. */
  const goalItem = thisWeekAll.find((item) => item.kind === 'wochenziel') ?? null
  const challengeItem = thisWeekAll.find((item) => item.kind === 'tageschallenge') ?? null
  const challengeDays = Math.min((myWeek(todayKey).days ?? []).length, 7)
  const missionTasks =
    goalItem || challengeItem ? (
      <ImpulseMissionTasks
        week={todayKey}
        goal={goalItem}
        goalDone={myWeek(todayKey).goal === true}
        challenge={challengeItem}
        challengeDays={myWeek(todayKey).days ?? []}
        onOpen={openSection}
      />
    ) : null

  /* -------------- Das Wappen: Sterne, Vermerk und Feier -------------- */

  /*
   * Der Tag, an dem das Wappen zuerst ganz dastand, wird vermerkt – daran
   * hängt der Stern «Vor Sonntag vollendet». Bis der Vermerk zurück ist,
   * gilt der heutige Tag, damit der Stern nicht einen Augenblick lang
   * fehlt.
   */
  const today = impulseWeekToday(todayKey, now)
  const crestCompletedOn = myWeek(todayKey).crest ?? (crestIsComplete ? today : null)
  const crestStars = impulseCrestStars({
    week: todayKey,
    complete: crestIsComplete,
    completedOn: crestCompletedOn,
    goal: goalItem ? myWeek(todayKey).goal === true : null,
    challengeDays: challengeItem ? challengeDays : null,
  })
  const crestMarkPending = Boolean(profile) && crestIsComplete && !myWeek(todayKey).crest
  useEffect(() => {
    if (!crestMarkPending || !profile) return
    writes
      .markImpulseCrest({ uid: profile.id, displayName: profile.displayName }, todayKey, today)
      .catch((error) => console.error('[impuls] Wappen konnte nicht vermerkt werden:', error))
  }, [crestMarkPending, profile, todayKey, today, writes])

  /* Die Feier: einmal je Woche und Gerät, sobald das Wappen ganz dasteht –
     auch wenn es auf einem anderen Gerät vollendet wurde. */
  const [storedCelebration, storeCelebration] = useLocalStorage<string>(
    'bss:impuls:wappen-gefeiert',
    '',
  )
  /* In der Vorschau zeigt sich die Feier bei jedem Besuch – das Gerät
     merkt sich davon nichts. */
  const celebrated = preview ? preview.data.celebrated : storedCelebration
  const setCelebrated = preview ? preview.setCelebrated : storeCelebration
  const celebrationTag = `${uid}:${todayKey}`
  const celebrating = Boolean(uid) && crestIsComplete && celebrated !== celebrationTag
  /*
   * Hat die Redaktion die Woche zurückgesetzt, steht das Wappen wieder leer
   * da – ohne den Tag, an dem es vollendet war (`crest`). Dann gilt auch
   * die Feier auf diesem Gerät nicht mehr: Wer es neu baut, wird neu
   * gefeiert.
   */
  const celebrationStale =
    Boolean(uid) &&
    !progressState.loading &&
    celebrated === celebrationTag &&
    !crestIsComplete &&
    !myWeek(todayKey).crest
  useEffect(() => {
    if (celebrationStale) setCelebrated('')
  }, [celebrationStale, setCelebrated])

  /*
   * Das Zurücksetzen kommt beim eigenen Fortschritt sofort an: Die Woche
   * verschwindet daraus. Die gelöschten Antworten, Beiträge und
   * Ranglisten-Einträge sähe der schrittweise Abgleich dagegen erst beim
   * nächsten Start – darum werden sie dann gleich frisch gelesen. Eine
   * ganze Woche entfernt allein die Redaktion; das eigene Abhaken ändert
   * bloss, was darin steht.
   */
  const hasWeekProgress = Boolean(myProgress?.weeks?.[todayKey])
  const weekProgressSeen = useRef<{ uid: string; week: string; has: boolean } | null>(null)
  useEffect(() => {
    if (preview || progressState.loading || !myProgress) return
    const before = weekProgressSeen.current
    if (before?.uid === uid && before.week === todayKey && before.has && !hasWeekProgress) {
      refreshImpulseResponses()
    }
    weekProgressSeen.current = { uid, week: todayKey, has: hasWeekProgress }
  }, [preview, progressState.loading, myProgress, uid, todayKey, hasWeekProgress])

  /* Die erste Karte, an der noch etwas fehlt – dort setzt «Weiter swipen» an. */
  const firstOpenStep = crestSteps.find((step) => !step.done) ?? null
  const deckIdOf = (step: Pick<ImpulseCrestStep, 'kind' | 'itemId'>) =>
    `${step.kind}-${step.itemId}`

  /* Die Sammlung: das Wappen jeder Woche mit Karten – die laufende zuerst. */
  const crestHistory = [todayKey, ...pastWeeks].flatMap((week) => {
    const items = itemsForWeek(visible, week)
    const cards = deckOrder(items.filter((item) => isDeckKind(item.kind)))
    if (cards.length === 0) return []
    const state = myWeek(week)
    const steps = impulseCrestSteps({
      cards,
      seen: new Set(state.cards ?? []),
      deepened: new Set(state.deepened ?? []),
      answered: myAnswered,
      shared: state.share === true,
    })
    const theme = items.find((item) => item.kind === 'impuls')
    const complete = crestComplete(steps)
    return [
      {
        week,
        crest: theme?.crest ?? defaultCrest(week),
        title: theme?.title ?? formatWeekRange(week),
        done: steps.filter((step) => step.done).length,
        total: steps.length,
        complete,
        stars: impulseCrestStars({
          week,
          complete,
          completedOn: state.crest ?? null,
          goal: items.some((item) => item.kind === 'wochenziel') ? state.goal === true : null,
          challengeDays: items.some((item) => item.kind === 'tageschallenge')
            ? Math.min((state.days ?? []).length, 7)
            : null,
        }),
      },
    ]
  })

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
    return (
      <Navigate to="/anti-doom" replace state={preview ? { vorschau: preview.week } : undefined} />
    )
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
            timeline={myWeeks}
            progress={myProgress}
            answers={myAnswers}
            commentsCount={myComments.length}
            favoritesCount={favoriteItems.length}
            milestones={milestones}
            crests={crestHistory}
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
                    case 'umfrage':
                      return (
                        <PastPoll
                          key={item.id}
                          item={item}
                          answers={answersOf(item)}
                          mine={answerFor(item)}
                        />
                      )
                    case 'puzzle':
                      return <PastPuzzle key={item.id} item={item} answer={answerFor(item)} />
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
          viewWeek === todayKey ? (
            <MissionHero
              item={themeItem}
              week={todayKey}
              crest={crestDesign}
              done={crestDone}
              total={crestSteps.length}
              stars={crestStars}
              daysLeft={daysUntilSunday(todayKey, now)}
              completers={crestNames
                .filter((person) => person.uid !== uid)
                .map((person) => person.firstName)}
              resumeCardId={firstOpenStep ? deckIdOf(firstOpenStep) : null}
              onOpen={openFeed}
              tasks={missionTasks}
            />
          ) : (
            (() => {
              const entry = crestHistory.find((crest) => crest.week === viewWeek)
              return (
                <MissionHero
                  item={deckWeekItems.find((item) => item.kind === 'impuls') ?? null}
                  week={viewWeek}
                  crest={entry?.crest ?? defaultCrest(viewWeek)}
                  done={entry?.done ?? 0}
                  total={entry?.total ?? deckCards.length}
                  stars={entry?.stars ?? null}
                  daysLeft={null}
                  completers={[]}
                  resumeCardId={null}
                  onOpen={openFeed}
                />
              )
            })()
          )
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

        {/* Eine Woche ohne Karten, aber mit Aufgaben: Ohne Mission stehen
            Wochenziel und Tages-Challenge für sich. */}
        {deckCards.length === 0 && viewWeek === todayKey && missionTasks && (
          <div className="card animate-imp-rise mt-3 p-1.5" style={{ animationDelay: '60ms' }}>
            {missionTasks}
          </div>
        )}

        {/* Die Kacheln unter dem Wochenthema – die Werkzeuge, bewusst nicht
            Teil des Feeds: Im Vollbild sind sie weg. Die Aufgaben der Woche
            stehen in der Mission selbst. */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SectionTile
            section="fortschritt"
            status={
              streak.current > 0
                ? `${streak.current} ${streak.current === 1 ? 'Woche' : 'Wochen'} in Folge · ${milestonesEarned} von ${milestones.length} Meilensteinen`
                : 'Deine Serie beginnt mit dem ersten Haken.'
            }
            delay="60ms"
            onOpen={openSection}
          />
          <SectionTile
            section="gemerkt"
            status={
              favoriteItems.length > 0
                ? `${favoriteItems.length} ${favoriteItems.length === 1 ? 'Karte' : 'Karten'} gesammelt`
                : 'Auf den Feed-Karten wartet «Merken».'
            }
            delay="90ms"
            onOpen={openSection}
          />
          <div className="col-span-2">
            <SectionTile
              section="mitmachen"
              status="Deine Idee für jede Kartenart – auf Wunsch mit deinem Namen auf der Karte."
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
              delay="120ms"
              onOpen={openSection}
            />
          </div>
        </div>

        {!itemsState.loading && (
          <div className="animate-imp-rise mt-3" style={{ animationDelay: '150ms' }}>
            <GroupCard participants={participants} total={total} crestNames={crestNames} />
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
          doneItemIds={viewWeek === todayKey ? doneItemIds : null}
          crest={
            viewWeek === todayKey ? (
              <ImpulseCrestEmblem
                crest={crestDesign}
                week={todayKey}
                done={crestDone}
                total={crestSteps.length}
                size={18}
                showMotto={false}
              />
            ) : null
          }
          onCrest={viewWeek === todayKey ? () => setCrestOpen(true) : undefined}
          finale={
            <FeedFinale
              week={viewWeek}
              isCurrent={viewWeek === todayKey}
              crest={
                viewWeek === todayKey
                  ? {
                      design: crestDesign,
                      done: crestDone,
                      total: crestSteps.length,
                      stars: crestStars,
                      missing: crestSteps.filter((step) => !step.done),
                    }
                  : null
              }
              onJump={(step) =>
                setDeckTarget({
                  section: IMPULSE_KIND_SECTION[step.kind as ImpulseDeckKind],
                  cardId: deckIdOf(step),
                })
              }
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
      {feedOpen && viewWeek === todayKey && (
        <CrestProgressModal
          open={crestOpen}
          onClose={() => setCrestOpen(false)}
          week={todayKey}
          crest={crestDesign}
          steps={crestSteps}
          stars={crestStars}
          onJump={(step) => {
            setCrestOpen(false)
            setDeckTarget({
              section: IMPULSE_KIND_SECTION[step.kind as ImpulseDeckKind],
              cardId: deckIdOf(step),
            })
          }}
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

      <ImpulseCrestCelebration
        open={celebrating}
        crest={crestDesign}
        week={todayKey}
        total={crestSteps.length}
        stars={crestStars}
        onClose={() => setCelebrated(celebrationTag)}
      />

      <ImpulseSettingsModal
        open={settingsOpen}
        onClose={closeSettings}
        look={look}
        onLook={setLook}
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
/* Die Mission der Woche                                               */
/* ------------------------------------------------------------------ */

/**
 * Das Herzstück des Dashboards: die Mission der Woche.
 *
 * Oben, worauf die Woche zuläuft – die Lektion am Sonntag und wie viele
 * Tage es noch sind. In der Mitte das Wochen-Wappen, das mit jeder
 * geschafften Karte wächst, darunter der Stand als Balken. Der grosse
 * Knopf führt in den Feed: beim ersten Mal an den Anfang, danach
 * genau zur ersten Karte, an der noch etwas fehlt. Dasselbe tut ein Tipp
 * aufs Wappen oder irgendwo sonst auf die Kachel.
 *
 * Unter dem Knopf stehen die Aufgaben der Woche (`tasks`): Wochenziel und
 * Tages-Challenge, gleich abhakbar – sie bringen die beiden übrigen Sterne.
 * Und wer aus dem Kollegium sein Wappen schon hat, steht klein darunter –
 * Anerkennung, kein Wettrennen.
 *
 * Die Farben bringt das Wappen der Woche mit: Jede Woche fühlt sich ein
 * wenig anders an.
 */
function MissionHero({
  item,
  week,
  crest,
  done,
  total,
  stars,
  daysLeft,
  completers,
  resumeCardId,
  onOpen,
  tasks = null,
}: {
  item: ImpulseItem | null
  week: string
  crest: ImpulseCrest
  done: number
  total: number
  stars: ImpulseCrestStars | null
  /** Tage bis Sonntag – `null` im Rückblick. */
  daysLeft: number | null
  /** Vornamen derer, die ihr Wappen schon haben – ohne mich. */
  completers: string[]
  /** Die erste Karte, an der noch etwas fehlt – `null`, wenn alles geschafft ist. */
  resumeCardId: string | null
  onOpen: (origin: ScreenOrigin, cardId?: string) => void
  /** Die Aufgaben der Woche – Wochenziel und Tages-Challenge (`ImpulseMissionTasks`). */
  tasks?: React.ReactNode
}) {
  const colors = CREST_PALETTES[crest.palette] ?? CREST_PALETTES.smaragd
  const complete = total > 0 && done >= total
  const share = total > 0 ? Math.min(done / total, 1) : 0
  const live = daysLeft !== null

  /* Beim ersten Mal an den Anfang, danach zur ersten offenen Karte. */
  const resumeAt = done > 0 && resumeCardId ? resumeCardId : undefined
  /** Knopf und Wappen: Der Feed wächst aus ihrer Mitte. */
  const resume = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    onOpen({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, resumeAt)
  }
  /*
   * Ein Tipp irgendwo auf die Kachel öffnet den Feed wie der grosse Knopf –
   * von der Stelle aus, an der getippt wurde. Was ein eigenes Ziel hat,
   * bleibt bei sich: Knöpfe, Links und die Aufgaben der Woche. Und wer
   * bloss Text markiert, will nicht in den Feed.
   */
  const resumeFromCard = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('a, button, input, select, textarea, label, [data-mission-tasks]')) return
    if (window.getSelection()?.toString()) return
    onOpen({ x: event.clientX, y: event.clientY }, resumeAt)
  }

  return (
    <section
      onClick={resumeFromCard}
      className="card animate-imp-rise relative overflow-hidden rounded-3xl text-center"
    >
      {/* Der Schein der Woche – in den Farben ihres Wappens. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 65% at 50% 0%, ${colors.light}59, transparent 62%), radial-gradient(90% 55% at 50% 100%, ${colors.mid}26, transparent 70%)`,
        }}
      />
      <div className="relative px-5 pt-4 pb-6 sm:px-8">
        <div className="flex items-center justify-between gap-2 text-xs font-medium">
          <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
            {live ? 'Mission der Woche' : 'Rückblick'}
          </span>
          {live && daysLeft !== null && daysLeft >= 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900/[0.06] px-2.5 py-1 dark:bg-white/10">
              <CalendarClock className="size-3.5" aria-hidden />
              {daysLeft === 0
                ? 'Heute ist Sonntag'
                : daysLeft === 1
                  ? 'Morgen ist Sonntag'
                  : `${daysLeft} Tage bis Sonntag`}
            </span>
          )}
        </div>

        {item?.kicker && (
          <p
            className="mt-4 text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.mid }}
          >
            {item.kicker}
          </p>
        )}
        <h2 className={cn('text-2xl leading-tight font-bold text-balance sm:text-3xl', item?.kicker ? 'mt-1.5' : 'mt-4')}>
          {item ? item.title : 'Die Karten der Woche'}
        </h2>

        <button
          type="button"
          onClick={resume}
          className="mt-3 inline-block rounded-2xl transition active:scale-95"
          aria-label={complete ? 'Wappen ansehen – Feed öffnen' : 'Weiter am Wappen bauen – Feed öffnen'}
        >
          <ImpulseCrestEmblem
            crest={crest}
            week={week}
            done={done}
            total={total}
            stars={stars}
            size={168}
          />
        </button>

        <div className="mx-auto mt-1 max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
            <div
              className="imp-meter h-full w-full rounded-full"
              style={
                {
                  background: complete ? '#f59e0b' : colors.mid,
                  '--imp-share': String(share),
                } as React.CSSProperties
              }
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
            {complete
              ? 'Wappen vollendet – stark!'
              : total === 0
                ? 'Diese Woche hat noch keine Karten.'
                : `${done} von ${total} Karten geschafft – jede baut an deinem Wappen.`}
          </p>
        </div>

        {stars && (
          <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <CrestStar earned={stars.sunday} label="Vor Sonntag vollendet" />
            {stars.goal !== null && <CrestStar earned={stars.goal} label="Wochenziel" />}
            {stars.challenge !== null && <CrestStar earned={stars.challenge} label="7 Tage Challenge" />}
          </ul>
        )}

        <button
          type="button"
          onClick={resume}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full px-7 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110 active:scale-[0.97]"
          style={{ background: complete ? '#d97706' : colors.mid }}
        >
          {!live
            ? 'Feed dieser Woche ansehen'
            : done === 0
              ? 'Los geht’s'
              : complete
                ? 'Nochmal durchswipen'
                : 'Weiter swipen'}
          <ChevronRight className="size-4" aria-hidden />
        </button>

        {tasks && <div className="-mx-2 mt-6 sm:mx-0">{tasks}</div>}

        {item?.lesson?.label && (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Lektion:</span>{' '}
            {item.lesson.url ? (
              <a
                href={item.lesson.url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-400/60 underline-offset-2 hover:decoration-current"
              >
                {item.lesson.label}
              </a>
            ) : (
              item.lesson.label
            )}
          </p>
        )}

        {completers.length > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Shield className="size-3.5 text-amber-500" aria-hidden />
            {completers.length <= 2
              ? `${completers.join(' und ')} ${completers.length === 1 ? 'hat sein' : 'haben ihr'} Wappen schon.`
              : `${completers.slice(0, 2).join(', ')} und ${completers.length - 2} weitere haben ihr Wappen schon.`}
          </p>
        )}
      </div>
    </section>
  )
}

/** Ein Stern der Legende unter dem Wappen – golden, wenn er erreicht ist. */
function CrestStar({ earned, label }: { earned: boolean; label: string }) {
  return (
    <li className={cn('inline-flex items-center gap-1', earned && 'text-amber-600 dark:text-amber-300')}>
      <Star className={cn('size-3.5', earned && 'fill-current')} aria-hidden />
      <span className="sr-only">{earned ? 'Erreicht: ' : 'Offen: '}</span>
      {label}
    </li>
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
  crest,
  onJump,
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
  /** Das Wappen der laufenden Woche – `null` im Rückblick. */
  crest: {
    design: ImpulseCrest
    done: number
    total: number
    stars: ImpulseCrestStars
    /** Die Karten, an denen noch etwas fehlt – in Feed-Reihenfolge. */
    missing: ImpulseCrestStep[]
  } | null
  /** Zu einer Karte springen, an der noch etwas fehlt. */
  onJump: (step: ImpulseCrestStep) => void
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
  const complete = crest !== null && crest.total > 0 && crest.done >= crest.total
  return (
    <article className="px-1 text-center">
      {crest ? (
        <div className="flex justify-center">
          <ImpulseCrestEmblem
            crest={crest.design}
            week={week}
            done={crest.done}
            total={crest.total}
            stars={crest.stars}
            size={complete ? 150 : 128}
          />
        </div>
      ) : (
        <span
          className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500 text-white"
          aria-hidden
        >
          <PartyPopper className="size-6" />
        </span>
      )}
      <h2 className="mt-4 text-2xl leading-snug font-semibold text-balance">
        {crest === null
          ? 'Alle Karten durchgeschaut – stark!'
          : complete
            ? 'Wappen vollendet – stark!'
            : `Noch ${crest.missing.length} ${crest.missing.length === 1 ? 'Karte' : 'Karten'} bis zu deinem Wappen`}
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {!isCurrent
          ? `Das war der Rückblick auf ${formatWeekRange(week)}.`
          : complete
            ? 'Das war Anti Doom für diese Woche. Am Montag liegt das nächste Wochenthema bereit – bis dahin:'
            : 'Hier fehlt noch etwas – ein Tipp führt direkt zur Karte:'}
      </p>

      {/* Was am Wappen noch fehlt – je Karte, mit dem Weg dorthin. */}
      {crest && !complete && crest.missing.length > 0 && (
        <div className="mt-4 space-y-1.5 text-left">
          {crest.missing.map((step) => (
            <FinaleAction
              key={step.itemId}
              icon={IMPULSE_SECTIONS[IMPULSE_KIND_SECTION[step.kind as ImpulseDeckKind] ?? 'woche'].icon}
              label={step.title || IMPULSE_KIND_LABELS[step.kind]}
              hint={`${IMPULSE_KIND_LABELS[step.kind]} · ${step.missing.join(', ')}`}
              onClick={() => onJump(step)}
            />
          ))}
        </div>
      )}

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
          hint="Mitmach-Ecke: deine Idee – mit deinem Namen auf der Karte oder ohne."
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
/**
 * Das eigene Wappen der Woche, gross – nach einem Tipp aufs kleine Wappen
 * oben rechts im Feed.
 *
 * Wie weit es ist, welche Sterne schon leuchten und an welchen Karten noch
 * etwas fehlt; ein Tipp auf eine Karte schliesst das Fenster und springt
 * im Feed genau dorthin – derselbe Weg wie am Ende des Feeds.
 */
function CrestProgressModal({
  open,
  onClose,
  week,
  crest,
  steps,
  stars,
  onJump,
}: {
  open: boolean
  onClose: () => void
  week: string
  crest: ImpulseCrest
  /** Alle Karten des Wappens in Feed-Reihenfolge – geschafft oder nicht. */
  steps: ImpulseCrestStep[]
  stars: ImpulseCrestStars
  onJump: (step: ImpulseCrestStep) => void
}) {
  const total = steps.length
  const done = steps.filter((step) => step.done).length
  const complete = total > 0 && done >= total
  const missing = steps.filter((step) => !step.done)
  const starRows = [
    { label: 'Vor Sonntag vollendet', earned: stars.sunday },
    ...(stars.goal !== null ? [{ label: 'Wochenziel geschafft', earned: stars.goal }] : []),
    ...(stars.challenge !== null
      ? [{ label: 'Tages-Challenge an allen 7 Tagen', earned: stars.challenge }]
      : []),
  ]
  return (
    <Modal open={open} onClose={onClose} title="Dein Wappen" description={formatWeekRange(week)}>
      <div className="flex justify-center py-1">
        <ImpulseCrestEmblem
          crest={crest}
          week={week}
          done={done}
          total={total}
          stars={stars}
          size={200}
        />
      </div>
      <p className="mt-3 text-center text-lg font-semibold">
        {complete ? 'Wappen vollendet – stark!' : `${done} von ${total} Karten geschafft`}
      </p>
      <p className="mt-1 text-center text-sm text-slate-600 dark:text-slate-300">
        {complete
          ? 'Dein Wappen steht – und bleibt in deiner Sammlung.'
          : 'Jede geschaffte Karte färbt ein Stück. Ein Tipp auf eine Karte führt direkt hin.'}
      </p>
      <ul className="mx-auto mt-4 flex max-w-xs flex-col gap-1.5 text-sm">
        {starRows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <Star
              className={cn(
                'size-4 shrink-0',
                row.earned ? 'fill-amber-400 text-amber-500' : 'text-slate-400',
              )}
              aria-hidden
            />
            <span className={row.earned ? undefined : 'text-slate-500 dark:text-slate-400'}>
              {row.label}
            </span>
            <span className="sr-only">{row.earned ? '– geschafft' : '– noch offen'}</span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <div className="mt-5 space-y-1.5">
          <p className="hint font-medium">Noch offen</p>
          {missing.map((step) => (
            <FinaleAction
              key={step.itemId}
              icon={
                IMPULSE_SECTIONS[IMPULSE_KIND_SECTION[step.kind as ImpulseDeckKind] ?? 'woche'].icon
              }
              label={step.title || IMPULSE_KIND_LABELS[step.kind]}
              hint={`${IMPULSE_KIND_LABELS[step.kind]} · ${step.missing.join(', ')}`}
              onClick={() => onJump(step)}
            />
          ))}
        </div>
      )}
    </Modal>
  )
}

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
              <span className="font-medium">
                {comment.anonymous ? 'Anonym' : comment.firstName || '–'}
              </span>{' '}
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
      <ImpulseItemImage item={item} maxHeight="10rem" />
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

/**
 * Eine Umfrage aus einer früheren Woche – das Ergebnis steht offen da,
 * abgestimmt wird nicht mehr: Eine Stimme im Nachhinein zählte sonst
 * rückwirkend zur Beteiligung einer Woche, die vorbei ist.
 */
function PastPoll({
  item,
  answers,
  mine,
}: {
  item: ImpulseItem
  answers: ImpulseAnswer[]
  mine: ImpulseAnswer | null
}) {
  const poll = item.poll
  if (!poll) return null
  const votes = answers.filter((answer) => typeof answer.choiceIndex === 'number')
  const own = typeof mine?.choiceIndex === 'number' ? mine.choiceIndex : null
  const ownLabel =
    own === null
      ? null
      : poll.form === 'choice'
        ? (poll.options[own] ?? null)
        : `${own}${poll.unit ? ` ${poll.unit}` : ''}`
  return (
    <div>
      <p className="text-sm font-medium">{item.title}</p>
      <p className="hint mt-0.5">
        Umfrage · {votes.length} {votes.length === 1 ? 'Stimme' : 'Stimmen'}
        {ownLabel && ` · deine Wahl: ${ownLabel}`}
      </p>
      {poll.explanation && <p className="hint mt-0.5 whitespace-pre-line">{poll.explanation}</p>}
    </div>
  )
}

/** Ein Vers-Puzzle aus einer früheren Woche – der Vers steht offen da. */
function PastPuzzle({ item, answer }: { item: ImpulseItem; answer: ImpulseAnswer | null }) {
  if (!item.puzzle) return null
  return (
    <div>
      <p className="text-sm font-medium">{item.title}</p>
      <p className="hint mt-0.5">
        Vers: <span className="font-medium">{puzzleSolution(item.puzzle.text)}</span>
        {answer && (answer.correct ? ' · auf Anhieb gebaut' : ' · versucht')}
      </p>
      <div className="mt-1">
        <SourceLink item={item} />
      </div>
    </div>
  )
}
