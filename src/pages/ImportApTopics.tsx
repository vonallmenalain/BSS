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
  apTopicRows,
  parsePastedApTopics,
  type ParsedApTopics,
} from '@/services/importApTopics'
import { apClassHours } from '@/lib/types'

/**
 * Die Themen der AP-Klasse übernehmen.
 *
 * Seit September 2026 ist die Klasse wöchentlich, und ihre Themen sind
 * vorgegeben: «Für eine starke Jugend» gibt für jeden Monat vier Lektionen
 * heraus – für den ersten bis vierten Sonntag. Sie von Hand abzutippen
 * hiesse, jeden Monat viermal denselben Satz aus dem Browser in den Plan zu
 * übertragen.
 *
 * Der Import macht daraus einen Handgriff: Seite kopieren, einfügen,
 * Vorschau prüfen, übernehmen. Er ist damit der einzige Import, der
 * **monatlich** gebraucht wird, und steht deshalb bei den Aktivitäten AP,
 * nicht hinten bei den einmaligen.
 *
 * **Er legt die Klassen gleich mit an.** Wer im September beginnt, hat für
 * die kommenden Sonntage noch gar keine Termine – und einer, der stattfindet
 * und ein Thema hat, fehlt sonst zweimal. Sonntage, für die das Heft kein
 * Thema vorsieht – der fünfte in einem Monat, der einen hat –, entstehen
 * ebenso, nur eben mit «Thema noch offen».
 */

type Step = 'source' | 'preview' | 'done'

