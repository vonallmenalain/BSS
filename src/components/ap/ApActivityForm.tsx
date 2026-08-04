import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/Pickers'
import { apDateLabel, apTitle } from '@/components/ap/ApActivityRow'
import {
  EMPTY_AP_ACTIVITY,
  apSuggestions,
  deleteApActivity,
  saveApActivity,
  type ApActivityInput,
} from '@/services/apActivities'
import { AP_ACTIVITY_KIND_LABELS, type ApActivity, type ApActivityKind } from '@/lib/types'

/**
 * Einen Termin erfassen oder ändern.
 *
 * Alle Felder des bisherigen Excel-Plans stehen hier – und alle sind
 * Freitext, so wie sie es in der Tabelle waren. Vorschlagslisten aus dem
 * bereits Erfassten nehmen dem Tippen die Arbeit ab und halten die
 * Schreibweise einheitlich: «Gemeindehaus» soll nicht in vier Varianten im
 * Plan stehen.
 *
 * Wer nur Leserechte hat, bekommt denselben Dialog ohne Felder – die
 * Angaben zum Nachlesen, ohne die Möglichkeit, versehentlich etwas zu
 * verstellen.
 */

const KIND_OPTIONS: { value: ApActivityKind; label: string }[] = [
  { value: 'activity', label: AP_ACTIVITY_KIND_LABELS.activity },
  { value: 'class', label: AP_ACTIVITY_KIND_LABELS.class },
  { value: 'special', label: AP_ACTIVITY_KIND_LABELS.special },
  { value: 'cancelled', label: AP_ACTIVITY_KIND_LABELS.cancelled },
]

function toInput(activity: ApActivity): ApActivityInput {
  return {
    date: activity.date,
    endDate: activity.endDate ?? null,
    time: activity.time ?? '',
    kind: activity.kind,
    title: activity.title ?? '',
    location: activity.location ?? '',
    leader: activity.leader ?? '',
    bishopric: activity.bishopric ?? '',
    advisor: activity.advisor ?? '',
    note: activity.note ?? '',
  }
}

