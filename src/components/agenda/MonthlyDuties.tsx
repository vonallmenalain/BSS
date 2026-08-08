import { useState } from 'react'
import { Ban, Check, Pencil, Plus, Repeat, RotateCcw, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useMonthLeaders, useMonthlyDuties } from '@/hooks/useFirestore'
import { useCurrentMonth } from '@/hooks/useMonthlyDuties'
import { UserAvatar } from '@/components/ui/Avatar'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import {
  createMonthlyDuty,
  deleteMonthlyDuty,
  endMonthlyDuty,
  resumeMonthlyDuty,
  updateMonthlyDuty,
} from '@/services/monthlyDuties'
import { dutyIsRunning, formatMonthKey } from '@/lib/monthlyDuties'
import type { MonthlyDuty } from '@/lib/types'
import { plainText } from '@/lib/textFormat'

/**
 * Die Aufgaben, die zur Leitung eines Monats gehören – an einem Ort.
 *
 * Erfasst werden sie dort, wo man an sie denkt: beim Erfassen einer Pendenz,
 * mit dem Haken «Gehört zur Monatsverantwortung». Was hier steht, ist der
 * Blick auf die Liste – was jeden Monat anfällt, ab wann, und was nicht mehr
 * nachkommt.
 *
 * Beendet wird eine Aufgabe und selten gelöscht: Die Pendenzen der
 * vergangenen Monate bleiben stehen, samt allem, was in ihnen notiert wurde.
 * Deshalb steht «Beenden» als gewöhnlicher Knopf da und «Löschen» in Rot
 * daneben – für das, was von Anfang an ein Versehen war.
 */
