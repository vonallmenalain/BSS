import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowRightToLine,
  Check,
  Plus,
  Settings2,
  Trash2,
  Ungroup,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { UserAvatar } from '@/components/ui/Avatar'
import { MentionField } from '@/components/ui/MentionField'
import { MentionText } from '@/components/ui/MentionText'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { MemberPicker, PersonButton, SegmentedControl } from '@/components/ui/Pickers'
import { formatDate } from '@/lib/dates'
import { cn, colorForId } from '@/lib/utils'
import {
  addLayoutRow,
  canMergeLayoutField,
  isLayoutFieldEmpty,
  layoutLossOnColumns,
  MAX_LAYOUT_COLUMNS,
  mergeLayoutField,
  removeLayoutRow,
  setLayoutColumns,
  splitLayoutField,
  updateLayoutField,
  type MergeDirection,
} from '@/lib/layout'
import {
  FULL_ACCESS_ROLES,
  LAYOUT_FIELD_HINTS,
  LAYOUT_FIELD_LABELS,
  type ItemLayout,
  type LayoutField,
  type LayoutFieldKind,
  type Member,
} from '@/lib/types'

/**
 * Das variable Layout eines Traktandums – zum Bauen und zum Lesen.
 *
 * Nicht jedes Traktandum ist ein Absatz Text. Manches ist eine kleine
 * Tabelle: Aufgabe, wer, bis wann. Wer die in einen Fliesstext schreibt,
 * kann sie danach weder überfliegen noch fortschreiben. Hier lässt sich
 * stattdessen ein Raster stellen – bis zu vier Spalten, beliebig viele
 * Zeilen –, und jedes Feld einzeln festlegen.
 *
 * Zwei Entscheidungen tragen das Ganze:
 *
 *  - **Ein Feld weiss, was es ist.** Der Normalfall ist Freitext. Wer eine
 *    Spalte auf «Bischofschaft» stellt, klickt danach Personen an, statt
 *    Namen zu tippen – und die App weiss, wer gemeint ist. Dasselbe für
 *    Mitglieder, für «Pendent / Erledigt» und für einen Termin.
 *  - **Verbunden wird schrittweise.** Ein Feld wächst um eine Zeile oder um
 *    eine Spalte, nie um mehr. Drei Klicks nach unten ergeben das hohe Feld
 *    neben drei schmalen – und «Trennen» nimmt alles wieder zurück.
 *
 * Die Rechnerei dahinter steht in `lib/layout.ts` und ist dort geprüft;
 * hier steht nur, wie es aussieht und was ein Griff auslöst.
 */