export function ApActivityForm({
  open,
  activity,
  defaultDate,
  all,
  onClose,
}: {
  open: boolean
  /** `null` legt einen neuen Termin an */
  activity: ApActivity | null
  /** Vorschlag für einen neuen Termin – der nächste freie Mittwoch bzw. Sonntag */
  defaultDate: string
  /** Der ganze Plan – Grundlage für die Vorschlagslisten */
  all: ApActivity[]
  onClose: () => void
}) {
  const { profile, canEditAp } = useAuth()
  const toast = useToast()
  const listId = useId()

  const [form, setForm] = useState<ApActivityInput>(EMPTY_AP_ACTIVITY)
  const [multiDay, setMultiDay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    if (activity) {
      setForm(toInput(activity))
      setMultiDay(Boolean(activity.endDate && activity.endDate !== activity.date))
    } else {
      setForm({ ...EMPTY_AP_ACTIVITY, date: defaultDate })
      setMultiDay(false)
    }
  }, [open, activity, defaultDate])

  const suggestions = useMemo(
    () => ({
      location: apSuggestions(all, 'location'),
      leader: apSuggestions(all, 'leader'),
      bishopric: apSuggestions(all, 'bishopric'),
      advisor: apSuggestions(all, 'advisor'),
    }),
    [all],
  )

  const update = <K extends keyof ApActivityInput>(key: K, value: ApActivityInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.date) {
      toast.error('Bitte gib ein Datum an.')
      return
    }
    if (multiDay && form.endDate && form.endDate < form.date) {
      toast.error('Der letzte Tag liegt vor dem ersten.')
      return
    }

    setSaving(true)
    try {
      const outcome = await saveApActivity(
        activity?.id ?? null,
        {
          ...form,
          endDate: multiDay ? form.endDate || null : null,
          title: form.title.trim(),
          location: form.location.trim(),
          leader: form.leader.trim(),
          bishopric: form.bishopric.trim(),
          advisor: form.advisor.trim(),
          note: form.note.trim(),
        },
        profile?.id ?? null,
      )
      toast.saved(activity ? 'Termin gespeichert.' : 'Termin hinzugefügt.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  /* ---------- Nur ansehen ---------- */

  if (!canEditAp) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={activity ? apTitle(activity) : 'Termin'}
        description={activity ? apDateLabel(activity) : undefined}
        footer={
          <button type="button" className="btn-secondary" onClick={onClose}>
            Schliessen
          </button>
        }
      >
        {activity ? (
          <dl className="space-y-3 text-sm">
            <ReadOnlyRow label="Art" value={AP_ACTIVITY_KIND_LABELS[activity.kind]} />
            <ReadOnlyRow label="Uhrzeit" value={activity.time ?? ''} />
            <ReadOnlyRow label="Treffpunkt" value={activity.location ?? ''} />
            <ReadOnlyRow label="Leitung / Org" value={activity.leader ?? ''} />
            <ReadOnlyRow label="Teilnahme Bischofschaft" value={activity.bishopric ?? ''} />
            <ReadOnlyRow label="Teilnahme Berater" value={activity.advisor ?? ''} />
            <ReadOnlyRow label="Bemerkung" value={activity.note ?? ''} />
          </dl>
        ) : null}
        <p className="hint mt-4">
          Dein Zugang zeigt den Plan, ohne dass sich etwas ändern lässt. Wer etwas eintragen soll,
          bekommt von der Bischofschaft das Schreibrecht.
        </p>
      </Modal>
    )
  }

  /* ---------- Bearbeiten ---------- */

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={activity ? 'Termin bearbeiten' : 'Termin hinzufügen'}
        size="lg"
        footer={
          <>
            {activity && (
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
            <button type="submit" form="ap-form" className="btn-primary" disabled={saving}>
              Speichern
            </button>
          </>
        }
      >
        <form id="ap-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ap-date">
                Datum
              </label>
              <input
                id="ap-date"
                type="date"
                className="input"
                value={form.date}
                onChange={(event) => update('date', event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="ap-time">
                Uhrzeit
              </label>
              <input
                id="ap-time"
                type="time"
                className="input"
                value={form.time}
                onChange={(event) => update('time', event.target.value)}
              />
              <p className="hint">Nur, wenn es nicht die übliche Zeit ist.</p>
            </div>
            <div>
              <span className="label">Mehrtägig</span>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 dark:border-slate-600"
                  checked={multiDay}
                  onChange={(event) => {
                    setMultiDay(event.target.checked)
                    if (event.target.checked && !form.endDate) update('endDate', form.date)
                  }}
                />
                Lager, Wochenende …
              </label>
            </div>
          </div>

          {multiDay && (
            <div className="sm:max-w-[calc(33%-0.5rem)]">
              <label className="label" htmlFor="ap-end">
                Letzter Tag
              </label>
              <input
                id="ap-end"
                type="date"
                className="input"
                value={form.endDate ?? ''}
                min={form.date}
                onChange={(event) => update('endDate', event.target.value)}
              />
            </div>
          )}

          <div>
            <span className="label">Art</span>
            <SegmentedControl<ApActivityKind>
              value={form.kind}
              onChange={(kind) => update('kind', kind)}
              options={KIND_OPTIONS}
              size="sm"
            />
            <p className="hint">
              «Fällt aus» bleibt im Plan stehen – so ist beantwortet, warum an diesem Mittwoch
              nichts läuft, statt dass die Lücke jemand neu verplant.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="ap-title">
              Aktivität / Klasse
            </label>
            <input
              id="ap-title"
              className="input"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="z. B. «Bouldern» oder «Warum lässt Gott Leid zu»"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="ap-location"
              label="Treffpunkt"
              value={form.location}
              onChange={(value) => update('location', value)}
              options={suggestions.location}
              listId={`${listId}-location`}
              placeholder="z. B. «Gemeindehaus»"
            />
            <Field
              id="ap-leader"
              label="Leitung / Org"
              value={form.leader}
              onChange={(value) => update('leader', value)}
              options={suggestions.leader}
              listId={`${listId}-leader`}
              placeholder="z. B. «Carden» oder «JM»"
            />
            <Field
              id="ap-bishopric"
              label="Teilnahme Bischofschaft"
              value={form.bishopric}
              onChange={(value) => update('bishopric', value)}
              options={suggestions.bishopric}
              listId={`${listId}-bishopric`}
            />
            <Field
              id="ap-advisor"
              label="Teilnahme Berater"
              value={form.advisor}
              onChange={(value) => update('advisor', value)}
              options={suggestions.advisor}
              listId={`${listId}-advisor`}
            />
          </div>

          <div>
            <label className="label" htmlFor="ap-note">
              Bemerkung / sonstiges Programm
            </label>
            <textarea
              id="ap-note"
              className="input resize-y"
              rows={3}
              value={form.note}
              onChange={(event) => update('note', event.target.value)}
              placeholder="z. B. «Gemeinsame Aktivität mit JD»"
            />
          </div>
        </form>
      </Modal>

      {activity && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteApActivity(activity.id).then((outcome) => {
              toast.saved('Termin entfernt.', outcome)
              onClose()
            })
          }}
          title="Termin löschen?"
          message={`«${apTitle(activity)}» am ${apDateLabel(activity)} wird aus dem Plan entfernt.`}
          confirmLabel="Löschen"
          danger
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

/** Textfeld mit Vorschlägen aus dem bereits Erfassten. */
function Field({
  id,
  label,
  value,
  onChange,
  options,
  listId,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  options: string[]
  listId: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        list={options.length > 0 ? listId : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.slice(0, 30).map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line">{value.trim()}</dd>
    </div>
  )
}
