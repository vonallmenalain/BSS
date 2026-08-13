import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IMPULSE_SECTIONS, type ImpulseSectionKey } from '@/lib/impulseSections'
import type { ScreenOrigin } from '@/components/impulse/ImpulseScreen'

/*
 * Die Kacheln unter dem Wochenimpuls: Wochenziel, Tages-Challenge, Mein
 * Fortschritt, Gemerkt und die Mitmach-Ecke. Sie gehören bewusst nicht
 * zum Vollbild-Feed – sie sind die Werkzeuge und Aufgaben neben den
 * Karten der Woche, und sie verschwinden, sobald der Feed offen ist.
 * Ein Tipp öffnet den Vollbild-Raum des Bereichs, von der Kachel her
 * (der Klickpunkt wird zum transform-origin des Raums).
 */

/** Der Klickpunkt einer Kachel – von dort wächst der Vollbild-Raum. */
function tileOrigin(element: HTMLElement): ScreenOrigin {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * Eine Kachel des Dashboards: Farbe und Icon des Bereichs, darunter eine
 * Statuszeile – was gerade ansteht oder erreicht ist. Ein Haken statt
 * des Pfeils sagt ohne Worte: erledigt.
 */
export function SectionTile({
  section,
  status,
  done = false,
  badge,
  delay,
  onOpen,
}: {
  section: ImpulseSectionKey
  /** Eine Zeile Stand: die Aufgabe, die Serie, die Anzahl … */
  status: string
  /** Erledigt – die Kachel trägt einen Haken statt des Pfeils. */
  done?: boolean
  /** Eine kleine Zusatzmarke neben dem Titel («2 eingereicht»). */
  badge?: string
  delay: string
  onOpen: (key: ImpulseSectionKey, origin: ScreenOrigin) => void
}) {
  const theme = IMPULSE_SECTIONS[section]
  return (
    <button
      type="button"
      onClick={(event) => onOpen(section, tileOrigin(event.currentTarget))}
      style={{ animationDelay: delay }}
      className="card animate-imp-rise group flex h-full w-full flex-col items-stretch gap-2.5 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs"
    >
      <span className="flex items-center gap-2">
        <span
          className={cn('grid size-9 shrink-0 place-items-center rounded-xl', theme.iconBox)}
          aria-hidden
        >
          <theme.icon className="size-4.5" />
        </span>
        <span className="ms-auto" aria-hidden>
          {done ? (
            <Check className="size-4 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <ChevronRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          )}
        </span>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="truncate">{theme.label}</span>
          {badge && (
            <span className={cn('badge shrink-0 bg-slate-100/90 dark:bg-slate-800/90', theme.text)}>
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
          {done && <span className="sr-only">Erledigt: </span>}
          {status}
        </span>
      </span>
    </button>
  )
}
