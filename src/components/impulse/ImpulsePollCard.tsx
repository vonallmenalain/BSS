import { useState } from 'react'
import { Check, EyeOff, Lightbulb, Lock, RotateCcw } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { pollResults, type ImpulsePollResult } from '@/lib/impulse'
import { CardEmoji, ContributorLine, SourceLink } from '@/components/impulse/ImpulseCards'
import { ImpulseCardActions } from '@/components/impulse/ImpulseCardActions'
import { useImpulseAuth, useImpulseWrites } from '@/hooks/useImpulseRuntime'
import type { ImpulseAnswer, ImpulseItem, ImpulsePoll, ImpulseProgress } from '@/lib/types'

/**
 * Die Umfrage – und ihr Geschwister «Was würdest du tun?».
 *
 * **Das Ergebnis kommt erst nach der eigenen Stimme.** Vorher steht nur
 * da, wie viele schon abgestimmt haben; wer wissen will, wie das
 * Kollegium denkt, muss sich zuerst selbst festlegen. Danach wachsen die
 * Balken auf ihren Stand, die eigene Wahl ist angeschrieben – und es
 * bleibt bei Zahlen: Wer was gewählt hat, zeigt die Karte nie. So lässt
 * sich auch ehrlich antworten, wo es persönlich wird.
 *
 * Zwei Formen: die **Auswahl** (ein Tipp ist die Stimme, wie beim Quiz)
 * und die **Skala** (ein Regler zwischen zwei Enden, dann «Abstimmen»).
 * Eine Stimme pro Person; umentscheiden gibt es nicht – sie liegt in
 * `impulseAnswers`, und die Regeln lassen keine Änderung zu.
 *
 * Im Vorschau-Modus (`preview`) wird nichts gespeichert; die Stimme lebt
 * nur im Fenster, und ein Knopf setzt sie zurück. Im Rückblick
 * (`closed`) steht das Ergebnis offen da – abgestimmt wird nur in der
 * laufenden Woche, sonst zählte eine Stimme rückwirkend zur Beteiligung.
 */
