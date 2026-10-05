import { useEffect, useId, useRef, useState } from 'react'
import { Gamepad2, PencilLine, Play, Sparkles, Trophy } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { impulseFirstName } from '@/lib/impulse'
import {
  cleanGameName,
  GAME_NAME_MAX,
  gameRanking,
  gameUnit,
  type GameRankRow,
} from '@/lib/impulseGame'
import { CardEmoji } from '@/components/impulse/ImpulseCards'
import { ImpulseGameLeaderboard } from '@/components/impulse/game/ImpulseGameLeaderboard'
import { ImpulseGameStage, type GameRoundInfo } from '@/components/impulse/game/ImpulseGameStage'
import { useImpulseAuth, useImpulseWrites } from '@/hooks/useImpulseRuntime'
import type { ImpulseGameId, ImpulseGameScore, ImpulseItem } from '@/lib/types'

/**
 * Das Minispiel der Woche – die letzte Karte des Feeds.
 *
 * Auf der Karte stehen das Spiel, der Knopf «Spielen», der eigene Rekord
 * und die Rangliste. Gespielt wird im Vollbild darüber
 * (`ImpulseGameStage`); das X bricht ab, und die Karte steht wieder da –
 * mitten im Feed, der Wisch nach oben und unten geht weiter.
 *
 * **Eine Zeile je Person.** Gespeichert wird nur der beste Lauf, und wie
 * oft jemand gespielt hat, steht nirgends. Nach der ersten Runde fragt
 * die Karte nach einem Namen für die Liste (vorgeschlagen ist der
 * Vorname, ein Spitzname geht genauso); danach gilt er für jede weitere
 * Runde – auch in den Spielen der nächsten Wochen.
 *
 * Im Rückblick (`closed`) steht der Endstand, gespielt wird nicht mehr.
 * In der Vorschau der Redaktion (`preview`) wird nichts gespeichert: Der
 * Rekord lebt nur, solange die Vorschau offen ist.
 */
