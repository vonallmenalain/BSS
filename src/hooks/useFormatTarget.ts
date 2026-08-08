import { useEffect, useRef, type RefObject } from 'react'
import {
  focusFormatTarget,
  registerFormatTarget,
  unregisterFormatTarget,
  type FormatField,
} from '@/lib/formatTarget'

/**
 * Dieses Textfeld darf das Formatierungsmenü bedienen.
 *
 * Ein Aufruf je Feld – mehr braucht es nicht. Das Menü sitzt weit weg, oben
 * rechts an der Karte; wie es dorthin findet, steht in `lib/formatTarget`.
 *
 * **Nur mehrzeilige Felder.** Ausgezeichnet wird, wo etwas ausgeschrieben
 * steht: die Beschreibung eines Traktandums, der Text einer Notiz, eine Zelle
 * der Berufungsrunde. Ein Titel bleibt ein Titel – er steht in jeder Liste,
 * jeder Rückfrage und jedem Protokoll noch einmal, und überall müsste dann
 * dasselbe Rot herauskommen. Das ist viel Aufwand für eine Zeile, die ohnehin
 * fett gesetzt ist.
 *
 * Die Rückrufe liegen in einer Ref und nicht in der Abhängigkeitsliste: Sie
 * werden beim Schreiben in fast jedem Durchgang neu angelegt, und eine
 * Anmeldung, die sich nach jedem Tastendruck ab- und wieder anmeldet, verlöre
 * genau das, was sie festhalten soll.
 */
export function useFormatTarget(
  ref: RefObject<FormatField | null>,
  options: {
    onChange: (next: string) => void
    /** Wo der Cursor danach steht – für den Merkzettel in `lib/writing`. */
    onCaret?: (start: number, end: number) => void
    /** Nur mehrzeilige Felder melden sich an. */
    multiline?: boolean
  },
): void {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  const { multiline } = options

  useEffect(() => {
    const field = ref.current
    if (!field || !multiline) return

    const onFocus = () => focusFormatTarget(field)
    field.addEventListener('focus', onFocus)
    registerFormatTarget({
      field,
      multiline,
      onChange: (next) => latest.current.onChange(next),
      onCaret: (start, end) => latest.current.onCaret?.(start, end),
    })

    return () => {
      field.removeEventListener('focus', onFocus)
      unregisterFormatTarget(field)
    }
  }, [ref, multiline])
}
