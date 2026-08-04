import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Upload } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
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
import { formatDate } from '@/lib/dates'
import {
  importMinutes,
  minutesDate,
  readMinutesFile,
  type MinutesImportResult,
  type ParsedMinutes,
} from '@/services/importMinutes'

/**
 * Die bisherigen Protokolle übernehmen.
 *
 * Ein einmaliger Vorgang beim Umstieg: Das Word-Dokument, das bisher
 * herumgereicht wurde, wird zur Sitzungsgeschichte in der App. Jede
 * Tabelle darin ist eine Sitzung, jede Zeile ein Traktandum – und die
 * Tabelle «Offene Pendenzen» ist genau das: die Pendenzen, die weiterhin
 * offen sind.
 *
 * Danach wird in der App weitergearbeitet. Deshalb steht «Früheren Import
 * ersetzen» standardmässig an: Ein zweiter Anlauf nach einer Korrektur
 * soll nicht jede Sitzung doppelt hinterlassen. Von Hand erfasste
 * Sitzungen bleiben dabei unangetastet.
 */

type Step = 'upload' | 'preview' | 'done'

export function ImportMinutes() {
  const toast = useToast()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { settings } = useData()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [parsed, setParsed] = useState<ParsedMinutes | null>(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [replace, setReplace] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<MinutesImportResult | null>(null)

  const totals = useMemo(() => {
    if (!parsed) return null
    const items = parsed.meetings.reduce((sum, meeting) => sum + meeting.items.length, 0)
    const dates = parsed.meetings.map((meeting) => meeting.date).sort()
    return {
      items,
      first: dates[0],
      last: dates[dates.length - 1],
      merged: parsed.meetings.filter((meeting) => meeting.tables > 1),
    }
  }, [parsed])

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const minutes = await readMinutesFile(file)
      if (minutes.meetings.length === 0 && minutes.pending.length === 0) {
        toast.error(
          'In der Datei wurde keine Sitzung gefunden. Erwartet wird je Sitzung eine Tabelle mit «Traktanden, 31.07.2025» in der ersten Zeile.',
        )
        return
      }
      setSourceLabel(file.name)
      setParsed(minutes)
      setStep('preview')
    } catch (error) {
      console.error(error)
      toast.error(importErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    if (!parsed || !profile) return
    setBusy(true)
    try {
      const outcome = await importMinutes(
        parsed,
        {
          title: settings.meetingTitle,
          time: settings.meetingTime,
          actor: { id: profile.id, name: profile.displayName },
          replace,
        },
        (done, total) => setProgress({ done, total }),
      )
      setResult(outcome)
      setStep('done')
      toast.success(`${outcome.meetings} Sitzungen übernommen.`)
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
    setSourceLabel('')
    setResult(null)
    setStep('upload')
  }

  return (
    <>
      <BackLink to="/einstellungen" label="Einstellungen" />
      <PageHeader
        title="Sitzungen importieren"
        subtitle="Die bisherigen Protokolle als Sitzungsgeschichte übernehmen"
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
              <FileText className="size-7 text-slate-400" aria-hidden />
            )}
          </div>
          <h2 className="text-base font-semibold">Datei hierher ziehen</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Unterstützt wird das Word-Dokument (<strong>.docx</strong>) im gewohnten Aufbau: je
            Sitzung eine Tabelle, in der ersten Zeile «Traktanden, 31.07.2025», darunter je Zeile
            ein Traktandum.
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
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
              event.target.value = ''
            }}
          />

          <ImportHint title="Was beim Import passiert">
            <p>
              Aus jeder Tabelle wird eine Sitzung mit dem Datum aus der Kopfzeile, aus jeder Zeile
              ein Traktandum: die erste Zeile der Zelle wird zum Titel, der Rest zur Beschreibung.
              Was in «Wer» und «Bis» steht, bleibt als Zeile in der Beschreibung stehen.
            </p>
            <p className="mt-2">
              Vergangene Sitzungen gelten als abgeschlossen und ihre Traktanden als erledigt – sonst
              stünden vierhundert Punkte als offen in der Liste. Offen bleibt genau das, was in der
              Tabelle <strong>«Offene Pendenzen»</strong> steht; das landet im Sammelkorb unter
              «Pendenzen».
            </p>
          </ImportHint>
        </div>
      )}

      {step === 'preview' && parsed && totals && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{sourceLabel}</strong>
              {totals.first && (
                <>
                  {' '}
                  · {formatDate(minutesDate(totals.first, settings.meetingTime))} bis{' '}
                  {formatDate(minutesDate(totals.last, settings.meetingTime))}
                </>
              )}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SummaryTile value={parsed.meetings.length} label="Sitzungen" />
            <SummaryTile value={totals.items} label="Traktanden" />
            <SummaryTile
              value={parsed.pending.length}
              label="Offene Pendenzen"
              className="text-amber-600 dark:text-amber-400"
            />
          </div>

          {parsed.skipped.length > 0 && (
            <Warning className="mb-4">
              {parsed.skipped.length === 1
                ? 'Eine Tabelle hat'
                : `${parsed.skipped.length} Tabellen haben`}{' '}
              kein lesbares Datum in der Kopfzeile und werden übersprungen:{' '}
              {parsed.skipped.map((entry) => `«${entry.label}» (${entry.items} Zeilen)`).join(', ')}
              . Diese Punkte werden am besten von Hand erfasst.
            </Warning>
          )}

          {totals.merged.length > 0 && (
            <Warning className="mb-4">
              {totals.merged.length === 1
                ? 'Ein Datum kommt'
                : `${totals.merged.length} Daten kommen`}{' '}
              mehrfach vor – die Tabellen werden zu einer Sitzung zusammengelegt, gleiche Titel
              gelten dabei als derselbe Punkt:{' '}
              {totals.merged
                .map((meeting) => formatDate(minutesDate(meeting.date, settings.meetingTime)))
                .join(', ')}
              .
            </Warning>
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
                Einen früheren Import vorher entfernen
              </span>
              <span className="hint block">
                Betrifft nur, was dieser Import selbst angelegt hat. Von Hand erfasste Sitzungen und
                Pendenzen bleiben in jedem Fall stehen.
              </span>
            </span>
          </label>

          <PreviewTable
            columns={['Datum', 'Traktanden', 'Erstes Traktandum']}
            total={parsed.meetings.length}
          >
            {parsed.meetings.slice(0, 100).map((meeting) => (
              <tr key={meeting.date}>
                <td className="tabular px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {formatDate(minutesDate(meeting.date, settings.meetingTime))}
                </td>
                <td className="tabular w-24 px-3 py-2 text-slate-400">{meeting.items.length}</td>
                <td className="px-3 py-2">{meeting.items[0]?.title ?? '—'}</td>
              </tr>
            ))}
          </PreviewTable>

          {parsed.pending.length > 0 && (
            <div className="card mt-4 p-4">
              <p className="mb-2 text-sm font-medium">
                Offene Pendenzen ({parsed.pending.length}) – landen im Sammelkorb
              </p>
              <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {parsed.pending.map((item) => (
                  <li key={item.title} className="truncate">
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={() => setStep('upload')}
            onStart={() => void start()}
            busy={busy}
            label={`${parsed.meetings.length} Sitzungen übernehmen`}
            disabled={parsed.meetings.length === 0}
          />
        </>
      )}

      {step === 'done' && result && (
        <DoneCard
          summary={`${result.meetings} Sitzungen mit ${result.items} Traktanden und ${result.pending} offene Pendenzen übernommen${
            result.removed > 0 ? `, ${result.removed} Einträge eines früheren Imports ersetzt` : ''
          }`}
          onReset={reset}
          onLeave={() => navigate('/sitzungen')}
          leaveLabel="Zu den Sitzungen"
          resetLabel="Weitere Datei importieren"
        />
      )}
    </>
  )
}
