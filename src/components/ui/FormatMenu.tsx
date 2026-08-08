import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Ban, Baseline, ChevronDown, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  activeFormatTarget,
  applyToField,
  selectionOf,
  subscribeFormatTarget,
  type FormatTarget,
} from '@/lib/formatTarget'
import {
  applyColor,
  BACKGROUND_COLORS,
  formatOf,
  hasBullets,
  TEXT_COLORS,
  toggleBullets,
  type Edit,
  type Format,
} from '@/lib/textFormat'

/**
 * Das kleine Menü zum Auszeichnen von Text.
 *
 * Drei Handgriffe, mehr nicht: **Aufzählung**, **Schriftfarbe**,
 * **Hintergrundfarbe**. Es steht dort, wo auch sonst steht, was den ganzen
 * Eintrag betrifft – oben rechts, neben dem Pfeil zum Zuklappen bzw. neben
 * dem Kreuz der Notiz.
 *
 * **Der Fokus bleibt im Text.** Jeder Griff im Menü hält den Mauszeiger davon
 * ab, ihn wegzunehmen (`onMouseDown` mit `preventDefault`). Sonst wäre die
 * Markierung verschwunden, kaum dass man sie färben wollte, und der Eintrag
 * fiele aus dem Schreiben ins Lesen zurück.
 *
 * **Das Menü hängt am Dokument, nicht am Knopf.** Der Knopf sitzt im Kopf
 * einer Karte oder eines Fensters, und ein Fenster schneidet ab, was über
 * seinen Rand ragt (`overflow-hidden`) – ein Menü darin wäre zur Hälfte
 * unsichtbar. Es wird deshalb ans Ende des Dokuments gehängt und von Hand
 * unter den Knopf gestellt; ist unten kein Platz, klappt es nach oben.
 *
 * **Es legt sich nicht über die Seite.** Kein dunkler Grund, keine Fläche,
 * die Griffe abfängt: Wer offenen Menüs eine andere Stelle im Text markieren
 * will, soll das können, und das Menü zeigt danach, was dort gilt.
 */
export function FormatMenu({
  scope,
  className,
}: {
  /**
   * Der Bereich, für den dieses Menü zuständig ist – die Karte, das Fenster.
   *
   * Ohne diese Grenze formatierte der Griff oben rechts unter Umständen einen
   * Text zwei Einträge weiter unten, weil dort zuletzt geschrieben wurde.
   */
  scope?: RefObject<HTMLElement | null>
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  /*
   * Ob ein Feld bereitsteht, entscheidet über den Inhalt des Menüs. Der
   * Merkzettel dazu liegt ausserhalb von React (`lib/formatTarget`) – deshalb
   * wird er abonniert statt durch die halbe Seite gereicht.
   */
  const ready = useSyncExternalStore(
    subscribeFormatTarget,
    () => activeFormatTarget(scope?.current) !== null,
  )

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        className="btn-ghost gap-0.5 px-1.5 py-1.5"
        // Auch der Knopf selbst darf den Fokus nicht aus dem Text nehmen.
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Text formatieren"
        title="Text formatieren"
      >
        <Baseline className="size-4" aria-hidden />
        <ChevronDown className={cn('size-3 transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <Panel anchor={buttonRef} scope={scope} onClose={close}>
          <FormatPanel ready={ready} scope={scope} />
        </Panel>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Der Inhalt                                                          */
/* ------------------------------------------------------------------ */

/** Was im Feld gerade gilt. */
interface Stand {
  format: Format
  bullets: boolean
  multiline: boolean
  selected: boolean
}

function FormatPanel({ ready, scope }: { ready: boolean; scope?: RefObject<HTMLElement | null> }) {
  const target = () => activeFormatTarget(scope?.current)

  /*
   * Der Stand wird abgelesen und nicht mitgeführt: Wo der Cursor steht und
   * was markiert ist, weiss allein das Feld. Gelesen wird beim Öffnen, nach
   * jedem Griff – und immer dann, wenn sich die Auswahl irgendwo ändert.
   * `selectionchange` meldet das in neueren Browsern auch für Textfelder;
   * `mouseup` und `keyup` sind das Netz darunter.
   */
  const [stand, setStand] = useState<Stand | null>(() => read(target()))

  useEffect(() => {
    const refresh = () => setStand(read(activeFormatTarget(scope?.current)))
    document.addEventListener('selectionchange', refresh)
    document.addEventListener('mouseup', refresh)
    document.addEventListener('keyup', refresh)
    return () => {
      document.removeEventListener('selectionchange', refresh)
      document.removeEventListener('mouseup', refresh)
      document.removeEventListener('keyup', refresh)
    }
  }, [scope])

  const run = (change: (raw: string, start: number, end: number) => Edit) => {
    const active = target()
    if (!active) return
    const { start, end } = selectionOf(active)
    applyToField(active, change(active.field.value, start, end))
    setStand(read(active))
  }

  if (!ready || !stand) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Zuerst in den Text greifen – und markieren, was anders aussehen soll.
      </p>
    )
  }

  const { format, bullets, multiline, selected } = stand

  return (
    <div className="space-y-3">
      {multiline && (
        <Section label="Aufzählung">
          <button
            type="button"
            onClick={() => run(toggleBullets)}
            aria-pressed={bullets}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition',
              bullets
                ? 'border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100'
                : 'border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
            )}
          >
            <List className="size-4 shrink-0 text-slate-400" aria-hidden />
            {bullets ? 'Aufzählung aufheben' : 'Als Aufzählung'}
          </button>
        </Section>
      )}

      <Section label="Schriftfarbe">
        <Swatches
          disabled={!selected}
          active={format.color}
          options={TEXT_COLORS}
          noneLabel="Standard"
          onPick={(value) => run((raw, start, end) => applyColor(raw, start, end, 'color', value))}
        />
      </Section>

      <Section label="Hintergrundfarbe">
        <Swatches
          disabled={!selected}
          active={format.background}
          options={BACKGROUND_COLORS}
          noneLabel="Keine"
          onPick={(value) =>
            run((raw, start, end) => applyColor(raw, start, end, 'background', value))
          }
        />
      </Section>

      {!selected && <p className="hint mt-0">Für die Farben zuerst Text markieren.</p>}
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="label mb-1">{label}</span>
      {children}
    </div>
  )
}

