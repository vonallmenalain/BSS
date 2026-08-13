import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  HeartHandshake,
  LayoutList,
  Lightbulb,
  MessagesSquare,
  Plus,
  Puzzle,
  Repeat,
  Search,
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
  upcomingWeekKeys,
} from '@/lib/impulse'
import { planStarterItems } from '@/lib/impulseStarter'
import {
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
 * Die Redaktion des Bereichs «Impuls» – nur für Konten mit Redaktionsrecht
 * (`RequireImpulseEditor` in App.tsx; vorerst das Administrator-Konto).
 *
 * Drei Abschnitte, ein Arbeitsfluss: Der **Wochenplan** zeigt die laufende
 * und die kommenden Wochen mit ihren zwei Plätzen (Impuls und Quizfrage) –
 * Lücken sind sofort als solche erkennbar, wie die freien Plätze im
 * Ansprachen-Programm. Der **Fragenpool** sammelt Ideen ohne Woche; geplant
 * wird durch das Zuteilen einer Woche im Formular. Und **Vergangenes**
 * bleibt erreichbar, falls ein Tippfehler auch rückwirkend nicht stehen
 * bleiben soll.
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

  const pool = itemsState.data.filter((item) => item.week === null)
  // Bereits absteigend sortiert – die jüngste vergangene Woche zuerst.
  const past = itemsState.data.filter(
    (item) => typeof item.week === 'string' && item.week < todayKey,
  )
  const [showPast, setShowPast] = useState(false)

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
        MULTI_KIND_LIMITS[kind]
          ? itemsState.data.filter((item) => item.week === week && item.kind === kind).length + 1
          : null,
      ),
    })
  const openItem = (item: ImpulseItem) =>
    setEditor({ itemId: item.id, initial: toImpulseInput(item) })

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
      {/* Auch die Redaktion lebt im Impuls-Vollbild (siehe Layout): Der Kopf
          rückt in die Mittelspalte, der Menüknopf ersetzt die Kopfzeile. */}
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Impuls-Redaktion"
          subtitle="Wochenplan, Inhalte und Fragenpool"
          leading={<AppMenuButton />}
          actions={
            <Link to="/impuls" className="btn-secondary">
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
          <section className="border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-950/30 card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
              Startpaket: vier Wochen aus den Schriften
            </h2>
            <p className="hint mt-1 mb-3">
              1 Nephi 3:7, das Haus auf dem Felsen, Lehre und Bündnisse 6:36 und Almas Samenkorn –
              die ersten drei Wochen voll ausgebaut: je drei Quizfragen in steigendem
              Schwierigkeitsgrad, drei Bilderrätsel, zehn Feed-Karten (etliche mit Vertiefung),
              dazu Impuls, Wochenziel, Tages-Challenge, Frage der Woche und Teilen-Aufgabe. Alles
              «bereit» – einzig die Bilderrätsel kommen als <strong>Entwurf</strong>: Ihr Bild muss
              aus der Mediathek der Kirche stammen; die Auflösung sagt, welches gemeint ist –
              Bild-Link einsetzen, «bereit» anhaken, fertig. Eingespielt wird nur, was noch fehlt (
              {starterPlans.length} {starterPlans.length === 1 ? 'Inhalt' : 'Inhalte'}); Vorhandenes
              und belegte Plätze bleiben unangetastet. Danach lässt sich alles wie gewohnt
              bearbeiten, verschieben oder löschen.
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

        {/* ---------- Wochenplan ---------- */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Wochenplan</h2>
          <p className="hint mt-1 mb-3">
            Ein Inhalt erscheint bei den AP’s, sobald er <strong>bereit</strong> ist und seine Woche
            beginnt – veröffentlicht wird durch den Kalender, nicht von Hand. Vier bis sechs
            vorbereitete Wochen sind ein gutes Polster.
          </p>
          <ul className="divide-list">
            {weeks.map((week) => (
              <li key={week} className="py-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {formatWeekRange(week)}
                    {week === todayKey && (
                      <span className="text-brand-700 dark:text-brand-300"> · diese Woche</span>
                    )}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost btn-sm ms-auto"
                    onClick={() => setPreviewWeek(week)}
                    title="Die Woche so sehen, wie die AP’s sie sehen werden"
                  >
                    <Eye className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Vorschau</span>
                    <span className="sr-only sm:hidden">Vorschau</span>
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {IMPULSE_KIND_ORDER.map((kind) => (
                    <div key={kind} className={kind === 'feed' ? 'sm:col-span-2' : undefined}>
                      <SlotCell
                        kind={kind}
                        items={itemsForWeek(itemsState.data, week).filter(
                          (item) => item.kind === kind,
                        )}
                        answerCount={answerCount}
                        onOpen={openItem}
                        onCreate={() => openNew(kind, week)}
                      />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Fragenpool ---------- */}
        <section className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Fragenpool</h2>
            <div className="ms-auto flex gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => openNew('impuls', null)}
              >
                <Plus className="size-4" aria-hidden />
                Impuls
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => openNew('quiz', null)}
              >
                <Plus className="size-4" aria-hidden />
                Frage
              </button>
            </div>
          </div>
          <p className="hint mt-1 mb-3">
            Ideen entstehen, wann immer sie einfallen – hier warten sie ohne Woche. Geplant wird im
            Inhalt selbst: Woche zuteilen, fertig.
          </p>
          {pool.length === 0 ? (
            <p className="hint rounded-xl border border-dashed border-slate-300 p-4 text-center dark:border-slate-700">
              Der Pool ist leer – nichts wartet.
            </p>
          ) : (
            <ul className="divide-list">
              {pool.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} answerCount={answerCount(item)} onOpen={openItem} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Mitmach-Ecke ---------- */}
        {(openSubmissions.length > 0 || acceptedSubmissions.length > 0) && (
          <section className="card p-5">
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
                  <li key={submission.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
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
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
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
                        className="btn-ghost p-1.5 text-rose-600 dark:text-rose-400"
                        onClick={() => setRemoveSubmission(submission)}
                        aria-label={`Einreichung von ${submission.firstName} entfernen`}
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Die Chronik: was schon übernommen wurde – zum Nachschauen,
                und zum Aufräumen, wenn sie einmal lang wird. */}
            {acceptedSubmissions.length > 0 && (
              <div className={openSubmissions.length > 0 ? 'mt-2 border-t border-slate-200 pt-2 dark:border-slate-800' : undefined}>
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

        {/* ---------- Vergangenes ---------- */}
        {past.length > 0 && (
          <section className="card p-5">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left text-sm font-semibold"
              onClick={() => setShowPast((value) => !value)}
              aria-expanded={showPast}
            >
              {showPast ? (
                <ChevronDown className="size-4 text-slate-400" aria-hidden />
              ) : (
                <ChevronRight className="size-4 text-slate-400" aria-hidden />
              )}
              Vergangenes
              <span className="hint font-normal">
                {past.length} {past.length === 1 ? 'Inhalt' : 'Inhalte'}
              </span>
            </button>
            {showPast && (
              <ul className="divide-list mt-2">
                {past.map((item) => (
                  <li key={item.id}>
                    <ItemRow
                      item={item}
                      answerCount={answerCount(item)}
                      onOpen={openItem}
                      showWeek
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {editor && (
        <ImpulseItemForm
          key={editor.itemId ?? editor.fromSubmissionId ?? 'neu'}
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

const KIND_ICONS = {
  impuls: Lightbulb,
  quiz: Search,
  bilderraetsel: Puzzle,
  wochenziel: CheckCircle2,
  tageschallenge: Repeat,
  frage: MessagesSquare,
  feed: LayoutList,
  teilen: HeartHandshake,
} as const

/**
 * Wie viele Karten einer Art in eine Woche passen – nur die Arten mit
 * mehreren Karten stehen hier. Der Feed bleibt endlich (höchstens zehn,
 * das Konzept plant etwa zehn je Woche), Quiz und Bilderrätsel dürfen je
 * drei tragen (verschiedene Schwierigkeitsgrade); alles andere gibt es
 * einmal pro Woche.
 */
const MULTI_KIND_LIMITS: Partial<Record<ImpulseKind, number>> = {
  feed: 10,
  quiz: 3,
  bilderraetsel: 3,
}

/**
 * Ein Platz im Wochenplan: gefüllt eine Schaltfläche, leer eine Einladung.
 *
 * Die Einzel-Plätze laden nur ein, solange sie leer sind; Feed, Quiz und
 * Bilderrätsel laden weiter ein, bis ihre Woche voll ist
 * (`MULTI_KIND_LIMITS`) – endlich bleibt alles trotzdem.
 */
function SlotCell({
  kind,
  items,
  answerCount,
  onOpen,
  onCreate,
}: {
  kind: ImpulseKind
  items: ImpulseItem[]
  answerCount: (item: ImpulseItem) => number
  onOpen: (item: ImpulseItem) => void
  onCreate: () => void
}) {
  const Icon = KIND_ICONS[kind]
  const limit = MULTI_KIND_LIMITS[kind] ?? 1
  const showAdd = items.length < limit

  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={onCreate}
        className="hint flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-3 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
      >
        <Plus className="size-4" aria-hidden />
        {IMPULSE_KIND_LABELS[kind]}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item)}
          className={cn(
            'flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60',
            item.status === 'draft'
              ? 'border-amber-300 dark:border-amber-800'
              : 'border-slate-200 dark:border-slate-700',
          )}
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{item.title || 'Ohne Titel'}</span>
            <span className="hint block">
              {item.status === 'draft' ? 'Entwurf – erscheint nicht' : 'Bereit'}
              {(item.kind === 'quiz' || item.kind === 'bilderraetsel' || item.kind === 'frage') &&
                answerCount(item) > 0 && (
                  <>
                    {' · '}
                    {answerCount(item)} {answerCount(item) === 1 ? 'Antwort' : 'Antworten'}
                  </>
                )}
            </span>
          </span>
        </button>
      ))}
      {showAdd && (
        <button
          type="button"
          onClick={onCreate}
          className="hint flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-2 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
        >
          <Plus className="size-4" aria-hidden />
          Karte
        </button>
      )}
    </div>
  )
}

/** Eine Zeile im Fragenpool oder unter «Vergangenes». */
function ItemRow({
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
  const Icon = KIND_ICONS[item.kind]
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full items-center gap-2.5 rounded-lg px-1 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title || 'Ohne Titel'}</span>
        <span className="hint block">
          {IMPULSE_KIND_LABELS[item.kind]}
          {showWeek && item.week && <> · {formatWeekRange(item.week)}</>}
          {item.status === 'draft' && ' · Entwurf'}
          {(item.kind === 'quiz' || item.kind === 'bilderraetsel' || item.kind === 'frage') &&
            answerCount > 0 && (
              <>
                {' · '}
                {answerCount} {answerCount === 1 ? 'Antwort' : 'Antworten'}
              </>
            )}
        </span>
      </span>
    </button>
  )
}
