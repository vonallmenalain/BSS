import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IMPULSE_SECTIONS } from '@/lib/impulseSections'
import { CHALLENGE_DAY_LABELS, useChallengeDays, useWeekGoal } from '@/hooks/useImpulseTasks'
import type { ScreenOrigin } from '@/components/impulse/ImpulseScreen'
import type { ImpulseItem } from '@/lib/types'

/*
 * Die beiden Aufgaben der Woche in der Mission – das Wochenziel und die
 * Tages-Challenge, gleich auf der Übersicht abhakbar.
 *
 * Sie gehören zur Mission wie das Wappen: Jede bringt einen der Sterne
 * darüber. Darum stehen sie in derselben Kachel, unter dem grossen Knopf –
 * der bleibt das Erste, was ins Auge fällt. Jede Aufgabe hat zwei Teile:
 * Oben steht sie selbst, ein Tipp öffnet ihren Vollbild-Raum mit dem
 * ganzen Text und der Quelle. Darunter wird abgehakt – das Ziel mit einem
 * Haken, die Challenge Tag für Tag –, mit derselben Logik wie im Raum
 * (`hooks/useImpulseTasks`).
 *
 * Die Mission öffnet bei einem Tipp irgendwo auf die Kachel den Feed –
 * nicht aber hier: `data-mission-tasks` sagt ihr, dass dieser Teil seine
 * eigenen Ziele hat.
 */

type TaskKey = 'ziel' | 'challenge'

/** Der Klickpunkt – von dort wächst der Vollbild-Raum. */
function originOf(element: HTMLElement): ScreenOrigin {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

export function ImpulseMissionTasks({
  week,
  goal,
  goalDone,
  challenge,
  challengeDays,
  onOpen,
  className,
}: {
  week: string
  goal: ImpulseItem | null
  goalDone: boolean
  challenge: ImpulseItem | null
  /** Die abgehakten Tage («2026-10-06») aus dem eigenen Fortschritt. */
  challengeDays: string[]
  onOpen: (key: TaskKey, origin: ScreenOrigin) => void
  className?: string
}) {
  if (!goal && !challenge) return null
  return (
    <div
      data-mission-tasks
      className={cn(
        'divide-y divide-slate-900/[0.07] overflow-hidden rounded-2xl bg-white/70 text-left ring-1 ring-slate-900/[0.07] dark:divide-white/[0.08] dark:bg-white/[0.04] dark:ring-white/10',
        className,
      )}
    >
      {goal && <GoalRow item={goal} week={week} done={goalDone} onOpen={onOpen} />}
      {challenge && (
        <ChallengeRow item={challenge} week={week} days={challengeDays} onOpen={onOpen} />
      )}
    </div>
  )
}

/** Kopf einer Aufgabe: Zeichen, Art und Titel – der Weg in den Raum. */
function TaskHead({
  task,
  item,
  badge,
  onOpen,
}: {
  task: TaskKey
  item: ImpulseItem
  badge?: string
  onOpen: (key: TaskKey, origin: ScreenOrigin) => void
}) {
  const theme = IMPULSE_SECTIONS[task]
  return (
    <button
      type="button"
      onClick={(event) => onOpen(task, originOf(event.currentTarget))}
      className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-slate-900/[0.04] active:scale-[0.99] dark:hover:bg-white/[0.06]"
    >
      <span
        className={cn('grid size-9 shrink-0 place-items-center rounded-xl', theme.iconBox)}
        aria-hidden
      >
        <theme.icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase',
            theme.text,
          )}
        >
          {theme.label}
          {badge && (
            <span className="tabular rounded-full bg-current/10 px-1.5 tracking-normal normal-case">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-3 text-sm leading-snug text-slate-800 dark:text-slate-100">
          {item.title}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}

/**
 * Das Wochenziel: ein Haken für die Woche – dieselbe Zeile wie im Raum,
 * nur schmaler. Abgehakt springt der Haken herein.
 */
function GoalRow({
  item,
  week,
  done,
  onOpen,
}: {
  item: ImpulseItem
  week: string
  done: boolean
  onOpen: (key: TaskKey, origin: ScreenOrigin) => void
}) {
  const { isDone, busy, celebrate, toggle } = useWeekGoal(week, done)
  return (
    <div className="py-2 ps-2 pe-3">
      <div className="flex">
        <TaskHead task="ziel" item={item} onOpen={onOpen} />
      </div>
      <div className="mt-1 mb-1 ps-1.5">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          aria-pressed={isDone}
          className={cn(
            'flex h-9 w-full items-center gap-2.5 rounded-lg border px-2.5 text-left text-sm font-medium transition active:scale-[0.98]',
            isDone
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'border-slate-200 text-slate-600 hover:bg-slate-900/[0.04] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/[0.06]',
          )}
        >
          <span
            className={cn(
              'grid size-5 shrink-0 place-items-center rounded-full border',
              isDone
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 dark:border-slate-600',
            )}
            aria-hidden
          >
            {isDone && (
              <Check className={cn('size-3.5', celebrate && 'animate-scale-in')} strokeWidth={3} />
            )}
          </span>
          {isDone ? (
            <span className={celebrate ? 'animate-fade-in' : undefined}>Geschafft!</span>
          ) : (
            'Geschafft? Hier abhaken.'
          )}
        </button>
      </div>
    </div>
  )
}

/** Die Tages-Challenge: sieben Tage, Montag bis Sonntag – heute umrandet. */
function ChallengeRow({
  item,
  week,
  days,
  onOpen,
}: {
  item: ImpulseItem
  week: string
  days: string[]
  onOpen: (key: TaskKey, origin: ScreenOrigin) => void
}) {
  const { allDays, today, checked, doneCount, busyDays, celebrateDay, isFuture, toggle } =
    useChallengeDays(week, days)
  return (
    <div className="py-2 ps-2 pe-3">
      <div className="flex">
        <TaskHead task="challenge" item={item} badge={`${doneCount}/7`} onOpen={onOpen} />
      </div>
      <div
        className="mt-1 mb-1 flex gap-1.5 ps-1.5"
        role="group"
        aria-label="Tage der Tages-Challenge"
      >
        {allDays.map((day, index) => {
          const isChecked = checked.has(day)
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
                'flex h-9 min-w-0 flex-1 items-center justify-center gap-0.5 rounded-lg border text-xs font-medium transition active:scale-95',
                isChecked
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : day === today
                    ? 'border-sky-400 text-slate-700 dark:border-sky-500 dark:text-slate-200'
                    : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400',
                future
                  ? 'opacity-40'
                  : !isChecked && 'hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]',
              )}
            >
              {isChecked && (
                <Check
                  className={cn('size-3 shrink-0', celebrateDay === day && 'animate-scale-in')}
                  strokeWidth={3}
                  aria-hidden
                />
              )}
              {CHALLENGE_DAY_LABELS[index]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
