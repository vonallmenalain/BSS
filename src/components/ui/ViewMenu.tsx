import { useState, type ReactNode } from 'react'
import { ChevronDown, Minus, Plus, SlidersHorizontal } from 'lucide-react'
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
 * Die Breite gibt die aufrufende Seite an: Ein Menü mit drei Umschaltgruppen
 * braucht mehr als eines mit zwei Zeilen. Auf schmalen Bildschirmen wird es in
 * jedem Fall auf die Fensterbreite gestutzt.
 */
export function ViewMenu({
  label = 'Ansicht',
  width = 'w-72',
  children,
}: {
  label?: string
  /** Tailwind-Breite des Menüs, z. B. `w-80` */
  width?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative" onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
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
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className={cn(
              'animate-scale-in absolute right-0 z-20 mt-1 max-h-[70vh] origin-top-right space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800',
              // Nie breiter als das Fenster: Am Handy stünde das Menü sonst
              // halb ausserhalb des Bildschirms.
              'max-w-[calc(100vw-1.5rem)]',
              width,
            )}
          >
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
        options={options}
        className="w-full"
      />
    </MenuSection>
  )
}

/** Ein Schalter – etwas ein- oder ausblenden. */
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
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="min-w-0">{label}</span>
        <input
          type="checkbox"
          className="size-4 shrink-0 rounded"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
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
            className="btn-ghost p-1"
            onClick={() => clamp(value - 1)}
            disabled={value <= min}
            aria-label={`${label}: weniger`}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="tabular w-6 text-center text-sm font-medium">{value}</span>
          <button
            type="button"
            className="btn-ghost p-1"
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