export function LayoutGrid({
  layout,
  onChange,
  onMention,
  memberRefs,
  readOnly = false,
}: {
  layout: ItemLayout
  /** Fehlt sie, ist das Raster nur zu lesen. */
  onChange?: (next: ItemLayout) => void
  /** Ein mit «@» eingesetztes Mitglied – der Aufrufer merkt es sich */
  onMention?: (member: Member) => void
  /** Verweise des Eintrags, damit Namen im Text anklickbar bleiben */
  memberRefs?: string[]
  readOnly?: boolean
}) {
  const gridId = useId()
  const [settingsFor, setSettingsFor] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    run: () => void
  } | null>(null)

  const editable = Boolean(onChange) && !readOnly
  const apply = (next: ItemLayout) => onChange?.(next)

  const changeColumns = (columns: number) => {
    const lost = layoutLossOnColumns(layout, columns)
    if (lost.length === 0) {
      apply(setLayoutColumns(layout, columns))
      return
    }
    setConfirm({
      title: 'Spalten entfernen?',
      message: `${lost.length} ausgefüllte${lost.length === 1 ? 's Feld steht' : ' Felder stehen'} rechts davon und ${lost.length === 1 ? 'geht' : 'gehen'} dabei verloren.`,
      run: () => apply(setLayoutColumns(layout, columns)),
    })
  }

  const settingsField = layout.fields.find((field) => field.id === settingsFor) ?? null

  return (
    <div>
      {editable && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Spalten</span>
          <SegmentedControl<string>
            size="sm"
            value={String(layout.columns)}
            onChange={(next) => changeColumns(Number(next))}
            options={Array.from({ length: MAX_LAYOUT_COLUMNS }, (_, index) => ({
              value: String(index + 1),
              label: String(index + 1),
            }))}
          />
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => apply(addLayoutRow(layout))}
          >
            <Plus className="size-3.5" aria-hidden />
            Zeile
          </button>
        </div>
      )}

      <div
        className="layout-grid"
        style={{ '--layout-columns': layout.columns } as CSSProperties}
        role="group"
        aria-label="Variables Layout"
      >
        {layout.fields.map((field) => (
          <FieldBox
            key={field.id}
            field={field}
            fieldId={`${gridId}-${field.id}`}
            editable={editable}
            memberRefs={memberRefs}
            onMention={onMention}
            onChange={(patch) => apply(updateLayoutField(layout, field.id, patch))}
            onSettings={() => setSettingsFor(field.id)}
          />
        ))}
      </div>

      {settingsField && (
        <FieldSettings
          field={settingsField}
          layout={layout}
          onClose={() => setSettingsFor(null)}
          onChange={apply}
          onConfirm={setConfirm}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel="Entfernen"
        danger
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ein einzelnes Feld                                                  */
/* ------------------------------------------------------------------ */

function FieldBox({
  field,
  fieldId,
  editable,
  memberRefs,
  onMention,
  onChange,
  onSettings,
}: {
  field: LayoutField
  fieldId: string
  editable: boolean
  memberRefs?: string[]
  onMention?: (member: Member) => void
  onChange: (patch: Partial<LayoutField>) => void
  onSettings: () => void
}) {
  return (
    <div
      className={cn(
        'layout-field flex min-w-0 flex-col rounded-lg border border-slate-200 p-2 dark:border-slate-800',
        // Ein Feld mit Bedeutung sieht anders aus als ein leeres Blatt –
        // sonst merkt man erst beim Hineinschreiben, dass es keines ist.
        field.kind !== 'text' && 'bg-slate-50/60 dark:bg-slate-800/30',
      )}
      style={
        {
          '--layout-col': field.col + 1,
          '--layout-col-span': field.colSpan,
          '--layout-row': field.row + 1,
          '--layout-row-span': field.rowSpan,
        } as CSSProperties
      }
    >
      <div className="mb-1 flex items-start gap-1">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          {field.label?.trim() || (field.kind === 'text' ? '' : LAYOUT_FIELD_LABELS[field.kind])}
        </span>
        {editable && (
          <button
            type="button"
            onClick={onSettings}
            className="-m-1 shrink-0 rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={`Feld anpassen${field.label?.trim() ? `: ${field.label.trim()}` : ''}`}
            title="Feld anpassen"
          >
            <Settings2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      <FieldBody
        field={field}
        fieldId={fieldId}
        editable={editable}
        memberRefs={memberRefs}
        onMention={onMention}
        onChange={onChange}
      />
    </div>
  )
}

function FieldBody({
  field,
  fieldId,
  editable,
  memberRefs,
  onMention,
  onChange,
}: {
  field: LayoutField
  fieldId: string
  editable: boolean
  memberRefs?: string[]
  onMention?: (member: Member) => void
  onChange: (patch: Partial<LayoutField>) => void
}) {
  const { users, userName, membersById } = useData()
  const ids = field.ids ?? []

  switch (field.kind) {
    /* --- Freitext ------------------------------------------------- */
    case 'text':
      if (!editable) {
        return (
          <p className="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap">
            <MentionText text={field.text ?? ''} memberRefs={memberRefs} />
          </p>
        )
      }
      return (
        <MentionField
          id={fieldId}
          multiline
          value={field.text ?? ''}
          onChange={(next) => onChange({ text: next })}
          onMention={onMention}
          aria-label={field.label?.trim() || 'Freitext'}
          wrapperClassName="flex min-h-0 flex-1 flex-col"
          className="min-h-14 flex-1 resize-none text-sm"
        />
      )

    /* --- Zuständigkeit Bischofschaft ------------------------------ */
    case 'assignees': {
      const selectable = users.filter(
        (user) => user.active && FULL_ACCESS_ROLES.includes(user.role),
      )
      if (!editable) {
        return (
          <ChipRow empty="Niemand">
            {ids.map((id) => (
              <span key={id} className="chip bg-slate-100 pl-0.5 dark:bg-slate-800">
                <UserAvatar userId={id} size="xs" />
                {userName(id)}
              </span>
            ))}
          </ChipRow>
        )
      }
      if (selectable.length === 0) {
        return <p className="hint mt-0">Noch keine freigeschalteten Benutzer.</p>
      }
      return (
        <div className="flex flex-wrap gap-1">
          {selectable.map((user) => (
            <PersonButton
              key={user.id}
              id={user.id}
              name={user.displayName}
              selected={ids.includes(user.id)}
              onClick={() =>
                onChange({
                  ids: ids.includes(user.id)
                    ? ids.filter((id) => id !== user.id)
                    : [...ids, user.id],
                })
              }
            />
          ))}
        </div>
      )
    }

    /* --- Mitglieder ----------------------------------------------- */
    case 'members': {
      const name = (id: string) => {
        const member = membersById.get(id)
        return member ? `${member.firstName} ${member.lastName}` : 'Unbekannt'
      }
      if (!editable) {
        return (
          <ChipRow empty="Niemand">
            {ids.map((id) => (
              <span key={id} className={cn('chip', colorForId(id))}>
                {name(id)}
              </span>
            ))}
          </ChipRow>
        )
      }
      return (
        <MemberPicker
          label=""
          value={ids}
          onChange={(next) => onChange({ ids: next })}
          placeholder="Name suchen …"
        />
      )
    }

    /* --- Pendent / Erledigt --------------------------------------- */
    case 'status': {
      const done = field.done === true
      if (!editable) {
        return (
          <span
            className={cn(
              'badge w-fit',
              done
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
            )}
          >
            {done && <Check className="size-3" aria-hidden />}
            {done ? 'Erledigt' : 'Pendent'}
          </span>
        )
      }
      return (
        <div className="flex flex-wrap gap-1">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => onChange({ done: value })}
              aria-pressed={done === value}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                done === value
                  ? value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                    : 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                  : 'border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400',
              )}
            >
              {value ? 'Erledigt' : 'Pendent'}
            </button>
          ))}
        </div>
      )
    }

    /* --- Termin ---------------------------------------------------- */
    case 'date':
      if (!editable) {
        return (
          <span className="text-sm">
            {field.date ? formatDate(field.date) : <span className="text-slate-400">—</span>}
          </span>
        )
      }
      return (
        <input
          id={fieldId}
          type="date"
          className="input py-1.5 text-sm"
          value={field.date ?? ''}
          onChange={(event) => onChange({ date: event.target.value })}
          aria-label={field.label?.trim() || 'Termin'}
        />
      )
  }
}