export function ImportApTopics() {
  const { profile } = useAuth()
  const { data: activities } = useApActivities()
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('source')
  const [pasted, setPasted] = useState('')
  const [taken, setTaken] = useState<ParsedApTopics | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null)

  const parsed = useMemo(() => (pasted.trim() ? parsePastedApTopics(pasted) : null), [pasted])

  /**
   * Was geschrieben würde – Thema für Thema, mit dem, was schon dasteht.
   *
   * Die bestehende Klasse eines Sonntags wird gesucht und nicht bloss
   * gezählt: Ihre ID entscheidet darüber, ob der Import ändert oder anlegt.
   * Ein Anlass anderer Art am selben Sonntag – ein Jugendrat etwa – zählt
   * dabei nicht als Klasse; beide dürfen nebeneinander im Plan stehen.
   */
  const rows = useMemo(() => {
    const source = taken ?? parsed
    if (!source) return []

    const classes = new Map(
      activities
        .filter((activity) => activity.kind === 'class')
        .map((activity) => [activity.date, activity]),
    )

    return apTopicRows(source).map((row) => {
      const existing = classes.get(row.date) ?? null
      return {
        ...row,
        id: existing?.id ?? null,
        before: existing?.title.trim() ?? '',
      }
    })
  }, [taken, parsed, activities])

  const counts = useMemo(
    () => ({
      created: rows.filter((row) => !row.id).length,
      updated: rows.filter((row) => row.id && row.topic).length,
      open: rows.filter((row) => !row.topic).length,
    }),
    [rows],
  )

  /** Themen, für die dieser Monat gar keinen Klassensonntag hat. */
  const unused = useMemo(() => {
    const source = taken ?? parsed
    if (!source) return []
    const used = new Set(rows.filter((row) => row.topic).map((row) => row.slot))
    return source.lessons.filter((lesson) => !used.has(lesson.slot))
  }, [taken, parsed, rows])

  const start = async () => {
    if (rows.length === 0) return
    setBusy(true)
    try {
      const writes: ApTopicWrite[] = rows.map((row) => ({
        date: row.date,
        title: row.topic,
        id: row.id,
      }))
      const outcome = await importApTopics(writes, profile?.id ?? null)
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
    setResult(null)
    setStep('source')
  }

  const month = taken ?? parsed

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
              dürfen mitkommen – gelesen wird nur der Abschnitt «Lektionen am Sonntag».
            </>
          }
          placeholder="Hier einfügen."
          value={pasted}
          onChange={setPasted}
          onSubmit={() => {
            if (!parsed) return
            setTaken(parsed)
            setStep('preview')
          }}
          canSubmit={Boolean(parsed)}
          status={
            !pasted.trim() ? (
              <p className="hint mt-0">Noch nichts eingefügt.</p>
            ) : !parsed ? (
              <Warning>
                Kein Monat und keine Lektion erkannt. Erwartet wird die Monatsseite von «Für eine
                starke Jugend» samt dem Abschnitt «Lektionen am Sonntag».
              </Warning>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">
                  {formatMonth(fromIsoDate(`${parsed.month}-01`))} · {parsed.lessons.length} von 4
                  Lektionen erkannt
                </span>
                {parsed.intro && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {parsed.intro}
                  </span>
                )}
              </p>
            )
          }
          hint={
            <ImportHint title="Was beim Import passiert">
              <p>
                Die vier Lektionen gehen der Reihe nach an den <strong>ersten bis vierten</strong>{' '}
                Sonntag des Monats. Hat ein Monat fünf, bleibt der letzte vorerst frei. Für die
                vierte Lektion gilt die Fassung der{' '}
                <strong>Kollegien des Aaronischen Priestertums</strong>, nicht die der Jungen Damen.
              </p>
              <p className="mt-2">
                Sonntage, an denen noch keine Klasse im Plan steht, werden angelegt – mit der festen
                Stunde und dem Thema. Bestehende Klassen behalten Zeit, Treffpunkt und
                Zuständigkeit; geändert wird nur der Titel, und nur dort, wo das Heft ein Thema
                vorgibt.
              </p>
            </ImportHint>
          }
        />
      )}

      {step === 'preview' && month && (
        <>
          <div className="card mb-4 p-4">
            <p className="text-sm">
              <strong>{formatMonth(fromIsoDate(`${month.month}-01`))}</strong> · {rows.length}{' '}
              {rows.length === 1 ? 'Klasse' : 'Klassen'} ·{' '}
              {apClassHours(rows[0]?.date ?? `${month.month}-01`).start} bis{' '}
              {apClassHours(rows[0]?.date ?? `${month.month}-01`).end} Uhr
            </p>
            {month.intro && (
              <p className="hint">
                Thema des Monats: <strong>{month.intro}</strong>
              </p>
            )}
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <SummaryTile
              value={counts.created}
              label="neu angelegt"
              className="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryTile value={counts.updated} label="Thema gesetzt" />
            <SummaryTile value={counts.open} label="ohne Thema" className="text-slate-400" />
          </div>

          {unused.length > 0 && (
            <Warning className="mb-4">
              {unused.length === 1 ? 'Eine Lektion passt' : `${unused.length} Lektionen passen`} in
              diesem Monat auf keinen Klassensonntag:{' '}
              {unused.map((lesson) => AP_LESSON_SLOT_LABELS[lesson.slot]).join(', ')}. Vor September
              2026 war die Klasse nur am 2. und 4. Sonntag.
            </Warning>
          )}

          <PreviewTable columns={['Sonntag', 'Lektion', 'Thema', '']} total={rows.length}>
            {rows.map((row) => (
              <tr key={row.date}>
                <td className="tabular w-28 px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {formatDayShort(fromIsoDate(row.date))}
                </td>
                <td className="w-36 px-3 py-2 text-slate-500 dark:text-slate-400">
                  {row.slot ? AP_LESSON_SLOT_LABELS[row.slot] : '–'}
                </td>
                <td className="px-3 py-2">
                  {row.topic || <span className="text-slate-400 italic">Thema noch offen</span>}
                  {row.before && row.topic && row.before !== row.topic && (
                    <span className="block text-xs text-slate-400 line-through">{row.before}</span>
                  )}
                </td>
                <td className="w-28 px-3 py-2 text-xs whitespace-nowrap">
                  {!row.id ? (
                    <span className="text-emerald-700 dark:text-emerald-400">wird angelegt</span>
                  ) : row.topic ? (
                    <span className="text-slate-500 dark:text-slate-400">wird gesetzt</span>
                  ) : (
                    <span className="text-slate-400">bleibt</span>
                  )}
                </td>
              </tr>
            ))}
          </PreviewTable>

          <StepButtons
            onBack={() => setStep('source')}
            onStart={() => void start()}
            busy={busy}
            label={`${rows.length} ${rows.length === 1 ? 'Klasse' : 'Klassen'} übernehmen`}
            disabled={rows.length === 0}
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
