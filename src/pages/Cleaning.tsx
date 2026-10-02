import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Brush, CalendarRange, FileDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useAllSacramentMeetings, useCleaningWeeks } from '@/hooks/useFirestore'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { OtherResults } from '@/components/ui/OtherResults'
import { PageHeader, SegmentedControl } from '@/components/ui/Pickers'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { formatDateLong, toDateInput } from '@/lib/dates'
import { cn, matchesSearch } from '@/lib/utils'
import { deleteCleaningWeek, saveCleaningWeek } from '@/services/cleaning'
import {
  CLEANING_PLAN_LABEL,
  cleaningPdf,
  cleaningPdfFilename,
  weeksInRange,
} from '@/services/cleaningPdf'
import { cleaningAround, cleaningNow } from '@/services/importCleaning'
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
 *
 * **Ohne Vollzugriff ist die Seite ein Anschlagbrett.** Sie steht unter
 * `/putzplan` für alle offen (siehe `PUBLIC_PATHS` in `App.tsx`) – der
 * QR-Code auf dem ausgedruckten Plan führt hierher. Wer kein Konto hat
 * oder nur den AP-Kalender bzw. die Assistenz, sieht oben gross, wer diese
 * Woche dran ist und wer nächste Woche, darunter Suche, Auswahl und Liste
 * wie gewohnt. Was ein Konto braucht, fehlt: Ändern, Export und die
 * Sonntagskarte der Leitung – wem am Sonntag gedankt wird, ist deren
 * Sache.
 */
