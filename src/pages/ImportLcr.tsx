import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useCallings } from '@/hooks/useFirestore'
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
import { SummaryTile } from '@/components/ui/Feedback'
import { cn } from '@/lib/utils'
import { parsePastedCallings, type CallingSource } from '@/services/importCallings'
import { parsePastedMinistering } from '@/services/importMinistering'
import { buildCallingsPreview, buildMinisteringPreview } from '@/services/importMatch'
import { runCallingsImport, runMinisteringImport } from '@/services/importApply'
import { ORGANIZATION_LABELS, type Organization } from '@/lib/types'

/**
 * Berufungen und Betreuungsaufträge aus dem LCR übernehmen.
 *
 * Beide Listen gibt es dort nur zum Ansehen, nicht zum Herunterladen –
 * also derselbe Weg wie beim Mitgliederverzeichnis: Seite markieren,
 * kopieren, hier einfügen. Drei Schritte statt vier, weil die Spalten
 * feststehen und nichts zuzuordnen ist.
 *
 * Beide Importe **ersetzen** ihren Bereich, statt ihn zu ergänzen: Die
 * LCR-Seite ist die vollständige Wahrheit über den aktuellen Stand. Was
 * dabei wegfällt, steht vor dem Schreiben in der Vorschau – das ist der
 * Teil, den man wirklich prüfen muss.
 */

type Step = 'paste' | 'preview' | 'done'

/* ------------------------------------------------------------------ */
/* Berufungen                                                          */
/* ------------------------------------------------------------------ */

