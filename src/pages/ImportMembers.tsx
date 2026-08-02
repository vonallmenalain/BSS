import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/ui/Pickers'
import { cn } from '@/lib/utils'
import {
  buildPreview,
  DEFAULT_IMPORT_OPTIONS,
  FIELD_LABELS,
  guessMapping,
  parseFile,
  runImport,
  type ImportOptions,
  type ImportPreview,
  type MemberField,
  type ParsedSheet,
} from '@/services/import'

type Step = 'upload' | 'mapping' | 'preview' | 'done'

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Datei' },
  { key: 'mapping', label: 'Spalten' },
  { key: 'preview', label: 'Prüfen' },
  { key: 'done', label: 'Fertig' },
]

/**
 * Import-Assistent für die Mitgliederliste.
 *
 * Vier Schritte, weil der Abgleich der heikle Teil ist: Datei einlesen,
 * Spalten zuordnen, Vorschau prüfen, schreiben. Beim Wiederholungsimport
 * erkennt die Vorschau bestehende Datensätze und aktualisiert sie, statt
 * Dubletten anzulegen.
 */
export function ImportMembers() {
  const { members } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<MemberField[]>([])
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(
    null,
  )
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const parsed = await parseFile(file)
        if (parsed.rows.length === 0) {
          toast.error('In der Datei wurden keine Datenzeilen gefunden.')
          return
        }
        setFileName(file.name)
        setSheet(parsed)
        setMapping(guessMapping(parsed.headers))
        setStep('mapping')
      } catch (error) {
        console.error(error)
        toast.error('Die Datei konnte nicht gelesen werden. Unterstützt: .xlsx und .csv')
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

  const preview: ImportPreview | null = useMemo(() => {
    if (!sheet || step === 'upload') return null
    return buildPreview(sheet, mapping, members)
  }, [sheet, mapping, members, step])

  const hasName = mapping.some((field) =>
    ['lastName', 'firstName', 'fullName'].includes(field),
  )

  const start = async () => {
    if (!preview) return
    setBusy(true)
    setProgress({ done: 0, total: preview.createCount + preview.updateCount })
    try {
      const outcome = await runImport(preview, options, (done, total) =>
        setProgress({ done, total }),
      )
      setResult(outcome)
      setStep('done')
      toast.success(`${outcome.created} neu, ${outcome.updated} aktualisiert.`)
    } catch (error) {
      console.error(error)
      toast.error('Der Import ist fehlgeschlagen. Es wurden möglicherweise nur Teile geschrieben.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const reset = () => {
    setStep('upload')
    setSheet(null)
    setMapping([])
    setResult(null)
    setFileName('')
  }

  return (
    <>
      <Link
        to="/mitglieder"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mitglieder
      </Link>

      <PageHeader
        title="Mitglieder importieren"
        subtitle="Excel- oder CSV-Datei einlesen und mit dem Bestand abgleichen"
      />

      {/* Schrittanzeige */}
      <ol className="mb-6 flex items-center gap-2 text-sm">
        {STEPS.map((entry, index) => {
          const currentIndex = STEPS.findIndex((s) => s.key === step)
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo'
          return (
            <li key={entry.key} className="flex items-center gap-2">
              <span
                className={cn(
                  'tabular grid size-6 place-items-center rounded-full text-xs font-semibold',
                  state === 'done'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : state === 'current'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
                )}
              >
                {state === 'done' ? <CheckCircle2 className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden sm:inline',
                  state === 'current' ? 'font-medium' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {entry.label}
              </span>
              {index < STEPS.length - 1 && (
                <ArrowRight className="size-3 text-slate-300" aria-hidden />
              )}
            </li>
          )
        })}
      </ol>

      {/* ---------- Schritt 1: Datei ---------- */}
      {step === 'upload' && (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer.files?.[0]
            if (file) void handleFile(file)
          }}
          className={cn(
            'card flex flex-col items-center justify-center px-6 py-14 text-center transition',
            dragging && 'border-brand-500 bg-brand-50 dark:bg-brand-950',
          )}
        >
          <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
            {busy ? (
              <Loader2 className="size-7 animate-spin text-slate-400" aria-hidden />
            ) : (
              <FileSpreadsheet className="size-7 text-slate-400" aria-hidden />
            )}
          </div>
          <h2 className="text-base font-semibold">Datei hierher ziehen</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Unterstützt werden <strong>.xlsx</strong> und <strong>.csv</strong>. Die erste Zeile mit
            Inhalt wird als Spaltenüberschrift gelesen.
          </p>

          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            <Upload className="size-4" aria-hidden />
            Datei auswählen
          </button>

          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
              event.target.value = ''
            }}
          />

          <div className="mt-8 max-w-lg rounded-lg bg-slate-50 p-4 text-left text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">
              Was beim wiederholten Import passiert
            </p>
            <p>
              Bestehende Personen werden erkannt (über Mitglieds-Nr., sonst über Name und
              Geburtsdatum) und aktualisiert. Notizen, Status und das Datum der letzten Ansprache
              bleiben dabei auf Wunsch unangetastet – so gehen gepflegte Angaben nicht verloren.
            </p>
          </div>
        </div>
      )}

      {/* ---------- Schritt 2: Spalten zuordnen ---------- */}
      {step === 'mapping' && sheet && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{fileName}</strong> · {sheet.rows.length} Zeilen, {sheet.headers.length}{' '}
              Spalten
            </p>
            <p className="hint">
              Die Zuordnung wurde automatisch geraten. Prüfe sie und korrigiere, was nicht passt.
            </p>
          </div>

          {!hasName && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Es ist keine Namensspalte zugeordnet. Ordne mindestens «Nachname» oder «Name» zu.
              </span>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-2 font-medium">Spalte in der Datei</th>
                  <th className="px-4 py-2 font-medium">Beispielwert</th>
                  <th className="px-4 py-2 font-medium">Zielfeld</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sheet.headers.map((header, index) => (
                  <tr key={`${header}-${index}`}>
                    <td className="px-4 py-2 font-medium">{header}</td>
                    <td className="max-w-48 truncate px-4 py-2 text-slate-500 dark:text-slate-400">
                      {sheet.rows.find((row) => row[index])?.[index] ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="input py-1.5 text-sm"
                        value={mapping[index] ?? 'ignore'}
                        onChange={(event) => {
                          const next = [...mapping]
                          next[index] = event.target.value as MemberField
                          setMapping(next)
                        }}
                        aria-label={`Zielfeld für Spalte ${header}`}
                      >
                        {Object.entries(FIELD_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
              Andere Datei
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStep('preview')}
              disabled={!hasName}
            >
              Weiter zur Vorschau
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </>
      )}

      {/* ---------- Schritt 3: Vorschau ---------- */}
      {step === 'preview' && preview && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <SummaryTile
              value={preview.createCount}
              label="Neu anlegen"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile
              value={preview.updateCount}
              label="Aktualisieren"
              className="text-sky-600 dark:text-sky-400"
            />
            <SummaryTile
              value={preview.skipCount}
              label="Übersprungen"
              className="text-slate-400"
            />
          </div>

          <div className="card mb-4 space-y-3 p-4">
            <h2 className="text-sm font-semibold">Beim Aktualisieren bestehender Personen</h2>
            {(
              [
                [
                  'keepExistingOnEmpty',
                  'Leere Zellen ignorieren',
                  'Ein leeres Feld in der Datei löscht keine bereits erfasste Angabe.',
                ],
                [
                  'preserveNotes',
                  'Notizen behalten',
                  'Die in der App gepflegten Notizen bleiben unverändert.',
                ],
                [
                  'preserveStatus',
                  'Status behalten',
                  'Aktiv/Inaktiv wird nicht aus der Datei überschrieben.',
                ],
              ] as [keyof ImportOptions, string, string][]
            ).map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded"
                  checked={options[key]}
                  onChange={(event) =>
                    setOptions((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                <span>
                  <span className="text-sm font-medium">{label}</span>
                  <span className="hint mt-0.5 block">{hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/60">
                <tr>
                  <th className="px-3 py-2 font-medium">Aktion</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Geburtsdatum</th>
                  <th className="px-3 py-2 font-medium">Kontakt</th>
                  <th className="px-3 py-2 font-medium">Hinweise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={row.rowIndex} className={row.action === 'skip' ? 'opacity-50' : ''}>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'badge',
                          row.action === 'create'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : row.action === 'update'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800',
                        )}
                      >
                        {row.action === 'create'
                          ? 'Neu'
                          : row.action === 'update'
                            ? 'Update'
                            : 'Skip'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {row.data.lastName}
                      {row.data.firstName && `, ${row.data.firstName}`}
                    </td>
                    <td className="tabular px-3 py-2 text-slate-500 dark:text-slate-400">
                      {row.birthDate?.toLocaleDateString('de-CH') ?? '—'}
                    </td>
                    <td className="max-w-48 truncate px-3 py-2 text-slate-500 dark:text-slate-400">
                      {row.data.email || row.data.mobile || row.data.phone || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      {row.warnings.join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 100 && (
              <p className="border-t border-slate-200 px-3 py-2 text-center text-xs text-slate-400 dark:border-slate-700">
                Vorschau auf 100 Zeilen begrenzt – importiert werden alle{' '}
                {preview.rows.length} Zeilen.
              </p>
            )}
          </div>

          {progress && (
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
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep('mapping')}
              disabled={busy}
            >
              Zurück
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void start()}
              disabled={busy || preview.createCount + preview.updateCount === 0}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {preview.createCount + preview.updateCount} Datensätze importieren
            </button>
          </div>
        </>
      )}

      {/* ---------- Schritt 4: Fertig ---------- */}
      {step === 'done' && result && (
        <div className="card px-6 py-12 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">Import abgeschlossen</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {result.created} neu angelegt · {result.updated} aktualisiert
            {result.skipped > 0 && ` · ${result.skipped} übersprungen`}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
              Weitere Datei importieren
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/mitglieder')}
            >
              Zur Mitgliederliste
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function SummaryTile({
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