export function Cleaning() {
  const { isApproved } = useAuth()
  const editable = isApproved
  const { data: weeks, loading, error } = useCleaningWeeks()
  const [scope, setScope] = useState<Scope>('upcoming')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editWeek, setEditWeek] = useState<CleaningWeek | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const today = toDateInput(new Date())

  /** Eine Woche zum Ändern öffnen – aus beiden Listen derselbe Weg. */
  const openWeek = (week: CleaningWeek) => {
    setEditWeek(week)
    setFormOpen(true)
  }

  const counts = useMemo(
    () => ({
      upcoming: weeks.filter((week) => week.endDate >= today).length,
      past: weeks.filter((week) => week.endDate < today).length,
      all: weeks.length,
    }),
    [weeks, today],
  )

  const searching = search.trim() !== ''

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

  /*
   * Was die Suche ausserhalb des gewählten Zeitraums findet.
   *
   * «Kommend» sagt, welchen Teil des Plans man liest; die Suche fragt nach
   * einer Gruppe oder einem Namen. Wer nachschaut, wann die Familie Meier
   * dran ist, und nichts findet, soll lesen, dass sie im März dran **war** –
   * statt erst auf «Alle» umzustellen, um es zu erfahren.
   *
   * Das Vergangene rückwärts, wie unter «Vergangen»: Das zuletzt Gewesene
   * interessiert zuerst.
   */
  const otherHits = useMemo(() => {
    if (!searching) return []
    const shown = new Set(visible.map((week) => week.id))
    const rest = weeks.filter(
      (week) => !shown.has(week.id) && matchesSearch(`${week.group} ${week.team}`, search),
    )
    // Steht oben das Kommende, ist das Übrige Vergangenheit – und die liest
    // sich von hinten.
    return scope === 'upcoming' ? [...rest].reverse() : rest
  }, [searching, visible, weeks, search, scope])

  /** Die Woche, in der heute liegt – sie steht hervorgehoben in der Liste. */
  const currentId = useMemo(
    () => weeks.find((week) => week.startDate <= today && today <= week.endDate)?.id ?? null,
    [weeks, today],
  )

  return (
    <>
      {/* Oben rechts steht nur der Export: Der Plan kommt zweimal im Jahr
          als Tabelle und wird eingelesen, nicht Woche für Woche erfasst. Wer
          eine einzelne korrigieren muss, tut das am Stift in der Zeile – und
          ganz ohne Plan führt der leere Zustand zum Formular. */}
      <PageHeader
        title="Putzplan"
        actions={
          editable &&
          weeks.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setExportOpen(true)}
              title="Den Putzplan als PDF zum Ausdrucken herunterladen"
            >
              <FileDown className="size-4" aria-hidden />
              Export
            </button>
          )
        }
      />

      {editable ? <NextSunday weeks={weeks} /> : <OnDuty weeks={weeks} today={today} />}

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
            title={
              error && weeks.length === 0
                ? 'Der Putzplan lässt sich gerade nicht laden'
                : weeks.length === 0
                  ? 'Noch kein Putzplan'
                  : 'Nichts gefunden'
            }
            description={
              error && weeks.length === 0
                ? 'Bitte versuche es später noch einmal.'
                : weeks.length > 0
                  ? 'Passe Suche oder Auswahl an.'
                  : editable
                    ? 'Die Tabelle der Gemeinde lässt sich unter «Einstellungen › Importe › Putzplan» einlesen. Einzelne Wochen können auch von Hand erfasst werden.'
                    : 'Sobald der Plan eingetragen ist, steht er hier.'
            }
            action={
              editable &&
              !error &&
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
        <WeekRows weeks={visible} currentId={currentId} onEdit={editable ? openWeek : undefined} />
      )}

      {/* Was ausserhalb des gewählten Zeitraums zur Suche passt – meist die
          Wochen, in denen dieselbe Gruppe schon einmal dran war. */}
      {!loading && searching && (
        <OtherResults
          items={otherHits}
          listKey={`${scope}|${search.trim()}`}
          pageSize={30}
          hint={
            scope === 'upcoming'
              ? 'Diese Wochen passen zur Suche, liegen aber in der Vergangenheit.'
              : scope === 'past'
                ? 'Diese Wochen passen zur Suche, liegen aber noch vor uns.'
                : 'Diese Wochen passen zur Suche, werden aber durch die Auswahl ausgeblendet.'
          }
        >
          {(page) => (
            <WeekRows weeks={page} currentId={currentId} onEdit={editable ? openWeek : undefined} />
          )}
        </OtherResults>
      )}

      {editable && (
        <WeekForm
          open={formOpen}
          week={editWeek}
          onClose={() => {
            setFormOpen(false)
            setEditWeek(null)
          }}
        />
      )}

      {/* Bei jedem Öffnen neu aufgebaut – mit dem Zeitraum von heute. */}
      {editable && exportOpen && (
        <CleaningExport weeks={weeks} onClose={() => setExportOpen(false)} />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Den Putzplan als PDF herunterladen.
 *
 * Gefragt wird nur der Zeitraum. Zwei Knöpfe nehmen die üblichen Antworten
 * vorweg: ab der laufenden Woche bis zum Ende des Plans – das Blatt fürs
 * Anschlagbrett – und der ganze Plan. Was auf dem Blatt steht, sagt die
 * Beschreibung: Woche, Datum, wer an der Reihe ist und die Gruppe (siehe
 * `services/cleaningPdf`).
 *
 * Dazu ein Haken für die Adresse des Plans samt QR-Code: Wer vor dem
 * Anschlagbrett steht, hat den Plan damit auch auf dem Telefon – und dort
 * immer den neusten Stand. Das Gerät merkt sich die Wahl.
 *
 * Die Sonntage braucht der Grund hinter einer doppelten Woche: Steht dort
 * eine Pfahlkonferenz, steht sie auch auf dem Blatt.
 */
function CleaningExport({ weeks, onClose }: { weeks: CleaningWeek[]; onClose: () => void }) {
  const { settings } = useData()
  const toast = useToast()
  const { data: sundays } = useAllSacramentMeetings()
  const [withLink, setWithLink] = useLocalStorage('bss:putzplan:pdf-link', false)
  const today = toDateInput(new Date())

  const sorted = useMemo(
    () => [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [weeks],
  )
  const planStart = sorted[0]?.startDate ?? today
  const planEnd = sorted.reduce(
    (latest, week) => (week.endDate > latest ? week.endDate : latest),
    planStart,
  )
  /** Die laufende Woche – oder, wenn heute keine läuft, die nächste. */
  const thisWeek = sorted.find((week) => week.endDate >= today)?.startDate ?? planStart

  const [from, setFrom] = useState(thisWeek)
  const [to, setTo] = useState(planEnd)

  const valid = Boolean(from && to && from <= to)
  const count = valid ? weeksInRange(weeks, from, to).length : 0

  const download = () => {
    const bytes = cleaningPdf({
      weeks,
      from,
      to,
      wardName: settings.wardName,
      today,
      sundays,
      withLink,
    })
    if (!bytes) {
      toast.error('In diesem Zeitraum steht keine Woche im Plan.')
      return
    }
    saveFile(bytes, cleaningPdfFilename(from, to))
    toast.success('Putzplan als PDF heruntergeladen.')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Putzplan exportieren"
      description="Als PDF zum Ausdrucken: Woche, Datum, wer an der Reihe ist und die Gruppe."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={download}
            disabled={!valid || count === 0}
          >
            <FileDown className="size-4" aria-hidden />
            PDF herunterladen
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="export-from">
              Von
            </label>
            <input
              id="export-from"
              type="date"
              className="input"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="export-to">
              Bis
            </label>
            <input
              id="export-to"
              type="date"
              className="input"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setFrom(thisWeek)
              setTo(planEnd)
            }}
          >
            Ab dieser Woche
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setFrom(planStart)
              setTo(planEnd)
            }}
          >
            Ganzer Plan
          </button>
        </div>

        <p className="hint mt-0">
          {!valid
            ? 'Das Ende liegt vor dem Anfang.'
            : count === 0
              ? 'In diesem Zeitraum steht keine Woche im Plan.'
              : `${count} ${count === 1 ? 'Woche' : 'Wochen'} kommen aufs Blatt.`}
        </p>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded"
            checked={withLink}
            onChange={(event) => setWithLink(event.target.checked)}
          />
          <span>
            <span className="text-sm font-medium">Link und QR-Code integrieren</span>
            <span className="hint mt-0.5 block">
              Ganz unten auf dem Blatt steht {CLEANING_PLAN_LABEL} – mit einem QR-Code, der dorthin
              führt.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  )
}

