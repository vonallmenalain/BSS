import { useState, type ReactNode } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { Avatar } from '@/components/ui/Avatar'
import { MemberLink } from '@/components/ui/MemberLink'
import { MentionEditable, MentionText } from '@/components/ui/MentionText'
import { MemberPicker, PersonButton } from '@/components/ui/Pickers'
import {
  CALLING_TABLE_TITLES,
  isCallingMemberRowEmpty,
  isCallingOpenRowEmpty,
  newCallingMemberRow,
  newCallingOpenRow,
  type CallingRowMatch,
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
 * **Neue Berufungen** – wer eine neue Aufgabe bekommen soll: der Name, was
 * heute ist, was in Frage käme. **Offene Berufungen** – die Gegenrichtung:
 * welche Aufgabe niemanden hat, wer dafür in Frage käme, wie es weitergeht.
 *
 * Es ist eine Ideenliste. Nichts davon ändert eine Berufung oder einen
 * Mitgliederdatensatz – das tut allein das LCR und der Import von dort.
 *
 * Drei Dinge tragen die Ansicht:
 *
 *  - **Farbe und Zuständigkeit stehen unten rechts in der Zeile.** Beides
 *    gehört der Zeile: Rot, Orange, Grün sagen, wie dringend es ist – oben
 *    rechts blenden dieselben drei Kreise aus, was gerade nicht
 *    interessiert –, und wer eine Zeile trägt, hat den ganzen Eintrag unter
 *    «Pendenzen → Meine». Eine Runde geht zwanzig Namen durch, und die
 *    verteilt man untereinander. Beides steht in **einer** Zeile am Fuss
 *    und so knapp wie möglich: Gelesen wird der Text darüber, nicht die
 *    Bedienung darunter.
 *  - **Ein Name je Zeile.** In der Spalte «Name» steht genau eine Person;
 *    geht es um zwei, sind es zwei Zeilen. Mehrere Namen in einer Zeile
 *    machten aus der Tabelle eine Liste von Listen, und dann sagt keine
 *    Spalte mehr, wovon sie handelt.
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
              {/*
                Steht ein Name da, steht er auch beim Schreiben als Verweis da
                – ein Griff darauf führt zum Profil, wo die bisherigen
                Berufungen stehen. Genau die schaut man in einer Runde nach.
                Gesucht wird nur, solange die Zeile keinen Namen hat: Es ist
                **eine** Person je Zeile. Geht es um ein Ehepaar, sind es zwei
                Zeilen; was früher zu zweit erfasst wurde, bleibt stehen und
                lässt sich einzeln entfernen.
              */}
              {!editable || row.memberIds.length > 0 ? (
                <MemberNames
                  ids={row.memberIds}
                  onRemove={
                    editable
                      ? (id) =>
                          changeMember(row.id, {
                            memberIds: row.memberIds.filter((entry) => entry !== id),
                          })
                      : undefined
                  }
                />
              ) : (
                <MemberPicker
                  single
                  stacked
                  label=""
                  value={row.memberIds}
                  onChange={(next) => changeMember(row.id, { memberIds: next })}
                  placeholder="Name suchen …"
                />
              )}
            </Cell>
            <Cell label="Berufung">
              <TextCell
                id={fieldId(row.id, 'calling')}
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
                id={fieldId(row.id, 'ideas')}
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
                id={fieldId(row.id, 'calling')}
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
                id={fieldId(row.id, 'candidates')}
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
                id={fieldId(row.id, 'next')}
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
 * Die `id` eines Feldes – aus der Zeile und nicht aus der Stelle im Baum.
 *
 * Sie muss einen Neuaufbau der Ansicht überstehen: An ihr erkennt das Feld,
 * dass darin eben geschrieben wurde, und schreibt weiter, statt in den
 * Lesezustand zurückzufallen (siehe `lib/writing`). Eine aus der Baumstelle
 * abgeleitete `id` (`useId`) täte das nicht – sie ist eine andere, sobald der
 * Eintrag in der Liste den Abschnitt wechselt. Die Zeilen-ID ist ohnehin
 * eindeutig, auch über beide Tabellen hinweg.
 */
function fieldId(rowId: string, column: string): string {
  return `berufung-${rowId}-${column}`
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
  columns,
  editable,
  hidden,
  onAdd,
  children,
}: {
  title: string
  columns: [string, string, string]
  editable: boolean
  /** Wie viele Zeilen der Farbfilter gerade wegnimmt */
  hidden: number
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <section>
      {/* Nur der Titel – ein Satz darunter, der ihn mit anderen Worten
          wiederholt, kostet in jeder Runde zwei Zeilen und sagt beim zweiten
          Mal nichts mehr. */}
      <h4 className="mb-1.5 text-sm font-semibold">{title}</h4>

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
 * Die Farbe der Zeile.
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

/**
 * Wie eine Zeile aussieht: die drei Felder, darunter Farbe und
 * Zuständigkeit – **unten rechts** und in einer einzigen schmalen Reihe.
 *
 * Beides ist Bedienung und nicht Inhalt. Links unter den Feldern stand es
 * mitten im Lesefluss, und die Beschriftung «Zuständig» sagte dabei nichts,
 * was die Namen daneben nicht schon sagen. Rechts aussen bleibt es in
 * Reichweite, ohne die Tabelle zu zerschneiden – und der Papierkorb steht als
 * einziges am anderen Ende, weit weg von den Knöpfen, die man dauernd trifft.
 */
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
        <div className="mt-2 flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {/* Ganz links und damit so weit wie möglich weg von den Knöpfen, die
              man dauernd trifft. */}
          {onRemove && (
            <button
              type="button"
              className="btn-ghost mr-auto p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
              onClick={onRemove}
              aria-label={`Zeile ${position} entfernen`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          )}

          <UrgencyPicker
            value={row.urgency}
            onChange={onUrgency}
            label={`Dringlichkeit, Zeile ${position}`}
          />

          {/* Ohne Beschriftung: «Zuständig» stand vor fünf Namen und sagte
              nichts, was die Namen nicht selbst sagen. Für Bildschirmleser
              steht es an der Gruppe. */}
          <div
            className="flex min-w-0 flex-wrap items-center justify-end gap-1"
            role="group"
            aria-label={`Zuständig, Zeile ${position}`}
          >
            {bishopric.map((user) => (
              <PersonButton
                key={user.id}
                id={user.id}
                name={user.displayName}
                compact
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
        </div>
      ) : (
        (row.urgency || row.assignees.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
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

/* ------------------------------------------------------------------ */
/* Eine Zeile anderswo                                                 */
/* ------------------------------------------------------------------ */

/**
 * Eine einzelne Zeile, wie sie gelesen wird – für das Mitgliederprofil.
 *
 * Dort steht die Runde nicht als Tabelle, sondern als das, was sie über
 * **eine** Person sagt: aus welcher der beiden Tabellen die Zeile stammt,
 * was in ihren Feldern steht, wie dringend es ist und wer sich darum
 * kümmert. Farbe und Zuständigkeit sehen dabei genauso aus wie in der Runde
 * selbst – es ist dieselbe Zeile, bloss an einem anderen Ort.
 *
 * Leere Felder bleiben weg: Eine Beschriftung mit nichts dahinter sagt
 * nichts, was die leere Stelle nicht auch sagt.
 */
export function CallingRowSummary({
  match,
  memberRefs,
}: {
  match: CallingRowMatch
  /** Verweise des Eintrags, damit «@»-Namen im Text anklickbar bleiben */
  memberRefs?: string[]
}) {
  const { row } = match
  const fields =
    match.table === 'members'
      ? [
          { label: 'Berufung', text: match.row.calling },
          { label: 'Vorschläge', text: match.row.ideas },
        ]
      : [
          { label: 'Berufung', text: match.row.calling },
          { label: 'Name (Vorschläge)', text: match.row.candidates },
          { label: 'Weiteres Vorgehen', text: match.row.next },
        ]
  const filled = fields.filter((field) => field.text.trim() !== '')

  return (
    <li
      className={cn(
        'rounded-lg border border-l-4 border-slate-200 p-2 dark:border-slate-800',
        row.urgency ? URGENCY_ROW[row.urgency] : 'border-l-slate-200 dark:border-l-slate-700',
      )}
    >
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {CALLING_TABLE_TITLES[match.table]}
      </span>

      {filled.length === 0 ? (
        <p className="text-sm text-slate-400">Noch nichts notiert.</p>
      ) : (
        <dl className="mt-0.5 space-y-1">
          {filled.map((field) => (
            <div key={field.label} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {field.label}
              </dt>
              <dd className="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap">
                <MentionText text={field.text} memberRefs={memberRefs} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(row.urgency || row.assignees.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
          {row.urgency && (
            <span className={cn('badge', URGENCY_BADGE[row.urgency])}>
              {CALLING_URGENCY_LABELS[row.urgency]}
            </span>
          )}
          {row.assignees.map((id) => (
            <AssigneeChip key={id} id={id} />
          ))}
        </div>
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

/**
 * Der gewählte Name – er führt zur Person, gelesen wie geschrieben.
 *
 * Auch beim Ausfüllen bleibt er ein Verweis: In einer Berufungsrunde ist die
 * nächste Frage fast immer «was hat die Person bisher getan?», und die
 * Antwort steht in ihrem Profil. Steht ein `onRemove` bereit, lässt sich der
 * Name daneben wieder wegnehmen – dann steht wieder das Suchfeld da.
 */
function MemberNames({ ids, onRemove }: { ids: string[]; onRemove?: (id: string) => void }) {
  const { membersById } = useData()

  if (ids.length === 0) return <span className="px-3 text-sm text-slate-400">Niemand</span>

  return (
    <div className="space-y-1">
      {ids.map((id) => {
        const member = membersById.get(id)
        const name = member ? `${member.firstName} ${member.lastName}` : 'Unbekanntes Mitglied'
        return (
          <div
            key={id}
            className={cn(
              'flex items-center gap-2',
              onRemove &&
                'rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900',
            )}
          >
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
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="btn-ghost shrink-0 p-1"
                aria-label={`${name} entfernen`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
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

/**
 * Die drei Kreise an der Zeile: Wie dringend ist das?
 *
 * Der Kreis ist klein, die Fläche darum nicht: Der Knopf trägt einen
 * Innenabstand und bleibt damit auch am Telefon zu treffen, während die
 * Zeile schmal bleibt.
 */
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
    <div className="flex items-center" role="group" aria-label={label}>
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
              'grid place-items-center rounded-full p-1 transition',
              selected
                ? 'ring-2 ring-slate-500 dark:ring-slate-300'
                : 'opacity-30 hover:opacity-70',
            )}
          >
            <span className={cn('size-3.5 rounded-full', URGENCY_DOT[level])} aria-hidden />
          </button>
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
