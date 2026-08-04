import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { MentionField } from '@/components/ui/MentionField'
import { AssigneePicker, SegmentedControl } from '@/components/ui/Pickers'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createAgendaItem, type AgendaItemInput } from '@/services/agenda'
import { PRIORITY_LABELS, type ItemStatus, type Priority } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Direkt einer Sitzung zuordnen – ohne Angabe landet es im Sammelkorb */
  meetingId?: string | null
  /**
   * «Neu» vor dem Start der Sitzung, «Pendent», sobald sie läuft. Ein Punkt,
   * der mitten in der Sitzung dazukommt, war nie «neu» – er wird sofort
   * besprochen.
   */
  defaultStatus?: ItemStatus
  onSaved?: (id: string) => void
}

interface FormState {
  title: string
  description: string
  priority: Priority
  assignees: string[]
  memberRefs: string[]
  dueDate: string
}

const EMPTY: FormState = {
  title: '',
  description: '',
  priority: 'normal',
  assignees: [],
  memberRefs: [],
  dueDate: '',
}

/**
 * Ein neues Traktandum erfassen.
 *
 * Nur zum Anlegen: Geändert wird ein Eintrag dort, wo er steht – in der
 * Sitzung oder in der Pendenzenliste, unmittelbar im Text. Ein Fenster, das
 * sich über die Sitzung legt, um ein Wort zu ändern, gibt es nicht mehr.
 *
 * Gefragt wird nur nach dem, was am Sitzungstisch zählt: Titel, Beschreibung,
 * Priorität, Termin, Zuständige. Alles Weitere lässt sich nachtragen, und
 * Bereich, betroffene Mitglieder und «vertraulich» sind ganz weggefallen.
 */
export function AgendaItemForm({
  open,
  onClose,
  meetingId = null,
  defaultStatus = 'new',
  onSaved,
}: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  // Beim Öffnen zurücksetzen, damit nichts vom letzten Mal stehen bleibt.
  useEffect(() => {
    if (open) setForm(EMPTY)
  }, [open])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  /*
   * Ein mit «@» eingesetzter Name ist zugleich ein Verweis: Wer im Text steht,
   * wird daneben vermerkt – sonst führte der Name später nirgendwohin.
   */
  const linkMember = (memberId: string) =>
    setForm((current) =>
      current.memberRefs.includes(memberId)
        ? current
        : { ...current, memberRefs: [...current.memberRefs, memberId] },
    )

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
      const payload: AgendaItemInput = {
        title,
        description: form.description,
        priority: form.priority,
        assignees: form.assignees,
        memberRefs: form.memberRefs,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`) : null,
        status: defaultStatus,
        meetingId,
      }
      const id = await createAgendaItem(payload, { id: profile.id, name: profile.displayName })
      toast.success(meetingId ? 'Traktandum zur Sitzung hinzugefügt.' : 'Traktandum erfasst.')
      onSaved?.(id)
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
      title="Neues Traktandum"
      description={
        meetingId
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
            {saving ? 'Wird gespeichert …' : 'Erfassen'}
          </button>
        </>
      }
    >
      <form id="agenda-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="item-title">
            Titel
          </label>
          <MentionField
            id="item-title"
            value={form.title}
            onChange={(next) => update('title', next)}
            onMention={(member) => linkMember(member.id)}
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className="label" htmlFor="item-description">
            Beschreibung
          </label>
          <MentionField
            id="item-description"
            multiline
            className="min-h-24 resize-y"
            value={form.description}
            onChange={(next) => update('description', next)}
            onMention={(member) => linkMember(member.id)}
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Priorität</span>
            <SegmentedControl<Priority>
              value={form.priority}
              onChange={(next) => update('priority', next)}
              size="sm"
              options={(['low', 'normal', 'high'] as Priority[]).map((value) => ({
                value,
                label: PRIORITY_LABELS[value],
              }))}
            />
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

        <AssigneePicker value={form.assignees} onChange={(next) => update('assignees', next)} />
      </form>
    </Modal>
  )
}
