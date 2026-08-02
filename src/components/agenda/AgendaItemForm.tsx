import { useEffect, useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { AssigneePicker, MemberPicker } from '@/components/ui/Pickers'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { toDate, toDateInput } from '@/lib/dates'
import { createAgendaItem, updateAgendaItem, type AgendaItemInput } from '@/services/agenda'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type AgendaItem,
  type ItemCategory,
  type Priority,
} from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Vorhandenes Traktandum bearbeiten – leer lassen zum Anlegen */
  item?: AgendaItem | null
  /** Beim Anlegen direkt einer Sitzung zuordnen */
  meetingId?: string | null
  onSaved?: (id: string) => void
}

interface FormState {
  title: string
  description: string
  category: ItemCategory
  priority: Priority
  assignees: string[]
  memberRefs: string[]
  dueDate: string
  confidential: boolean
}

const EMPTY: FormState = {
  title: '',
  description: '',
  category: 'general',
  priority: 'normal',
  assignees: [],
  memberRefs: [],
  dueDate: '',
  confidential: false,
}

export function AgendaItemForm({ open, onClose, item, meetingId = null, onSaved }: Props) {
  const { profile, isLeadership } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  // Beim Öffnen den Zustand aus dem Traktandum übernehmen bzw. zurücksetzen.
  useEffect(() => {
    if (!open) return
    setForm(
      item
        ? {
            title: item.title,
            description: item.description ?? '',
            category: item.category,
            priority: item.priority,
            assignees: item.assignees ?? [],
            memberRefs: item.memberRefs ?? [],
            dueDate: toDateInput(item.dueDate),
            confidential: item.confidential ?? false,
          }
        : EMPTY,
    )
  }, [open, item])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile) return

    const title = form.title.trim()
    if (!title) {
      toast.error('Bitte gib einen Titel ein.')
      return
    }

    setSaving(true)
    try {
      const actor = { id: profile.id, name: profile.displayName }
      const payload: AgendaItemInput = {
        title,
        description: form.description,
        category: form.category,
        priority: form.priority,
        assignees: form.assignees,
        memberRefs: form.memberRefs,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`) : null,
        confidential: form.confidential,
        meetingId,
      }

      if (item) {
        await updateAgendaItem(item.id, {
          title: payload.title,
          description: payload.description,
          category: payload.category,
          priority: payload.priority,
          assignees: payload.assignees,
          memberRefs: payload.memberRefs,
          dueDate: payload.dueDate,
          confidential: payload.confidential,
        })
        toast.success('Traktandum aktualisiert.')
        onSaved?.(item.id)
      } else {
        const id = await createAgendaItem(payload, actor)
        toast.success(meetingId ? 'Traktandum zur Sitzung hinzugefügt.' : 'Traktandum erfasst.')
        onSaved?.(id)
      }
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen. Bist du online?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Traktandum bearbeiten' : 'Neues Traktandum'}
      description={
        item
          ? undefined
          : meetingId
            ? 'Wird direkt in die gewählte Sitzung aufgenommen.'
            : 'Landet im Sammelkorb und kann später einer Sitzung zugeordnet werden.'
      }
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" form="agenda-form" className="btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert …' : item ? 'Speichern' : 'Erfassen'}
          </button>
        </>
      }
    >
      <form id="agenda-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="item-title">
            Titel
          </label>
          <input
            id="item-title"
            className="input"
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder="Worum geht es?"
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className="label" htmlFor="item-description">
            Beschreibung
          </label>
          <textarea
            id="item-description"
            className="input min-h-24 resize-y"
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Hintergrund, Vorgeschichte, konkrete Frage an die Sitzung …"
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="item-category">
              Bereich
            </label>
            <select
              id="item-category"
              className="input"
              value={form.category}
              onChange={(event) => update('category', event.target.value as ItemCategory)}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="item-priority">
              Priorität
            </label>
            <select
              id="item-priority"
              className="input"
              value={form.priority}
              onChange={(event) => update('priority', event.target.value as Priority)}
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="item-due">
              Erledigen bis
            </label>
            <input
              id="item-due"
              type="date"
              className="input"
              value={form.dueDate}
              onChange={(event) => update('dueDate', event.target.value)}
            />
          </div>
        </div>

        <AssigneePicker
          value={form.assignees}
          onChange={(next) => update('assignees', next)}
        />

        <MemberPicker
          value={form.memberRefs}
          onChange={(next) => update('memberRefs', next)}
          label="Betrifft Mitglieder (optional)"
        />

        {isLeadership && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded"
              checked={form.confidential}
              onChange={(event) => update('confidential', event.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Lock className="size-3.5" aria-hidden />
                Vertraulich
              </span>
              <span className="hint mt-0.5 block">
                Nur für Bischof und Ratgeber sichtbar – für seelsorgerische Anliegen.
                Sekretäre sehen diesen Eintrag nicht.
              </span>
            </span>
          </label>
        )}

        {item && (
          <p className="hint">
            Erstellt {toDate(item.createdAt) ? toDateInput(item.createdAt) : '–'}
            {item.deferCount > 0 && ` · bereits ${item.deferCount}× verschoben`}
          </p>
        )}
      </form>
    </Modal>
  )
}