/** Die Datei im Browser speichern – wie die Sicherung unter «Einstellungen». */
function saveFile(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Erst später freigeben: Im selben Zug verworfen, bricht der Download je
  // nach Browser ab, bevor er begonnen hat.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** «Gruppe 10 · 15.11. – 21.11.2026» – oder nur die Tage, wenn die Gruppe fehlt. */
function weekMeta(week: CleaningWeek): string {
  return week.group ? `${week.group} · ${period(week)}` : period(week)
}

/**
 * Wer dran ist – gross, für den Blick vor dem Anschlagbrett.
 *
 * Die Ansicht ohne Konto beginnt mit der einen Frage, wegen der jemand den
 * QR-Code scannt: Sind wir diese Woche dran? Die Antwort steht gross oben,
 * darunter kleiner die nächste Woche. Gezählt wird ab heute, nicht ab dem
 * Sonntag (siehe `cleaningNow`).
 *
 * Läuft heute keine Woche – am Sonntag zwischen zwei Wochen von Montag bis
 * Samstag –, rückt die nächste nach oben und die übernächste darunter.
 */
function OnDuty({ weeks, today }: { weeks: CleaningWeek[]; today: string }) {
  if (weeks.length === 0) return null
  const { current, next, after } = cleaningNow(weeks, today)
  const first = current ?? next
  const second = current ? next : after

  if (!first) {
    return (
      <div className="card mb-4 p-5">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Der Plan reicht nicht bis heute – sobald der nächste eingetragen ist, steht hier, wer dran
          ist.
        </p>
      </div>
    )
  }

  return (
    <section className="card relative mb-4 overflow-hidden p-5 sm:p-6">
      <span className="bg-brand-600 absolute inset-x-0 top-0 h-1" aria-hidden />

      <p className="text-brand-700 dark:text-brand-300 text-sm font-semibold">
        {current ? 'Diese Woche dran' : 'Als Nächstes dran'}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {first.team}
      </h2>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{weekMeta(first)}</p>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {current ? 'Nächste Woche dran' : 'Danach dran'}
        </p>
        {second ? (
          <>
            <p className="mt-0.5 text-lg font-semibold text-balance">{second.team}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{weekMeta(second)}</p>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Weiter reicht der Plan noch nicht.
          </p>
        )}
      </div>
    </section>
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

/**
 * Die Zeilen des Plans – ohne Rahmen darum.
 *
 * Sie stehen für sich, weil sie zweimal gebraucht werden: für den gewählten
 * Zeitraum und für die Treffer, die daneben liegen. Die laufende Woche bleibt
 * dabei in beiden Listen hervorgehoben.
 *
 * Ohne `onEdit` – auf dem Anschlagbrett ohne Konto – sind es blosse Zeilen:
 * kein Stift, nichts zum Anklicken.
 */
function WeekRows({
  weeks,
  currentId,
  onEdit,
}: {
  weeks: CleaningWeek[]
  currentId: string | null
  onEdit?: (week: CleaningWeek) => void
}) {
  return (
    <ul className="card divide-list overflow-hidden">
      {weeks.map((week) => {
        const current = week.id === currentId
        const content = (
          <>
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold',
                current
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
                {current && ' · diese Woche'}
              </p>
            </div>

            {onEdit && <Pencil className="size-4 shrink-0 text-slate-300" aria-hidden />}
          </>
        )
        const row = cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left',
          current && 'bg-brand-50/60 dark:bg-brand-950/40',
        )

        return (
          <li key={week.id}>
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(week)}
                className={cn(row, 'transition hover:bg-slate-50 dark:hover:bg-slate-800/60')}
              >
                {content}
              </button>
            ) : (
              <div className={row}>{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

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
