import { useEffect, useState } from 'react'
import { UserCog } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { UserAvatar } from '@/components/ui/Avatar'
import { PersonButton } from '@/components/ui/Pickers'
import { cn } from '@/lib/utils'
import { formatDateLong, formatMonth } from '@/lib/dates'
import { saveResponsible } from '@/services/sacrament'
import { BISHOPRIC_ROLES, type SacramentMeeting } from '@/lib/types'

/**
 * Wer aus der Bischofschaft sich um diesen Sonntag kümmert.
 *
 * Nicht zu verwechseln mit «Es präsidiert» und «Es leitet»: Die beiden sagen,
 * wer am Pult steht. Hier geht es um die Vorbereitung – Ansprachen anfragen,
 * Gebete verteilen, den Ablauf beisammenhalten. Zur Wahl stehen deshalb nur
 * der Bischof und seine beiden Ratgeber.
 *
 * Aufgeteilt wird das üblicherweise monatsweise: einer nimmt den August, der
 * nächste den September. Der Dialog fragt deshalb nicht nach dem Sonntag,
 * sondern schreibt die Angabe auf Wunsch – und das ist die Voreinstellung –
 * gleich auf alle Sonntage des Monats. Ein einzelner Sonntag lässt sich
 * danach jederzeit abweichend festlegen.
 */

/* ------------------------------------------------------------------ */
/* Knopf                                                               */
/* ------------------------------------------------------------------ */

/**
 * Der Knopf neben «Programm» – er zeigt zugleich, wer zuständig ist.
 *
 * Ein eigenes Etikett daneben bräuchte Platz und sagte dasselbe: Steht ein
 * Name auf dem Knopf, ist die Frage beantwortet; steht «Zuständig» darauf,
 * ist sie offen.
 */
export function ResponsibleButton({
  meeting,
  onClick,
  size = 'md',
}: {
  meeting: SacramentMeeting | null
  onClick: () => void
  size?: 'sm' | 'md'
}) {
  const { usersById } = useData()
  const person = meeting?.responsibleId ? usersById.get(meeting.responsibleId) : undefined

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(size === 'sm' ? 'btn-ghost btn-sm' : 'btn-secondary')}
      title="Wer sich um diesen Sonntag kümmert"
    >
      {person ? (
        <>
          <UserAvatar userId={person.id} name={person.displayName} size="xs" />
          <span className="max-w-28 truncate">{person.displayName.split(' ')[0]}</span>
        </>
      ) : (
        <>
          <UserCog className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
          Zuständig
        </>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export function SundayResponsibleDialog({
  open,
  date,
  meeting,
  onClose,
}: {
  open: boolean
  date: Date
  meeting: SacramentMeeting | null
  onClose: () => void
}) {
  const { users, settings } = useData()
  const toast = useToast()

  const [responsibleId, setResponsibleId] = useState<string | null>(null)
  /* Der Normalfall ist der ganze Monat – deshalb steht der Haken. */
  const [wholeMonth, setWholeMonth] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setResponsibleId(meeting?.responsibleId ?? null)
    setWholeMonth(true)
  }, [open, meeting])

  const selectable = users.filter((user) => user.active && BISHOPRIC_ROLES.includes(user.role))

  const save = async () => {
    setSaving(true)
    try {
      const outcome = await saveResponsible(date, responsibleId, {
        wholeMonth,
        weekday: settings.sacramentWeekday,
      })
      toast.saved(
        wholeMonth
          ? `Für den ganzen ${formatMonth(date)} festgelegt.`
          : 'Zuständigkeit gespeichert.',
        outcome,
      )
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Zuständig"
      description={formatDateLong(date)}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={saving}
          >
            Speichern
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="label">Wer kümmert sich um diesen Sonntag?</span>
          {selectable.length === 0 ? (
            <p className="hint">
              Noch ist niemand als Bischof oder Ratgeber eingetragen – das steht unter
              «Einstellungen → Benutzer und Rollen».
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectable.map((user) => (
                <PersonButton
                  key={user.id}
                  id={user.id}
                  name={user.displayName}
                  selected={user.id === responsibleId}
                  // Ein zweiter Griff auf denselben Namen nimmt die Wahl zurück.
                  onClick={() => setResponsibleId(user.id === responsibleId ? null : user.id)}
                />
              ))}
            </div>
          )}
          <p className="hint">
            Gemeint ist die Vorbereitung – Ansprachen anfragen, Gebete verteilen. Wer präsidiert und
            wer leitet, steht im Ablauf.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-slate-300 dark:border-slate-600"
            checked={wholeMonth}
            onChange={(event) => setWholeMonth(event.target.checked)}
          />
          <span>
            Für den ganzen {formatMonth(date)}
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Gilt für jeden Sonntag dieses Monats. Ohne Haken nur für diesen einen.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  )
}
