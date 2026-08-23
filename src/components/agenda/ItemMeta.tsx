import { useData } from '@/contexts/DataContext'
import { formatDate, formatTime } from '@/lib/dates'
import { lastEditedAt, type AgendaItem } from '@/lib/types'

/**
 * Wer den Eintrag angelegt hat – und wer zuletzt daran gearbeitet hat.
 *
 * Steht im Fenster zu einem Traktandum oder einer Pendenz, in der Fusszeile
 * neben den Knöpfen. Die Frage kommt im Sitzungszimmer regelmässig auf
 * («wer hat das eingetragen?»), und bisher war sie nur im aufgeklappten
 * Eintrag zu beantworten – im Fenster stand nichts dazu.
 *
 * Bewusst als eine Zeile aus Text und nicht als Liste mit Beschriftungen:
 * Sie soll dastehen, wenn man sie sucht, und übersehen werden, wenn nicht.
 * Deshalb klein, grau und in einem Satz.
 *
 * Was fehlt, steht nicht da. `editedBy` gibt es erst, seit die App es
 * mitschreibt (siehe `AgendaItem.editedBy`); ältere Einträge nennen deshalb
 * nur ein Datum, und ganz alte gar nichts – ein geratener Name wäre
 * schlimmer als keiner. Bearbeitet jemand, der den Eintrag auch angelegt
 * hat, und ist seither nichts geschehen, bleibt die zweite Hälfte weg: Sie
 * sagte zweimal dasselbe.
 */
export function ItemMeta({ item, className }: { item: AgendaItem; className?: string }) {
  const { userName } = useData()

  const edited = lastEditedAt(item)
  /*
   * «Zuletzt bearbeitet» nur, wenn es etwas Neues sagt: Ein Eintrag, der
   * seit dem Erfassen unangetastet blieb, trägt trotzdem einen Zeitstempel
   * – er stünde dann mit derselben Minute und demselben Namen ein zweites
   * Mal da. Eine Minute Abstand genügt als Unterscheidung; kürzer ist es
   * derselbe Handgriff.
   */
  const changed =
    edited &&
    (!item.createdAt ||
      Math.abs(edited.toMillis() - item.createdAt.toMillis()) > 60_000 ||
      (item.editedBy && item.editedBy !== item.createdBy))

  const parts: string[] = []
  if (item.createdAt) {
    parts.push(
      `Erstellt${item.createdBy ? ` von ${userName(item.createdBy)}` : ''} · ${when(item.createdAt)}`,
    )
  }
  if (edited && changed) {
    parts.push(
      `Zuletzt bearbeitet${item.editedBy ? ` von ${userName(item.editedBy)}` : ''} · ${when(edited)}`,
    )
  }

  if (parts.length === 0) return null

  return (
    <p className={className}>
      {parts.map((text, index) => (
        <span key={index} className="mr-3 inline-block whitespace-nowrap">
          {text}
        </span>
      ))}
    </p>
  )
}

/** «14.08.2026, 19:30» – Datum und Uhrzeit in einem Atemzug. */
function when(value: Parameters<typeof formatDate>[0]): string {
  return `${formatDate(value)}, ${formatTime(value)}`
}
