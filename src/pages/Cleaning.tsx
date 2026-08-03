import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Brush, CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useCleaningWeeks } from '@/hooks/useFirestore'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { formatDateLong, toDateInput } from '@/lib/dates'
import { cn, matchesSearch } from '@/lib/utils'
import { deleteCleaningWeek, saveCleaningWeek } from '@/services/cleaning'
import { cleaningAround } from '@/services/importCleaning'
import { fromIsoDate } from '@/services/importHistory'
import type { CleaningWeek } from '@/lib/types'

type Scope = 'upcoming' | 'past' | 'all'

/**
 * Der Putzplan der Gemeinde.
 *
 * Er entsteht zweimal im Jahr als Excel-Tabelle und wird unter
 * «Einstellungen › Importe» eingelesen. Hier steht er zum Nachschauen –
 * und als Grundlage für die wiederkehrende Bekanntmachung, die am Sonntag
 * dem einen Team dankt und das nächste ankündigt.
 *
 * Einzelne Wochen lassen sich von Hand ändern: Wer kurzfristig tauscht,
 * soll dafür nicht die ganze Tabelle neu einlesen müssen. Ein späterer
 * Import derselben Woche überschreibt die Korrektur allerdings wieder –
 * die Tabelle bleibt die Quelle.
 */
