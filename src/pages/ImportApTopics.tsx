import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApActivities } from '@/hooks/useFirestore'
import { ImportNav } from '@/components/ImportNav'
import {
  BackLink,
  DoneCard,
  ImportHint,
  PasteCard,
  PreviewTable,
  StepButtons,
  Warning,
  importErrorMessage,
} from '@/components/ImportShell'
import { PageHeader } from '@/components/ui/Pickers'
import { SummaryTile } from '@/components/ui/Feedback'
import { formatDayShort, formatMonth } from '@/lib/dates'
import { fromIsoDate } from '@/services/importHistory'
import { importApTopics, type ApTopicWrite } from '@/services/apActivities'
import {
  AP_LESSON_SLOT_LABELS,
  apLessonsWithoutClass,
  apTopicRows,
  parsePastedApTopics,
  type ApLessonWithoutClass,
  type ApTopicRow,
  type ParsedApTopics,
} from '@/services/importApTopics'
import { apClassHours } from '@/lib/types'

/**
 * Die Themen der AP-Klasse übernehmen.
 *
 * Seit September 2026 ist die Klasse wöchentlich, und ihre Themen sind
 * vorgegeben: «Für eine starke Jugend» gibt für jeden Monat ein Thema und
 * vier Lektionen heraus – für den ersten bis vierten Sonntag. Sie von Hand
 * abzutippen hiesse, jeden Monat viermal denselben Satz aus dem Browser in
 * den Plan zu übertragen.
 *
 * Der Import macht daraus einen Handgriff: Seite kopieren, einfügen,
 * Vorschau prüfen, übernehmen. Er ist damit der einzige Import, der
 * **monatlich** gebraucht wird, und steht deshalb bei den Aktivitäten AP,
 * nicht hinten bei den einmaligen. Bringt ein Heft mehrere Monate mit –
 * das vom Oktober 2026 auch den November –, kommen alle auf einmal.
 *
 * **Jede Klasse heisst «Thema des Monats – Thema der Woche»**, etwa «Dein
 * Körper ist heilig – Erfahre mehr über das Wort der Weisheit» (siehe
 * `apClassTitle`).
 *
 * **Er legt die Klassen gleich mit an.** Wer im September beginnt, hat für
 * die kommenden Sonntage noch gar keine Termine – und einer, der stattfindet
 * und ein Thema hat, fehlt sonst zweimal. Sonntage, für die das Heft kein
 * Thema vorsieht – der fünfte in einem Monat, der einen hat –, entstehen
 * ebenso, nur eben mit «Thema noch offen».
 *
 * **Was schon dasteht, entscheidet die Vorschau.** Hat eine Klasse bereits
 * einen anderen Titel, steht für sie ein Häkchen «überschreiben» da –
 * gesetzt, denn meist ist es der Titel aus einem früheren Import. Wer an
 * einem Sonntag etwas Eigenes geplant hat, nimmt es weg.
 */

type Step = 'source' | 'preview' | 'done'

/**
 * Was mit einem Sonntag geschieht.
 *
 *  - `create`  – noch keine Klasse im Plan: Sie wird angelegt.
 *  - `set`     – die Klasse hat noch keinen Titel: Sie bekommt ihn.
 *  - `replace` – sie hat einen anderen: überschrieben, wenn angehakt.
 *  - `same`    – sie heisst schon so.
 *  - `keep`    – keine Lektion für diesen Sonntag: Die Klasse bleibt, wie sie ist.
 */
type RowAction = 'create' | 'set' | 'replace' | 'same' | 'keep'

interface PreviewRow extends ApTopicRow {
  /** Die bestehende Klasse an diesem Sonntag, sonst `null` */
  id: string | null
  /** Ihr bisheriger Titel */
  before: string
  action: RowAction
}

function rowAction(row: ApTopicRow, id: string | null, before: string): RowAction {
  if (!id) return 'create'
  if (!row.title) return 'keep'
  if (row.title === before) return 'same'
  return before ? 'replace' : 'set'
}

/** «Oktober 2026» */
function monthLabel(month: string): string {
  return formatMonth(fromIsoDate(`${month}-01`))
}

