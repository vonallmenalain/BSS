import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp, CircleAlert, Pencil, Printer } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { usePrayers, useTalks } from '@/hooks/useFirestore'
import { SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { formatDateLong, toDate, toDateInput } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { formatHymn } from '@/services/hymns'
import {
  buildProgram,
  findGaps,
  moveInList,
  saveSacramentMeeting,
  talksForDate,
  type ProgramEntry,
} from '@/services/sacrament'
import {
  BUSINESS_TYPE_LABELS,
  PRAYER_SLOT_LABELS,
  SACRAMENT_KIND_LABELS,
  type BusinessEntry,
  type PrayerSlot,
  type SacramentKind,
} from '@/lib/types'

/** Angelegenheiten, die im Ablauf unter Punkt «Angelegenheiten» erscheinen. */
const BUSINESS_IN_STEP_6 = new Set(['sustaining', 'release', 'ordination', 'welcome', 'other'])

/**
 * Leitung: der ganze Ablauf auf einer Seite.
 *
 * Hier wird nichts doppelt erfasst. Ansprachen, Bekanntmachungen, Lieder und
 * Gebete stammen aus ihren Bereichen und erscheinen automatisch; anpassbar ist
 * an dieser Stelle nur, was die Leitung wirklich betrifft: wer leitet, wen man
 * begrüsst – und in welcher Reihenfolge Ansprachen, Zeugnisse, Zwischenlied
 * und Musikeinlagen aufeinanderfolgen.
 *
 * Der Aufbau folgt dem Handbuch (Abschnitt 29.2.1), bewusst vereinfacht auf
 * das, was am Pult gebraucht wird.
 */
export function Conducting() {
  const { date, meeting } = useSacrament()
  const { users, settings, membersById } = useData()
  const { profile } = useAuth()
  const { data: talks } = useTalks(400)
  const { data: prayers } = usePrayers(200)
  const toast = useToast()

  const [editOpen, setEditOpen] = useState(false)

  const dateKey = toDateInput(date)
  const sundayTalks = useMemo(() => talksForDate(talks, date), [talks, date])

  const prayerBySlot = useMemo(() => {
    const map = new Map<PrayerSlot, string>()
    for (const prayer of prayers) {
      if (toDateInput(toDate(prayer.date)) === dateKey) map.set(prayer.slot, prayer.memberName)
    }
    return map
  }, [prayers, dateKey])

  const program = useMemo(
    () => buildProgram(meeting, sundayTalks, (choice) => formatHymn(choice)),
    [meeting, sundayTalks],
  )

  const gaps = useMemo(
    () =>
      findGaps(
        meeting,
        sundayTalks,
        { opening: prayerBySlot.has('opening'), closing: prayerBySlot.has('closing') },
        settings.talksPerSunday,
      ),
    [meeting, sundayTalks, prayerBySlot, settings.talksPerSunday],
  )

  const business = meeting?.business ?? []
  const generalBusiness = business.filter((entry) => BUSINESS_IN_STEP_6.has(entry.type))
  const blessings = business.filter((entry) => entry.type === 'baby_blessing')
  const confirmations = business.filter((entry) => entry.type === 'confirmation')

  const nameOf = (id: string | null | undefined) =>
    id ? (users.find((user) => user.id === id)?.displayName ?? '–') : '–'

  /** Reihenfolge im Teil «Botschaften und Musik» sofort speichern. */
  const move = async (index: number, delta: number) => {
    const keys = program.map((entry) => entry.key)
    const next = moveInList(keys, index, delta)
    if (next === keys) return
    try {
      await saveSacramentMeeting(date, { programOrder: next })
    } catch (error) {
      console.error(error)
      toast.error('Reihenfolge konnte nicht gespeichert werden.')
    }
  }

  const musicalNumberById = (key: string) =>
    (meeting?.musicalNumbers ?? []).find((number) => key === `music:${number.id}`)

  const steps: { title: string; to?: string; content: ReactNode }[] = [
    {
      title: 'Vorspiel',
      content: <Muted>Andachtsvolle Musik vor Beginn der Versammlung.</Muted>,
    },
    {
      title: 'Willkommensgrüsse',
      content: <Muted>{nameOf(meeting?.conductingId)}</Muted>,
    },
    {
      title: 'Begrüssung der Besucher',
      content: meeting?.visitors?.trim() ? (
        <p className="text-sm">{meeting.visitors}</p>
      ) : (
        <Muted>Keine besuchenden Führungsverantwortlichen angekündigt.</Muted>
      ),
    },
    {
      title: 'Bekanntmachungen',
      to: '/abendmahl/bekanntmachungen',
      content: meeting?.announcements?.length ? (
        <ol className="space-y-1.5 text-sm">
          {meeting.announcements.map((entry) => (
            <li key={entry.id}>
              <span className="font-medium">{entry.text}</span>
              {entry.details?.trim() && (
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {entry.details}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <Muted>Keine Bekanntmachungen.</Muted>
      ),
    },
    {
      title: 'Anfangslied und Anfangsgebet',
      to: '/abendmahl/musik',
      content: (
        <>
          <Line
            label="Anfangslied"
            value={formatHymn(meeting?.hymns?.opening)}
            to="/abendmahl/musik"
          />
          <Line
            label={PRAYER_SLOT_LABELS.opening}
            value={prayerBySlot.get('opening') ?? '–'}
            to="/abendmahl/gebet"
          />
        </>
      ),
    },
    {
      title: 'Angelegenheiten der Gemeinde',
      to: '/abendmahl/angelegenheiten',
      content: <BusinessList entries={generalBusiness} />,
    },
    ...(blessings.length > 0
      ? [
          {
            title: 'Namensgebung und Kindessegnung',
            to: '/abendmahl/angelegenheiten',
            content: <BusinessList entries={blessings} />,
          },
        ]
      : []),
    ...(confirmations.length > 0
      ? [
          {
            title: 'Konfirmierung',
            to: '/abendmahl/angelegenheiten',
            content: <BusinessList entries={confirmations} />,
          },
        ]
      : []),
    {
      title: 'Abendmahlslied und Spendung des Abendmahls',
      to: '/abendmahl/musik',
      content: (
        <>
          <Line
            label="Abendmahlslied"
            value={formatHymn(meeting?.hymns?.sacrament)}
            to="/abendmahl/musik"
          />
          <Muted>
            Das Abendmahl steht im Mittelpunkt. Andere Teile der Versammlung dürfen nicht davon
            ablenken.
          </Muted>
        </>
      ),
    },
    {
      title: 'Botschaften über das Evangelium und Musik',
      to: '/abendmahl/ansprachen',
      content: (
        <>
          {program.length === 0 ? (
            <Muted>Noch nichts eingeteilt.</Muted>
          ) : (
            <ol className="space-y-1.5">
              {program.map((entry, index) => {
                const number = entry.kind === 'music' ? musicalNumberById(entry.key) : undefined
                return (
                  <ProgramRow
                    key={entry.key}
                    entry={entry}
                    position={index + 1}
                    first={index === 0}
                    last={index === program.length - 1}
                    onMove={(delta) => void move(index, delta)}
                    performerNames={number?.memberIds
                      .map((id) => {
                        const member = membersById.get(id)
                        return member ? `${member.firstName} ${member.lastName}` : ''
                      })
                      .filter(Boolean)
                      .join(', ')}
                    performerText={number?.performers}
                  />
                )
              })}
            </ol>
          )}
          <p className="hint no-print">
            Mit den Pfeilen lässt sich die Reihenfolge von Ansprachen, Zeugnissen, Zwischenlied und
            Musikeinlagen anpassen.
          </p>
        </>
      ),
    },
    {
      title: 'Schlusslied und Schlussgebet',
      to: '/abendmahl/musik',
      content: (
        <>
          <Line
            label="Schlusslied"
            value={formatHymn(meeting?.hymns?.closing)}
            to="/abendmahl/musik"
          />
          <Line
            label={PRAYER_SLOT_LABELS.closing}
            value={prayerBySlot.get('closing') ?? '–'}
            to="/abendmahl/gebet"
          />
        </>
      ),
    },
    {
      title: 'Nachspiel',
      content: <Muted>Orgel- oder Klavierspiel zum Ausklang.</Muted>,
    },
  ]

  return (
    <>
      <SectionHeader
        title="Ablauf"
        description="Alle Angaben stammen aus den übrigen Bereichen und aktualisieren sich automatisch."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditOpen((v) => !v)}>
              <Pencil className="size-4" aria-hidden />
              Leitung
            </button>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              <span className="hidden sm:inline">Drucken</span>
            </button>
          </>
        }
      />

      {editOpen && (
        <LeadershipForm
          onDone={() => setEditOpen(false)}
          defaultConductingId={meeting?.conductingId ?? profile?.id ?? null}
        />
      )}

      {gaps.length > 0 && (
        <section className="no-print mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <CircleAlert className="size-4" aria-hidden />
            Noch offen für diesen Sonntag
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {gaps.map((gap) => (
              <li key={gap.area}>
                <Link to={gap.to} className="btn-secondary btn-sm">
                  {gap.area}: {gap.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <article className="card p-5">
        <header className="mb-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold">
            {SACRAMENT_KIND_LABELS[meeting?.kind ?? 'regular']}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDateLong(date)} · {settings.sacramentTime} Uhr · {settings.wardName}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Es präsidiert:</dt>
              <dd className="font-medium">{nameOf(meeting?.presidingId)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Es leitet:</dt>
              <dd className="font-medium">{nameOf(meeting?.conductingId)}</dd>
            </div>
          </dl>
        </header>

        {/* Die Nummerierung ergibt sich aus der Liste: Segnung und Konfirmierung
            entfallen an den meisten Sonntagen und dürfen keine Lücke lassen. */}
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <Step key={step.title} number={index + 1} title={step.title} to={step.to}>
              {step.content}
            </Step>
          ))}
        </ol>

        {meeting?.notes?.trim() && (
          <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold">Notizen</h3>
            <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300">
              {meeting.notes}
            </p>
          </section>
        )}
      </article>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bausteine des Ablaufs                                               */
/* ------------------------------------------------------------------ */

function Step({
  number,
  title,
  to,
  children,
}: {
  number: number
  title: string
  to?: string
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {to && (
            <Link
              to={to}
              className="text-brand-600 dark:text-brand-300 no-print text-xs hover:underline"
            >
              bearbeiten
            </Link>
          )}
        </div>
        <div className="mt-1 space-y-1">{children}</div>
      </div>
    </li>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
}

function Line({ label, value, to }: { label: string; value: string; to?: string }) {
  const missing = value === '–'
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}:</span>
      <span className={cn('font-medium', missing && 'text-amber-600 dark:text-amber-400')}>
        {missing ? 'noch offen' : value}
      </span>
      {missing && to && (
        <Link
          to={to}
          className="text-brand-600 dark:text-brand-300 no-print text-xs hover:underline"
        >
          festlegen
        </Link>
      )}
    </p>
  )
}

function BusinessList({ entries }: { entries: BusinessEntry[] }) {
  if (entries.length === 0) return <Muted>Keine Angelegenheiten.</Muted>
  return (
    <ul className="space-y-1 text-sm">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {BUSINESS_TYPE_LABELS[entry.type]}
          </span>{' '}
          <span className="font-medium">{entry.text || '—'}</span>
        </li>
      ))}
    </ul>
  )
}

function ProgramRow({
  entry,
  position,
  first,
  last,
  onMove,
  performerNames,
  performerText,
}: {
  entry: ProgramEntry
  position: number
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  performerNames?: string
  performerText?: string
}) {
  const performers = [performerNames, performerText].filter(Boolean).join(' · ')

  return (
    <li className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <span className="tabular mt-0.5 w-4 shrink-0 text-xs text-slate-400">{position}.</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="text-slate-500 dark:text-slate-400">{entry.label}:</span>{' '}
          <span className="font-medium">{entry.title}</span>
        </p>
        {entry.detail && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{entry.detail}</p>
        )}
        {performers && <p className="text-xs text-slate-500 dark:text-slate-400">{performers}</p>}
      </div>
      <div className="no-print flex shrink-0 gap-0.5">
        <button
          type="button"
          className="btn-ghost p-1"
          onClick={() => onMove(-1)}
          disabled={first}
          aria-label={`${entry.title} nach oben`}
        >
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className="btn-ghost p-1"
          onClick={() => onMove(1)}
          disabled={last}
          aria-label={`${entry.title} nach unten`}
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Angaben zur Leitung                                                 */
/* ------------------------------------------------------------------ */

function LeadershipForm({
  onDone,
  defaultConductingId,
}: {
  onDone: () => void
  defaultConductingId: string | null
}) {
  const { date, meeting } = useSacrament()
  const { users } = useData()
  const toast = useToast()

  // Das Formular wird erst beim Aufklappen eingehängt und liest den Stand
  // deshalb direkt beim ersten Rendern – ein nachträglicher Abgleich erübrigt sich.
  const [kind, setKind] = useState<SacramentKind>(meeting?.kind ?? 'regular')
  const [presidingId, setPresidingId] = useState(meeting?.presidingId ?? '')
  const [conductingId, setConductingId] = useState(
    meeting?.conductingId ?? defaultConductingId ?? '',
  )
  const [visitors, setVisitors] = useState(meeting?.visitors ?? '')
  const [notes, setNotes] = useState(meeting?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const selectable = users.filter((user) => user.active && user.role !== 'pending')

  const save = async () => {
    setSaving(true)
    try {
      const outcome = await saveSacramentMeeting(date, {
        kind,
        presidingId: presidingId || null,
        conductingId: conductingId || null,
        visitors: visitors.trim(),
        notes: notes.trim(),
      })
      toast.saved('Angaben zur Leitung gespeichert.', outcome)
      onDone()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card no-print mb-4 space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="lead-kind">
            Art der Versammlung
          </label>
          <select
            id="lead-kind"
            className="input"
            value={kind}
            onChange={(event) => setKind(event.target.value as SacramentKind)}
          >
            {(Object.keys(SACRAMENT_KIND_LABELS) as SacramentKind[]).map((value) => (
              <option key={value} value={value}>
                {SACRAMENT_KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="lead-presiding">
            Es präsidiert
          </label>
          <select
            id="lead-presiding"
            className="input"
            value={presidingId}
            onChange={(event) => setPresidingId(event.target.value)}
          >
            <option value="">– nicht festgelegt –</option>
            {selectable.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="lead-conducting">
            Es leitet
          </label>
          <select
            id="lead-conducting"
            className="input"
            value={conductingId}
            onChange={(event) => setConductingId(event.target.value)}
          >
            <option value="">– nicht festgelegt –</option>
            {selectable.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="lead-visitors">
          Besuchende Führungsverantwortliche
        </label>
        <input
          id="lead-visitors"
          className="input"
          value={visitors}
          onChange={(event) => setVisitors(event.target.value)}
          placeholder="z. B. «Bruder Keller, Hoher Rat»"
        />
        <p className="hint">Wird im Ablauf unter «Begrüssung der Besucher» angezeigt.</p>
      </div>

      <div>
        <label className="label" htmlFor="lead-notes">
          Notizen zur Versammlung
        </label>
        <textarea
          id="lead-notes"
          className="input min-h-20 resize-y"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Hinweise für die Person am Pult …"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone} disabled={saving}>
          Abbrechen
        </button>
        <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
          <Check className="size-4" aria-hidden />
          {saving ? 'Wird gespeichert …' : 'Speichern'}
        </button>
      </div>
    </section>
  )
}