export function ImpulseGameCard({
  item,
  scores,
  gameName,
  ownScoreIds,
  preview = false,
  closed = false,
  plain = false,
}: {
  item: ImpulseItem
  /** Alle Einträge dieser Rangliste – der eigene eingeschlossen. */
  scores: ImpulseGameScore[]
  /** Der eigene Name in den Ranglisten – leer, solange keiner eingetragen ist. */
  gameName: string
  /** Die eigenen Einträge über alle Spiele hinweg – ein neuer Name gilt überall. */
  ownScoreIds: string[]
  preview?: boolean
  closed?: boolean
  plain?: boolean
}) {
  const { profile, canEditImpulse } = useImpulseAuth()
  const writes = useImpulseWrites()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  /* In der Redaktions-Vorschau: der Rekord, solange sie offen ist. */
  const [localBest, setLocalBest] = useState<number | null>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const uid = profile?.id ?? ''
  const game: ImpulseGameId = item.game ?? 'sortieren'
  const user = profile ? { uid: profile.id, displayName: profile.displayName } : null

  const own = scores.find((score) => score.uid === uid) ?? null
  const ownBest = preview ? localBest : (own?.best ?? null)
  const listed: ImpulseGameScore[] =
    preview && localBest !== null
      ? [
          ...scores.filter((score) => score.uid !== uid),
          {
            id: `vorschau_${item.id}`,
            itemId: item.id,
            uid,
            week: item.week ?? '',
            game,
            name: gameName || 'Vorschau',
            best: localBest,
          },
        ]
      : preview
        ? scores.filter((score) => score.uid !== uid)
        : scores
  const moderate = canEditImpulse && !preview
  const rows = gameRanking(listed, { ownUid: uid, showHidden: moderate })
  const ownRow = rows.find((row) => row.own) ?? null
  const namedCount = rows.filter((row) => row.score.name.trim() !== '').length

  /** Eine Runde ist vorbei: Ein besserer Lauf wird gespeichert – nur der. */
  const roundEnd = (points: number): GameRoundInfo => {
    const previousBest = ownBest
    if (previousBest === null || points > previousBest) {
      if (preview) {
        setLocalBest(points)
      } else if (user) {
        writes.saveImpulseGameScore(item, user, points, gameName).catch((error) => {
          console.error(error)
          toast.error('Der Lauf konnte nicht gespeichert werden.')
        })
      }
    }
    return { previousBest }
  }

  const toggleHidden = (score: ImpulseGameScore) => {
    writes
      .setImpulseGameScoreHidden(score.id, !score.hidden)
      .then((outcome) =>
        toast.saved(
          score.hidden
            ? `${score.name} steht wieder in der Liste.`
            : `${score.name} ist ausgeblendet.`,
          outcome,
        ),
      )
      .catch((error) => {
        console.error(error)
        toast.error('Der Eintrag konnte nicht geändert werden.')
      })
  }

  const closeStage = () => {
    setOpen(false)
    // Zurück zur Karte – der Fokus auch.
    requestAnimationFrame(() => playRef.current?.focus({ preventScroll: true }))
  }

  return (
    <section className={plain ? undefined : 'card p-5'}>
      <CardEmoji item={item} />
      {!item.emoji?.trim() && (
        <span
          className="animate-imp-rise mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-sm"
          aria-hidden
        >
          <Gamepad2 className="size-6" />
        </span>
      )}
      <h2 className="text-xl leading-snug font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}

      {closed ? (
        <p className="hint mt-3">
          Das Spiel dieser Woche ist vorbei – so steht die Rangliste am Schluss.
        </p>
      ) : (
        <>
          <button
            ref={playRef}
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-3.5 text-base font-semibold text-white shadow-md shadow-pink-500/25 transition hover:from-pink-600 hover:to-orange-500 active:scale-[0.98]"
          >
            <Play className="size-5" aria-hidden />
            {ownBest === null ? 'Spielen' : 'Nochmal spielen'}
          </button>
          <p className="hint mt-2 text-center">
            {ownBest === null
              ? 'Eine Runde dauert keine Minute.'
              : ownRow && ownRow.score.name.trim()
                ? `Dein Rekord: ${ownBest} ${gameUnit(game, ownBest)} · Platz ${ownRow.rank} von ${namedCount}`
                : `Dein Rekord: ${ownBest} ${gameUnit(game, ownBest)}`}
            {preview && ' · Vorschau – nichts wird gespeichert'}
          </p>
        </>
      )}

      {/* Nach der ersten Runde: der Name für die Liste. */}
      {!closed && ownBest !== null && !gameName && (
        <div className="mt-4 rounded-2xl bg-pink-50 p-3 ring-1 ring-pink-200 dark:bg-pink-500/10 dark:ring-pink-400/30">
          <GameNameForm
            initial={profile ? impulseFirstName(profile.displayName) : ''}
            preview={preview}
            ownScoreIds={ownScoreIds}
            prompt="Trag deinen Namen ein, dann stehst du in der Rangliste."
          />
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Trophy className="size-4 text-amber-500" aria-hidden />
          {closed ? 'Endstand' : 'Rangliste'}
          <span className="hint mt-0 font-normal">· je Person der beste Lauf</span>
        </p>
        <ImpulseGameLeaderboard
          rows={rows}
          game={game}
          max={closed ? 10 : 5}
          onToggleHidden={moderate ? toggleHidden : undefined}
          emptyText={
            closed
              ? 'Diese Woche hat niemand gespielt.'
              : 'Noch niemand – sei die erste Person in der Liste.'
          }
        />
        {!closed && gameName && ownBest !== null && (
          <div className="hint mt-2 text-center">
            Du spielst als «{gameName}».{' '}
            <RenameButton gameName={gameName} preview={preview} ownScoreIds={ownScoreIds} />
          </div>
        )}
      </div>

      {open && (
        <ImpulseGameStage
          title={item.title}
          onClose={closeStage}
          onRoundEnd={roundEnd}
          renderResult={({ points, info }) => (
            <GameResult
              game={game}
              points={points}
              info={info}
              gameName={gameName}
              firstName={profile ? impulseFirstName(profile.displayName) : ''}
              preview={preview}
              ownScoreIds={ownScoreIds}
              rows={rows}
            />
          )}
        />
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Die Ergebnistafel                                                    */
/* ------------------------------------------------------------------ */

function GameResult({
  game,
  points,
  info,
  gameName,
  firstName,
  preview,
  ownScoreIds,
  rows,
}: {
  game: ImpulseGameId
  points: number
  info: GameRoundInfo
  gameName: string
  firstName: string
  preview: boolean
  ownScoreIds: string[]
  rows: GameRankRow[]
}) {
  const record = info.previousBest !== null && points > info.previousBest
  const first = info.previousBest === null
  const shown = useCountUp(points)
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Deine {gameUnit(game, 2)}
      </p>
      <p className="tabular mt-1 bg-gradient-to-r from-pink-500 to-orange-400 bg-clip-text text-6xl leading-none font-black text-transparent">
        {shown}
      </p>
      <p className="mt-2 min-h-6 text-sm font-semibold">
        {record ? (
          <span className="animate-imp-medal inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
            <Sparkles className="size-4" aria-hidden />
            Neuer Rekord!
          </span>
        ) : first ? (
          <span className="text-slate-600 dark:text-slate-300">Dein erster Lauf – stark!</span>
        ) : (
          <span className="text-slate-600 dark:text-slate-300">
            Dein Rekord: {info.previousBest} {gameUnit(game, info.previousBest ?? 0)}
          </span>
        )}
      </p>

      {!gameName && (
        <div className="mt-4 rounded-2xl bg-pink-50 p-3 text-left ring-1 ring-pink-200 dark:bg-pink-500/10 dark:ring-pink-400/30">
          <GameNameForm
            initial={firstName}
            preview={preview}
            ownScoreIds={ownScoreIds}
            prompt="Wie sollst du in der Rangliste heissen?"
          />
        </div>
      )}

      <div className="mt-4 text-left">
        <ImpulseGameLeaderboard rows={rows} game={game} max={5} />
      </div>
    </div>
  )
}

/** Die Zahl läuft hoch, statt gleich dazustehen – ausser bei weniger Bewegung. */
function useCountUp(target: number): number {
  const instant = target <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (instant) return
    const duration = Math.min(900, 200 + target * 12)
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - (1 - k) * (1 - k))))
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, instant])
  return instant ? target : value
}

