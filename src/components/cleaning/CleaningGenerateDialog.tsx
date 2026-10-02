import { useMemo, useState } from 'react'
import { Lock, Plus, Sparkles, Undo2, X } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useAllSacramentMeetings } from '@/hooks/useFirestore'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/Pickers'
import { cleaningGroupName, responsibleEntry, sortedGroups } from '@/lib/cleaningGroups'
import {
  addDays,
  addMonths,
  diffCleaningPlan,
  generateCleaningWeeks,
  nextPlanStart,
  noMeetingSundays,
  rotationStart,
  sundayOnOrBefore,
} from '@/lib/cleaningPlan'
import { formatDateShort, formatDayShort, toDateInput } from '@/lib/dates'
import { automaticSacramentKind, type StoredSunday } from '@/lib/sunday'
import { requireOnline } from '@/lib/sync'
import { cn, uid } from '@/lib/utils'
import { applyCleaningPlan } from '@/services/cleaning'
import { cleaningPeriod, cleaningWeekNumber } from '@/services/cleaningPdf'
import { fromIsoDate } from '@/services/importHistory'
import { saveSundayProgram } from '@/services/sacrament'
import { saveSettings } from '@/services/settings'
import type { CleaningGroup, CleaningWeek, CustomSundayKind } from '@/lib/types'

type Span = '3' | '6' | 'custom'

/** Was am Sonntag stattfinden soll – nur, was hier geändert wird. */
type Override = { kind: 'stake' } | { kind: 'other'; label: string } | { kind: 'meeting' }

/** Woher ein Sonntag ohne Versammlung kommt – oder dass er hier wieder einer mit wird. */
type SundayState = 'fixed' | 'saved' | 'added' | 'reset'

const OVERRIDE_PROGRAM: Record<
  Exclude<Override['kind'], 'other'>,
  { kind: string | null; kindLabel: null; meets: null; plansTalks: null }
> = {
  stake: { kind: 'stake_conference', kindLabel: null, meets: null, plansTalks: null },
  meeting: { kind: null, kindLabel: null, meets: null, plansTalks: null },
}

/**
 * Den Putzplan generieren – für einen Zeitraum, eine Gruppe nach der anderen.
 *
 * Es geht weiter, wo der Plan steht: Nach der Gruppe der letzten Woche kommt
 * die nächste (`rotationStart`), nach der letzten wieder die erste. An einem
 * Sonntag ohne Versammlung in Burgdorf putzt die Gruppe der Woche davor
 * weiter (`generateCleaningWeeks`). Welche Sonntage das sind, sagt das
 * Programm des Sonntags (`lib/sunday`):
 *
 *  - die **Generalkonferenz** ergibt sich aus der Regel und steht fest;
 *  - **Pfahlkonferenzen** und **andere Sonntage ohne Versammlung** lassen
 *    sich hier festlegen – sie landen im Programm des Sonntags, wo sie auch
 *    unter «Abendmahl» stehen, und gelten damit überall gleich.
 *
 * **Neu generieren** ist derselbe Handgriff mit einem früheren Beginn: etwa
 * wenn eine Pfahlkonferenz erst später bekannt wird. Reicht der Plan schon
 * weiter als der gewählte Zeitraum, wird bis zu seinem Ende neu eingeteilt –
 * sonst ginge die Reihenfolge danach nicht mehr auf. Was sich dabei ändert,
 * zeigt die Vorschau, bevor etwas gespeichert wird.
 */
