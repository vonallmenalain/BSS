import { useMemo, useState } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/Pickers'
import { cn } from '@/lib/utils'
import { formatWeekRange } from '@/lib/impulse'
import {
  describeImpulseReset,
  IMPULSE_RESET_PARTS,
  impulseResetOlderPeople,
  impulseResetPeople,
  planImpulseReset,
  type ImpulseResetPart,
  type ImpulseResetPerson,
  type ImpulseResetPlan,
  type ImpulseResetSource,
} from '@/lib/impulseReset'
import { resetImpulseWeek } from '@/services/impulse'

/** Die eine Woche – oder alle Wochen auf einmal. */
type ResetSpan = 'week' | 'all'

/**
 * «Woche zurücksetzen» – ganz unten in der Redaktion.
 *
 * Für die Zeit des Ausprobierens: Wer die Woche getestet hat, bevor der
 * Link an alle geht, setzt sie hier wieder auf null – angeschaute Karten,
 * Wappen, Haken, Antworten, Beiträge, Ranglisten. Die Karten selbst
 * bleiben stehen; zurückgesetzt wird, was die Leute getan haben.
 *
 * Vor dem Zurücksetzen zeigt ein Fenster, was genau geschieht: wer Spuren
 * hat und wie viele, und welche Teile mitgehen. Alles lässt sich
 * einstellen – die oben gewählte Woche oder alle Wochen, alle oder
 * einzelne Personen, alles oder nur Teile –, und die Zahlen folgen der
 * Auswahl. Erst «Zurücksetzen» schreibt.
 *
 * «Alle Wochen» ist der Neustart vor dem Start: Auch was aus früheren
 * Wochen übrig ist, verschwindet, und «Seit du dabei bist» beginnt für
 * die Betroffenen wieder bei einer Woche. Die Karte hier sagt darum
 * gleich, wer solche Spuren noch hat.
 *
 * Der Bestand (`source`) kommt aus den Abos der Seite; beim Zurücksetzen
 * rechnet der Dienst mit dem frischen Stand vom Server noch einmal
 * (`resetImpulseWeek`).
 */
