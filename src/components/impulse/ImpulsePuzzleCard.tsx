import { useState } from 'react'
import { Check, Lightbulb, RotateCcw, Sparkles, Undo2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { puzzlePieces, puzzleSolved, shuffledPuzzlePieces } from '@/lib/impulse'
import { CardEmoji, ContributorLine, SourceLink } from '@/components/impulse/ImpulseCards'
import { ImpulseCardActions } from '@/components/impulse/ImpulseCardActions'
import { answerImpulsePuzzle } from '@/services/impulse'
import type { ImpulseAnswer, ImpulseItem, ImpulseProgress } from '@/lib/types'

/**
 * Das Vers-Puzzle: Die Teile eines Verses liegen gemischt da – wer sie in
 * der richtigen Reihenfolge antippt, baut den Vers. Ein Tipp auf ein
 * gesetztes Teil nimmt es wieder zurück; «Prüfen» gibt ab, sobald alle
 * Teile liegen.
 *
 * Es bleibt bei **einem** Versuch, wie beim Quiz – gezählt wird die
 * Teilnahme. Danach steht der Vers richtig da, mit der eigenen Fassung
 * daneben, wenn sie nicht stimmte, und wie viele aus dem Kollegium ihn
 * auf Anhieb gebaut haben. Zwei gleiche Wörter («und», «und») sind
 * austauschbar: Es zählt der Satz, nicht welcher Knopf
 * (`puzzleSolved`).
 *
 * Die Mischung ist je Karte fest (`shuffledPuzzlePieces`) – wer
 * zwischendurch weiterwischt und zurückkommt, findet die Teile so vor,
 * wie sie lagen. Im Vorschau-Modus wird nichts gespeichert; im
 * Rückblick (`closed`) steht der Vers offen da.
 */
export function ImpulsePuzzleCard({
  item,
  answer,
  answers,
  preview = false,
  plain = false,
  closed = false,
  progressDocs,
}: {
  item: ImpulseItem
  /** Der eigene Versuch – `null`, solange keiner abgegeben ist. */
  answer: ImpulseAnswer | null
  /** Alle Versuche zu diesem Puzzle – für «so viele haben es geschafft». */
  answers: ImpulseAnswer[]
  preview?: boolean
  plain?: boolean
  /** Die Woche ist vorbei: den Vers zeigen, nicht mehr bauen. */
  closed?: boolean
  progressDocs?: ImpulseProgress[]
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const text = item.puzzle?.text ?? ''
  const [pieces] = useState(() => shuffledPuzzlePieces(text, item.id))
  /** Die gesetzten Teile, als Plätze in `pieces`. */
  const [placed, setPlaced] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState<{ attempt: string; correct: boolean } | null>(null)
  const [justSolved, setJustSolved] = useState(false)

  if (!item.puzzle || pieces.length === 0) return null

  const stored = preview ? null : answer
  const result =
    local ??
    (stored ? { attempt: stored.text ?? '', correct: stored.correct === true } : null) ??
    (closed ? { attempt: '', correct: false } : null)
  const solution = puzzlePieces(text)
  const allPlaced = placed.length === pieces.length

  const submit = async () => {
    if (!allPlaced || busy || result) return
    const attempt = placed.map((index) => pieces[index]).join(' ')
    const correct = puzzleSolved(text, attempt)
    setJustSolved(true)
    setLocal({ attempt, correct })
    if (preview || !profile) return
    setBusy(true)
    try {
      const outcome = await answerImpulsePuzzle(
        item,
        { uid: profile.id, displayName: profile.displayName },
        attempt,
        correct,
      )
      toast.saved(correct ? 'Vers gebaut – stark!' : 'Versuch festgehalten.', outcome)
    } catch (error) {
      console.error(error)
      setLocal(null)
      setJustSolved(false)
      toast.error('Der Versuch konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  /* Wie das Kollegium abgeschnitten hat – der eigene Versuch zählt mit,
     auch wenn er noch unterwegs zum Server ist. */
  const uid = profile?.id ?? ''
  const pool = preview ? [] : answers.filter((entry) => entry.uid !== uid)
  const attempts = pool.length + (result ? 1 : 0)
  const solved = pool.filter((entry) => entry.correct === true).length + (result?.correct ? 1 : 0)

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

      {result ? (
        <div className={cn('mt-4 space-y-3', justSolved && 'animate-imp-rise')}>
          <p
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              result.correct
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-900/[0.06] text-slate-600 dark:bg-white/10 dark:text-slate-300',
            )}
          >
            {result.correct ? (
              <Sparkles className="size-3.5" aria-hidden />
            ) : (
              <Check className="size-3.5" aria-hidden />
            )}
            {result.correct
              ? 'Perfekt gebaut!'
              : closed && !stored && !local
                ? 'So heisst der Vers:'
                : 'Fast – so heisst der Vers:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {solution.map((piece, index) => (
              <span
                key={index}
                className={cn(
                  'rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-sm font-medium text-emerald-900 dark:text-emerald-100',
                  justSolved && 'animate-imp-rise',
                )}
                style={justSolved ? { animationDelay: `${index * 40}ms` } : undefined}
              >
                {piece}
              </span>
            ))}
          </div>
          {!result.correct && result.attempt && (
            <p className="hint">Dein Versuch: {result.attempt}</p>
          )}
          {attempts > 0 && (
            <p className="hint">
              {solved} von {attempts} {attempts === 1 ? 'hat' : 'haben'} den Vers auf Anhieb gebaut.
            </p>
          )}
          {item.puzzle.explanation && (
            <p className="flex gap-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
              <span>{item.puzzle.explanation}</span>
            </p>
          )}
          <SourceLink item={item} />
          {preview && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                setLocal(null)
                setPlaced([])
                setJustSolved(false)
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              Vorschau zurücksetzen
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {/* Die Antwortzeile: die gesetzten Teile in ihrer Reihenfolge. */}
          <div
            className="flex min-h-14 flex-wrap content-start gap-1.5 rounded-xl border-2 border-dashed border-yellow-500/50 bg-yellow-400/[0.07] p-2"
            aria-label="Dein Vers"
          >
            {placed.length === 0 ? (
              <span className="hint m-auto px-2 text-center">
                Tippe die Teile in der richtigen Reihenfolge an.
              </span>
            ) : (
              placed.map((index, position) => (
                <button
                  key={`${index}-${position}`}
                  type="button"
                  onClick={() => setPlaced((value) => value.filter((_, at) => at !== position))}
                  className="animate-imp-rise rounded-lg bg-yellow-400 px-2.5 py-1.5 text-sm font-semibold text-yellow-950 transition active:scale-95"
                  title="Zurücknehmen"
                >
                  {pieces[index]}
                </button>
              ))
            )}
          </div>

          {/* Der Vorrat: was noch nicht liegt. */}
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Teile">
            {pieces.map((piece, index) =>
              placed.includes(index) ? (
                <span
                  key={index}
                  aria-hidden
                  className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-sm text-transparent select-none dark:border-slate-700"
                >
                  {piece}
                </span>
              ) : (
                <button
                  key={index}
                  type="button"
                  onClick={() => setPlaced((value) => [...value, index])}
                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-medium transition hover:bg-slate-200/70 active:scale-95 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  {piece}
                </button>
              ),
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={placed.length === 0 || busy}
              onClick={() => setPlaced([])}
            >
              <Undo2 className="size-4" aria-hidden />
              Zurücksetzen
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!allPlaced || busy}
              onClick={() => void submit()}
            >
              <Check className="size-4" aria-hidden />
              Prüfen
            </button>
          </div>
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
