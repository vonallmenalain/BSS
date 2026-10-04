import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Pause, Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SORT_SIDES } from '@/lib/impulseGame'
import { attachSortControls, SortGame } from '@/components/impulse/game/sortGame'

/*
 * Die Bühne eines Minispiels – ein Vollbild über dem Feed.
 *
 * Gespielt wird nicht in der Karte selbst, sondern darüber: Der Feed
 * gehört dem senkrechten Wisch, das Spiel dem waagrechten – beides auf
 * derselben Fläche gäbe ein Gerangel, und mitten in der Runde rollte die
 * nächste Karte herein. Die Bühne deckt den Feed darum ganz zu und nimmt
 * jede Berührung an (`touch-action: none`). Das X oben rechts bricht ab;
 * danach steht wieder die Karte da, an derselben Stelle im Feed, und der
 * Wisch nach oben oder unten geht weiter wie immer.
 *
 * Ablauf: Einführung (die zwei Seiten, ein Knopf) → Runde → Ergebnis.
 * «Nochmal» startet direkt die nächste Runde, ohne Einführung. Geht die
 * App in den Hintergrund, hält die Runde an und wartet auf einen Tipp.
 */

export interface GameRoundInfo {
  /** Der bisherige Bestwert – `null` beim allerersten Lauf. */
  previousBest: number | null
}

type StagePhase = 'intro' | 'play' | 'paused' | 'result'

