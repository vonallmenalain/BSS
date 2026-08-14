import { Award, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatWeekRange,
  weekKeyOffset,
  type ImpulseWeekMilestone,
} from '@/lib/impulse'
import { IMPULSE_SECTIONS } from '@/lib/impulseSections'
import { ImpulseRing } from '@/components/impulse/ImpulseRing'
import type { ImpulseAnswer, ImpulseProgress } from '@/lib/types'

/*
 * «Mein Fortschritt» – die Statistik-Ansicht des Bereichs «Anti Doom».
 *
 * Ein kleines Spiel mit sich selbst, nie gegen andere: die Serie (nur
 * die Zahl, ohne Countdown und ohne Jokerwoche – beides gab es einmal
 * und ist bewusst weggefallen), der Verlauf der letzten zwölf Wochen,
 * die **Meilensteine pro Woche** (`impulseWeekMilestones` – am Montag
 * wieder offen) und die eigenen Zahlen. Alles hier vergleicht mit
 * gestern, nicht mit dem Nachbarn (Leitgedanke 4) – und ein leerer
 * Stand mahnt nicht, er wartet.
 *
 * Die Zahlen tragen Tintenfarbe, nicht Bereichsfarbe – Farbe markiert
 * hier Identität (welcher Bereich), nie Grösse. Jeder Balken ist direkt
 * beschriftet; nichts hängt an Farbe allein.
 */
