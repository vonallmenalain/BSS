import { Modal } from '@/components/ui/Modal'
import { CleaningReminderPanel } from '@/components/cleaning/CleaningReminderPanel'
import type { CleaningGroup, CleaningWeek } from '@/lib/types'

/**
 * Der Dialog hinter dem Knopf «Erinnerung» über dem Putzplan – für alle,
 * mit und ohne Konto. Der Inhalt steht in `CleaningReminderPanel`; dieselbe
 * Einstellung findet ein angemeldetes Konto auch unter den
 * Benachrichtigungen.
 */
export function CleaningReminderDialog({
  groups,
  weeks,
  initialGroup = null,
  onClose,
}: {
  groups: readonly CleaningGroup[]
  weeks: readonly CleaningWeek[]
  initialGroup?: number | null
  onClose: () => void
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Erinnerung"
      description="Eine Nachricht auf dieses Gerät, wenn eine Gruppe mit Putzen dran ist."
      size="md"
    >
      <CleaningReminderPanel
        groups={groups}
        weeks={weeks}
        initialGroup={initialGroup}
        onSaved={onClose}
      />
    </Modal>
  )
}