export function ImpulseWeekReset({
  week,
  source,
  loading,
}: {
  week: string
  source: ImpulseResetSource
  /** Solange Antworten und Fortschritt laden, wären die Zahlen zu klein. */
  loading: boolean
}) {
  const people = useMemo(() => impulseResetPeople(source), [source])
  const peopleAll = useMemo(() => impulseResetPeople(source, { allWeeks: true }), [source])
  const older = useMemo(() => new Set(impulseResetOlderPeople(source)), [source])
  const [open, setOpen] = useState(false)
  const { usersById } = useData()
  /* Mit Vollzugriff steht der ganze Name da, sonst der Vorname aus dem
     Fortschritt – mehr kennt die Redaktion von den Jugendlichen nicht. */
  const nameOf = (person: ImpulseResetPerson) =>
    usersById.get(person.uid)?.displayName || person.firstName || 'Ohne Namen'
  const olderPeople = peopleAll.filter((person) => older.has(person.uid))

  return (
    <>
      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <RotateCcw className="size-4 text-slate-400" aria-hidden />
          Woche zurücksetzen
        </h2>
        <p className="hint mt-1">
          Für die Zeit des Ausprobierens: Was in der oben gewählten Woche ({formatWeekRange(week)})
          angeschaut, abgehakt, beantwortet und gespielt wurde, wird entfernt – für alle oder für
          einzelne Personen. Mit «Alle Wochen» auch alles aus früheren Wochen; danach beginnt «Seit
          du dabei bist» wieder bei einer Woche. Die Karten selbst bleiben. Vorher zeigt ein Fenster
          genau, was zurückgesetzt wird.
        </p>
        <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
          {loading ? (
            <p>Wird geladen …</p>
          ) : peopleAll.length === 0 ? (
            <p>Es hat noch niemand etwas getan – es gibt nichts zurückzusetzen.</p>
          ) : (
            <>
              <p>
                {people.length === 0
                  ? 'In dieser Woche hat noch niemand etwas getan.'
                  : `${people.length} ${people.length === 1 ? 'Person hat' : 'Personen haben'} Spuren in dieser Woche: ${people.map(nameOf).join(', ')}.`}
              </p>
              {olderPeople.length > 0 && (
                <p>
                  Aus anderen Wochen {olderPeople.length === 1 ? 'hat' : 'haben'} noch{' '}
                  {olderPeople.map(nameOf).join(', ')} Spuren – die entfernt «Alle Wochen».
                </p>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary mt-3 text-rose-700 dark:text-rose-300"
          onClick={() => setOpen(true)}
          disabled={loading || peopleAll.length === 0}
        >
          <RotateCcw className="size-4" aria-hidden />
          Zurücksetzen …
        </button>
      </section>

      {open && (
        <WeekResetDialog
          week={week}
          source={source}
          /* Hat die Woche nichts, aber frühere Wochen, geht es um diese. */
          initialSpan={people.length === 0 ? 'all' : 'week'}
          nameOf={nameOf}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** «18 Karten · Wappen · 3 Haken · 5 Antworten» – was eine Person getan hat. */
function personSummary(person: ImpulseResetPerson, allWeeks: boolean): string {
  const parts = [
    /* Über alle Wochen: in wie vielen davon jemand einen Stand hat. */
    allWeeks && person.weeks > 0 && `${person.weeks} ${person.weeks === 1 ? 'Woche' : 'Wochen'}`,
    /* Wer bloss hineingeschaut hat, hat trotzdem einen Stand. */
    person.progress &&
      person.cards === 0 &&
      person.ticks === 0 &&
      !person.crest &&
      (allWeeks ? 'Anti Doom geöffnet' : 'Woche geöffnet'),
    person.cards > 0 && `${person.cards} ${person.cards === 1 ? 'Karte' : 'Karten'}`,
    person.crest && 'Wappen',
    person.ticks > 0 && `${person.ticks} Haken`,
    person.answers > 0 && `${person.answers} ${person.answers === 1 ? 'Antwort' : 'Antworten'}`,
    person.comments > 0 && `${person.comments} ${person.comments === 1 ? 'Beitrag' : 'Beiträge'}`,
    person.scores > 0 && 'Rangliste',
    person.reactions > 0 && `${person.reactions} Amen/Gemerkt`,
  ].filter((part): part is string => Boolean(part))
  return parts.join(' · ')
}

/** Was ein Teil für die gewählten Personen anfasst – als kurze Zahl. */
function partCount(part: ImpulseResetPart, plan: ImpulseResetPlan): string {
  switch (part) {
    case 'progress': {
      const count = plan.progress.filter(
        (entry) => entry.weeks.length > 0 || entry.lastSeenWeek || entry.firstSeenWeek,
      ).length
      return `${count} ${count === 1 ? 'Person' : 'Personen'}`
    }
    case 'answers':
      return String(plan.answerIds.length)
    case 'comments':
      return String(plan.commentIds.length)
    case 'game':
      return String(plan.scoreIds.length)
    case 'reactions':
      return String(
        plan.progress.reduce(
          (sum, entry) => sum + entry.amens.length + entry.favorites.length + entry.reports.length,
          0,
        ),
      )
  }
}

/** Ändert der Plan überhaupt etwas? */
function planIsEmpty(plan: ImpulseResetPlan): boolean {
  return (
    plan.answerIds.length + plan.commentIds.length + plan.scoreIds.length === 0 &&
    plan.progress.length === 0
  )
}

/**
 * Das Fenster vor dem Zurücksetzen: welche Wochen, wer, was – und in
 * Zahlen, was das heisst.
 */
function WeekResetDialog({
  week,
  source,
  initialSpan,
  nameOf,
  onClose,
}: {
  week: string
  source: ImpulseResetSource
  initialSpan: ResetSpan
  nameOf: (person: ImpulseResetPerson) => string
  onClose: () => void
}) {
  const toast = useToast()
  const [span, setSpan] = useState<ResetSpan>(initialSpan)
  const allWeeks = span === 'all'
  const people = useMemo(() => impulseResetPeople(source, { allWeeks }), [source, allWeeks])
  /*
   * Alle oder einzelne: Solange «alle» gilt, nimmt das Zurücksetzen auch
   * mit, wer erst während des Fensters dazukommt. Wer einen Haken
   * wegnimmt, wählt einzeln; sind wieder alle angehakt, gilt wieder «alle».
   * Die Wahl bleibt beim Wechsel der Wochen stehen – sie gilt für die
   * Personen, die in der Liste stehen.
   */
  const [everyone, setEveryone] = useState(true)
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [parts, setParts] = useState<ReadonlySet<ImpulseResetPart>>(
    () => new Set(IMPULSE_RESET_PARTS.map((part) => part.key)),
  )
  const [busy, setBusy] = useState(false)

  const isChosen = (uid: string) => everyone || chosen.has(uid)
  const togglePerson = (uid: string) => {
    const next = new Set(everyone ? people.map((person) => person.uid) : chosen)
    if (next.has(uid)) next.delete(uid)
    else next.add(uid)
    const all = people.every((person) => next.has(person.uid))
    setEveryone(all)
    setChosen(all ? new Set() : next)
  }
  const chooseAll = (all: boolean) => {
    setEveryone(all)
    setChosen(new Set())
  }
  const togglePart = (key: ImpulseResetPart) =>
    setParts((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const listed = people.filter((person) => chosen.has(person.uid))
  const selectedPeople = everyone ? null : new Set(listed.map((person) => person.uid))
  const plan = planImpulseReset(source, { people: selectedPeople, parts, allWeeks })
  const chosenCount = everyone ? people.length : listed.length
  const nothing = planIsEmpty(plan)

  const run = async () => {
    if (busy || nothing) return
    setBusy(true)
    try {
      const done = await resetImpulseWeek({
        week,
        itemIds: [...source.itemIds],
        selection: { people: selectedPeople, parts, allWeeks },
      })
      toast.success(
        `${allWeeks ? 'Alle Wochen' : 'Woche'} zurückgesetzt – ${describeImpulseReset(done)}.`,
      )
      onClose()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error && error.message.includes('Internetverbindung')
          ? error.message
          : 'Das Zurücksetzen hat nicht geklappt. Bitte noch einmal versuchen.',
      )
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={allWeeks ? 'Alle Wochen zurücksetzen' : 'Woche zurücksetzen'}
      description={allWeeks ? 'Auch was aus früheren Wochen übrig ist' : formatWeekRange(week)}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => void run()}
            disabled={busy || nothing}
          >
            <RotateCcw className="size-4" aria-hidden />
            {busy ? 'Wird zurückgesetzt …' : 'Zurücksetzen'}
          </button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        {/* ---------- Welche Wochen ---------- */}
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Welche Wochen
          </h3>
          <SegmentedControl<ResetSpan>
            className="mt-1.5"
            value={span}
            onChange={setSpan}
            options={[
              { value: 'week', label: 'Diese Woche' },
              { value: 'all', label: 'Alle Wochen' },
            ]}
          />
          <p className="hint mt-1.5">
            {allWeeks
              ? 'Jede Woche, auch vom Testen vor dem Start und zu Karten, die es nicht mehr gibt. Danach beginnen «Seit du dabei bist» und die Serie wieder von vorn.'
              : `Nur ${formatWeekRange(week)} – was in anderen Wochen war, bleibt stehen.`}
          </p>
        </section>

        {/* ---------- Wer ---------- */}
        <section>
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Wer · {chosenCount} von {people.length}
            </h3>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => chooseAll(true)}
              disabled={everyone}
            >
              Alle
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => chooseAll(false)}
              disabled={!everyone && listed.length === 0}
            >
              Keine
            </button>
          </div>
          {people.length === 0 ? (
            <p className="mt-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {allWeeks
                ? 'Es hat noch niemand etwas getan.'
                : 'In dieser Woche hat noch niemand etwas getan – «Alle Wochen» zeigt, was aus früheren übrig ist.'}
            </p>
          ) : (
            <ul className="mt-1.5 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {people.map((person) => (
                <li key={person.uid}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="checkbox mt-0.5"
                      checked={isChosen(person.uid)}
                      onChange={() => togglePerson(person.uid)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{nameOf(person)}</span>
                      <span className="hint mt-0 block">{personSummary(person, allWeeks)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Was ---------- */}
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Was
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {IMPULSE_RESET_PARTS.map((part) => {
              const count = partCount(
                part.key,
                planImpulseReset(source, {
                  people: selectedPeople,
                  parts: new Set([part.key]),
                  allWeeks,
                }),
              )
              return (
                <li key={part.key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                    <input
                      type="checkbox"
                      className="checkbox mt-0.5"
                      checked={parts.has(part.key)}
                      onChange={() => togglePart(part.key)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 font-medium">{part.label}</span>
                        <span
                          className={cn(
                            'tabular shrink-0 text-xs',
                            parts.has(part.key)
                              ? 'font-semibold text-slate-700 dark:text-slate-200'
                              : 'text-slate-400',
                          )}
                        >
                          {count}
                        </span>
                      </span>
                      <span className="hint mt-0.5 block">{part.hint}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>

        {/* ---------- Was das heisst ---------- */}
        <p
          className={cn(
            'flex items-start gap-2.5 rounded-xl border p-3',
            nothing
              ? 'border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400'
              : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100',
          )}
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {nothing
              ? 'Mit dieser Auswahl gibt es nichts zurückzusetzen.'
              : `Zurückgesetzt wird ${allWeeks ? 'über alle Wochen ' : ''}für ${describeImpulseReset(plan)}. Die Karten bleiben. Das lässt sich nicht rückgängig machen.`}
          </span>
        </p>
      </div>
    </Modal>
  )
}
