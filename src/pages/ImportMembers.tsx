import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { ImportNav } from '@/components/ImportNav'
import { PageHeader } from '@/components/ui/Pickers'
import { SummaryTile } from '@/components/ui/Feedback'
import { cn } from '@/lib/utils'
import { formatDate, getAge } from '@/lib/dates'
import {
  buildPreview,
  DEFAULT_IMPORT_OPTIONS,
  FIELD_LABELS,
  guessMapping,
  parseFile,
  runImport,
  type ImportOptions,
  type ImportPreview,
  type ImportResult,
  type MemberField,
  type ParsedSheet,
} from '@/services/import'
import { parsePastedDirectory, type PastedPerson } from '@/services/importPaste'
import { MEMBER_STATUS_LABELS, type Member } from '@/lib/types'

type Step = 'upload' | 'mapping' | 'preview' | 'done'
type Source = 'text' | 'file'

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Quelle' },
  { key: 'mapping', label: 'Spalten' },
  { key: 'preview', label: 'Prüfen' },
  { key: 'done', label: 'Fertig' },
]

/**
 * Import-Assistent für die Mitgliederliste.
 *
 * Vier Schritte, weil der Abgleich der heikle Teil ist: Quelle einlesen,
 * Spalten zuordnen, Vorschau prüfen, schreiben. Beim Wiederholungsimport
 * erkennt die Vorschau bestehende Datensätze und aktualisiert sie, statt
 * Dubletten anzulegen.
 *
 * Als Quelle dienen eine Datei oder – das ist der Normalfall – die aus dem
 * LCR-Mitgliederverzeichnis kopierte Liste. Beide Wege münden in dieselbe
 * Tabelle, ab Schritt 2 unterscheidet sich nichts mehr.
 */
