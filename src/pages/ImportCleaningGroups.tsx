import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, FileText, Loader2, Upload } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useCleaningGroups } from '@/hooks/useFirestore'
import { ImportNav } from '@/components/ImportNav'
import {
  BackLink,
  DoneCard,
  ImportHint,
  PasteCard,
  StepButtons,
  Warning,
  importErrorMessage,
} from '@/components/ImportShell'
import { PageHeader } from '@/components/ui/Pickers'
import { SummaryTile } from '@/components/ui/Feedback'
import { cn, uid } from '@/lib/utils'
import { replaceCleaningGroups } from '@/services/cleaning'
import {
  activeMemberIndex,
  linesFromPdf,
  linesFromText,
  matchEntryMembers,
  parseCleaningGroups,
  type ParsedCleaningGroups,
} from '@/services/importCleaningGroups'
import type { CleaningGroupEntry } from '@/lib/types'

/**
 * Die Gruppeneinteilung fürs Putzen übernehmen – einmalig.
 *
 * Die Gemeinde führt sie als Tabelle in Google Docs und verschickt sie als
 * PDF: je Gruppe die Haushalte, der zuständige fett zuoberst. Der Import liest
 * das PDF selbst (siehe `services/importCleaningGroups`) – kopiert man den
 * Text heraus, kommt er je nach Programm spaltenweise, und dann weiss niemand
 * mehr, wer zu welcher Gruppe gehört. Eingefügter Text geht trotzdem, als
 * Ausweg.
 *
 * Jeder Eintrag wird den **aktiven Mitgliedern** zugeordnet. Was offen bleibt,
 * steht in der Vorschau und lässt sich danach unter «Putzplan ›
 * Gruppeneinteilung» von Hand verknüpfen – dort wird die Einteilung ab jetzt
 * gepflegt. Darum steht der Import bei den Admin-Importen: Er füllt den
 * Bestand ein einziges Mal.
 */

type Step = 'source' | 'preview' | 'done'

interface PreviewEntry extends CleaningGroupEntry {
  unmatched: string[]
}

interface PreviewGroup {
  number: number
  entries: PreviewEntry[]
}

