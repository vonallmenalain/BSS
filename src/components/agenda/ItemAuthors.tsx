import { UserAvatar } from '@/components/ui/Avatar'
import { useData } from '@/contexts/DataContext'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { lastEditedAt, type AgendaItem, type TS } from '@/lib/types'

/**
 * Wer einen Eintrag erfasst und wer zuletzt daran gearbeitet hat.
 *
 * Zwei Kürzel, mehr nicht – ausgeschrieben stünde in jeder Zeile zweimal ein
 * Name, und die Frage «wer war das?» stellt sich selten genug, dass ein
 * Zeigen genügt. Der volle Name und der genaue Zeitpunkt stehen im Tooltip;
 * so bleibt die Zeile schmal und die Auskunft trotzdem vollständig.
 *
 * Sind beide dieselbe Person, steht das Kürzel einmal da: Wer einen Punkt
 * erfasst und danach selbst ergänzt hat, hat ihn nicht zu zweit bearbeitet.
 *
 * **Was hier nicht steht:** wer welchen Satz getippt hat. Festgehalten wird
 * der Eintrag als Ganzes, nicht jede Stelle darin – und für alles, was vor
 * dieser Angabe geschrieben wurde, fehlt selbst das: Nachträglich lässt es
 * sich nicht ermitteln, und ein geratener Name wäre schlimmer als keiner.
 */
export function ItemAuthors({ item, className }: { item: AgendaItem; className?: string }) {
  const created = item.createdBy
  const edited = item.editedBy
  const alone = !edited || edited === created

  if (!created && !edited) return null

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {created && (
        <AuthorChip
          userId={created}
          label={alone && edited ? 'Erfasst und zuletzt bearbeitet' : 'Erfasst'}
          date={alone && edited ? lastEditedAt(item) : item.createdAt}
        />
      )}
      {!alone && edited && (
        <AuthorChip userId={edited} label="Zuletzt bearbeitet" date={lastEditedAt(item)} />
      )}
    </span>
  )
}

/**
 * Ein Kürzel mit seiner Auskunft im Tooltip.
 *
 * Auch einzeln zu haben – dort, wo das Datum schon angeschrieben dasteht und
 * nur noch die Person fehlt (siehe `ItemDates`).
 */
export function AuthorChip({ userId, label, date }: { userId: string; label: string; date?: TS }) {
  const { userName } = useData()
  const when = date ? ` · ${formatDateTime(date)}` : ''

  return <UserAvatar userId={userId} size="xs" title={`${label}: ${userName(userId)}${when}`} />
}
