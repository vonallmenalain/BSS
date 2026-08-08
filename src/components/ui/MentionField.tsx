import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useData } from '@/contexts/DataContext'
import { useFormatTarget } from '@/hooks/useFormatTarget'
import { Avatar } from '@/components/ui/Avatar'
import { cn, matchesSearch } from '@/lib/utils'
import { findMentionTrigger, type MentionTrigger } from '@/lib/mention'
import type { Member } from '@/lib/types'

/**
 * Ein Textfeld, in dem `@` die Mitgliederliste öffnet.
 *
 * Beim Erfassen eines Traktandums geht es fast immer um jemanden, und der
 * Name ist beim Schreiben schon im Kopf – nur steht die Auswahl weiter
 * unten im Formular. Ein `@` mitten im Satz nimmt den Umweg heraus: tippen,
 * Namen wählen, weiterschreiben. Der Name landet als Text im Feld, und das
 * Mitglied wird zugleich unter «Betrifft Mitglieder» verknüpft – dort, wo
 * die App später nach Zusammenhängen sucht.
 *
 * Bewusst kein fremdes Paket und kein `contentEditable`: Es bleibt ein
 * gewöhnliches Feld, das ein Zeichen beobachtet. Was getippt wurde, bleibt
 * damit auch dann stehen, wenn niemand aus der Liste passt.
 */

