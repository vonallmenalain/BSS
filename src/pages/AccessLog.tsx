import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ClipboardList,
  Clock,
  Inbox,
  Loader2,
  MapPin,
  MonitorSmartphone,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/ui/Pickers'
import { ConfirmDialog } from '@/components/ui/Modal'
import { UserAvatar } from '@/components/ui/Avatar'
import { EmptyState, SkeletonList, SummaryTile } from '@/components/ui/Feedback'
import { formatDateLong, formatRelative, formatTime } from '@/lib/dates'
import {
  buildRows,
  changeSummary,
  formatPlace,
  groupByDay,
  sessionMinutes,
  sortRows,
  SORT_LABELS,
  type AccountRow,
  type SortKey,
} from '@/lib/accessLog'
import { loadAccessLog, pruneAccessLog, MAX_ENTRIES } from '@/services/accessLog'
import { cn } from '@/lib/utils'
import {
  CHANGE_OP_LABELS,
  ROLE_LABELS,
  type ChangeEntry,
  type LogEntry,
  type SessionEntry,
} from '@/lib/types'

/**
 * Wer war wann da – und was hat sich dabei geändert.
 *
 * Die Seite gehört allein dem Administrator-Konto (siehe `App` und
 * `firestore.rules`) und beantwortet zwei Fragen, die sonst niemand
 * beantworten könnte: Wird die App überhaupt benutzt, und von wem? Und wenn
 * etwas anders ist als gestern – wer hat es geändert?
 *
 * ## Der Aufbau
 *
 * Eine Zeile je Konto, ausklappbar. Das ist keine Geschmacksfrage: Ein
 * Protokoll ist von Natur aus eine sehr lange Liste, und in der langen Form
 * beantwortet es keine der beiden Fragen – man sähe tausend Zeilen und wüsste
 * hinterher nicht, ob jemand fehlt. Zugeklappt steht deshalb je Konto das,
 * was man im Vorbeigehen wissen will: wann zuletzt, wie oft, wie viel
 * geändert, von wo. Erst wer eine Zeile öffnet, bekommt den Zeitstrahl mit
 * Uhrzeiten, Geräten und einzelnen Änderungen.
 *
 * Enthalten sind **alle** registrierten Konten, auch die ohne einen einzigen
 * Eintrag. «War noch nie da» ist eine Antwort, und zwar oft die interessante.
 *
 * ## Was sie nicht kann
 *
 * Sie zeigt, was die App aufgeschrieben hat, und das schreibt die App aus dem
 * Browser der jeweiligen Person heraus. Wer die Firestore-Schnittstelle
 * unmittelbar bediente, käme darin nicht vor. Das steht auch auf der Seite –
 * ein Protokoll, das mehr verspricht, als es hält, ist schlimmer als keines.
 */

/** Zur Wahl stehende Zeiträume. */
const RANGES = [
  { days: 7, label: '7 Tage' },
  { days: 30, label: '30 Tage' },
  { days: 90, label: '90 Tage' },
  { days: 365, label: '1 Jahr' },
]

/** Wie viele Tage die Balkenreihe in einer Zeile zeigt. */
const STRIP_DAYS = 14

interface LoadState {
  entries: LogEntry[]
  truncated: boolean
  error: string | null
  loadedAt: Date | null
}

