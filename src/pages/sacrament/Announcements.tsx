import { useEffect, useState, type FormEvent } from 'react'
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Megaphone,
  Pencil,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { EmptyState } from '@/components/ui/Feedback'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { useAutoDraft } from '@/components/sacrament/useDraft'
import { useSundayAnnouncements } from '@/hooks/useAnnouncements'
import { cn, uid } from '@/lib/utils'
import { formatDate } from '@/lib/dates'
import { isSeriesEntry, seriesAppliesTo } from '@/lib/series'
import {
  moveInList,
  newAnnouncement,
  replaceInList,
  saveSacramentMeeting,
} from '@/services/sacrament'
import {
  createSeries,
  deleteSeries,
  endSeries,
  skipSunday,
  updateSeries,
  type SeriesInput,
} from '@/services/announcementSeries'
import { CLEANING_DEFAULT_TEXT, CLEANING_PLACEHOLDERS } from '@/services/importCleaning'
import {
  SERIES_RHYTHM_LABELS,
  SERIES_WEEK_LABELS,
  type AnnouncementEntry,
  type AnnouncementSeries,
  type SeriesRhythm,
  type SeriesSource,
} from '@/lib/types'

/**
 * Bekanntmachungen für einen Sonntag.
 *
 * Das Handbuch verlangt, sie auf ein Minimum zu beschränken – deshalb steht
 * die Zahl der Einträge gut sichtbar oben. Die Reihenfolge ist die, in der sie
 * am Pult vorgelesen werden, und erscheint genauso unter «Leitung».
 *
 * Zwei Arten stehen nebeneinander. Die **erfassten** gelten für diesen einen
 * Sonntag und werden laufend gespeichert: kurz nach dem letzten Tastendruck
 * und spätestens beim Verlassen der Seite. Die **wiederkehrenden** gehören
 * einer Serie – «jeden 3. Sonntag im Monat» – und werden bei jedem Aufruf
 * dazugerechnet, statt in den Sonntag geschrieben zu werden. Sie stehen
 * hinten, tragen ein Kennzeichen und lassen sich für diesen Sonntag
 * anpassen oder streichen, ohne die Serie anzutasten.
 */
