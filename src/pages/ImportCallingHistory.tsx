import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Loader2, RotateCcw, Upload, UserX } from 'lucide-react'
import readXlsxFile from 'read-excel-file/browser'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import {
  DoneCard,
  ImportHint,
  PreviewTable,
  ProgressBar,
  StepButtons,
  Warning,
  importErrorMessage,
  type Progress,
} from '@/components/ImportShell'
import { SummaryTile } from '@/components/ui/Feedback'
import { MemberSearchSelect } from '@/components/sacrament/MemberSearchSelect'
import { cn } from '@/lib/utils'
import { parseCallingHistory, type ParsedCallingHistory } from '@/services/importCallingHistory'
import type { RawSheet } from '@/services/importHistory'
import {
  buildCallingHistoryPreview,
  type CallingHistoryAction,
  type CallingHistoryPreview,
  type CallingHistoryRow,
} from '@/services/importMatch'
import {
  loadAllCallings,
  runCallingHistoryImport,
  type CallingHistoryOutcome,
} from '@/services/importApply'
import { ORGANIZATION_LABELS, type Calling } from '@/lib/types'

/**
 * Die Berufungshistorie aus der bisherigen Berufungsliste übernehmen.
 *
 * Ein einmaliger Import, und einer, der nichts über den heutigen Stand
 * sagen will: Wer welche Berufung **jetzt** hat, steht im LCR. Diese Liste
 * beantwortet die andere Frage – was jemand vorher schon getan hat. Genau
 * die fehlt der App sonst, und niemand kann sie nachtragen, ohne zehn
 * Jahre Protokolle zu durchsuchen.
 *
 * Geschrieben wird deshalb ergänzend: Der laufende Bestand bleibt, wie er
 * ist, und wo dieselbe Berufung schon erfasst ist, kommen höchstens die
 * fehlenden Daten dazu.
 */

type Step = 'file' | 'preview' | 'done'

