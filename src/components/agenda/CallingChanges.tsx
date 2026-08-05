import { useId, useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { Avatar } from '@/components/ui/Avatar'
import { MemberLink } from '@/components/ui/MemberLink'
import { MentionEditable } from '@/components/ui/MentionText'
import { MemberPicker, PersonButton } from '@/components/ui/Pickers'
import {
  CALLING_TABLE_TITLES,
  isCallingMemberRowEmpty,
  isCallingOpenRowEmpty,
  newCallingMemberRow,
  newCallingOpenRow,
} from '@/lib/callingChanges'
import { cn } from '@/lib/utils'
import {
  CALLING_URGENCY_LABELS,
  CALLING_URGENCY_ORDER,
  FULL_ACCESS_ROLES,
  type CallingChanges,
  type CallingMemberRow,
  type CallingOpenRow,
  type CallingRowBase,
  type CallingUrgency,
  type Member,
} from '@/lib/types'

/**
 * Die Berufungsrunde: zwei Tabellen untereinander.
 *
 * **Mitglieder ohne Berufungen** – wer eine neue Aufgabe braucht: der Name
 * (auch zwei, wenn ein Ehepaar zusammen besprochen wird), was heute ist,
 * was in Frage käme. **Offene Berufungen** – die Gegenrichtung: welche
 * Aufgabe niemanden hat, wer dafür in Frage käme, wie es weitergeht.
 *
 * Es ist eine Ideenliste. Nichts davon ändert eine Berufung oder einen
 * Mitgliederdatensatz – das tut allein das LCR und der Import von dort.
 *
 * Drei Dinge tragen die Ansicht:
 *
 *  - **Die Farbe gehört der Zeile.** Rot, Orange, Grün sagen, wie dringend
 *    es ist; oben rechts blenden dieselben drei Kreise aus, was gerade
 *    nicht interessiert. Der Text bleibt in jeder Farbe lesbar – gefärbt
 *    ist der Hintergrund nur so weit, dass sich die Zeilen trennen lassen.
 *  - **Die Zuständigkeit gehört der Zeile.** Eine Runde geht zwanzig Namen
 *    durch, und die verteilt man untereinander. Wer eine Zeile trägt, hat
 *    den ganzen Eintrag unter «Pendenzen → Meine».
 *  - **Am Telefon steht alles untereinander.** Drei Spalten mit
 *    mehrzeiligem Text passen dort nicht nebeneinander; die
 *    Spaltenüberschriften erscheinen deshalb ab Tabletbreite, darunter
 *    trägt jedes Feld seine eigene.
 */
export function CallingChangesTables({
  value,
  onChange,
  onMention,
  memberRefs,
  readOnly = false,
}: {
  value: CallingChanges
  /** Fehlt sie, sind die Tabellen nur zu lesen. */
  onChange?: (next: CallingChanges) => void
  /** Ein mit «@» eingesetztes Mitglied – der Aufrufer merkt es sich */
  onMention?: (member: Member) => void
  /** Verweise des Eintrags, damit Namen im Text anklickbar bleiben */
  memberRefs?: string[]
  readOnly?: boolean
}) {
  const baseId = useId()
  const editable = Boolean(onChange) && !readOnly

  /*
   * Welche Farben gerade zu sehen sind.
   *
   * Eine Frage des Bildschirms, vor dem man sitzt, und keine der Daten:
   * Wer die grünen Zeilen wegklickt, um die dringenden durchzugehen, hat
   * damit nichts geändert. Deshalb steht die Wahl hier und nicht in
   * Firestore – und sie beginnt jedes Mal bei «alle».
   */
  const [shown, setShown] = useState<CallingUrgency[]>(CALLING_URGENCY_ORDER)
  const filtering = shown.length < CALLING_URGENCY_ORDER.length

  /*
   * Alle drei an heisst: kein Filter – dann stehen auch die Zeilen da, die
   * noch keine Farbe haben. Sobald eine Farbe weggeklickt ist, gilt die
   * Auswahl streng: Zu sehen ist genau, was gewählt wurde. Was dabei
   * wegfällt, steht als Zahl unter der Tabelle; still verschwinden soll
   * nichts.
   */
  const visible = (row: CallingRowBase) =>
    !filtering || (row.urgency !== undefined && shown.includes(row.urgency))

  const showAll = () => setShown(CALLING_URGENCY_ORDER)

  const patch = (next: Partial<CallingChanges>) => onChange?.({ ...value, ...next })

  const changeMember = (id: string, fields: Partial<CallingMemberRow>) =>
    patch({ members: value.members.map((row) => (row.id === id ? { ...row, ...fields } : row)) })

  const changeOpen = (id: string, fields: Partial<CallingOpenRow>) =>
    patch({ open: value.open.map((row) => (row.id === id ? { ...row, ...fields } : row)) })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <UrgencyFilter value={shown} onChange={setShown} />
      </div>

      <CallingTable
        title={CALLING_TABLE_TITLES.members}
        hint="Wer eine neue Aufgabe braucht."
        columns={['Name', 'Berufung', 'Vorschläge']}
        editable={editable}
        hidden={value.members.filter((row) => !visible(row)).length}
        onAdd={() => {
          showAll()
          patch({ members: [...value.members, newCallingMemberRow()] })
        }}
      >
        {value.members.filter(visible).map((row, index) => (
          <RowFrame
            key={row.id}
            row={row}
            editable={editable}
            position={index + 1}
            onUrgency={(urgency) => changeMember(row.id, { urgency })}
            onAssignees={(assignees) => changeMember(row.id, { assignees })}
            onRemove={
              value.members.length > 1 || !isCallingMemberRowEmpty(row)
                ? () => patch({ members: withoutRow(value.members, row.id, newCallingMemberRow) })
                : undefined
            }
          >
            <Cell label="Name">
              {editable ? (
                <MemberPicker
                  stacked
                  label=""
                  value={row.memberIds}
                  onChange={(next) => changeMember(row.id, { memberIds: next })}
                  placeholder="Name suchen …"
                />
              ) : (
                <MemberNames ids={row.memberIds} />
              )}
            </Cell>
            <Cell label="Berufung">
              <TextCell
                id={`${baseId}-m-${row.id}-calling`}
                label={`Berufung, Zeile ${index + 1}`}
                value={row.calling}
                onChange={(next) => changeMember(row.id, { calling: next })}
                onMention={onMention}
                memberRefs={memberRefs}
                readOnly={!editable}
                placeholder="Heute – und was daran ansteht"
              />
            </Cell>
            <Cell label="Vorschläge">
              <TextCell
                id={`${baseId}-m-${row.id}-ideas`}
                label={`Vorschläge, Zeile ${index + 1}`}
                value={row.ideas}
                onChange={(next) => changeMember(row.id, { ideas: next })}
                onMention={onMention}
                memberRefs={memberRefs}
                readOnly={!editable}
                placeholder="Was in Frage käme"
              />
            </Cell>
          </RowFrame>
        ))}
      </CallingTable>

      <CallingTable
        title={CALLING_TABLE_TITLES.open}
        hint="Welche Aufgabe niemanden hat."
        columns={['Berufung', 'Name (Vorschläge)', 'Weiteres Vorgehen']}
        editable={editable}
        hidden={value.open.filter((row) => !visible(row)).length}
        onAdd={() => {
          showAll()
          patch({ open: [...value.open, newCallingOpenRow()] })
        }}
      >
        {value.open.filter(visible).map((row, index) => (
          <RowFrame
            key={row.id}
            row={row}
            editable={editable}
            position={index + 1}
            onUrgency={(urgency) => changeOpen(row.id, { urgency })}
            onAssignees={(assignees) => changeOpen(row.id, { assignees })}
            onRemove={
              value.open.length > 1 || !isCallingOpenRowEmpty(row)
                ? () => patch({ open: withoutRow(value.open, row.id, newCallingOpenRow) })
                : undefined
            }
          >
            <Cell label="Berufung">
              <TextCell
                id={`${baseId}-o-${row.id}-calling`}
                label={`Offene Berufung, Zeile ${index + 1}`}
                value={row.calling}
                onChange={(next) => changeOpen(row.id, { calling: next })}
                onMention={onMention}
                memberRefs={memberRefs}
                readOnly={!editable}
                placeholder="Welche Aufgabe offen ist"
              />
            </Cell>
            <Cell label="Name (Vorschläge)">
              <TextCell
                id={`${baseId}-o-${row.id}-candidates`}
                label={`Vorschläge, Zeile ${index + 1}`}
                value={row.candidates}
                onChange={(next) => changeOpen(row.id, { candidates: next })}
                onMention={onMention}
                memberRefs={memberRefs}
                readOnly={!editable}
                placeholder="«@» setzt einen Namen ein"
              />
            </Cell>
            <Cell label="Weiteres Vorgehen">
              <TextCell
                id={`${baseId}-o-${row.id}-next`}
                label={`Weiteres Vorgehen, Zeile ${index + 1}`}
                value={row.next}
                onChange={(next) => changeOpen(row.id, { next })}
                onMention={onMention}
                memberRefs={memberRefs}
                readOnly={!editable}
                placeholder="Wer fragt an, bis wann"
              />
            </Cell>
          </RowFrame>
        ))}
      </CallingTable>
    </div>
  )
}