export function Announcements() {
  const { date, dateKey, meeting } = useSacrament()
  const { profile } = useAuth()
  const toast = useToast()

  const draft = useAutoDraft<AnnouncementEntry[]>(
    meeting?.announcements ?? [],
    (value) => saveSacramentMeeting(date, { announcements: value }),
    { onError: () => toast.error('Speichern fehlgeschlagen.') },
  )

  const entries = draft.value
  const change = draft.set

  const { entries: combined, series, resolve } = useSundayAnnouncements(dateKey, entries)
  const generated = combined.filter(isSeriesEntry)

  const [formOpen, setFormOpen] = useState(false)
  const [editSeries, setEditSeries] = useState<AnnouncementSeries | null>(null)
  const [removeSeries, setRemoveSeries] = useState<AnnouncementSeries | null>(null)

  /**
   * Eine Serie an diesem Sonntag von Hand übernehmen.
   *
   * Sie wird zu einem gewöhnlichen Eintrag: Er trägt die Serien-ID, tritt
   * damit an ihre Stelle und lässt sich frei ändern und verschieben. Die
   * Serie selbst bleibt unberührt und erscheint an allen anderen Sonntagen
   * weiter – wer nur diesen einen anders formulieren will, soll dafür nicht
   * die ganze Serie umschreiben müssen.
   */
  const detach = (entry: AnnouncementEntry) => {
    if (!entry.seriesId) return
    change([
      ...entries,
      { id: uid(), text: entry.text, details: entry.details ?? '', seriesId: entry.seriesId },
    ])
    toast.success('Für diesen Sonntag übernommen – die Serie bleibt bestehen.')
  }

  /*
   * Löschen ohne Rückfrage, aber mit Reue: «Rückgängig» in der Meldung stellt
   * den Stand von unmittelbar vor dem Löschen wieder her.
   */
  const remove = (entry: AnnouncementEntry) => {
    const before = entries
    change(entries.filter((e) => e.id !== entry.id))
    toast.undo('Bekanntmachung entfernt.', () => change(before))
  }

  const count = combined.filter((entry) => entry.text.trim()).length

  return (
    <>
      <SectionHeader
        title="Bekanntmachungen"
        description={
          count === 0
            ? undefined
            : `${count} Eintrag${count === 1 ? '' : 'e'}${
                generated.length > 0 ? ` · davon ${generated.length} wiederkehrend` : ''
              }`
        }
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(true)}>
              <Repeat className="size-4" aria-hidden />
              Wiederkehrend
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => change([...entries, newAnnouncement()])}
            >
              <Plus className="size-4" aria-hidden />
              Bekanntmachung
            </button>
          </>
        }
      />

      {draft.conflict && <ConflictNotice onDiscard={draft.reset} />}

      {combined.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Megaphone}
            title="Keine Bekanntmachungen"
            description="Vieles lässt sich auch schriftlich oder in anderen Versammlungen mitteilen."
            action={
              <button
                type="button"
                className="btn-primary"
                onClick={() => change([newAnnouncement()])}
              >
                <Plus className="size-4" aria-hidden />
                Erste Bekanntmachung
              </button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li key={entry.id} className="card p-3">
              <div className="flex items-start gap-2">
                <span className="tabular mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1 space-y-2">
                  {entry.seriesId && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Repeat className="size-3.5" aria-hidden />
                      Aus einer Serie übernommen – gilt nur für diesen Sonntag.
                    </p>
                  )}
                  {/* Ein Feld, nicht zwei. Was am Pult gesagt wird, steht
                      hier vollständig – mehrzeilig, wenn es mehrzeilig ist.
                      Der frühere Zusatz «Einzelheiten für die Person am
                      Pult» daneben verlangte eine Entscheidung, die niemand
                      treffen wollte: Gehört das Datum noch in den Wortlaut
                      oder schon darunter? */}
                  <textarea
                    className="input min-h-20 resize-y"
                    value={entry.text}
                    onChange={(event) =>
                      change(replaceInList(entries, { ...entry, text: event.target.value }))
                    }
                    placeholder="Bekanntmachung"
                    aria-label={`Bekanntmachung ${index + 1}`}
                  />
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="btn-ghost p-1.5"
                    onClick={() => change(moveInList(entries, index, -1))}
                    disabled={index === 0}
                    aria-label="Nach oben"
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost p-1.5"
                    onClick={() => change(moveInList(entries, index, 1))}
                    disabled={index === entries.length - 1}
                    aria-label="Nach unten"
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost p-1.5 text-rose-600 dark:text-rose-400"
                    onClick={() => remove(entry)}
                    aria-label="Entfernen"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}

          {generated.map((entry, index) => {
            const source = series.find((item) => item.id === entry.seriesId)
            return (
              <li
                key={entry.id}
                className="card border-brand-200 dark:border-brand-900 border-dashed p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="tabular mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                    {entries.length + index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-brand-700 dark:text-brand-300 flex items-center gap-1.5 text-xs font-medium">
                      <Repeat className="size-3.5" aria-hidden />
                      Wiederkehrend
                      {source && ` · ${rhythmLabel(source)}`}
                    </p>
                    <p className="mt-1 text-sm font-medium whitespace-pre-line">{entry.text}</p>
                    {entry.details?.trim() && (
                      <p className="mt-0.5 text-sm whitespace-pre-line text-slate-500 dark:text-slate-400">
                        {entry.details}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      className="btn-ghost p-1.5"
                      onClick={() => source && setEditSeries(source)}
                      aria-label="Serie bearbeiten"
                      title="Serie bearbeiten – wirkt auf alle Sonntage"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost p-1.5"
                      onClick={() => detach(entry)}
                      aria-label="Nur für diesen Sonntag anpassen"
                      title="Nur für diesen Sonntag anpassen"
                    >
                      <Sparkles className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost p-1.5 text-rose-600 dark:text-rose-400"
                      onClick={() => source && setRemoveSeries(source)}
                      aria-label="Entfernen"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <SeriesOverview
        series={series}
        dateKey={dateKey}
        resolve={resolve}
        onEdit={setEditSeries}
        onNew={() => setFormOpen(true)}
      />

      {draft.saving && (
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          Wird gespeichert …
        </p>
      )}

      <SeriesForm
        open={formOpen || Boolean(editSeries)}
        series={editSeries}
        defaultStart={dateKey}
        onClose={() => {
          setFormOpen(false)
          setEditSeries(null)
        }}
        onSave={async (input) => {
          if (editSeries) {
            const outcome = await updateSeries(editSeries.id, input)
            toast.saved('Serie aktualisiert.', outcome)
          } else {
            const outcome = await createSeries(input, profile?.id ?? null)
            toast.saved('Serie angelegt.', outcome)
          }
        }}
        onDelete={
          editSeries
            ? async () => {
                await deleteSeries(editSeries.id)
                toast.success('Serie gelöscht – auch aus vergangenen Sonntagen.')
              }
            : undefined
        }
      />

      <RemoveSeriesDialog
        series={removeSeries}
        dateKey={dateKey}
        // Der Wortlaut, wie er an diesem Sonntag zu hören wäre – nicht die
        // Vorlage mit ihren Platzhaltern. Wer löscht, soll wiedererkennen,
        // was er eben gelesen hat.
        label={removeSeries ? (resolve(removeSeries, dateKey)?.text ?? removeSeries.text) : ''}
        onClose={() => setRemoveSeries(null)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Übersicht der Serien                                                */
/* ------------------------------------------------------------------ */

/** «Jeden 3. Sonntag im Monat», «Jeden Sonntag» */
function rhythmLabel(series: AnnouncementSeries): string {
  if (series.rhythm === 'weekly') return 'Jeden Sonntag'
  const weeks = (series.weeks ?? [])
    .map((week) => SERIES_WEEK_LABELS.find(([value]) => value === week)?.[1] ?? `${week}. Sonntag`)
    .join(', ')
  return weeks ? `${weeks} im Monat` : 'Kein Sonntag gewählt'
}

/**
 * Alle Serien auf einen Blick – auch die, die an diesem Sonntag ruhen.
 *
 * Ohne diese Liste wären sie unsichtbar, sobald sie einmal nicht fällig
 * sind: Wer im Februar eine Serie für den letzten Sonntag anlegt und im
 * März nachschaut, fände nichts und legte sie ein zweites Mal an.
 */
function SeriesOverview({
  series,
  dateKey,
  resolve,
  onEdit,
  onNew,
}: {
  series: AnnouncementSeries[]
  dateKey: string
  resolve: ReturnType<typeof useSundayAnnouncements>['resolve']
  onEdit: (series: AnnouncementSeries) => void
  onNew: () => void
}) {
  if (series.length === 0) return null

  return (
    <section className="mt-6">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        <CalendarClock className="size-3.5" aria-hidden />
        Wiederkehrende Bekanntmachungen ({series.length})
      </h3>

      <ul className="card divide-list overflow-hidden">
        {series.map((entry) => {
          const filled = resolve(entry, dateKey)
          const ended = entry.endDate && entry.endDate < dateKey
          const skipped = entry.skipDates?.includes(dateKey)
          const due = seriesAppliesTo(entry, dateKey)
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onEdit(entry)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Repeat className="size-4 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {filled?.text || entry.text || 'Ohne Text'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {rhythmLabel(entry)}
                    {entry.source === 'cleaning' && ' · aus dem Putzplan'}
                    {ended
                      ? ` · beendet am ${formatDate(new Date(`${entry.endDate}T12:00:00`))}`
                      : skipped
                        ? ' · an diesem Sonntag gestrichen'
                        : !due
                          ? ' · an diesem Sonntag nicht fällig'
                          : !filled
                            ? ' · für diesen Sonntag fehlen Angaben'
                            : ''}
                  </p>
                </div>
                <Pencil className="size-4 shrink-0 text-slate-300" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>

      <button type="button" className="btn-secondary btn-sm mt-2" onClick={onNew}>
        <Plus className="size-3.5" aria-hidden />
        Weitere Serie
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Löschen: nur dieser Sonntag oder alle künftigen                     */
/* ------------------------------------------------------------------ */

/**
 * Die Wahl beim Löschen.
 *
 * Sie ist der Grund, weshalb eine Serie nicht einfach ein Eintrag mit
 * einem Häkchen ist: «Diese Woche fällt sie aus» und «ab jetzt gar nicht
 * mehr» sind zwei verschiedene Dinge, und beide kommen vor. Vergangene
 * Sonntage bleiben in beiden Fällen, wie sie waren.
 */
function RemoveSeriesDialog({
  series,
  dateKey,
  label,
  onClose,
}: {
  series: AnnouncementSeries | null
  dateKey: string
  /** Der Wortlaut, wie er an diesem Sonntag lautet */
  label: string
  onClose: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = async (mode: 'one' | 'future') => {
    if (!series) return
    setBusy(true)
    try {
      if (mode === 'one') {
        await skipSunday(series, dateKey)
        toast.success('Nur an diesem Sonntag gestrichen.')
      } else {
        await endSeries(series, dateKey)
        toast.success('Serie beendet – vergangene Sonntage bleiben unverändert.')
      }
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Löschen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(series)}
      onClose={onClose}
      title="Wiederkehrende Bekanntmachung entfernen"
      size="sm"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
          Abbrechen
        </button>
      }
    >
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        «{label}» – was soll geschehen?
      </p>

      <div className="space-y-2">
        <button
          type="button"
          className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          onClick={() => void run('one')}
          disabled={busy}
        >
          <span className="block text-sm font-medium">Nur diesen Sonntag</span>
          <span className="hint mt-0.5 block">
            Am {formatDate(new Date(`${dateKey}T12:00:00`))} fällt sie aus, danach läuft die Serie
            weiter.
          </span>
        </button>

        <button
          type="button"
          className="w-full rounded-lg border border-rose-200 p-3 text-left transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950"
          onClick={() => void run('future')}
          disabled={busy}
        >
          <span className="block text-sm font-medium text-rose-700 dark:text-rose-300">
            Diesen und alle künftigen
          </span>
          <span className="hint mt-0.5 block">
            Die Serie endet. Vergangene Sonntage behalten die Bekanntmachung.
          </span>
        </button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Serie erfassen                                                      */
/* ------------------------------------------------------------------ */

const EMPTY_INPUT = (start: string): SeriesInput => ({
  text: '',
  details: '',
  rhythm: 'monthly',
  weeks: [3],
  startDate: start,
  endDate: null,
  source: 'manual',
})

function SeriesForm({
  open,
  series,
  defaultStart,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  series: AnnouncementSeries | null
  defaultStart: string
  onClose: () => void
  onSave: (input: SeriesInput) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<SeriesInput>(EMPTY_INPUT(defaultStart))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      series
        ? {
            text: series.text,
            details: series.details ?? '',
            rhythm: series.rhythm,
            weeks: series.weeks ?? [],
            startDate: series.startDate,
            endDate: series.endDate ?? null,
            source: series.source ?? 'manual',
          }
        : EMPTY_INPUT(defaultStart),
    )
  }, [open, series, defaultStart])

  const update = <K extends keyof SeriesInput>(key: K, value: SeriesInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const toggleWeek = (week: number) =>
    update(
      'weeks',
      form.weeks.includes(week)
        ? form.weeks.filter((value) => value !== week)
        : [...form.weeks, week].sort((a, b) => a - b),
    )

  /** Aus einer gewöhnlichen Serie eine Putzplan-Serie machen – und zurück. */
  const setSource = (source: SeriesSource) => {
    setForm((current) => ({
      ...current,
      source,
      text: source === 'cleaning' && !current.text.trim() ? CLEANING_DEFAULT_TEXT : current.text,
      // Der Putzplan wechselt jede Woche – die Serie gehört an jeden Sonntag.
      rhythm: source === 'cleaning' ? 'weekly' : current.rhythm,
    }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.text.trim()) {
      toast.error('Bitte gib den Wortlaut an.')
      return
    }
    if (form.rhythm === 'monthly' && form.weeks.length === 0) {
      toast.error('Bitte wähle mindestens einen Sonntag im Monat.')
      return
    }

    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={series ? 'Wiederkehrende Bekanntmachung' : 'Neue wiederkehrende Bekanntmachung'}
        size="lg"
        footer={
          <>
            {onDelete && (
              <button
                type="button"
                className="btn-ghost mr-auto text-rose-600 dark:text-rose-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                Ganz löschen
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Abbrechen
            </button>
            <button type="submit" form="series-form" className="btn-primary" disabled={saving}>
              Speichern
            </button>
          </>
        }
      >
        <form id="series-form" onSubmit={submit} className="space-y-4">
          <div>
            <span className="label">Was für eine Bekanntmachung?</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['manual', 'Fester Wortlaut'],
                  ['cleaning', 'Aus dem Putzplan'],
                ] as [SeriesSource, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSource(value)}
                  aria-pressed={form.source === value}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                    form.source === value
                      ? 'border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">
              «Aus dem Putzplan» setzt Gruppe und Namen für jeden Sonntag selbst ein – der Dank an
              die vergangene Woche und die Ankündigung der neuen.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="series-text">
              Wortlaut
            </label>
            <textarea
              id="series-text"
              className="input min-h-20 resize-y"
              value={form.text}
              onChange={(event) => update('text', event.target.value)}
              required
            />
            {form.source === 'cleaning' && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">
                  Platzhalter – sie werden je Sonntag gefüllt:
                </p>
                <ul className="space-y-0.5 text-slate-500 dark:text-slate-400">
                  {CLEANING_PLACEHOLDERS.map(([token, label]) => (
                    <li key={token}>
                      <code className="rounded bg-white px-1 py-0.5 dark:bg-slate-900">
                        {token}
                      </code>{' '}
                      – {label}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  Findet der Putzplan zu einem Platzhalter nichts, bleibt die Bekanntmachung an
                  diesem Sonntag weg.
                </p>
              </div>
            )}
          </div>

          <div>
            <span className="label">Wie oft?</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SERIES_RHYTHM_LABELS) as SeriesRhythm[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('rhythm', value)}
                  aria-pressed={form.rhythm === value}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                    form.rhythm === value
                      ? 'border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300',
                  )}
                >
                  {SERIES_RHYTHM_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          {form.rhythm === 'monthly' && (
            <div>
              <span className="label">Welche Sonntage im Monat?</span>
              <div className="flex flex-wrap gap-2">
                {SERIES_WEEK_LABELS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleWeek(value)}
                    aria-pressed={form.weeks.includes(value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                      form.weeks.includes(value)
                        ? 'border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="hint">
                Gezählt wird im Kalender: Der 3. Sonntag ist der dritte Sonntag dieses Monats, ganz
                gleich, auf welchen Wochentag der Monatsanfang fällt.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="series-start">
                Ab
              </label>
              <input
                id="series-start"
                type="date"
                className="input"
                value={form.startDate}
                onChange={(event) => update('startDate', event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="series-end">
                Bis (optional)
              </label>
              <input
                id="series-end"
                type="date"
                className="input"
                value={form.endDate ?? ''}
                onChange={(event) => update('endDate', event.target.value || null)}
              />
              <p className="hint">Leer heisst: läuft weiter, bis sie jemand beendet.</p>
            </div>
          </div>

          {series && (series.skipDates?.length ?? 0) > 0 && (
            <p className="hint">
              Gestrichene Sonntage:{' '}
              {series.skipDates.map((key) => formatDate(new Date(`${key}T12:00:00`))).join(' · ')}
            </p>
          )}
        </form>
      </Modal>

      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            void onDelete()
              .then(onClose)
              .catch((error: unknown) => {
                console.error(error)
                toast.error('Serie konnte nicht gelöscht werden.')
              })
          }}
          title="Serie ganz löschen?"
          message="Die Bekanntmachung verschwindet auch aus vergangenen Sonntagen. Soll sie bloss nicht mehr kommen, ist «Bis» das mildere Mittel."
          confirmLabel="Löschen"
          danger
        />
      )}
    </>
  )
}
