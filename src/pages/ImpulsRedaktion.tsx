import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  Inbox,
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
import { ImpulseEditorPreview } from '@/components/impulse/ImpulseEditorPreview'
import { ImpulseItemForm } from '@/components/impulse/ImpulseItemForm'
import { cn } from '@/lib/utils'
import {
  allowsMultiple,
  formatWeekRange,
  IMPULSE_KIND_ORDER,
  impulseWeekKey,
  itemsForWeek,
  nextImpulseOrder,
  planDifficultyCleanup,
  upcomingWeekKeys,
} from '@/lib/impulse'
import { IMPULSE_KIND_THEME, IMPULSE_SECTIONS } from '@/lib/impulseSections'
import { planStarterItems } from '@/lib/impulseStarter'
import {
  applyDifficultyCleanup,
  createStarterItems,
  deleteImpulseSubmission,
  emptyImpulseItem,
  markImpulseSubmissionAccepted,
  submissionToInput,
  submissionToItem,
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
 * Eine Woche im Blick: Oben wird die Woche gewählt (mit Pfeilen oder aus
 * der Liste, samt Füllstand), darunter stehen **alle Karten dieser
 * Woche**, nach Art gruppiert – alle Quizfragen beieinander, alle
 * Bilderrätsel, alle Feed-Karten. Ein Tipp auf eine Karte öffnet sie im
 * Formular; «Neu» in jeder Sparte legt eine weitere Karte dieser Art in
 * dieser Woche an. Das Auge daneben zeigt die Karte in der **echten**
 * Vorschau: der Vollbild-Feed mit Vorschau-Leiste, wahlweise für die
 * einzelne Karte oder die ganze Woche (`ImpulseEditorPreview`).
 *
 * Einreichungen aus der Mitmach-Ecke lassen sich direkt in die gerade
 * angezeigte Woche übernehmen; der Fragenpool (Karten ohne Woche) wohnt
 * zugeklappt am Ende der Seite.
 */
export function ImpulsRedaktion() {
  const { profile } = useAuth()
  const toast = useToast()
  const now = useNow()
  const itemsState = useImpulseItems()
  const answersState = useImpulseAnswers()
  const commentsState = useImpulseComments()
  const todayKey = impulseWeekKey(now)

  /* ---------------- Die gewählte Woche ---------------- */

  const [selectedWeek, setSelectedWeek] = useState(todayKey)

  /* Zur Wahl: die laufende Woche und elf weitere, dazu alles, was weiter
     voraus schon geplant ist – und die vergangenen Wochen mit Inhalt. */
  const plannedWeeks = useMemo(
    () => [
      ...new Set(
        itemsState.data
          .map((item) => item.week)
          .filter((week): week is string => typeof week === 'string'),
      ),
    ],
    [itemsState.data],
  )
  const weekChoices = useMemo(() => upcomingWeekKeys(now, 12), [now])
  const futureWeeks = useMemo(() => {
    const last = weekChoices[weekChoices.length - 1]
    const far = plannedWeeks.filter((week) => week > last).sort()
    return [...weekChoices, ...far]
  }, [weekChoices, plannedWeeks])
  const pastWeeks = useMemo(
    () => plannedWeeks.filter((week) => week < todayKey).sort().reverse(),
    [plannedWeeks, todayKey],
  )
  /* Für die Pfeile: alle wählbaren Wochen in zeitlicher Reihenfolge. */
  const weekTimeline = useMemo(
    () => [...[...pastWeeks].reverse(), ...futureWeeks.filter((week) => !pastWeeks.includes(week))],
    [pastWeeks, futureWeeks],
  )
  const timelineIndex = weekTimeline.indexOf(selectedWeek)
  const stepWeek = (offset: number) => {
    const next = weekTimeline[timelineIndex + offset]
    if (next) setSelectedWeek(next)
  }

  const weekItems = itemsForWeek(itemsState.data, selectedWeek)
  const weekDrafts = weekItems.filter((item) => item.status === 'draft').length
  const countOf = (week: string) => itemsState.data.filter((item) => item.week === week).length

  /* ---------------- Bearbeiten und Anlegen ---------------- */

  const [editor, setEditor] = useState<{
    itemId: string | null
    initial: ImpulseItemInput
    /** Gesetzt, wenn das Formular aus einer Einreichung entstand –
        nach dem Speichern wird sie als übernommen markiert. */
    fromSubmissionId?: string
  } | null>(null)
  const openNew = (kind: ImpulseKind) =>
    setEditor({
      itemId: null,
      initial: emptyImpulseItem(
        kind,
        selectedWeek,
        // Arten mit mehreren Karten je Woche reihen sich hinten ein.
        allowsMultiple(kind) ? nextImpulseOrder(itemsState.data, selectedWeek, kind) : null,
      ),
    })
  const openItem = (item: ImpulseItem) =>
    setEditor({ itemId: item.id, initial: toImpulseInput(item) })

  /* ---------------- Die echte Vorschau ---------------- */

  /* Ein Schnappschuss der Karten – die Vorschau soll ruhig stehen,
     auch wenn der Bestand währenddessen weitertickt. */
  const [preview, setPreview] = useState<{
    week: string
    items: ImpulseItem[]
    label?: string
  } | null>(null)
  const previewWeek = () => setPreview({ week: selectedWeek, items: weekItems })
  const previewItem = (item: ImpulseItem) => setPreview({ week: selectedWeek, items: [item] })
  /** Eine Einreichung so anschauen, wie sie als Karte aussehen würde. */
  const previewSubmission = (submission: ImpulseSubmission) =>
    setPreview({
      week: selectedWeek,
      items: [submissionToItem(submission)],
      label: `Einreichung von ${submission.firstName}`,
    })

  /* ---------------- Startpaket und Aufräumen ---------------- */

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
  /*
   * Wohin eine Einreichung übernommen wird: je Einreichung wählbar –
   * voreingestellt ist die oben angezeigte Woche, die leere Wahl ist der
   * Fragenpool. Im Formular bleibt die Woche danach weiter änderbar.
   */
  const [submissionWeeks, setSubmissionWeeks] = useState<Record<string, string>>({})
  const submissionWeek = (submission: ImpulseSubmission) =>
    submissionWeeks[submission.id] ?? (weekChoices.includes(selectedWeek) ? selectedWeek : '')
  const acceptSubmission = (submission: ImpulseSubmission) => {
    const week = submissionWeek(submission)
    setEditor({
      itemId: null,
      initial: submissionToInput(submission, week === '' ? null : week),
      fromSubmissionId: submission.id,
    })
  }

  /* Der Fragenpool: Karten ohne Woche – zugeklappt am Ende der Seite. */
  const pool = itemsState.data.filter((item) => item.week === null)
  const [showPool, setShowPool] = useState(false)

  return (
    <>
      {/* Auch die Redaktion lebt im Anti-Doom-Vollbild (siehe Layout): Der Kopf
          rückt in die Mittelspalte, der Menüknopf ersetzt die Kopfzeile. */}
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Anti-Doom-Redaktion"
          subtitle="Woche wählen, Karten bearbeiten und prüfen"
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

        {/* ---------- Die Woche ---------- */}
        <section className="card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Woche</h2>
          <p className="hint mt-1 mb-3">
            Ein Inhalt erscheint bei den AP’s, sobald er <strong>bereit</strong> ist und seine
            Woche beginnt – veröffentlicht wird die neue Woche automatisch jeden Montag, nicht
            manuell.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary shrink-0 p-2"
              onClick={() => stepWeek(-1)}
              disabled={timelineIndex <= 0}
              aria-label="Eine Woche zurück"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <select
              className="input min-w-0 flex-1"
              aria-label="Woche wählen"
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(event.target.value)}
            >
              {!weekTimeline.includes(selectedWeek) && (
                <option value={selectedWeek}>{formatWeekRange(selectedWeek)}</option>
              )}
              <optgroup label="Diese und kommende Wochen">
                {futureWeeks.map((week) => (
                  <option key={week} value={week}>
                    {formatWeekRange(week)}
                    {week === todayKey ? ' · diese Woche' : ''}
                    {countOf(week) > 0 ? ` · ${countOf(week)} Karten` : ' · leer'}
                  </option>
                ))}
              </optgroup>
              {pastWeeks.length > 0 && (
                <optgroup label="Vergangene Wochen">
                  {pastWeeks.map((week) => (
                    <option key={week} value={week}>
                      {formatWeekRange(week)} · {countOf(week)} Karten
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              className="btn-secondary shrink-0 p-2"
              onClick={() => stepWeek(1)}
              disabled={timelineIndex === -1 || timelineIndex >= weekTimeline.length - 1}
              aria-label="Eine Woche weiter"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="hint mt-0 min-w-0 flex-1">
              {weekItems.length === 0
                ? 'Noch keine Karten in dieser Woche.'
                : `${weekItems.length} ${weekItems.length === 1 ? 'Karte' : 'Karten'}`}
              {weekDrafts > 0 && (
                <span className="text-amber-700 dark:text-amber-300">
                  {' · '}
                  {weekDrafts === 1 ? '1 Entwurf' : `${weekDrafts} Entwürfe`}
                </span>
              )}
              {selectedWeek < todayKey && ' · vergangene Woche'}
            </p>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={previewWeek}
              disabled={weekItems.length === 0}
            >
              <Eye className="size-4" aria-hidden />
              Vorschau der Woche
            </button>
          </div>
        </section>

        {/* ---------- Die Karten der Woche, nach Art gruppiert ---------- */}
        {IMPULSE_KIND_ORDER.map((kind) => (
          <WeekKindGroup
            key={kind}
            kind={kind}
            items={weekItems.filter((item) => item.kind === kind)}
            answerCount={answerCount}
            onOpen={openItem}
            onPreview={previewItem}
            onCreate={() => openNew(kind)}
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
              Hier landet alles, was die AP's einreichen – als fixfertige Karte. Das Auge zeigt
              die Karte in der echten Vorschau; «Übernehmen» öffnet sie vorbefüllt in der daneben
              gewählten Woche (im Formular weiter änderbar). Beim Speichern gilt die Einreichung
              als übernommen. Was nicht passt, wird still entfernt; die Person sieht keine
              Ablehnung.
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
                    {submission.card?.body && (
                      <p className="hint mt-0.5 line-clamp-2 whitespace-pre-line">
                        {submission.card.body}
                      </p>
                    )}
                    {submission.sourceLabel && (
                      <p className="hint mt-0.5">Quelle: {submission.sourceLabel}</p>
                    )}
                    {/* Wohin damit? Die Woche wählen, dann übernehmen –
                        oder erst einmal anschauen. */}
                    <div className="mt-2 space-y-1.5">
                      <select
                        className="input"
                        aria-label={`Woche für die Einreichung von ${submission.firstName}`}
                        value={submissionWeek(submission)}
                        onChange={(event) =>
                          setSubmissionWeeks((value) => ({
                            ...value,
                            [submission.id]: event.target.value,
                          }))
                        }
                      >
                        {weekChoices.map((week) => (
                          <option key={week} value={week}>
                            {formatWeekRange(week)}
                            {week === todayKey ? ' · diese Woche' : ''}
                          </option>
                        ))}
                        <option value="">Fragenpool – noch keine Woche</option>
                      </select>
                      <div className="flex flex-wrap items-center gap-1.5">
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
                          className="btn-ghost btn-sm"
                          onClick={() => previewSubmission(submission)}
                          title="So sähe die Karte aus – nichts wird gespeichert"
                        >
                          <Eye className="size-4" aria-hidden />
                          Vorschau
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

        {/* ---------- Fragenpool ---------- */}
        {pool.length > 0 && (
          <section className="card p-4 sm:p-5">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left text-sm font-semibold"
              onClick={() => setShowPool((value) => !value)}
              aria-expanded={showPool}
            >
              {showPool ? (
                <ChevronDown className="size-4 text-slate-400" aria-hidden />
              ) : (
                <ChevronRight className="size-4 text-slate-400" aria-hidden />
              )}
              Fragenpool – Karten ohne Woche
              <span className="hint font-normal">{pool.length}</span>
            </button>
            {showPool && (
              <>
                <p className="hint mt-1">
                  Ideen, die auf ihre Woche warten. Karte antippen, Woche zuteilen, fertig.
                </p>
                <ul className="divide-list mt-1">
                  {pool.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className="group flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-slate-800/60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {item.title || 'Ohne Titel'}
                          </span>
                          <span className="hint mt-0 block">{IMPULSE_KIND_LABELS[item.kind]}</span>
                        </span>
                        <Pencil
                          className="size-4 shrink-0 text-slate-300 transition group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {/* Eine leere Woche ganz ohne Startpaket-Kasten wirkt sonst wie
            ein Fehler – der Hinweis sagt, dass einfach nichts da ist. */}
        {!itemsState.loading && itemsState.data.length === 0 && starterPlans.length === 0 && (
          <p className="hint flex items-center justify-center gap-1.5 py-4 text-center">
            <Inbox className="size-4" aria-hidden />
            Noch keine Karten – lege oben in einer Sparte die erste an.
          </p>
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

      {preview && (
        <ImpulseEditorPreview
          week={preview.week}
          items={preview.items}
          label={preview.label}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/** Die Gruppen-Überschriften – die Mehrzahl der Kartenart. */
const KIND_GROUP_LABELS: Record<ImpulseKind, string> = {
  impuls: 'Wochenthema',
  quiz: 'Quizfragen',
  bilderraetsel: 'Bilderrätsel',
  wochenziel: 'Wochenziel',
  tageschallenge: 'Tages-Challenge',
  frage: 'Frage der Woche',
  feed: 'Feed-Karten',
  teilen: 'Teilen-Aufgabe',
}

/**
 * Eine Sparte der gewählten Woche: alle ihre Karten untereinander, jede
 * antippbar zum Bearbeiten, das Auge daneben öffnet die echte Vorschau –
 * und «Neu» legt eine weitere Karte dieser Art in dieser Woche an. Ohne
 * Obergrenze: Wie viele Karten eine Woche trägt, entscheidet die
 * Redaktion. Nur die drei Aufgaben-Arten bleiben bei einer je Woche,
 * weil ihr Haken an der Woche hängt (`IMPULSE_SINGLE_KINDS`).
 */
function WeekKindGroup({
  kind,
  items,
  answerCount,
  onOpen,
  onPreview,
  onCreate,
}: {
  kind: ImpulseKind
  items: ImpulseItem[]
  answerCount: (item: ImpulseItem) => number
  onOpen: (item: ImpulseItem) => void
  onPreview: (item: ImpulseItem) => void
  onCreate: () => void
}) {
  const theme = IMPULSE_SECTIONS[IMPULSE_KIND_THEME[kind]]
  /* «Neu» steht immer bereit – ausser bei den Arten, die eine Woche nur
     einmal trägt, und dort nur, solange die eine schon dasteht. */
  const hasRoom = allowsMultiple(kind) || items.length === 0

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
          {items.length > 1 && <span className="hint font-normal"> {items.length}</span>}
        </h3>
        {hasRoom && items.length > 0 && (
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onCreate}>
            <Plus className="size-4" aria-hidden />
            Neu
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={onCreate}
          className="hint mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-3 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
        >
          <Plus className="size-4" aria-hidden />
          {IMPULSE_KIND_LABELS[kind]} für diese Woche anlegen
        </button>
      ) : (
        <ul className="divide-list mt-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-2.5 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-slate-800/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.title || 'Ohne Titel'}
                  </span>
                  <span className="hint mt-0 block">
                    {item.status === 'draft' ? (
                      <span className="text-amber-700 dark:text-amber-300">
                        Entwurf – erscheint nicht
                      </span>
                    ) : (
                      'Bereit'
                    )}
                    {(item.kind === 'quiz' ||
                      item.kind === 'bilderraetsel' ||
                      item.kind === 'frage') &&
                      answerCount(item) > 0 && (
                        <>
                          {' · '}
                          {answerCount(item)} {answerCount(item) === 1 ? 'Antwort' : 'Antworten'}
                        </>
                      )}
                  </span>
                </span>
                <Pencil
                  className="size-4 shrink-0 text-slate-300 transition group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300"
                  aria-hidden
                />
              </button>
              <button
                type="button"
                className="btn-ghost shrink-0 p-2"
                onClick={() => onPreview(item)}
                aria-label={`«${item.title || 'Ohne Titel'}» in der Vorschau anschauen`}
                title="Karte in der echten Vorschau anschauen"
              >
                <Eye className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