export function AccessLog() {
  const { users } = useData()

  const [days, setDays] = useState(30)
  const [sort, setSort] = useState<SortKey>('last')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  /** Hochgezählt, um dieselbe Abfrage noch einmal auszulösen. */
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<LoadState>({
    entries: [],
    truncated: false,
    error: null,
    loadedAt: null,
  })

  /*
   * Geladen wird auf Abruf und nicht laufend mitverfolgt – warum, steht in
   * `services/accessLog`. Der Effekt stösst nur an; gesetzt wird der Zustand
   * erst, wenn die Antwort da ist.
   */
  useEffect(() => {
    let alive = true

    loadAccessLog(days)
      .then((page) => {
        if (!alive) return
        setState({
          entries: page.entries,
          truncated: page.truncated,
          error: null,
          loadedAt: new Date(),
        })
        setBusy(false)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!alive) return
        setState((current) => ({ ...current, error: 'Das Protokoll konnte nicht geladen werden.' }))
        setBusy(false)
      })

    return () => {
      alive = false
    }
  }, [days, nonce])

  const reload = () => {
    setBusy(true)
    setNonce((value) => value + 1)
  }

  const chooseRange = (value: number) => {
    setBusy(true)
    setDays(value)
  }

  /*
   * Gerechnet wird bei jeder Änderung an Zeitraum oder Sortierung neu – aus
   * ein paar tausend Einträgen im Speicher, ohne eine einzige weitere
   * Abfrage. Genau dafür wird einmal grosszügig geladen.
   */
  const rows = useMemo(
    () => sortRows(buildRows(state.entries, users, { days }), sort),
    [state.entries, users, days, sort],
  )

  const totals = useMemo(() => {
    const visits = rows.reduce((sum, row) => sum + row.visits, 0)
    const changes = rows.reduce((sum, row) => sum + row.changeCount, 0)
    const minutes = rows.reduce((sum, row) => sum + row.minutes, 0)
    const active = rows.filter((row) => row.visits > 0).length
    // Die gemeinsame Skala der Balkenreihen (siehe `ActivityStrip`).
    const stripMax = rows.reduce(
      (highest, row) => Math.max(highest, ...row.perDay.slice(-STRIP_DAYS)),
      1,
    )
    return { visits, changes, minutes, active, stripMax }
  }, [rows])

  return (
    <>
      <PageHeader
        title="Zugriffe"
        subtitle="Wer war wann da – und was hat sich geändert"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="log-range">
              Zeitraum
            </label>
            <select
              id="log-range"
              className="input w-auto py-1.5 text-sm"
              value={days}
              onChange={(event) => chooseRange(Number(event.target.value))}
            >
              {RANGES.map((range) => (
                <option key={range.days} value={range.days}>
                  {range.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="log-sort">
              Sortierung
            </label>
            <select
              id="log-sort"
              className="input w-auto py-1.5 text-sm"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={reload}
              disabled={busy}
              aria-label="Protokoll neu laden"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              <span className="hidden sm:inline">Neu laden</span>
            </button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile value={totals.visits} label="Zugriffe" />
          <SummaryTile value={totals.changes} label="Änderungen" />
          <SummaryTile value={totals.active} label={`von ${rows.length} Konten aktiv`} />
          <SummaryTile
            value={totals.minutes < 120 ? totals.minutes : Math.round(totals.minutes / 60)}
            label={totals.minutes < 120 ? 'Minuten in der App' : 'Stunden in der App'}
          />
        </div>

        {state.error && (
          <p className="card border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {state.error}
          </p>
        )}

        {state.truncated && (
          <p className="card border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Es werden die neuesten {MAX_ENTRIES.toLocaleString('de-CH')} Einträge gezeigt – ältere
            aus diesem Zeitraum fehlen. Wähle einen kürzeren Zeitraum oder räume weiter unten auf.
          </p>
        )}

        <section className="card overflow-hidden">
          {busy && state.entries.length === 0 ? (
            <div className="p-4">
              <SkeletonList rows={4} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Noch nichts protokolliert"
              description="Sobald sich jemand anmeldet oder etwas ändert, erscheint es hier."
            />
          ) : (
            <ul className="divide-list">
              {rows.map((row) => (
                <AccountEntry
                  key={row.uid}
                  row={row}
                  stripMax={totals.stripMax}
                  open={open === row.uid}
                  onToggle={() => setOpen((current) => (current === row.uid ? null : row.uid))}
                />
              ))}
            </ul>
          )}
        </section>

        <p className="text-right text-xs text-slate-500 dark:text-slate-400">
          {state.loadedAt
            ? `Stand: ${formatTime(state.loadedAt)} · ${state.entries.length.toLocaleString('de-CH')} Einträge`
            : ' '}
        </p>

        <Explanation />
        <PruneSection onDone={reload} />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Eine Zeile je Konto                                                 */
/* ------------------------------------------------------------------ */

function AccountEntry({
  row,
  stripMax,
  open,
  onToggle,
}: {
  row: AccountRow
  /** Höchster Tageswert der ganzen Liste – die gemeinsame Skala der Balken. */
  stripMax: number
  open: boolean
  onToggle: () => void
}) {
  const summary = [
    row.lastAt ? formatRelative(row.lastAt) : 'noch nie da gewesen',
    row.place,
    row.device,
  ].filter(Boolean)

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <UserAvatar userId={row.uid} name={row.name} size="md" />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {row.name}
            {!row.known && (
              <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                ehemalig
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {summary.join(' · ')}
          </p>
        </div>

        <ActivityStrip counts={row.perDay} max={stripMax} name={row.name} />

        <Figure value={row.visits} label="Zugriffe" />
        <Figure value={row.changeCount} label="Änderungen" className="hidden sm:block" />

        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && <Timeline row={row} />}
    </li>
  )
}

function Figure({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className={cn('w-16 shrink-0 text-right', className)}>
      <p className="tabular text-sm font-semibold">{value.toLocaleString('de-CH')}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

/**
 * Die Zugriffe der letzten zwei Wochen als Balkenreihe.
 *
 * Eine einzelne Zahl («12 Zugriffe») sagt nicht, ob jemand jeden Tag kurz
 * hereinschaut oder einmal im Monat eine Stunde arbeitet – und genau das ist
 * die Frage, die man an eine solche Liste stellt. Die Reihe beantwortet sie
 * im Vorbeigehen, ohne dass man eine Zeile öffnen müsste.
 *
 * Eine Reihe, eine Farbe, und die Höhe trägt die Menge: Es ist keine
 * Gegenüberstellung mehrerer Grössen, deshalb braucht sie weder Legende noch
 * zweite Farbe.
 *
 * `max` ist der höchste Tageswert der **ganzen Liste** und nicht der dieser
 * Zeile. Das ist der Punkt, an dem eine solche Reihe sonst lügt: Bei eigener
 * Skala sähe ein Tag mit einem einzigen Zugriff genauso hoch aus wie
 * anderswo ein Tag mit zwanzig, und zwei untereinanderstehende Zeilen wären
 * nicht mehr vergleichbar – obwohl das Untereinanderstehen genau dazu
 * einlädt.
 *
 * Ein Tag ohne Zugriff bekommt trotzdem einen Stummel in Grau. Sonst sähe
 * eine Lücke aus wie fehlende Daten statt wie ein ruhiger Tag.
 */
function ActivityStrip({ counts, max, name }: { counts: number[]; max: number; name: string }) {
  const shown = counts.slice(-STRIP_DAYS)
  const total = shown.reduce((sum, value) => sum + value, 0)

  return (
    <div
      className="hidden h-7 shrink-0 items-end gap-[2px] sm:flex"
      role="img"
      aria-label={`${name}: ${total} Zugriffe in den letzten ${shown.length} Tagen`}
    >
      {shown.map((count, index) => {
        const day = shown.length - 1 - index
        const when = day === 0 ? 'heute' : day === 1 ? 'gestern' : `vor ${day} Tagen`
        return (
          <span
            key={index}
            title={`${when}: ${count} ${count === 1 ? 'Zugriff' : 'Zugriffe'}`}
            className={cn(
              'w-1 rounded-t-[2px]',
              count === 0 ? 'bg-slate-200 dark:bg-slate-700' : 'bg-brand-500 dark:bg-brand-400',
            )}
            /* Ein einzelner Zugriff bleibt sichtbar, auch neben einem Tag mit
               zwanzig: Unter einem Sechstel der Höhe ist ein Balken kein
               Balken mehr, sondern ein Strich, der wie «nichts» aussieht. */
            style={{
              height: count === 0 ? '2px' : `${Math.max(16, (count / Math.max(max, 1)) * 100)}%`,
            }}
          />
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Der Zeitstrahl einer Zeile                                          */
/* ------------------------------------------------------------------ */

type Filter = 'all' | 'session' | 'change'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Alles' },
  { value: 'session', label: 'Zugriffe' },
  { value: 'change', label: 'Änderungen' },
]

function Timeline({ row }: { row: AccountRow }) {
  const [filter, setFilter] = useState<Filter>('all')

  const days = useMemo(
    () => groupByDay(row.entries.filter((entry) => filter === 'all' || entry.kind === filter)),
    [row.entries, filter],
  )

  if (row.entries.length === 0) {
    return (
      <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
        {row.known
          ? 'Dieses Konto hat die App in diesem Zeitraum nicht geöffnet.'
          : 'Zu diesem Konto liegt in diesem Zeitraum nichts vor.'}
      </div>
    )
  }

  return (
    <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={cn(
              'chip border transition',
              filter === option.value
                ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-100'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {option.label}
          </button>
        ))}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.email}
          {row.role && ` · ${ROLE_LABELS[row.role]}`}
        </span>
      </div>

      <ol className="space-y-4">
        {days.map((day) => (
          <li key={day.date.toISOString()}>
            <h3 className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {formatDateLong(day.date)}
            </h3>
            <ul className="divide-list rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {day.entries.map((entry) =>
                entry.kind === 'session' ? (
                  <SessionLine key={entry.id} entry={entry} />
                ) : (
                  <ChangeLine key={entry.id} entry={entry} />
                ),
              )}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}

function SessionLine({ entry }: { entry: SessionEntry }) {
  const minutes = sessionMinutes(entry)
  const from = formatTime(entry.at)
  const to = minutes > 0 ? formatTime(entry.endedAt ?? entry.at) : ''
  const place = formatPlace(entry)

  const details = [
    entry.device,
    entry.standalone ? 'als App installiert' : '',
    entry.views > 1 ? `${entry.views} Ansichten` : '',
    entry.ip,
  ].filter(Boolean)

  return (
    <li className="flex items-start gap-2.5 px-3 py-2.5">
      <Clock className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="tabular font-medium">{to ? `${from} – ${to}` : from}</span>
          <span className="text-slate-500 dark:text-slate-400">
            {minutes > 0 ? ` · ${minutes} Min.` : ' · kurz'}
          </span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          {place && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              {place}
            </span>
          )}
          {details.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <MonitorSmartphone className="size-3" aria-hidden />
              {details.join(' · ')}
            </span>
          )}
        </p>
      </div>
    </li>
  )
}

function ChangeLine({ entry }: { entry: ChangeEntry }) {
  const detail = [entry.label && `«${entry.label}»`, entry.fields?.join(', ')]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-start gap-2.5 px-3 py-2.5">
      <Pencil className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="tabular font-medium">{formatTime(entry.at)}</span>
          <span className="text-slate-600 dark:text-slate-300">
            {' · '}
            {changeSummary(entry, CHANGE_OP_LABELS)}
          </span>
        </p>
        {detail && (
          <p className="mt-0.5 text-xs break-words text-slate-500 dark:text-slate-400">{detail}</p>
        )}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Was hier steht – und was nicht                                      */
/* ------------------------------------------------------------------ */

/**
 * Die Erklärung gehört auf die Seite und nicht ins README.
 *
 * Wer ein Protokoll liest, zieht daraus Schlüsse über Menschen. Dann muss
 * danebenstehen, wie genau es ist und wo es aufhört – sonst wird aus «kein
 * Eintrag» versehentlich «war nicht da» und aus einer Ortsangabe ein
 * Aufenthaltsort.
 */
function Explanation() {
  const [open, setOpen] = useState(false)

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="-m-1 flex w-full items-center gap-2 rounded-lg p-1 text-left"
        >
          <ClipboardList className="size-4 shrink-0 text-slate-400" aria-hidden />
          <span className="flex-1">Was hier steht – und was nicht</span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-slate-400 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </h2>

      {open && (
        <div className="mt-3 space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <p>
            <strong>Ein Zugriff ist ein Besuch, kein Seitenaufruf.</strong> Wer eine halbe Stunde
            nichts tut und dann weitermacht, war zweimal da; wer zwischendurch die Ansicht wechselt,
            war einmal da. Deshalb ist die Zahl mit «Zugriffe» vergleichbar und nicht aufgebläht.
          </p>
          <p>
            <strong>Der Ort ist ungefähr.</strong> Er stammt aus der IP-Adresse und zeigt, wo der
            Anschluss registriert ist – über ein Mobilnetz kann das weit danebenliegen, hinter einem
            VPN im falschen Land. Er taugt für «wie sonst?» und nicht für mehr. Fehlt er, steht die
            Zeitzone des Geräts da.
          </p>
          <p>
            <strong>Viele Änderungen auf einmal stehen als eine Zeile.</strong> Ein Import oder eine
            umsortierte Liste schreibt Dutzende Datensätze; das Protokoll fasst sie zusammen und
            nennt die Anzahl.
          </p>
          <p>
            <strong>Es ist ein Protokoll und keine Beweissicherung.</strong> Aufgeschrieben wird aus
            der App heraus, also vom Gerät, über das es Auskunft gibt. Wer die Datenbank unmittelbar
            bediente, käme hier nicht vor.
          </p>
          <p>
            Sichtbar ist das alles ausschliesslich im Administrator-Konto – auch die Bischofschaft
            sieht es nicht. Durchgesetzt wird das in den Zugriffsregeln und nicht bloss hier in der
            Oberfläche.
          </p>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Aufräumen                                                           */
/* ------------------------------------------------------------------ */

const KEEP_OPTIONS = [90, 180, 365]

/**
 * Alte Einträge wegwerfen.
 *
 * Ein Protokoll, das nie endet, ist irgendwann kein Protokoll mehr, sondern
 * eine Sammlung über das Verhalten von Leuten, die nichts davon haben. Der
 * Knopf steht deshalb hier und nicht in einer Anleitung.
 */
function PruneSection({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [keep, setKeep] = useState(365)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const prune = async () => {
    setBusy(true)
    try {
      const removed = await pruneAccessLog(keep)
      if (removed === 0) toast.info('Es gab nichts wegzuräumen.')
      else toast.success(`${removed.toLocaleString('de-CH')} Einträge gelöscht.`)
      onDone()
    } catch (error) {
      console.error(error)
      toast.error('Aufräumen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Trash2 className="size-4 text-slate-400" aria-hidden />
        Protokoll aufräumen
      </h2>
      <p className="hint mb-4">
        Löscht alle Einträge, die älter sind als der gewählte Zeitraum. Das lässt sich nicht
        rückgängig machen.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="log-keep">
            Aufbewahren
          </label>
          <select
            id="log-keep"
            className="input w-auto"
            value={keep}
            onChange={(event) => setKeep(Number(event.target.value))}
          >
            {KEEP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} Tage
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setConfirm(true)}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          Ältere Einträge löschen
        </button>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void prune()}
        title="Alte Einträge löschen?"
        message={
          <>
            Alle Protokolleinträge, die älter sind als {keep} Tage, werden gelöscht. Die letzten{' '}
            {keep} Tage bleiben stehen.
          </>
        }
        confirmLabel="Löschen"
        danger
      />
    </section>
  )
}
