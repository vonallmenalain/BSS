import { Award, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IMPULSE_SECTIONS, type ImpulseSectionKey } from '@/lib/impulseSections'
import { ImpulseRing } from '@/components/impulse/ImpulseRing'
import type { ScreenOrigin } from '@/components/impulse/ImpulseScreen'

/*
 * Die ruhigen Zeilen unter dem Wischstapel: Mein Fortschritt und die
 * Mitmach-Ecke. Sie gehören nicht zum Stapel – sie sind keine Karten der
 * Woche, sondern die Tür zum eigenen Weg und zum Einreichen. Ein Tipp
 * öffnet den Vollbild-Raum, von der Zeile her (der Klickpunkt wird zum
 * transform-origin des Raums).
 */

/** Der Klickpunkt einer Zeile – von dort wächst der Vollbild-Raum. */
function rowOrigin(element: HTMLElement): ScreenOrigin {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

const ROW_CLASS =
  'card animate-imp-rise group flex w-full items-center gap-4 p-4 text-left transition ' +
  'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs'

/**
 * Mein Fortschritt: Serie als Ring, Abzeichen als Zahl – und dahinter die
 * ganze Statistik. Der Ring misst den Weg zum nächsten Serien-Meilenstein
 * (4 bzw. 8 Wochen).
 */
export function ProgressRow({
  streak,
  badgeCount,
  badgeTotal,
  delay,
  onOpen,
}: {
  streak: { current: number; best: number }
  badgeCount: number
  badgeTotal: number
  delay: string
  onOpen: (key: ImpulseSectionKey, origin: ScreenOrigin) => void
}) {
  const theme = IMPULSE_SECTIONS.fortschritt
  const { current, best } = streak
  const target = current < 4 ? 4 : 8
  return (
    <button
      type="button"
      onClick={(event) => onOpen('fortschritt', rowOrigin(event.currentTarget))}
      style={{ animationDelay: delay }}
      className={ROW_CLASS}
    >
      <ImpulseRing value={current} max={target} size={56} arcClass={theme.ring}>
        <theme.icon
          className={cn('size-5', current > 0 ? theme.text : 'text-slate-300 dark:text-slate-600')}
          aria-hidden
        />
      </ImpulseRing>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Mein Fortschritt</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {current > 0 ? (
            <>
              {current} {current === 1 ? 'Woche' : 'Wochen'} in Folge
              {best > current && ` · beste ${best}`}
            </>
          ) : (
            'Deine Serie beginnt mit dem ersten Haken.'
          )}
        </span>
        <span className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Award className="size-3.5 text-amber-500" aria-hidden />
          {badgeCount} von {badgeTotal} Abzeichen
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}

/** Die Mitmach-Ecke: Dein Vers oder deine Quizidee – mit deinem Namen. */
export function MitmachRow({
  openSubmissions,
  delay,
  onOpen,
}: {
  openSubmissions: number
  delay: string
  onOpen: (key: ImpulseSectionKey, origin: ScreenOrigin) => void
}) {
  const theme = IMPULSE_SECTIONS.mitmachen
  return (
    <button
      type="button"
      onClick={(event) => onOpen('mitmachen', rowOrigin(event.currentTarget))}
      style={{ animationDelay: delay }}
      className={ROW_CLASS}
    >
      <span
        className={cn('grid size-10 shrink-0 place-items-center rounded-xl', theme.iconBox)}
        aria-hidden
      >
        <theme.icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold">
          Mitmach-Ecke
          {openSubmissions > 0 && (
            <span className={cn('badge bg-slate-100/90 dark:bg-slate-800/90', theme.text)}>
              {openSubmissions} eingereicht
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          Dein Vers oder deine Quizidee – auf der Karte steht dein Name.
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}
