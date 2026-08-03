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
import {
  bookOf,
  clearHymns,
  codeOf,
  guessHymnColumns,
  hymnCode,
  importHymns,
  parseHymnSheet,
} from '@/services/hymns'
import { HYMN_BOOK_LABELS, type HymnBook } from '@/lib/types'

/**
 * Die Liederlisten übernehmen.
 *
 * Zweck: Beim Erfassen der Musik soll die Liednummer genügen – den Titel
 * ergänzt die App. Die Listen ändern sich praktisch nie, der Import ist
 * also eine einmalige Sache; er steht trotzdem bei den übrigen, weil man
 * ihn dort sucht.
 *
 * Jedes Buch wird **für sich** eingelesen und für sich geleert. Gesangbuch
 * und PV-Liederbuch zählen beide ab 1; ein gemeinsamer Import überschriebe
 * das eine mit dem anderen, beim Erfassen unterscheidet sie das Kürzel
 * «PV». «Für zuhause und für die Kirche» beginnt bei 1001 und braucht
 * keines.
 *
 * Zwei Wege, wie beim Mitgliederimport: die Liste aus dem Musikarchiv
 * einfügen – das ist der übliche – oder eine Datei mit Nummer und Titel
 * einlesen.
 */

type Step = 'source' | 'preview' | 'done'
type Source = 'text' | 'file'

const PASTE_EXAMPLE: Record<HymnBook, string> = {
  hymns: `1. Der Morgen naht\n2. Der Geist aus den Höhen\n3. O Fülle des Heiles`,
  children: `2. Ich bin ein Kind von Gott\n4. Kinder in aller Welt\n6. Gebet eines Kindes`,
  home_church: `1001. Komm, du Quelle jedes Segens\n1002. Wenn der Heiland wiederkehrt\n1003. Meine Seel findet Ruhe im Herrn`,
}

/** Wie die Sammlung im Musikarchiv heisst. */
const COLLECTION_LABEL: Record<HymnBook, string> = {
  hymns: 'Gesangbuch',
  children: 'Liederbuch für Kinder',
  home_church: 'Gesangbuch für zuhause und für die Kirche',
}

export function ImportHymns() {
  const { hymns } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('source')
  const [book, setBook] = useState<HymnBook>('hymns')
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
      setRows(found.map((row) => ({ ...row, suffix: row.suffix ?? '' })))
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
      const count = await importHymns(rows, book, (done, total) => setProgress({ done, total }))
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

  /** Lieder des gewählten Buchs, die schon in der Liste stehen. */
  const inBook = useMemo(() => hymns.filter((hymn) => bookOf(hymn) === book), [hymns, book])

  /**
   * Lücken in der Nummernfolge – ein Hinweis auf unvollständiges Kopieren.
   *
   * Nur beim Gesangbuch aussagekräftig: Es zählt von 1 bis 210 durch. Das
   * Liederbuch für Kinder nennt Seitenzahlen, und «Für zuhause und für die
   * Kirche» springt zwischen seinen Abschnitten (1001 ff., dann 1201 ff.) –
   * dort wäre der Hinweis nur Lärm.
   */
  const missing = useMemo(() => {
    if (book !== 'hymns' || !rows || rows.length === 0) return 0
    const numbers = new Set(rows.map((row) => row.number))
    let count = 0
    for (let n = rows[0].number; n <= rows[rows.length - 1].number; n++) {
      if (!numbers.has(n)) count++
    }
    return count
  }, [rows, book])

  return (
    <>
      <BackLink to="/abendmahl/musik" label="Musik" />
      <PageHeader
        title="Liederliste importieren"
        subtitle="Damit beim Erfassen der Musik die Liednummer genügt"
      />
      <ImportNav />

      {step === 'source' && (
        <div className="card mb-4 p-4">
          <span className="label">Welches Buch?</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(HYMN_BOOK_LABELS) as HymnBook[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setBook(key)
                  setPasted('')
                }}
                aria-pressed={book === key}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  book === key
                    ? 'border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300',
                )}
              >
                {HYMN_BOOK_LABELS[key]}
              </button>
            ))}
          </div>
          <p className="hint">
            Jedes Buch wird für sich geführt. Gesangbuch und PV-Liederbuch zählen beide ab 1 – Nr. 6
            ist dort «Israel, der Herr ruft alle», hier «Gebet eines Kindes»; beim Erfassen
            unterscheidet sie das Kürzel «PV». «Für zuhause und für die Kirche» beginnt bei 1001 und
            braucht deshalb keines.
          </p>
        </div>
      )}

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
          title={`${HYMN_BOOK_LABELS[book]} einfügen`}
          description={
            <>
              Im <strong>Musikarchiv</strong> der Kirche das{' '}
              <strong>{COLLECTION_LABEL[book]}</strong> öffnen, «Alles einblenden» wählen, die Seite
              markieren (Strg bzw. Cmd + A), kopieren und hier einfügen. Menü, Filter und Rubriken
              dürfen mitkommen – gelesen wird nur, was wie «Nummer. Titel» aussieht.
            </>
          }
          placeholder={`Hier einfügen. Erwartet wird die Liste:\n\n${PASTE_EXAMPLE[book]}`}
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

      {step === 'source' && inBook.length > 0 && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="hint mt-0">
            {inBook.length} Lieder aus dem {HYMN_BOOK_LABELS[book]} hinterlegt ({codeOf(inBook[0])}{' '}
            bis {codeOf(inBook[inBook.length - 1])}). Ein erneuter Import aktualisiert sie.
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
              <strong>{sourceLabel}</strong> · {HYMN_BOOK_LABELS[book]} · {rows.length} Lieder ·{' '}
              {hymnCode(book, rows[0].number, rows[0].suffix)} bis{' '}
              {hymnCode(book, rows[rows.length - 1].number, rows[rows.length - 1].suffix)}
            </p>
          </div>

          <div className={cn('mb-4 grid gap-2', book === 'hymns' ? 'grid-cols-2' : 'grid-cols-1')}>
            <SummaryTile
              value={rows.length}
              label="Lieder"
              className="text-emerald-600 dark:text-emerald-400"
            />
            {book === 'hymns' && (
              <SummaryTile value={missing} label="Lücken in der Folge" className="text-slate-400" />
            )}
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
              <tr key={`${row.number}${row.suffix}`}>
                <td className="tabular w-20 px-3 py-2 text-slate-500 dark:text-slate-400">
                  {hymnCode(book, row.number, row.suffix)}
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
          summary={`${result} Lieder aus dem ${HYMN_BOOK_LABELS[book]} übernommen`}
          onReset={reset}
          onLeave={() => navigate('/abendmahl/musik')}
          leaveLabel="Zur Musik"
        />
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          void clearHymns(book)
            .then((count) => toast.success(`${count} Lieder entfernt.`))
            .catch((error: unknown) => toast.error(importErrorMessage(error)))
        }}
        title={`${HYMN_BOOK_LABELS[book]} leeren?`}
        message="Nur dieses Buch, das andere bleibt stehen. Bereits erfasste Programme behalten ihre Liedtitel – gelöscht wird nur die Nachschlageliste."
        confirmLabel="Leeren"
        danger
      />
    </>
  )
}