/**
 * Eine Zeile entfernen – und dafür sorgen, dass eine übrig bleibt.
 *
 * Eine Tabelle ohne Zeile liesse sich nicht ausfüllen. Wer die letzte
 * löscht, bekommt deshalb eine leere zurück, statt vor einer Tabelle ohne
 * Eingang zu stehen.
 */
function withoutRow<T extends CallingRowBase>(rows: T[], id: string, fresh: () => T): T[] {
  const rest = rows.filter((row) => row.id !== id)
  return rest.length > 0 ? rest : [fresh()]
}

/* ------------------------------------------------------------------ */
/* Eine Tabelle                                                        */
/* ------------------------------------------------------------------ */

function CallingTable({
  title,
  hint,
  columns,
  editable,
  hidden,
  onAdd,
  children,
}: {
  title: string
  hint: string
  columns: [string, string, string]
  editable: boolean
  /** Wie viele Zeilen der Farbfilter gerade wegnimmt */
  hidden: number
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <section>
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="hint mb-2">{hint}</p>

      {/* Ab Tabletbreite stehen die Überschriften einmal über der Tabelle;
          darunter trägt jedes Feld seine eigene (siehe `Cell`). */}
      <div className="hidden gap-2 px-3 pb-1 sm:grid sm:grid-cols-3">
        {columns.map((column) => (
          <span key={column} className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {column}
          </span>
        ))}
      </div>

      <ul className="space-y-2">{children}</ul>

      {hidden > 0 && (
        <p className="hint">
          {hidden} {hidden === 1 ? 'Zeile ist' : 'Zeilen sind'} ausgeblendet.
        </p>
      )}

      {editable && (
        <button type="button" className="btn-secondary btn-sm mt-2" onClick={onAdd}>
          <Plus className="size-3.5" aria-hidden />
          Zeile
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Eine Zeile                                                          */
/* ------------------------------------------------------------------ */

/**
 * Wie eine Zeile aussieht: die drei Felder, darunter Farbe und
 * Zuständigkeit.
 *
 * Gefärbt wird der Hintergrund nur schwach und der linke Rand kräftig. So
 * lassen sich die Stufen auch nebeneinander auseinanderhalten, ohne dass
 * der Text an Kontrast verliert – und wer Farben schlecht unterscheidet,
 * hat den Namen der Stufe an den Knöpfen und im Ausdruck.
 */
const URGENCY_ROW: Record<CallingUrgency, string> = {
  high: 'border-l-rose-400 bg-rose-50/70 dark:border-l-rose-500 dark:bg-rose-950/30',
  medium: 'border-l-amber-400 bg-amber-50/70 dark:border-l-amber-500 dark:bg-amber-950/30',
  low: 'border-l-emerald-400 bg-emerald-50/70 dark:border-l-emerald-500 dark:bg-emerald-950/30',
}

const URGENCY_DOT: Record<CallingUrgency, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
}

const URGENCY_BADGE: Record<CallingUrgency, string> = {
  high: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
  medium: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  low: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
}

function RowFrame({
  row,
  editable,
  position,
  onUrgency,
  onAssignees,
  onRemove,
  children,
}: {
  row: CallingRowBase
  editable: boolean
  position: number
  onUrgency: (next: CallingUrgency | undefined) => void
  onAssignees: (next: string[]) => void
  /** Fehlt er, ist es die letzte und noch leere Zeile der Tabelle. */
  onRemove?: () => void
  children: ReactNode
}) {
  const { users } = useData()

  // Nur Konten mit Vollzugriff: Wer allein den AP-Kalender sieht, bekommt
  // eine Berufungsrunde gar nicht zu Gesicht.
  const bishopric = users.filter((user) => user.active && FULL_ACCESS_ROLES.includes(user.role))

  return (
    <li
      className={cn(
        'rounded-lg border border-l-4 border-slate-200 p-2 dark:border-slate-800',
        row.urgency ? URGENCY_ROW[row.urgency] : 'border-l-slate-200 dark:border-l-slate-700',
      )}
    >
      <div className="grid gap-2 sm:grid-cols-3">{children}</div>

      {editable ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-black/5 pt-2 dark:border-white/10">
          <UrgencyPicker
            value={row.urgency}
            onChange={onUrgency}
            label={`Dringlichkeit, Zeile ${position}`}
          />

          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Zuständig</span>
            {bishopric.map((user) => (
              <PersonButton
                key={user.id}
                id={user.id}
                name={user.displayName}
                selected={row.assignees.includes(user.id)}
                onClick={() =>
                  onAssignees(
                    row.assignees.includes(user.id)
                      ? row.assignees.filter((id) => id !== user.id)
                      : [...row.assignees, user.id],
                  )
                }
              />
            ))}
          </div>

          {onRemove && (
            <button
              type="button"
              className="btn-ghost ml-auto p-1 text-rose-600 dark:text-rose-400"
              onClick={onRemove}
              aria-label={`Zeile ${position} entfernen`}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        (row.urgency || row.assignees.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {row.urgency && (
              <span className={cn('badge', URGENCY_BADGE[row.urgency])}>
                {CALLING_URGENCY_LABELS[row.urgency]}
              </span>
            )}
            {row.assignees.map((id) => (
              <AssigneeChip key={id} id={id} />
            ))}
          </div>
        )
      )}
    </li>
  )
}

function AssigneeChip({ id }: { id: string }) {
  const { userName } = useData()
  return (
    <span className="chip bg-slate-100 pl-0.5 dark:bg-slate-800">
      <Avatar name={userName(id)} id={id} size="xs" />
      {userName(id)}
    </span>
  )
}

/**
 * Ein Feld samt Beschriftung.
 *
 * Die Beschriftung steht nur am Telefon da: Ab Tabletbreite steht sie
 * einmal über der Tabelle, und zweimal dasselbe zu lesen bringt niemandem
 * etwas.
 */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden dark:text-slate-400">
        {label}
      </span>
      {children}
    </div>
  )
}

/** Ein mehrzeiliges Freitextfeld, in dem «@» die Mitgliederliste öffnet. */
function TextCell({
  id,
  label,
  value,
  onChange,
  onMention,
  memberRefs,
  readOnly,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  onMention?: (member: Member) => void
  memberRefs?: string[]
  readOnly: boolean
  placeholder: string
}) {
  return (
    <MentionEditable
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      onMention={onMention}
      memberRefs={memberRefs}
      multiline
      rows={2}
      readOnly={readOnly}
      placeholder={readOnly ? undefined : placeholder}
      className="min-h-10 rounded-lg text-sm"
      fieldClassName="min-h-10 resize-y text-sm"
    />
  )
}

/** Die gewählten Namen, wenn nur gelesen wird – jeder führt zur Person. */
function MemberNames({ ids }: { ids: string[] }) {
  const { membersById } = useData()

  if (ids.length === 0) return <span className="px-3 text-sm text-slate-400">Niemand</span>

  return (
    <div className="space-y-1">
      {ids.map((id) => {
        const member = membersById.get(id)
        const name = member ? `${member.firstName} ${member.lastName}` : 'Unbekanntes Mitglied'
        return (
          <div key={id} className="flex items-center gap-2">
            <Avatar name={name} id={id} size="sm" />
            {member ? (
              <MemberLink
                memberId={id}
                label="Traktandum"
                className="text-brand-700 dark:text-brand-300 min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              >
                {name}
              </MemberLink>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Die Farben                                                          */
/* ------------------------------------------------------------------ */

/** Die drei Kreise an der Zeile: Wie dringend ist das? */
function UrgencyPicker({
  value,
  onChange,
  label,
}: {
  value: CallingUrgency | undefined
  onChange: (next: CallingUrgency | undefined) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      {CALLING_URGENCY_ORDER.map((level) => {
        const selected = value === level
        return (
          <button
            key={level}
            type="button"
            aria-pressed={selected}
            // Ein zweiter Griff nimmt die Einschätzung wieder weg – sonst
            // liesse sich eine einmal gesetzte Farbe nie mehr loswerden.
            onClick={() => onChange(selected ? undefined : level)}
            title={CALLING_URGENCY_LABELS[level]}
            aria-label={CALLING_URGENCY_LABELS[level]}
            className={cn(
              'size-5 rounded-full transition',
              URGENCY_DOT[level],
              selected
                ? 'ring-2 ring-slate-500 ring-offset-1 dark:ring-slate-300 dark:ring-offset-slate-900'
                : 'opacity-30 hover:opacity-70',
            )}
          />
        )
      })}
    </div>
  )
}

/**
 * Dieselben drei Kreise oben rechts – hier blenden sie aus.
 *
 * Wer die dringenden Zeilen durchgehen will, klickt Grün und Orange weg.
 * Die letzte Farbe lässt sich nicht auch noch abwählen: Eine Tabelle, die
 * nichts zeigt, ist keine Ansicht, sondern ein Versehen.
 */
function UrgencyFilter({
  value,
  onChange,
}: {
  value: CallingUrgency[]
  onChange: (next: CallingUrgency[]) => void
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Dringlichkeit zeigen">
      <span className="text-xs text-slate-500 dark:text-slate-400">Zeigen</span>
      {CALLING_URGENCY_ORDER.map((level) => {
        const on = value.includes(level)
        const last = on && value.length === 1
        return (
          <button
            key={level}
            type="button"
            aria-pressed={on}
            disabled={last}
            onClick={() =>
              onChange(
                on
                  ? value.filter((entry) => entry !== level)
                  : CALLING_URGENCY_ORDER.filter(
                      (entry) => entry === level || value.includes(entry),
                    ),
              )
            }
            title={`${CALLING_URGENCY_LABELS[level]} ${on ? 'ausblenden' : 'einblenden'}`}
            aria-label={`${CALLING_URGENCY_LABELS[level]} ${on ? 'ausblenden' : 'einblenden'}`}
            className={cn(
              'size-5 rounded-full transition',
              URGENCY_DOT[level],
              on ? 'ring-1 ring-slate-400/60' : 'opacity-25 hover:opacity-60',
              last && 'cursor-default',
            )}
          />
        )
      })}
    </div>
  )
}
