import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import { Avatar } from '@/components/ui/Avatar'
import { RichTextField } from '@/components/ui/RichTextField'
import { cn } from '@/lib/utils'
import { splitMentions, type Mention } from '@/lib/mention'
import { splitLinks } from '@/lib/links'
import {
  MAX_LIST_LEVEL,
  docOfValue,
  editTextOf,
  hasMarks,
  markClasses,
  marksOf,
  richDocFor,
  whoDecoration,
  type RichBlock,
  type RichRun,
  type RichValue,
} from '@/lib/richtext'
import {
  caretOf,
  holdWriting,
  isWriting,
  noteCaret,
  releaseWriting,
  startWriting,
  stopWriting,
} from '@/lib/writing'
import type { Member } from '@/lib/types'

/**
 * Formatierter Text, gelesen.
 *
 * Das Gegenstück zu `MentionText`, nur dass hier auch das Formatfeld
 * mitspricht: Fett, Farben, Aufzählungen und die Zuordnung an eine Person
 * werden gezeichnet, Erwähnungen bleiben anklickbar, und in Notizen werden
 * Verweise zu Links (`linkify`).
 *
 * Passt das Formatfeld nicht mehr zum Text – jemand hat mit einer älteren
 * Fassung nur den Text geändert –, steht hier stillschweigend der
 * unformatierte Text: Er ist die Wahrheit, die Formatierung nur die Ansicht
 * dazu (siehe `lib/richtext`).
 */
