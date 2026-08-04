import { useRef, useState } from 'react'
import { useAutosave } from '@/hooks/useAutosave'
import { MentionEditable } from '@/components/ui/MentionText'
import { ConfirmDialog } from '@/components/ui/Modal'
import { AssigneePicker, SegmentedControl } from '@/components/ui/Pickers'
import { LayoutGrid } from '@/components/agenda/LayoutGrid'
import { toDateInput } from '@/lib/dates'
import { updateAgendaItem } from '@/services/agenda'
import { emptyLayout, isLayoutEmpty, normalizeLayout, serializeLayout } from '@/lib/layout'
import { PRIORITY_LABELS, type AgendaItem, type ItemLayout, type Priority } from '@/lib/types'

/**
 * Ein Traktandum bearbeiten – ohne Formular, ohne Speichern-Knopf.
 *
 * Früher stand hier ein Fenster, das sich über die Sitzung legte: Stift
 * antippen, Felder ausfüllen, speichern, schliessen. Das ist genau ein
 * Handgriff zu viel für eine Sitzung, in der geschrieben wird, während
 * gesprochen wird. Jetzt ist der Eintrag selbst das Formular – Titel und
 * Beschreibung sind Text, in den man hineingreift, und gespeichert wird kurz
 * nach dem letzten Tastendruck.
 *
 * Zu sehen sind nur die Angaben, die am Sitzungstisch gebraucht werden:
 * Priorität, Termin, Zuständige. Bereich, betroffene Mitglieder, das
 * Kennzeichen «vertraulich» und die eigene Notizliste sind weggefallen – sie
 * wurden gepflegt, aber nie gelesen. Was besprochen wurde, gehört in die
 * Beschreibung.
 *
 * Der Aufrufer muss die Komponente je Eintrag frisch aufbauen
 * (`key={item.id}`): Der Stand im Feld gehört dem Eintrag, nicht der Stelle
 * auf dem Bildschirm.
 */
