import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
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

/** Wie viele Zeilen je Seite – «0» heisst alle. */
const PAGE_SIZES = [25, 50, 100, 250, 0]

/**
 * Tabelle der Vorschau – Zeile für Zeile, und zwar ganz.
 *
 * Eine Liste aus dem LCR hat leicht ein paar hundert Zeilen, und gerade die
 * weiter unten wollen geprüft sein. Deshalb lässt sich blättern und die
 * Seitengrösse wählen («Alle» zeigt alles auf einmal). Bei höchstens 25
 * Zeilen fällt beides weg; dann passt ohnehin alles auf eine Seite.
 *
 * `toolbar` steht links neben der Seitengrösse, etwa ein Filter, und
 * `footnote` hinter dem Zeilenzähler. Wechselt `resetKey` – etwa der
 * Filter –, beginnt die Vorschau wieder auf der ersten Seite.
 */
export function PreviewTable<T>({
  columns,
  rows,
  renderRow,
  toolbar,
  footnote,
  resetKey,
}: {
  columns: string[]
  rows: readonly T[]
  /** Eine Zeile `<tr>`; `index` zählt über alle Seiten hinweg. */
  renderRow: (row: T, index: number) => ReactNode
  toolbar?: ReactNode
  footnote?: ReactNode
  resetKey?: string
}) {
  const [pageSize, setPageSize] = useState(100)
  const [page, setPage] = useState(0)
  const [seenKey, setSeenKey] = useState(resetKey)
  const top = useRef<HTMLDivElement>(null)

  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setPage(0)
  }

  const size = pageSize === 0 ? Math.max(rows.length, 1) : pageSize
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(page, pages - 1)
  const from = current * size
  const shown = rows.slice(from, from + size)
  const controls = toolbar !== undefined || rows.length > PAGE_SIZES[0]

  // Geblättert wird unten; die neue Seite soll oben beginnen, nicht dort.
  const goTo = (next: number) => {
    setPage(next)
    const card = top.current
    if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start' })
  }

  return (
    <div ref={top} className="card scroll-mt-16 overflow-hidden">
      {controls && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          {toolbar}
          <label className="ms-auto flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            Zeilen je Seite
            <select
              className="input w-auto py-1 text-xs"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(0)
              }}
            >
              {PAGE_SIZES.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? 'Alle' : value}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="overflow-x-auto">
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
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((row, index) => renderRow(row, from + index))}
          </tbody>
        </table>
      </div>

      {controls && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
          <p className="tabular text-xs text-slate-500 dark:text-slate-400">
            {rows.length === 0
              ? 'Keine Zeilen'
              : `Zeilen ${from + 1}–${from + shown.length} von ${rows.length}`}
            {footnote}
          </p>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => goTo(current - 1)}
                disabled={current === 0}
                aria-label="Vorherige Seite"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <span className="tabular text-xs text-slate-500 dark:text-slate-400">
                Seite {current + 1} von {pages}
              </span>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => goTo(current + 1)}
                disabled={current >= pages - 1}
                aria-label="Nächste Seite"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
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