export function RichText({
  text,
  rich,
  memberRefs,
  linkify = false,
  placeholder,
  className,
}: {
  text: string
  rich?: string | null
  /** Erwähnte Mitglieder – macht ihre Namen anklickbar wie in `MentionText` */
  memberRefs?: string[]
  /** Verweise (`https://…`) anklickbar machen – für Notizen */
  linkify?: boolean
  placeholder?: string
  className?: string
}): ReactNode {
  const doc = useMemo(() => richDocFor(rich ?? null, text), [rich, text])
  const decorate = useDecorator(memberRefs, linkify)

  if (!text) {
    return placeholder ? <span className="text-slate-400">{placeholder}</span> : null
  }

  if (!doc) {
    return <span className={cn('whitespace-pre-wrap', className)}>{decorate(text, 'plain')}</span>
  }

  const renderBlock = (block: RichBlock, key: number): ReactNode =>
    block.runs.length === 0 ? <br /> : renderRuns(block.runs, decorate, `b${key}`)

  // Ein einzelner Absatz bleibt Fliesstext – er darf in einer Überschrift
  // oder einem `<p>` stehen, ohne dass ein Blockelement hineingerät.
  if (doc.blocks.length === 1 && !doc.blocks[0].list) {
    return (
      <span className={cn('whitespace-pre-wrap', className)}>{renderBlock(doc.blocks[0], 0)}</span>
    )
  }

  return (
    <div className={cn('richtext whitespace-pre-wrap', className)}>
      {blockNodes(doc.blocks, renderBlock)}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Läufe zeichnen                                                      */
/* ------------------------------------------------------------------ */

type Decorator = (content: string, key: string) => ReactNode

/**
 * Läufe eines Blocks – zusammenhängend Zugeordnetes wird **ein** Stück.
 *
 * Die Zuordnung gehört optisch zur ganzen Passage: ein Kreis mit den
 * Initialen davor, die gepunktete Unterstreichung darunter. Zeichnete man
 * sie je Lauf, stünde mitten im Satz nach jedem Farbwechsel ein neuer Kreis.
 */
function renderRuns(runs: RichRun[], decorate: Decorator, keyBase: string): ReactNode {
  const groups: { who?: string; runs: RichRun[] }[] = []
  for (const run of runs) {
    const last = groups[groups.length - 1]
    if (last && (last.who ?? '') === (run.who ?? '')) last.runs.push(run)
    else groups.push({ who: run.who, runs: [run] })
  }

  return groups.map((group, groupIndex) => {
    const inner = group.runs.map((run, runIndex) => {
      const marks = marksOf(run)
      delete marks.who
      const content = decorate(run.t, `${keyBase}-${groupIndex}-${runIndex}`)
      if (!hasMarks(marks)) return <Fragment key={runIndex}>{content}</Fragment>
      return (
        <span key={runIndex} className={markClasses(marks)}>
          {content}
        </span>
      )
    })
    if (!group.who) return <Fragment key={groupIndex}>{inner}</Fragment>
    return (
      <WhoSpan key={groupIndex} uid={group.who}>
        {inner}
      </WhoSpan>
    )
  })
}

/** Eine zugeordnete Passage: Kreis der Person, Unterstreichung in ihrem Ton. */
function WhoSpan({ uid, children }: { uid: string; children: ReactNode }) {
  const { usersById } = useData()
  const name = usersById.get(uid)?.displayName ?? 'Unbekannt'
  return (
    <span
      className={cn(
        'underline decoration-dotted decoration-2 underline-offset-2',
        whoDecoration(uid),
      )}
      title={`Zugeordnet: ${name}`}
    >
      <span aria-hidden className="mr-0.5 inline-flex align-middle">
        <Avatar name={name} id={uid} size="xs" />
      </span>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Blöcke und Listen                                                   */
/* ------------------------------------------------------------------ */

function blockNodes(
  blocks: RichBlock[],
  renderBlock: (block: RichBlock, key: number) => ReactNode,
): ReactNode[] {
  const out: ReactNode[] = []
  let index = 0
  while (index < blocks.length) {
    const block = blocks[index]
    if (!block.list) {
      out.push(<div key={index}>{renderBlock(block, index)}</div>)
      index++
      continue
    }
    const result = listNodes(blocks, index, 1, renderBlock)
    out.push(<Fragment key={`list-${index}`}>{result.node}</Fragment>)
    index = result.next
  }
  return out
}

/** Aufeinanderfolgende Listenpunkte als verschachtelte `<ul>`. */
function listNodes(
  blocks: RichBlock[],
  start: number,
  level: number,
  renderBlock: (block: RichBlock, key: number) => ReactNode,
): { node: ReactNode; next: number } {
  const items: ReactNode[] = []
  let index = start
  while (index < blocks.length) {
    const block = blocks[index]
    const blockLevel = block.list ? Math.min(block.list, MAX_LIST_LEVEL) : 0
    if (blockLevel === 0 || blockLevel < level) break

    if (blockLevel === level) {
      const key = index
      const content = renderBlock(block, key)
      let sub: ReactNode = null
      const following = blocks[index + 1]
      if (following?.list && following.list > level) {
        const nested = listNodes(blocks, index + 1, level + 1, renderBlock)
        sub = nested.node
        index = nested.next
      } else {
        index++
      }
      items.push(
        <li key={key}>
          {content}
          {sub}
        </li>,
      )
    } else {
      // Ebene übersprungen (2 ohne 1): Liste direkt in Liste.
      const nested = listNodes(blocks, index, blockLevel, renderBlock)
      items.push(<Fragment key={`deep-${index}`}>{nested.node}</Fragment>)
      index = nested.next
    }
  }
  return { node: <ul>{items}</ul>, next: index }
}

/* ------------------------------------------------------------------ */
/* Erwähnungen und Verweise im Lauftext                                */
/* ------------------------------------------------------------------ */

/**
 * Zeichnet ein Stück Lauftext – mit anklickbaren Namen und Verweisen.
 *
 * Dieselbe Darstellung wie `MentionText` bzw. der Notiz-Verweis: Ein Name
 * ist ein Kreis mit Initialen und führt zur Person, ein Verweis öffnet sich
 * in einem neuen Tab. Gesucht wird je Lauf – ein Name, den eine Formatgrenze
 * zerschneidet, bleibt gewöhnlicher Text (und der Verweis daneben besteht).
 */
function useDecorator(memberRefs: string[] | undefined, linkify: boolean): Decorator {
  const { membersById } = useData()
  const location = useLocation()

  return useMemo(() => {
    const mentions: Mention[] = (memberRefs ?? [])
      .map((id) => membersById.get(id))
      .filter((member): member is Member => member !== undefined)
      .map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}` }))
    const from = `${location.pathname}${location.search}`

    return (content: string, key: string): ReactNode => {
      const pieces = mentions.length > 0 ? splitMentions(content, mentions) : [{ text: content }]
      return pieces.map((piece, index) => {
        if ('memberId' in piece && piece.memberId) {
          return (
            <Link
              key={`${key}-${index}`}
              to={`/mitglieder/${piece.memberId}`}
              state={{ from, fromLabel: 'Traktandum' }}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 align-middle font-medium transition hover:underline"
            >
              <span aria-hidden>
                <Avatar name={piece.text} id={piece.memberId} size="xs" />
              </span>
              {piece.text}
            </Link>
          )
        }
        if (!linkify) return <Fragment key={`${key}-${index}`}>{piece.text}</Fragment>
        return splitLinks(piece.text).map((part, partIndex) =>
          part.href ? (
            <a
              key={`${key}-${index}-${partIndex}`}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="text-brand-700 dark:text-brand-300 pointer-events-auto relative z-10 break-words underline underline-offset-2"
            >
              {part.text}
            </a>
          ) : (
            <Fragment key={`${key}-${index}-${partIndex}`}>{part.text}</Fragment>
          ),
        )
      })
    }
  }, [membersById, memberRefs, linkify, location])
}

/* ------------------------------------------------------------------ */
/* Lesen und Schreiben in einem                                        */
/* ------------------------------------------------------------------ */

/**
 * Dasselbe Stück Text, geschrieben statt gelesen – mit Formatierung.
 *
 * Der Zwilling von `MentionEditable`, nur dass hier das formatierte Feld
 * einsetzt: Ein Griff in den Text macht daraus den Editor samt Formatmenü,
 * beim Verlassen steht wieder der gelesene Text da. Schreibmodus und Cursor
 * überleben den Neuaufbau der Liste über den Merkzettel in `lib/writing` –
 * derselbe Mechanismus, dieselben Zeichenstellen.
 */
export function RichEditable({
  id,
  value,
  onChange,
  onMention,
  memberRefs,
  linkify = false,
  multiline = false,
  readOnly = false,
  placeholder,
  label,
  className,
  fieldClassName,
}: {
  id: string
  value: RichValue
  onChange: (next: RichValue) => void
  onMention?: (member: Member) => void
  memberRefs?: string[]
  linkify?: boolean
  multiline?: boolean
  readOnly?: boolean
  placeholder?: string
  /** Für Bildschirmleser, weil über dem Feld keine Beschriftung steht */
  label: string
  /** Klassen für den gelesenen Text */
  className?: string
  /** Klassen für das Eingabefeld – es soll gleich aussehen wie der Text */
  fieldClassName?: string
}): ReactNode {
  const [writing, setWriting] = useState(() => isWriting(id))
  /** Höhe des gelesenen Textes im Moment des Wechsels – das Mass für das Feld. */
  const [readHeight, setReadHeight] = useState<number | undefined>(undefined)
  const readRef = useRef<HTMLDivElement>(null)

  // Der Merkzettel überlebt genau die Lücke zwischen Abbau und Wiederaufbau –
  // siehe `MentionEditable`, das denselben Weg geht.
  useLayoutEffect(() => {
    holdWriting(id)
    return () => releaseWriting(id)
  }, [id])

  const beginWriting = () => {
    const box = readRef.current?.getBoundingClientRect()
    setReadHeight(box ? Math.round(box.height) : undefined)
    startWriting(id, editTextOf(docOfValue(value)).length)
    setWriting(true)
  }

  const endWriting = () => {
    stopWriting(id)
    setWriting(false)
  }

  if (readOnly) {
    return (
      <div className={className}>
        <RichText
          text={value.text}
          rich={value.rich}
          memberRefs={memberRefs}
          linkify={linkify}
          placeholder={placeholder}
        />
      </div>
    )
  }

  if (writing) {
    return (
      <RichTextField
        id={id}
        aria-label={label}
        value={value}
        onChange={onChange}
        onMention={onMention}
        onBlur={endWriting}
        onCaret={(start, end) => noteCaret(id, start, end)}
        caret={caretOf(id)}
        autoFocus
        singleLine={!multiline}
        minHeight={multiline ? readHeight : undefined}
        placeholder={placeholder}
        className={fieldClassName}
      />
    )
  }

  return (
    <div
      ref={readRef}
      role="textbox"
      tabIndex={0}
      aria-label={label}
      onClick={beginWriting}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        beginWriting()
      }}
      className={cn(
        'w-full cursor-text rounded-lg px-3 py-2 break-words whitespace-pre-wrap transition',
        'border border-transparent hover:border-slate-200 hover:bg-slate-50',
        'dark:hover:border-slate-800 dark:hover:bg-slate-800/50',
        className,
      )}
    >
      <RichText
        text={value.text}
        rich={value.rich}
        memberRefs={memberRefs}
        linkify={linkify}
        placeholder={placeholder}
      />
    </div>
  )
}
