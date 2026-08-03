import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { ImportNav } from '@/components/ImportNav'
import {
  BackLink,
  DoneCard,
  ImportHint,
  PasteCard,
  PreviewTable,
  ProgressBar,
  StepButtons,
  Warning,
  importErrorMessage,
  type Progress,
} from '@/components/ImportShell'
import { PageHeader } from '@/components/ui/Pickers'
import { ConfirmDialog } from '@/components/ui/Modal'
import { SummaryTile } from '@/components/ui/Feedback'
import { cn } from '@/lib/utils'
import { parseFile } from '@/services/import'
import { parsePastedHymns, type PastedHymn } from '@/services/importHymns'
import { clearHymns, guessHymnColumns, importHymns, parseHymnSheet } from '@/services/hymns'

/**
 * Die Liederliste übernehmen.
 *
 * Zweck: Beim Erfassen der Musik soll die Liednummer genügen – den Titel
 * ergänzt die App. Die Liste ändert sich praktisch nie, der Import ist also
 * eine einmalige Sache; er steht trotzdem bei den übrigen, weil man ihn
 * dort sucht.
 *
 * Zwei Wege, wie beim Mitgliederimport: die Liste aus dem Musikarchiv
 * einfügen – das ist der übliche – oder eine Datei mit Nummer und Titel
 * einlesen.
 */

type Step = 'source' | 'preview' | 'done'
type Source = 'text' | 'file'

const PASTE_EXAMPLE = `1. Der Morgen naht
2. Der Geist aus den Höhen
3. O Fülle des Heiles`

