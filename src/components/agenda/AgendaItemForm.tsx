import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { MentionField } from '@/components/ui/MentionField'
import { AssigneePicker } from '@/components/ui/Pickers'
import { LayoutGrid } from '@/components/agenda/LayoutGrid'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createAgendaItem, type AgendaItemInput } from '@/services/agenda'
import { emptyLayout, serializeLayout } from '@/lib/layout'
import type { ItemLayout, ItemStatus } from '@/lib/types'

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
  assignees: string[]
  memberRefs: string[]
  /** Gesetzt heisst: variables Layout statt Beschreibung */
  layout: ItemLayout | null
}

const EMPTY: FormState = {
  title: '',
  description: '',
  assignees: [],
  memberRefs: [],
  layout: null,
}

/**
 * Ein neues Traktandum erfassen.
 *
 * Nur zum Anlegen: Geändert wird ein Eintrag dort, wo er steht – in der
 * Sitzung oder in der Pendenzenliste, unmittelbar im Text. Ein Fenster, das
 * sich über die Sitzung legt, um ein Wort zu ändern, gibt es nicht mehr.
 *
 * Gefragt wird nur nach dem, was am Sitzungstisch zählt: Titel, Beschreibung,
 * Zuständige. Alles Weitere lässt sich nachtragen, und Bereich, betroffene
 * Mitglieder, Priorität, Termin und «vertraulich» sind ganz weggefallen.
 *
 * Hier – und nur hier – steht auch der Haken für das variable Layout: Ob ein
 * Punkt ein Absatz Text ist oder eine kleine Tabelle, entscheidet sich beim
 * Erfassen. Später stünde der Haken über zwanzig Traktanden, die ihn nie
 * brauchen.
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

  /*
   * Das zuletzt gebaute Raster überlebt den Haken.
   *
   * Wer «Variables Layout» ausschaltet, um kurz die Beschreibung zu lesen,
   * und wieder einschaltet, hätte sonst seine Tabelle noch einmal zu bauen.
   */
  const lastLayout = useRef<ItemLayout | null>(null)

  // Beim Öffnen zurücksetzen, damit nichts vom letzten Mal stehen bleibt.
  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    lastLayout.current = null
  }, [open])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const toggleLayout = (on: boolean) => {
    if (!on) lastLayout.current = form.layout
    update('layout', on ? (lastLayout.current ?? emptyLayout()) : null)
  }

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
        assignees: form.assignees,
        memberRefs: form.memberRefs,
        status: defaultStatus,
        meetingId,
        layout: form.layout ? serializeLayout(form.layout) : null,
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
        {/* Der Haken steht oben rechts, weil er über die Gestalt des ganzen
            Fensters entscheidet und nicht über ein einzelnes Feld. */}
        <div className="flex justify-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded"
              checked={form.layout !== null}
              onChange={(event) => toggleLayout(event.target.checked)}
            />
            Variables Layout
          </label>
        </div>

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

        {/* Entweder – oder: Ein Raster ist die Beschreibung, nur eben
            gegliedert. Beide nebeneinander liessen offen, wo etwas
            hingehört. Gespeichert bleiben ohnehin beide Stände. */}
        {form.layout ? (
          <div>
            <span className="label">Layout</span>
            <LayoutGrid
              layout={form.layout}
              onChange={(next) => update('layout', next)}
              onMention={(member) => linkMember(member.id)}
              memberRefs={form.memberRefs}
            />
          </div>
        ) : (
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
        )}

        <AssigneePicker value={form.assignees} onChange={(next) => update('assignees', next)} />
      </form>
    </Modal>
  )
}
