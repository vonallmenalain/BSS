import { useMemo, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { cn, colorForId, matchesSearch } from '@/lib/utils'
import { Avatar, UserAvatar } from '@/components/ui/Avatar'
import { FULL_ACCESS_ROLES, type Member } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Zuständige aus dem Team wählen                                      */
/* ------------------------------------------------------------------ */

/**
 * Mehrfachauswahl der Bischofschaftsmitglieder.
 * Bewusst als Knopfleiste statt als Dropdown: bei fünf Personen ist jede
 * Auswahl damit ein einziger Klick – auch mitten in der Sitzung.
 *
 * Zur Wahl stehen die Kreise mit dem Kürzel und sonst nichts – siehe
 * `PersonButton`.
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
      <div className="flex flex-wrap gap-1.5">
        {selectable.map((user) => (
          <PersonButton
            key={user.id}
            id={user.id}
            name={user.displayName}
            size="md"
            selected={value.includes(user.id)}
            onClick={() => toggle(user.id)}
          />
        ))}
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
    /* Gesucht wird über alle Konten und nicht bloss über `selectable`: Wer
       vorletztes Jahr gebetet hat, kann heute abgemeldet sein – der Kreis
       soll trotzdem derselbe bleiben wie überall sonst. */
    const user = users.find((entry) => entry.displayName === current)
    return (
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}:</span>
        {current ? (
          user ? (
            <UserAvatar userId={user.id} name={current} size="sm" />
          ) : (
            /* Ein von Hand erfasster Name ohne Konto – Kürzel und Farbe
               kommen dann aus dem Namen selbst. */
            <Avatar name={current} size="sm" />
          )
        ) : (
          <span className="text-sm">–</span>
        )}
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
  const { users } = useData()
  const selectable = users.filter((user) => user.active && FULL_ACCESS_ROLES.includes(user.role))

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}:</span>
        {value.length ? (
          <div className="flex flex-wrap items-center gap-1">
            {value.map((id) => (
              <UserAvatar key={id} userId={id} size="sm" />
            ))}
          </div>
        ) : (
          <span className="text-sm">–</span>
        )}
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

/**
 * Eine Person als Knopf – ihr Kreis mit dem Kürzel, sonst nichts.
 *
 * Die Bischofschaft sind fünf Personen, und jede trägt in der ganzen App
 * dasselbe Zeichen: zwei Buchstaben in ihrer Farbe. Wer die Runde einmal
 * gelesen hat, erkennt sie daran schneller als am Namen – und der Name
 * daneben sagte in einer Reihe aus fünf Knöpfen dasselbe ein zweites Mal und
 * kostete dafür die halbe Breite. Ausgeschrieben steht er im Tooltip und für
 * Bildschirmleser.
 *
 * Gewählt heisst: Rand in der Betonfarbe. Ungewählte Kreise sind
 * zurückgenommen, statt die Farbe zu verlieren – auch grau wären sie noch ein
 * zweites Zeichen für dieselbe Person.
 */
