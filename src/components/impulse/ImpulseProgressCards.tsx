import { Check, CheckCircle2, ChevronRight, Repeat, Shield, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardEmoji, ImpulseItemImage, SourceLink } from '@/components/impulse/ImpulseCards'
import type { ScreenOrigin } from '@/components/impulse/ImpulseScreen'
import { CHALLENGE_DAY_LABELS, useChallengeDays, useWeekGoal } from '@/hooks/useImpulseTasks'
import { IMPULSE_SECTIONS } from '@/lib/impulseSections'
import type { ImpulseItem } from '@/lib/types'

/*
 * Die Challenge-Karten des Bereichs «Anti Doom»: das Wochenziel mit seinem
 * einen Haken, die Tages-Challenge mit ihren sieben, dazu die
 * Gruppenleiste. Abgehakt wird per Selbstauskunft – die Karten fragen
 * nicht nach, sie glauben es. Die Serie wohnt seit dem Kachel-Umbau in
 * «Mein Fortschritt» (`ImpulseStats`).
 *
 * Die beiden Aufgaben-Karten sind die Vollbild-Räume; dieselben Haken
 * stehen auch in der Mission der Woche (`ImpulseMissionTasks`). Beide
 * teilen sich die Logik (`hooks/useImpulseTasks`). Wie die Quizkarte
 * kennen die Karten einen Vorschau-Modus: Dort lebt der Haken nur im
 * Fenster, gespeichert wird nichts.
 */

/** Das Wochenziel: eine Aufgabe für die Woche, ein Haken. */
export function GoalCard({
  item,
  week,
  done,
  preview = false,
  plain = false,
}: {
  item: ImpulseItem
  week: string
  done: boolean
  preview?: boolean
  /** Ohne Bereichszeile – im Vollbild steht der Bereich schon im Kopf. */
  plain?: boolean
}) {
  const { isDone, busy, celebrate, toggle } = useWeekGoal(week, done, preview)

  return (
    <section className={plain ? undefined : 'card p-5'}>
      {!plain && (
        <p className="hint flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="size-4" aria-hidden />
          Wochenziel
        </p>
      )}
      <CardEmoji item={item} />
      <h2
        className={
          plain
            ? 'text-xl leading-snug font-semibold text-balance'
            : 'mt-2 text-lg font-semibold text-balance'
        }
      >
        {item.title}
      </h2>
      <ImpulseItemImage item={item} />
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      {item.source?.label && (
        <div className="mt-3">
          <SourceLink item={item} />
        </div>
      )}

      {/* Der eine Haken der Woche: Die Zeile gibt beim Drücken nach, der
          Haken springt herein (scale-in) – das kleine Fest, das die
          Selbstauskunft verdient. */}
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={isDone}
        className={cn(
          'mt-4 flex w-full items-center gap-2.5 rounded-lg border p-3 text-left text-sm font-medium transition active:scale-[0.98]',
          isDone
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
        )}
      >
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-md border',
            isDone
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-300 dark:border-slate-600',
          )}
          aria-hidden
        >
          {isDone && <Check className={cn('size-3.5', celebrate && 'animate-scale-in')} />}
        </span>
        {isDone ? (
          <span className={celebrate ? 'animate-fade-in' : undefined}>Geschafft!</span>
        ) : (
          'Geschafft? Hier abhaken.'
        )}
      </button>
    </section>
  )
}

