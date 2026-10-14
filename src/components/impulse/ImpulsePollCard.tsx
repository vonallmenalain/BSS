import { useId, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lightbulb,
  Lock,
  PenLine,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { pollResults, type ImpulsePollResult } from '@/lib/impulse'
import {
  matchPollText,
  POLL_CUSTOM_MAX,
  POLL_CUSTOM_SHOWN,
  pollAllowsCustom,
  pollChoiceId,
  pollRowsShown,
  pollTextUsable,
  pollVoteChoice,
  resolvePollReply,
  tallyPollChoices,
  type ImpulsePollReply,
  type PollRow,
  type PollTally,
  type PollVote,
} from '@/lib/impulsePoll'
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
 * Bei der Auswahl darf jemand eine **eigene Antwort** hinzufügen, wenn
 * keine passt (sofern die Redaktion es nicht abgeschaltet hat): Sie ist
 * dann die eigene Stimme, erscheint ohne Namen als weitere Möglichkeit
 * – angeschrieben mit «von jemandem hinzugefügt» – und lässt sich von den
 * anderen ebenfalls wählen. Gleiche Texte zählen als eine Antwort; die
 * Rechnung dazu steht in `lib/impulsePoll`. Die Redaktion kann eine
 * hinzugefügte Antwort ausblenden – direkt hier, mit dem Auge daneben,
 * wie bei den Beiträgen zur Frage der Woche.
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
  const { profile, canEditImpulse } = useImpulseAuth()
  const { answerImpulsePoll, withdrawImpulsePoll, setImpulsePollAnswerHidden } = useImpulseWrites()
  const toast = useToast()
  const poll = item.poll
  const uid = profile?.id ?? ''
  const [busy, setBusy] = useState(false)
  /** Die eben abgegebene Stimme – das Ergebnis, bevor der Server antwortet. */
  const [local, setLocal] = useState<ImpulsePollReply | null>(null)
  const [justVoted, setJustVoted] = useState(false)
  const [value, setValue] = useState<number>(() =>
    poll ? Math.round((poll.min + poll.max) / 2) : 0,
  )

  if (!poll) return null

  /* Ausblenden kann die Redaktion – nicht in der Vorschau, dort schaut
     eine gespielte Person. */
  const moderate = canEditImpulse && !preview
  const hidden = item.hiddenPollAnswers ?? []
  const stored = preview ? null : (answers.find((answer) => answer.uid === uid) ?? null)
  const own: PollVote | null = stored ?? local
  const voted = own !== null
  const others = preview ? [] : answers.filter((answer) => answer.uid !== uid)
  const votes = own ? [...others, own] : others

  const isChoice = poll.form === 'choice'
  const ownChoice = own && isChoice ? pollVoteChoice(poll, own) : null
  const ownId = ownChoice ? pollChoiceId(ownChoice) : null
  /* Das Ergebnis: bei der Auswahl samt hinzugefügten Antworten, nach
     Stimmen geordnet. Vor der eigenen Stimme stehen die hinzugefügten in
     der Reihenfolge, in der sie kamen – ohne Zahlen. */
  const tally = isChoice
    ? tallyPollChoices(poll, votes, { hidden, reveal: ownId, showHidden: moderate })
    : null
  const before = isChoice
    ? tallyPollChoices(poll, others, { hidden, showHidden: moderate, order: 'added' })
    : null
  const allowCustom = pollAllowsCustom(poll)
  const offered = allowCustom && before ? before.custom : []
  const result = isChoice ? null : pollResults(poll, votes)
  const total = tally?.total ?? result?.total ?? 0
  const mineValue = typeof own?.choiceIndex === 'number' ? own.choiceIndex : null

  const vote = async (reply: ImpulsePollReply, added = false) => {
    if (busy || voted) return
    setJustVoted(true)
    setLocal(reply)
    if (preview || !profile) return
    setBusy(true)
    try {
      const outcome = await answerImpulsePoll(
        item,
        { uid: profile.id, displayName: profile.displayName },
        reply,
      )
      toast.saved(
        added ? 'Antwort hinzugefügt – sie ist deine Stimme.' : 'Stimme abgegeben.',
        outcome,
      )
    } catch (error) {
      console.error(error)
      setLocal(null)
      setJustVoted(false)
      toast.error('Die Stimme konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  /*
   * Die eigene Stimme zurücknehmen – ein zweites Antippen der eigenen Wahl.
   *
   * Eine Umfrage ist kein Versuch wie das Quiz, sondern eine Meinung, und
   * die darf man sich anders überlegen: etwa, weil inzwischen jemand eine
   * Antwort hinzugefügt hat, die besser passt. Danach steht die Auswahl
   * wieder da, samt allen hinzugefügten Antworten. Im Rückblick nicht –
   * dort wird gar nicht mehr abgestimmt.
   */
  const withdraw = async () => {
    if (busy || !voted || closed) return
    if (preview || !profile) {
      setLocal(null)
      setJustVoted(false)
      return
    }
    setBusy(true)
    try {
      const outcome = await withdrawImpulsePoll(item, { uid: profile.id })
      setLocal(null)
      setJustVoted(false)
      toast.saved('Stimme zurückgenommen – du kannst neu wählen.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Die Stimme konnte nicht zurückgenommen werden.')
    } finally {
      setBusy(false)
    }
  }
  const onWithdraw = voted && !closed && !busy ? () => void withdraw() : undefined

  const toggleHidden = (row: PollRow) => {
    setImpulsePollAnswerHidden(item, row.label, !row.hidden)
      .then((outcome) =>
        toast.saved(
          row.hidden ? 'Die Antwort ist wieder zu sehen.' : 'Die Antwort ist ausgeblendet.',
          outcome,
        ),
      )
      .catch((error) => {
        console.error(error)
        toast.error('Die Antwort konnte nicht geändert werden.')
      })
  }
  const onToggleHidden = moderate ? toggleHidden : undefined

  const waiting = before ? before.total : others.length

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

      {!voted && !closed ? (
        <>
          {poll.form === 'choice' ? (
            <>
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
                    onClick={() => void vote({ choiceIndex: index })}
                    className={cn(
                      'rounded-xl bg-slate-100 px-3.5 py-3 text-left text-sm font-medium transition hover:bg-slate-200/70 active:scale-[0.98] disabled:opacity-60 dark:bg-white/5 dark:hover:bg-white/10',
                      poll.options.length === 2 && 'py-5 text-center text-base',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {offered.length > 0 && (
                <CustomChoices
                  rows={offered}
                  busy={busy}
                  onVote={(row) => void vote({ text: row.label })}
                  onToggleHidden={onToggleHidden}
                />
              )}
              {allowCustom && (
                <OwnAnswer
                  poll={poll}
                  offered={offered}
                  busy={busy}
                  onSubmit={(reply, added) => void vote(reply, added)}
                />
              )}
            </>
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
                onClick={() => void vote({ choiceIndex: value })}
              >
                <Check className="size-4" aria-hidden />
                Abstimmen
              </button>
            )}
            {/* Abgestimmt wird ohne Namen – auch in der Stimme selbst steht er
                nicht (`answerImpulsePoll`), und eine eigene Antwort trägt
                ihn ebenso wenig. Das darf jede und jeder wissen, bevor sie
                sich entscheiden. */}
            <p className="hint mt-0 flex w-full items-center gap-1.5">
              <EyeOff className="size-3.5 shrink-0" aria-hidden />
              Anonym – dein Name wird nicht geteilt.
            </p>
          </div>
        </>
      ) : (
        <div className={cn('mt-4 space-y-3', justVoted && 'animate-imp-rise')}>
          {tally ? (
            <ChoiceResult
              tally={tally}
              ownId={ownId}
              onToggleHidden={onToggleHidden}
              onWithdraw={onWithdraw}
            />
          ) : (
            result && <ScaleResult poll={poll} result={result} mine={mineValue} />
          )}
          {voted && !closed && (
            <p className="hint mt-0 flex flex-wrap items-center gap-x-2 gap-y-1">
              <RotateCcw className="size-3.5 shrink-0" aria-hidden />
              {tally ? (
                'Nochmals auf deine Wahl tippen nimmt die Stimme zurück.'
              ) : (
                <>
                  Anders überlegt?
                  <button
                    type="button"
                    className="font-medium text-blue-700 underline-offset-2 hover:underline disabled:opacity-60 dark:text-blue-300"
                    disabled={busy}
                    onClick={() => void withdraw()}
                  >
                    Stimme zurücknehmen
                  </button>
                </>
              )}
            </p>
          )}
          <p className="hint">
            {total} {total === 1 ? 'Stimme' : 'Stimmen'} · anonym
            {closed && !voted && ' · abgestimmt wurde in jener Woche'}
            {moderate &&
              tally &&
              tally.hiddenVotes > 0 &&
              ` · ${tally.hiddenVotes} für Ausgeblendetes, nicht gezählt`}
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

/**
 * Die Kennzeichnung einer hinzugefügten Antwort – dass sie nicht von der
 * Redaktion stammt, aber nicht, von wem. Ist sie ausgeblendet, sagt das
 * nur der Redaktion etwas: Wer sie selbst gewählt hat, sieht sie still
 * weiter (siehe `tallyPollChoices`).
 */
function AddedNote({ row, moderate }: { row: PollRow; moderate: boolean }) {
  return (
    <span className="mt-0.5 block text-[11px] font-normal text-slate-500 no-underline dark:text-slate-400">
      <PenLine className="me-1 inline-block size-3 align-[-0.125em]" aria-hidden />
      von jemandem hinzugefügt
      {moderate && row.hidden && (
        <span className="block text-amber-700 dark:text-amber-300">
          Ausgeblendet – die anderen sehen sie nicht mehr.
        </span>
      )}
    </span>
  )
}

/** Das Auge der Redaktion: eine hinzugefügte Antwort aus- oder wieder einblenden. */
function HideToggle({ row, onToggle }: { row: PollRow; onToggle: (row: PollRow) => void }) {
  return (
    <button
      type="button"
      className="btn-ghost shrink-0 px-2"
      onClick={() => onToggle(row)}
      aria-label={row.hidden ? `«${row.label}» wieder zeigen` : `«${row.label}» ausblenden`}
      title={
        row.hidden
          ? 'Wieder zeigen'
          : 'Ausblenden – die anderen sehen die Antwort und ihre Stimmen dann nicht mehr'
      }
    >
      {row.hidden ? (
        <Eye className="size-4" aria-hidden />
      ) : (
        <EyeOff className="size-4" aria-hidden />
      )}
    </button>
  )
}

/** «3 weitere Antworten zeigen» – und wieder zurück. */
function MoreToggle({
  more,
  expanded,
  onToggle,
}: {
  more: number
  expanded: boolean
  onToggle: () => void
}) {
  if (!expanded && more === 0) return null
  return (
    <button
      type="button"
      className="btn-ghost btn-sm self-start"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? (
        <ChevronUp className="size-4" aria-hidden />
      ) : (
        <ChevronDown className="size-4" aria-hidden />
      )}
      {expanded
        ? 'Weniger zeigen'
        : `${more} weitere ${more === 1 ? 'Antwort' : 'Antworten'} zeigen`}
    </button>
  )
}

/**
 * Die hinzugefügten Antworten vor der eigenen Stimme – wählbar wie die
 * vorgegebenen, in der Reihenfolge, in der sie kamen; sind es mehr als
 * vier, stehen drei da und der Rest hinter «weitere». Ausgeblendete
 * erscheinen nur der Redaktion, gestrichen und nicht wählbar.
 */
function CustomChoices({
  rows,
  busy,
  onVote,
  onToggleHidden,
}: {
  rows: PollRow[]
  busy: boolean
  onVote: (row: PollRow) => void
  onToggleHidden?: (row: PollRow) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { shown, more } = expanded
    ? { shown: rows, more: 0 }
    : pollRowsShown(rows, POLL_CUSTOM_SHOWN)
  return (
    <div className="mt-2 flex flex-col gap-2" role="group" aria-label="Hinzugefügte Antworten">
      {shown.map((row) => (
        <div key={row.id} className="flex items-stretch gap-1">
          <button
            type="button"
            disabled={busy || row.hidden}
            onClick={() => onVote(row)}
            className={cn(
              'min-w-0 flex-1 rounded-xl bg-slate-100 px-3.5 py-2.5 text-left text-sm font-medium transition hover:bg-slate-200/70 active:scale-[0.98] disabled:opacity-60 dark:bg-white/5 dark:hover:bg-white/10',
              row.hidden && 'border border-dashed border-slate-300 dark:border-slate-600',
            )}
          >
            <span className={cn('block break-words', row.hidden && 'line-through')}>
              {row.label}
            </span>
            <AddedNote row={row} moderate={Boolean(onToggleHidden)} />
          </button>
          {onToggleHidden && <HideToggle row={row} onToggle={onToggleHidden} />}
        </div>
      ))}
      {rows.length > POLL_CUSTOM_SHOWN + 1 && (
        <MoreToggle more={more} expanded={expanded} onToggle={() => setExpanded((on) => !on)} />
      )}
    </div>
  )
}

/**
 * «Eigene Antwort hinzufügen» – zuerst nur ein gestrichelter Knopf, ein
 * Tipp öffnet das Feld. Gibt es den Text schon (vorgegeben oder schon
 * hinzugefügt), sagt das der Hinweis darunter, und der Knopf stimmt
 * dafür, statt eine Doppelung anzulegen.
 */
function OwnAnswer({
  poll,
  offered,
  busy,
  onSubmit,
}: {
  poll: ImpulsePoll
  offered: PollRow[]
  busy: boolean
  onSubmit: (reply: ImpulsePollReply, added: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputId = useId()

  const usable = pollTextUsable(draft)
  const match = usable ? matchPollText(poll, draft, offered) : null
  /* Eine ausgeblendete Antwort sieht hier nur die Redaktion – für alle
     anderen ist sie kein Treffer, der Text kommt einfach dazu. */
  const existing =
    match?.kind === 'option' ? match.label : match && !match.row.hidden ? match.row.label : null

  const close = () => {
    setOpen(false)
    setDraft('')
  }
  const submit = () => {
    const reply = resolvePollReply(poll, draft, offered)
    if (!reply || busy) return
    onSubmit(reply, existing === null)
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 active:scale-[0.98] disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
      >
        <Plus className="size-4 shrink-0" aria-hidden />
        Eigene Antwort hinzufügen
      </button>
    )
  }

  return (
    <form
      className="mt-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label className="label" htmlFor={inputId}>
        Deine eigene Antwort
      </label>
      <input
        id={inputId}
        className="input"
        value={draft}
        maxLength={POLL_CUSTOM_MAX}
        autoComplete="off"
        enterKeyHint="send"
        // Der Knopf davor hat das Feld eben erst geöffnet – also gleich hinein.
        autoFocus
        placeholder="Was fehlt dir hier?"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Escape schliesst nur das Feld, nicht gleich den ganzen Feed.
          if (event.key === 'Escape') {
            event.stopPropagation()
            close()
          }
        }}
      />
      <p className="hint mt-1.5">
        {existing
          ? `Gibt es schon: «${existing}» – deine Stimme zählt dort.`
          : 'Ohne deinen Namen – die anderen können sie danach auch wählen. Sie ist deine Stimme und lässt sich nicht mehr ändern.'}
        {draft.length > POLL_CUSTOM_MAX - 20 && (
          <span className="tabular"> {`${draft.length}/${POLL_CUSTOM_MAX}`}</span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" disabled={busy} onClick={close}>
          Abbrechen
        </button>
        <button type="submit" className="btn-primary" disabled={busy || !usable}>
          <Check className="size-4" aria-hidden />
          {existing ? 'Dafür stimmen' : 'Hinzufügen'}
        </button>
      </div>
    </form>
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

/**
 * Das Ergebnis einer Auswahl: ein Balken je Möglichkeit, die eigene
 * angeschrieben. Darunter die hinzugefügten Antworten, nach Stimmen
 * geordnet und eingeklappt wie vor der Stimme – die eigene Wahl bleibt
 * dabei immer sichtbar.
 */
function ChoiceResult({
  tally,
  ownId,
  onToggleHidden,
  onWithdraw,
}: {
  tally: PollTally
  ownId: string | null
  onToggleHidden?: (row: PollRow) => void
  /** Die eigene Wahl ist antippbar und nimmt die Stimme zurück – fehlt im Rückblick. */
  onWithdraw?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const top = Math.max(
    0,
    ...[...tally.options, ...tally.custom].filter((row) => row.counted).map((row) => row.count),
  )
  const { shown, more } = expanded
    ? { shown: tally.custom, more: 0 }
    : pollRowsShown(tally.custom, POLL_CUSTOM_SHOWN, ownId)
  return (
    <div className="flex flex-col gap-2">
      {[...tally.options, ...shown].map((row) => {
        const chosen = row.id === ownId
        const meter = (
          <ResultBar row={row} chosen={chosen} top={top} moderate={Boolean(onToggleHidden)} />
        )
        const bar =
          chosen && onWithdraw ? (
            <button
              type="button"
              onClick={onWithdraw}
              title="Nochmals antippen nimmt deine Stimme zurück"
              aria-label={`Deine Wahl «${row.label}» zurücknehmen`}
              className="flex min-w-0 flex-1 rounded-xl text-left transition hover:opacity-90 active:scale-[0.98]"
            >
              {meter}
            </button>
          ) : (
            meter
          )
        return row.custom && onToggleHidden ? (
          <div key={row.id} className="flex items-stretch gap-1">
            {bar}
            <HideToggle row={row} onToggle={onToggleHidden} />
          </div>
        ) : (
          <div key={row.id} className="flex">
            {bar}
          </div>
        )
      })}
      {tally.custom.length > POLL_CUSTOM_SHOWN + 1 && (
        <MoreToggle more={more} expanded={expanded} onToggle={() => setExpanded((on) => !on)} />
      )}
    </div>
  )
}

/**
 * Ein Balken des Ergebnisses. Eine ausgeblendete Antwort, die nicht
 * mitzählt, sieht nur die Redaktion – gestrichelt, mit der Zahl ihrer
 * Stimmen statt eines Anteils.
 */
function ResultBar({
  row,
  chosen,
  top,
  moderate,
}: {
  row: PollRow
  chosen: boolean
  top: number
  moderate: boolean
}) {
  return (
    <div
      className={cn(
        'relative min-w-0 flex-1 overflow-hidden rounded-xl bg-slate-100 px-3.5 py-3 text-sm dark:bg-white/5',
        chosen && 'ring-2 ring-blue-500/70 dark:ring-blue-400/70',
        !row.counted &&
          'border border-dashed border-slate-300 bg-transparent dark:border-slate-600 dark:bg-transparent',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'imp-meter absolute inset-y-0 left-0 w-full',
          chosen ? 'bg-blue-500/30 dark:bg-blue-400/30' : 'bg-slate-400/20 dark:bg-white/10',
        )}
        style={{ '--imp-share': String(row.share) } as React.CSSProperties}
      />
      <span className="relative flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'break-words',
              row.counted && row.count === top && top > 0 && 'font-semibold',
              !row.counted && 'line-through',
            )}
          >
            {row.label}
          </span>
          {chosen && (
            <span className="ms-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
              <Check className="size-3" aria-hidden />
              Deine Wahl
            </span>
          )}
          {row.custom && <AddedNote row={row} moderate={moderate} />}
        </span>
        <span className="tabular shrink-0 font-semibold">
          {row.counted
            ? `${Math.round(row.share * 100)} %`
            : `${row.count} ${row.count === 1 ? 'Stimme' : 'Stimmen'}`}
        </span>
      </span>
    </div>
  )
}

/** Das Ergebnis einer Skala: Säulen je Wert, der eigene hervorgehoben, dazu der Durchschnitt. */
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
            Durchschnitt:{' '}
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