export function PersonButton({
  id,
  name,
  selected,
  onClick,
  size = 'sm',
}: {
  id: string
  name: string
  selected: boolean
  onClick: () => void
  /** `md` dort, wo die Reihe für sich steht – etwa unter «Zuständig». */
  size?: 'xs' | 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={name}
      aria-label={name}
      className={cn(
        'inline-flex rounded-full border-2 p-0.5 transition',
        selected
          ? 'border-brand-500'
          : 'border-transparent opacity-55 hover:border-slate-300 hover:opacity-100 dark:hover:border-slate-600',
      )}
    >
      <UserAvatar userId={id} name={name} size={size} />
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
  stacked = false,
}: {
  value: string[]
  onChange: (next: string[]) => void
  label?: string
  single?: boolean
  placeholder?: string
  /**
   * Ein Name je Zeile, über die ganze Breite – statt Marken nebeneinander.
   *
   * In einer Tabellenspalte «Name» ist das der Normalfall: Dort stehen ein
   * Ehepaar oder drei Geschwister untereinander, und nebeneinander gequetscht
   * wäre keiner davon zu lesen.
   */
  stacked?: boolean
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
      {/* Ohne Beschriftung – im variablen Layout steht sie schon über dem
          Feld, und eine zweite darunter wäre dasselbe zweimal. */}
      {label && <span className="label">{label}</span>}

      {value.length > 0 && (
        <div className={cn('mb-2', stacked ? 'space-y-1' : 'flex flex-wrap gap-1.5')}>
          {value.map((id) => {
            const member = membersById.get(id)
            const name = member ? `${member.firstName} ${member.lastName}` : 'Unbekannt'
            if (stacked) {
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <Avatar name={name} id={id} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="btn-ghost shrink-0 p-1"
                    aria-label={`${name} entfernen`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              )
            }
            return (
              <span key={id} className={cn('chip', colorForId(id))}>
                {name}
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
/* Ein Mitglied in einer Spalte                                        */
/* ------------------------------------------------------------------ */

/**
 * Ein einzelnes Mitglied, so breit wie eine Tabellenspalte.
 *
 * Anders als der `MemberPicker` sammelt dieses Feld nichts an: Es steht
 * genau ein Name darin, und wer tippt, bekommt die Treffer als Überlagerung
 * statt als aufklappende Liste – neben zwei weiteren Spalten wäre für mehr
 * kein Platz.
 *
 * Getippter Text allein wählt nie jemanden aus; das geschieht ausschliesslich
 * über die Trefferliste. Steht ein Name da, der zu keinem Mitglied (mehr)
 * gehört – etwa aus einem früheren Programm –, bleibt er lesbar stehen.
 */
export function MemberCombobox({
  memberId,
  name,
  onChange,
  label,
  placeholder = 'Name eingeben …',
  className,
}: {
  memberId: string | null | undefined
  /** Der gespeicherte Name – gilt, solange kein Mitglied dahintersteht */
  name: string
  onChange: (next: { memberId: string | null; name: string }) => void
  /** Für Bildschirmleser, weil über dem Feld keine Beschriftung steht */
  label: string
  placeholder?: string
  className?: string
}) {
  const { members, membersById } = useData()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const selected = memberId ? (membersById.get(memberId) ?? null) : null
  const chosen = selected ? `${selected.firstName} ${selected.lastName}` : name.trim()

  const results = useMemo(() => {
    if (!search.trim()) return []
    return members
      .filter((member) => matchesSearch(`${member.firstName} ${member.lastName}`, search))
      .slice(0, 8)
  }, [members, search])

  if (chosen) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700',
          className,
        )}
      >
        <Avatar name={chosen} id={selected?.id} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm">{chosen}</span>
        <button
          type="button"
          className="btn-ghost p-1"
          onClick={() => {
            onChange({ memberId: null, name: '' })
            setSearch('')
          }}
          aria-label={`${label}: Auswahl aufheben`}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        className="input pl-9"
        aria-label={label}
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
                onClick={() => {
                  onChange({
                    memberId: member.id,
                    name: `${member.firstName} ${member.lastName}`,
                  })
                  setSearch('')
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Avatar name={`${member.firstName} ${member.lastName}`} id={member.id} size="sm" />
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
          Keine Übereinstimmung im Mitgliederverzeichnis.
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

/**
 * Kompakter Umschalter für Filter mit wenigen, sich ausschliessenden Werten.
 *
 * `wrap` bricht die Knöpfe auf mehrere Zeilen um, statt sie seitwärts
 * scrollen zu lassen. Im Ansichtsmenü ist das der Normalfall: Dort wäre eine
 * Wahlmöglichkeit, die man erst herbeischieben muss, eine, die niemand
 * findet – vier Ausschnitte mit ihren Zahlen passen am Telefon nicht in eine
 * Zeile.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  wrap = false,
  className,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (next: T) => void
  size?: 'sm' | 'md'
  wrap?: boolean
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex max-w-full gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800',
        wrap ? 'flex-wrap' : 'no-scrollbar overflow-x-auto',
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
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-sm',
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

/**
 * Der Kopf einer Seite: Titel links, Knöpfe rechts.
 *
 * `hidden` blendet die Beschriftung aus, ohne die Knöpfe mitzunehmen – auf
 * der Übersicht lässt sich die Begrüssung so abwählen. Für Bildschirmleser
 * bleibt der Titel stehen: Eine Seite ohne Überschrift ist dort eine Seite
 * ohne Namen.
 *
 * Die Knöpfe hängen an `ms-auto` und nicht nur am `justify-between`: Rutschen
 * sie bei einem langen Titel in die zweite Zeile, stünden sie dort sonst
 * links – eine Reihe, die auf jeder Seite oben rechts steht, ausgerechnet am
 * Telefon in der Mitte des Bildes.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  hidden = false,
  sticky = false,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  /** Titel und Untertitel nur für Bildschirmleser ausgeben */
  hidden?: boolean
  /**
   * Der Kopf bleibt beim Blättern stehen.
   *
   * Für Seiten, auf denen weit gescrollt wird und die Knöpfe unterwegs
   * gebraucht werden – im Aktivitätenplan etwa der Wechsel der Ansicht,
   * mitten im Dezember. Er klebt unter der Kopfzeile der App (`top-14`) und
   * deckt den durchlaufenden Inhalt mit dem Seitenhintergrund ab; dafür
   * greift er über das Polster des Inhaltsbereichs hinaus.
   *
   * Deckend und ohne Weichzeichner, anders als die Kopfzeile der App: Ein
   * Weichzeichner macht das Element zum Bezugsrahmen für alles Feststehende
   * darin – das Ansichtsmenü in diesem Kopf hätte sich danach am Kopf
   * ausgerichtet statt am Bildschirm.
   */
  sticky?: boolean
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap justify-between',
        // Ein bleibender Kopf ist schmaler: Er begleitet den Inhalt, statt
        // ihn anzukündigen – und am Telefon passt so alles auf eine Zeile.
        sticky
          ? 'sticky top-14 z-30 -mx-4 mb-4 items-center gap-x-2 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-2.5 sm:-mx-6 sm:gap-3 sm:px-6 dark:border-slate-800 dark:bg-slate-950'
          : 'mb-5 items-start gap-3',
        // Ohne sichtbaren Titel bleibt die Knopfreihe allein – dann darf sie
        // näher an den Inhalt rücken.
        hidden && !sticky && 'mb-3',
      )}
    >
      <div className={cn('min-w-0', hidden && 'sr-only')}>
        <h1
          className={cn('font-semibold tracking-tight sm:text-2xl', sticky ? 'text-lg' : 'text-xl')}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>}
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