export function ImportMembers() {
  const { members } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [source, setSource] = useState<Source>('text')
  const [pasted, setPasted] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<MemberField[]>([])
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragging, setDragging] = useState(false)
  /*
   * Wer trotz fehlender Zeile in der Quelle bleiben soll – einzeln
   * abgewählt. Gemerkt wird, wer **bleibt**, nicht wer geht: So ist jede
   * Person, die neu in die Liste «fehlt in der Quelle» rückt, zunächst zum
   * Entfernen vorgesehen, wie es der Normalfall will.
   */
  const [kept, setKept] = useState<Set<string>>(() => new Set())

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true)
      try {
        const parsed = await parseFile(file)
        if (parsed.rows.length === 0) {
          toast.error('In der Datei wurden keine Datenzeilen gefunden.')
          return
        }
        setSourceLabel(file.name)
        setSheet(parsed)
        setMapping(guessMapping(parsed.headers))
        setStep('mapping')
      } catch (error) {
        console.error(error)
        toast.error('Die Datei konnte nicht gelesen werden. Unterstützt: .xlsx und .csv')
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

  /**
   * Der eingefügte Text wird bei jeder Änderung ausgewertet, damit direkt
   * sichtbar ist, wie viele Personen erkannt wurden – noch bevor man den
   * Assistenten weiterklickt.
   */
  const parsedPaste = useMemo(() => (pasted.trim() ? parsePastedDirectory(pasted) : null), [pasted])

  const takePaste = () => {
    if (!parsedPaste || parsedPaste.people.length === 0) return
    setSourceLabel('Eingefügte Liste')
    setSheet({ headers: parsedPaste.headers, rows: parsedPaste.rows })
    setMapping(parsedPaste.mapping)
    setStep('mapping')
  }

  const preview: ImportPreview | null = useMemo(() => {
    if (!sheet || step === 'upload') return null
    return buildPreview(sheet, mapping, members)
  }, [sheet, mapping, members, step])

  const hasName = mapping.some((field) => ['lastName', 'firstName', 'fullName'].includes(field))

  /** Wer tatsächlich entfernt wird – alle Fehlenden ausser den abgewählten. */
  const removals = useMemo(
    () => (preview ? preview.removals.filter((member) => !kept.has(member.id)) : []),
    [preview, kept],
  )

  const start = async () => {
    if (!preview) return
    setBusy(true)
    setProgress({ done: 0, total: preview.createCount + preview.updateCount })
    try {
      const outcome = await runImport(
        { ...preview, removals },
        { ...options, removeMissing: removals.length > 0 },
        (done, total) => setProgress({ done, total }),
      )
      setResult(outcome)
      setStep('done')
      toast.success(
        `${outcome.created} neu, ${outcome.updated} aktualisiert` +
          (outcome.removed > 0 ? `, ${outcome.removed} entfernt.` : '.'),
      )
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : 'Der Import ist fehlgeschlagen. Es wurden möglicherweise nur Teile geschrieben.',
      )
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const reset = () => {
    setStep('upload')
    setSheet(null)
    setMapping([])
    setResult(null)
    setSourceLabel('')
    setKept(new Set())
  }

  return (
    <>
      <Link
        to="/einstellungen"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Einstellungen
      </Link>

      <PageHeader
        title="Mitglieder importieren"
        subtitle="Liste einfügen oder Datei einlesen und mit dem Bestand abgleichen"
      />
      <ImportNav />

      {/* Schrittanzeige */}
      <ol className="mb-6 flex items-center gap-2 text-sm">
        {STEPS.map((entry, index) => {
          const currentIndex = STEPS.findIndex((s) => s.key === step)
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo'
          return (
            <li key={entry.key} className="flex items-center gap-2">
              <span
                className={cn(
                  'tabular grid size-6 place-items-center rounded-full text-xs font-semibold',
                  state === 'done'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : state === 'current'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
                )}
              >
                {state === 'done' ? <CheckCircle2 className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden sm:inline',
                  state === 'current' ? 'font-medium' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {entry.label}
              </span>
              {index < STEPS.length - 1 && (
                <ArrowRight className="size-3 text-slate-300" aria-hidden />
              )}
            </li>
          )
        })}
      </ol>

      {/* ---------- Schritt 1: Quelle ---------- */}
      {step === 'upload' && (
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

      {/* ---------- Schritt 1a: Liste einfügen ---------- */}
      {step === 'upload' && source === 'text' && (
        <div className="card p-4 sm:p-6">
          <h2 className="text-base font-semibold">Mitgliederverzeichnis einfügen</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Im LCR das Mitgliederverzeichnis öffnen, die Seite markieren (Strg bzw. Cmd + A),
            kopieren und hier einfügen. Kopf- und Fusszeilen der Seite dürfen mit dabei sein – sie
            werden übersprungen.
          </p>

          <label htmlFor="paste" className="sr-only">
            Eingefügte Mitgliederliste
          </label>
          <textarea
            id="paste"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            onKeyDown={(event) => {
              // Strg/Cmd + Enter übernimmt, ohne zur Maus zu greifen.
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) takePaste()
            }}
            spellCheck={false}
            rows={14}
            placeholder="Hier einfügen."
            className="input mt-4 resize-y font-mono text-xs leading-relaxed whitespace-pre"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <PasteStatus people={parsedPaste?.people ?? []} hasText={Boolean(pasted.trim())} />

            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPasted('')}
                disabled={!pasted}
              >
                Leeren
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={takePaste}
                disabled={!parsedPaste || parsedPaste.people.length === 0}
              >
                Weiter zur Zuordnung
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">Was gelesen wird</p>
            <p>
              Name, Geschlecht und Geburtsdatum aus der Kopfzeile, danach Strasse, PLZ und Ort sowie
              Telefonnummer und E-Mail. Nummern mit Vorwahl 076–079 landen im Feld «Mobile», alle
              übrigen unter «Telefon». Fehlende Angaben bleiben leer, Vermerke wie «nicht getauft»
              stehen im Zuordnungsschritt als Spalte «Hinweis» bereit.
            </p>
          </div>
        </div>
      )}

      {/* ---------- Schritt 1b: Datei ---------- */}
      {step === 'upload' && source === 'file' && (
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
            Unterstützt werden <strong>.xlsx</strong> und <strong>.csv</strong>. Die erste Zeile mit
            Inhalt wird als Spaltenüberschrift gelesen.
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

      {step === 'upload' && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">
            Was beim wiederholten Import passiert
          </p>
          <p>
            Bestehende Personen werden erkannt (über Mitglieds-Nr., sonst über Name und
            Geburtsdatum) und aktualisiert. Notizen, Status und das Datum der letzten Ansprache
            bleiben dabei auf Wunsch unangetastet – so gehen gepflegte Angaben nicht verloren.
          </p>
        </div>
      )}

      {/* ---------- Schritt 2: Spalten zuordnen ---------- */}
      {step === 'mapping' && sheet && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{sourceLabel}</strong> · {sheet.rows.length} Zeilen, {sheet.headers.length}{' '}
              Spalten
            </p>
            <p className="hint">
              Die Zuordnung wurde automatisch geraten. Prüfe sie und korrigiere, was nicht passt.
            </p>
          </div>

          {!hasName && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Es ist keine Namensspalte zugeordnet. Ordne mindestens «Nachname» oder «Name» zu.
              </span>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-2 font-medium">Spalte in der Datei</th>
                  <th className="px-4 py-2 font-medium">Beispielwert</th>
                  <th className="px-4 py-2 font-medium">Zielfeld</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sheet.headers.map((header, index) => (
                  <tr key={`${header}-${index}`}>
                    <td className="px-4 py-2 font-medium">{header}</td>
                    <td className="max-w-48 truncate px-4 py-2 text-slate-500 dark:text-slate-400">
                      {sheet.rows.find((row) => row[index])?.[index] ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="input py-1.5 text-sm"
                        value={mapping[index] ?? 'ignore'}
                        onChange={(event) => {
                          const next = [...mapping]
                          next[index] = event.target.value as MemberField
                          setMapping(next)
                        }}
                        aria-label={`Zielfeld für Spalte ${header}`}
                      >
                        {Object.entries(FIELD_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
              Andere Quelle
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStep('preview')}
              disabled={!hasName}
            >
              Weiter zur Vorschau
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </>
      )}

      {/* ---------- Schritt 3: Vorschau ---------- */}
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
              value={removals.length}
              label="Entfernen"
              className="text-rose-600 dark:text-rose-400"
            />
            <SummaryTile
              value={preview.skipCount}
              label="Übersprungen"
              className="text-slate-400"
            />
          </div>

          <div className="card mb-4 space-y-3 p-4">
            <h2 className="text-sm font-semibold">Beim Aktualisieren bestehender Personen</h2>
            {(
              [
                [
                  'keepExistingOnEmpty',
                  'Leere Zellen ignorieren',
                  'Ein leeres Feld in der Datei löscht keine bereits erfasste Angabe.',
                ],
                [
                  'preserveNotes',
                  'Notizen behalten',
                  'Die in der App gepflegten Notizen bleiben unverändert.',
                ],
                [
                  'preserveStatus',
                  'Status behalten',
                  'Aktiv/Inaktiv wird nicht aus der Datei überschrieben.',
                ],
              ] as [keyof ImportOptions, string, string][]
            ).map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded"
                  checked={options[key]}
                  onChange={(event) =>
                    setOptions((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                <span>
                  <span className="text-sm font-medium">{label}</span>
                  <span className="hint mt-0.5 block">{hint}</span>
                </span>
              </label>
            ))}
          </div>

          <MissingMembers missing={preview.removals} kept={kept} onChange={setKept} />

          <PreviewTable rows={preview.rows} />

          {progress && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="bg-brand-600 h-full transition-all"
                  style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-center text-xs text-slate-500">
                {progress.done} von {progress.total} geschrieben …
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep('mapping')}
              disabled={busy}
            >
              Zurück
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void start()}
              disabled={busy || preview.createCount + preview.updateCount + removals.length === 0}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {preview.createCount + preview.updateCount} Datensätze importieren
              {removals.length > 0 && `, ${removals.length} entfernen`}
            </button>
          </div>
        </>
      )}

      {/* ---------- Schritt 4: Fertig ---------- */}
      {step === 'done' && result && (
        <div className="card px-6 py-12 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">Import abgeschlossen</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {result.created} neu angelegt · {result.updated} aktualisiert
            {result.removed > 0 && ` · ${result.removed} entfernt`}
            {result.skipped > 0 && ` · ${result.skipped} übersprungen`}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
              Weitere Liste importieren
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/mitglieder')}>
              Zur Mitgliederliste
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Rückmeldung direkt unter dem Textfeld: wie viele Personen erkannt wurden
 * und – als Stichprobe – die erste und die letzte davon. Damit sieht man
 * sofort, ob die Liste vollständig kopiert wurde.
 */
function PasteStatus({ people, hasText }: { people: PastedPerson[]; hasText: boolean }) {
  if (!hasText) {
    return <p className="hint mt-0">Noch nichts eingefügt.</p>
  }

  if (people.length === 0) {
    return (
      <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Keine Person erkannt. Erwartet wird pro Person eine Zeile mit Name, Geschlecht, Alter und
          Geburtsdatum.
        </span>
      </p>
    )
  }

  const first = people[0]
  const last = people[people.length - 1]

  return (
    <p className="text-sm text-emerald-700 dark:text-emerald-400">
      <span className="font-medium">
        {people.length} {people.length === 1 ? 'Person' : 'Personen'} erkannt
      </span>
      <span className="block text-xs text-slate-500 dark:text-slate-400">
        {first.fullName} … {last.fullName}
      </span>
    </p>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Wer in der Quelle fehlt – namentlich, bevor etwas geschrieben wird.
 *
 * Die kopierte LCR-Seite ist die vollständige Wahrheit über den Bestand:
 * Wer dort nicht mehr steht, gehört nicht mehr zur Gemeinde. Weil sich in
 * der App niemand von Hand löschen lässt, ist der Import der einzige Ort,
 * an dem das nachvollzogen wird.
 *
 * Genau deshalb steht hier eine Namensliste und keine blosse Zahl: Ein
 * versehentlich nur halb kopiertes Verzeichnis fällt an den Namen sofort
 * auf, an einer Zahl erst hinterher. **Jede Person lässt sich einzeln
 * abwählen** – wer etwa erst nach einem Gespräch wegfallen soll, bleibt
 * vorerst, während die übrigen gehen. Der Haken oben wählt alle oder keine.
 * Damit man nicht im Blindflug entscheidet, steht bei jeder Person, was
 * die App über sie weiss: Alter, Ort, Status, letzte Ansprache.
 */
function MissingMembers({
  missing,
  kept,
  onChange,
}: {
  missing: Member[]
  /** Wer bleibt – abgewählt. */
  kept: Set<string>
  onChange: (next: Set<string>) => void
}) {
  if (missing.length === 0) return null

  const sorted = [...missing].sort((a, b) =>
    `${a.lastName}, ${a.firstName}`.localeCompare(`${b.lastName}, ${b.firstName}`, 'de-CH'),
  )
  const selected = sorted.filter((member) => !kept.has(member.id)).length
  const all = selected === sorted.length
  const none = selected === 0

  const toggle = (id: string) => {
    const next = new Set(kept)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div className={cn('card mb-4 space-y-3 p-4', !none && 'border-rose-300 dark:border-rose-900')}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded"
          checked={all}
          ref={(element) => {
            if (element) element.indeterminate = !all && !none
          }}
          onChange={() => onChange(all ? new Set(sorted.map((member) => member.id)) : new Set())}
          aria-label="Alle Fehlenden entfernen"
        />
        <span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-rose-500" aria-hidden />
            {missing.length} erfasste {missing.length === 1 ? 'Person fehlt' : 'Personen fehlen'} in
            der Quelle
            <span className="font-normal text-slate-500 dark:text-slate-400">
              · {selected} {selected === 1 ? 'wird' : 'werden'} entfernt
            </span>
          </span>
          <span className="hint mt-0.5 block">
            Die eingefügte Seite gilt als der ganze Bestand. Wähle ab, wer vorerst bleiben soll –
            wer bewusst nur einen Ausschnitt einliest, nimmt oben alle weg. Erfasste Ansprachen und
            Berufungen bleiben bestehen, verlieren aber ihren Bezug.
          </span>
        </span>
      </label>

      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {sorted.map((member) => {
          const remove = !kept.has(member.id)
          const age = getAge(member.birthDate)
          const facts = [
            age !== null ? `${age} Jahre` : null,
            member.city || null,
            member.status !== 'active' ? MEMBER_STATUS_LABELS[member.status] : null,
            member.lastTalkDate
              ? `Ansprache ${formatDate(member.lastTalkDate)}`
              : 'noch keine Ansprache',
          ].filter(Boolean)
          return (
            <li key={member.id}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded"
                  checked={remove}
                  onChange={() => toggle(member.id)}
                  aria-label={`${member.lastName}, ${member.firstName} entfernen`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm',
                      remove
                        ? 'text-slate-500 line-through dark:text-slate-400'
                        : 'font-medium text-slate-800 dark:text-slate-100',
                    )}
                  >
                    {member.lastName}, {member.firstName}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {facts.join(' · ')}
                  </span>
                </span>
                <span
                  className={cn(
                    'badge shrink-0',
                    remove
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {remove ? 'Entfernen' : 'Bleibt'}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */

type RowFilter = 'all' | 'create' | 'update' | 'skip' | 'warnings'

const ROW_FILTER_LABELS: Record<RowFilter, string> = {
  all: 'Alle',
  create: 'Neu',
  update: 'Aktualisieren',
  skip: 'Übersprungen',
  warnings: 'Mit Hinweis',
}

/** Wie viele Zeilen je Seite – «0» heisst alle. */
const PAGE_SIZES = [25, 50, 100, 250, 0]

/**
 * Die Vorschau Zeile für Zeile – ganz, nicht nur die ersten hundert.
 *
 * Ein Verzeichnis hat leicht über zweihundert Personen, und gerade die
 * Zeilen weiter unten wollen geprüft sein. Deshalb lässt sich blättern und
 * die Seitengrösse wählen («Alle» zeigt alles auf einmal), und der Filter
 * holt heraus, was einen zweiten Blick verdient: was neu angelegt wird
 * und wo ein Hinweis steht.
 */
function PreviewTable({ rows }: { rows: ImportPreview['rows'] }) {
  const [filter, setFilter] = useState<RowFilter>('all')
  const [pageSize, setPageSize] = useState(100)
  const [page, setPage] = useState(0)

  const counts: Record<RowFilter, number> = {
    all: rows.length,
    create: rows.filter((row) => row.action === 'create').length,
    update: rows.filter((row) => row.action === 'update').length,
    skip: rows.filter((row) => row.action === 'skip').length,
    warnings: rows.filter((row) => row.warnings.length > 0).length,
  }
  const filtered =
    filter === 'all'
      ? rows
      : filter === 'warnings'
        ? rows.filter((row) => row.warnings.length > 0)
        : rows.filter((row) => row.action === filter)

  const size = pageSize === 0 ? Math.max(filtered.length, 1) : pageSize
  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(page, pages - 1)
  const from = current * size
  const shown = filtered.slice(from, from + size)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Zeilen filtern">
          {(Object.keys(ROW_FILTER_LABELS) as RowFilter[])
            .filter((key) => key === 'all' || counts[key] > 0)
            .map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => {
                  setFilter(key)
                  setPage(0)
                }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition',
                  filter === key
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                {ROW_FILTER_LABELS[key]} <span className="tabular opacity-75">{counts[key]}</span>
              </button>
            ))}
        </div>
        <label className="ms-auto flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          Zeilen je Seite
          <select
            className="input w-auto py-1 text-xs"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(0)
            }}
          >
            {PAGE_SIZES.map((value) => (
              <option key={value} value={value}>
                {value === 0 ? 'Alle' : value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 font-medium">Aktion</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Geburtsdatum</th>
              <th className="px-3 py-2 font-medium">Kontakt</th>
              <th className="px-3 py-2 font-medium">Hinweise</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((row) => (
              <tr key={row.rowIndex} className={row.action === 'skip' ? 'opacity-50' : ''}>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'badge',
                      row.action === 'create'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                        : row.action === 'update'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800',
                    )}
                  >
                    {row.action === 'create' ? 'Neu' : row.action === 'update' ? 'Update' : 'Skip'}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">
                  {row.data.lastName}
                  {row.data.firstName && `, ${row.data.firstName}`}
                </td>
                <td className="tabular px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.birthDate?.toLocaleDateString('de-CH') ?? '—'}
                </td>
                <td className="max-w-48 truncate px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.data.email || row.data.mobile || row.data.phone || '—'}
                </td>
                <td className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {row.warnings.join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
        <p className="tabular text-xs text-slate-500 dark:text-slate-400">
          {filtered.length === 0
            ? 'Keine Zeilen'
            : `Zeilen ${from + 1}–${from + shown.length} von ${filtered.length}`}
          {filter !== 'all' && ` · gefiltert aus ${rows.length}`} – importiert werden immer alle.
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              aria-label="Vorherige Seite"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="tabular text-xs text-slate-500 dark:text-slate-400">
              Seite {current + 1} von {pages}
            </span>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              aria-label="Nächste Seite"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
