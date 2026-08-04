import { useState, type RefObject } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useAutosave, saveStateLabel } from '@/hooks/useAutosave'
import { MentionEditable } from '@/components/ui/MentionText'
import { AssigneePicker, SegmentedControl } from '@/components/ui/Pickers'
import { formatDateTime, toDateInput } from '@/lib/dates'
import { addNote, removeNote, updateAgendaItem } from '@/services/agenda'
import { PRIORITY_LABELS, type AgendaItem, type Priority } from '@/lib/types'

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
 * Priorität, Termin, Zuständige. Bereich, betroffene Mitglieder und das
 * Kennzeichen «vertraulich» sind weggefallen – sie wurden gepflegt, aber nie
 * gelesen.
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

  const autosave = useAutosave(
    { title, description, priority, dueDate, assignees, memberRefs },
    async (draft) => {
      await updateAgendaItem(item.id, {
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        assignees: draft.assignees,
        memberRefs: draft.memberRefs,
        dueDate: draft.dueDate ? new Date(`${draft.dueDate}T12:00:00`) : null,
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
        placeholder="Worum geht es? «@» wählt ein Mitglied"
        maxLength={200}
        // Gelesen und geschrieben sitzt der Text im selben Kasten – sonst
        // ruckte er beim ersten Antippen um die Breite eines Rahmens zur Seite.
        className="text-lg font-semibold text-balance sm:text-xl"
        fieldClassName="text-lg font-semibold sm:text-xl"
      />

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
        placeholder="Hintergrund, Beschluss, was zu tun ist … «@» wählt ein Mitglied"
        className="min-h-16 text-sm text-slate-600 dark:text-slate-300"
        fieldClassName="min-h-20 resize-y text-sm"
      />

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

          <p className="hint" aria-live="polite">
            {saveStateLabel(autosave.state, title.trim() === '' ? 'Titel ausfüllen' : undefined)}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * Was in der Sitzung zu einem Traktandum gesagt wurde.
 *
 * Bewusst eine eigene Liste und kein Teil der Beschreibung: Die Beschreibung
 * sagt, worum es geht, die Notiz, was daraus geworden ist – mit Namen und
 * Zeitpunkt, damit im Protokoll nachvollziehbar bleibt, wer was festgehalten
 * hat.
 */
export function AgendaNotes({
  item,
  readOnly = false,
  inputRef,
}: {
  item: AgendaItem
  readOnly?: boolean
  inputRef?: RefObject<HTMLTextAreaElement | null>
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed || !profile) return
    setSaving(true)
    try {
      await addNote(item.id, trimmed, { id: profile.id, name: profile.displayName })
      setText('')
    } catch (error) {
      console.error(error)
      toast.error('Notiz konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="border-t border-slate-200 pt-4 dark:border-slate-800">
      <h3 className="mb-2 text-sm font-medium">Notizen</h3>

      {item.notes?.length > 0 && (
        <ul className="mb-3 space-y-2">
          {[...item.notes]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((note) => (
              <li
                key={note.id}
                className="group flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap">{note.text}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {note.authorName} · {formatDateTime(note.createdAt)}
                  </p>
                </div>
                {!readOnly && note.authorId === profile?.id && (
                  <button
                    type="button"
                    onClick={() => void removeNote(item.id, note.id)}
                    className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-600 focus-visible:opacity-100"
                    aria-label="Notiz löschen"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}

      {!readOnly && (
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="input min-h-11 resize-y py-2.5"
            rows={2}
            aria-label="Neue Notiz"
            placeholder="Was wurde besprochen oder beschlossen?"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Enter speichert, Shift+Enter macht einen Zeilenumbruch.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
          />
          <button
            type="button"
            className="btn-primary shrink-0"
            onClick={() => void submit()}
            disabled={!text.trim() || saving}
            aria-label="Notiz speichern"
          >
            <Send className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </section>
  )
}
