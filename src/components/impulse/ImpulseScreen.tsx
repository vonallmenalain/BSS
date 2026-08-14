import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, LayoutGrid, Tent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { lockScroll } from '@/lib/scrollLock'
import {
  IMPULSE_SECTIONS,
  type ImpulseSection,
  type ImpulseSectionKey,
} from '@/lib/impulseSections'

/*
 * Der Vollbild-Raum des Bereichs «Anti Doom».
 *
 * Jede Kachel des Dashboards öffnet ihren Bereich hier: ein Raum, eine
 * Sache, volle Aufmerksamkeit – die Form, die der Feed vorgemacht
 * hat. Oben der Weg zurück, unten der Bereichswechsler: eine Chip-Leiste,
 * mit der man den Raum wechselt, ohne durch die Übersicht zu müssen –
 * und die auch zurück in den AP-Kalender führt. Der Farbschleier oben
 * sagt ohne Worte, wo man ist.
 *
 * Bewegung: Der Raum tritt von seiner Kachel her an (transform-origin
 * kommt vom Klickpunkt) und geht schneller, als er kam. Beim Wechsel
 * zwischen Bereichen bleibt die Shell stehen; nur Inhalt und Schleier
 * treten neu auf – wie Zimmer im selben Haus, nicht neue Häuser.
 */

export interface ScreenOrigin {
  x: number
  y: number
}

export function ImpulseScreen({
  section,
  sections,
  origin,
  onSelect,
  onClose,
  onToAp,
  children,
}: {
  section: ImpulseSectionKey
  /** Welche Bereiche der Wechsler anbietet – in Lesereihenfolge. */
  sections: ImpulseSectionKey[]
  /** Wo der öffnende Tipp sass – von dort wächst der Raum heran. */
  origin?: ScreenOrigin | null
  onSelect: (key: ImpulseSectionKey) => void
  onClose: () => void
  /** Zurück in den AP-Kalender – `null`, wenn das Konto ihn nicht sieht. */
  onToAp: (() => void) | null
  children: ReactNode
}) {
  const theme = IMPULSE_SECTIONS[section]
  const rootRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)

  /* Hinter dem Vollbild soll nichts mitrollen – wie beim Feed. */
  useEffect(() => lockScroll(), [])

  /* Beim Öffnen den Fokus in den Raum holen – Escape schliesst ihn. */
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
  }, [])

  /*
   * Schliessen mit Abgang: erst der kurze Austritt (150 ms), dann die
   * Navigation. Wer Bewegung reduziert hat, geht sofort – die globale
   * Regel würde die Transition ohnehin auf null drehen.
   */
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  const close = () => {
    if (closing) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      closeRef.current()
      return
    }
    setClosing(true)
    window.setTimeout(() => closeRef.current(), 150)
  }
  const closeHandler = useRef(close)
  useEffect(() => {
    closeHandler.current = close
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHandler.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={theme.label}
      tabIndex={-1}
      data-closing={closing || undefined}
      className="imp-screen fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50 outline-none dark:bg-slate-950"
      style={{ transformOrigin: origin ? `${origin.x}px ${origin.y}px` : '50% 40%' }}
    >
      {/* Der Farbschleier des Bereichs – oben getönt, unten still. Beim
          Bereichswechsel tritt er neu auf (key) und blendet weich ein. */}
      <div
        key={section}
        aria-hidden
        className={cn(
          'imp-wash pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b to-transparent',
          theme.wash,
        )}
      />

      <header className="pt-safe relative">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <button
            type="button"
            className="btn-ghost -ms-1 rounded-full p-2"
            onClick={close}
            aria-label="Zur Übersicht"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <span
            className={cn('grid size-7 shrink-0 place-items-center rounded-lg', theme.iconBox)}
            aria-hidden
          >
            <theme.icon className="size-4" />
          </span>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{theme.label}</h1>
        </div>
      </header>

      {/* Der Inhalt: eine ruhige Spalte, unten Luft für den Wechsler.
          Beim Bereichswechsel tritt er kurz von unten an (key). */}
      <div className="relative flex-1 overflow-y-auto overscroll-contain">
        <div key={section} className="animate-imp-rise mx-auto w-full max-w-xl px-4 pt-1 pb-32">
          {children}
        </div>
      </div>

      {/* Der Bereichswechsler: Übersicht, die Räume der Woche – und der
          Weg zurück in den AP-Kalender. Eine Leiste wie eine App-Leiste,
          durchscheinend, der Inhalt rollt dahinter weiter. */}
      <nav
        aria-label="Bereiche"
        className="absolute inset-x-0 bottom-0 border-t border-slate-200/60 bg-white/70 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60"
      >
        <div className="pb-safe">
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-3 py-2">
            <SwitcherChip label="Übersicht" icon={LayoutGrid} onClick={close} />
            <span
              className="mx-1 h-5 w-px shrink-0 bg-slate-300/70 dark:bg-slate-700/70"
              aria-hidden
            />
            {sections.map((key) => (
              <SwitcherChip
                key={key}
                label={IMPULSE_SECTIONS[key].short}
                icon={IMPULSE_SECTIONS[key].icon}
                active={key === section}
                theme={IMPULSE_SECTIONS[key]}
                onClick={() => {
                  if (key !== section) onSelect(key)
                }}
              />
            ))}
            {onToAp && (
              <>
                <span
                  className="mx-1 h-5 w-px shrink-0 bg-slate-300/70 dark:bg-slate-700/70"
                  aria-hidden
                />
                <SwitcherChip label="AP" icon={Tent} onClick={onToAp} />
              </>
            )}
          </div>
        </div>
      </nav>
    </div>,
    document.body,
  )
}

/** Ein Chip des Wechslers – der aktive trägt die Farbe seines Bereichs. */
function SwitcherChip({
  label,
  icon: Icon,
  active = false,
  theme,
  onClick,
}: {
  label: string
  icon: ImpulseSection['icon']
  active?: boolean
  theme?: ImpulseSection
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  /* Der aktive Chip rollt in Sicht – sanft, ausser Bewegung ist reduziert. */
  useEffect(() => {
    if (!active) return
    ref.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }, [active])

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition select-none active:scale-95',
        active && theme
          ? cn(theme.chipActive, 'shadow-xs')
          : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/60',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  )
}