/** Ausgewählte Personen – oder ein Strich, wo niemand steht. */
function ChipRow({ children, empty }: { children: ReactNode[]; empty: string }) {
  if (children.length === 0) return <span className="text-sm text-slate-400">{empty}</span>
  return <div className="flex flex-wrap gap-1">{children}</div>
}

/* ------------------------------------------------------------------ */
/* Feld anpassen                                                       */
/* ------------------------------------------------------------------ */

/**
 * Alles, was ein einzelnes Feld betrifft, in einem Fenster.
 *
 * Bewusst kein Menü am Feld selbst: Die Zellen sind schmal, am Handy
 * teilweise nur fingerbreit, und ein Klappmenü darin wäre entweder
 * abgeschnitten oder grösser als das Feld. Ein Fenster hat Platz für die
 * fünf Feldarten samt Erklärung – und für das, was sonst nirgends hinpasst:
 * verbinden, trennen, die Zeile entfernen.
 */
function FieldSettings({
  field,
  layout,
  onClose,
  onChange,
  onConfirm,
}: {
  field: LayoutField
  layout: ItemLayout
  onClose: () => void
  onChange: (next: ItemLayout) => void
  onConfirm: (confirm: { title: string; message: string; run: () => void }) => void
}) {
  const merged = field.colSpan > 1 || field.rowSpan > 1

  const merge = (direction: MergeDirection) =>
    onChange(mergeLayoutField(layout, field.id, direction))

  const removeRow = () => {
    const filled = layout.fields.filter(
      (other) =>
        other.row <= field.row &&
        other.row + other.rowSpan > field.row &&
        !isLayoutFieldEmpty(other),
    )
    const run = () => onChange(removeLayoutRow(layout, field.row))

    /*
     * Erst dieses Fenster schliessen, dann fragen – nie beides übereinander.
     *
     * Ein Dialog merkt sich beim Öffnen, ob die Seite scrollen durfte, und
     * stellt es beim Schliessen wieder her. Stünden zwei übereinander,
     * schriebe der äussere beim Verschwinden «gesperrt» zurück, und die
     * Seite liesse sich danach nicht mehr scrollen.
     */
    onClose()
    if (filled.length === 0) {
      run()
      return
    }
    onConfirm({
      title: 'Zeile entfernen?',
      message: `In dieser Zeile ${filled.length === 1 ? 'steht ein ausgefülltes Feld' : `stehen ${filled.length} ausgefüllte Felder`}.`,
      run,
    })
  }

  return (
    <Modal open onClose={onClose} title="Feld anpassen" size="md">
      <div className="space-y-5">
        <div>
          <span className="label">Was gehört in dieses Feld?</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LAYOUT_FIELD_LABELS) as LayoutFieldKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onChange(updateLayoutField(layout, field.id, { kind }))}
                aria-pressed={field.kind === kind}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  field.kind === kind
                    ? 'border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300',
                )}
              >
                {LAYOUT_FIELD_LABELS[kind]}
              </button>
            ))}
          </div>
          <p className="hint">{LAYOUT_FIELD_HINTS[field.kind]}</p>
        </div>

        <div>
          <label className="label" htmlFor="layout-field-label">
            Beschriftung
          </label>
          <input
            id="layout-field-label"
            className="input"
            value={field.label ?? ''}
            maxLength={40}
            onChange={(event) =>
              onChange(updateLayoutField(layout, field.id, { label: event.target.value }))
            }
          />
        </div>

        <div>
          <span className="label">Grösse</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!canMergeLayoutField(layout, field.id, 'down')}
              onClick={() => merge('down')}
            >
              <ArrowDownToLine className="size-3.5" aria-hidden />
              Nach unten verbinden
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!canMergeLayoutField(layout, field.id, 'right')}
              onClick={() => merge('right')}
            >
              <ArrowRightToLine className="size-3.5" aria-hidden />
              Nach rechts verbinden
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!merged}
              onClick={() => onChange(splitLayoutField(layout, field.id))}
            >
              <Ungroup className="size-3.5" aria-hidden />
              Trennen
            </button>
          </div>
          {merged && (
            <p className="hint">
              Dieses Feld deckt {field.colSpan} × {field.rowSpan} Rasterzellen ab.
            </p>
          )}
        </div>

        <div>
          <span className="label">Zeile {field.row + 1}</span>
          <button
            type="button"
            className="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
            disabled={layout.rows <= 1}
            onClick={removeRow}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Zeile entfernen
          </button>
        </div>
      </div>
    </Modal>
  )
}
