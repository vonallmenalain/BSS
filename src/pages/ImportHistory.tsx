import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import readXlsxFile from 'read-excel-file/browser'
import { useData } from '@/contexts/DataContext'
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
import { parseTalkHistory, type ParsedHistory, type RawSheet } from '@/services/importHistory'
import { buildHistoryPreview, type HistoryPreview } from '@/services/importMatch'
import { loadKnownHistory, runHistoryImport, type HistoryOutcome } from '@/services/importApply'

/**
 * Den Verlauf von Ansprachen und Gebeten aus der bisherigen Excel-Tabelle
 * übernehmen.
 *
 * Ein einmaliger Import, aber ein wichtiger: Erst mit ihm beantwortet die
 * App die Frage «wer war lange nicht dran» von Anfang an richtig, statt bei
 * null zu beginnen und ein Jahr lang alle gleich zu behandeln.
 *
 * Anders als bei den LCR-Listen wird hier nichts ersetzt. Der Verlauf
 * kommt hinzu, und was bereits erfasst ist, bleibt unangetastet – ein
 * zweiter Durchlauf ist deshalb folgenlos.
 */

type Step = 'file' | 'preview' | 'done'

export function ImportHistory() {
  const { members } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('file')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedHistory | null>(null)
  const [known, setKnown] = useState<Awaited<ReturnType<typeof loadKnownHistory>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<HistoryOutcome | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        // Alle Blätter auf einmal – ein Jahr je Blatt.
        const sheets = (await readXlsxFile(file)) as unknown as RawSheet[]
        const history = parseTalkHistory(sheets)
        if (history.entries.length === 0) {
          toast.error('In der Datei wurden keine Ansprachen oder Gebete gefunden.')
          return
        }
        // Der Bestand wird einmal geladen: Er entscheidet, was schon erfasst
        // ist und wie die Statistik nachher aussieht.
        setKnown(await loadKnownHistory())
        setFileName(file.name)
        setParsed(history)
        setStep('preview')
      } catch (error) {
        console.error(error)
        toast.error('Die Datei konnte nicht gelesen werden. Unterstützt wird .xlsx')
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

  const preview: HistoryPreview | null = useMemo(
    () =>
      parsed && known ? buildHistoryPreview(parsed, members, known.talks, known.prayers) : null,
    [parsed, known, members],
  )

  const writeCount = preview
    ? preview.talks.length + preview.prayers.length + preview.members.length
    : 0

  const start = async () => {
    if (!preview) return
    setBusy(true)
    setProgress({ done: 0, total: writeCount })
    try {
      const outcome = await runHistoryImport(preview, (done, total) => setProgress({ done, total }))
      setResult(outcome)
      setStep('done')
      toast.success(`${outcome.talks} Ansprachen und ${outcome.prayers} Gebete übernommen.`)
    } catch (error) {
      console.error(error)
      toast.error(importErrorMessage(error))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const reset = () => {
    setParsed(null)
    setKnown(null)
    setFileName('')
    setResult(null)
    setStep('file')
  }

  return (
    <>
      <BackLink to="/abendmahl/ansprachen" label="Ansprachen" />
      <PageHeader
        title="Verlauf importieren"
        subtitle="Ansprachen und Gebete aus der bisherigen Excel-Tabelle übernehmen"
      />
      <ImportNav />

      {step === 'file' && (
        <>
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
            <h2 className="text-base font-semibold">Tabelle hierher ziehen</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Erwartet wird die gewohnte <strong>.xlsx</strong>-Datei mit einem Blatt je Jahr, einer
              Zeile je Person und zwei Spalten je Monat: «A» für die Ansprache, «G» für das Gebet.
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
              accept=".xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
                event.target.value = ''
              }}
            />
          </div>

          <ImportHint title="Was gelesen wird">
            <p>
              Das Jahr steht im Blattnamen, der Monat in der Spaltenüberschrift. Die Zahl in der
              Zelle wird je Blatt gedeutet: In den älteren Jahrgängen zählt sie die Sonntage des
              Monats, in den neueren nennt sie den Tag – erkannt wird das am Inhalt, nicht an der
              Beschriftung. Vermerke neben der Zahl («K» für die Kinderansprache) kommen als Notiz
              mit, Handnotizen ohne Datum werden gemeldet statt gedeutet.
            </p>
          </ImportHint>
        </>
      )}

      {step === 'preview' && preview && parsed && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{fileName}</strong> · {parsed.sheets.length} Jahre · {parsed.entries.length}{' '}
              Einträge
            </p>
            <p className="hint">
              {parsed.sheets.map((sheet) => `${sheet.year} (${sheet.entries})`).join(' · ')}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile
              value={preview.talks.length}
              label="Ansprachen"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile
              value={preview.prayers.length}
              label="Gebete"
              className="text-sky-600 dark:text-sky-400"
            />
            <SummaryTile
              value={preview.members.length}
              label="Personen"
              className="text-violet-600 dark:text-violet-400"
            />
            <SummaryTile value={preview.known} label="Schon erfasst" className="text-slate-400" />
          </div>

          {preview.unmatched.length > 0 && (
            <Warning className="mb-4">
              {preview.unmatched.reduce((sum, entry) => sum + entry.count, 0)} Einträge von{' '}
              {preview.unmatched.length} Namen liessen sich keiner erfassten Person zuordnen – meist
              Weggezogene und Besuchende. Sie werden übersprungen.
            </Warning>
          )}

          {preview.crowded.length > 0 && (
            <Warning className="mb-4">
              An {preview.crowded.length} Sonntagen stehen mehr als zwei Gebete. Die App kennt pro
              Sonntag nur Anfangs- und Schlussgebet; die übrigen werden nicht übernommen.
            </Warning>
          )}

          {parsed.unread.length > 0 && (
            <details className="card mb-4 p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {parsed.unread.length} Zellen ohne Datum – von Hand geschriebene Vermerke
              </summary>
              <ul className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {parsed.unread.map((cell, index) => (
                  <li key={`${cell.sheet}-${cell.fullName}-${index}`}>
                    <span className="tabular">{cell.sheet}</span> · {cell.fullName} · {cell.column}{' '}
                    · <span className="font-mono">{cell.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <h2 className="mb-2 text-sm font-semibold">Personen mit neuem Verlauf</h2>
          <PreviewTable
            columns={['Name', 'Ansprachen neu', 'Letzte Ansprache']}
            total={preview.members.length}
          >
            {preview.members.slice(0, 100).map((row) => (
              <tr key={row.memberId}>
                <td className="px-3 py-2 font-medium">{row.memberName}</td>
                <td className="tabular px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.talkCount}
                </td>
                <td className="tabular px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.lastTalkDate ?? '—'}
                </td>
              </tr>
            ))}
          </PreviewTable>

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={reset}
            onStart={() => void start()}
            busy={busy}
            label={`${writeCount} Einträge schreiben`}
            disabled={writeCount === 0}
          />
        </>
      )}

      {step === 'done' && result && (
        <DoneCard
          summary={`${result.talks} Ansprachen · ${result.prayers} Gebete · ${result.members} Personen nachgeführt`}
          onReset={reset}
          onLeave={() => navigate('/abendmahl/ansprachen')}
          leaveLabel="Zu den Ansprachen"
          resetLabel="Weitere Datei einlesen"
        />
      )}
    </>
  )
}
