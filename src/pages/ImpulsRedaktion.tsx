import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eraser,
  Eye,
  Pencil,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNow } from '@/hooks/useNow'
import {
  useImpulseAnswers,
  useImpulseComments,
  useImpulseItems,
  useImpulseSubmissions,
} from '@/hooks/useFirestore'
import { PageHeader } from '@/components/ui/Pickers'
import { AppMenuButton } from '@/components/AppMenuButton'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ImpulseItemForm } from '@/components/impulse/ImpulseItemForm'
import { ImpulseWeekPreview } from '@/components/impulse/ImpulseWeekPreview'
import { cn } from '@/lib/utils'
import {
  formatWeekRange,
  IMPULSE_KIND_ORDER,
  impulseWeekKey,
  itemsForWeek,
  planDifficultyCleanup,
  upcomingWeekKeys,
} from '@/lib/impulse'
import { IMPULSE_SECTIONS, type ImpulseSectionKey } from '@/lib/impulseSections'
import { planStarterItems } from '@/lib/impulseStarter'
import {
  applyDifficultyCleanup,
  createStarterItems,
  deleteImpulseSubmission,
  emptyImpulseItem,
  markImpulseSubmissionAccepted,
  submissionToInput,
  toImpulseInput,
  type ImpulseItemInput,
} from '@/services/impulse'
import {
  IMPULSE_KIND_LABELS,
  IMPULSE_SUBMISSION_KIND_LABELS,
  type ImpulseItem,
  type ImpulseKind,
  type ImpulseSubmission,
} from '@/lib/types'

/**
 * Die Redaktion des Bereichs «Anti Doom» – nur für Konten mit Redaktionsrecht
 * (`RequireImpulseEditor` in App.tsx; vorerst das Administrator-Konto).
 *
 * Zwei Blicke auf denselben Bestand, beide fürs Telefon gebaut: Der
 * **Wochenplan** zeigt je Woche kompakt, was da ist und was fehlt – jede
 * Lücke ist ein Knopf, der sie füllt, und die Vorschau zeigt die Woche so,
 * wie die AP's sie sehen werden. Darunter stehen **alle Karten nach Art
 * gruppiert** – alle Quizfragen beieinander, alle Bilderrätsel, alle
 * Feed-Karten und so fort: Ein Tipp auf eine Karte öffnet sie zum
 * Bearbeiten, «Neu» legt eine weitere ihrer Art an. Der Fragenpool (Ideen
 * ohne Woche) und Vergangenes wohnen in denselben Gruppen, statt eigene
 * Abschnitte zu füllen; Vergangenes bleibt zugeklappt, bis man es braucht.
 */