export function ImpulseStats({
  todayKey,
  streak,
  participated,
  progress,
  answers,
  commentsCount,
  favoritesCount,
  milestones,
}: {
  todayKey: string
  streak: { current: number; best: number }
  participated: ReadonlySet<string>
  /** Das eigene Fortschrittsdokument – `null`, solange keines besteht. */
  progress: ImpulseProgress | null
  /** Die eigenen Quizantworten. */
  answers: ImpulseAnswer[]
  commentsCount: number
  favoritesCount: number
  /** Die Meilensteine der laufenden Woche – berechnet von der Seite. */
  milestones: ImpulseWeekMilestone[]
}) {
  const weeks = progress?.weeks ?? {}
  const weekStates = Object.values(weeks)
  const goalsDone = weekStates.filter((state) => state?.goal === true).length
  const challengeDays = weekStates.reduce(
    (sum, state) => sum + new Set(state?.days ?? []).size,
    0,
  )
  const fullWeeks = weekStates.filter((state) => new Set(state?.days ?? []).size >= 7).length
  const feedsDone = weekStates.filter((state) => state?.feed === true).length
  const quizCorrect = answers.filter((answer) => answer.correct === true).length
  const amens = progress?.amens?.length ?? 0

  /* Die letzten zwölf Wochen, älteste zuerst – die laufende zuletzt. */
  const timeline = Array.from({ length: 12 }, (_, index) => {
    const week = weekKeyOffset(todayKey, index - 11) ?? todayKey
    return { week, participated: participated.has(week), current: week === todayKey }
  })

  const theme = IMPULSE_SECTIONS.fortschritt

  return (
    <div className="space-y-4">
      {/* Die Serie – nur die Zahl und ihr Satz, mehr braucht sie nicht. */}
      <section className="card flex items-center gap-5 p-5">
        <ImpulseRing
          value={streak.current}
          max={Math.max(streak.current, 1)}
          size={96}
          stroke={7}
          arcClass={theme.ring}
        >
          <span className="text-center">
            <span className="tabular block text-3xl leading-none font-bold">
              {streak.current}
            </span>
            <span className="mt-0.5 block text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {streak.current === 1 ? 'Woche' : 'Wochen'}
            </span>
          </span>
        </ImpulseRing>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">
            {streak.current > 0
              ? `${streak.current} ${streak.current === 1 ? 'Woche' : 'Wochen'} in Folge`
              : 'Deine Serie wartet'}
          </h2>
          {streak.current === 0 && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Sie beginnt, sobald du diese Woche etwas abhakst oder eine Frage beantwortest.
            </p>
          )}
        </div>
      </section>

      {/* Der Verlauf – zwölf Wochen, ein Blick. */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Die letzten zwölf Wochen</h2>
        <div className="mt-3 flex items-center justify-between gap-1">
          {timeline.map((entry, index) => (
            <span
              key={entry.week}
              title={`${formatWeekRange(entry.week)}${entry.participated ? ' · dabei' : ''}`}
              style={{ animationDelay: `${index * 25}ms` }}
              className={cn(
                'animate-scale-in size-3 rounded-full',
                entry.participated
                  ? theme.bar
                  : 'bg-slate-200 dark:bg-slate-700',
                entry.current &&
                  !entry.participated &&
                  'ring-2 ring-orange-400/60 ring-offset-1 ring-offset-white dark:ring-offset-slate-900',
              )}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>vor 12 Wochen</span>
          <span>diese Woche</span>
        </div>
      </section>

      {/* Die Meilensteine der Woche – erreicht oder unterwegs, nie «versäumt». */}
      <section>
        <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Meilensteine pro Woche
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="card p-4" title={milestone.hint}>
              <div className="flex items-start gap-2">
                <Award
                  className={cn(
                    'size-4.5 shrink-0',
                    milestone.earned ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600',
                  )}
                  aria-hidden
                />
                {/* Umbrechen statt abschneiden: «Anti Doom Scroller» soll
                    auch auf dem Handy ganz dastehen. */}
                <p className="min-w-0 flex-1 text-xs font-semibold text-balance">
                  {milestone.label}
                </p>
              </div>
              {milestone.earned ? (
                <p className="mt-2.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-300">
                  <Check className="size-3.5" aria-hidden />
                  Erreicht
                </p>
              ) : milestone.progress.max > 1 ? (
                <div className="mt-3 flex items-center gap-2">
                  <Meter
                    share={milestone.progress.value / milestone.progress.max}
                    barClass={theme.bar}
                  />
                  <span className="tabular shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                    {milestone.progress.value} von {milestone.progress.max}
                  </span>
                </div>
              ) : (
                /* Ohne Zwischenstand (auch wenn die Woche z. B. gar keine
                   Karten hat) sagt die Karte einfach, worum es geht. */
                <p className="hint mt-2.5">{milestone.hint}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Die eigenen Zahlen – alles, was je zusammengekommen ist. */}
      <section>
        <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Meine Statistik
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile value={participated.size} label="Wochen dabei" />
          <StatTile value={goalsDone} label="Wochenziele geschafft" />
          <StatTile value={challengeDays} label="Tagesziele geschafft" sub={fullWeeks > 0 ? `${fullWeeks} volle ${fullWeeks === 1 ? 'Woche' : 'Wochen'}` : undefined} />
          <StatTile
            value={answers.length}
            label="Quizfragen beantwortet"
            sub={quizCorrect > 0 ? `${quizCorrect} richtig` : undefined}
          />
          <StatTile value={commentsCount} label="Beiträge zur Frage" />
          <StatTile value={amens} label="Amen gegeben" />
          <StatTile value={favoritesCount} label="Karten gemerkt" />
          <StatTile value={feedsDone} label="Feeds durchgetippt" />
        </div>
      </section>
    </div>
  )
}

/** Eine Zahl, gross und in Tinte – die Farbe gehört den Bereichen. */
function StatTile({ value, label, sub }: { value: number; label: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="tabular text-2xl leading-none font-bold">{value}</p>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  )
}

/** Ein dünner Balken, der sich beim Erscheinen auf seinen Stand füllt. */
function Meter({ share, barClass }: { share: number; barClass: string }) {
  return (
    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/60">
      <div
        className={cn('imp-meter h-full w-full rounded-full', barClass)}
        style={{ '--imp-share': String(Math.min(Math.max(share, 0), 1)) } as React.CSSProperties}
      />
    </div>
  )
}