export function AgendaItemEditor({
  item,
  readOnly = false,
}: {
  item: AgendaItem
  readOnly?: boolean
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [priority, setPriority] = useState<Priority>(item.priority ?? 'normal')
  const [dueDate, setDueDate] = useState(toDateInput(item.dueDate))
  const [assignees, setAssignees] = useState<string[]>(item.assignees ?? [])
  const [memberRefs, setMemberRefs] = useState<string[]>(item.memberRefs ?? [])

  /*
   * Das Raster wird genau einmal geradegezogen – beim Aufbauen.
   *
   * `normalizeLayout()` vergibt für Lücken neue IDs. Liefe es bei jedem
   * Zeichnen, wäre der Stand nach jedem Zeichnen ein anderer, und das
   * automatische Speichern schriebe endlos.
   */
  const [layout, setLayout] = useState<ItemLayout | null>(() =>
    item.layout ? normalizeLayout(item.layout) : null,
  )
  const lastLayout = useRef<ItemLayout | null>(layout)
  const [confirmOff, setConfirmOff] = useState(false)

  const autosave = useAutosave(
    { title, description, priority, dueDate, assignees, memberRefs, layout },
    async (draft) => {
      await updateAgendaItem(item.id, {
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        assignees: draft.assignees,
        memberRefs: draft.memberRefs,
        dueDate: draft.dueDate ? new Date(`${draft.dueDate}T12:00:00`) : null,
        layout: draft.layout ? serializeLayout(draft.layout) : null,
      })
    },
    // Ein Eintrag ohne Titel wäre in jeder Liste eine leere Zeile. Wer den
    // Titel löscht, um ihn neu zu schreiben, behält so lange den alten.
    { savable: (draft) => draft.title.trim() !== '' },
  )

  /*
   * Der Haken schaltet um, was an der Stelle der Beschreibung steht.
   *
   * Ausschalten löscht das Raster beim nächsten Speichern – deshalb die
   * Rückfrage, sobald etwas darin steht. Innerhalb der Sitzung bleibt es
   * trotzdem in der Hand: Wer versehentlich umschaltet, holt es mit
   * demselben Haken zurück.
   */
  const toggleLayout = (on: boolean) => {
    if (on) {
      setLayout(lastLayout.current ?? emptyLayout())
      return
    }
    if (layout && !isLayoutEmpty(layout)) {
      setConfirmOff(true)
      return
    }
    lastLayout.current = layout
    setLayout(null)
  }

  /*
   * Ein mit «@» eingesetzter Name ist zugleich ein Verweis: Wer im Text steht,
   * steht auch in `memberRefs` – sonst bliebe der Name blosser Text und führte
   * nirgendwohin.
   */
  const linkMember = (memberId: string) =>
    setMemberRefs((current) => (current.includes(memberId) ? current : [...current, memberId]))

  const hinweis =
    title.trim() === ''
      ? 'Titel ausfüllen'
      : autosave.state === 'fehler'
        ? 'Nicht gespeichert – die Änderung wird erneut versucht.'
        : null

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex justify-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded"
              checked={layout !== null}
              onChange={(event) => toggleLayout(event.target.checked)}
            />
            Variables Layout
          </label>
        </div>
      )}

      <MentionEditable
        id={`item-title-${item.id}`}
        label="Titel"
        value={title}
        onChange={setTitle}
        onMention={(member) => linkMember(member.id)}
        memberRefs={memberRefs}
        readOnly={readOnly}
        // Steht nur da, solange nichts geschrieben ist – sonst wäre die Fläche,
        // in die man greift, unsichtbar. Bewusst der Feldname, kein Beispiel.
        placeholder="Titel"
        maxLength={200}
        // Gelesen und geschrieben sitzt der Text im selben Kasten – sonst
        // ruckte er beim ersten Antippen um die Breite eines Rahmens zur Seite.
        className="text-lg font-semibold text-balance sm:text-xl"
        fieldClassName="text-lg font-semibold sm:text-xl"
      />

      {layout ? (
        <LayoutGrid
          layout={layout}
          onChange={setLayout}
          onMention={(member) => linkMember(member.id)}
          memberRefs={memberRefs}
          readOnly={readOnly}
        />
      ) : (
        <MentionEditable
          id={`item-description-${item.id}`}
          label="Beschreibung"
          value={description}
          onChange={setDescription}
          onMention={(member) => linkMember(member.id)}
          memberRefs={memberRefs}
          multiline
          rows={3}
          readOnly={readOnly}
          placeholder="Beschreibung"
          className="min-h-16 text-sm text-slate-600 dark:text-slate-300"
          fieldClassName="min-h-20 resize-y text-sm"
        />
      )}

      {!readOnly && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="label">Priorität</span>
              <SegmentedControl<Priority>
                value={priority}
                onChange={setPriority}
                size="sm"
                options={(['low', 'normal', 'high'] as Priority[]).map((value) => ({
                  value,
                  label: PRIORITY_LABELS[value],
                }))}
              />
            </div>

            <div>
              <label className="label" htmlFor={`item-due-${item.id}`}>
                Erledigen bis
              </label>
              <input
                id={`item-due-${item.id}`}
                type="date"
                className="input"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <AssigneePicker value={assignees} onChange={setAssignees} />

          {/* Nur melden, was zu tun ist. «Wird laufend gespeichert» stand sonst
              unter jedem Traktandum und sagte bei keinem etwas. */}
          {hinweis && (
            <p className="hint" aria-live="polite">
              {hinweis}
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={() => {
          lastLayout.current = layout
          setLayout(null)
        }}
        title="Variables Layout abschalten?"
        message="Das Raster und alles, was darin steht, wird entfernt. Die Beschreibung tritt wieder an seine Stelle."
        confirmLabel="Abschalten"
        danger
      />
    </div>
  )
}
