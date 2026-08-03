import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Die wiederkehrenden Teile der Import-Assistenten.
 *
 * Alle Importe verlaufen gleich: Quelle einlesen, Vorschau prüfen,
 * schreiben. Was sich unterscheidet, ist allein die Vorschau – deshalb
 * liegen Rahmen, Fortschritt und Abschluss hier, und jede Seite bringt nur
 * ihre eigene Tabelle mit.
 */

export interface Progress {
  done: number
  total: number
}

export function importErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Der Import ist fehlgeschlagen. Es wurden möglicherweise nur Teile geschrieben.'
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  )
}

export function Warning({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn('flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400', className)}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/** Erklärender Kasten unter dem Eingabefeld – was gelesen wird und was das bewirkt. */
export function ImportHint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
      <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {children}
    </div>
  )
}

/**
 * Textfeld zum Einfügen einer kopierten Seite.
 *
 * Der übliche Weg: Die Quellen stehen im Browser und lassen sich nicht
 * herunterladen, kopieren aber schon. Unter dem Feld steht laufend, was
 * erkannt wurde – so sieht man vor dem Weiterklicken, ob die Seite
 * vollständig mitgekommen ist.
 */
export function PasteCard({
  title,
  description,
  placeholder,
  value,
  onChange,
  onSubmit,
  canSubmit,
  status,
  hint,
}: {
  title: string
  description: ReactNode
  placeholder: string
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  canSubmit: boolean
  status: ReactNode
  hint: ReactNode
}) {
  return (
    <div className="card p-4 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>

      <label htmlFor="paste" className="sr-only">
        {title}
      </label>
      <textarea
        id="paste"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Strg/Cmd + Enter übernimmt, ohne zur Maus zu greifen.
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canSubmit) onSubmit()
        }}
        spellCheck={false}
        rows={14}
        placeholder={placeholder}
        className="input mt-4 resize-y font-mono text-xs leading-relaxed whitespace-pre"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {status}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onChange('')}
            disabled={!value}
          >
            Leeren
          </button>
          <button type="button" className="btn-primary" onClick={onSubmit} disabled={!canSubmit}>
            Weiter zur Vorschau
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {hint}
    </div>
  )
}

/**
 * Tabelle der Vorschau. Zeigt höchstens 100 Zeilen – geschrieben werden
 * alle, aber niemand prüft tausend Zeilen am Bildschirm.
 */
export function PreviewTable({
  columns,
  total,
  children,
}: {
  columns: string[]
  total: number
  children: ReactNode
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/60">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
      {total > 100 && (
        <p className="border-t border-slate-200 px-3 py-2 text-center text-xs text-slate-400 dark:border-slate-700">
          Vorschau auf 100 Zeilen begrenzt – geschrieben werden alle {total} Zeilen.
        </p>
      )}
    </div>
  )
}

export function ProgressBar({ progress }: { progress: Progress | null }) {
  if (!progress) return null
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="bg-brand-600 h-full transition-all"
          style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
        />
      </div>
      <p className="mt-1 text-center text-xs text-slate-500">
        {progress.done} von {progress.total} geschrieben …
      </p>
    </div>
  )
}

export function StepButtons({
  onBack,
  onStart,
  busy,
  label,
  disabled,
}: {
  onBack: () => void
  onStart: () => void
  busy: boolean
  label: string
  disabled: boolean
}) {
  return (
    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <button type="button" className="btn-secondary" onClick={onBack} disabled={busy}>
        Zurück
      </button>
      <button type="button" className="btn-primary" onClick={onStart} disabled={busy || disabled}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label}
      </button>
    </div>
  )
}

export function DoneCard({
  summary,
  onReset,
  onLeave,
  leaveLabel,
  resetLabel = 'Weitere Liste importieren',
}: {
  summary: string
  onReset: () => void
  onLeave: () => void
  leaveLabel: string
  resetLabel?: string
}) {
  return (
    <div className="card px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-950">
        <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">Import abgeschlossen</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{summary}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-secondary" onClick={onReset}>
          {resetLabel}
        </button>
        <button type="button" className="btn-primary" onClick={onLeave}>
          {leaveLabel}
        </button>
      </div>
    </div>
  )
}
