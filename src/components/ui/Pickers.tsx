import { useMemo, useState } from 'react'
import { Check, Search, UserPlus, X } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { cn, colorForId, matchesSearch } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { FULL_ACCESS_ROLES, type Member } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Zuständige aus dem Team wählen                                      */
/* ------------------------------------------------------------------ */

/**
 * Mehrfachauswahl der Bischofschaftsmitglieder.
 * Bewusst als Knopfleiste statt als Dropdown: bei fünf Personen ist jede
 * Auswahl damit ein einziger Klick – auch mitten in der Sitzung.
 */
export function AssigneePicker({
  value,
  onChange,
  label = 'Zuständig',
}: {
  value: string[]
  onChange: (next: string[]) => void
  label?: string
}) {
  const { users } = useData()
  // Nur Konten mit Vollzugriff: Wer allein den AP-Kalender sieht, kann eine
  // Pendenz weder öffnen noch erledigen.
  const selectable = users.filter((user) => user.active && FULL_ACCESS_ROLES.includes(user.role))

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  if (selectable.length === 0) {
    return (
      <div>
        <span className="label">{label}</span>
        <p className="hint">Noch keine freigeschalteten Benutzer vorhanden.</p>
      </div>
    )
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {selectable.map((user) => {
          const selected = value.includes(user.id)
          return (
            <button
              key={user.id}
              type="button"
              onClick={() => toggle(user.id)}
              aria-pressed={selected}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium transition',
                selected
                  ? 'border-brand-500 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-100'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              <Avatar name={user.displayName} id={user.id} size="sm" />
              <span className="max-w-32 truncate">{user.displayName}</span>
              {selected && <Check className="size-3.5 shrink-0" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Eine Person aus dem Team                                            */
/* ------------------------------------------------------------------ */

/**
 * Dasselbe für genau eine Person – Gebet, geistiger Gedanke.
 *
 * Gespeichert wird der ausgeschriebene Name und keine UID: Ein Protokoll von
 * vor zwei Jahren soll auch dann lesbar bleiben, wenn die Person längst kein
 * Konto mehr hat. Ein zweiter Griff auf denselben Namen nimmt die Wahl wieder
 * zurück.
 *
 * Steht dort etwas, das zu niemandem passt – ein von Hand erfasster Name aus
 * einer früheren Fassung –, bleibt es als eigener Knopf stehen, statt still
 * zu verschwinden.
 */
export function PersonChoice({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  readOnly?: boolean
}) {
  const { users } = useData()
  const selectable = users.filter((user) => user.active && FULL_ACCESS_ROLES.includes(user.role))
  const current = value.trim()
  const foreign = current !== '' && !selectable.some((user) => user.displayName === current)

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}:</span>
        <span className="text-sm">{current || '–'}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="w-full shrink-0 text-xs text-slate-500 sm:w-36 dark:text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {selectable.map((user) => (
          <PersonButton
            key={user.id}
            id={user.id}
            name={user.displayName}
            selected={user.displayName === current}
            onClick={() => onChange(user.displayName === current ? '' : user.displayName)}
          />
        ))}
        {foreign && (
          <PersonButton id={current} name={current} selected onClick={() => onChange('')} />
        )}
      </div>
    </div>
  )
}

/**
 * Mehrere Personen aus dem Team – die Anwesenheit.
 *
 * Anders als beim Gebet werden hier UIDs gespeichert: Wer anwesend war, ist
 * dieselbe Person, die auch Traktanden zugewiesen bekommt, und die Avatare in
 * den Listen brauchen den Verweis.
 */
export function PeopleChoice({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string
  value: string[]
  onChange: (next: string[]) => void
  readOnly?: boolean
}) {
  const { users, userName } = useData()
  const selectable = users.filter((user) => user.active && FULL_ACCESS_ROLES.includes(user.role))

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}:</span>
        <span className="text-sm">{value.length ? value.map(userName).join(', ') : '–'}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="w-full shrink-0 text-xs text-slate-500 sm:w-36 dark:text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {selectable.map((user) => (
          <PersonButton
            key={user.id}
            id={user.id}
            name={user.displayName}
            selected={value.includes(user.id)}
            onClick={() =>
              onChange(
                value.includes(user.id)
                  ? value.filter((id) => id !== user.id)
                  : [...value, user.id],
              )
            }
          />
        ))}
      </div>
    </div>
  )
}

/** Ein Name als Knopf – nur der Vorname, der Rest steht im Tooltip. */
function PersonButton({
  id,
  name,
  selected,
  onClick,
}: {
  id: string
  name: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={name}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs font-medium transition',
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-100'
          : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
      )}
    >
      <Avatar name={name} id={id} size="xs" />
      <span className="max-w-28 truncate">{name.split(' ')[0]}</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Gemeindemitglieder verknüpfen                                       */
/* ------------------------------------------------------------------ */

/** Suchbare Mehrfachauswahl aus der Mitgliederliste. */
export function MemberPicker({
  value,
  onChange,
  label = 'Betrifft Mitglieder',
  single = false,
  placeholder = 'Name eingeben …',
}: {
  value: string[]
  onChange: (next: string[]) => void
  label?: string
  single?: boolean
  placeholder?: string
}) {
  const { members, membersById } = useData()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    if (!search.trim()) return []
    return members
      .filter((m) => !value.includes(m.id))
      .filter((m) => matchesSearch(`${m.firstName} ${m.lastName}`, search))
      .slice(0, 8)
  }, [members, search, value])

  const add = (member: Member) => {
    onChange(single ? [member.id] : [...value, member.id])
    setSearch('')
    setOpen(false)
  }

  const remove = (id: string) => onChange(value.filter((v) => v !== id))

  return (
    <div>
      <span className="label">{label}</span>

      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => {
            const member = membersById.get(id)
            return (
              <span key={id} className={cn('chip', colorForId(id))}>
                {member ? `${member.firstName} ${member.lastName}` : 'Unbekannt'}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="-mr-1 rounded-full p-0.5 opacity-60 transition hover:opacity-100"
                  aria-label="Entfernen"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {(!single || value.length === 0) && (
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
            onChange={(event) => {
              setSearch(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            // Klick auf einen Treffer muss vor dem Schliessen ankommen.
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          />

          {open && results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {results.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add(member)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Avatar
                      name={`${member.firstName} ${member.lastName}`}
                      id={member.id}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {member.lastName}, {member.firstName}
                    </span>
                    {member.status !== 'active' && (
                      <span className="text-xs text-slate-400">inaktiv</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {open && search.trim().length > 1 && results.length === 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              Keine Übereinstimmung. Mitglieder werden unter «Mitglieder» erfasst.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Umschalter                                                          */
/* ------------------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  value: T
  label: string
  count?: number
}

/** Kompakter Umschalter für Filter mit wenigen, sich ausschliessenden Werten. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (next: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded px-1 text-[11px]',
                  active
                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-200'
                    : 'text-slate-400',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Seitenkopf                                                          */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Auffällige Schaltfläche für die Hauptaktion einer Seite (mobil unten rechts). */
export function FloatingAction({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-primary fixed right-4 bottom-20 z-30 size-14 rounded-full shadow-lg sm:hidden"
      aria-label={label}
    >
      <UserPlus className="size-6" aria-hidden />
    </button>
  )
}
