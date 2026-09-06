import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatDateShort, formatDayMonthYear } from '@/lib/dates'
import {
  EXPORT_RANGES,
  EXPORT_RANGE_LABELS,
  exportRows,
  type ExportRange,
  type MusicRow,
  type OrganistRef,
} from '@/lib/organist'
import { sundayProgram } from '@/lib/sunday'
import { cn } from '@/lib/utils'
import { HYMN_SLOTS, HYMN_SLOT_LABELS, type HymnChoice, type SacramentMeeting } from '@/lib/types'

/**
 * Die Liederliste ausdrucken – als Blatt für die Organisten.
 *
 * Der Zweck steht am Anfang: Wer an der Orgel eingeteilt ist, soll auf einem
 * Blatt sehen, an welchen Sonntagen er spielt und welche Lieder dann
 * gesungen werden. Deshalb eine Tabelle und keine Aufzählung – eine Zeile je
 * Sonntag, die Lieder in Spalten daneben.
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
   * Der Organist, nach dem die Seite gerade filtert.
   *
   * Wer die Sonntage einer Person vor sich hat und dann «Exportieren»
   * drückt, meint deren Blatt – nicht das der ganzen Gemeinde. Die Auswahl
   * lässt sich im Dialog jederzeit ändern.
   */
  preselect?: string
}) {
  const { settings, membersById } = useData()
  /* Der Ausschnitt bleibt gewählt: Wer die Liste vierteljährlich
     verschickt, soll das nicht jedes Mal neu einstellen müssen. Ein Wert
     aus einer früheren Fassung wird dabei verworfen. */
  const [stored, setRange] = useLocalStorage<ExportRange>('bss:musik:ausdruck', 'quarter')
  const range = EXPORT_RANGES.includes(stored) ? stored : 'quarter'
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

  /** Alle Sonntage des Ausschnitts – die Auswahl schränkt daraus ein. */
  const all = useMemo(
    () => exportRows(date, range, meetings, [], resolve),
    [date, range, meetings, resolve],
  )

  /*
   * Zur Wahl stehen die Organisten, die in diesem Ausschnitt tatsächlich
   * eingeteilt sind. Eine Liste aller je Eingeteilten wäre über die Jahre
   * lang und stünde grösstenteils für Sonntage, die gar nicht gedruckt
   * werden.
   */
  const available = useMemo(() => {
    const found = new Map<string, OrganistRef>()
    for (const row of all) if (row.organist) found.set(row.organist.key, row.organist)
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [all])

  /* Was gewählt war, aber im neuen Ausschnitt nicht vorkommt, zählt nicht
     mit – sonst käme ein leeres Blatt heraus, ohne dass jemand sähe, warum. */
  const active = useMemo(
    () => selected.filter((key) => available.some((entry) => entry.key === key)),
    [selected, available],
  )

  const rows = useMemo(
    () =>
      active.length === 0
        ? all
        : all.filter((row) => row.organist && active.includes(row.organist.key)),
    [all, active],
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
   * Vorschau des Browsers zeigt sonst ein Blatt, hinter dem noch ein
   * halbes Fenster steht, und die Scroll-Sperre des Dialogs schnitte den
   * Ausdruck nach der ersten Seite ab.
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
      ? 'Alle Organisten'
      : available
          .filter((entry) => active.includes(entry.key))
          .map((entry) => entry.name)
          .join(', ')

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Liederliste ausdrucken"
        description="Eine Tabelle mit Datum, Organist und den Liedern – zum Weitergeben oder als PDF sichern."
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
            <span className="label">Organisten</span>
            <p className="hint mt-0 mb-2">
              Ohne Auswahl stehen alle auf dem Blatt – auch die Sonntage, an denen noch niemand
              eingeteilt ist.
            </p>
            {available.length === 0 ? (
              <p className="text-sm text-slate-400">
                In diesem Zeitraum ist noch niemand an der Orgel eingeteilt.
              </p>
            ) : (
              <div className="space-y-1">
                {available.map((entry) => {
                  const count = all.filter((row) => row.organist?.key === entry.key).length
                  return (
                    <label
                      key={entry.key}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={active.includes(entry.key)}
                        onChange={() => toggle(entry.key)}
                      />
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {count} {count === 1 ? 'Sonntag' : 'Sonntage'}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {rows.length === 0
              ? 'Für diese Auswahl gibt es nichts zu drucken.'
              : `${rows.length} ${rows.length === 1 ? 'Sonntag' : 'Sonntage'} · ${span}`}
          </p>
        </div>
      </Modal>

      {printing && <MusicSheet rows={rows} wardName={settings.wardName} span={span} who={who} />}
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
  wardName,
  span,
  who,
}: {
  rows: MusicRow[]
  wardName: string
  span: string
  who: string
}) {
  const { hymnLabel } = useData()

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
            <th className="col-who">Organist</th>
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
                <td className="col-who">
                  {row.organist?.name || <span className="muted">–</span>}
                </td>
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
                  <td colSpan={HYMN_SLOTS.length + 1}>
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