/* ------------------------------------------------------------------ */
/* Der Name                                                            */
/* ------------------------------------------------------------------ */

function GameNameForm({
  initial,
  preview,
  ownScoreIds,
  prompt,
  onDone,
}: {
  initial: string
  preview: boolean
  ownScoreIds: string[]
  prompt: string
  onDone?: () => void
}) {
  const { profile } = useImpulseAuth()
  const writes = useImpulseWrites()
  const toast = useToast()
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const inputId = useId()
  const clean = cleanGameName(name)

  const submit = async () => {
    if (!clean || busy || !profile) return
    if (preview) {
      toast.saved(`In der Vorschau wird kein Name gespeichert – «${clean}» bliebe es.`)
      onDone?.()
      return
    }
    setBusy(true)
    try {
      const outcome = await writes.setImpulseGameName(
        { uid: profile.id, displayName: profile.displayName },
        clean,
        ownScoreIds,
      )
      toast.saved(`Du stehst als «${clean}» in der Rangliste.`, outcome)
      onDone?.()
    } catch (error) {
      console.error(error)
      toast.error('Der Name konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label className="text-sm font-medium" htmlFor={inputId}>
        {prompt}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          className="input min-w-0 flex-1"
          value={name}
          maxLength={GAME_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          placeholder="Dein Name oder Spitzname"
          autoComplete="nickname"
          enterKeyHint="done"
        />
        <button
          type="submit"
          className="btn-primary shrink-0 border-0 bg-gradient-to-r from-pink-500 to-orange-400 text-white hover:from-pink-600 hover:to-orange-500"
          disabled={!clean || busy}
        >
          Eintragen
        </button>
      </div>
      <p className="hint mt-1.5">
        Auch ein Spitzname geht. Er gilt für jede weitere Runde – auch in den nächsten Wochen.
      </p>
    </form>
  )
}

/** «Name ändern» – klappt das Feld auf, an Ort und Stelle. */
function RenameButton({
  gameName,
  preview,
  ownScoreIds,
}: {
  gameName: string
  preview: boolean
  ownScoreIds: string[]
}) {
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium text-pink-700 underline-offset-2 hover:underline dark:text-pink-300"
        onClick={() => setEditing(true)}
      >
        <PencilLine className="size-3.5" aria-hidden />
        Name ändern
      </button>
    )
  }
  return (
    <div className="mt-2 text-left">
      <GameNameForm
        initial={gameName}
        preview={preview}
        ownScoreIds={ownScoreIds}
        prompt="Dein neuer Name für die Rangliste"
        onDone={() => setEditing(false)}
      />
    </div>
  )
}