export function CleaningGenerateDialog({
  weeks,
  groups,
  onClose,
}: {
  weeks: readonly CleaningWeek[]
  groups: readonly CleaningGroup[]
  onClose: () => void
}) {
  const toast = useToast()
  const { settings } = useData()
  const { data: sundays } = useAllSacramentMeetings()
  const today = toDateInput(new Date())

  const [from, setFrom] = useState(() => nextPlanStart(weeks, today))
  const [span, setSpan] = useState<Span>('3')
  const [customTo, setCustomTo] = useState(() => addMonths(nextPlanStart(weeks, today), 3))
  const [firstGroup, setFirstGroup] = useState<number | null>(null)
  const [overrides, setOverrides] = useState<Map<string, Override>>(() => new Map())
  const [newDate, setNewDate] = useState('')
  const [newKind, setNewKind] = useState<'stake' | 'other'>('stake')
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const ordered = sortedGroups(groups)
  const start = from ? sundayOnOrBefore(from) : ''
  const chosenTo =
    span === 'custom' ? customTo : start ? addDays(addMonths(start, Number(span)), -1) : ''
  /* Reicht der Plan schon weiter, wird bis zu seinem Ende neu eingeteilt –
     sonst ginge die Reihenfolge nach dem Zeitraum nicht mehr auf. */
  const planEnd = weeks.reduce(
    (latest, week) =>
      week.startDate >= start && week.startDate > latest ? week.startDate : latest,
    '',
  )
  const to = planEnd > chosenTo ? planEnd : chosenTo
  const valid = Boolean(start && to && start <= to)

  /** Das Programm der Sonntage – wie gespeichert, mit den Änderungen von hier. */
  const stored = useMemo(() => {
    const map = new Map<string, StoredSunday>(sundays.map((sunday) => [sunday.id, sunday]))
    for (const [key, override] of overrides) {
      map.set(
        key,
        override.kind === 'other'
          ? { kind: 'eigener_grund', kindLabel: override.label, meets: false, plansTalks: false }
          : OVERRIDE_PROGRAM[override.kind],
      )
    }
    return map
  }, [sundays, overrides])

  const noMeeting = useMemo(
    () => (valid ? noMeetingSundays(start, to, stored) : new Map<string, string>()),
    [valid, start, to, stored],
  )
  const rotation = useMemo(
    () => (valid ? rotationStart(weeks, ordered, start, noMeeting) : null),
    [valid, weeks, ordered, start, noMeeting],
  )
  const generated = useMemo(
    () =>
      valid
        ? generateCleaningWeeks({ weeks, groups: ordered, from: start, to, noMeeting, firstGroup })
        : [],
    [valid, weeks, ordered, start, to, noMeeting, firstGroup],
  )
  const diff = useMemo(() => diffCleaningPlan(weeks, generated), [weeks, generated])
  /** Der letzte Sonntag, an dem im Zeitraum eine Woche beginnt. */
  const lastStart = generated.at(-1)?.startDate ?? to
  const counts = {
    new: diff.weeks.filter((entry) => entry.change === 'new').length,
    changed: diff.weeks.filter((entry) => entry.change === 'changed').length,
    same: diff.weeks.filter((entry) => entry.change === 'same').length,
  }
  const withoutResponsible = ordered.filter((group) => !responsibleEntry(group))
  const nothingToDo =
    counts.new === 0 && counts.changed === 0 && diff.removed.length === 0 && overrides.size === 0

  /* Die Sonntage ohne Versammlung im Zeitraum – mit ihrer Herkunft. Dazu die,
     die hier gerade wieder zu gewöhnlichen Sonntagen werden. */
  const sundayRows = useMemo(() => {
    const rows: { key: string; label: string; state: SundayState }[] = [...noMeeting.entries()].map(
      ([key, label]) => {
        const override = overrides.get(key)
        const savedKind = sundays.find((sunday) => sunday.id === key)?.kind ?? null
        const rule =
          !override &&
          !savedKind &&
          automaticSacramentKind(fromIsoDate(key)) === 'general_conference'
        return { key, label, state: rule ? 'fixed' : override ? 'added' : 'saved' }
      },
    )
    for (const [key, override] of overrides) {
      if (override.kind === 'meeting')
        rows.push({ key, label: 'Wieder mit Versammlung', state: 'reset' })
    }
    return rows.sort((a, b) => a.key.localeCompare(b.key))
  }, [noMeeting, overrides, sundays])

  const setOverride = (key: string, override: Override | null) => {
    setOverrides((current) => {
      const next = new Map(current)
      if (override) next.set(key, override)
      else next.delete(key)
      return next
    })
  }

  const newDateIssue = !newDate
    ? ''
    : fromIsoDate(newDate).getDay() !== 0
      ? 'Bitte einen Sonntag wählen.'
      : newDate < start || newDate > lastStart
        ? 'Der Sonntag liegt nicht im Zeitraum.'
        : ''

  const addSunday = () => {
    if (!newDate || newDateIssue) return
    if (newKind === 'other' && !newLabel.trim()) {
      toast.error('Bitte gib einen Grund an, z. B. «Gemeindeausflug».')
      return
    }
    setOverride(
      newDate,
      newKind === 'stake' ? { kind: 'stake' } : { kind: 'other', label: newLabel.trim() },
    )
    setNewDate('')
    setNewLabel('')
  }

  const apply = async () => {
    setBusy(true)
    try {
      requireOnline()
      let kinds: CustomSundayKind[] = settings.customSundayKinds ?? []
      for (const [key, override] of overrides) {
        const date = fromIsoDate(key)
        if (override.kind !== 'other') {
          await saveSundayProgram(date, OVERRIDE_PROGRAM[override.kind])
          continue
        }
        // Ein eigener Grund steht danach auch unter «Abendmahl» zur Wahl –
        // derselbe Name ist derselbe Grund.
        let grund = kinds.find(
          (kind) => !kind.meets && kind.label.toLowerCase() === override.label.toLowerCase(),
        )
        if (!grund) {
          grund = { id: uid(), label: override.label, meets: false, plansTalks: false }
          kinds = [...kinds, grund]
          await saveSettings({ customSundayKinds: kinds })
        }
        await saveSundayProgram(date, {
          kind: grund.id,
          kindLabel: grund.label,
          meets: false,
          plansTalks: false,
        })
      }
      await applyCleaningPlan(
        generated,
        diff.removed.map((week) => week.id),
      )
      toast.success(
        `Putzplan generiert: ${generated.length} ${generated.length === 1 ? 'Woche' : 'Wochen'} bis ${formatDayShort(fromIsoDate(generated[generated.length - 1].endDate))}`,
      )
      onClose()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Generieren fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Putzplan generieren"
      description="Eine Gruppe nach der anderen – an Sonntagen ohne Versammlung putzt dieselbe Gruppe weiter."
      size="xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void apply()}
            disabled={busy || !valid || ordered.length === 0 || nothingToDo}
          >
            <Sparkles className="size-4" aria-hidden />
            {generated.length > 0 ? `${generated.length} Wochen übernehmen` : 'Übernehmen'}
          </button>
        </>
      }
    >
      {ordered.length === 0 ? (
        <p className="hint mt-0">
          Zuerst braucht es die Gruppeneinteilung – unter «Gruppeneinteilung» oder als Import unter
          «Einstellungen › Importe › Putzgruppen».
        </p>
      ) : (
        <div className="space-y-5">
          {/* ---------- Zeitraum ---------- */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="generate-from">
                Ab
              </label>
              <input
                id="generate-from"
                type="date"
                className="input"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <p className="hint">
                {start
                  ? `Beginnt am ${formatDateShort(fromIsoDate(start))}`
                  : 'Wähle den ersten Tag.'}
                {start && start !== nextPlanStart(weeks, today) && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="text-brand-600 dark:text-brand-300 hover:underline"
                      onClick={() => setFrom(nextPlanStart(weeks, today))}
                    >
                      anschliessend an den Plan
                    </button>
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="label">Dauer</p>
              <SegmentedControl<Span>
                value={span}
                onChange={setSpan}
                options={[
                  { value: '3', label: '3 Monate' },
                  { value: '6', label: '6 Monate' },
                  { value: 'custom', label: 'Bis …' },
                ]}
              />
              {span === 'custom' && (
                <input
                  type="date"
                  className="input mt-2"
                  value={customTo}
                  aria-label="Bis"
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              )}
            </div>
          </section>

          {valid && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong>{generated.length} Wochen</strong>,{' '}
              {cleaningPeriod({ startDate: start, endDate: addDays(lastStart, 6) })}
              {planEnd > chosenTo && (
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Der Plan reicht schon bis {formatDayShort(fromIsoDate(addDays(planEnd, 6)))} – neu
                  eingeteilt wird bis dorthin, damit die Reihenfolge danach aufgeht.
                </span>
              )}
            </p>
          )}
          {!valid && from && <p className="hint">Das Ende liegt vor dem Anfang.</p>}

          {/* ---------- Erste Gruppe ---------- */}
          {valid && rotation && (
            <section>
              <label className="label" htmlFor="generate-first">
                Erste Gruppe
              </label>
              <select
                id="generate-first"
                className="input sm:w-auto"
                value={firstGroup ?? ''}
                onChange={(event) =>
                  setFirstGroup(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">
                  Wie im Plan – {cleaningGroupName(rotation.group ?? ordered[0].number)}
                </option>
                {ordered.map((group) => (
                  <option key={group.number} value={group.number}>
                    {cleaningGroupName(group.number)}
                  </option>
                ))}
              </select>
              <p className="hint">
                {rotation.previous
                  ? `Davor: ${rotation.previous.group} in der Woche ${cleaningPeriod(rotation.previous)}.`
                  : 'Davor steht nichts im Plan – es beginnt die erste Gruppe.'}
              </p>
            </section>
          )}

          {/* ---------- Sonntage ohne Versammlung ---------- */}
          <section>
            <h3 className="text-sm font-semibold">Sonntage ohne Versammlung in Burgdorf</h3>
            <p className="hint mt-0.5">
              An diesen Sonntagen putzt die Gruppe der Woche davor eine Woche länger.
              Pfahlkonferenzen und andere Ausnahmen werden im Programm des Sonntags gespeichert –
              unter «Abendmahl» stehen sie dann ebenso.
            </p>
            <ul className="mt-2 space-y-1.5">
              {sundayRows.length === 0 && (
                <li className="text-sm text-slate-500 dark:text-slate-400">Keine im Zeitraum.</li>
              )}
              {sundayRows.map((row) => (
                <li
                  key={row.key}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm',
                    row.state === 'reset'
                      ? 'border-dashed border-slate-300 text-slate-500 dark:border-slate-700'
                      : 'border-slate-200 dark:border-slate-800',
                  )}
                >
                  <span className="tabular w-24 shrink-0">
                    {formatDayShort(fromIsoDate(row.key))}
                  </span>
                  <span className={cn('flex-1', row.state === 'reset' && 'line-through')}>
                    {row.label}
                  </span>
                  {row.state === 'fixed' && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Lock className="size-3" aria-hidden />
                      fest
                    </span>
                  )}
                  {row.state === 'added' && (
                    <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                      neu
                    </span>
                  )}
                  {row.state === 'saved' && (
                    <button
                      type="button"
                      className="btn-ghost p-1"
                      onClick={() => setOverride(row.key, { kind: 'meeting' })}
                      aria-label="Wieder mit Versammlung"
                      title="Doch eine Versammlung – im Programm zurücksetzen"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                  {(row.state === 'added' || row.state === 'reset') && (
                    <button
                      type="button"
                      className="btn-ghost p-1"
                      onClick={() => setOverride(row.key, null)}
                      aria-label="Rückgängig"
                      title="Rückgängig"
                    >
                      <Undo2 className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-start">
              <input
                type="date"
                className="input"
                value={newDate}
                min={start}
                max={valid ? lastStart : undefined}
                aria-label="Sonntag"
                onChange={(event) => setNewDate(event.target.value)}
              />
              <select
                className="input"
                value={newKind}
                aria-label="Art"
                onChange={(event) => setNewKind(event.target.value as 'stake' | 'other')}
              >
                <option value="stake">Pfahlkonferenz</option>
                <option value="other">Anderer Grund</option>
              </select>
              {newKind === 'other' ? (
                <input
                  className="input"
                  value={newLabel}
                  placeholder="z. B. Gemeindeausflug"
                  aria-label="Grund"
                  onChange={(event) => setNewLabel(event.target.value)}
                />
              ) : (
                <span className="hidden sm:block" />
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={addSunday}
                disabled={!newDate || Boolean(newDateIssue)}
              >
                <Plus className="size-4" aria-hidden />
                Hinzufügen
              </button>
            </div>
            {newDateIssue && (
              <p className="hint text-amber-700 dark:text-amber-400">{newDateIssue}</p>
            )}
          </section>

          {/* ---------- Vorschau ---------- */}
          {valid && generated.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold">Vorschau</h3>
              <p className="hint mt-0.5">
                {counts.new} neu · {counts.changed} geändert · {counts.same} unverändert
                {diff.removed.length > 0 && ` · ${diff.removed.length} entfällt`}
              </p>
              {withoutResponsible.length > 0 && (
                <p className="hint text-amber-700 dark:text-amber-400">
                  {withoutResponsible.map((group) => cleaningGroupName(group.number)).join(', ')}{' '}
                  {withoutResponsible.length === 1 ? 'hat' : 'haben'} niemanden als zuständig – «An
                  der Reihe» bleibt dort leer.
                </p>
              )}
              <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">KW</th>
                      <th className="px-3 py-2 font-medium">Datum</th>
                      <th className="px-3 py-2 font-medium">An der Reihe</th>
                      <th className="px-3 py-2 font-medium">Gruppe</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {diff.weeks.map(({ week, change, before }) => (
                      <tr
                        key={week.startDate}
                        className={cn(change === 'same' && 'text-slate-500 dark:text-slate-400')}
                      >
                        <td className="tabular px-3 py-1.5">{cleaningWeekNumber(week)}</td>
                        <td className="tabular px-3 py-1.5 whitespace-nowrap">
                          {cleaningPeriod(week)}
                        </td>
                        <td className="px-3 py-1.5">
                          {week.team || <span className="text-slate-400">–</span>}
                          {week.note && (
                            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                              ({week.note})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{week.group}</td>
                        <td className="px-3 py-1.5 text-right">
                          {change === 'new' && (
                            <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                              neu
                            </span>
                          )}
                          {change === 'changed' && (
                            <span
                              className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                              title={
                                before ? `Vorher: ${before.group} · ${before.team}` : undefined
                              }
                            >
                              geändert
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {diff.removed.length > 0 && (
                <p className="hint">
                  Entfällt:{' '}
                  {diff.removed
                    .map((week) => `${cleaningPeriod(week)} (${week.group || week.team})`)
                    .join(', ')}
                </p>
              )}
              {nothingToDo && <p className="hint">Der Plan stimmt für diesen Zeitraum schon.</p>}
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
