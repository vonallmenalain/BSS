import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ein kleiner Fortschrittsring – die Serie als Bild statt als Satz.
 *
 * Reines SVG mit `stroke-dashoffset`: Beim Erscheinen zeichnet sich der
 * Bogen vom Nullpunkt auf den Stand (`.imp-ring-arc` in `index.css`),
 * danach gleitet er bei jeder Änderung – eine Transition, kein Keyframe,
 * damit schnelle Folgen sauber ineinander übergehen. Die Farbe bringt
 * der Aufrufer als Textklasse mit (`currentColor`).
 */
export function ImpulseRing({
  value,
  max,
  size = 56,
  stroke = 5,
  arcClass,
  className,
  children,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  /** Farbklasse des Bogens, z. B. `text-orange-500`. */
  arcClass: string
  className?: string
  children?: ReactNode
}) {
  const share = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200 dark:text-slate-700/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          className={cn('imp-ring-arc', arcClass)}
          style={{ '--imp-ring-c': `${circumference}px` } as React.CSSProperties}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  )
}
