import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import { MentionField } from '@/components/ui/MentionField'
import { cn } from '@/lib/utils'
import { splitMentions, type Mention } from '@/lib/mention'
import type { Member } from '@/lib/types'

/**
 * Text, in dem die mit «@» eingesetzten Namen anklickbar sind.
 *
 * Das `@` selbst verschwindet beim Einsetzen – im Text steht der Name, wie
 * ihn jemand geschrieben hätte. Damit er trotzdem irgendwohin führt, merkt
 * sich der Eintrag daneben, wer gemeint war (`memberRefs`); hier werden beide
 * Seiten wieder zusammengebracht.
 *
 * Der Verweis nimmt mit, woher er kommt. So führt das «Zurück» auf der
 * Mitgliederseite nicht in die Mitgliederliste, sondern genau zu dem
 * Traktandum, das man gerade gelesen hat.
 */
export function MentionText({
  text,
  memberRefs,
  className,
  placeholder,
}: {
  text: string
  memberRefs?: string[]
  className?: string
  /** Was steht, wenn der Text leer ist. */
  placeholder?: string
}) {
  const { membersById } = useData()
  const location = useLocation()

  const parts = useMemo(() => {
    const mentions: Mention[] = (memberRefs ?? [])
      .map((id) => membersById.get(id))
      .filter((member): member is Member => member !== undefined)
      .map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}` }))
    return splitMentions(text, mentions)
  }, [text, memberRefs, membersById])

  if (!text) {
    return placeholder ? <span className="text-slate-400">{placeholder}</span> : null
  }

  const from = `${location.pathname}${location.search}`

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.memberId ? (
          <Link
            key={index}
            to={`/mitglieder/${part.memberId}`}
            state={{ from, fromLabel: 'Traktandum' }}
            onClick={(event) => event.stopPropagation()}
            className="text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/60 rounded px-0.5 underline decoration-dotted underline-offset-2 transition"
          >
            {part.text}
          </Link>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  )
}

/**
 * Dasselbe Stück Text, geschrieben statt gelesen.
 *
 * In einem Textfeld ist ein Name nur Text; anklickbar wird er erst, wenn er
 * als Verweis gezeichnet ist. Deshalb zeigt der Eintrag zunächst den lesbaren
 * Text, und ein Griff hinein macht daraus das Eingabefeld – ausser auf einem
 * Namen, der führt zur Person. Beim Verlassen steht wieder der lesbare Text
 * da. Denselben Weg geht der Notizeditor; hier kommen die Erwähnungen dazu.
 *
 * Einen Bearbeiten-Knopf gibt es nicht: In der Sitzung wird geschrieben,
 * während gesprochen wird, und jeder Klick, der nur den Schreibmodus einlegt,
 * ist einer zu viel.
 *
 * Das Feld ist dabei so gross wie der Text, der eben noch dastand: Beim
 * Wechsel wird die Höhe des gelesenen Absatzes gemessen und dem Feld als
 * Mindestmass mitgegeben, und danach wächst es mit dem Tippen weiter. Vorher
 * schrumpfte eine lange Pendenz beim Antippen auf drei Zeilen zusammen, und
 * der Rest verschwand hinter dem Rand.
 */
export function MentionEditable({
  id,
  value,
  onChange,
  onMention,
  memberRefs,
  multiline = false,
  readOnly = false,
  placeholder,
  label,
  className,
  fieldClassName,
  rows,
  maxLength,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  onMention?: (member: Member) => void
  memberRefs?: string[]
  multiline?: boolean
  readOnly?: boolean
  placeholder?: string
  /** Für Bildschirmleser, weil über dem Feld keine Beschriftung steht */
  label: string
  /** Klassen für den gelesenen Text */
  className?: string
  /** Klassen für das Eingabefeld – es soll gleich aussehen wie der Text */
  fieldClassName?: string
  rows?: number
  maxLength?: number
}): ReactNode {
  const [writing, setWriting] = useState(false)
  /** Höhe des gelesenen Textes im Moment des Wechsels – das Mass für das Feld. */
  const [readHeight, setReadHeight] = useState<number | undefined>(undefined)
  const readRef = useRef<HTMLDivElement>(null)

  const startWriting = () => {
    const box = readRef.current?.getBoundingClientRect()
    setReadHeight(box ? Math.round(box.height) : undefined)
    setWriting(true)
  }

  if (readOnly) {
    return (
      <div className={className}>
        <MentionText text={value} memberRefs={memberRefs} placeholder={placeholder} />
      </div>
    )
  }

  if (writing) {
    return (
      <MentionField
        id={id}
        aria-label={label}
        value={value}
        onChange={onChange}
        onMention={onMention}
        onBlur={() => setWriting(false)}
        autoFocus
        multiline={multiline}
        autoGrow={multiline}
        minHeight={multiline ? readHeight : undefined}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className={fieldClassName}
      />
    )
  }

  /*
   * Bewusst `onClick` und `onKeyDown` – und kein `onFocus`.
   *
   * Ein Griff auf einen erwähnten Namen setzt zuerst den Fokus und erst danach
   * den Klick ab. Würde der Fokus schon das Eingabefeld einsetzen, wäre der
   * Verweis im Moment des Klicks nicht mehr da, und man landete im Text statt
   * beim Mitglied.
   */
  return (
    <div
      ref={readRef}
      role="textbox"
      tabIndex={0}
      aria-label={label}
      onClick={startWriting}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        startWriting()
      }}
      className={cn(
        'w-full cursor-text rounded-lg px-3 py-2 break-words whitespace-pre-wrap transition',
        'border border-transparent hover:border-slate-200 hover:bg-slate-50',
        'dark:hover:border-slate-800 dark:hover:bg-slate-800/50',
        className,
      )}
    >
      <MentionText text={value} memberRefs={memberRefs} placeholder={placeholder} />
    </div>
  )
}
