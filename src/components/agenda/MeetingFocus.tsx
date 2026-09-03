import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { KindBadge, StandingBadge, StatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Feedback'
import { AgendaItemEditor } from '@/components/agenda/AgendaItemEditor'
import { DeferMenu } from '@/components/agenda/DeferMenu'
import { StandingButton } from '@/components/agenda/Standing'
import { useStandingRound } from '@/hooks/useStanding'
import { deleteAgendaItem, setItemStatus } from '@/services/agenda'
import { hasOpenCallingRows } from '@/lib/callingChanges'
import { isDutyItem } from '@/lib/monthlyDuties'
import { normalizeStanding, sectionOf } from '@/lib/standing'
import {
  ITEM_KIND_LABELS,
  MEETING_SECTION_COUNTED,
  MEETING_SECTION_LABELS,
  MEETING_SECTION_ORDER,
  toItemKind,
  type AgendaItem,
  type ItemStatus,
  type MeetingSection,
} from '@/lib/types'

interface Props {
  items: AgendaItem[]
  onAdd: () => void
  nextMeeting?: { id: string; date: Date } | null
  /** Sitzung ist abgeschlossen – nur noch lesen */
  readOnly?: boolean
}

/** Der Eintrag, der gerade offen ist, steht in der Adresse. */
export const FOCUS_PARAM = 'traktandum'

/**
 * Sitzungsmodus: ein Punkt gross im Bild, mit Notizfeld und Statusknöpfen in
 * Daumenreichweite.
 *
 * Der Ablauf ist bewusst linear – während der Sitzung will man nicht suchen,
 * sondern der Reihe nach durchgehen: zuerst die ständigen Pendenzen, danach
 * die neuen Traktanden, zuletzt die Pendenzen aus früheren Sitzungen. Die
 * Leiste oben zeigt trotzdem jederzeit, wo man steht, und erlaubt den
 * direkten Sprung.
 *
 * Bearbeitet wird ohne Umweg: Titel und Beschreibung sind Text, in den man
 * hineingreift, die Zuständigen stehen darunter. Einen Bearbeiten-Stift gibt
 * es nicht mehr.
 *
 * Welcher Punkt offen ist, steht in der Adresse. Das ist kein Selbstzweck:
 * Ein Klick auf einen erwähnten Namen führt zur Mitgliederseite, und «Zurück»
 * soll von dort nicht irgendwo in der Sitzung landen, sondern genau bei dem
 * Punkt, den man gerade gelesen hat.
 */
export function MeetingFocus({ items, onAdd, nextMeeting, readOnly = false }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const standingRound = useStandingRound()
  const [searchParams, setSearchParams] = useSearchParams()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const focusId = searchParams.get(FOCUS_PARAM)
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === focusId),
  )
  const current = items[Math.min(index, items.length - 1)] as AgendaItem | undefined

  /*
   * Ersetzt statt angehängt: Beim Blättern durch zwanzig Traktanden soll die
   * Zurück-Geste die Sitzung verlassen und nicht Punkt für Punkt rückwärts
   * gehen.
   */
  const goTo = useCallback(
    (target: AgendaItem | undefined) => {
      if (!target) return
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params)
          next.set(FOCUS_PARAM, target.id)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const step = useCallback(
    (delta: number) => goTo(items[Math.min(Math.max(index + delta, 0), items.length - 1)]),
    [goTo, items, index],
  )

  const doneCount = useMemo(() => items.filter((item) => item.status === 'done').length, [items])

  /**
   * Die Nummer jedes Punktes innerhalb seines Abschnitts.
   *
   * Die Liste kommt sortiert an – erst die ständigen Pendenzen, dann die
   * Traktanden, dann die übrigen Pendenzen (siehe `sortForMeeting`) –, und
   * jeder Abschnitt zählt von vorn. «Punkt 7 von 12» sagt in einer Sitzung
   * wenig; «Pendenz 2 von 8» sagt, dass das Neue durch ist und noch sechs
   * Altlasten warten.
   */
  const numbers = useMemo(() => {
    const counted: Record<MeetingSection, number> = { standing: 0, traktandum: 0, pendenz: 0 }
    return items.map((item) => {
      const section = sectionOf(item)
      counted[section] += 1
      return { section, number: counted[section] }
    })
  }, [items])

  /** Wie viele Punkte je Abschnitt – für «2 von 8». */
  const totals = useMemo(() => {
    const counted: Record<MeetingSection, number> = { standing: 0, traktandum: 0, pendenz: 0 }
    numbers.forEach(({ section }) => {
      counted[section] += 1
    })
    return counted
  }, [numbers])

  const place = useMemo(() => {
    const at = numbers[index]
    const section = at?.section ?? MEETING_SECTION_ORDER[0]
    return { section, position: at?.number ?? 0, total: totals[section] }
  }, [numbers, totals, index])

  /* Tastatursteuerung – am Laptop geht das Durchgehen so am schnellsten. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'ArrowRight' || event.key === 'j') step(1)
      else if (event.key === 'ArrowLeft' || event.key === 'k') step(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step])

  if (items.length === 0) {
    return (
      <EmptyState
        title="Noch keine Traktanden"
        description="Trage ein, was in dieser Sitzung besprochen werden soll."
        action={
          !readOnly && (
            <button type="button" className="btn-primary" onClick={onAdd}>
              <Plus className="size-4" aria-hidden />
              Traktandum hinzufügen
            </button>
          )
        }
      />
    )
  }

  if (!current) return null

  const actor = profile ? { id: profile.id, name: profile.displayName } : null
  const kind = toItemKind(current)
  const standing = normalizeStanding(current.standing)

  /*
   * Eine Berufungsrunde wird zeilenweise erledigt – im Menü rechts an jeder
   * Zeile. Als Ganzes ist sie erst fertig, wenn keine mehr offen ist; bis
   * dahin bleibt der grüne Knopf still. Wieder öffnen geht immer.
   */
  const openRows = current.status !== 'done' && hasOpenCallingRows(current.callingChanges)

  /** Weiterrücken nach dem Abhaken – das ist der übliche Ablauf. */
  const advance = () => {
    if (index < items.length - 1) window.setTimeout(() => step(1), 250)
  }

  const changeStatus = async (status: ItemStatus) => {
    if (!actor) return
    /*
     * Eine ständige Pendenz wird nicht abgeschlossen, sondern auf ihre
     * nächste Runde gesetzt (siehe `hooks/useStanding`). Weitergerückt wird
     * trotzdem: Für den Ablauf der Sitzung ist der Punkt erledigt.
     */
    if (status === 'done' && (await standingRound(current))) {
      advance()
      return
    }
    try {
      await setItemStatus(current.id, status, actor)
      if (status === 'done') advance()
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  const remove = async () => {
    try {
      await deleteAgendaItem(current.id)
      toast.success(`${ITEM_KIND_LABELS[kind]} gelöscht.`)
      goTo(items[Math.max(index - 1, 0)])
    } catch (error) {
      console.error(error)
      toast.error('Löschen fehlgeschlagen.')
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- Fortschritt und Sprungleiste ---- */}
      <div className="card p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            {place.position} von {place.total} {MEETING_SECTION_COUNTED[place.section]}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {doneCount} erledigt · {items.length - doneCount} offen
          </span>
        </div>

        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>

        {/* Die Leiste zählt je Abschnitt von vorn und lässt zwischen ihnen
            eine Lücke – so ist auch hier zu sehen, wo das Ständige aufhört
            und wo das Neue. */}
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {items.map((item, itemIndex) => {
            const isDone = item.status === 'done'
            const { section, number } = numbers[itemIndex]
            // Ein Abschnittswechsel bekommt Luft davor. Beim ersten Punkt
            // wäre sie ein Einzug ohne Gegenstück.
            const first = itemIndex > 0 && numbers[itemIndex - 1].section !== section
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item)}
                title={`${MEETING_SECTION_LABELS[section]} ${number}: ${item.title}`}
                className={cn(
                  'tabular grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold transition',
                  first && 'ml-3',
                  itemIndex === index
                    ? 'bg-brand-600 text-white'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : section === 'traktandum'
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200',
                )}
              >
                {isDone && itemIndex !== index ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  number
                )}
              </button>
            )
          })}
          {!readOnly && (
            <button
              type="button"
              onClick={onAdd}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition hover:border-slate-400 hover:text-slate-600 dark:border-slate-600"
              aria-label="Traktandum hinzufügen"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* ---- Aktueller Punkt ---- */}
      <article className="card p-5">
        {/* Angeschrieben wird nur, was vom Normalfall abweicht: «Pendent» neben
            «Pendenz» sagte dasselbe zweimal, und ein neues Traktandum braucht
            gar keine Zeile. */}
        {(kind === 'pendenz' || current.status !== 'pending' || current.deferCount > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {/* Der Takt tritt an die Stelle des Etiketts «Pendenz»: Beide
                sagen, worunter der Punkt steht, und dieses sagt es genauer. */}
            {standing ? <StandingBadge rule={standing} /> : <KindBadge kind={kind} />}
            {current.status !== 'pending' && <StatusBadge status={current.status} />}
            {current.deferCount > 0 && (
              <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {current.deferCount}× verschoben
              </span>
            )}
          </div>
        )}

        {/* Der Stand gehört dem Eintrag, nicht der Stelle auf dem Bildschirm –
            deshalb baut sich der Editor beim Blättern neu auf. */}
        <AgendaItemEditor key={current.id} item={current} readOnly={readOnly} />
      </article>

      {/* ---- Aktionsleiste ----
           Bleibt beim Scrollen unten stehen, damit Statuswechsel und Blättern
           immer in Daumenreichweite sind. */}
      {!readOnly && (
        <>
          {/* Der Abstand nach unten entspricht dem Innenabstand des Hauptbereichs
              (pb-24 bzw. lg:pb-8) – sonst bliebe die Leiste am Seitenende kleben
              und würde die letzten Zeilen überdecken. */}
          <div className="card sticky bottom-24 z-20 p-2 lg:bottom-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  'min-w-0 flex-1',
                  current.status === 'done' ? 'btn-secondary' : 'btn-success',
                  openRows && 'cursor-default opacity-50',
                )}
                disabled={openRows}
                onClick={() => void changeStatus(current.status === 'done' ? 'pending' : 'done')}
              >
                <Check className="size-4" aria-hidden />
                <span className="truncate">
                  {current.status === 'done' ? 'Wieder offen' : 'Erledigt'}
                </span>
              </button>

              <DeferMenu itemId={current.id} nextMeeting={nextMeeting} compact />

              {/* Am Sitzungstisch fällt auf, dass ein Punkt zum dritten Mal
                  dasteht – deshalb steht der Weg zur ständigen Pendenz auch
                  hier. Nicht an der Monatspendenz: Die kehrt bereits auf ihre
                  eigene Weise wieder (siehe `lib/monthlyDuties`). */}
              {!isDutyItem(current) && <StandingButton item={current} compact />}

              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() => setConfirmDelete(true)}
                title="Löschen"
                aria-label="Löschen"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm flex-1"
                onClick={() => step(-1)}
                disabled={index === 0}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Zurück
              </button>
              <span className="tabular shrink-0 px-2 text-xs text-slate-400">
                {index + 1}/{items.length}
              </span>
              <button
                type="button"
                className="btn-secondary btn-sm flex-1"
                onClick={() => step(1)}
                disabled={index === items.length - 1}
              >
                Weiter
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title={`${ITEM_KIND_LABELS[kind]} löschen?`}
        message={
          <>
            «{current.title}» wird endgültig gelöscht – samt Verlauf. Soll der Punkt bloss aus
            dieser Sitzung verschwinden, ist «Verschieben» der richtige Weg.
          </>
        }
        confirmLabel="Endgültig löschen"
        danger
      />
    </div>
  )
}