export function ImpulsePollCard({
  item,
  answers,
  preview = false,
  plain = false,
  closed = false,
  progressDocs,
}: {
  item: ImpulseItem
  /** Alle Stimmen zu dieser Umfrage – die eigene eingeschlossen. */
  answers: ImpulseAnswer[]
  preview?: boolean
  plain?: boolean
  /** Die Woche ist vorbei: Ergebnis zeigen, nicht mehr abstimmen. */
  closed?: boolean
  progressDocs?: ImpulseProgress[]
}) {
  const { profile } = useImpulseAuth()
  const { answerImpulsePoll } = useImpulseWrites()
  const toast = useToast()
  const poll = item.poll
  const uid = profile?.id ?? ''
  const [busy, setBusy] = useState(false)
  /** Die eben abgegebene Stimme – das Ergebnis, bevor der Server antwortet. */
  const [local, setLocal] = useState<number | null>(null)
  const [justVoted, setJustVoted] = useState(false)
  const [value, setValue] = useState<number>(() =>
    poll ? Math.round((poll.min + poll.max) / 2) : 0,
  )

  if (!poll) return null

  const stored = preview ? null : (answers.find((answer) => answer.uid === uid) ?? null)
  const mine: number | null = typeof stored?.choiceIndex === 'number' ? stored.choiceIndex : local
  const others = preview ? [] : answers.filter((answer) => answer.uid !== uid)
  const result = pollResults(poll, [...others, ...(mine !== null ? [{ choiceIndex: mine }] : [])])

  const vote = async (choice: number) => {
    if (busy || mine !== null) return
    setJustVoted(true)
    setLocal(choice)
    if (preview || !profile) return
    setBusy(true)
    try {
      const outcome = await answerImpulsePoll(
        item,
        { uid: profile.id, displayName: profile.displayName },
        choice,
      )
      toast.saved('Stimme abgegeben.', outcome)
    } catch (error) {
      console.error(error)
      setLocal(null)
      setJustVoted(false)
      toast.error('Die Stimme konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const waiting = others.length

  return (
    <section className={plain ? undefined : 'card p-5'}>
      <CardEmoji item={item} />
      <h2 className="text-xl leading-snug font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      <ContributorLine item={item} />

      {mine === null && !closed ? (
        <>
          {poll.form === 'choice' ? (
            <div
              className={cn(
                'mt-4 gap-2',
                poll.options.length === 2 ? 'grid grid-cols-2' : 'flex flex-col',
              )}
              role="group"
              aria-label="Möglichkeiten"
            >
              {poll.options.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={busy}
                  onClick={() => void vote(index)}
                  className={cn(
                    'rounded-xl bg-slate-100 px-3.5 py-3 text-left text-sm font-medium transition hover:bg-slate-200/70 active:scale-[0.98] disabled:opacity-60 dark:bg-white/5 dark:hover:bg-white/10',
                    poll.options.length === 2 && 'py-5 text-center text-base',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <ScaleInput poll={poll} value={value} onChange={setValue} />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="hint mt-0 flex min-w-0 flex-1 items-center gap-1.5">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              {waiting === 0
                ? 'Noch keine Stimme – du bist die erste. Das Ergebnis siehst du danach.'
                : `${waiting} ${waiting === 1 ? 'Stimme' : 'Stimmen'} – das Ergebnis siehst du nach deiner.`}
            </p>
            {poll.form === 'scale' && (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void vote(value)}
              >
                <Check className="size-4" aria-hidden />
                Abstimmen
              </button>
            )}
            {/* Abgestimmt wird ohne Namen – auch in der Stimme selbst steht er
                nicht (`answerImpulsePoll`). Das darf jede und jeder wissen,
                bevor sie sich entscheiden. */}
            <p className="hint mt-0 flex w-full items-center gap-1.5">
              <EyeOff className="size-3.5 shrink-0" aria-hidden />
              Anonym – dein Name wird nicht geteilt.
            </p>
          </div>
        </>
      ) : (
        <div className={cn('mt-4 space-y-3', justVoted && 'animate-imp-rise')}>
          {poll.form === 'choice' ? (
            <ChoiceResult result={result} mine={mine} />
          ) : (
            <ScaleResult poll={poll} result={result} mine={mine} />
          )}
          <p className="hint">
            {result.total} {result.total === 1 ? 'Stimme' : 'Stimmen'} · anonym
            {closed && mine === null && ' · abgestimmt wurde in jener Woche'}
          </p>
          {poll.explanation && (
            <p className="flex gap-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <span>{poll.explanation}</span>
            </p>
          )}
          <SourceLink item={item} />
          {preview && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                setLocal(null)
                setJustVoted(false)
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              Vorschau zurücksetzen
            </button>
          )}
        </div>
      )}

      {progressDocs && (
        <ImpulseCardActions
          item={item}
          progressDocs={progressDocs}
          preview={preview}
          centered={false}
        />
      )}
    </section>
  )
}

/** Die Skala vor der Stimme: der gewählte Wert gross, darunter der Regler. */
function ScaleInput({
  poll,
  value,
  onChange,
}: {
  poll: ImpulsePoll
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="mt-4">
      <p className="text-center">
        <span className="tabular text-5xl font-bold">{value}</span>
        {poll.unit && (
          <span className="ms-1.5 text-lg text-slate-500 dark:text-slate-400">{poll.unit}</span>
        )}
      </p>
      <input
        type="range"
        min={poll.min}
        max={poll.max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-blue-600 dark:accent-blue-400"
        aria-label="Wert wählen"
        aria-valuetext={`${value}${poll.unit ? ` ${poll.unit}` : ''}`}
      />
      <div className="mt-1 flex justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{poll.minLabel || poll.min}</span>
        <span className="text-end">{poll.maxLabel || poll.max}</span>
      </div>
    </div>
  )
}

/** Das Ergebnis einer Auswahl: ein Balken je Möglichkeit, die eigene angeschrieben. */
function ChoiceResult({ result, mine }: { result: ImpulsePollResult; mine: number | null }) {
  const top = Math.max(...result.bars.map((bar) => bar.count))
  return (
    <div className="space-y-2">
      {result.bars.map((bar) => {
        const chosen = bar.value === mine
        return (
          <div
            key={bar.value}
            className={cn(
              'relative overflow-hidden rounded-xl bg-slate-100 px-3.5 py-3 text-sm dark:bg-white/5',
              chosen && 'ring-2 ring-blue-500/70 dark:ring-blue-400/70',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'imp-meter absolute inset-y-0 left-0 w-full',
                chosen ? 'bg-blue-500/30 dark:bg-blue-400/30' : 'bg-slate-400/20 dark:bg-white/10',
              )}
              style={{ '--imp-share': String(bar.share) } as React.CSSProperties}
            />
            <span className="relative flex items-center gap-3">
              <span
                className={cn('min-w-0 flex-1', bar.count === top && top > 0 && 'font-semibold')}
              >
                {bar.label}
                {chosen && (
                  <span className="ms-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                    <Check className="size-3" aria-hidden />
                    Deine Wahl
                  </span>
                )}
              </span>
              <span className="tabular shrink-0 font-semibold">
                {Math.round(bar.share * 100)} %
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Das Ergebnis einer Skala: Säulen je Wert, der eigene Wert hervorgehoben, dazu der Schnitt. */
function ScaleResult({
  poll,
  result,
  mine,
}: {
  poll: ImpulsePoll
  result: ImpulsePollResult
  mine: number | null
}) {
  const top = Math.max(...result.bars.map((bar) => bar.count), 1)
  const unit = poll.unit ? ` ${poll.unit}` : ''
  const many = result.bars.length > 11
  return (
    <div>
      <div className="flex h-28 items-end gap-1" aria-hidden>
        {result.bars.map((bar) => (
          <div key={bar.value} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className={cn(
                'imp-column w-full rounded-t-md',
                bar.value === mine
                  ? 'bg-blue-600 dark:bg-blue-400'
                  : 'bg-slate-300 dark:bg-slate-600',
              )}
              style={
                {
                  height: '100%',
                  '--imp-share': String(Math.max(bar.count / top, bar.count > 0 ? 0.06 : 0.02)),
                } as React.CSSProperties
              }
            />
          </div>
        ))}
      </div>
      <div
        className="mt-1 flex gap-1 text-center text-[10px] text-slate-500 dark:text-slate-400"
        aria-hidden
      >
        {result.bars.map((bar, index) => (
          <span key={bar.value} className="min-w-0 flex-1">
            {!many || index % 2 === 0 || bar.value === mine ? bar.value : ''}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{poll.minLabel}</span>
        <span className="text-end">{poll.maxLabel}</span>
      </div>
      <p className="mt-3 text-sm">
        {mine !== null && (
          <>
            Du:{' '}
            <span className="font-semibold">
              {mine}
              {unit}
            </span>
            {result.average !== null && ' · '}
          </>
        )}
        {result.average !== null && (
          <>
            Schnitt im Kollegium:{' '}
            <span className="font-semibold">
              {result.average.toLocaleString('de-CH')}
              {unit}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
