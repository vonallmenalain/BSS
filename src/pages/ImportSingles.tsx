import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { ImportNav } from '@/components/ImportNav'
import {
  BackLink,
  DoneCard,
  importErrorMessage,
  ImportHint,
  PasteCard,
  PreviewTable,
  ProgressBar,
  StepButtons,
  Warning,
  type Progress,
} from '@/components/ImportShell'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { parsePastedSingles } from '@/services/importSingles'
import { buildSinglesPreview } from '@/services/importMatch'
import { runSinglesImport, type SinglesOutcome } from '@/services/importApply'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import {
  MEMBER_ORGANIZATION_LABELS,
  MEMBER_ORGANIZATION_NAMES,
  type SinglesKind,
} from '@/lib/types'

type Step = 'paste' | 'preview' | 'done'

/**
 * Die beiden Listen der Alleinstehenden übernehmen.
 *
 * **Warum es diesen Import gibt.** Ob jemand verheiratet ist, steht in dieser
 * App nirgends – und soll es auch nicht: Es ändert sich, ohne dass es jemand
 * meldet, und niemand hier möchte es pflegen. Das LCR weiss es und führt
 * daraus zwei Listen. Kopieren und einfügen genügt; danach lässt sich die
 * Mitgliederliste nach **JAE** und **AE** filtern.
 *
 * **Eine Seite für beide Listen.** Sie sehen gleich aus, werden gleich
 * gelesen und am selben Nachmittag geholt – zwei Unterseiten wären zweimal
 * derselbe Weg. Welche der beiden eingefügt wurde, sagt der Text selbst: Die
 * Überschrift steht darin. Die Wahl darüber bleibt trotzdem stehen, denn wer
 * nur die Tabelle markiert, kopiert die Überschrift nicht mit.
 *
 * **Die Liste ist die vollständige Wahrheit.** Wer darauf steht, bekommt das
 * Schlagwort; wer es trägt und nicht mehr darauf steht, verliert es. Sonst
 * bliebe, wer heiratet, für immer unter den Alleinstehenden stehen.
 */
