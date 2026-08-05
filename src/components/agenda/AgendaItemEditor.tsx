import { useState } from 'react'
import { useAutosave } from '@/hooks/useAutosave'
import { MentionEditable } from '@/components/ui/MentionText'
import { AssigneePicker } from '@/components/ui/Pickers'
import { LayoutGrid } from '@/components/agenda/LayoutGrid'
import { updateAgendaItem } from '@/services/agenda'
import { normalizeLayout, serializeLayout } from '@/lib/layout'
import type { AgendaItem, ItemLayout } from '@/lib/types'

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
 * Zu sehen ist nur, was am Sitzungstisch gebraucht wird: Titel, Beschreibung
 * und die Zuständigen. Bereich, betroffene Mitglieder, Priorität, Termin, das
 * Kennzeichen «vertraulich» und die eigene Notizliste sind weggefallen – sie
 * wurden gepflegt, aber nie gelesen. Was besprochen wurde, gehört in die
 * Beschreibung.
 *
 * Auch der Haken «Variables Layout» steht nicht hier, sondern nur beim
 * Erfassen: Ob ein Punkt ein Absatz Text ist oder eine kleine Tabelle,
 * entscheidet sich einmal. Ein Raster, das bereits gebaut wurde, lässt sich
 * hier weiterhin ausfüllen – es tritt an die Stelle der Beschreibung.
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

  const autosave = useAutosave(
    { title, description, assignees, memberRefs, layout },
    async (draft) => {
      await updateAgendaItem(item.id, {
        title: draft.title.trim(),
        description: draft.description,
        assignees: draft.assignees,
        memberRefs: draft.memberRefs,
        layout: draft.layout ? serializeLayout(draft.layout) : null,
      })
    },
    // Ein Eintrag ohne Titel wäre in jeder Liste eine leere Zeile. Wer den
    // Titel löscht, um ihn neu zu schreiben, behält so lange den alten.
    { savable: (draft) => draft.title.trim() !== '' },
  )

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
    </div>
  )
}
