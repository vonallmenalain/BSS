import { useEffect, useState } from 'react'
import { Pause, Play, Shield } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ImpulseCrestEmblem } from '@/components/impulse/ImpulseCrest'
import { deckOrder, formatWeekRange } from '@/lib/impulse'
import { defaultCrest } from '@/lib/impulseCrest'
import { isDeckKind } from '@/lib/impulseSections'
import {
  IMPULSE_CREST_PALETTE_LABELS,
  IMPULSE_CREST_SYMBOL_LABELS,
  type ImpulseCrest,
  type ImpulseItem,
} from '@/lib/types'

/** Wie lange ein Schritt beim Abspielen steht – das Wappen baut sich in Ruhe auf. */
const STEP_MS = 450

/**
 * Das Wappen einer Woche, in der Redaktion – vom leeren Schild bis zum
 * vollendeten.
 *
 * Ein Knopf mit dem fertigen Wappen im Kleinen, neben «Vorschau der Woche».
 * Er öffnet ein Fenster mit dem Wappen im Grossen und einem Schieberegler:
 * links das leere Schild, rechts das vollendete – dazwischen jede Karte
 * ein Stück. Beim Öffnen spielt es einmal ab, wie es sich aufbaut.
 *
 * Gebaut wird es wie bei den Jugendlichen: Jede bereite Karte des Feeds
 * ist ein Schritt, in der Reihenfolge des Feeds (`deckOrder`). Entwürfe
 * zählen nicht mit – sie sieht auch niemand. Das Muster, in dem sich die
 * Felder füllen, hängt an der Woche; es ist hier dasselbe wie dort.
 */
export function ImpulseCrestPreviewButton({
  week,
  items,
}: {
  week: string
  /** Alle Inhalte der Woche – auch Entwürfe; gezählt werden nur bereite. */
  items: ImpulseItem[]
}) {
  const [open, setOpen] = useState(false)
  const theme = items.find((item) => item.kind === 'impuls') ?? null
  const crest = theme?.crest ?? defaultCrest(week)
  const cards = deckOrder(items.filter((item) => item.status === 'ready' && isDeckKind(item.kind)))
  const drafts = items.filter((item) => item.status !== 'ready' && isDeckKind(item.kind)).length
  const ready = (kind: ImpulseItem['kind']) =>
    items.some((item) => item.kind === kind && item.status === 'ready')

  return (
    <>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => setOpen(true)}
        disabled={cards.length === 0}
        title={
          cards.length === 0
            ? 'Das Wappen baut sich aus den bereiten Karten des Feeds – diese Woche gibt es noch keine.'
            : 'Das Wappen dieser Woche ansehen – vom leeren Schild bis zum vollendeten'
        }
      >
        {cards.length > 0 ? (
          /* Das Schild ist höher als breit – der negative Rand hält den
             Knopf so hoch wie seine Nachbarn. */
          <span className="-my-1 inline-flex">
            <ImpulseCrestEmblem
              crest={crest}
              week={week}
              done={cards.length}
              total={cards.length}
              size={16}
              showMotto={false}
            />
          </span>
        ) : (
          <Shield className="size-4" aria-hidden />
        )}
        Wappen
      </button>
      {open && (
        <CrestPreviewModal
          week={week}
          crest={crest}
          ownCrest={Boolean(theme?.crest)}
          cards={cards}
          drafts={drafts}
          withGoal={ready('wochenziel')}
          withChallenge={ready('tageschallenge')}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function CrestPreviewModal({
  week,
  crest,
  ownCrest,
  cards,
  drafts,
  withGoal,
  withChallenge,
  onClose,
}: {
  week: string
  crest: ImpulseCrest
  /** Trägt das Wochenthema ein eigenes Wappen – oder gilt das Standardwappen der Woche? */
  ownCrest: boolean
  cards: ImpulseItem[]
  drafts: number
  withGoal: boolean
  withChallenge: boolean
  onClose: () => void
}) {
  const total = cards.length
  /* Beim Öffnen spielt das Wappen einmal ab, wie es sich aufbaut. Wer den
     Regler anfasst, hält es an. */
  const [done, setDone] = useState(0)
  const [playing, setPlaying] = useState(true)
  const running = playing && done < total
  useEffect(() => {
    if (!running) return
    const timer = setTimeout(() => setDone((value) => Math.min(value + 1, total)), STEP_MS)
    return () => clearTimeout(timer)
  }, [running, done, total])

  const complete = total > 0 && done >= total
  const last = done > 0 ? cards[done - 1] : null
  const play = () => {
    if (running) {
      setPlaying(false)
      return
    }
    if (done >= total) setDone(0)
    setPlaying(true)
  }

  return (
    <Modal open onClose={onClose} title="Wappen der Woche" description={formatWeekRange(week)}>
      <div className="flex justify-center py-2">
        <ImpulseCrestEmblem
          crest={crest}
          week={week}
          done={done}
          total={total}
          /* Am Ende stehen alle Sterne – so sieht es aus, wenn jemand alles
             geschafft hat, auch Wochenziel und Tages-Challenge. */
          stars={{
            sunday: complete,
            goal: withGoal ? complete : null,
            challenge: withChallenge ? complete : null,
          }}
          celebrate={complete}
          size={220}
        />
      </div>

      <div className="mt-2">
        <label htmlFor="wappen-schritt" className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {done} von {total} {total === 1 ? 'Karte' : 'Karten'} geschafft
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {complete ? 'vollendet' : `${Math.round((done / Math.max(total, 1)) * 100)} %`}
          </span>
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            className="btn-secondary btn-sm shrink-0"
            onClick={play}
            aria-label={running ? 'Anhalten' : 'Abspielen'}
          >
            {running ? (
              <Pause className="size-4" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
          </button>
          <input
            id="wappen-schritt"
            type="range"
            min={0}
            max={total}
            step={1}
            value={done}
            onChange={(event) => {
              setPlaying(false)
              setDone(Number(event.target.value))
            }}
            className="accent-brand-600 w-full"
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>leeres Schild</span>
          <span>vollendet</span>
        </div>
        <p className="mt-3 min-h-10 text-sm text-slate-600 dark:text-slate-300">
          {complete
            ? 'So sieht es aus, wenn alle Karten geschafft sind – mit allen Sternen.'
            : last
              ? `Zuletzt dazugekommen: «${last.title || 'Ohne Titel'}»`
              : 'Noch keine Karte geschafft – das Schild ist leer.'}
        </p>
      </div>

      <p className="hint mt-3">
        {IMPULSE_CREST_SYMBOL_LABELS[crest.symbol] ?? crest.symbol} ·{' '}
        {IMPULSE_CREST_PALETTE_LABELS[crest.palette] ?? crest.palette}
        {crest.motto ? ` · «${crest.motto}»` : ''}
        {!ownCrest &&
          ' – das Standardwappen dieser Woche. Ein eigenes lässt sich im Wochenthema festlegen.'}
        {drafts > 0 &&
          ` ${drafts === 1 ? 'Ein Entwurf zählt' : `${drafts} Entwürfe zählen`} nicht mit – gebaut wird nur aus bereiten Karten.`}
      </p>
    </Modal>
  )
}