export function ImportSingles() {
  const { members, settings } = useData()
  const toast = useToast()
  const navigate = useNavigate()

  const [pasted, setPasted] = useState('')
  const [step, setStep] = useState<Step>('paste')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<SinglesOutcome | null>(null)

  const parsed = useMemo(() => (pasted.trim() ? parsePastedSingles(pasted) : null), [pasted])

  /*
   * Welche Liste es ist: was der Text sagt – oder was von Hand gewählt wurde.
   *
   * Die Überschrift steht im kopierten Text, und deshalb muss niemand etwas
   * einstellen. Die Wahl daneben ist für den Fall, dass nur die Tabelle
   * markiert wurde; sie gilt, bis etwas Neues eingefügt wird. Abgeleitet und
   * nicht nachgeführt: Ein Zustand, der sich selbst an einen anderen angleicht,
   * ist einer zu viel – und zeigt beim Umschalten kurz den alten Stand.
   */
  const detected = parsed?.detected ?? null
  const [chosen, setChosen] = useState<SinglesKind | null>(null)
  const kind = chosen ?? detected ?? 'jae'

  /* Neuer Text, neue Erkennung – die Wahl von vorhin gilt ihm nicht. */
  const paste = (next: string) => {
    setPasted(next)
    setChosen(null)
  }

  const preview = useMemo(
    () => (parsed ? buildSinglesPreview(kind, parsed.people, members) : null),
    [parsed, kind, members],
  )

  const lastImport = settings.singlesImportedAt?.[kind]

  const start = async () => {
    if (!preview) return
    setBusy(true)
    setProgress({ done: 0, total: preview.addCount + preview.removals.length })
    try {
      const outcome = await runSinglesImport(preview, (done, total) => setProgress({ done, total }))
      setResult(outcome)
      setStep('done')
      toast.success(`${outcome.added + outcome.unchanged} Personen als ${preview.tag} erfasst.`)
    } catch (error) {
      console.error(error)
      toast.error(importErrorMessage(error))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const reset = () => {
    paste('')
    setResult(null)
    setStep('paste')
  }

  return (
    <>
      <BackLink to="/einstellungen" label="Einstellungen" />
      <PageHeader
        title="Alleinstehende importieren"
        subtitle="Die Listen JAE und AE aus dem LCR übernehmen"
      />
      <ImportNav />

      {step === 'paste' && (
        <>
          <div className="card mb-4 p-4 sm:p-6">
            <span className="label">Welche Liste?</span>
            <SegmentedControl<SinglesKind>
              value={kind}
              onChange={setChosen}
              options={[
                { value: 'jae', label: MEMBER_ORGANIZATION_LABELS.jae },
                { value: 'ae', label: MEMBER_ORGANIZATION_LABELS.ae },
              ]}
            />
            <p className="hint">
              {MEMBER_ORGANIZATION_NAMES[kind]}
              {detected === kind
                ? ' – im eingefügten Text erkannt.'
                : detected
                  ? ` – im Text steht allerdings «${MEMBER_ORGANIZATION_NAMES[detected]}».`
                  : '.'}
              {lastImport && ` Zuletzt eingelesen am ${formatDate(lastImport)}.`}
            </p>
          </div>

          <PasteCard
            title="Liste einfügen"
            description={
              <>
                Im LCR unter <strong>Organisationen</strong> die Liste{' '}
                <strong>{MEMBER_ORGANIZATION_NAMES[kind]}</strong> öffnen, die Seite markieren (Strg
                bzw. Cmd + A), kopieren und hier einfügen.
              </>
            }
            placeholder="Hier einfügen."
            value={pasted}
            onChange={paste}
            onSubmit={() => preview && setStep('preview')}
            canSubmit={Boolean(preview && preview.rows.length > 0)}
            status={
              !pasted.trim() ? (
                <p className="hint mt-0">Noch nichts eingefügt.</p>
              ) : !parsed || parsed.people.length === 0 ? (
                <Warning>
                  Keine Person erkannt. Erwartet wird pro Person eine Zeile mit Name, Geschlecht,
                  Alter und Geburtsdatum.
                </Warning>
              ) : (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  <span className="font-medium">{parsed.people.length} Personen erkannt</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {detected
                      ? `Erkannt als ${MEMBER_ORGANIZATION_NAMES[detected]}`
                      : 'Überschrift nicht mitkopiert – bitte oben prüfen, welche Liste es ist'}
                  </span>
                </p>
              )
            }
            hint={
              <ImportHint title="Was beim Import passiert">
                <p>
                  Wer auf der Liste steht, bekommt das Schlagwort{' '}
                  <strong>{MEMBER_ORGANIZATION_LABELS[kind]}</strong>; wer es trägt und nicht mehr
                  darauf steht, verliert es. Die Liste ist die vollständige Wahrheit – sonst bliebe,
                  wer heiratet, für immer unter den Alleinstehenden stehen. Die andere Liste und
                  alle übrigen Schlagworte bleiben unberührt, Namen ohne erfasste Person werden
                  übersprungen.
                </p>
                <p>
                  Am Mitglied selbst ändert sich sonst nichts: Name, Geburtsdatum und Anschrift
                  kommen weiterhin aus dem Mitgliederimport.
                </p>
              </ImportHint>
            }
          />
        </>
      )}

      {step === 'preview' && preview && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile
              value={preview.addCount}
              label="Neu"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile value={preview.keepCount} label="Unverändert" className="text-slate-400" />
            <SummaryTile
              value={preview.removals.length}
              label="Entfällt"
              className="text-amber-600 dark:text-amber-400"
            />
            <SummaryTile
              value={preview.skipCount}
              label="Übersprungen"
              className="text-slate-400"
            />
          </div>

          {preview.removals.length > 0 && (
            <Warning className="mb-4">
              {preview.removals.length === 1
                ? 'Eine Person verliert das Schlagwort, weil sie nicht mehr auf der Liste steht: '
                : `${preview.removals.length} Personen verlieren das Schlagwort, weil sie nicht mehr auf der Liste stehen: `}
              {preview.removals.map((entry) => entry.memberName).join(' · ')}
            </Warning>
          )}

          <PreviewTable
            columns={['Aus der Liste', 'Geburtsdatum', 'Zugeordnet', 'Hinweise']}
            total={preview.rows.length}
          >
            {preview.rows.slice(0, 100).map((row, index) => (
              <tr
                key={`${row.person.fullName}-${index}`}
                className={row.action === 'skip' ? 'opacity-50' : ''}
              >
                <td className="px-3 py-2 font-medium">{row.person.fullName}</td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.person.birthDate || '—'}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.memberName || '—'}
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <ActionBadge action={row.action} tag={preview.tag} />
                    {row.warnings.length > 0 && (
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        {row.warnings.join(' · ')}
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </PreviewTable>

          <ProgressBar progress={progress} />

          <StepButtons
            onBack={() => setStep('paste')}
            onStart={() => void start()}
            busy={busy}
            label={
              preview.addCount + preview.removals.length === 0
                ? 'Nichts zu schreiben'
                : `${preview.addCount + preview.removals.length} Personen schreiben`
            }
            disabled={preview.addCount + preview.removals.length === 0}
          />
        </>
      )}

      {step === 'done' && result && (
        <DoneCard
          summary={[
            `${result.added} neu erfasst`,
            result.unchanged > 0 && `${result.unchanged} unverändert`,
            result.removed > 0 && `${result.removed} entfallen`,
            result.skipped > 0 && `${result.skipped} übersprungen`,
          ]
            .filter(Boolean)
            .join(' · ')}
          onReset={reset}
          onLeave={() => navigate('/mitglieder')}
          leaveLabel="Zur Mitgliederliste"
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

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
      <p className={cn('tabular text-xl font-semibold', className)}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

function ActionBadge({ action, tag }: { action: 'add' | 'keep' | 'skip'; tag: string }) {
  return (
    <span
      className={cn(
        'badge',
        action === 'add'
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : action === 'keep'
            ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
      )}
    >
      {action === 'add' ? `${tag} neu` : action === 'keep' ? 'Steht bereits' : 'Übersprungen'}
    </span>
  )
}