/** «Fastensonntag am So, 04.10. (Generalkonferenz)» */
function lessonWithoutClassLabel(lesson: ApLessonWithoutClass): string {
  const reason = lesson.conference ? 'Generalkonferenz' : 'damals nur am 2. und 4. Sonntag Klasse'
  return `${AP_LESSON_SLOT_LABELS[lesson.slot]} am ${formatDayShort(fromIsoDate(lesson.date))} (${reason})`
}

export function ImportApTopics() {
  const { profile } = useAuth()
  const { data: activities } = useApActivities()
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('source')
  const [pasted, setPasted] = useState('')
  const [taken, setTaken] = useState<ParsedApTopics[] | null>(null)
  /** Sonntage, an denen der bisherige Titel bleibt – in der Vorschau abgewählt */
  const [kept, setKept] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null)

  const parsed = useMemo(() => (pasted.trim() ? parsePastedApTopics(pasted) : []), [pasted])
  const months = taken ?? parsed

  /**
   * Was geschrieben würde – Sonntag für Sonntag, mit dem, was schon dasteht.
   *
   * Die bestehende Klasse eines Sonntags wird gesucht und nicht bloss
   * gezählt: Ihre ID entscheidet darüber, ob der Import ändert oder anlegt.
   * Ein Anlass anderer Art am selben Sonntag – ein Jugendrat etwa – zählt
   * dabei nicht als Klasse; beide dürfen nebeneinander im Plan stehen.
   */
  const rows = useMemo<PreviewRow[]>(() => {
    const classes = new Map(
      activities
        .filter((activity) => activity.kind === 'class')
        .map((activity) => [activity.date, activity]),
    )

    return months.flatMap((month) =>
      apTopicRows(month).map((row) => {
        const existing = classes.get(row.date)
        const id = existing?.id ?? null
        const before = existing?.title.trim() ?? ''
        return { ...row, id, before, action: rowAction(row, id, before) }
      }),
    )
  }, [months, activities])

  /** Die Sonntage, die tatsächlich geschrieben werden. */
  const writes = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.action === 'create' ||
          row.action === 'set' ||
          (row.action === 'replace' && !kept.has(row.date)),
      ),
    [rows, kept],
  )

  const replaceable = useMemo(() => rows.filter((row) => row.action === 'replace'), [rows])

  const counts = {
    created: writes.filter((row) => row.action === 'create').length,
    updated: writes.filter((row) => row.action !== 'create').length,
    unchanged: rows.length - writes.length,
  }

  /** Lektionen, deren Sonntag keine Klasse hat – Generalkonferenz etwa. */
  const withoutClass = useMemo(() => months.flatMap(apLessonsWithoutClass), [months])

  const setOverwrite = (date: string, overwrite: boolean) =>
    setKept((current) => {
      const next = new Set(current)
      if (overwrite) next.delete(date)
      else next.add(date)
      return next
    })

  const start = async () => {
    if (writes.length === 0) return
    setBusy(true)
    try {
      const outcome = await importApTopics(
        writes.map((row): ApTopicWrite => ({ date: row.date, title: row.title, id: row.id })),
        profile?.id ?? null,
      )
      setResult(outcome)
      setStep('done')
      toast.success(`${outcome.created + outcome.updated} Klassen übernommen.`)
    } catch (error) {
      console.error(error)
      toast.error(importErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPasted('')
    setTaken(null)
    setKept(new Set())
    setResult(null)
    setStep('source')
  }

  return (
    <>
      <BackLink to="/einstellungen" label="Einstellungen" />
      <PageHeader
        title="Themen der AP-Klasse importieren"
        subtitle="Die Lektionen eines Monats aus «Für eine starke Jugend»"
      />
      <ImportNav />

      {step === 'source' && (
        <PasteCard
          title="Monatsseite einfügen"
          description={
            <>
              Auf <strong>churchofjesuschrist.org</strong> das Heft{' '}
              <strong>«Für eine starke Jugend»</strong> für den gewünschten Monat öffnen, die Seite
              markieren (Strg bzw. Cmd + A), kopieren und hier einfügen. Menü, Artikel und Fusszeile
              dürfen mitkommen – gelesen werden nur die Abschnitte «Lektionen am Sonntag».
            </>
          }
          placeholder="Hier einfügen."
          value={pasted}
          onChange={setPasted}
          onSubmit={() => {
            if (parsed.length === 0) return
            setTaken(parsed)
            setKept(new Set())
            setStep('preview')
          }}
          canSubmit={parsed.length > 0}
          status={
            !pasted.trim() ? (
              <p className="hint mt-0">Noch nichts eingefügt.</p>
            ) : parsed.length === 0 ? (
              <Warning>
                Kein Monat und keine Lektion erkannt. Erwartet wird die Seite eines Hefts von «Für
                eine starke Jugend» samt dem Abschnitt «Lektionen am Sonntag».
              </Warning>
            ) : (
              <div className="space-y-1 text-sm text-emerald-700 dark:text-emerald-400">
                {parsed.map((month) => (
                  <p key={month.month}>
                    <span className="font-medium">
                      {monthLabel(month.month)} · {month.lessons.length} von 4 Lektionen erkannt
                    </span>
                    {month.intro ? (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {month.intro}
                      </span>
                    ) : (
                      <span className="block text-xs text-amber-700 dark:text-amber-400">
                        Thema des Monats nicht erkannt
                      </span>
                    )}
                  </p>
                ))}
              </div>
            )
          }
          hint={
            <ImportHint title="Was beim Import passiert">
              <p>
                Die vier Lektionen gehen der Reihe nach an den <strong>ersten bis vierten</strong>{' '}
                Sonntag des Monats. Hat ein Monat fünf, bleibt der letzte vorerst frei. Für die
                vierte Lektion gilt die Fassung der{' '}
                <strong>Kollegien des Aaronischen Priestertums</strong>, nicht die der Jungen Damen.
                Bringt ein Heft mehrere Monate mit – das vom Oktober etwa auch den November –,
                kommen alle mit.
              </p>
              <p className="mt-2">
                Jede Klasse heisst <strong>«Thema des Monats – Thema der Woche»</strong>, etwa «Dein
                Körper ist heilig – Erfahre mehr über das Wort der Weisheit».
              </p>
              <p className="mt-2">
                Sonntage, an denen noch keine Klasse im Plan steht, werden angelegt – mit der festen
                Stunde und dem Titel. Bestehende Klassen behalten Zeit, Treffpunkt und
                Zuständigkeit; geändert wird nur der Titel. Steht dort schon ein anderer, lässt sich
                in der Vorschau für jeden Sonntag wählen, ob er überschrieben wird.
              </p>
            </ImportHint>
          }
        />
      )}

      {step === 'preview' && months.length > 0 && (
        <>
          <div className="card mb-4 space-y-3 p-4">
            {months.map((month) => {
              const classes = rows.filter((row) => row.date.startsWith(month.month)).length
              const hours = apClassHours(`${month.month}-01`)
              return (
                <div key={month.month}>
                  <p className="text-sm">
                    <strong>{monthLabel(month.month)}</strong> · {classes}{' '}
                    {classes === 1 ? 'Klasse' : 'Klassen'} · {hours.start} bis {hours.end} Uhr
                  </p>
                  {month.intro ? (
                    <p className="hint">
                      Thema des Monats: <strong>{month.intro}</strong>
                    </p>
                  ) : (
                    <Warning className="mt-1">
                      Das Thema des Monats wurde nicht erkannt – die Titel bestehen nur aus der
                      Lektion.
                    </Warning>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <SummaryTile
              value={counts.created}
              label="neu angelegt"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile value={counts.updated} label="Thema gesetzt" />
            <SummaryTile value={counts.unchanged} label="unverändert" className="text-slate-400" />
          </div>

          {withoutClass.length > 0 && (
            <Warning className="mb-4">
              {withoutClass.length === 1
                ? 'Eine Lektion fällt auf einen Sonntag ohne Klasse und wird'
                : `${withoutClass.length} Lektionen fallen auf Sonntage ohne Klasse und werden`}{' '}
              nicht übernommen: {withoutClass.map(lessonWithoutClassLabel).join(', ')}.
            </Warning>
          )}

          {replaceable.length > 0 && (
            <div className="card mb-4 flex flex-wrap items-center justify-between gap-2 p-4">
              <p className="text-sm">
                {replaceable.length === 1
                  ? 'Eine Klasse hat'
                  : `${replaceable.length} Klassen haben`}{' '}
                schon einen anderen Titel.{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  Überschrieben wird, was angehakt ist.
                </span>
              </p>
              {replaceable.length > 1 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setKept(new Set())}
                    disabled={replaceable.every((row) => !kept.has(row.date))}
                  >
                    Alle überschreiben
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setKept(new Set(replaceable.map((row) => row.date)))}
                    disabled={replaceable.every((row) => kept.has(row.date))}
                  >
                    Alle behalten
                  </button>
                </div>
              )}
            </div>
          )}

          <PreviewTable columns={['Sonntag', 'Lektion', 'Thema', '']} total={rows.length}>
            {rows.map((row) => {
              const overwrite = row.action === 'replace' && !kept.has(row.date)
              return (
                <tr key={row.date}>
                  <td className="tabular w-28 px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {formatDayShort(fromIsoDate(row.date))}
                  </td>
                  <td className="w-36 px-3 py-2 text-slate-500 dark:text-slate-400">
                    {row.slot ? AP_LESSON_SLOT_LABELS[row.slot] : '–'}
                  </td>
                  <td className="px-3 py-2">
                    <TopicCell row={row} overwrite={overwrite} />
                  </td>
                  <td className="w-32 px-3 py-2 text-xs whitespace-nowrap">
                    <RowStatus
                      row={row}
                      overwrite={overwrite}
                      onToggle={(next) => setOverwrite(row.date, next)}
                    />
                  </td>
                </tr>
              )
            })}
          </PreviewTable>

          <StepButtons
            onBack={() => setStep('source')}
            onStart={() => void start()}
            busy={busy}
            label={
              writes.length === 0
                ? 'Nichts zu übernehmen'
                : `${writes.length} ${writes.length === 1 ? 'Klasse' : 'Klassen'} übernehmen`
            }
            disabled={writes.length === 0}
          />
        </>
      )}

      {step === 'done' && result !== null && (
        <DoneCard
          summary={`${result.created} Klassen angelegt, bei ${result.updated} das Thema gesetzt`}
          onReset={reset}
          onLeave={() => navigate('/ap')}
          leaveLabel="Zum Aktivitätenplan"
          resetLabel="Weiteren Monat importieren"
        />
      )}
    </>
  )
}

/**
 * Das Thema eines Sonntags – und, wo eines ersetzt wird, das andere
 * durchgestrichen darunter: Was danach im Plan steht, steht oben.
 */
function TopicCell({ row, overwrite }: { row: PreviewRow; overwrite: boolean }) {
  const open = <span className="text-slate-400 italic">Thema noch offen</span>

  if (row.action === 'keep') return row.before || open
  if (row.action !== 'replace') return row.title || open

  const [stays, goes] = overwrite ? [row.title, row.before] : [row.before, row.title]
  return (
    <>
      {stays}
      <span className="block text-xs text-slate-400 line-through">{goes}</span>
    </>
  )
}

function RowStatus({
  row,
  overwrite,
  onToggle,
}: {
  row: PreviewRow
  overwrite: boolean
  onToggle: (next: boolean) => void
}) {
  switch (row.action) {
    case 'create':
      return <span className="text-emerald-700 dark:text-emerald-400">wird angelegt</span>
    case 'set':
      return <span className="text-slate-500 dark:text-slate-400">wird gesetzt</span>
    case 'replace':
      return (
        <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="size-4 rounded"
            checked={overwrite}
            onChange={(event) => onToggle(event.target.checked)}
            aria-label={`Thema am ${formatDayShort(fromIsoDate(row.date))} überschreiben`}
          />
          überschreiben
        </label>
      )
    case 'same':
      return <span className="text-slate-400">steht schon so</span>
    case 'keep':
      return <span className="text-slate-400">bleibt</span>
  }
}
