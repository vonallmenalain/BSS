import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Minus, Plus, SlidersHorizontal, X } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/Pickers'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Zwei Knöpfe, überall dieselben                                      */
/* ------------------------------------------------------------------ */

/**
 * Der Knopf zum Hinzufügen – oben rechts, auf jeder Seite gleich.
 *
 * Am Handy bleibt nur das Pluszeichen stehen: «Sitzung planen» neben
 * «Ansicht» drängte den Seitentitel sonst in die zweite Zeile. Die
 * Beschriftung bleibt für Bildschirmleser erhalten.
 */
export function AddButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <Plus className="size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/**
 * «Ansicht» – alles, was die Darstellung betrifft, hinter einem Knopf.
 *
 * Er steht auf jeder Seite an derselben Stelle: oben rechts, links neben dem
 * Pluszeichen. Was darin steht, ist von Seite zu Seite verschieden – der Weg
 * dorthin ist überall derselbe, und über der Liste bleibt kein Platz für
 * Umschalter, die man einmal im Monat anfasst.
 *
 * **Am Telefon ein Blatt von unten, ab dem Tablet ein Menü am Knopf.**
 * Das ist keine Spielerei: Ein am Knopf aufgehängtes Menü steht dort, wo der
 * Knopf steht – und der rutscht auf schmalen Bildschirmen in die zweite Zeile
 * und damit nach links. Das Menü hing danach zur Hälfte ausserhalb des
 * Bildschirms; die Haken ganz links waren gar nicht mehr zu treffen. Von
 * unten aufgezogen hat es immer die volle Breite und einen festen Platz.
 *
 * Die Breite gilt deshalb erst ab dem Tablet und wird mit dem Vorsatz `sm:`
 * angegeben (`sm:w-80`): Am Telefon bestimmt sie der Bildschirm.
 */
