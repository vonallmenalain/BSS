import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { Modal } from '@/components/ui/Modal'
import { BISHOPRIC_ROLES } from '@/lib/types'

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
 * Zur Wahl steht die Bischofschaft – der Bischof und seine Ratgeber. Sie
 * leitet die Abendmahlsversammlung; Sekretäre und die übrigen Konten stünden
 * in der Liste nur im Weg.
 *
 * Dazu ein Name von Hand, für den Fall, dass jemand anders vorne sitzt:
 * Präsidieren tut nicht immer die Bischofschaft – ist Besuch aus der
 * Pfahlführung da, präsidiert er. Ein solcher Name gilt nur für diesen
 * Sonntag und wandert nicht in die Auswahl: Der Pfahlpräsident ist einmal da
 * und stünde danach an jedem Sonntag zwischen den vier, die tatsächlich
 * infrage kommen. Im Programm steht er ausgeschrieben; so bleibt ein altes
 * Programm auch dann lesbar, wenn niemand mehr weiss, wer gemeint war.
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
  const { users } = useData()
  const [adding, setAdding] = useState(false)
  const [entry, setEntry] = useState('')

  // Ein deaktiviertes Konto – oder eines mit einer anderen Aufgabe – bleibt
  // wählbar, solange es in diesem Feld steht: Sonst zeigte das Feld nichts
  // an, obwohl im Programm jemand steht.
  const accounts = users.filter(
    (user) => (user.active && BISHOPRIC_ROLES.includes(user.role)) || user.id === value.userId,
  )

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

  const add = () => {
    const name = entry.trim()
    if (!name) return
    onChange({ userId: '', name })
    setAdding(false)
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
        {/* Der Name dieses Sonntags – damit die Auswahl zeigt, was im
            Programm steht, und nicht «nicht festgelegt». */}
        {value.name && <option value={`name:${value.name}`}>{value.name}</option>}
        <option value={ADD}>+ Person hinzufügen …</option>
      </select>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Person hinzufügen"
        description="Für alle ohne Konto in der App – Besuch aus der Pfahlführung etwa. Der Name gilt nur für diesen Sonntag."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
              Abbrechen
            </button>
            <button type="button" className="btn-primary" onClick={add} disabled={!entry.trim()}>
              Übernehmen
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
            add()
          }}
        />
        <p className="hint">
          Ausgeschrieben, wie es im Programm stehen soll – etwa «Präsident Simon Dätwyler –
          Pfahlpräsident».
        </p>
      </Modal>
    </div>
  )
}