/** Die Tages-Challenge: eine kleine Aufgabe, sieben Haken. */
export function ChallengeCard({
  item,
  week,
  days,
  preview = false,
  plain = false,
}: {
  item: ImpulseItem
  week: string
  /** Die abgehakten Tage («2026-08-11») aus dem eigenen Fortschritt. */
  days: string[]
  preview?: boolean
  /** Ohne Bereichszeile – im Vollbild steht der Bereich schon im Kopf. */
  plain?: boolean
}) {
  const { allDays, today, checked, doneCount, busyDays, celebrateDay, isFuture, toggle } =
    useChallengeDays(week, days, preview)

  return (
    <section className={plain ? undefined : 'card p-5'}>
      {!plain && (
        <p className="hint flex items-center gap-1.5 font-medium">
          <Repeat className="size-4" aria-hidden />
          Tages-Challenge
        </p>
      )}
      <CardEmoji item={item} />
      <h2
        className={
          plain
            ? 'text-xl leading-snug font-semibold text-balance'
            : 'mt-2 text-lg font-semibold text-balance'
        }
      >
        {item.title}
      </h2>
      <ImpulseItemImage item={item} />
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      {item.source?.label && (
        <div className="mt-3">
          <SourceLink item={item} />
        </div>
      )}

      {/* Sieben Haken, Montag bis Sonntag. Künftige Tage warten – abgehakt
          wird, was war, nicht was sein soll. Ein leerer Tag mahnt nicht. */}
      <div className="mt-4 flex gap-1.5">
        {allDays.map((day, index) => {
          const isChecked = checked.has(day)
          const isToday = day === today
          const future = isFuture(day)
          return (
            <button
              key={day}
              type="button"
              onClick={() => void toggle(day)}
              disabled={future || busyDays.has(day)}
              aria-pressed={isChecked}
              aria-label={`${CHALLENGE_DAY_LABELS[index]} abhaken`}
              className={cn(
                'flex flex-1 flex-col items-center gap-1.5 rounded-lg border py-2 text-xs transition active:scale-95',
                isChecked
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : isToday
                    ? 'border-brand-400 dark:border-brand-600 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    : 'border-slate-200 dark:border-slate-700',
                future
                  ? 'opacity-40'
                  : !isChecked && 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
              )}
            >
              <span>{CHALLENGE_DAY_LABELS[index]}</span>
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-full border',
                  isChecked
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 dark:border-slate-600',
                )}
                aria-hidden
              >
                {/* Der Tageshaken springt herein – klein und schnell,
                    denn er kommt (hoffentlich) jeden Tag. */}
                {isChecked && (
                  <Check className={cn('size-3', celebrateDay === day && 'animate-scale-in')} />
                )}
              </span>
            </button>
          )
        })}
      </div>
      <p className="hint mt-2">
        {doneCount} von 7 Tagen
        {doneCount === 7 && ' – die volle Woche!'}
      </p>
    </section>
  )
}

/**
 * Die Gruppenleiste: wer diese Woche dabei war – Vornamen, keine
 * Rangliste, keine Hervorhebung der Fehlenden. Darunter, wer sein
 * Wochen-Wappen schon vollendet hat: genannt wird, wer es geschafft hat,
 * nie, wer noch unterwegs ist.
 *
 * Mit `onOpen` ist die ganze Leiste ein Knopf: Sie öffnet den Raum
 * «Diese Woche dabei» mit dem Wappen jeder Person (`ImpulseGroupRoom`) –
 * solange jemand dabei ist; davor gibt es nichts zu zeigen.
 */
export function GroupCard({
  participants,
  total,
  crestNames = [],
  onOpen,
}: {
  participants: { uid: string; firstName: string }[]
  /** Alle, die je im Bereich mitgemacht haben – der Nenner der Leiste. */
  total: number
  /** Wer das Wappen der Woche schon vollendet hat. */
  crestNames?: { uid: string; firstName: string }[]
  /** Den Raum mit den Wappen öffnen – vom Klickpunkt her. */
  onOpen?: (origin: ScreenOrigin) => void
}) {
  /* Im Knopf ist nur Fliesstext erlaubt – darum Spannen statt Absätze. */
  const body = (
    <>
      <span className="hint flex items-center gap-1.5 font-medium">
        <Users className="size-4" aria-hidden />
        Diese Woche dabei
        {participants.length > 0 && (
          <span className="ms-auto">
            {participants.length}
            {total > participants.length && ` von ${total}`}
          </span>
        )}
      </span>
      {participants.length === 0 ? (
        <span className="mt-2 block text-sm text-slate-600 dark:text-slate-300">
          Diese Woche war noch niemand dabei – mach den Anfang.
        </span>
      ) : (
        <span className="mt-2 block text-sm text-slate-600 dark:text-slate-300">
          {participants.map((person) => person.firstName).join(' · ')}
        </span>
      )}
      {crestNames.length > 0 && (
        <span className="mt-3 flex items-start gap-1.5 border-t border-slate-200 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <Shield className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
          <span>
            <span className="font-medium text-slate-900 dark:text-slate-100">Wappen vollendet:</span>{' '}
            {crestNames.map((person) => person.firstName).join(' · ')}
          </span>
        </span>
      )}
    </>
  )

  if (!onOpen || participants.length === 0) {
    return <section className="card p-5">{body}</section>
  }
  return (
    <button
      type="button"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onOpen({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      }}
      className="card group block w-full p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs"
    >
      {body}
      <span
        className={cn(
          'mt-3 flex items-center gap-0.5 text-xs font-medium',
          IMPULSE_SECTIONS.dabei.text,
        )}
      >
        Die Wappen ansehen
        <ChevronRight
          className="size-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  )
}