export function MentionField({
  id,
  value,
  onChange,
  onMention,
  onBlur,
  onCaret,
  caret,
  multiline = false,
  autoFocus = false,
  autoGrow = false,
  minHeight,
  className,
  wrapperClassName,
  ...rest
}: {
  id: string
  value: string
  onChange: (next: string) => void
  /** Ein gewähltes Mitglied – wird zusätzlich zum Text gemeldet */
  onMention?: (member: Member) => void
  /** Läuft nach dem Verlassen des Feldes – nie beim Klick in die Trefferliste */
  onBlur?: () => void
  /**
   * Wo der Cursor steht – nach jedem Zeichen und jeder Bewegung.
   *
   * Der Aufrufer merkt sich damit die Stelle, an der geschrieben wird, und
   * findet sie wieder, wenn das Feld zwischendurch neu aufgebaut wird (siehe
   * `lib/writing`).
   */
  onCaret?: (start: number, end: number) => void
  /**
   * Wohin der Cursor beim Erscheinen gehört. Ohne Angabe ans Ende – wer vom
   * Lesen ins Schreiben wechselt, will weiterschreiben und nicht vorne
   * beginnen.
   */
  caret?: { start: number; end: number } | null
  multiline?: boolean
  /** Beim Erscheinen den Cursor setzen und das Feld anwählen */
  autoFocus?: boolean
  /**
   * Das Feld wächst mit dem Text – nur mehrzeilig sinnvoll.
   *
   * Ohne das steht in einem Kasten von drei Zeilen ein Text von zwanzig, und
   * wer ihn ändern will, scrollt in einem Guckloch. Von Hand vergrössern
   * lässt er sich weiterhin.
   */
  autoGrow?: boolean
  /** Mindesthöhe in Pixeln – so gross wie der Text, der vorher dastand */
  minHeight?: number
  className?: string
  /**
   * Klassen für den Rahmen um Feld und Trefferliste. Nötig, wo das Feld eine
   * vorgegebene Höhe füllen soll – im variablen Layout etwa muss es die
   * Rasterzelle ausfüllen, und dazu muss der Rahmen mitwachsen.
   */
  wrapperClassName?: string
  placeholder?: string
  rows?: number
  required?: boolean
  maxLength?: number
  'aria-label'?: string
}) {
  const { members } = useData()
  const listId = useId()
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [trigger, setTrigger] = useState<MentionTrigger | null>(null)
  const [active, setActive] = useState(0)

  /*
   * Das Feld meldet sich beim Formatierungsmenü an.
   *
   * Es steht oben rechts an der Karte und nicht am Feld – siehe
   * `components/ui/FormatMenu`. Ein Feld, an dem gar kein Menü hängt (das
   * Formular zum Erfassen etwa), meldet sich trotzdem an; das kostet nichts.
   */
  useFormatTarget(fieldRef, { onChange, onCaret, multiline })

  /*
   * Anwählen und den Cursor setzen – noch bevor gezeichnet wird.
   *
   * Wer aus dem Lesen ins Schreiben wechselt, will weiterschreiben und nicht
   * vorne beginnen; der Cursor gehört deshalb ans Ende. Wird das Feld
   * mittendrin neu aufgebaut, weil sich die Liste umgeordnet hat, sagt
   * `caret`, wo er stand – dann geht es dort weiter, wo aufgehört wurde.
   *
   * Es zählt der Stand beim Erscheinen: Danach gehört der Cursor dem Feld,
   * und ihn später noch einmal zu setzen risse ihn mitten im Satz weg.
   */
  const start = useRef(caret)
  useLayoutEffect(() => {
    if (!autoFocus) return
    const field = fieldRef.current
    if (!field) return
    const last = field.value.length
    const from = Math.min(start.current?.start ?? last, last)
    const to = Math.min(start.current?.end ?? last, last)
    field.focus()
    field.setSelectionRange(from, to)
  }, [autoFocus])

  const results = useMemo(() => {
    if (!trigger) return []
    const query = trigger.query.trim()
    const pool = members.filter((member) => member.status === 'active')
    const list = query
      ? pool.filter((member) => matchesSearch(`${member.firstName} ${member.lastName}`, query))
      : pool
    return list.slice(0, 6)
  }, [members, trigger])

  /*
   * Mit dem Text wachsen.
   *
   * Erst auf `auto` zurück, dann auf die tatsächliche Höhe des Inhalts:
   * Ohne den Zwischenschritt bliebe das Feld beim Löschen von Zeilen gross.
   */
  const grow = useCallback(() => {
    const field = fieldRef.current
    if (!field || !multiline || !autoGrow) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [multiline, autoGrow])

  useLayoutEffect(grow, [grow, value])

  const close = () => setTrigger(null)

  const handleChange = (next: string, at: number) => {
    onChange(next)
    onCaret?.(at, at)
    setTrigger(findMentionTrigger(next, at))
    // Nach jedem Zeichen steht wieder der erste Treffer zur Wahl.
    setActive(0)
  }

  /** Wo der Cursor jetzt steht – für den Merkzettel des Aufrufers. */
  const reportCaret = () => {
    const field = fieldRef.current
    if (!field || !onCaret) return
    onCaret(field.selectionStart ?? field.value.length, field.selectionEnd ?? field.value.length)
  }

  /** Den angefangenen `@Namen` durch den vollen Namen ersetzen. */
  const choose = (member: Member) => {
    if (!trigger) return
    const name = `${member.firstName} ${member.lastName}`
    const next = `${value.slice(0, trigger.start)}${name}${value.slice(
      trigger.start + 1 + trigger.query.length,
    )}`
    const caret = trigger.start + name.length

    /*
     * Erst ins Feld schreiben, dann melden: Der Cursor gehört hinter den
     * eingesetzten Namen und nicht ans Ende des Textes. Setzte man ihn erst
     * nach dem Neuzeichnen, landete das nächste getippte Zeichen noch hinten
     * – man schreibt ja weiter, ohne auf die Oberfläche zu warten. Weil der
     * Wert danach derselbe ist, rührt React das Feld nicht mehr an.
     */
    const field = fieldRef.current
    if (field) {
      field.focus()
      field.value = next
      field.setSelectionRange(caret, caret)
      grow()
    }

    onChange(next)
    onCaret?.(caret, caret)
    onMention?.(member)
    close()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!trigger || results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (current + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      choose(results[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  const shared = {
    id,
    ref: fieldRef as never,
    className: cn('input', className),
    style: minHeight ? { minHeight } : undefined,
    value,
    onChange: (event: { target: { value: string; selectionStart: number | null } }) =>
      handleChange(event.target.value, event.target.selectionStart ?? event.target.value.length),
    onKeyDown: handleKeyDown,
    // Cursor und Auswahl melden – React meldet `select` auch dann, wenn bloss
    // der Cursor mit Pfeiltasten oder Klick weiterwandert.
    onSelect: reportCaret,
    /*
     * Ein Klick auf einen Treffer muss vor dem Schliessen ankommen. Er nimmt
     * den Fokus gar nicht erst weg (`onMouseDown` verhindert das), deshalb
     * darf `onBlur` hier auch nach aussen melden: Wer das Feld verlässt, hat
     * zu Ende geschrieben.
     *
     * Eine Ausnahme: Ein Feld, das gerade **abgebaut** wird, hat niemand
     * verlassen. Ordnet sich die Liste um, nimmt React das Element aus dem
     * Dokument und setzt es andernorts wieder ein; der Browser meldet dabei
     * den Fokusverlust. Wer das als «fertig geschrieben» läse, fiele
     * ausgerechnet dann ins Lesen zurück, wenn jemand mitten im Satz ist –
     * deshalb zählt nur der Fokusverlust eines Feldes, das noch im Dokument
     * steht.
     */
    onBlur: (event: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
      window.setTimeout(close, 150)
      if (!event.currentTarget.isConnected) return
      onBlur?.()
    },
    'aria-autocomplete': 'list' as const,
    'aria-controls': trigger ? listId : undefined,
    ...rest,
  }

  return (
    <div className={cn('relative', wrapperClassName)}>
      {multiline ? <textarea {...shared} /> : <input {...shared} />}

      {trigger && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {results.map((member, index) => (
            <li key={member.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(member)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                  index === active
                    ? 'bg-slate-100 dark:bg-slate-700'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/60',
                )}
              >
                <Avatar name={`${member.firstName} ${member.lastName}`} id={member.id} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  {member.firstName} {member.lastName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
