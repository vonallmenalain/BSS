import { useMemo, useState, type ReactNode } from 'react'
import { Pencil, Search, UserPlus, X } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { Avatar } from '@/components/ui/Avatar'
import { matchesSearch } from '@/lib/utils'
import type { Member } from '@/lib/types'

/**
 * Auswahl **einer** Person aus der Mitgliederliste.
 *
 * Anders als der `MemberPicker` für Traktanden zeigt diese Auswahl zu jedem
 * Vorschlag eine Zusatzinformation – bei Gebeten etwa, wann die Person zuletzt
 * gebetet hat. Genau das braucht es, um beim Zuteilen nicht immer dieselben
 * zu fragen. Ohne Suchbegriff erscheint die vorsortierte Vorschlagsliste.
 *
 * Mit `onFreeText` lässt sich zusätzlich ein Name von Hand erfassen. Getippter
 * Text allein ordnet dabei nie ein Mitglied zu – das geschieht ausschliesslich
 * über die Vorschlagsliste. Ein so erfasster Name lässt sich über den Stift
 * nachbessern, statt ihn löschen und neu tippen zu müssen.
 */
export function MemberSearchSelect({
  value,
  onChange,
  label,
  placeholder = 'Name eingeben oder aus den Vorschlägen wählen',
  /** Vorschlagsreihenfolge, wenn nichts gesucht wird (z. B. «schon lange nicht dran») */
  suggestions,
  meta,
  disabled = false,
  compact = false,
  freeText = '',
  onFreeText,
}: {
  value: string | null
  onChange: (member: Member | null) => void
  label?: string
  placeholder?: string
  suggestions?: Member[]
  meta?: (member: Member) => ReactNode
  disabled?: boolean
  /**
   * Vorschläge erst zeigen, wenn das Feld angetippt wird.
   *
   * Im Ablauf stehen mehrere solche Felder untereinander; dauerhaft
   * ausgeklappte Listen machten die Seite unübersichtlich lang.
   */
  compact?: boolean
  /** Bereits erfasster Name ohne Mitglied – wird wie eine Auswahl angezeigt. */
  freeText?: string
  /**
   * Einen Namen ohne Mitglied übernehmen.
   *
   * Ist die Funktion gesetzt, darf im Feld alles stehen: ein besuchender Hoher
   * Rat, die Missionare, «Zeugnisse der neuen Ältesten». Leerer Text hebt den
   * Eintrag wieder auf.
   */
  onFreeText?: (name: string) => void
}) {
  const { members, membersById } = useData()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(false)
  /**
   * Ein von Hand erfasster Name wird gerade nachgebessert.
   *
   * Ohne dies bliebe nur Löschen und alles neu tippen – bei «Zeugnisse der
   * neuen Ältesten» wegen eines Tippfehlers der ganze Satz noch einmal.
   */
  const [editing, setEditing] = useState(false)

  const selected = value ? (membersById.get(value) ?? null) : null
  const manual = selected ? '' : freeText.trim()
  /** Der bisherige Name steht im Feld und wartet auf seine Berichtigung. */
  const renaming = editing && manual.length > 0

  const results = useMemo(() => {
    // Ohne Suchbegriff die vorsortierten Vorschläge, bei einer Suche aber die
    // ganze Mitgliederliste: Wer gezielt einen Namen eintippt, will ihn auch
    // dann finden, wenn die Person nicht zuoberst vorgeschlagen würde.
    if (!search.trim()) return (suggestions ?? members).slice(0, 8)
    return members
      .filter((member) => matchesSearch(`${member.firstName} ${member.lastName}`, search))
      .slice(0, 8)
  }, [suggestions, members, search])

  if (selected) {
    return (
      <div>
        {label && <span className="label">{label}</span>}
        <Chosen
          name={`${selected.firstName} ${selected.lastName}`}
          id={selected.id}
          meta={meta?.(selected)}
          onClear={
            disabled
              ? undefined
              : () => {
                  onChange(null)
                  setSearch('')
                  setEditing(false)
                }
          }
        />
      </div>
    )
  }

  if (manual && !editing) {
    return (
      <div>
        {label && <span className="label">{label}</span>}
        <Chosen
          name={manual}
          meta="Keinem Mitglied zugeordnet"
          onEdit={
            disabled || !onFreeText
              ? undefined
              : () => {
                  setSearch(manual)
                  setEditing(true)
                }
          }
          onClear={
            disabled
              ? undefined
              : () => {
                  onFreeText?.('')
                  setSearch('')
                  setEditing(false)
                }
          }
        />
      </div>
    )
  }

  const term = search.trim()
  const showResults = !compact || active || term.length > 0

  const takeAsIs = () => {
    if (!onFreeText || !term) return
    onFreeText(term)
    setSearch('')
    setEditing(false)
  }

  /** Nachbessern abbrechen – der bisherige Name bleibt, wie er war. */
  const keepAsWas = () => {
    setSearch('')
    setEditing(false)
  }

  return (
    <div
      onFocus={() => setActive(true)}
      onBlur={(event) => {
        // Ein Klick auf einen Vorschlag ist auch ein Fokuswechsel – nur
        // schliessen, wenn er aus dem Feld herausführt.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(false)
      }}
    >
      {label && <span className="label">{label}</span>}
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          className="input pl-9"
          placeholder={placeholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !onFreeText || !term) return
            // Das Feld steht auch in Formularen – ohne dies löste die
            // Eingabetaste dort das Absenden aus, statt den Namen zu übernehmen.
            event.preventDefault()
            takeAsIs()
          }}
          disabled={disabled}
          aria-label={label}
          /* Beim Nachbessern steht der Cursor gleich im Namen – der Stift
             wurde ja gedrückt, um zu tippen. Sonst nicht: Auf einer Seite
             mit mehreren solchen Feldern zöge das erste den Fokus an sich. */
          autoFocus={renaming}
        />
      </div>

      {showResults && results.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
          {results.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(member)
                  setSearch('')
                  setEditing(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar name={`${member.firstName} ${member.lastName}`} id={member.id} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {member.firstName} {member.lastName}
                </span>
                {meta && <span className="shrink-0 text-xs text-slate-400">{meta(member)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {results.length === 0 && term.length > 1 && (
        <p className="hint">Keine Übereinstimmung in der Mitgliederliste.</p>
      )}

      {/* Der getippte Text allein ordnet nichts zu – erst dieser Knopf
          übernimmt ihn, und zwar ausdrücklich ohne Mitglied. */}
      {onFreeText && !disabled && (term.length > 0 || renaming) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {term.length > 0 && (
            <button type="button" className="btn-secondary btn-sm" onClick={takeAsIs}>
              {renaming ? (
                <>
                  <Pencil className="size-3.5" aria-hidden />«{term}» übernehmen
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" aria-hidden />«{term}» ohne Mitglied eintragen
                </>
              )}
            </button>
          )}
          {renaming && (
            <button type="button" className="btn-ghost btn-sm" onClick={keepAsWas}>
              Abbrechen
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Die getroffene Wahl – ein Mitglied oder ein Name von Hand. */
function Chosen({
  name,
  id,
  meta,
  onEdit,
  onClear,
}: {
  name: string
  id?: string
  meta?: ReactNode
  /**
   * Den Namen nachbessern.
   *
   * Nur bei von Hand erfassten Namen: Der Name eines Mitglieds gehört in die
   * Mitgliederliste und wird hier nicht umgeschrieben.
   */
  onEdit?: () => void
  onClear?: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
      <Avatar name={name} id={id} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {meta && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{meta}</p>}
      </div>
      {onEdit && (
        <button
          type="button"
          className="btn-ghost p-1.5"
          onClick={onEdit}
          aria-label="Namen bearbeiten"
          title="Namen bearbeiten"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      )}
      {onClear && (
        <button
          type="button"
          className="btn-ghost p-1.5"
          onClick={onClear}
          aria-label="Auswahl aufheben"
          title="Auswahl aufheben"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
