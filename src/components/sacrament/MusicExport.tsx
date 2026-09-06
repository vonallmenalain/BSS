import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/Pickers'
import { formatDate, formatDateShort, formatDayMonthYear } from '@/lib/dates'
import {
  EXPORT_RANGE_LABELS,
  EXPORT_RANGES,
  exportRows,
  MUSIC_ROLE_LABELS,
  MUSIC_ROLE_PLURAL,
  MUSIC_ROLES,
  type ExportRange,
  type MusicPersonRef,
  type MusicRole,
  type MusicRow,
} from '@/lib/musicRoles'
import { sundayProgram } from '@/lib/sunday'
import { cn } from '@/lib/utils'
import { HYMN_SLOT_LABELS, HYMN_SLOTS, type HymnChoice, type SacramentMeeting } from '@/lib/types'

/**
 * Welche der beiden Aufgaben aufs Blatt kommen.
 *
 * «Beide» ist der Normalfall – die Liederliste geht an alle, die am Sonntag
 * Musik machen. Wer sie nur den Organisten schickt, nimmt den Dirigenten
 * weg: Eine Spalte, die niemanden angeht, macht das Blatt bloss enger.
 */
type RoleScope = 'both' | MusicRole

const SCOPE_OPTIONS: { value: RoleScope; label: string }[] = [
  { value: 'both', label: 'Beide' },
  { value: 'organist', label: 'Nur Organist' },
  { value: 'chorister', label: 'Nur Dirigent' },
]

function rolesOf(scope: RoleScope): MusicRole[] {
  return scope === 'both' ? MUSIC_ROLES : [scope]
}

/**
 * Die Liederliste ausdrucken – als Blatt für die Organisten und Dirigenten.
 *
 * Der Zweck steht am Anfang: Wer eingeteilt ist, soll auf einem Blatt sehen,
 * an welchen Sonntagen er dran ist und welche Lieder dann gesungen werden.
 * Deshalb eine Tabelle und keine Aufzählung – eine Zeile je Sonntag, die
 * Lieder in Spalten daneben.
 *
 * Drei Angaben bestimmen, was herauskommt: **Zeitraum**, **welche Spalten**
 * und **welche Personen**. Die letzten beiden hängen zusammen: Wer nur die
 * Dirigenten druckt, bekommt auch nur sie zur Auswahl.
 *
 * **PDF entsteht im Druckdialog.** Der Browser bietet dort «Als PDF
 * sichern»; eine Bibliothek dafür einzubinden hiesse, jedem Aufruf der App
 * ein Paket mehr aufzuladen – für einen Knopf, den man alle drei Monate
 * drückt. Denselben Weg geht der Ablauf unter «Leitung».
 */
