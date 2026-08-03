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
import { formatDate } from '@/lib/dates'
import { readSheetRows } from '@/services/import'
import { parseCleaningSheet, type ParsedCleaningPlan } from '@/services/importCleaning'
import { fromIsoDate } from '@/services/importHistory'
import { importCleaningWeeks } from '@/services/cleaning'

/**
 * Den Putzplan der Gemeinde einlesen.
 *
 * Die Tabelle entsteht zweimal im Jahr in Excel und hat keine Kopfzeile,
 * sondern eine Überschrift mit dem Jahr und darunter je Woche eine Zeile.
 * Gelesen wird deshalb nicht nach Spaltennamen, sondern nach dem, was in
 * einer Zelle steht – «Gruppe 7», «13.7. - 18.7.» und die Namen dazwischen.
 *
 * Die Woche ist der Schlüssel: Derselbe Plan lässt sich beliebig oft
 * einlesen, ohne Dubletten anzulegen, und eine korrigierte Fassung ersetzt
 * schlicht die alte.
 */

type Step = 'upload' | 'preview' | 'done'

export function ImportCleaning() {
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [plan, setPlan] = useState<ParsedCleaningPlan | null>(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<number | null>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const rows = await readSheetRows(file)
      const parsed = parseCleaningSheet(rows)
      if (parsed.weeks.length === 0) {
        toast.error(
          'Im Blatt wurde keine Woche gefunden. Erwartet wird je Zeile ein Zeitraum wie «13.7. - 18.7.» und die Namen daneben.',
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
    setProgress({ done: 0, total: plan.weeks.length })
    try {
      const count = await importCleaningWeeks(plan.weeks, (done, total) =>
        setProgress({ done, total }),
      )
      setResult(count)
      setStep('done')
      toast.success(`${count} Wochen übernommen.`)
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
        title="Putzplan importieren"
        subtitle="Die Tabelle der Gemeinde als Wochenplan übernehmen"
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
            «Gruppe 7», die Namen und der Zeitraum «13.7. - 18.7.». Wo die Spalten stehen, spielt
            keine Rolle.
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
              Der erste Tag einer Woche ist ihr Schlüssel: Dieselbe Woche wird aktualisiert statt
              doppelt angelegt, und derselbe Plan lässt sich beliebig oft einlesen. Das Jahr kommt
              aus der Überschrift; wechselt es innerhalb des Plans («27.12. – 2.1.»), wird das
              erkannt.
            </p>
            <p className="mt-2">
              Bestehende Wochen ausserhalb der Datei bleiben stehen – ein Halbjahresplan ergänzt den
              vorherigen, statt ihn abzuräumen.
            </p>
          </ImportHint>
        </div>
      )}

      {step === 'preview' && plan && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{sourceLabel}</strong> · {plan.weeks.length} Wochen ·{' '}
              {formatDate(fromIsoDate(plan.weeks[0].startDate))} bis{' '}
              {formatDate(fromIsoDate(plan.weeks[plan.weeks.length - 1].endDate))}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SummaryTile
              value={plan.weeks.length}
              label="Wochen"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile
              value={new Set(plan.weeks.map((week) => week.team)).size}
              label="Teams"
              className="text-sky-600 dark:text-sky-400"
            />
            <SummaryTile
              value={plan.incomplete}
              label="Zeilen ohne Namen"
              className="text-slate-400"
            />
          </div>

          {!plan.yearFromTitle && (
            <Warning className="mb-4">
              In der Datei steht kein Jahr. Angenommen wird {plan.year} – stimmt das nicht, gehört
              es in die erste Zeile der Tabelle, etwa «Putzplan {plan.year} Juli – Dezember».
            </Warning>
          )}

          {plan.incomplete > 0 && (
            <Warning className="mb-4">
              {plan.incomplete} Zeilen haben einen Zeitraum, aber keine Namen. Sie werden
              übersprungen.
            </Warning>
          )}

          <PreviewTable
            columns={['Zeile', 'Gruppe', 'Putzteam', 'Von', 'Bis', 'Bemerkung']}
            total={plan.weeks.length}
          >
            {plan.weeks.slice(0, 100).map((week) => (
              <tr key={week.startDate}>
                <td className="tabular w-14 px-3 py-2 text-slate-400">{week.row}</td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {week.group || '—'}
                </td>
                <td className="px-3 py-2 font-medium">{week.team}</td>
                <td className="tabular px-3 py-2 text-slate-500 dark:text-slate-400">
                  {formatDate(fromIsoDate(week.startDate))}
                </td>
                <td className="tabular px-3 py-2 text-slate-500 dark:text-slate-400">
                  {formatDate(fromIsoDate(week.endDate))}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {week.note || ''}
                </td>
              </tr>
            ))}
          </PreviewTable>

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={() => setStep('upload')}
            onStart={() => void start()}
            busy={busy}
            label={`${plan.weeks.length} Wochen übernehmen`}
            disabled={plan.weeks.length === 0}
          />
        </>
      )}

      {step === 'done' && result !== null && (
        <DoneCard
          summary={`${result} Wochen übernommen`}
          onReset={reset}
          onLeave={() => navigate('/putzplan')}
          leaveLabel="Zum Putzplan"
          resetLabel="Weiteren Plan importieren"
        />
      )}
    </>
  )
}