export function ImportCleaningGroups() {
  const toast = useToast()
  const navigate = useNavigate()
  const { members, membersById } = useData()
  const { data: existing } = useCleaningGroups()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('source')
  const [parsed, setParsed] = useState<ParsedCleaningGroups | null>(null)
  const [source, setSource] = useState('')
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<{ groups: number; entries: number; open: number } | null>(
    null,
  )

  const fromText = useMemo(() => parseCleaningGroups(linesFromText(pasted)), [pasted])

  /* Die Zuordnung hängt an den Mitgliedern – sie sind beim Öffnen der Seite
     vielleicht noch nicht geladen. Deshalb wird sie erst hier gerechnet. */
  const index = useMemo(() => activeMemberIndex(members), [members])
  const preview = useMemo<PreviewGroup[]>(
    () =>
      (parsed?.groups ?? []).map((group) => ({
        number: group.number,
        entries: group.entries.map((entry) => ({
          id: uid(),
          label: entry.label,
          ...matchEntryMembers(entry.label, index),
        })),
      })),
    [parsed, index],
  )

  const entryCount = preview.reduce((sum, group) => sum + group.entries.length, 0)
  const linkedCount = preview.reduce(
    (sum, group) => sum + group.entries.reduce((inner, entry) => inner + entry.memberIds.length, 0),
    0,
  )
  const openCount = preview.reduce(
    (sum, group) => sum + group.entries.reduce((inner, entry) => inner + entry.unmatched.length, 0),
    0,
  )

  const take = (next: ParsedCleaningGroups, label: string) => {
    if (next.columns) {
      toast.error(
        'Die Liste kam spaltenweise – erst alle Gruppen, dann alle Namen. Bitte das PDF hochladen.',
      )
      return
    }
    if (next.groups.length === 0) {
      toast.error('Keine Gruppe erkannt. Erwartet wird «Gruppe 1», «Gruppe 2» … samt den Namen.')
      return
    }
    setParsed(next)
    setSource(label)
    setStep('preview')
  }

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const lines = await linesFromPdf(new Uint8Array(await file.arrayBuffer()))
      if (lines.length === 0) {
        toast.error('Diese Datei lässt sich so nicht lesen. Füge den Text unten ein.')
        return
      }
      take(parseCleaningGroups(lines), file.name)
    } catch (error) {
      console.error(error)
      toast.error('Die Datei konnte nicht gelesen werden.')
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setBusy(true)
    try {
      await replaceCleaningGroups(
        preview.map((group) => ({
          number: group.number,
          entries: group.entries.map(({ id, label, memberIds }) => ({ id, label, memberIds })),
        })),
        existing.map((group) => group.number),
      )
      setResult({ groups: preview.length, entries: entryCount, open: openCount })
      setStep('done')
    } catch (error) {
      console.error(error)
      toast.error(importErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setParsed(null)
    setSource('')
    setPasted('')
    setResult(null)
    setStep('source')
  }

  return (
    <>
      <BackLink to="/einstellungen" label="Einstellungen" />
      <PageHeader
        title="Putzgruppen importieren"
        subtitle="Die Gruppeneinteilung fürs Putzen aus dem PDF der Gemeinde"
      />
      <ImportNav />

      {step === 'source' && (
        <div className="space-y-4">
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
              'card flex flex-col items-center justify-center px-6 py-12 text-center transition',
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
            <h2 className="text-base font-semibold">PDF hierher ziehen</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Die «Gruppeneinteilung Putzen» so, wie sie verschickt wird: links «Gruppe 1» bis
              «Gruppe 10», rechts die Haushalte, der zuständige <strong>fett</strong> zuoberst.
            </p>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              <Upload className="size-4" aria-hidden />
              PDF auswählen
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
                event.target.value = ''
              }}
            />
          </div>

          <PasteCard
            title="Oder als Text einfügen"
            description={
              <>
                Aus Google Docs die Tabelle markieren, kopieren und hier einfügen. Ohne Fettdruck
                gilt der erste Eintrag einer Gruppe als zuständig – wie auf der Liste.
              </>
            }
            placeholder={'Gruppe 1\tRömer Nathan\nLauener Richard & Katrin\n…'}
            value={pasted}
            onChange={setPasted}
            onSubmit={() => take(fromText, 'Eingefügter Text')}
            canSubmit={fromText.groups.length > 0}
            status={
              !pasted.trim() ? (
                <p className="hint mt-0">Noch nichts eingefügt.</p>
              ) : fromText.columns ? (
                <Warning>
                  Die Liste kam spaltenweise – erst alle Gruppen, dann alle Namen. Dann lässt sich
                  nicht sagen, wer wohin gehört: Bitte das PDF hochladen.
                </Warning>
              ) : fromText.groups.length === 0 ? (
                <Warning>Keine Gruppe erkannt – erwartet wird «Gruppe 1» samt den Namen.</Warning>
              ) : (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  {fromText.groups.length} Gruppen mit{' '}
                  {fromText.groups.reduce((sum, group) => sum + group.entries.length, 0)} Einträgen
                  erkannt.
                </p>
              )
            }
            hint={
              <ImportHint title="Was beim Import passiert">
                <p>
                  Die Einteilung wird <strong>ganz ersetzt</strong>: Gruppen, die in der Liste
                  fehlen, fallen weg. Jeder Eintrag wird den aktiven Mitgliedern zugeordnet – «Bader
                  Roger & Sylvie» etwa Roger und Sylvie Bader. Was sich nicht eindeutig zuordnen
                  lässt, bleibt als Name stehen und lässt sich danach unter{' '}
                  <strong>Putzplan › Gruppeneinteilung</strong> verknüpfen.
                </p>
                <p className="mt-2">
                  Der Putzplan selbst bleibt, wie er ist. Neue Wochen entstehen unter{' '}
                  <strong>Putzplan › Generieren</strong> – mit dem zuständigen Haushalt jeder
                  Gruppe.
                </p>
              </ImportHint>
            }
          />
        </div>
      )}

      {step === 'preview' && parsed && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{source}</strong>
              {parsed.version && <> · Version {parsed.version}</>} · {preview.length} Gruppen ·{' '}
              {entryCount} Einträge
            </p>
            {existing.length > 0 && (
              <Warning className="mt-3">
                Die bestehende Einteilung ({existing.length}{' '}
                {existing.length === 1 ? 'Gruppe' : 'Gruppen'}) wird durch diese ersetzt.
              </Warning>
            )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile value={preview.length} label="Gruppen" />
            <SummaryTile
              value={entryCount}
              label="Einträge"
              className="text-sky-600 dark:text-sky-400"
            />
            <SummaryTile
              value={linkedCount}
              label="Mitglieder zugeordnet"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile
              value={openCount}
              label="Namen offen"
              className={openCount > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {preview.map((group) => (
              <section key={group.number} className="card overflow-hidden">
                <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-800/60">
                  Gruppe {group.number}
                </h2>
                <ul className="divide-list">
                  {group.entries.map((entry, position) => (
                    <li key={entry.id} className="px-4 py-2.5">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {entry.label}
                        {position === 0 && (
                          <span className="badge bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                            Zuständig
                          </span>
                        )}
                      </p>
                      {(entry.memberIds.length > 0 || entry.unmatched.length > 0) && (
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          {entry.memberIds.map((id) => {
                            const member = membersById.get(id)
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
                              >
                                <Check className="size-3" aria-hidden />
                                {member ? `${member.firstName} ${member.lastName}` : id}
                              </span>
                            )
                          })}
                          {entry.unmatched.map((name) => (
                            <span key={name} className="text-amber-700 dark:text-amber-400">
                              {name} – nicht zugeordnet
                            </span>
                          ))}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <StepButtons
            onBack={reset}
            onStart={() => void start()}
            busy={busy}
            label="Einteilung übernehmen"
            disabled={preview.length === 0}
          />
        </>
      )}

      {step === 'done' && result && (
        <DoneCard
          summary={`${result.groups} Gruppen mit ${result.entries} Einträgen übernommen.${
            result.open > 0
              ? ` ${result.open} ${result.open === 1 ? 'Name ist' : 'Namen sind'} noch keinem Mitglied zugeordnet – das geht unter «Putzplan › Gruppeneinteilung».`
              : ''
          }`}
          onReset={reset}
          onLeave={() => navigate('/putzplan')}
          leaveLabel="Zum Putzplan"
          resetLabel="Erneut importieren"
        />
      )}
    </>
  )
}
