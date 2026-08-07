import { UserAvatar } from '@/components/ui/Avatar'
import { useData } from '@/contexts/DataContext'
import { formatDateTime } from '@/lib/dates'
import type { TS } from '@/lib/types'

/**
 * Wer hinter einem Datum steht – als Kürzel neben der Angabe.
 *
 * «Erfasst 12.03.2026 AR» ist eine Angabe und nicht zwei; ausgeschrieben
 * stünde in jeder Zeile ein zweiter Name. Der volle Name und der genaue
 * Zeitpunkt stehen im Tooltip – so bleibt die Zeile schmal und die Auskunft
 * trotzdem vollständig.
 *
 * Bewusst nur dort, wo das Datum schon dasteht: im aufgeklappten Eintrag
 * (`ItemDates`). In der Liste zählt beim Durchgehen, wer etwas zu tun hat –
 * dort steht das Kürzel der Zuständigen und sonst keines.
 *
 * **Was hier nicht steht:** wer welchen Satz getippt hat. Festgehalten wird
 * der Eintrag als Ganzes, nicht jede Stelle darin – und für alles, was vor
 * dieser Angabe geschrieben wurde, fehlt selbst das: Nachträglich lässt es
 * sich nicht ermitteln, und ein geratener Name wäre schlimmer als keiner.
 */
export function AuthorChip({ userId, label, date }: { userId: string; label: string; date?: TS }) {
  const { userName } = useData()
  const when = date ? ` · ${formatDateTime(date)}` : ''

  return <UserAvatar userId={userId} size="xs" title={`${label}: ${userName(userId)}${when}`} />
}