export function ViewMenu({
  label = 'Ansicht',
  width = 'sm:w-72',
  children,
}: {
  label?: string
  /** Breite ab dem Tablet, z. B. `sm:w-80` – am Telefon volle Breite */
  width?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  /* Die Escape-Taste schliesst, egal wo der Fokus gerade steht. */
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {label}
        <ChevronDown className={cn('size-3 transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <>
          {/* Am Telefon verdunkelt der Hintergrund und macht das Blatt zum
              Vordergrund; ab dem Tablet fängt er bloss den Klick daneben ab. */}
          <div
            className="animate-fade-in fixed inset-0 z-40 bg-slate-900/40 sm:bg-transparent"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="menu"
            className={cn(
              'z-50 space-y-3 overflow-y-auto overscroll-contain bg-white dark:bg-slate-800',
              // Telefon: ein Blatt von unten, über die ganze Breite.
              'animate-slide-up fixed inset-x-0 bottom-0 max-h-[80dvh] rounded-t-2xl border-t border-slate-200 p-4',
              'pb-[calc(env(safe-area-inset-bottom)+1.25rem)] dark:border-slate-700',
              // Ab dem Tablet: das gewohnte Menü unter dem Knopf.
              'sm:animate-scale-in sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-auto sm:mt-1',
              'sm:max-h-[70vh] sm:origin-top-right sm:rounded-xl sm:border sm:p-3 sm:pb-3 sm:shadow-lg',
              width,
            )}
          >
            {/* Nur am Telefon: Das Blatt sagt, wozu es gehört, und lässt sich
                ohne Zielen wieder schliessen. */}
            <div className="flex items-center justify-between sm:hidden">
              <span className="text-sm font-semibold">{label}</span>
              <button
                type="button"
                className="btn-ghost -mr-1.5 p-2"
                onClick={() => setOpen(false)}
                aria-label={`${label} schliessen`}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {children}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bausteine für den Inhalt                                            */
/* ------------------------------------------------------------------ */

/** Ein beschrifteter Abschnitt im Menü. */
export function MenuSection({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

/**
 * Eine Umschaltgruppe – der Normalfall im Ansichtsmenü.
 *
 * Die Knopfleiste nimmt die ganze Menübreite ein, damit alle Wahlmöglichkeiten
 * nebeneinander Platz finden und keine am Rand abgeschnitten wird.
 */
export function MenuChoice<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string
  hint?: string
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string; count?: number }[]
}) {
  return (
    <MenuSection label={label} hint={hint}>
      <SegmentedControl<T>
        value={value}
        onChange={onChange}
        size="sm"
        wrap
        options={options}
        className="w-full"
      />
    </MenuSection>
  )
}

/**
 * Mehrfachauswahl als Reihe von Chips – für Filter mit vielen gleichrangigen
 * Werten, etwa Jahrzahlen.
 *
 * Nichts gewählt heisst «alles»; genau das sagt der erste Chip, und ein Griff
 * auf ihn stellt diesen Zustand wieder her. Eine Liste zum Aufklappen wäre
 * hier falsch: Man wählt zwei Jahre nebeneinander und will beide sehen.
 */
export function MenuChips<T extends string | number>({
  label,
  hint,
  values,
  onChange,
  options,
  allLabel = 'Alle',
}: {
  label: string
  hint?: string
  values: T[]
  onChange: (next: T[]) => void
  options: { value: T; label: string }[]
  allLabel?: string
}) {
  const toggle = (value: T) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])

  return (
    <MenuSection label={label} hint={hint}>
      <div className="flex flex-wrap gap-1">
        <MenuChip selected={values.length === 0} onClick={() => onChange([])}>
          {allLabel}
        </MenuChip>
        {options.map((option) => (
          <MenuChip
            key={option.value}
            selected={values.includes(option.value)}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </MenuChip>
        ))}
      </div>
    </MenuSection>
  )
}

function MenuChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'tabular rounded-full border px-3 py-1.5 text-xs font-medium transition',
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-100'
          : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Ein Schalter – etwas ein- oder ausblenden.
 *
 * Die ganze Zeile gehört zur Beschriftung: Am Telefon zielt niemand auf ein
 * Kästchen von der Grösse eines Fingernagels, und ein Griff daneben blieb
 * bisher wirkungslos.
 */
export function MenuToggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  hint?: string
}) {
  return (
    <div>
      <label className="-mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
        <span className="min-w-0">{label}</span>
        <input
          type="checkbox"
          className="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

/**
 * Eine Spanne aus zwei Zahlen – «ab 18», «bis 30», beides freilassbar.
 *
 * Für das Alter: Zwei Knöpfe wie beim Zähler wären hier falsch, weil der Weg
 * von 0 auf 18 achtzehn Griffe bedeutete. Leer heisst «keine Grenze» – und
 * genau so wird es auch angeschrieben.
 */
export function MenuRange({
  label,
  hint,
  from,
  to,
  onChange,
  min = 0,
  max = 120,
  fromLabel = 'ab',
  toLabel = 'bis',
}: {
  label: string
  hint?: string
  from: number | null
  to: number | null
  onChange: (next: { from: number | null; to: number | null }) => void
  min?: number
  max?: number
  fromLabel?: string
  toLabel?: string
}) {
  const parse = (value: string) => {
    if (!value.trim()) return null
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return null
    return Math.min(max, Math.max(min, parsed))
  }

  return (
    <MenuSection label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          className="input tabular py-1.5"
          value={from ?? ''}
          min={min}
          max={max}
          placeholder={fromLabel}
          aria-label={`${label}: ${fromLabel}`}
          onChange={(event) => onChange({ from: parse(event.target.value), to })}
        />
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">–</span>
        <input
          type="number"
          inputMode="numeric"
          className="input tabular py-1.5"
          value={to ?? ''}
          min={min}
          max={max}
          placeholder={toLabel}
          aria-label={`${label}: ${toLabel}`}
          onChange={(event) => onChange({ from, to: parse(event.target.value) })}
        />
        {(from !== null || to !== null) && (
          <button
            type="button"
            className="btn-ghost shrink-0 p-2"
            onClick={() => onChange({ from: null, to: null })}
            aria-label={`${label}: Einschränkung aufheben`}
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </MenuSection>
  )
}

/**
 * Wonach sortiert wird – und in welche Richtung.
 *
 * Beides gehört zusammen: «Alter aufsteigend» ist eine Angabe, keine zwei.
 * Deshalb stehen sie untereinander im selben Abschnitt statt als Auswahlfeld
 * hier und als Pfeilknopf irgendwo daneben.
 */
export function MenuSort<T extends string>({
  label = 'Sortieren nach',
  value,
  direction,
  onChange,
  onDirection,
  options,
  ascLabel = 'Aufsteigend',
  descLabel = 'Absteigend',
}: {
  label?: string
  value: T
  direction: 'asc' | 'desc'
  onChange: (next: T) => void
  onDirection: (next: 'asc' | 'desc') => void
  options: { value: T; label: string }[]
  ascLabel?: string
  descLabel?: string
}) {
  return (
    <MenuSection label={label}>
      <select
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="mt-2">
        <SegmentedControl<'asc' | 'desc'>
          value={direction}
          onChange={onDirection}
          size="sm"
          className="w-full"
          options={[
            { value: 'asc', label: ascLabel },
            { value: 'desc', label: descLabel },
          ]}
        />
      </div>
    </MenuSection>
  )
}

/**
 * Eine Anzahl – «wie viele Traktanden zeigt die Kachel?».
 *
 * Zwei Knöpfe statt eines Zahlenfeldes: Es geht um eine Handvoll Schritte,
 * und ein Feld, in das man tippen kann, lädt zu Werten ein, die keinen Sinn
 * ergeben.
 */
export function MenuCounter({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
  hint,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  hint?: string
}) {
  const clamp = (next: number) => onChange(Math.min(max, Math.max(min, next)))

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-sm">{label}</span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => clamp(value - 1)}
            disabled={value <= min}
            aria-label={`${label}: weniger`}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="tabular w-6 text-center text-sm font-medium">{value}</span>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => clamp(value + 1)}
            disabled={value >= max}
            aria-label={`${label}: mehr`}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </span>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

/** Eine Trennlinie zwischen zwei Gruppen im Menü. */
export function MenuDivider() {
  return <hr className="border-slate-200 dark:border-slate-700" />
}
