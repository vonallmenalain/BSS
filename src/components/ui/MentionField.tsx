import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useData } from '@/contexts/DataContext'
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
  multiline = false,
  className,
  ...rest
}: {
  id: string
  value: string
  onChange: (next: string) => void
  /** Ein gewähltes Mitglied – wird zusätzlich zum Text gemeldet */
  onMention?: (member: Member) => void
  multiline?: boolean
  className?: string
  placeholder?: string
  rows?: number
  required?: boolean
  maxLength?: number
}) {
  const { members } = useData()
  const listId = useId()
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [trigger, setTrigger] = useState<MentionTrigger | null>(null)
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    if (!trigger) return []
    const query = trigger.query.trim()
    const pool = members.filter((member) => member.status === 'active')
    const list = query
      ? pool.filter((member) => matchesSearch(`${member.firstName} ${member.lastName}`, query))
      : pool
    return list.slice(0, 6)
  }, [members, trigger])

  const close = () => setTrigger(null)

  const handleChange = (next: string, caret: number) => {
    onChange(next)
    setTrigger(findMentionTrigger(next, caret))
    // Nach jedem Zeichen steht wieder der erste Treffer zur Wahl.
    setActive(0)
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
    }

    onChange(next)
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
    value,
    onChange: (event: { target: { value: string; selectionStart: number | null } }) =>
      handleChange(event.target.value, event.target.selectionStart ?? event.target.value.length),
    onKeyDown: handleKeyDown,
    // Ein Klick auf einen Treffer muss vor dem Schliessen ankommen.
    onBlur: () => window.setTimeout(close, 150),
    'aria-autocomplete': 'list' as const,
    'aria-controls': trigger ? listId : undefined,
    ...rest,
  }

  return (
    <div className="relative">
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