export function MonthlyDutiesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth()
  const { userName } = useData()
  const toast = useToast()

  const month = useCurrentMonth()
  const { data: duties, loading } = useMonthlyDuties()
  const { leaders } = useMonthLeaders()
  const leader = leaders.get(month) ?? null

  const [adding, setAdding] = useState(false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Monatspendenzen"
      description="Was jeden Monat anfällt – bei dem, der den Monat führt"
      size="lg"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Schliessen
        </button>
      }
    >
      <div className="space-y-4">
        {/* Wer den Monat gerade führt, gehört zuoberst: Ohne diese Zeile
            bliebe offen, wem die Liste darunter im Augenblick gehört. */}
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          {formatMonthKey(month)} führt
          {leader ? (
            <>
              <UserAvatar userId={leader} name={userName(leader)} size="xs" />
              <span className="font-medium">{userName(leader)}</span>
            </>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              noch niemand. Eingetragen wird das unter «Abendmahl → Leitung → Zuständig», mit dem
              Haken «Für den ganzen Monat».
            </span>
          )}
        </p>

        {loading ? (
          <SkeletonList rows={2} />
        ) : duties.length === 0 && !adding ? (
          <EmptyState
            icon={Repeat}
            title="Noch keine Monatspendenz"
            description="Eine Aufgabe, die jeden Monat anfällt und immer dem gehört, der den Monat führt – Ansprachen anfragen, Gebete verteilen, den Ablauf beisammenhalten."
            action={
              <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden />
                Monatspendenz erfassen
              </button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {duties.map((duty) => (
              <DutyRow key={duty.id} duty={duty} month={month} />
            ))}
          </ul>
        )}

        {adding ? (
          <DutyForm
            title=""
            description=""
            onCancel={() => setAdding(false)}
            onSave={async (values) => {
              if (!profile) return
              await createMonthlyDuty(
                { ...values, startMonth: month },
                { id: profile.id, name: profile.displayName },
              )
              toast.success(`Monatspendenz erfasst – ab ${formatMonthKey(month)}.`)
              setAdding(false)
            }}
          />
        ) : (
          duties.length > 0 && (
            <button type="button" className="btn-secondary w-full" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden />
              Weitere Monatspendenz
            </button>
          )
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Eine Aufgabe                                                        */
/* ------------------------------------------------------------------ */

function DutyRow({ duty, month }: { duty: MonthlyDuty; month: string }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const running = dutyIsRunning(duty, month)

  /*
   * «Beenden» heisst: dieser Monat noch, danach nicht mehr.
   *
   * Die Pendenz dieses Monats steht schon in der Liste, und jemand arbeitet
   * womöglich gerade daran. Sie rückwirkend wegzunehmen wäre das Letzte, was
   * hier gemeint ist – gemeint ist, dass nichts mehr nachkommt.
   */
  const end = async () => {
    try {
      await endMonthlyDuty(duty.id, month)
      toast.success(`Läuft aus – letzter Monat ist ${formatMonthKey(month)}.`)
    } catch (error) {
      console.error(error)
      toast.error('Beenden fehlgeschlagen.')
    }
  }

  const resume = async () => {
    try {
      await resumeMonthlyDuty(duty.id)
      toast.success('Fällt wieder jeden Monat an.')
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  const remove = async () => {
    try {
      await deleteMonthlyDuty(duty.id)
      toast.success('Monatspendenz gelöscht.')
    } catch (error) {
      console.error(error)
      toast.error('Löschen fehlgeschlagen.')
    }
  }

  if (editing) {
    return (
      <li className="card p-3">
        <DutyForm
          title={duty.title}
          description={duty.description ?? ''}
          onCancel={() => setEditing(false)}
          onSave={async (values) => {
            await updateMonthlyDuty(duty.id, { ...values, startMonth: duty.startMonth })
            toast.success('Gilt ab dem nächsten Monat.')
            setEditing(false)
          }}
        />
      </li>
    )
  }

  return (
    <li className="card p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{duty.title}</p>
          {duty.description && (
            <p className="mt-0.5 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300">
              {plainText(duty.description)}
            </p>
          )}
          <p className="hint">
            {running
              ? `Fällt jeden Monat an, seit ${formatMonthKey(duty.startMonth)}.`
              : `Beendet – letzter Monat war ${formatMonthKey(duty.endMonth ?? duty.startMonth)}.`}
          </p>
        </div>

        <button
          type="button"
          className="btn-ghost btn-sm shrink-0"
          onClick={() => setEditing(true)}
          aria-label={`«${duty.title}» ändern`}
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {running ? (
          <button type="button" className="btn-secondary btn-sm" onClick={() => void end()}>
            <Ban className="size-3.5" aria-hidden />
            Beenden
          </button>
        ) : (
          <button type="button" className="btn-secondary btn-sm" onClick={() => void resume()}>
            <RotateCcw className="size-3.5" aria-hidden />
            Weiterführen
          </button>
        )}
        <button
          type="button"
          className="btn-ghost btn-sm ml-auto text-rose-600 dark:text-rose-400"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          Löschen
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title="Monatspendenz löschen?"
        message={
          <>
            «{duty.title}» fällt ab sofort nicht mehr an. Die Pendenzen, die bereits daraus
            entstanden sind, bleiben stehen – samt allem, was in ihnen notiert wurde. Soll bloss
            nichts mehr nachkommen, ist «Beenden» der richtige Weg: Dann läuft{' '}
            {formatMonthKey(month)} noch zu Ende.
          </>
        }
        confirmLabel="Endgültig löschen"
        danger
      />
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Erfassen und ändern                                                 */
/* ------------------------------------------------------------------ */

/**
 * Titel und Beschreibung – mehr braucht eine Monatspendenz nicht.
 *
 * Zuständig ist, wer den Monat führt; wann sie anfällt, sagt der Monat. Damit
 * bleiben genau die beiden Felder, die den Unterschied machen.
 */
function DutyForm({
  title,
  description,
  onSave,
  onCancel,
}: {
  title: string
  description: string
  onSave: (values: { title: string; description: string }) => Promise<void>
  onCancel: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState({ title, description })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const trimmed = form.title.trim()
    if (!trimmed) {
      toast.error('Bitte gib einen Titel ein.')
      return
    }
    setSaving(true)
    try {
      await onSave({ title: trimmed, description: form.description })
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="duty-title">
          Titel
        </label>
        <input
          id="duty-title"
          className="input"
          value={form.title}
          maxLength={200}
          autoFocus
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </div>
      <div>
        <label className="label" htmlFor="duty-description">
          Beschreibung
        </label>
        <textarea
          id="duty-description"
          className="input min-h-20 resize-y"
          rows={2}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => void save()}
          disabled={saving}
        >
          <Check className="size-4" aria-hidden />
          {saving ? 'Wird gespeichert …' : 'Speichern'}
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={onCancel} disabled={saving}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
