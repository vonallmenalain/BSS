import { useMemo, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
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
}) {
  const { members, membersById } = useData()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(false)

  const selected = value ? (membersById.get(value) ?? null) : null

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
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
          <Avatar name={`${selected.firstName} ${selected.lastName}`} id={selected.id} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {selected.firstName} {selected.lastName}
            </p>
            {meta && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {meta(selected)}
              </p>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              className="btn-ghost p-1.5"
              onClick={() => {
                onChange(null)
                setSearch('')
              }}
              aria-label="Auswahl aufheben"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    )
  }

  const showResults = !compact || active || search.trim().length > 0

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
          disabled={disabled}
          aria-label={label}
        />
      </div>

      {showResults && results.length > 0 ? (
        <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
          {results.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(member)
                  setSearch('')
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
      ) : (
        search.trim().length > 1 && (
          <p className="hint">Keine Übereinstimmung in der Mitgliederliste.</p>
        )
      )}
    </div>
  )
}
