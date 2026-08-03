import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { nameKey } from '@/lib/names'
import { saveSettings } from '@/services/settings'

/** Wer präsidiert bzw. leitet: entweder ein Konto oder eine Person ohne Konto. */
export interface Leader {
  /** UID aus `users`; leer, wenn kein Konto dahintersteht */
  userId: string
  /** Ausgeschriebener Name der Person ohne Konto */
  name: string
}

/** Wert des Eintrags, der das Fenster zum Erfassen öffnet. */
const ADD = 'neu'

/**
 * Auswahl für «Es präsidiert» und «Es leitet».
 *
 * Zur Wahl stehen die freigeschalteten Konten – und Personen ohne Konto.
 * Präsidieren tut nicht immer die Bischofschaft: Ist Besuch aus der
 * Pfahlführung da, präsidiert er, und ohne diese Möglichkeit stünde im
 * Programm die falsche Person oder gar keine.
 *
 * Erfasste Personen bleiben in den Einstellungen stehen und sind an jedem
 * weiteren Sonntag wählbar – der Hohe Rat kommt wieder. Im Programm selbst
 * steht ihr Name ausgeschrieben; so bleibt ein altes Programm auch dann
 * lesbar, wenn die Person später aus der Auswahl genommen wird.
 */
export function LeaderField({
  label,
  id,
  value,
  onChange,
}: {
  label: string
  id: string
  value: Leader
  onChange: (next: Leader) => void
}) {
  const { users, settings } = useData()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [entry, setEntry] = useState('')

  const people = settings.extraLeaders ?? []

  // Ein deaktiviertes Konto bleibt wählbar, solange es in diesem Feld steht:
  // Sonst zeigte das Feld nichts an, obwohl im Programm jemand steht.
  const accounts = users.filter(
    (user) => (user.active && user.role !== 'pending') || user.id === value.userId,
  )

  // Dasselbe für einen Namen, der inzwischen aus der Auswahl genommen wurde.
  const listed =
    value.name && !people.some((person) => nameKey(person) === nameKey(value.name))
      ? [...people, value.name]
      : people

  const selected = value.userId ? `konto:${value.userId}` : value.name ? `name:${value.name}` : ''

  const choose = (raw: string) => {
    if (raw === ADD) {
      setEntry('')
      setAdding(true)
      return
    }
    if (raw.startsWith('konto:')) onChange({ userId: raw.slice('konto:'.length), name: '' })
    else if (raw.startsWith('name:')) onChange({ userId: '', name: raw.slice('name:'.length) })
    else onChange({ userId: '', name: '' })
  }

  const add = async () => {
    const name = entry.trim()
    if (!name) return

    // Wer schon dasteht, kommt nicht zweimal in die Liste – auch nicht mit
    // anders geschriebenen Umlauten.
    const known = listed.find((person) => nameKey(person) === nameKey(name))
    if (!known) {
      try {
        const outcome = await saveSettings({ extraLeaders: [...people, name] })
        toast.saved(`${name} steht jetzt zur Wahl.`, outcome)
      } catch (error) {
        console.error(error)
        toast.error('Person konnte nicht gespeichert werden.')
        return
      }
    }
    onChange({ userId: '', name: known ?? name })
    setAdding(false)
  }

  const remove = async (person: string) => {
    try {
      await saveSettings({ extraLeaders: people.filter((name) => name !== person) })
    } catch (error) {
      console.error(error)
      toast.error('Person konnte nicht entfernt werden.')
    }
  }

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="input"
        value={selected}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="">– nicht festgelegt –</option>
        {accounts.map((user) => (
          <option key={user.id} value={`konto:${user.id}`}>
            {user.displayName}
          </option>
        ))}
        {listed.map((person) => (
          <option key={person} value={`name:${person}`}>
            {person}
          </option>
        ))}
        <option value={ADD}>+ Person hinzufügen …</option>
      </select>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Person hinzufügen"
        description="Für alle ohne Konto in der App – Besuch aus der Pfahlführung etwa. Wer hier steht, ist an jedem Sonntag wählbar."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void add()}
              disabled={!entry.trim()}
            >
              Hinzufügen
            </button>
          </>
        }
      >
        <label className="label" htmlFor={`${id}-neu`}>
          Name
        </label>
        <input
          id={`${id}-neu`}
          className="input"
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            void add()
          }}
          placeholder="z. B. «Präsident Keller, Pfahlpräsidentschaft»"
        />

        {people.length > 0 && (
          <div className="mt-4">
            <span className="label">Bereits erfasst</span>
            <ul className="space-y-1">
              {people.map((person) => (
                <li
                  key={person}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 py-1 pr-1 pl-3 text-sm dark:border-slate-700"
                >
                  <span className="min-w-0 flex-1 truncate">{person}</span>
                  <button
                    type="button"
                    className="btn-ghost p-1.5 text-rose-600 dark:text-rose-400"
                    onClick={() => void remove(person)}
                    aria-label={`${person} entfernen`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <p className="hint">
              Entfernen nimmt die Person nur aus der Auswahl. In bereits erfassten Programmen bleibt
              ihr Name stehen.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