export function Cleaning() {
  const { data: weeks, loading } = useCleaningWeeks()
  const [scope, setScope] = useState<Scope>('upcoming')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editWeek, setEditWeek] = useState<CleaningWeek | null>(null)

  const today = toDateInput(new Date())

  const counts = useMemo(
    () => ({
      upcoming: weeks.filter((week) => week.endDate >= today).length,
      past: weeks.filter((week) => week.endDate < today).length,
      all: weeks.length,
    }),
    [weeks, today],
  )

  const visible = useMemo(() => {
    let result = weeks
    if (scope === 'upcoming') result = result.filter((week) => week.endDate >= today)
    // Vergangenes andersherum: Das zuletzt Gewesene interessiert zuerst.
    else if (scope === 'past') {
      result = [...result].filter((week) => week.endDate < today).reverse()
    }
    if (search.trim()) {
      result = result.filter((week) => matchesSearch(`${week.group} ${week.team}`, search))
    }
    return result
  }, [weeks, scope, search, today])

  /** Die Woche, in der heute liegt – sie steht hervorgehoben in der Liste. */
  const currentId = useMemo(
    () => weeks.find((week) => week.startDate <= today && today <= week.endDate)?.id ?? null,
    [weeks, today],
  )

  return (
    <>
      <PageHeader
        title="Putzplan"
        subtitle={
          weeks.length === 0
            ? 'Noch nichts eingelesen'
            : `${weeks.length} Wochen · ${counts.upcoming} noch bevorstehend`
        }
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditWeek(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Woche</span>
          </button>
        }
      />

      <NextSunday weeks={weeks} />

      <div className="mb-4 space-y-3">
        <input
          type="search"
          className="input"
          placeholder="Gruppe oder Namen suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: 'Kommend', count: counts.upcoming },
            { value: 'past', label: 'Vergangen', count: counts.past },
            { value: 'all', label: 'Alle', count: counts.all },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Brush}
            title={weeks.length === 0 ? 'Noch kein Putzplan' : 'Nichts gefunden'}
            description={
              weeks.length === 0
                ? 'Die Tabelle der Gemeinde lässt sich unter «Einstellungen › Importe › Putzplan» einlesen. Einzelne Wochen können auch von Hand erfasst werden.'
                : 'Passe Suche oder Auswahl an.'
            }
            action={
              weeks.length === 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setEditWeek(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Woche erfassen
                </button>
              )
            }
          />
        </div>
      ) : (
        <ul className="card divide-list overflow-hidden">
          {visible.map((week) => (
            <li key={week.id}>
              <button
                type="button"
                onClick={() => {
                  setEditWeek(week)
                  setFormOpen(true)
                }}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60',
                  week.id === currentId && 'bg-brand-50/60 dark:bg-brand-950/40',
                )}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold',
                    week.id === currentId
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  {week.group.replace(/[^\d]/g, '') || '–'}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{week.team}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {week.group && `${week.group} · `}
                    {period(week)}
                    {week.note?.trim() && ` · ${week.note.trim()}`}
                    {week.id === currentId && ' · diese Woche'}
                  </p>
                </div>

                <Pencil className="size-4 shrink-0 text-slate-300" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <WeekForm
        open={formOpen}
        week={editWeek}
        onClose={() => {
          setFormOpen(false)
          setEditWeek(null)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

/** «Mo, 29.06. – Sa, 04.07.2026» kurz gehalten: «29.06.2026 – 04.07.2026» */
function period(week: Pick<CleaningWeek, 'startDate' | 'endDate'>): string {
  const [, startMonth, startDay] = week.startDate.split('-')
  const [endYear, endMonth, endDay] = week.endDate.split('-')
  return `${startDay}.${startMonth}. – ${endDay}.${endMonth}.${endYear}`
}

/* ------------------------------------------------------------------ */

/**
 * Was am nächsten Sonntag zu sagen wäre.
 *
 * Genau diese zwei Zeilen füllt die wiederkehrende Bekanntmachung. Sie
 * hier zu zeigen macht den Zusammenhang sichtbar – und eine Lücke im Plan
 * fällt auf, bevor sie am Sonntag auffällt.
 */
function NextSunday({ weeks }: { weeks: CleaningWeek[] }) {
  const sundayKey = useMemo(() => {
    const today = new Date()
    const next = new Date(today)
    // 0 = Sonntag. Ist heute Sonntag, gilt heute.
    next.setDate(today.getDate() + ((7 - today.getDay()) % 7))
    return toDateInput(next)
  }, [])

  const { previous, next } = cleaningAround(weeks, sundayKey)
  if (weeks.length === 0) return null

  return (
    <div className="card mb-4 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <CalendarRange className="size-4 text-slate-400" aria-hidden />
        {formatDateLong(fromIsoDate(sundayKey))}
      </h2>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            Dank an die vergangene Woche
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {previous ? `${previous.team}${previous.group ? ` (${previous.group})` : ''}` : '—'}
          </dd>
          {previous && <dd className="hint mt-0">{period(previous)}</dd>}
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Kommende Woche</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {next ? `${next.team}${next.group ? ` (${next.group})` : ''}` : '—'}
          </dd>
          {next && <dd className="hint mt-0">{period(next)}</dd>}
        </div>
      </dl>

      {(!previous || !next) && (
        <p className="hint mt-2">
          Wo nichts steht, reicht der Plan nicht so weit. Die wiederkehrende Bekanntmachung bleibt
          an solchen Sonntagen weg, statt eine Lücke vorzulesen.
        </p>
      )}

      <p className="hint mt-3">
        Diese beiden Zeilen füllen die wiederkehrende Bekanntmachung «Aus dem Putzplan». Einrichten
        lässt sie sich unter{' '}
        <Link
          to={`/abendmahl/bekanntmachungen?sonntag=${sundayKey}`}
          className="text-brand-600 dark:text-brand-300 hover:underline"
        >
          Abendmahlsversammlung › Bekanntmachungen
        </Link>
        .
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface FormState {
  startDate: string
  endDate: string
  group: string
  team: string
  note: string
}

const EMPTY: FormState = { startDate: '', endDate: '', group: '', team: '', note: '' }

function WeekForm({
  open,
  week,
  onClose,
}: {
  open: boolean
  week: CleaningWeek | null
  onClose: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      week
        ? {
            startDate: week.startDate,
            endDate: week.endDate,
            group: week.group,
            team: week.team,
            note: week.note ?? '',
          }
        : EMPTY,
    )
  }, [open, week])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.startDate || !form.endDate) {
      toast.error('Bitte gib Anfang und Ende der Woche an.')
      return
    }
    if (form.endDate < form.startDate) {
      toast.error('Das Ende der Woche liegt vor ihrem Anfang.')
      return
    }
    if (!form.team.trim()) {
      toast.error('Bitte gib das Putzteam an.')
      return
    }

    setSaving(true)
    try {
      /*
       * Die Dokument-ID ist der erste Tag der Woche. Wird er verschoben,
       * entstünde beim blossen Speichern ein zweiter Eintrag – deshalb
       * fällt der alte weg.
       */
      if (week && week.startDate !== form.startDate) await deleteCleaningWeek(week.id)

      const outcome = await saveCleaningWeek({
        startDate: form.startDate,
        endDate: form.endDate,
        group: form.group.trim(),
        team: form.team.trim(),
        note: form.note.trim(),
      })
      toast.saved('Putzwoche gespeichert.', outcome)
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
        title={week ? 'Putzwoche bearbeiten' : 'Putzwoche erfassen'}
        footer={
          <>
            {week && (
              <button
                type="button"
                className="btn-ghost mr-auto text-rose-600 dark:text-rose-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                Löschen
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Abbrechen
            </button>
            <button type="submit" form="week-form" className="btn-primary" disabled={saving}>
              Speichern
            </button>
          </>
        }
      >
        <form id="week-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="w-start">
                Von
              </label>
              <input
                id="w-start"
                type="date"
                className="input"
                value={form.startDate}
                onChange={(event) => update('startDate', event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="w-end">
                Bis
              </label>
              <input
                id="w-end"
                type="date"
                className="input"
                value={form.endDate}
                onChange={(event) => update('endDate', event.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="w-team">
              Putzteam
            </label>
            <input
              id="w-team"
              className="input"
              value={form.team}
              onChange={(event) => update('team', event.target.value)}
              placeholder="z. B. «Muster Hans & Anna»"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="w-group">
                Gruppe
              </label>
              <input
                id="w-group"
                className="input"
                value={form.group}
                onChange={(event) => update('group', event.target.value)}
                placeholder="z. B. «Gruppe 3»"
              />
            </div>
            <div>
              <label className="label" htmlFor="w-note">
                Bemerkung
              </label>
              <input
                id="w-note"
                className="input"
                value={form.note}
                onChange={(event) => update('note', event.target.value)}
                placeholder="z. B. «Generalkonf.»"
              />
            </div>
          </div>

          <p className="hint">
            Die Woche läuft von Montag bis Samstag. Der Sonntag dazwischen ist der Tag, an dem
            gedankt und angekündigt wird.
          </p>
        </form>
      </Modal>

      {week && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteCleaningWeek(week.id).then(() => {
              toast.success('Putzwoche entfernt.')
              onClose()
            })
          }}
          title="Putzwoche löschen?"
          message={`Die Woche ${period(week)} mit ${week.team} wird entfernt.`}
          confirmLabel="Löschen"
          danger
        />
      )}
    </>
  )
}