export function ImportHymns() {
  const { hymns } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('source')
  const [source, setSource] = useState<Source>('text')
  const [pasted, setPasted] = useState('')
  const [rows, setRows] = useState<PastedHymn[] | null>(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const parsed = useMemo(() => (pasted.trim() ? parsePastedHymns(pasted) : null), [pasted])

  const takePaste = () => {
    if (!parsed || parsed.length === 0) return
    setSourceLabel('Eingefügte Liste')
    setRows(parsed)
    setStep('preview')
  }

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const sheet = await parseFile(file)
      const found = parseHymnSheet(sheet, guessHymnColumns(sheet))
      if (found.length === 0) {
        toast.error('In der Datei wurden keine Lieder gefunden (Nummer und Titel nötig).')
        return
      }
      setSourceLabel(file.name)
      setRows(found)
      setStep('preview')
    } catch (error) {
      console.error(error)
      toast.error('Die Datei konnte nicht gelesen werden. Unterstützt: .xlsx und .csv')
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    if (!rows) return
    setBusy(true)
    setProgress({ done: 0, total: rows.length })
    try {
      const count = await importHymns(rows, (done, total) => setProgress({ done, total }))
      setResult(count)
      setStep('done')
      toast.success(`${count} Lieder übernommen.`)
    } catch (error) {
      console.error(error)
      toast.error(importErrorMessage(error))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const reset = () => {
    setPasted('')
    setRows(null)
    setSourceLabel('')
    setResult(null)
    setStep('source')
  }

  /** Lücken in der Nummernfolge – ein Hinweis auf unvollständiges Kopieren. */
  const missing = useMemo(() => {
    if (!rows || rows.length === 0) return 0
    const highest = rows[rows.length - 1].number
    return highest - rows.length
  }, [rows])

  return (
    <>
      <BackLink to="/abendmahl/musik" label="Musik" />
      <PageHeader
        title="Liederliste importieren"
        subtitle="Damit beim Erfassen der Musik die Liednummer genügt"
      />
      <ImportNav />

      {step === 'source' && (
        <div className="mb-4 inline-flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              ['text', 'Liste einfügen', ClipboardList],
              ['file', 'Datei', FileSpreadsheet],
            ] as [Source, string, typeof ClipboardList][]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSource(key)}
              aria-pressed={source === key}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition',
                source === key
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}

      {step === 'source' && source === 'text' && (
        <PasteCard
          title="Liederliste einfügen"
          description={
            <>
              Im <strong>Musikarchiv</strong> der Kirche das Gesangbuch öffnen, «Alles einblenden»
              wählen, die Seite markieren (Strg bzw. Cmd + A), kopieren und hier einfügen. Menü,
              Filter und Rubriken dürfen mitkommen – gelesen wird nur, was wie «Nummer. Titel»
              aussieht.
            </>
          }
          placeholder={`Hier einfügen. Erwartet wird die Liste des Gesangbuchs:\n\n${PASTE_EXAMPLE}`}
          value={pasted}
          onChange={setPasted}
          onSubmit={takePaste}
          canSubmit={Boolean(parsed && parsed.length > 0)}
          status={
            !pasted.trim() ? (
              <p className="hint mt-0">Noch nichts eingefügt.</p>
            ) : !parsed || parsed.length === 0 ? (
              <Warning>
                Kein Lied erkannt. Erwartet wird pro Zeile die Nummer, ein Punkt und der Titel.
              </Warning>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">
                  {parsed.length} {parsed.length === 1 ? 'Lied' : 'Lieder'} erkannt
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Nr. {parsed[0].number} bis {parsed[parsed.length - 1].number}
                </span>
              </p>
            )
          }
          hint={
            <ImportHint title="Was beim Import passiert">
              <p>
                Die Nummer ist der Schlüssel: Dieselbe Nummer wird aktualisiert statt doppelt
                angelegt. Bereits erfasste Programme behalten ihre Liedtitel auch dann, wenn die
                Liste später ersetzt wird – der Titel wird beim Speichern mitgeschrieben.
              </p>
            </ImportHint>
          }
        />
      )}

      {step === 'source' && source === 'file' && (
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
            Unterstützt werden <strong>.xlsx</strong> und <strong>.csv</strong> mit je einer Spalte
            für Nummer und Titel. Welche das sind, erkennt der Import selbst.
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
        </div>
      )}

      {step === 'source' && hymns.length > 0 && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="hint mt-0">
            {hymns.length} Lieder hinterlegt. Ein erneuter Import aktualisiert sie.
          </p>
          <button
            type="button"
            className="btn-ghost text-rose-600 dark:text-rose-400"
            onClick={() => setConfirmClear(true)}
            disabled={busy}
          >
            <Trash2 className="size-4" aria-hidden />
            Liste leeren
          </button>
        </div>
      )}

      {step === 'preview' && rows && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{sourceLabel}</strong> · {rows.length} Lieder · Nr. {rows[0].number} bis{' '}
              {rows[rows.length - 1].number}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <SummaryTile
              value={rows.length}
              label="Lieder"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile value={missing} label="Lücken in der Folge" className="text-slate-400" />
          </div>

          {missing > 0 && (
            <Warning className="mb-4">
              Zwischen Nr. {rows[0].number} und Nr. {rows[rows.length - 1].number} fehlen {missing}{' '}
              Nummern. Meist ist die Seite nicht vollständig kopiert – im Musikarchiv zuerst «Alles
              einblenden» wählen.
            </Warning>
          )}

          <PreviewTable columns={['Nr.', 'Titel']} total={rows.length}>
            {rows.slice(0, 100).map((row) => (
              <tr key={row.number}>
                <td className="tabular w-16 px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.number}
                </td>
                <td className="px-3 py-2">{row.title}</td>
              </tr>
            ))}
          </PreviewTable>

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={() => setStep('source')}
            onStart={() => void start()}
            busy={busy}
            label={`${rows.length} Lieder übernehmen`}
            disabled={rows.length === 0}
          />
        </>
      )}

      {step === 'done' && result !== null && (
        <DoneCard
          summary={`${result} Lieder übernommen`}
          onReset={reset}
          onLeave={() => navigate('/abendmahl/musik')}
          leaveLabel="Zur Musik"
        />
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          void clearHymns()
            .then((count) => toast.success(`${count} Lieder entfernt.`))
            .catch((error: unknown) => toast.error(importErrorMessage(error)))
        }}
        title="Liederliste leeren?"
        message="Bereits erfasste Programme behalten ihre Liedtitel – nur die Nachschlageliste wird gelöscht."
        confirmLabel="Leeren"
        danger
      />
    </>
  )
}
