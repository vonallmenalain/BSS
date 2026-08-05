import { MemberCombobox } from '@/components/ui/Pickers'
import { BUSINESS_TYPE_LABELS, type BusinessEntry, type BusinessType } from '@/lib/types'

/**
 * Eine Angelegenheit in drei Spalten: Art, Person, Aufgabe.
 *
 * **Was** geschieht – Bestätigung, Entlassung, Segnung –, **wen** es betrifft
 * und **welche Aufgabe** gemeint ist. Mehr braucht der Wortlaut für den
 * Sonntag nicht. Die Person kommt aus dem Mitgliederverzeichnis: Getippt wird
 * der Anfang des Namens, gewählt wird aus den Treffern.
 *
 * Die Aufgabe ist Freitext und **ändert an keiner Berufung etwas**. Wer welche
 * Berufung hat, sagt allein das LCR und der Import von dort.
 *
 * Dieselben Felder stehen unter «Angelegenheiten» und im Ablauf unter
 * «Leitung» – es ist dieselbe Liste, und sie soll an beiden Orten gleich
 * aussehen und gleich funktionieren. Am Handy stehen die Spalten
 * untereinander; nebeneinander bliebe für den Namen kein Platz, und genau er
 * wird gesucht.
 */
export function BusinessFields({
  entry,
  index,
  onChange,
}: {
  entry: BusinessEntry
  index: number
  onChange: (next: BusinessEntry) => void
}) {
  /*
   * Der Freitext früherer Fassungen weicht, sobald Person oder Aufgabe
   * dastehen: Sonst stünde dieselbe Angabe zweimal am Datensatz, und beim
   * nächsten Lesen wäre nicht klar, welche gilt. Bis dahin bleibt er
   * unberührt – niemand verliert eine Zeile, ohne sie ersetzt zu haben.
   */
  const patch = (changes: Partial<BusinessEntry>) => {
    const next = { ...entry, ...changes }
    const filled = Boolean(next.memberName?.trim() || next.position?.trim())
    onChange(filled && next.text ? { ...next, text: '' } : next)
  }

  return (
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
      <select
        className="input w-full py-1.5 text-sm sm:w-auto"
        value={entry.type}
        onChange={(event) => patch({ type: event.target.value as BusinessType })}
        aria-label={`Art des Eintrags ${index + 1}`}
      >
        {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((type) => (
          <option key={type} value={type}>
            {BUSINESS_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      <MemberCombobox
        memberId={entry.memberId}
        name={entry.memberName ?? ''}
        onChange={(next) => patch({ memberId: next.memberId, memberName: next.name })}
        label={`Mitglied im Eintrag ${index + 1}`}
      />

      <input
        className="input"
        value={entry.position ?? ''}
        onChange={(event) => patch({ position: event.target.value })}
        placeholder="Funktion bzw. Berufung"
        aria-label={`Funktion im Eintrag ${index + 1}`}
      />

      {/* Einträge aus früheren Fassungen tragen statt Person und Aufgabe einen
          Freitext. Er bleibt lesbar stehen, bis jemand die beiden Felder
          ausfüllt – überschrieben wird nichts von selbst. */}
      {entry.text?.trim() && (
        <p className="hint sm:col-span-3">Bisher erfasst: «{entry.text.trim()}»</p>
      )}
    </div>
  )
}
