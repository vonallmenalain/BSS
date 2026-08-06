import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { AgendaItemEditor } from '@/components/agenda/AgendaItemEditor'
import { DeferMenu } from '@/components/agenda/DeferMenu'
import { deleteAgendaItem, setItemStatus } from '@/services/agenda'
import { hasOpenCallingRows } from '@/lib/callingChanges'
import { ITEM_KIND_LABELS, toItemKind, type AgendaItem, type CallingChanges } from '@/lib/types'

/**
 * Ein Traktandum oder eine Pendenz bearbeiten, ohne die Liste zu verlassen.
 *
 * Gedacht für die Sitzungsliste in der kompakten Ansicht: Dort steht das
 * Programm mehrerer Sitzungen untereinander, und wer beim Lesen etwas
 * ändern will, musste bisher die Sitzung öffnen, den Punkt suchen,
 * aufklappen, ändern und zurück. Ein Griff auf den Eintrag genügt jetzt –
 * dasselbe Formular wie im aufgeklappten Eintrag, nur in einem Fenster.
 *
 * Gespeichert wird wie überall von selbst, kurz nach dem letzten
 * Tastendruck; einen Speichern-Knopf gibt es deshalb nicht. «Schliessen»
 * schliesst nur das Fenster.
 */
export function AgendaItemDialog({
  item,
  onClose,
  nextMeeting,
  readOnly = false,
}: {
  /** Der Eintrag – `null` heisst: Fenster zu */
  item: AgendaItem | null
  onClose: () => void
  /** Ziel für «Verschieben» – die nächste offene Sitzung */
  nextMeeting?: { id: string; date: Date } | null
  readOnly?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const kind = item ? toItemKind(item) : 'traktandum'
  const isDone = item?.status === 'done'

  /*
   * Der Stand der Runde, während darin gearbeitet wird.
   *
   * Gespeichert wird erst beim Verlassen des Eintrags; bis dahin wüsste der
   * Knopf «Erledigt» nichts davon, dass eben die letzte Zeile abgehakt wurde.
   * Beim Wechsel des Eintrags fällt der Merkwert weg.
   */
  const [live, setLive] = useState<CallingChanges | null>(null)
  const [liveFor, setLiveFor] = useState(item?.id ?? null)
  if (liveFor !== (item?.id ?? null)) {
    setLiveFor(item?.id ?? null)
    setLive(null)
  }
  const openRows = !isDone && hasOpenCallingRows(live ?? item?.callingChanges)

  const toggleDone = async () => {
    if (!item || !profile) return
    try {
      await setItemStatus(item.id, isDone ? 'pending' : 'done', {
        id: profile.id,
        name: profile.displayName,
      })
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  const remove = async () => {
    if (!item) return
    try {
      await deleteAgendaItem(item.id)
      toast.success(`${ITEM_KIND_LABELS[kind]} gelöscht.`)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Löschen fehlgeschlagen.')
    }
  }

  return (
    <>
      <Modal
        open={item !== null}
        onClose={onClose}
        title={ITEM_KIND_LABELS[kind]}
        /* So breit wie die App: Im Fenster steht dasselbe wie im
           aufgeklappten Eintrag – ein Raster, eine Berufungsrunde, eine
           Tabelle. Schmaler gedrängt wäre es dieselbe Arbeit auf halber
           Fläche. */
        size="page"
        footer={
          <button type="button" className="btn-secondary" onClick={onClose}>
            Schliessen
          </button>
        }
      >
        {item && (
          <div className="space-y-4">
            {/* Der Stand gehört dem Eintrag – deshalb baut sich der Editor je
                Eintrag neu auf. */}
            <AgendaItemEditor
              key={item.id}
              item={item}
              readOnly={readOnly}
              onCallingChanges={setLive}
            />

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                {/* Eine Berufungsrunde wird zeilenweise erledigt; als Ganzes
                    ist sie erst fertig, wenn keine Zeile mehr offen ist
                    (siehe `hasOpenCallingRows`) – bis dahin steht hier kein
                    Knopf. */}
                {!openRows && (
                  <button
                    type="button"
                    className={isDone ? 'btn-secondary btn-sm' : 'btn-success btn-sm'}
                    onClick={() => void toggleDone()}
                  >
                    <Check className="size-4" aria-hidden />
                    {isDone ? 'Wieder offen' : 'Erledigt'}
                  </button>
                )}

                <DeferMenu itemId={item.id} nextMeeting={nextMeeting ?? null} className="btn-sm" />

                <button
                  type="button"
                  className="btn-ghost btn-sm ml-auto text-rose-600 dark:text-rose-400"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Löschen
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title={`${ITEM_KIND_LABELS[kind]} löschen?`}
        message={
          <>
            «{item?.title}» wird endgültig gelöscht – samt Verlauf. Soll der Punkt bloss aus dieser
            Sitzung verschwinden, ist «Verschieben» der richtige Weg.
          </>
        }
        confirmLabel="Endgültig löschen"
        danger
      />
    </>
  )
}