export function ImportCallingHistory({ picker }: { picker: ReactNode }) {
  const { members } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('file')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedCallingHistory | null>(null)
  const [existing, setExisting] = useState<Calling[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [ignored, setIgnored] = useState<string[]>([])
  const [keepOpen, setKeepOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<CallingHistoryOutcome | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        // Alle Blätter auf einmal – die Liste ist über die Jahre auf mehrere
        // gewachsen, und eine Entlassung steht oft auf einem anderen als die
        // Berufung, zu der sie gehört.
        const sheets = (await readXlsxFile(file)) as unknown as RawSheet[]
        const history = parseCallingHistory(sheets)
        if (history.callings.length === 0) {
          toast.error('In der Datei wurden keine Berufungen gefunden.')
          return
        }
        // Der Bestand wird einmal und vollständig geladen: Er entscheidet,
        // was bereits erfasst ist und deshalb nicht verdoppelt werden darf.
        setExisting(await loadAllCallings())
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

  const preview: CallingHistoryPreview | null = useMemo(
    () =>
      parsed
        ? buildCallingHistoryPreview(parsed, members, existing, { overrides, ignored }, keepOpen)
        : null,
    [parsed, members, existing, overrides, ignored, keepOpen],
  )

  const writeCount = preview ? preview.createCount + preview.mergeCount : 0

  const assign = (fullName: string, memberId: string | null) =>
    setOverrides((current) => {
      const next = { ...current }
      if (memberId) next[fullName] = memberId
      else delete next[fullName]
      return next
    })

  const dismiss = (fullName: string) => {
    assign(fullName, null)
    setIgnored((current) => (current.includes(fullName) ? current : [...current, fullName]))
  }

  const restore = (fullName: string) =>
    setIgnored((current) => current.filter((name) => name !== fullName))

  const start = async () => {
    if (!preview) return
    setBusy(true)
    setProgress({ done: 0, total: writeCount })
    try {
      const outcome = await runCallingHistoryImport(preview, (done, total) =>
        setProgress({ done, total }),
      )
      setResult(outcome)
      setStep('done')
      toast.success(`${outcome.created} Berufungen übernommen.`)
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
    setExisting([])
    setFileName('')
    setResult(null)
    setOverrides({})
    setIgnored([])
    setStep('file')
  }

  return (
    <>
      {step === 'file' && (
        <>
          {picker}

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
            <h2 className="text-base font-semibold">Berufungsliste hierher ziehen</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Erwartet wird die gewohnte <strong>.xlsx</strong>-Datei mit einer Zeile je Vorgang:
              Organisation, Amt, Name, Vorname und die Daten von Berufung, Bestätigung und
              Einsetzung. Mehrere Blätter dürfen sein – sie werden alle gelesen.
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
              Jede Zeile ist ein Vorgang: «B» beruft, «E» entlässt. Beide zusammen ergeben eine
              Berufung mit Anfang und Ende – gesucht wird die Entlassung bei derselben Person in
              derselben Organisation, zuerst beim gleich benannten Amt, dann beim ähnlichsten. In
              den ältesten Blättern fehlt die Spalte «B/E»; dort gilt als Entlassung, was bei
              «eingesetzt am» durchgestrichen ist. Eine Entlassung ohne Berufung bleibt erhalten –
              die Aufgabe begann dann vor der Tabelle.
            </p>
          </ImportHint>
        </>
      )}

      {step === 'preview' && preview && parsed && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{fileName}</strong> · {parsed.sheets.length}{' '}
              {parsed.sheets.length === 1 ? 'Blatt' : 'Blätter'} · {parsed.callings.length}{' '}
              Berufungen gelesen
            </p>
            <p className="hint">
              {parsed.sheets
                .map((sheet) => `${sheet.sheet} (${sheet.calls} B / ${sheet.releases} E)`)
                .join(' · ')}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile
              value={preview.createCount}
              label="Neu anlegen"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile
              value={preview.mergeCount}
              label="Ergänzen"
              className="text-sky-600 dark:text-sky-400"
            />
            <SummaryTile
              value={preview.members.length}
              label="Personen"
              className="text-violet-600 dark:text-violet-400"
            />
            <SummaryTile
              value={preview.skipCount}
              label="Ohne Zuordnung"
              className="text-slate-400"
            />
          </div>

          {preview.unmatched.length > 0 && (
            <div className="card mb-4 p-4">
              <h2 className="text-sm font-semibold">
                {preview.unmatched.length} Namen ohne Zuordnung
              </h2>
              <p className="hint mb-3">
                Über zehn Jahre wechselt eine Gemeinde: Die meisten dieser Namen gehören
                Weggezogenen, und die bleiben zu Recht liegen. Wo aber eine Heirat den Namen
                geändert hat oder zwei Personen sich Vor- und Nachname teilen, hilft nur die Hand.
                Wähle die Person – oder lege den Namen weg, dann taucht er nicht wieder auf. Was
                offen bleibt, wird übersprungen.
              </p>

              <ul className="divide-list">
                {preview.unmatched.map((entry) => (
                  <li key={entry.fullName} className="py-3">
                    <p className="text-sm font-medium">
                      {entry.fullName}
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                        {entry.count} {entry.count === 1 ? 'Berufung' : 'Berufungen'}
                      </span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-start gap-2">
                      <div className="min-w-56 flex-1">
                        <MemberSearchSelect
                          value={overrides[entry.fullName] ?? null}
                          onChange={(member) => assign(entry.fullName, member?.id ?? null)}
                          placeholder="Person suchen …"
                          compact
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => dismiss(entry.fullName)}
                      >
                        <UserX className="size-3.5" aria-hidden />
                        Kein Mitglied unserer Gemeinde
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(overrides).length > 0 && (
            <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">
              {Object.keys(overrides).length} Namen von Hand zugeordnet.
            </p>
          )}

          {preview.dismissed.length > 0 && (
            <details className="card mb-4 p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {preview.dismissed.length} weggelegte Namen · {preview.ignoredCount} Einträge werden
                nicht übernommen
              </summary>
              <ul className="divide-list mt-2">
                {preview.dismissed.map((entry) => (
                  <li key={entry.fullName} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-sm">
                      {entry.fullName}
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        {entry.count} {entry.count === 1 ? 'Berufung' : 'Berufungen'}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => restore(entry.fullName)}
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      Zurückholen
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="card mb-4 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded"
                checked={keepOpen}
                onChange={(event) => setKeepOpen(event.target.checked)}
              />
              <span>
                <span className="text-sm font-medium">
                  Berufungen ohne Entlassung als laufend übernehmen
                </span>
                <span className="hint mt-0.5 block">
                  Zu {parsed.open} gelesenen Berufungen steht keine Entlassung in der Liste. Über
                  die Jahre sammeln sich mehr vergessene Entlassungen als heute noch laufende
                  Aufgaben – sie kommen deshalb als Verlauf in die App, mit dem Vermerk «keine
                  Entlassung erfasst» statt mit einem erfundenen Datum. Den laufenden Stand liefert
                  ohnehin der LCR-Import.
                </span>
              </span>
            </label>
          </div>

          {preview.knownCount > 0 && (
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {preview.knownCount} Berufungen sind bereits erfasst und bleiben unverändert.
            </p>
          )}

          {parsed.unknownOrganizations.length > 0 && (
            <Warning className="mb-4">
              Unbekannte Organisationskürzel: {parsed.unknownOrganizations.join(', ')}. Diese
              Berufungen kommen unter «Übrige» mit.
            </Warning>
          )}

          <h2 className="mb-2 text-sm font-semibold">Was geschrieben wird</h2>
          <PreviewTable
            columns={['Aktion', 'Name', 'Berufung', 'Organisation', 'Zeitraum', 'Hinweise']}
            total={preview.rows.length}
          >
            {preview.rows.slice(0, 100).map((row) => (
              <tr
                key={row.calling.ref}
                className={row.action === 'create' || row.action === 'merge' ? '' : 'opacity-50'}
              >
                <td className="px-3 py-2">
                  <ActionBadge action={row.action} />
                </td>
                <td className="px-3 py-2 font-medium">{row.memberName}</td>
                <td className="px-3 py-2">{row.calling.position || '—'}</td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.calling.outOfUnit
                    ? 'Ausserhalb der Einheit'
                    : ORGANIZATION_LABELS[row.calling.organization]}
                </td>
                <td className="tabular px-3 py-2 text-slate-500 dark:text-slate-400">
                  {period(row)}
                </td>
                <td className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {row.warnings.join(' · ')}
                </td>
              </tr>
            ))}
          </PreviewTable>

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={reset}
            onStart={() => void start()}
            busy={busy}
            label={`${writeCount} Berufungen schreiben`}
            disabled={writeCount === 0}
          />
        </>
      )}

      {step === 'done' && result && (
        <DoneCard
          summary={`${result.created} Berufungen übernommen · ${result.merged} ergänzt${
            result.skipped > 0 ? ` · ${result.skipped} ohne Zuordnung übersprungen` : ''
          }${result.ignored > 0 ? ` · ${result.ignored} weggelegt` : ''}`}
          onReset={reset}
          onLeave={() => navigate('/berufungen')}
          leaveLabel="Zu den Berufungen"
          resetLabel="Weitere Datei einlesen"
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

/** «2015–2017», «seit 2015», «bis 2017» – der Zeitraum in Jahren. */
function period(row: CallingHistoryRow): string {
  const from = row.calling.startDate?.slice(0, 4)
  const to = row.calling.releasedDate?.slice(0, 4)
  if (from && to) return from === to ? from : `${from}–${to}`
  if (from) return `seit ${from}`
  if (to) return `bis ${to}`
  return '—'
}

const ACTION_LABELS: Record<CallingHistoryAction, string> = {
  create: 'Neu',
  merge: 'Ergänzt',
  known: 'Bekannt',
  skip: 'Offen',
  ignore: 'Weggelegt',
}

const ACTION_STYLES: Record<CallingHistoryAction, string> = {
  create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  merge: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  known: 'bg-slate-100 text-slate-500 dark:bg-slate-800',
  skip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  ignore: 'bg-slate-100 text-slate-500 dark:bg-slate-800',
}

function ActionBadge({ action }: { action: CallingHistoryAction }) {
  return <span className={cn('badge', ACTION_STYLES[action])}>{ACTION_LABELS[action]}</span>
}