/** Eine Reihe Farbtupfer – der erste nimmt die Farbe wieder weg. */
function Swatches<T extends string>({
  options,
  active,
  disabled,
  noneLabel,
  onPick,
}: {
  options: readonly { key: T; label: string; dot: string }[]
  active: T | undefined
  disabled: boolean
  noneLabel: string
  onPick: (value: T | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Swatch
        label={noneLabel}
        selected={active === undefined}
        disabled={disabled}
        onPick={() => onPick(null)}
      >
        <Ban className="size-3.5 text-slate-400" aria-hidden />
      </Swatch>

      {options.map((option) => (
        <Swatch
          key={option.key}
          label={option.label}
          selected={active === option.key}
          disabled={disabled}
          onPick={() => onPick(option.key)}
        >
          <span className={cn('size-4 rounded-full', option.dot)} aria-hidden />
        </Swatch>
      ))}
    </div>
  )
}

function Swatch({
  label,
  selected,
  disabled,
  onPick,
  children,
}: {
  label: string
  selected: boolean
  disabled: boolean
  onPick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-7 place-items-center rounded-full border transition',
        'disabled:pointer-events-none disabled:opacity-40',
        selected
          ? 'border-brand-500 ring-brand-500/30 ring-2'
          : 'border-slate-300 hover:border-slate-400 dark:border-slate-600',
      )}
    >
      {children}
    </button>
  )
}

/** Den Stand im Feld ablesen. */
function read(target: FormatTarget | null): Stand | null {
  if (!target) return null
  const { start, end } = selectionOf(target)
  const raw = target.field.value
  return {
    format: formatOf(raw, start, end),
    bullets: hasBullets(raw, start, end),
    multiline: target.multiline ?? false,
    selected: start !== end,
  }
}

/* ------------------------------------------------------------------ */
/* Die Fläche, auf der es steht                                        */
/* ------------------------------------------------------------------ */

/** Höhe, mit der gerechnet wird, bevor das Menü gemessen ist. */
const ESTIMATED_HEIGHT = 260

function Panel({
  anchor,
  onClose,
  scope,
  children,
}: {
  anchor: RefObject<HTMLButtonElement | null>
  onClose: () => void
  scope?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const place = () => {
      const button = anchor.current
      if (!button) return
      const box = button.getBoundingClientRect()
      const height = panelRef.current?.offsetHeight ?? ESTIMATED_HEIGHT
      // Nach unten, solange dort Platz ist – sonst nach oben. Am rechten Rand
      // ausgerichtet, weil der Knopf dort steht.
      const below = box.bottom + 6 + height <= window.innerHeight
      setStyle({
        position: 'fixed',
        right: Math.max(8, window.innerWidth - box.right),
        ...(below
          ? { top: box.bottom + 6 }
          : { bottom: Math.max(8, window.innerHeight - box.top + 6) }),
      })
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor])

  /*
   * Ein Griff daneben schliesst – ausser er gilt dem Menü selbst, dem Knopf
   * oder dem Text, um den es geht.
   */
  useEffect(() => {
    const onDown = (event: MouseEvent | TouchEvent) => {
      const node = event.target as Node | null
      if (!node) return
      if (panelRef.current?.contains(node)) return
      if (anchor.current?.contains(node)) return
      // Der Text, um den es geht, bleibt anfassbar: Wer eine andere Stelle
      // markieren will, soll das können, ohne das Menü zu verlieren.
      if (activeFormatTarget(scope?.current)?.field.contains(node)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [anchor, onClose, scope])

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      style={style ?? { position: 'fixed', top: -9999, left: 0 }}
      className={cn(
        // Breit genug, dass jede Farbreihe auf eine Zeile passt – eine
        // umgebrochene Palette liest sich wie zwei verschiedene.
        'animate-scale-in z-50 w-72 max-w-[calc(100vw-1rem)] origin-top-right',
        'rounded-xl border border-slate-200 bg-white p-3 shadow-lg',
        'dark:border-slate-700 dark:bg-slate-800',
      )}
    >
      {children}
    </div>,
    document.body,
  )
}
