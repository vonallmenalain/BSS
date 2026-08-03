import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Award, ChevronRight, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useCallings } from '@/hooks/useFirestore'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { PageHeader, SegmentedControl, MemberPicker } from '@/components/ui/Pickers'
import { CallingStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate, toDateInput } from '@/lib/dates'
import { cn, compareNames, groupBy, matchesSearch } from '@/lib/utils'
import {
  advanceCalling,
  COMMON_POSITIONS,
  createCalling,
  deleteCalling,
  isWardCalling,
  updateCalling,
} from '@/services/callings'
import {
  CALLING_STATUS_LABELS,
  ORGANIZATION_LABELS,
  type Calling,
  type CallingStatus,
  type Organization,
} from '@/lib/types'

type Scope = 'active' | 'process' | 'released' | 'all'

/** Reihenfolge der Schritte im Berufungsprozess. */
const FLOW: CallingStatus[] = ['proposed', 'approved', 'extended', 'sustained', 'set_apart']

export function Callings() {
  const { data: callings, loading } = useCallings(400)
  const [scope, setScope] = useState<Scope>('active')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editCalling, setEditCalling] = useState<Calling | null>(null)

  const counts = useMemo(
    () => ({
      active: callings.filter((c) => c.status === 'set_apart' || c.status === 'sustained').length,
      process: callings.filter((c) => ['proposed', 'approved', 'extended'].includes(c.status))
        .length,
      released: callings.filter((c) => c.status === 'released' || c.status === 'declined').length,
      all: callings.length,
    }),
    [callings],
  )

  const visible = useMemo(() => {
    let result = callings

    if (scope === 'active') {
      result = result.filter((c) => c.status === 'set_apart' || c.status === 'sustained')
    } else if (scope === 'process') {
      result = result.filter((c) => ['proposed', 'approved', 'extended'].includes(c.status))
    } else if (scope === 'released') {
      result = result.filter((c) => c.status === 'released' || c.status === 'declined')
    }

    if (search.trim()) {
      result = result.filter((c) =>
        matchesSearch(
          `${c.memberName} ${c.position} ${ORGANIZATION_LABELS[c.organization]}`,
          search,
        ),
      )
    }

    return result
  }, [callings, scope, search])

  // Zwei Sparten. Der Sonntagsschulpräsident des Pfahls ist nicht der
  // Sonntagsschulpräsident der Gemeinde – nebeneinander in derselben Liste
  // sähen sie aber genau so aus.
  const byOrganization = useMemo(() => {
    const grouped = groupBy(visible.filter(isWardCalling), (calling) => calling.organization)
    return [...grouped.entries()].sort(([a], [b]) =>
      compareNames(ORGANIZATION_LABELS[a], ORGANIZATION_LABELS[b]),
    )
  }, [visible])

  const outsideUnit = useMemo(
    () => visible.filter((calling) => !isWardCalling(calling)).sort(compareByImportOrder),
    [visible],
  )

  return (
    <>
      <PageHeader
        title="Berufungen"
        subtitle="Vom Vorschlag über die Bestätigung bis zur Einsetzung"
        actions={
          <>
            <Link to="/import/berufungen" className="btn-secondary">
              <Upload className="size-4" aria-hidden />
              <span className="hidden sm:inline">Import</span>
            </Link>
            <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">Neue Berufung</span>
            </button>
          </>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            className="input pl-9"
            placeholder="Name, Position, Organisation …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'active', label: 'Laufend', count: counts.active },
            { value: 'process', label: 'In Bearbeitung', count: counts.process },
            { value: 'released', label: 'Entlassen', count: counts.released },
            { value: 'all', label: 'Alle', count: counts.all },
          ]}
        />
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Award}
            title={callings.length === 0 ? 'Noch keine Berufungen erfasst' : 'Nichts gefunden'}
            description={
              callings.length === 0
                ? 'Erfasse Berufungen, um den Überblick über Vorschläge, Bestätigungen und Einsetzungen zu behalten.'
                : 'Passe Suche oder Filter an.'
            }
            action={
              callings.length === 0 && (
                <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  Berufung erfassen
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {byOrganization.map(([organization, entries]) => (
            <CallingSection
              key={organization}
              title={ORGANIZATION_LABELS[organization]}
              entries={entries.sort(compareByImportOrder)}
              onSelect={setEditCalling}
            />
          ))}

          {outsideUnit.length > 0 && (
            <div className="border-t border-slate-200 pt-5 dark:border-slate-700">
              <CallingSection
                title="Ausserhalb der Einheit"
                hint="Pfahl, Seminar, Institut und Mission – nicht Teil des Organisationsplans der Gemeinde."
                entries={outsideUnit}
                onSelect={setEditCalling}
              />
            </div>
          )}
        </div>
      )}

      <CallingForm open={formOpen} onClose={() => setFormOpen(false)} />
      <CallingForm
        open={Boolean(editCalling)}
        onClose={() => setEditCalling(null)}
        calling={editCalling}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Reihenfolge innerhalb einer Organisation – wie im LCR.
 *
 * Dort steht zuoberst der Präsident, dann die Ratgeber, dann die übrigen.
 * Das ist die Ordnung, in der die Bischofschaft eine Organisation denkt;
 * alphabetisch sortiert stünde der Bischof unter «B» zwischen den Lehrern.
 *
 * Von Hand erfasste Berufungen tragen keine Nummer. Sie kommen ans Ende
 * und sind dort nach Bezeichnung geordnet – irgendwo müssen sie hin, und
 * hinten stören sie die eingelesene Ordnung nicht.
 */