export function ImportCallings() {
  const { members } = useData()
  // Grosszügig bemessen: Der Abgleich muss den ganzen Bestand sehen, sonst
  // entstünden Dubletten für Berufungen, die knapp ausserhalb lägen.
  const { data: existing } = useCallings(1000)
  const toast = useToast()
  const navigate = useNavigate()

  const [pasted, setPasted] = useState('')
  const [step, setStep] = useState<Step>('paste')
  const [source, setSource] = useState<CallingSource>('organizations')
  const [releaseMissing, setReleaseMissing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<{
    created: number
    updated: number
    released: number
    skipped: number
  } | null>(null)

  // Die Quelle wird gewählt, nicht geraten: Die Seite «ausserhalb der
  // Einheit» trägt kein Merkmal, an dem sie sich erkennen liesse, und die
  // Wahl entscheidet mit, welcher Bereich ersetzt wird.
  const parsed = useMemo(
    () => (pasted.trim() ? parsePastedCallings(pasted, source) : null),
    [pasted, source],
  )
  const preview = useMemo(
    () => (parsed ? buildCallingsPreview(parsed, members, existing) : null),
    [parsed, members, existing],
  )

  const releases = releaseMissing ? (preview?.releases ?? []) : []
  const writeCount = preview ? preview.createCount + preview.updateCount + releases.length : 0

  const start = async () => {
    if (!preview) return
    setBusy(true)
    setProgress({ done: 0, total: writeCount })
    try {
      const outcome = await runCallingsImport(preview, { releaseMissing }, (done, total) =>
        setProgress({ done, total }),
      )
      setResult(outcome)
      setStep('done')
      toast.success(
        `${outcome.created} neu, ${outcome.updated} aktualisiert, ${outcome.released} entlassen.`,
      )
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
    setResult(null)
    setStep('paste')
  }

  return (
    <>
      <BackLink to="/berufungen" label="Berufungen" />
      <PageHeader
        title="Berufungen importieren"
        subtitle="Die Berufungsliste aus dem LCR einfügen und mit dem Bestand abgleichen"
      />
      <ImportNav />

      {step === 'paste' && (
        <div className="card mb-4 p-4">
          <span className="label">Welche Liste?</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['organizations', 'Berufungen der Gemeinde'],
                ['outOfUnit', 'Ausserhalb der Einheit'],
              ] as [CallingSource, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSource(key)
                  setPasted('')
                }}
                aria-pressed={source === key}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  source === key
                    ? 'border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="hint">
            Die beiden Listen stehen im LCR auf eigenen Seiten und werden getrennt geführt: Der
            Sonntagsschulpräsident des Pfahls ist nicht der Sonntagsschulpräsident der Gemeinde.
            Jeder Import ersetzt nur seinen eigenen Bereich.
          </p>
        </div>
      )}

      {step === 'paste' && (
        <PasteCard
          title={
            source === 'organizations'
              ? 'Berufungen der Gemeinde einfügen'
              : 'Berufungen ausserhalb der Einheit einfügen'
          }
          description={
            source === 'organizations' ? (
              <>
                Im LCR <strong>Organisationen</strong> öffnen, die Seite markieren (Strg bzw. Cmd +
                A), kopieren und hier einfügen.
              </>
            ) : (
              <>
                Im LCR <strong>Berufungen ausserhalb der Einheit</strong> öffnen, die Seite
                markieren (Strg bzw. Cmd + A), kopieren und hier einfügen. Diese Berufungen zählen
                für die Person, erscheinen aber nicht im Organisationsplan der Gemeinde.
              </>
            )
          }
          placeholder={`Hier einfügen. Erwartet wird der Aufbau der Berufungsliste:\n\nBischofschaft\nBerufung\tName\tBestätigt\tEingesetzt\nBischof\nMuster, Hans Peter\n6 Nov 2022\t13 Nov 2022`}
          value={pasted}
          onChange={setPasted}
          onSubmit={() => preview && setStep('preview')}
          canSubmit={Boolean(preview && preview.rows.length > 0)}
          status={
            !pasted.trim() ? (
              <p className="hint mt-0">Noch nichts eingefügt.</p>
            ) : !parsed || parsed.callings.length === 0 ? (
              <Warning>
                Keine Berufung erkannt. Erwartet wird pro Berufung die Bezeichnung, darunter der
                Name und das Bestätigungsdatum.
              </Warning>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">
                  {parsed.callings.length}{' '}
                  {parsed.callings.length === 1 ? 'Berufung' : 'Berufungen'} erkannt
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {sourceLabel(parsed.source, parsed.organizations)}
                  {parsed.vacant > 0 && ` · ${parsed.vacant} offen`}
                </span>
              </p>
            )
          }
          hint={
            <ImportHint title="Was beim Import passiert">
              <p>
                Bestehende Berufungen werden über Person, Rolle und Organisation erkannt und
                aktualisiert. Was die eingefügte Seite nicht mehr führt, gilt als entlassen – die
                Berufung bleibt mit ihrem Verlauf erhalten. Offene Berufungen und Namen ohne
                erfasste Person werden übersprungen.
              </p>
            </ImportHint>
          }
        />
      )}

      {step === 'preview' && preview && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              value={releases.length}
              label="Entlassen"
              className="text-amber-600 dark:text-amber-400"
            />
            <SummaryTile
              value={preview.skipCount}
              label="Übersprungen"
              className="text-slate-400"
            />
          </div>

          {preview.skipCount > 0 && (
            <Warning className="mb-4">
              {preview.skipCount} Einträge liessen sich keiner erfassten Person zuordnen. Sie werden
              nicht geschrieben – und ihre bestehende Berufung erscheint unten möglicherweise zu
              Unrecht unter «Entlassen». In dem Fall zuerst die Mitgliederliste importieren.
            </Warning>
          )}

          <div className="card mb-4 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded"
                checked={releaseMissing}
                onChange={(event) => setReleaseMissing(event.target.checked)}
              />
              <span>
                <span className="text-sm font-medium">Fehlende Berufungen entlassen</span>
                <span className="hint mt-0.5 block">
                  Die eingefügte Seite gilt als vollständig. Nur abwählen, wenn bewusst ein
                  Ausschnitt kopiert wurde und trotzdem geschrieben werden soll.
                </span>
              </span>
            </label>
          </div>

          <PreviewTable
            columns={['Aktion', 'Name', 'Berufung', 'Organisation', 'Bestätigt', 'Hinweise']}
            total={preview.rows.length}
          >
            {preview.rows.slice(0, 100).map((row, index) => (
              <tr
                key={`${row.memberName}-${row.parsed.position}-${index}`}
                className={row.action === 'skip' ? 'opacity-50' : ''}
              >
                <td className="px-3 py-2">
                  <ActionBadge action={row.action} />
                </td>
                <td className="px-3 py-2 font-medium">{row.memberName}</td>
                <td className="px-3 py-2">{row.parsed.position}</td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.parsed.outOfUnit
                    ? 'Ausserhalb der Einheit'
                    : ORGANIZATION_LABELS[row.parsed.organization]}
                  {row.parsed.group && ` · ${row.parsed.group}`}
                </td>
                <td className="tabular px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.parsed.sustained || '—'}
                </td>
                <td className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {row.warnings.join(' · ')}
                </td>
              </tr>
            ))}
          </PreviewTable>

          {releases.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-2 text-sm font-semibold">
                Wird entlassen – steht nicht mehr im LCR
              </h2>
              <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                {releases.map((calling) => (
                  <p key={calling.id} className="px-3 py-2 text-sm">
                    <span className="font-medium">{calling.memberName}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {' · '}
                      {calling.position} · {ORGANIZATION_LABELS[calling.organization]}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={() => setStep('paste')}
            onStart={() => void start()}
            busy={busy}
            label={`${writeCount} Änderungen schreiben`}
            disabled={writeCount === 0}
          />
        </>
      )}

      {step === 'done' && result && (
        <DoneCard
          summary={`${result.created} neu angelegt · ${result.updated} aktualisiert · ${result.released} entlassen${
            result.skipped > 0 ? ` · ${result.skipped} übersprungen` : ''
          }`}
          onReset={reset}
          onLeave={() => navigate('/berufungen')}
          leaveLabel="Zu den Berufungen"
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Betreuungsaufträge                                                  */
/* ------------------------------------------------------------------ */

export function ImportMinistering() {
  const { members } = useData()
  const toast = useToast()
  const navigate = useNavigate()

  const [pasted, setPasted] = useState('')
  const [step, setStep] = useState<Step>('paste')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null)

  const parsed = useMemo(() => (pasted.trim() ? parsePastedMinistering(pasted) : null), [pasted])
  const preview = useMemo(
    () => (parsed ? buildMinisteringPreview(parsed.entries, members) : null),
    [parsed, members],
  )

  const start = async () => {
    if (!preview) return
    setBusy(true)
    setProgress({ done: 0, total: preview.updateCount })
    try {
      const outcome = await runMinisteringImport(preview, (done, total) =>
        setProgress({ done, total }),
      )
      setResult(outcome)
      setStep('done')
      toast.success(`${outcome.updated} Personen aktualisiert.`)
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
    setResult(null)
    setStep('paste')
  }

  return (
    <>
      <BackLink to="/mitglieder" label="Mitglieder" />
      <PageHeader
        title="Betreuung importieren"
        subtitle="Betreuungspartner und Betreuungsauftrag aus dem LCR übernehmen"
      />
      <ImportNav />

      {step === 'paste' && (
        <PasteCard
          title="Betreuungsaufträge einfügen"
          description={
            <>
              Im LCR <strong>Betreuungsaufträge</strong> öffnen, alle Organisationen und alle
              Personen anzeigen lassen, die Seite markieren (Strg bzw. Cmd + A), kopieren und hier
              einfügen.
            </>
          }
          placeholder={`Hier einfügen. Erwartet wird der Aufbau der Betreuungsliste:\n\nMuster, Anna\t\t\nBeispiel, Beatrice\nAnderer, Christoph\nWeitere, Daniela`}
          value={pasted}
          onChange={setPasted}
          onSubmit={() => preview && setStep('preview')}
          canSubmit={Boolean(preview && preview.rows.length > 0)}
          status={
            !pasted.trim() ? (
              <p className="hint mt-0">Noch nichts eingefügt.</p>
            ) : !parsed || parsed.entries.length === 0 ? (
              <Warning>
                Keine Person erkannt. Erwartet wird pro Person eine Zeile, darunter die Namen der
                Betreuungspartner und der betreuten Personen.
              </Warning>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">{parsed.entries.length} Personen erkannt</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {parsed.assignedCount} davon mit Zuteilung
                </span>
              </p>
            )
          }
          hint={
            <ImportHint title="Was beim Import passiert">
              <p>
                Betreuungspartner und Betreuungsauftrag werden ersetzt, nicht ergänzt: Die LCR-Seite
                ist die vollständige Wahrheit über die aktuelle Zuteilung. Wer dort ohne Zuteilung
                steht, verliert sie auch hier. Namen ohne erfasste Person werden übersprungen.
              </p>
            </ImportHint>
          }
        />
      )}

      {step === 'preview' && preview && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <SummaryTile
              value={preview.updateCount}
              label="Personen"
              className="text-sky-600 dark:text-sky-400"
            />
            <SummaryTile
              value={preview.linkCount}
              label="Zuteilungen"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile
              value={preview.skipCount}
              label="Übersprungen"
              className="text-slate-400"
            />
          </div>

          <PreviewTable
            columns={['Person', 'Betreuungspartner', 'Betreuungsauftrag', 'Hinweise']}
            total={preview.rows.length}
          >
            {preview.rows.slice(0, 100).map((row, index) => (
              <tr
                key={`${row.entry.fullName}-${index}`}
                className={row.action === 'skip' ? 'opacity-50' : ''}
              >
                <td className="px-3 py-2 font-medium">{row.entry.fullName}</td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.entry.partners.join(' · ') || '—'}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.entry.assigned.join(' · ') || '—'}
                </td>
                <td className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {row.warnings.join(' · ')}
                </td>
              </tr>
            ))}
          </PreviewTable>

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={() => setStep('paste')}
            onStart={() => void start()}
            busy={busy}
            label={`${preview.updateCount} Personen schreiben`}
            disabled={preview.updateCount === 0}
          />
        </>
      )}

      {step === 'done' && result && (
        <DoneCard
          summary={`${result.updated} Personen aktualisiert${
            result.skipped > 0 ? ` · ${result.skipped} übersprungen` : ''
          }`}
          onReset={reset}
          onLeave={() => navigate('/mitglieder')}
          leaveLabel="Zur Mitgliederliste"
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Gemeinsame Bausteine                                                */
/* ------------------------------------------------------------------ */

/** «Organisationen: Bischofschaft, Sonntagsschule» – wie weit die Quelle reicht. */
function sourceLabel(source: CallingSource, organizations: Organization[]): string {
  if (source === 'outOfUnit') return 'Berufungen ausserhalb der Einheit'
  const names = organizations.map((organization) => ORGANIZATION_LABELS[organization])
  return names.length ? `Organisationen: ${names.join(', ')}` : 'Organisationen'
}

function ActionBadge({ action }: { action: 'create' | 'update' | 'skip' }) {
  return (
    <span
      className={cn(
        'badge',
        action === 'create'
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : action === 'update'
            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800',
      )}
    >
      {action === 'create' ? 'Neu' : action === 'update' ? 'Update' : 'Skip'}
    </span>
  )
}