/** Der Abstand, den Notch und Home-Leiste brauchen – gemessen, nicht geraten. */
function safeInsets(): { top: number; bottom: number } {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
  }
  probe.remove()
  return insets
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ImpulseGameStage({
  title,
  onClose,
  onRoundEnd,
  renderResult,
}: {
  title: string
  /** Die Bühne schliessen – die Karte steht wieder da. */
  onClose: () => void
  /**
   * Eine Runde ist vorbei – regulär oder abgebrochen. Die Karte speichert
   * den Lauf (nur einen besseren) und sagt, was vorher dastand.
   */
  onRoundEnd: (points: number) => GameRoundInfo
  /** Die Ergebnistafel – Punkte, Rekord, Name, Rangliste – baut die Karte. */
  renderResult: (result: { points: number; info: GameRoundInfo }) => ReactNode
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<SortGame | null>(null)
  const [phase, setPhase] = useState<StagePhase>('intro')
  const phaseRef = useRef<StagePhase>('intro')
  const [result, setResult] = useState<{ points: number; info: GameRoundInfo } | null>(null)
  const [round, setRound] = useState(0)
  const roundEndRef = useRef(onRoundEnd)
  const closeRef = useRef(onClose)
  useEffect(() => {
    roundEndRef.current = onRoundEnd
    closeRef.current = onClose
  })

  const go = (next: StagePhase) => {
    phaseRef.current = next
    setPhase(next)
  }

  /* Das Spiel lebt so lange wie die Bühne – eine Leinwand, ein Spiel. */
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return
    const insets = safeInsets()
    const game = new SortGame(
      {
        canvas,
        dark: document.documentElement.classList.contains('dark'),
        reducedMotion: reducedMotion(),
        topInset: insets.top + 6,
        bottomInset: insets.bottom,
        vibrate: (pattern) => {
          try {
            navigator.vibrate?.(pattern)
          } catch {
            /* Kein Zittern – kein Verlust. */
          }
        },
      },
      {
        onEnd: (points) => {
          const info = roundEndRef.current(points)
          setResult({ points, info })
          go('result')
        },
      },
    )
    gameRef.current = game
    // Für die Prüfskripte – nur beim Entwickeln, im fertigen Bau fällt die Zeile weg.
    if (import.meta.env.DEV)
      (window as unknown as { __impulseGame?: SortGame }).__impulseGame = game
    const detach = attachSortControls(surface, (side) => {
      if (phaseRef.current === 'play') game.input(side)
    })
    const observer = new ResizeObserver(() => game.resize())
    observer.observe(surface)
    return () => {
      observer.disconnect()
      detach()
      game.destroy()
      gameRef.current = null
    }
  }, [])

  /* In den Hintergrund: Die Runde hält an und wartet auf einen Tipp. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'play') {
        gameRef.current?.pause()
        go('paused')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const start = () => {
    setResult(null)
    setRound((value) => value + 1)
    gameRef.current?.start()
    go('play')
  }

  const resume = () => {
    gameRef.current?.resume()
    go('play')
  }

  /* Das X: mitten in der Runde bricht es ab – was bis dahin geschafft
     ist, zählt –, sonst schliesst es einfach. */
  const close = () => {
    const game = gameRef.current
    if (game && (phaseRef.current === 'play' || phaseRef.current === 'paused')) {
      const points = game.stop()
      if (points > 0) roundEndRef.current(points)
    }
    closeRef.current()
  }
  const closeAction = useRef(close)
  useEffect(() => {
    closeAction.current = close
  })

  /* Escape gehört der Bühne – und nicht dem Feed darunter, der sonst
     gleich mitschlösse. Darum in der Einfangphase und ohne Weitergabe. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.preventDefault()
      closeAction.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  /* Leertaste oder Enter starten die Runde, solange die Einführung steht. */
  useEffect(() => {
    if (phase !== 'intro') return
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.key === ' ' || event.key === 'Enter') &&
        !(event.target as HTMLElement)?.closest('button')
      ) {
        event.preventDefault()
        start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Minispiel: ${title}`}
      data-testid="impulse-game"
      className="fixed inset-0 z-[70] touch-none overflow-hidden overscroll-none select-none"
    >
      <div ref={surfaceRef} className="absolute inset-0" data-round={round}>
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      </div>

      {/* Oben rechts: abbrechen bzw. schliessen. Gross genug für den Daumen –
          und über jeder Tafel, damit das X auch beim Ergebnis greift. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end gap-2 px-3 pt-safe">
        {phase === 'play' && (
          <button
            type="button"
            onClick={() => {
              gameRef.current?.pause()
              go('paused')
            }}
            className="pointer-events-auto mt-2 grid size-11 place-items-center rounded-full bg-white/80 text-slate-700 shadow-sm backdrop-blur-sm transition active:scale-95 dark:bg-slate-900/70 dark:text-slate-200"
            aria-label="Pause"
          >
            <Pause className="size-5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="pointer-events-auto mt-2 grid size-11 place-items-center rounded-full bg-white/80 text-slate-700 shadow-sm backdrop-blur-sm transition active:scale-95 dark:bg-slate-900/70 dark:text-slate-200"
          aria-label={phase === 'play' || phase === 'paused' ? 'Runde abbrechen' : 'Schliessen'}
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {phase === 'intro' && <StageIntro title={title} onStart={start} />}

      {phase === 'paused' && (
        <StagePanel>
          <p className="text-lg font-semibold">Pause</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Die Runde wartet auf dich.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary justify-center py-3 text-base"
              onClick={resume}
              autoFocus
            >
              <Play className="size-5" aria-hidden />
              Weiterspielen
            </button>
            <button type="button" className="btn-secondary justify-center" onClick={close}>
              Runde beenden
            </button>
          </div>
        </StagePanel>
      )}

      {phase === 'result' && result && (
        <StagePanel wide>
          {renderResult(result)}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary justify-center py-3" onClick={close}>
              Fertig
            </button>
            <button
              type="button"
              className="btn-primary justify-center border-0 bg-gradient-to-r from-pink-500 to-orange-400 py-3 text-base text-white hover:from-pink-600 hover:to-orange-500"
              onClick={start}
              autoFocus
            >
              <Play className="size-5" aria-hidden />
              Nochmal
            </button>
          </div>
        </StagePanel>
      )}
    </div>,
    document.body,
  )
}

/** Eine Tafel über dem Spielfeld – mittig, mit Luft rundum, rollbar wenn nötig. */
function StagePanel({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-slate-950/35 p-4 pt-safe pb-safe backdrop-blur-[2px]">
      <div
        className={cn(
          'animate-imp-rise my-auto w-full touch-auto rounded-3xl bg-white/95 p-5 text-center text-slate-900 shadow-xl dark:bg-slate-900/95 dark:text-slate-50',
          wide ? 'max-w-md' : 'max-w-xs',
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** Die Einführung: die zwei Seiten – mit Beispielen – und ein Knopf. */
function StageIntro({ title, onStart }: { title: string; onStart: () => void }) {
  return (
    <StagePanel wide>
      <p className="text-xs font-semibold tracking-wide text-pink-600 uppercase dark:text-pink-300">
        Minispiel
      </p>
      <h2 className="mt-1 text-2xl font-bold text-balance">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-red-50 p-3 text-red-800 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/30">
          <p className="text-2xl leading-none" aria-hidden>
            🚬 🍺 ☕
          </p>
          <p className="mt-2 font-semibold">← {SORT_SIDES.left}</p>
          <p className="text-xs opacity-80">nach links wischen</p>
        </div>
        <div className="rounded-2xl bg-green-50 p-3 text-green-800 ring-1 ring-green-200 dark:bg-green-500/10 dark:text-green-200 dark:ring-green-400/30">
          <p className="text-2xl leading-none" aria-hidden>
            🥦 🌾 🏃
          </p>
          <p className="mt-2 font-semibold">{SORT_SIDES.right} →</p>
          <p className="text-xs opacity-80">nach rechts wischen</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Dran ist der Gegenstand mit dem Ring. Wische ihn auf die richtige Seite – oder tippe links
        bzw. rechts –, bevor er unten ankommt. Drei Leben, zehn richtige am Stück geben eines
        zurück. Und es wird schnell schneller.
      </p>
      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="btn-primary mt-5 w-full justify-center border-0 bg-gradient-to-r from-pink-500 to-orange-400 py-3.5 text-base text-white hover:from-pink-600 hover:to-orange-500"
      >
        <Play className="size-5" aria-hidden />
        Los geht’s
      </button>
    </StagePanel>
  )
}
