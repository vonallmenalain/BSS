import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Eye, Lightbulb, Plus, Search, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNow } from '@/hooks/useNow'
import { useImpulseAnswers, useImpulseItems } from '@/hooks/useFirestore'
import { PageHeader } from '@/components/ui/Pickers'
import { ImpulseItemForm } from '@/components/impulse/ImpulseItemForm'
import { ImpulseWeekPreview } from '@/components/impulse/ImpulseWeekPreview'
import { cn } from '@/lib/utils'
import { formatWeekRange, impulseWeekKey, itemsForWeek, upcomingWeekKeys } from '@/lib/impulse'
import { planStarterItems } from '@/lib/impulseStarter'
import {
  createStarterItems,
  emptyImpulseItem,
  toImpulseInput,
  type ImpulseItemInput,
} from '@/services/impulse'
import { IMPULSE_KIND_LABELS, type ImpulseItem, type ImpulseKind } from '@/lib/types'

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

  const [editor, setEditor] = useState<{ itemId: string | null; initial: ImpulseItemInput } | null>(
    null,
  )
  const openNew = (kind: ImpulseKind, week: string | null) =>
    setEditor({ itemId: null, initial: emptyImpulseItem(kind, week) })
  const openItem = (item: ImpulseItem) =>
    setEditor({ itemId: item.id, initial: toImpulseInput(item) })

  /* Die Wochen-Vorschau: die Woche so sehen, wie die AP's sie sehen werden. */
  const [previewWeek, setPreviewWeek] = useState<string | null>(null)

  /*
   * Das Startpaket: vier Wochen Inhalt aus den Schriften, mit einem Klick
   * eingespielt (siehe `lib/impulseStarter`). Der Kasten verschwindet,
   * sobald das Paket einmal da ist – erkannt an den festen IDs.
   */
  const [seeding, setSeeding] = useState(false)
  const hasStarter = itemsState.data.some((item) => item.id.startsWith('starter-'))
  const seedStarter = async () => {
    if (seeding) return
    setSeeding(true)
    try {
      const plans = planStarterItems(itemsState.data, todayKey)
      const outcome = await createStarterItems(plans, profile?.id)
      const pooled = plans.filter((plan) => plan.week === null).length
      toast.saved(
        pooled === 0
          ? 'Startpaket eingespielt – vier Wochen sind geplant und bereit.'
          : `Startpaket eingespielt – ${plans.length - pooled} Inhalte geplant, ${pooled} im Fragenpool (ihr Platz war schon belegt).`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Das Startpaket konnte nicht eingespielt werden.')
    } finally {
      setSeeding(false)
    }
  }

  /* Antworten je Frage – für die Zahl an der Zeile und fürs Miträumen. */
  const answersByItem = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const answer of answersState.data) {
      const list = map.get(answer.itemId) ?? []
      list.push(answer.id)
      map.set(answer.itemId, list)
    }
    return map
  }, [answersState.data])

  const answerCount = (item: ImpulseItem) => answersByItem.get(item.id)?.length ?? 0

  return (
    <>
      <PageHeader
        title="Impuls-Redaktion"
        subtitle="Wochenplan, Inhalte und Fragenpool"
        actions={
          <Link to="/impuls" className="btn-secondary">
            <Eye className="size-4" aria-hidden />
            <span className="hidden sm:inline">Zum Bereich</span>
            <span className="sr-only sm:hidden">Zum Bereich</span>
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-4">
        {/* ---------- Startpaket ---------- */}
        {!itemsState.loading && !hasStarter && (
          <section className="border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-950/30 card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
              Startpaket: vier Wochen aus den Schriften
            </h2>
            <p className="hint mt-1 mb-3">
              Vier Wochenimpulse und vier Quizfragen – 1 Nephi 3:7, das Gleichnis vom Haus auf
              dem Felsen, Lehre und Bündnisse 6:36 und Almas Samenkorn, dazu Auswahl-,
              Emoji-, Reihenfolge- und Suchfrage. Alles mit Quelle und Link, alles «bereit»:
              Die laufende Woche erscheint sofort, drei weitere warten auf ihren Montag.
              Bereits belegte Plätze bleiben unangetastet. Danach lässt sich jeder Inhalt wie
              gewohnt bearbeiten, verschieben oder löschen.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void seedStarter()}
              disabled={seeding}
            >
              <Plus className="size-4" aria-hidden />
              {seeding ? 'Wird eingespielt …' : 'Vier Wochen einspielen'}
            </button>
          </section>
        )}

        {/* ---------- Wochenplan ---------- */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Wochenplan</h2>
          <p className="hint mt-1 mb-3">
            Ein Inhalt erscheint bei den AP’s, sobald er <strong>bereit</strong> ist und seine
            Woche beginnt – veröffentlicht wird durch den Kalender, nicht von Hand. Vier bis
            sechs vorbereitete Wochen sind ein gutes Polster.
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
                  {(['impuls', 'quiz'] as ImpulseKind[]).map((kind) => (
                    <SlotCell
                      key={kind}
                      kind={kind}
                      items={itemsState.data.filter(
                        (item) => item.week === week && item.kind === kind,
                      )}
                      answerCount={answerCount}
                      onOpen={openItem}
                      onCreate={() => openNew(kind, week)}
                    />
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
              <button type="button" className="btn-secondary btn-sm" onClick={() => openNew('impuls', null)}>
                <Plus className="size-4" aria-hidden />
                Impuls
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => openNew('quiz', null)}>
                <Plus className="size-4" aria-hidden />
                Frage
              </button>
            </div>
          </div>
          <p className="hint mt-1 mb-3">
            Ideen entstehen, wann immer sie einfallen – hier warten sie ohne Woche. Geplant wird
            im Inhalt selbst: Woche zuteilen, fertig.
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
          key={editor.itemId ?? 'neu'}
          open
          onClose={() => setEditor(null)}
          itemId={editor.itemId}
          initial={editor.initial}
          weekChoices={weekChoices}
          answerIds={editor.itemId ? (answersByItem.get(editor.itemId) ?? []) : []}
          todayKey={todayKey}
        />
      )}

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

const KIND_ICONS = { impuls: Lightbulb, quiz: Search } as const

/** Ein Platz im Wochenplan: gefüllt eine Schaltfläche, leer eine Einladung. */
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

  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={onCreate}
        className="hint flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-3 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
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
            <span className="block truncate text-sm font-medium">
              {item.title || 'Ohne Titel'}
            </span>
            <span className="hint block">
              {item.status === 'draft' ? 'Entwurf – erscheint nicht' : 'Bereit'}
              {item.kind === 'quiz' && answerCount(item) > 0 && (
                <>
                  {' · '}
                  {answerCount(item)} {answerCount(item) === 1 ? 'Antwort' : 'Antworten'}
                </>
              )}
            </span>
          </span>
        </button>
      ))}
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
          {item.kind === 'quiz' && answerCount > 0 && (
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