export function MusicExportDialog({
  open,
  onClose,
  date,
  meetings,
  preselect = '',
}: {
  open: boolean
  onClose: () => void
  /** Der gewählte Sonntag – von ihm an geht es vorwärts. */
  date: Date
  meetings: SacramentMeeting[]
  /**
   * Die Person, nach der die Seite gerade filtert.
   *
   * Wer die Sonntage einer Person vor sich hat und dann «Exportieren»
   * drückt, meint deren Blatt – nicht das der ganzen Gemeinde. Die Auswahl
   * lässt sich im Dialog jederzeit ändern.
   */
  preselect?: string
}) {
  const { settings, membersById } = useData()
  /* Zeitraum und Spalten bleiben gewählt: Wer die Liste vierteljährlich
     verschickt, soll das nicht jedes Mal neu einstellen müssen. Werte aus
     einer früheren Fassung werden dabei verworfen. */
  const [storedRange, setRange] = useLocalStorage<ExportRange>('bss:musik:ausdruck', 'quarter')
  const range = EXPORT_RANGES.includes(storedRange) ? storedRange : 'quarter'
  const [storedScope, setScope] = useLocalStorage<RoleScope>('bss:musik:ausdruck:wer', 'both')
  const scope = SCOPE_OPTIONS.some((entry) => entry.value === storedScope) ? storedScope : 'both'
  const roles = useMemo(() => rolesOf(scope), [scope])

  const [selected, setSelected] = useState<string[]>(preselect ? [preselect] : [])
  const [printing, setPrinting] = useState(false)

  /*
   * Beim Öffnen steht die Auswahl der Seite im Dialog – nicht die von
   * letzter Woche. Gesetzt wird das beim Wechsel und nicht in einem Effekt:
   * So zeichnet React den Dialog gar nicht erst mit dem alten Stand.
   */
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(preselect ? [preselect] : [])
  }

  const resolve = useCallback(
    (id: string) => {
      const member = membersById.get(id)
      return member ? `${member.firstName} ${member.lastName}` : undefined
    },
    [membersById],
  )

  /** Alle Sonntage des Zeitraums – die Auswahl schränkt daraus ein. */
  const all = useMemo(
    () => exportRows(date, range, meetings, [], resolve),
    [date, range, meetings, resolve],
  )

  /*
   * Zur Wahl stehen die Personen, die in diesem Zeitraum tatsächlich
   * eingeteilt sind – und nur in den Aufgaben, die aufs Blatt kommen. Eine
   * Liste aller je Eingeteilten wäre über die Jahre lang und stünde
   * grösstenteils für Sonntage, die gar nicht gedruckt werden.
   */
  const available = useMemo(() => {
    const found = new Map<string, { person: MusicPersonRef; count: number }>()
    for (const row of all) {
      for (const role of roles) {
        const person = row.people[role]
        if (!person) continue
        const known = found.get(person.key)
        if (known) known.count += 1
        else found.set(person.key, { person, count: 1 })
      }
    }
    return [...found.values()].sort(
      (a, b) =>
        MUSIC_ROLES.indexOf(a.person.role) - MUSIC_ROLES.indexOf(b.person.role) ||
        a.person.name.localeCompare(b.person.name, 'de'),
    )
  }, [all, roles])

  /* Was gewählt war, aber im neuen Ausschnitt nicht vorkommt, zählt nicht
     mit – sonst käme ein leeres Blatt heraus, ohne dass jemand sähe, warum. */
  const active = useMemo(
    () => selected.filter((key) => available.some((entry) => entry.person.key === key)),
    [selected, available],
  )

  const rows = useMemo(
    () => (active.length === 0 ? all : exportRows(date, range, meetings, active, resolve)),
    [active, all, date, range, meetings, resolve],
  )

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    )

  /*
   * Drucken: erst das Blatt in die Seite stellen, dann den Dialog des
   * Browsers öffnen. `afterprint` holt die App zurück – auch dort, wo
   * `print()` sofort zurückkehrt.
   *
   * Der eigene Dialog schliesst sich vorher (siehe `startPrint` unten): Die
   * Vorschau des Browsers zeigt sonst ein Blatt, hinter dem noch ein halbes
   * Fenster steht, und die Scroll-Sperre des Dialogs schnitte den Ausdruck
   * nach der ersten Seite ab.
   */
  useEffect(() => {
    if (!printing) return

    document.body.classList.add('export-page')
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    window.print()
    done()

    return () => {
      document.body.classList.remove('export-page')
      window.removeEventListener('afterprint', done)
    }
  }, [printing])

  const startPrint = () => {
    onClose()
    setPrinting(true)
  }

  const first = rows[0]?.date
  const last = rows[rows.length - 1]?.date
  const span = first && last ? `${formatDate(first)} – ${formatDate(last)}` : '–'
  const who =
    active.length === 0
      ? roles.map((role) => MUSIC_ROLE_PLURAL[role]).join(' und ')
      : available
          .filter((entry) => active.includes(entry.person.key))
          .map((entry) => entry.person.name)
          .join(', ')

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Liederliste ausdrucken"
        description="Eine Tabelle mit Datum, den Eingeteilten und den Liedern – zum Weitergeben oder als PDF sichern."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={rows.length === 0}
              onClick={startPrint}
            >
              <Printer className="size-4" aria-hidden />
              Drucken / als PDF
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <span className="label">Zeitraum</span>
            <p className="hint mt-0 mb-2">Ab dem gewählten Sonntag, {formatDayMonthYear(date)}.</p>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_RANGES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === range}
                  onClick={() => setRange(option)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                    option === range
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
                  )}
                >
                  {EXPORT_RANGE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Welche Spalten</span>
            <p className="hint mt-0 mb-2">
              Organist, Dirigent oder beide – die Lieder stehen immer auf dem Blatt.
            </p>
            <SegmentedControl<RoleScope>
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={setScope}
              wrap
            />
          </div>

          <div>
            <span className="label">Wer genau</span>
            <p className="hint mt-0 mb-2">
              Ohne Auswahl kommen alle aufs Blatt – auch die Sonntage, an denen noch niemand
              eingeteilt ist.
            </p>
            {available.length === 0 ? (
              <p className="text-sm text-slate-400">
                In diesem Zeitraum ist dafür noch niemand eingeteilt.
              </p>
            ) : (
              <div className="space-y-3">
                {roles.map((role) => {
                  const group = available.filter((entry) => entry.person.role === role)
                  if (group.length === 0) return null
                  return (
                    <div key={role}>
                      {/* Die Gruppenüberschrift steht nur, wenn es zwei
                          Gruppen gibt – sonst sagt sie dasselbe wie die
                          Wahl darüber. */}
                      {roles.length > 1 && (
                        <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {MUSIC_ROLE_PLURAL[role]}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {group.map(({ person, count }) => (
                          <label
                            key={person.key}
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={active.includes(person.key)}
                              onChange={() => toggle(person.key)}
                            />
                            <span className="min-w-0 flex-1 truncate">{person.name}</span>
                            <span className="shrink-0 text-xs text-slate-400">
                              {count} {count === 1 ? 'Sonntag' : 'Sonntage'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {rows.length === 0
              ? 'Für diese Auswahl gibt es nichts zu drucken.'
              : `${rows.length} ${rows.length === 1 ? 'Sonntag' : 'Sonntage'} · ${span} · ${who}`}
          </p>
        </div>
      </Modal>

      {printing && (
        <MusicSheet rows={rows} roles={roles} wardName={settings.wardName} span={span} who={who} />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Das Blatt                                                           */
/* ------------------------------------------------------------------ */

/**
 * Die Tabelle, wie sie auf dem Papier steht.
 *
 * Sie hängt neben der App am `<body>` und ist am Bildschirm unsichtbar –
 * beim Drucken tritt sie an deren Stelle (siehe `export-page` in
 * `index.css`). So braucht es kein zweites Fenster, das der Browser
 * womöglich wegblockt.
 */
function MusicSheet({
  rows,
  roles,
  wardName,
  span,
  who,
}: {
  rows: MusicRow[]
  roles: MusicRole[]
  wardName: string
  span: string
  who: string
}) {
  const { hymnLabel } = useData()
  /* Datum, die gewählten Aufgaben, dann die vier Lieder. */
  const columns = 1 + roles.length + HYMN_SLOTS.length

  return createPortal(
    <div className="export-sheet">
      <header className="export-head">
        <h1>Liederliste</h1>
        <p>
          {wardName || 'Gemeinde'} · Abendmahlsversammlung · {span}
        </p>
        <p>{who}</p>
      </header>

      <table className="export-table">
        <thead>
          <tr>
            <th className="col-date">Datum</th>
            {roles.map((role) => (
              <th key={role} className="col-who">
                {MUSIC_ROLE_LABELS[role]}
              </th>
            ))}
            {HYMN_SLOTS.map((slot) => (
              <th key={slot}>{HYMN_SLOT_LABELS[slot]}</th>
            ))}
          </tr>
        </thead>
        {rows.map((row) => {
          const program = sundayProgram(row.date, row.meeting)
          const numbers = row.numbers.filter(
            (entry) => entry.title.trim() || entry.performers?.trim(),
          )
          return (
            <tbody key={row.dateKey}>
              <tr>
                <td className="col-date">
                  <strong>{formatDateShort(row.date)}</strong>
                  {/* Ein Sonntag, der keine gewöhnliche Abendmahlsversammlung
                      ist, gehört aufs Blatt: Er entscheidet, ob überhaupt
                      gespielt wird. */}
                  {program.kind !== 'regular' && <span className="note">{program.label}</span>}
                </td>
                {roles.map((role) => (
                  <td key={role} className="col-who">
                    {row.people[role]?.name || <span className="muted">–</span>}
                  </td>
                ))}
                {program.meets ? (
                  HYMN_SLOTS.map((slot) => (
                    <td key={slot}>
                      <Hymn choice={row.hymns[slot]} label={hymnLabel(row.hymns[slot])} />
                    </td>
                  ))
                ) : (
                  <td colSpan={HYMN_SLOTS.length} className="muted">
                    Keine Versammlung in der Gemeinde
                  </td>
                )}
              </tr>
              {numbers.length > 0 && (
                <tr>
                  <td className="col-date" />
                  {/* `note` gehört an das Kind und nicht an die Zelle: Die
                      Klasse macht einen Block daraus, und ein Block ist
                      keine Tabellenzelle mehr – die Spalte spränge auf. */}
                  <td colSpan={columns - 1}>
                    <span className="note">
                      Musikeinlage:{' '}
                      {numbers
                        .map((entry) =>
                          [entry.title.trim() || 'ohne Titel', entry.performers?.trim()]
                            .filter(Boolean)
                            .join(' – '),
                        )
                        .join(' · ')}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          )
        })}
      </table>

      <footer className="export-foot">Gedruckt am {formatDate(new Date())}</footer>
    </div>,
    document.body,
  )
}

/** Ein Lied in seiner Spalte: die Nummer gross, der Titel darunter. */
function Hymn({ choice, label }: { choice: HymnChoice | undefined; label: string }) {
  const code = choice?.code ?? (choice?.number != null ? String(choice.number) : '')
  if (!code && !label) return <span className="muted">–</span>
  return (
    <>
      {code && <strong className="tabular">{code}</strong>}
      {label && <span className="note">{label}</span>}
    </>
  )
}
