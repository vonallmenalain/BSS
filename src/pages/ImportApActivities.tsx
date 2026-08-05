import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { ImportNav } from '@/components/ImportNav'
import {
  BackLink,
  DoneCard,
  ImportHint,
  PreviewTable,
  ProgressBar,
  StepButtons,
  Warning,
  importErrorMessage,
  type Progress,
} from '@/components/ImportShell'
import { PageHeader } from '@/components/ui/Pickers'
import { SummaryTile } from '@/components/ui/Feedback'
import { cn } from '@/lib/utils'
import { formatDate, formatMonth } from '@/lib/dates'
import { readSheetRows } from '@/services/import'
import { parseApSheet, type ParsedApPlan } from '@/services/importApActivities'
import { fromIsoDate } from '@/services/importHistory'
import { importApPlan, type ApImportResult } from '@/services/apActivities'
import { AP_ACTIVITY_KIND_LABELS } from '@/lib/types'

/**
 * Den bisherigen Aktivitätenplan der AP einlesen.
 *
 * Ein einmaliger Vorgang: Die Excel-Tabelle wird übernommen, und danach
 * wird der Plan in der App gepflegt. Deshalb steht «Vorhandene Termine im
 * Zeitraum ersetzen» standardmässig an – ein zweiter Anlauf nach einer
 * Korrektur soll nicht jeden Termin doppelt hinterlassen.
 *
 * Gelesen werden die Termine **und** die Zwischenüberschriften: «JANUAR –
 * LEITUNG LEHRER» wird zur Monatsangabe, die im Plan über den Terminen
 * steht.
 */

type Step = 'upload' | 'preview' | 'done'

