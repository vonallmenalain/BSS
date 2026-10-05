import { Eye, EyeOff, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { gameUnit, leaderboardLines, type GameRankRow } from '@/lib/impulseGame'
import type { ImpulseGameId, ImpulseGameScore } from '@/lib/types'

/**
 * Die Rangliste eines Minispiels: Platz, Name, bester Lauf.
 *
 * Je Konto ein Eintrag – wie oft jemand gespielt hat, steht nirgends. Der
 * eigene Eintrag ist hervorgehoben und steht immer da, auch weit hinten
 * (dann mit einer Lücke davor). Wer noch keinen Namen eingetragen hat,
 * sieht seinen Eintrag als «Du – noch ohne Namen»; die anderen sehen ihn
 * erst mit Namen.
 *
 * Die Redaktion (`onToggleHidden`) sieht auch Ausgeblendetes und kann
 * jeden fremden Eintrag aus- und wieder einblenden.
 */
export function ImpulseGameLeaderboard({
  rows,
  game,
  max = 5,
  onToggleHidden,
  emptyText = 'Noch niemand – sei die erste Person in der Liste.',
}: {
  rows: GameRankRow[]
  game: ImpulseGameId
  /** So viele Plätze zeigt die kurze Liste – der eigene kommt dazu. */
  max?: number
  onToggleHidden?: (score: ImpulseGameScore) => void
  emptyText?: string
}) {
  const lines = leaderboardLines(rows, max)

  if (lines.length === 0) {
    return (
      <p className="hint mt-0 rounded-xl border border-dashed border-slate-300 p-3 text-center dark:border-slate-700">
        {emptyText}
      </p>
    )
  }

  return (
    <ol className="space-y-1.5" aria-label="Rangliste">
      {lines.map((line, index) => {
        if (line.kind === 'gap') {
          return (
            <li
              key={`gap-${index}`}
              aria-hidden
              className="text-center text-xs tracking-[0.3em] text-slate-400"
            >
              ···
            </li>
          )
        }
        const { score, rank, own } = line.row
        const unnamed = score.name.trim() === ''
        return (
          <li
            key={score.id}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
              own
                ? 'bg-gradient-to-r from-pink-500 to-orange-400 font-semibold text-white shadow-sm'
                : rank === 1
                  ? 'bg-amber-50 ring-1 ring-amber-300/70 dark:bg-amber-500/10 dark:ring-amber-400/40'
                  : 'bg-white/70 ring-1 ring-slate-200/80 dark:bg-white/5 dark:ring-white/10',
              score.hidden && !own && 'opacity-50',
            )}
          >
            <span
              className={cn(
                'tabular w-7 shrink-0 text-right font-bold',
                own ? 'text-white/90' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {rank === 1 && !own ? (
                <Trophy className="ms-auto size-4 text-amber-500" aria-label="Platz 1" />
              ) : (
                `${rank}.`
              )}
            </span>
            <span className={cn('min-w-0 flex-1 truncate', score.hidden && 'line-through')}>
              {unnamed ? 'Du – noch ohne Namen' : score.name}
              {own && !unnamed && <span className="font-normal opacity-80"> (du)</span>}
              {score.hidden && (
                <span className="ms-1.5 text-xs font-normal no-underline opacity-80">
                  · ausgeblendet
                </span>
              )}
            </span>
            <span className="tabular shrink-0 font-bold">
              {score.best}
              <span
                className={cn(
                  'ms-1 text-xs font-normal',
                  own ? 'text-white/85' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {gameUnit(game, score.best)}
              </span>
            </span>
            {onToggleHidden && !own && (
              <button
                type="button"
                className="btn-ghost -me-1.5 shrink-0 p-1"
                onClick={() => onToggleHidden(score)}
                aria-label={
                  score.hidden ? `${score.name} wieder einblenden` : `${score.name} ausblenden`
                }
                title={
                  score.hidden
                    ? 'Wieder einblenden'
                    : 'Ausblenden – die anderen sehen den Eintrag dann nicht mehr'
                }
              >
                {score.hidden ? (
                  <Eye className="size-4" aria-hidden />
                ) : (
                  <EyeOff className="size-4" aria-hidden />
                )}
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