function compareByImportOrder(a: Calling, b: Calling): number {
  const left = a.order ?? Number.MAX_SAFE_INTEGER
  const right = b.order ?? Number.MAX_SAFE_INTEGER
  return left - right || compareNames(a.position, b.position)
}

/* ------------------------------------------------------------------ */

/** Eine Sparte der Berufungsliste – eine Organisation oder der Bereich ausserhalb. */
function CallingSection({
  title,
  hint,
  entries,
  onSelect,
}: {
  title: string
  hint?: string
  entries: Calling[]
  onSelect: (calling: Calling) => void
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {title} ({entries.length})
      </h2>
      {hint && <p className="hint mb-2">{hint}</p>}
      <ul className={cn('card divide-list overflow-hidden', !hint && 'mt-2')}>
        {entries.map((calling) => (
          <li key={calling.id}>
            <button
              type="button"
              onClick={() => onSelect(calling)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <Avatar name={calling.memberName} id={calling.memberId} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{calling.position}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {calling.memberName}
                  {calling.setApartDate && ` · seit ${formatDate(calling.setApartDate)}`}
                </p>
              </div>
              <CallingStatusBadge status={calling.status} />
              <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ */

interface FormState {
  memberIds: string[]
  position: string
  organization: Organization
  status: CallingStatus
  proposedDate: string
  extendedDate: string
  sustainedDate: string
  setApartDate: string
  releasedDate: string
  notes: string
  /** Berufung ausserhalb der eigenen Einheit */
  outOfUnit: boolean
}

const EMPTY: FormState = {
  memberIds: [],
  position: '',
  organization: 'ward',
  outOfUnit: false,
  status: 'proposed',
  proposedDate: '',
  extendedDate: '',
  sustainedDate: '',
  setApartDate: '',
  releasedDate: '',
  notes: '',
}

function CallingForm({
  open,
  onClose,
  calling,
}: {
  open: boolean
  onClose: () => void
  calling?: Calling | null
}) {
  const { membersById } = useData()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      calling
        ? {
            memberIds: [calling.memberId],
            position: calling.position,
            organization: calling.organization,
            outOfUnit: Boolean(calling.outOfUnit),
            status: calling.status,
            proposedDate: toDateInput(calling.proposedDate),
            extendedDate: toDateInput(calling.extendedDate),
            sustainedDate: toDateInput(calling.sustainedDate),
            setApartDate: toDateInput(calling.setApartDate),
            releasedDate: toDateInput(calling.releasedDate),
            notes: calling.notes ?? '',
          }
        : EMPTY,
    )
  }, [open, calling])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const asDate = (value: string) => (value ? new Date(`${value}T12:00:00`) : null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const memberId = form.memberIds[0]
    if (!memberId) {
      toast.error('Bitte wähle ein Mitglied aus.')
      return
    }
    if (!form.position.trim()) {
      toast.error('Bitte gib die Position an.')
      return
    }

    const member = membersById.get(memberId)
    const payload = {
      memberId,
      memberName: member ? `${member.firstName} ${member.lastName}` : 'Unbekannt',
      position: form.position.trim(),
      organization: form.organization,
      outOfUnit: form.outOfUnit,
      status: form.status,
      proposedDate: asDate(form.proposedDate),
      extendedDate: asDate(form.extendedDate),
      sustainedDate: asDate(form.sustainedDate),
      setApartDate: asDate(form.setApartDate),
      releasedDate: asDate(form.releasedDate),
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      if (calling) {
        const outcome = await updateCalling(calling.id, payload)
        toast.saved('Berufung aktualisiert.', outcome)
      } else {
        const { outcome } = await createCalling(payload)
        toast.saved('Berufung erfasst.', outcome)
      }
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  /** Nächster Schritt im Prozess – als ein Klick statt Datum-Tippen. */
  const nextStep = calling ? FLOW[FLOW.indexOf(calling.status) + 1] : undefined

  const suggestions = COMMON_POSITIONS[form.organization] ?? []

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={calling ? 'Berufung bearbeiten' : 'Neue Berufung'}
        size="lg"
        footer={
          <>
            {calling && (
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
            <button type="submit" form="calling-form" className="btn-primary" disabled={saving}>
              Speichern
            </button>
          </>
        }
      >
        <form id="calling-form" onSubmit={handleSubmit} className="space-y-4">
          {calling && nextStep && (
            <div className="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Nächster Schritt</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {CALLING_STATUS_LABELS[nextStep]}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() =>
                  void advanceCalling(calling.id, nextStep).then((outcome) => {
                    toast.saved(`Status: ${CALLING_STATUS_LABELS[nextStep]}`, outcome)
                    onClose()
                  })
                }
              >
                Mit heutigem Datum
              </button>
            </div>
          )}

          <MemberPicker
            value={form.memberIds}
            onChange={(next) => update('memberIds', next)}
            label="Mitglied"
            single
            placeholder="Name suchen …"
          />

          <div>
            <span className="label">Bereich</span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: false, label: 'Gemeinde' },
                { value: true, label: 'Ausserhalb der Einheit' },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => update('outOfUnit', option.value)}
                  aria-pressed={form.outOfUnit === option.value}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                    form.outOfUnit === option.value
                      ? 'border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="hint">
              Pfahl, Seminar, Institut und Mission stehen für sich. Sie zählen als Berufung, aber
              nicht im Organisationsplan der Gemeinde – und der Sonntagsschulpräsident des Pfahls
              ist nicht derselbe wie der der Gemeinde.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!form.outOfUnit && (
              <div>
                <label className="label" htmlFor="c-organization">
                  Organisation
                </label>
                <select
                  id="c-organization"
                  className="input"
                  value={form.organization}
                  onChange={(event) => update('organization', event.target.value as Organization)}
                >
                  {Object.entries(ORGANIZATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label" htmlFor="c-position">
                Position
              </label>
              <input
                id="c-position"
                className="input"
                value={form.position}
                onChange={(event) => update('position', event.target.value)}
                list="position-suggestions"
                placeholder="z. B. Sekretär"
                required
              />
              <datalist id="position-suggestions">
                {suggestions.map((position) => (
                  <option key={position} value={position} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="c-status">
              Status
            </label>
            <select
              id="c-status"
              className="input"
              value={form.status}
              onChange={(event) => update('status', event.target.value as CallingStatus)}
            >
              {Object.entries(CALLING_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Meilensteine
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['proposedDate', 'Vorgeschlagen'],
                  ['extendedDate', 'Berufung ausgesprochen'],
                  ['sustainedDate', 'Bestätigt'],
                  ['setApartDate', 'Eingesetzt'],
                  ['releasedDate', 'Entlassen'],
                ] as [keyof FormState, string][]
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="label text-xs" htmlFor={`c-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`c-${key}`}
                    type="date"
                    className="input"
                    value={form[key] as string}
                    onChange={(event) => update(key, event.target.value as FormState[typeof key])}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="label" htmlFor="c-notes">
              Notiz
            </label>
            <textarea
              id="c-notes"
              className="input min-h-20 resize-y"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Absprachen, Rückmeldungen, wer spricht die Berufung aus …"
            />
          </div>

          {calling && (
            <Link
              to={`/mitglieder/${calling.memberId}`}
              className="text-brand-600 dark:text-brand-300 inline-block text-sm hover:underline"
            >
              Zum Mitgliederprofil →
            </Link>
          )}
        </form>
      </Modal>

      {calling && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteCalling(calling.id).then(() => {
              toast.success('Berufung gelöscht.')
              onClose()
            })
          }}
          title="Berufung löschen?"
          message={`«${calling.position}» von ${calling.memberName} wird entfernt.`}
          confirmLabel="Löschen"
          danger
        />
      )}
    </>
  )
}