export function ImportApActivities() {
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [plan, setPlan] = useState<ParsedApPlan | null>(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [replace, setReplace] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<ApImportResult | null>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const rows = await readSheetRows(file)
      const parsed = parseApSheet(rows)
      if (parsed.activities.length === 0) {
        toast.error(
          'Im Blatt wurde kein Termin gefunden. Erwartet wird eine Kopfzeile mit «Datum» und darunter je Zeile ein Termin.',
        )
        return
      }
      setSourceLabel(file.name)
      setPlan(parsed)
      setStep('preview')
    } catch (error) {
      console.error(error)
      toast.error('Die Datei konnte nicht gelesen werden. Unterstützt: .xlsx und .csv')
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    if (!plan) return
    setBusy(true)
    setProgress({ done: 0, total: plan.activities.length })
    try {
      const outcome = await importApPlan(plan.activities, plan.months, replace, (done, total) =>
        setProgress({ done, total }),
      )
      setResult(outcome)
      setStep('done')
      toast.success(`${outcome.written} Termine übernommen.`)
    } catch (error) {
      console.error(error)
      toast.error(importErrorMessage(error))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const reset = () => {
    setPlan(null)
    setSourceLabel('')
    setResult(null)
    setStep('upload')
  }

  return (
    <>
      <BackLink to="/einstellungen" label="Einstellungen" />
      <PageHeader
        title="Aktivitäten AP importieren"
        subtitle="Den bisherigen Excel-Plan als Kalender übernehmen"
      />
      <ImportNav />

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
            Unterstützt werden <strong>.xlsx</strong> und <strong>.csv</strong> im gewohnten Aufbau:
            eine Kopfzeile mit «Datum», «Aktivität / Klasse», «Treffpunkt», «Zuständig AP», den
            beiden Teilnahmespalten und «Bemerkung». Gelesen wird das erste Arbeitsblatt.
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

          <ImportHint title="Was beim Import passiert">
            <p>
              Jede Zeile mit einem Datum wird zu einem Termin. Mehrtägiges wie «03. April – 06.
              April 2026» wird als Zeitraum erkannt, und die Art ergibt sich aus dem Wochentag:
              Mittwoch ist Aktivität, Sonntag ist Klasse, alles Übrige ist ein besonderer Anlass.
              Steht «keine Aktivität» im Titel, gilt der Termin als ausgefallen und bleibt trotzdem
              im Plan.
            </p>
            <p className="mt-2">
              Die Zwischenüberschriften («JANUAR – LEITUNG LEHRER») werden zur Angabe, welches
              Kollegium den Monat führt.
            </p>
          </ImportHint>
        </div>
      )}

      {step === 'preview' && plan && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{sourceLabel}</strong> · {plan.activities.length} Termine ·{' '}
              {formatDate(fromIsoDate(plan.activities[0].date))} bis{' '}
              {formatDate(fromIsoDate(plan.activities[plan.activities.length - 1].date))}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile
              value={plan.activities.filter((entry) => entry.kind === 'activity').length}
              label="Aktivitäten"
              className="text-brand-600 dark:text-brand-300"
            />
            <SummaryTile
              value={plan.activities.filter((entry) => entry.kind === 'class').length}
              label="AP-Klassen"
              className="text-violet-600 dark:text-violet-400"
            />
            <SummaryTile
              value={plan.activities.filter((entry) => entry.kind === 'special').length}
              label="Besondere Anlässe"
              className="text-amber-600 dark:text-amber-400"
            />
            <SummaryTile
              value={plan.activities.filter((entry) => entry.kind === 'cancelled').length}
              label="Fallen aus"
              className="text-slate-400"
            />
          </div>

          {!plan.headerFound && (
            <Warning className="mb-4">
              In der Datei wurde keine Kopfzeile mit «Datum» gefunden. Gelesen wurde deshalb in der
              gewohnten Spaltenreihenfolge – prüfe die Vorschau besonders genau.
            </Warning>
          )}

          {plan.skipped.length > 0 && (
            <Warning className="mb-4">
              {plan.skipped.length} Zeilen haben Inhalt, aber kein lesbares Datum und werden
              übersprungen:{' '}
              {plan.skipped
                .slice(0, 3)
                .map((entry) => `Zeile ${entry.row}`)
                .join(', ')}
              {plan.skipped.length > 3 && ' …'}
            </Warning>
          )}

          {plan.months.length > 0 && (
            <div className="card mb-4 p-4">
              <p className="mb-2 text-sm font-medium">Leitung je Monat</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.months.map((month) => (
                  <span
                    key={month.month}
                    className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {formatMonth(fromIsoDate(`${month.month}-01`))}
                    {month.leadership && ` · ${month.leadership}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <label className="card mb-4 flex cursor-pointer items-start gap-3 p-4">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 dark:border-slate-600"
              checked={replace}
              onChange={(event) => setReplace(event.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                Vorhandene Termine im Zeitraum der Datei vorher entfernen
              </span>
              <span className="hint block">
                Die Tabelle ist der Plan. Ohne diesen Haken kommen die Zeilen zum Bestehenden dazu –
                sinnvoll nur, wenn die Datei einen Nachtrag enthält.
              </span>
            </span>
          </label>

          <PreviewTable
            columns={[
              'Zeile',
              'Datum',
              'Art',
              'Aktivität / Klasse',
              'Treffpunkt',
              'Zuständig AP',
              'BSS',
              'Berater',
            ]}
            total={plan.activities.length}
          >
            {plan.activities.slice(0, 100).map((entry) => (
              <tr key={`${entry.row}-${entry.date}`}>
                <td className="tabular w-14 px-3 py-2 text-slate-400">{entry.row}</td>
                <td className="tabular px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {formatDate(fromIsoDate(entry.date))}
                  {entry.endDate && ` – ${formatDate(fromIsoDate(entry.endDate))}`}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {AP_ACTIVITY_KIND_LABELS[entry.kind]}
                </td>
                <td className="px-3 py-2 font-medium">{entry.title || '—'}</td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {entry.location || ''}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {entry.leader || ''}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {entry.bishopric || ''}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {entry.advisor || ''}
                </td>
              </tr>
            ))}
          </PreviewTable>

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={() => setStep('upload')}
            onStart={() => void start()}
            busy={busy}
            label={`${plan.activities.length} Termine übernehmen`}
            disabled={plan.activities.length === 0}
          />
        </>
      )}

      {step === 'done' && result && (
        <DoneCard
          summary={`${result.written} Termine und ${result.months} Monatsangaben übernommen${
            result.removed > 0 ? `, ${result.removed} frühere Einträge ersetzt` : ''
          }`}
          onReset={reset}
          onLeave={() => navigate('/ap')}
          leaveLabel="Zum Aktivitätenplan"
          resetLabel="Weiteren Plan importieren"
        />
      )}
    </>
  )
}
