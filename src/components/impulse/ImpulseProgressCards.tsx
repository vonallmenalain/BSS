import { useState } from 'react'
import { format } from 'date-fns'
import { Award, Check, CheckCircle2, Repeat, Sparkles, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import { weekDays, type ImpulseBadge } from '@/lib/impulse'
import { SourceLink } from '@/components/impulse/ImpulseCards'
import { setImpulseChallengeDay, setImpulseWeekGoal } from '@/services/impulse'
import type { ImpulseItem } from '@/lib/types'

/*
 * Die Challenge-Karten des Bereichs «Impuls»: das Wochenziel mit seinem
 * einen Haken, die Tages-Challenge mit ihren sieben, dazu Serie und
 * Gruppenleiste. Abgehakt wird per Selbstauskunft – die Karten fragen
 * nicht nach, sie glauben es.
 *
 * Wie die Quizkarte kennen beide Aufgaben-Karten einen Vorschau-Modus:
 * Dort lebt der Haken nur im Fenster, gespeichert wird nichts.
 */

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Das Wochenziel: eine Aufgabe für die Woche, ein Haken. */
export function GoalCard({
  item,
  week,
  done,
  preview = false,
}: {
  item: ImpulseItem
  week: string
  done: boolean
  preview?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [previewDone, setPreviewDone] = useState(false)

  const isDone = preview ? previewDone : done

  const toggle = async () => {
    if (preview) {
      setPreviewDone((value) => !value)
      return
    }
    if (!profile || busy) return
    setBusy(true)
    try {
      const outcome = await setImpulseWeekGoal(
        { uid: profile.id, displayName: profile.displayName },
        week,
        !done,
      )
      toast.saved(!done ? 'Wochenziel geschafft – stark!' : 'Haken zurückgenommen.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <CheckCircle2 className="size-4" aria-hidden />
        Wochenziel
      </p>
      <h2 className="mt-2 text-lg font-semibold text-balance">{item.title}</h2>
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

      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={isDone}
        className={cn(
          'mt-4 flex w-full items-center gap-2.5 rounded-lg border p-3 text-left text-sm font-medium transition',
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
          {isDone && <Check className="size-3.5" />}
        </span>
        {isDone ? 'Geschafft!' : 'Geschafft? Hier abhaken.'}
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
}: {
  item: ImpulseItem
  week: string
  /** Die abgehakten Tage («2026-08-11») aus dem eigenen Fortschritt. */
  days: string[]
  preview?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const now = useNow()
  const [busyDay, setBusyDay] = useState<string | null>(null)
  const [previewDays, setPreviewDays] = useState<Set<string>>(new Set())

  const allDays = weekDays(week)
  const today = format(now, 'yyyy-MM-dd')
  const checked = preview ? previewDays : new Set(days)
  const doneCount = allDays.filter((day) => checked.has(day)).length

  const toggle = async (day: string) => {
    if (preview) {
      setPreviewDays((value) => {
        const next = new Set(value)
        if (next.has(day)) next.delete(day)
        else next.add(day)
        return next
      })
      return
    }
    if (!profile || busyDay) return
    setBusyDay(day)
    try {
      const outcome = await setImpulseChallengeDay(
        { uid: profile.id, displayName: profile.displayName },
        week,
        day,
        !checked.has(day),
      )
      toast.saved(!checked.has(day) ? 'Tag abgehakt.' : 'Haken zurückgenommen.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    } finally {
      setBusyDay(null)
    }
  }

  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <Repeat className="size-4" aria-hidden />
        Tages-Challenge
      </p>
      <h2 className="mt-2 text-lg font-semibold text-balance">{item.title}</h2>
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
          const isFuture = !preview && day > today
          return (
            <button
              key={day}
              type="button"
              onClick={() => void toggle(day)}
              disabled={isFuture || busyDay === day}
              aria-pressed={isChecked}
              aria-label={`${DAY_LABELS[index]} abhaken`}
              className={cn(
                'flex flex-1 flex-col items-center gap-1.5 rounded-lg border py-2 text-xs transition',
                isChecked
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : isToday
                    ? 'border-brand-400 dark:border-brand-600 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    : 'border-slate-200 dark:border-slate-700',
                isFuture
                  ? 'opacity-40'
                  : !isChecked && 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
              )}
            >
              <span>{DAY_LABELS[index]}</span>
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-full border',
                  isChecked
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 dark:border-slate-600',
                )}
                aria-hidden
              >
                {isChecked && <Check className="size-3" />}
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

/** Die eigene Serie samt Abzeichen – Meilensteine statt Punkte. */
export function StreakCard({
  current,
  best,
  badges,
}: {
  current: number
  best: number
  badges: ImpulseBadge[]
}) {
  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <Sparkles className="size-4" aria-hidden />
        Meine Serie
      </p>
      {current > 0 ? (
        <p className="mt-2 text-lg font-semibold">
          {current} {current === 1 ? 'Woche' : 'Wochen'} in Folge
          {best > current && (
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              beste: {best}
            </span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Noch keine Serie – sie beginnt, sobald du diese Woche etwas abhakst oder die Quizfrage
          beantwortest. Eine Jokerwoche pro Monat ist eingebaut.
        </p>
      )}
      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.id}
              className="badge bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              title={badge.hint}
            >
              <Award className="size-3.5" aria-hidden />
              {badge.label}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Die Gruppenleiste: wer diese Woche dabei war – Vornamen, keine
 * Rangliste, keine Hervorhebung der Fehlenden.
 */
export function GroupCard({
  participants,
  total,
}: {
  participants: { uid: string; firstName: string }[]
  /** Alle, die je im Bereich mitgemacht haben – der Nenner der Leiste. */
  total: number
}) {
  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <Users className="size-4" aria-hidden />
        Diese Woche dabei
        {participants.length > 0 && (
          <span className="ms-auto">
            {participants.length}
            {total > participants.length && ` von ${total}`}
          </span>
        )}
      </p>
      {participants.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Diese Woche war noch niemand dabei – mach den Anfang.
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {participants.map((person) => person.firstName).join(' · ')}
        </p>
      )}
    </section>
  )
}
