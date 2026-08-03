import type { ComponentType, ReactNode } from 'react'
import { Loader2, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-slate-400', className)} aria-hidden />
}

export function LoadingScreen({ label = 'Wird geladen …' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status">
      <Spinner className="size-7" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

/** Platzhalter für leere Listen – nennt immer den nächsten sinnvollen Schritt. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      <div className="mb-3 rounded-full bg-slate-100 p-3 dark:bg-slate-800">
        <Icon className="size-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Eine Zahl mit Beschriftung – die Kopfzeile jeder Import-Vorschau. */
export function SummaryTile({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  return (
    <div className="card p-3 text-center">
      <p className={cn('tabular text-2xl font-semibold', className)}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

/** Ladeplatzhalter, der die spätere Zeilenhöhe vorwegnimmt. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card animate-pulse p-4">
          <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-800/60" />
        </div>
      ))}
    </div>
  )
}