export function ImpulsRedaktion() {
  const { profile } = useAuth()
  const toast = useToast()
  const now = useNow()
  const itemsState = useImpulseItems()
  const answersState = useImpulseAnswers()
  const commentsState = useImpulseComments()
  const todayKey = impulseWeekKey(now)

  /* Die laufende Woche und die nächsten sieben – dazu alles, was noch
     weiter voraus schon geplant ist. */
  const weeks = useMemo(() => {
    const plan = upcomingWeekKeys(now, 8)
    const last = plan[plan.length - 1]
    const far = [
      ...new Set(
        itemsState.data
          .map((item) => item.week)
          .filter((week): week is string => typeof week === 'string' && week > last),
      ),
    ].sort()
    return [...plan, ...far]
  }, [now, itemsState.data])

  /* Zur Wahl im Formular: die laufende Woche und elf weitere. */
  const weekChoices = useMemo(() => upcomingWeekKeys(now, 12), [now])

  const [editor, setEditor] = useState<{
    itemId: string | null
    initial: ImpulseItemInput
    /** Gesetzt, wenn das Formular aus einer Einreichung entstand –
        nach dem Speichern wird sie als übernommen markiert. */
    fromSubmissionId?: string
  } | null>(null)
  const openNew = (kind: ImpulseKind, week: string | null) =>
    setEditor({
      itemId: null,
      initial: emptyImpulseItem(
        kind,
        week,
        // Arten mit mehreren Karten je Woche reihen sich hinten ein.
        MULTI_KIND_LIMITS[kind] && week
          ? itemsState.data.filter((item) => item.week === week && item.kind === kind).length + 1
          : null,
      ),
    })
  const openItem = (item: ImpulseItem) =>
    setEditor({ itemId: item.id, initial: toImpulseInput(item) })

  /* «Neu» in einer Gruppe: die nächste Woche, in der die Art noch Platz
     hat – sonst der Fragenpool. Die Woche bleibt im Formular wählbar. */
  const nextFreeWeek = (kind: ImpulseKind): string | null => {
    const limit = MULTI_KIND_LIMITS[kind] ?? 1
    return (
      weekChoices.find(
        (week) =>
          itemsState.data.filter((item) => item.week === week && item.kind === kind).length < limit,
      ) ?? null
    )
  }

  /* Die Wochen-Vorschau: die Woche so sehen, wie die AP's sie sehen werden. */
  const [previewWeek, setPreviewWeek] = useState<string | null>(null)

  /*
   * Das Startpaket: vier Wochen Inhalt aus den Schriften, mit einem Klick
   * eingespielt (siehe `lib/impulseStarter`). Der Kasten zeigt sich,
   * solange etwas aus dem Paket fehlt – dank der festen IDs holt ein
   * Klick genau das Fehlende nach und rührt Vorhandenes nicht an.
   */
  const [seeding, setSeeding] = useState(false)
  const starterPlans = useMemo(
    () => (itemsState.loading ? [] : planStarterItems(itemsState.data, todayKey)),
    [itemsState.loading, itemsState.data, todayKey],
  )
  const seedStarter = async () => {
    if (seeding || starterPlans.length === 0) return
    setSeeding(true)
    try {
      const outcome = await createStarterItems(starterPlans, profile?.id)
      const pooled = starterPlans.filter((plan) => plan.week === null).length
      const drafts = starterPlans.filter((plan) => plan.status === 'draft').length
      const draftNote =
        drafts > 0
          ? ` ${drafts} ${drafts === 1 ? 'Bilderrätsel wartet' : 'Bilderrätsel warten'} als Entwurf auf ihr Bild aus der Mediathek.`
          : ''
      toast.saved(
        pooled === 0
          ? `Startpaket eingespielt – vier Wochen sind geplant.${draftNote}`
          : `Startpaket eingespielt – ${starterPlans.length - pooled} Inhalte geplant, ${pooled} im Fragenpool (ihr Platz war schon belegt).${draftNote}`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Das Startpaket konnte nicht eingespielt werden.')
    } finally {
      setSeeding(false)
    }
  }

  /*
   * Aufräumen mit einem Klick: Karten, deren Hinweis noch eine
   * Schwierigkeitsansage trägt («Zum Aufwärmen», «Schon schwieriger»,
   * «Für Profis»), werden in der Datenbank bereinigt – der restliche
   * Hinweis bleibt. Der Kasten verschwindet, sobald nichts mehr ansteht.
   */
  const [cleaning, setCleaning] = useState(false)
  const cleanupPlans = useMemo(() => planDifficultyCleanup(itemsState.data), [itemsState.data])
  const runCleanup = async () => {
    if (cleaning || cleanupPlans.length === 0) return
    setCleaning(true)
    try {
      const outcome = await applyDifficultyCleanup(cleanupPlans)
      toast.saved(
        `Hinweise bereinigt – ${
          cleanupPlans.length === 1 ? 'eine Karte' : `${cleanupPlans.length} Karten`
        } angepasst.`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Die Hinweise konnten nicht bereinigt werden.')
    } finally {
      setCleaning(false)
    }
  }

  /* Antworten und Beiträge je Inhalt – für die Zahl an der Zeile und
     fürs Miträumen beim Löschen. */
  const answersByItem = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const answer of answersState.data) {
      const list = map.get(answer.itemId) ?? []
      list.push(answer.id)
      map.set(answer.itemId, list)
    }
    return map
  }, [answersState.data])

  const commentsByItem = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const comment of commentsState.data) {
      const list = map.get(comment.itemId) ?? []
      list.push(comment.id)
      map.set(comment.itemId, list)
    }
    return map
  }, [commentsState.data])

  const answerCount = (item: ImpulseItem) =>
    (answersByItem.get(item.id)?.length ?? 0) + (commentsByItem.get(item.id)?.length ?? 0)

  /* Die Mitmach-Ecke: offene Einreichungen prüfen und übernehmen – und
     die übernommenen bleiben aufklappbar stehen, als Chronik dessen, was
     die AP's beigesteuert haben. */
  const submissionsState = useImpulseSubmissions()
  const openSubmissions = submissionsState.data.filter((submission) => submission.status === 'open')
  const acceptedSubmissions = submissionsState.data.filter(
    (submission) => submission.status === 'accepted',
  )
  const [showAccepted, setShowAccepted] = useState(false)
  const [removeSubmission, setRemoveSubmission] = useState<ImpulseSubmission | null>(null)
  const acceptSubmission = (submission: ImpulseSubmission) =>
    setEditor({
      itemId: null,
      initial: submissionToInput(submission),
      fromSubmissionId: submission.id,
    })

  return (
    <>
      {/* Auch die Redaktion lebt im Anti-Doom-Vollbild (siehe Layout): Der Kopf
          rückt in die Mittelspalte, der Menüknopf ersetzt die Kopfzeile. */}
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Anti-Doom-Redaktion"
          subtitle="Wochenplan und alle Karten nach Art"
          leading={<AppMenuButton />}
          actions={
            <Link to="/anti-doom" className="btn-secondary">
              <Eye className="size-4" aria-hidden />
              <span className="hidden sm:inline">Zum Bereich</span>
              <span className="sr-only sm:hidden">Zum Bereich</span>
            </Link>
          }
        />
      </div>

      <div className="mx-auto max-w-3xl space-y-4">
        {/* ---------- Startpaket ---------- */}
        {starterPlans.length > 0 && (
          <section className="border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-950/30 card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
              Startpaket: vier Wochen aus den Schriften
            </h2>
            <p className="hint mt-1 mb-3">
              1 Nephi 3:7, das Haus auf dem Felsen, Lehre und Bündnisse 6:36 und Almas Samenkorn –
              die ersten drei Wochen voll ausgebaut: je drei Quizfragen und Bilderrätsel, zehn
              Feed-Karten (etliche mit Vertiefung), dazu Wochenthema, Wochenziel, Tages-Challenge,
              Frage der Woche und Teilen-Aufgabe. Alles «bereit» – einzig die Bilderrätsel kommen
              als <strong>Entwurf</strong>: Bild-Link aus der Mediathek der Kirche einsetzen (die
              Auflösung sagt, welches Bild gemeint ist), «bereit» anhaken, fertig. Eingespielt wird
              nur, was noch fehlt ({starterPlans.length}{' '}
              {starterPlans.length === 1 ? 'Inhalt' : 'Inhalte'}); Vorhandenes und belegte Plätze
              bleiben unangetastet.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void seedStarter()}
              disabled={seeding}
            >
              <Plus className="size-4" aria-hidden />
              {seeding ? 'Wird eingespielt …' : 'Einspielen'}
            </button>
          </section>
        )}

        {/* ---------- Aufräumen: Schwierigkeitsansagen ---------- */}
        {cleanupPlans.length > 0 && (
          <section className="card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Eraser className="size-4 text-slate-400" aria-hidden />
              Schwierigkeits-Hinweise entfernen
            </h2>
            <p className="hint mt-1 mb-3">
              {cleanupPlans.length === 1
                ? 'Eine Karte trägt'
                : `${cleanupPlans.length} Karten tragen`}{' '}
              im Hinweis noch «Zum Aufwärmen», «Schon schwieriger» oder «Für Profis». Ein Klick
              entfernt die Ansage in der Datenbank – der restliche Hinweis bleibt stehen, und wo
              nur die Ansage stand, steht künftig allein die Frage.
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void runCleanup()}
              disabled={cleaning}
            >
              <Eraser className="size-4" aria-hidden />
              {cleaning ? 'Wird bereinigt …' : 'Jetzt bereinigen'}
            </button>
          </section>
        )}

        {/* ---------- Wochenplan ---------- */}
        <section className="card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Wochenplan</h2>
          <p className="hint mt-1 mb-2">
            Ein Inhalt erscheint bei den AP’s, sobald er <strong>bereit</strong> ist und seine
            Woche beginnt – veröffentlicht wird durch den Kalender, nicht von Hand. Jede Lücke ist
            ein Knopf; vier bis sechs vorbereitete Wochen sind ein gutes Polster.
          </p>
          <ul className="divide-list">
            {weeks.map((week) => (
              <WeekRow
                key={week}
                week={week}
                todayKey={todayKey}
                items={itemsForWeek(itemsState.data, week)}
                onPreview={() => setPreviewWeek(week)}
                onCreate={(kind) => openNew(kind, week)}
              />
            ))}
          </ul>
        </section>

        {/* ---------- Alle Karten, nach Art gruppiert ---------- */}
        <div className="px-1 pt-2">
          <h2 className="text-sm font-semibold">Alle Karten</h2>
          <p className="hint mt-0.5">
            Nach Art gruppiert, die nächsten Wochen zuoberst. Eine Karte antippen öffnet sie zum
            Bearbeiten; «Neu» legt eine weitere dieser Art an – die Woche wählst du im Formular.
          </p>
        </div>
        {IMPULSE_KIND_ORDER.map((kind) => (
          <KindGroup
            key={kind}
            kind={kind}
            items={itemsState.data.filter((item) => item.kind === kind)}
            todayKey={todayKey}
            answerCount={answerCount}
            onOpen={openItem}
            onCreate={() => openNew(kind, nextFreeWeek(kind))}
          />
        ))}

        {/* ---------- Mitmach-Ecke ---------- */}
        {(openSubmissions.length > 0 || acceptedSubmissions.length > 0) && (
          <section className="card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Send className="size-4 text-slate-400" aria-hidden />
              Mitmach-Ecke
              <span className="hint font-normal">
                {openSubmissions.length === 0
                  ? 'nichts offen'
                  : `${openSubmissions.length} ${openSubmissions.length === 1 ? 'Einreichung offen' : 'Einreichungen offen'}`}
              </span>
            </h2>
            <p className="hint mt-1 mb-3">
              Hier landet alles, was die AP's einreichen – für jede Kartenart. «Übernehmen» öffnet
              das Formular in der eingereichten Art, vorbefüllt und mit «Eingereicht von …» – beim
              Speichern gilt die Einreichung als übernommen. Was nicht passt, wird still entfernt;
              die Person sieht keine Ablehnung.
            </p>
            {openSubmissions.length > 0 && (
              <ul className="divide-list">
                {openSubmissions.map((submission) => (
                  <li key={submission.id} className="py-3">
                    <p className="text-sm font-medium">
                      {submission.firstName}
                      <span className="hint font-normal">
                        {' · '}
                        {IMPULSE_SUBMISSION_KIND_LABELS[submission.kind]}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
                      {submission.text}
                    </p>
                    {submission.sourceLabel && (
                      <p className="hint mt-0.5">Quelle: {submission.sourceLabel}</p>
                    )}
                    {/* Die Handgriffe unter dem Text statt daneben – auf dem
                        Handy bleibt so die ganze Breite dem Vorschlag. */}
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => acceptSubmission(submission)}
                      >
                        <Check className="size-4" aria-hidden />
                        Übernehmen
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                        onClick={() => setRemoveSubmission(submission)}
                        aria-label={`Einreichung von ${submission.firstName} entfernen`}
                      >
                        <X className="size-4" aria-hidden />
                        Entfernen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Die Chronik: was schon übernommen wurde – zum Nachschauen,
                und zum Aufräumen, wenn sie einmal lang wird. */}
            {acceptedSubmissions.length > 0 && (
              <div
                className={
                  openSubmissions.length > 0
                    ? 'mt-2 border-t border-slate-200 pt-2 dark:border-slate-800'
                    : undefined
                }
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 py-1 text-left text-sm font-medium"
                  onClick={() => setShowAccepted((value) => !value)}
                  aria-expanded={showAccepted}
                >
                  {showAccepted ? (
                    <ChevronDown className="size-4 text-slate-400" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4 text-slate-400" aria-hidden />
                  )}
                  Bereits übernommen
                  <span className="hint font-normal">{acceptedSubmissions.length}</span>
                </button>
                {showAccepted && (
                  <ul className="divide-list mt-1">
                    {acceptedSubmissions.map((submission) => (
                      <li key={submission.id} className="flex items-start gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{submission.firstName}</span>
                            <span className="hint font-normal">
                              {' · '}
                              {IMPULSE_SUBMISSION_KIND_LABELS[submission.kind]}
                              {' · '}
                              <Check
                                className="inline size-3.5 text-emerald-600 dark:text-emerald-300"
                                aria-hidden
                              />{' '}
                              übernommen
                            </span>
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                            {submission.text}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost shrink-0 p-1.5"
                          onClick={() => setRemoveSubmission(submission)}
                          aria-label={`Einreichung von ${submission.firstName} wegräumen`}
                          title="Aus der Chronik wegräumen"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {editor && (
        <ImpulseItemForm
          key={editor.itemId ?? editor.fromSubmissionId ?? `neu-${editor.initial.kind}`}
          open
          onClose={() => setEditor(null)}
          itemId={editor.itemId}
          initial={editor.initial}
          weekChoices={weekChoices}
          answerIds={editor.itemId ? (answersByItem.get(editor.itemId) ?? []) : []}
          commentIds={editor.itemId ? (commentsByItem.get(editor.itemId) ?? []) : []}
          todayKey={todayKey}
          onSaved={
            editor.fromSubmissionId
              ? () => {
                  void markImpulseSubmissionAccepted(editor.fromSubmissionId!).catch((error) =>
                    console.error(error),
                  )
                }
              : undefined
          }
        />
      )}

      <ConfirmDialog
        open={removeSubmission !== null}
        onClose={() => setRemoveSubmission(null)}
        onConfirm={() => {
          if (!removeSubmission) return
          void deleteImpulseSubmission(removeSubmission.id).then((outcome) =>
            toast.saved('Einreichung entfernt.', outcome),
          )
          setRemoveSubmission(null)
        }}
        title="Einreichung entfernen?"
        message={
          <>
            Die Einreichung von {removeSubmission?.firstName} wird entfernt.{' '}
            {removeSubmission?.firstName} sieht keine Ablehnung – sie verschwindet einfach aus der
            eigenen Liste.
          </>
        }
        confirmLabel="Entfernen"
        danger
      />

      {previewWeek && (
        <ImpulseWeekPreview
          key={previewWeek}
          week={previewWeek}
          items={itemsForWeek(itemsState.data, previewWeek)}
          onClose={() => setPreviewWeek(null)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/** Welche Farb- und Zeichenwelt eine Kartenart trägt – die des Bereichs. */
const KIND_SECTION: Record<ImpulseKind, ImpulseSectionKey> = {
  impuls: 'woche',
  quiz: 'quiz',
  bilderraetsel: 'bilderraetsel',
  wochenziel: 'ziel',
  tageschallenge: 'challenge',
  frage: 'frage',
  feed: 'feed',
  teilen: 'teilen',
}

/** Die Gruppen-Überschriften – die Mehrzahl der Kartenart. */
const KIND_GROUP_LABELS: Record<ImpulseKind, string> = {
  impuls: 'Wochenthemen',
  quiz: 'Quizfragen',
  bilderraetsel: 'Bilderrätsel',
  wochenziel: 'Wochenziele',
  tageschallenge: 'Tages-Challenges',
  frage: 'Fragen der Woche',
  feed: 'Feed-Karten',
  teilen: 'Teilen-Aufgaben',
}

/**
 * Wie viele Karten einer Art in eine Woche passen – nur die Arten mit
 * mehreren Karten stehen hier. Der Feed bleibt endlich (höchstens zehn,
 * das Konzept plant etwa zehn je Woche), Quiz und Bilderrätsel dürfen je
 * drei tragen; alles andere gibt es einmal pro Woche.
 */
const MULTI_KIND_LIMITS: Partial<Record<ImpulseKind, number>> = {
  feed: 10,
  quiz: 3,
  bilderraetsel: 3,
}

/**
 * Eine Woche im Wochenplan – eine kompakte Zeile statt acht Kästen:
 * oben die Woche mit der Vorschau, darunter der Stand («5 Karten · 2
 * Entwürfe») und je fehlender Kartenart ein Knopf, der die Lücke füllt.
 * Bei den Mehrfach-Arten sagt der Knopf dazu, wie voll die Woche schon
 * ist («Quiz 1/3»); bearbeitet wird unten in den Gruppen.
 */
function WeekRow({
  week,
  todayKey,
  items,
  onPreview,
  onCreate,
}: {
  week: string
  todayKey: string
  items: ImpulseItem[]
  onPreview: () => void
  onCreate: (kind: ImpulseKind) => void
}) {
  const drafts = items.filter((item) => item.status === 'draft').length
  const gaps = IMPULSE_KIND_ORDER.map((kind) => ({
    kind,
    count: items.filter((item) => item.kind === kind).length,
    limit: MULTI_KIND_LIMITS[kind] ?? 1,
  })).filter((gap) => gap.count < gap.limit)

  return (
    <li className="py-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {formatWeekRange(week)}
          {week === todayKey && (
            <span className="text-brand-700 dark:text-brand-300"> · diese Woche</span>
          )}
        </p>
        <button
          type="button"
          className="btn-ghost btn-sm -me-1 shrink-0"
          onClick={onPreview}
          title="Die Woche so sehen, wie die AP’s sie sehen werden"
        >
          <Eye className="size-4" aria-hidden />
          <span className="hidden sm:inline">Vorschau</span>
          <span className="sr-only sm:hidden">Vorschau</span>
        </button>
      </div>
      <p className="hint mt-0.5">
        {items.length === 0
          ? 'Noch nichts geplant.'
          : `${items.length} ${items.length === 1 ? 'Karte' : 'Karten'}`}
        {drafts > 0 && (
          <span className="text-amber-700 dark:text-amber-300">
            {' · '}
            {drafts === 1 ? '1 Entwurf' : `${drafts} Entwürfe`}
          </span>
        )}
      </p>
      {gaps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gaps.map(({ kind, count, limit }) => (
            <button
              key={kind}
              type="button"
              onClick={() => onCreate(kind)}
              className="hint mt-0 inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
              aria-label={`${IMPULSE_KIND_LABELS[kind]} für ${formatWeekRange(week)} anlegen`}
            >
              <Plus className="size-3.5" aria-hidden />
              {IMPULSE_KIND_LABELS[kind]}
              {count > 0 && (
                <span className="tabular text-slate-400 dark:text-slate-500">
                  {count}/{limit}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

/**
 * Eine Kartenart als Gruppe: alle ihre Karten untereinander, nach Woche
 * gebündelt – die nächsten Wochen zuoberst, dann der Fragenpool, und
 * Vergangenes zugeklappt am Ende. Jede Zeile öffnet die Karte zum
 * Bearbeiten, «Neu» im Kopf legt eine weitere dieser Art an.
 */
function KindGroup({
  kind,
  items,
  todayKey,
  answerCount,
  onOpen,
  onCreate,
}: {
  kind: ImpulseKind
  items: ImpulseItem[]
  todayKey: string
  answerCount: (item: ImpulseItem) => number
  onOpen: (item: ImpulseItem) => void
  onCreate: () => void
}) {
  const theme = IMPULSE_SECTIONS[KIND_SECTION[kind]]
  const [showPast, setShowPast] = useState(false)

  const byOrder = (a: ImpulseItem, b: ImpulseItem) =>
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
    (a.title || '').localeCompare(b.title || '', 'de')

  /* Laufende und kommende Wochen, nach Woche gebündelt. */
  const upcomingWeeks = [
    ...new Set(
      items
        .map((item) => item.week)
        .filter((week): week is string => typeof week === 'string' && week >= todayKey),
    ),
  ].sort()
  const pool = items.filter((item) => item.week === null).sort(byOrder)
  const past = items
    .filter((item) => typeof item.week === 'string' && item.week < todayKey)
    .sort((a, b) => (b.week as string).localeCompare(a.week as string) || byOrder(a, b))

  const activeCount = items.length - past.length

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span
          className={cn('grid size-8 shrink-0 place-items-center rounded-lg', theme.iconBox)}
          aria-hidden
        >
          <theme.icon className="size-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {KIND_GROUP_LABELS[kind]}
          {activeCount > 0 && <span className="hint font-normal"> {activeCount}</span>}
        </h3>
        <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          Neu
        </button>
      </div>

      {activeCount === 0 && past.length === 0 && (
        <button
          type="button"
          onClick={onCreate}
          className="hint mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-3 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
        >
          <Plus className="size-4" aria-hidden />
          Erste {IMPULSE_KIND_LABELS[kind]} anlegen
        </button>
      )}

      {upcomingWeeks.map((week) => (
        <div key={week} className="mt-3">
          <p className="hint mb-0.5 font-medium">
            {formatWeekRange(week)}
            {week === todayKey && (
              <span className="text-brand-700 dark:text-brand-300"> · diese Woche</span>
            )}
          </p>
          <ul className="divide-list">
            {items
              .filter((item) => item.week === week)
              .sort(byOrder)
              .map((item) => (
                <li key={item.id}>
                  <CardRow item={item} answerCount={answerCount(item)} onOpen={onOpen} />
                </li>
              ))}
          </ul>
        </div>
      ))}

      {pool.length > 0 && (
        <div className="mt-3">
          <p className="hint mb-0.5 font-medium">Fragenpool – noch ohne Woche</p>
          <ul className="divide-list">
            {pool.map((item) => (
              <li key={item.id}>
                <CardRow item={item} answerCount={answerCount(item)} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-800">
          <button
            type="button"
            className="flex w-full items-center gap-2 py-1 text-left text-sm font-medium"
            onClick={() => setShowPast((value) => !value)}
            aria-expanded={showPast}
          >
            {showPast ? (
              <ChevronDown className="size-4 text-slate-400" aria-hidden />
            ) : (
              <ChevronRight className="size-4 text-slate-400" aria-hidden />
            )}
            Vergangene
            <span className="hint font-normal">{past.length}</span>
          </button>
          {showPast && (
            <ul className="divide-list mt-1">
              {past.map((item) => (
                <li key={item.id}>
                  <CardRow item={item} answerCount={answerCount(item)} onOpen={onOpen} showWeek />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/** Eine Karte als Zeile ihrer Gruppe – der Tipp öffnet sie zum Bearbeiten. */
function CardRow({
  item,
  answerCount,
  onOpen,
  showWeek = false,
}: {
  item: ImpulseItem
  answerCount: number
  onOpen: (item: ImpulseItem) => void
  showWeek?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-slate-800/60"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title || 'Ohne Titel'}</span>
        <span className="hint mt-0 block">
          {showWeek && item.week && <>{formatWeekRange(item.week)} · </>}
          {item.status === 'draft' ? (
            <span className="text-amber-700 dark:text-amber-300">Entwurf – erscheint nicht</span>
          ) : (
            'Bereit'
          )}
          {(item.kind === 'quiz' || item.kind === 'bilderraetsel' || item.kind === 'frage') &&
            answerCount > 0 && (
              <>
                {' · '}
                {answerCount} {answerCount === 1 ? 'Antwort' : 'Antworten'}
              </>
            )}
        </span>
      </span>
      <Pencil
        className="size-4 shrink-0 text-slate-300 transition group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300"
        aria-hidden
      />
    </button>
  )
}
