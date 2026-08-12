import { Award, Check, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDayMonthYear } from '@/lib/dates'
import {
  IMPULSE_BADGES,
  formatWeekRange,
  weekKeyOffset,
  type ImpulseBadge,
} from '@/lib/impulse'
import { IMPULSE_SECTIONS, type ImpulseSectionKey } from '@/lib/impulseSections'
import { formatImpulseDuration, readImpulseUsage } from '@/lib/impulseUsage'
import { ImpulseRing } from '@/components/impulse/ImpulseRing'
import type { ImpulseAnswer, ImpulseProgress } from '@/lib/types'

/*
 * «Mein Fortschritt» – die Statistik-Ansicht des Bereichs «Impuls».
 *
 * Ein kleines Spiel mit sich selbst, nie gegen andere: Serie, Verlauf,
 * Meilensteine mit sichtbarem Weg dorthin, die eigenen Zahlen – und die
 * Gerätestatistik (Zeit, Besuche), die bewusst nur lokal gezählt wird
 * (`lib/impulseUsage`). Alles hier vergleicht mit gestern, nicht mit dem
 * Nachbarn (Leitgedanke 4) – und ein leerer Stand mahnt nicht, er wartet.
 *
 * Die Zahlen tragen Tintenfarbe, nicht Bereichsfarbe – Farbe markiert
 * hier Identität (welcher Bereich), nie Grösse. Jeder Balken ist direkt
 * beschriftet; nichts hängt an Farbe allein.
 */
export function ImpulseStats({
  uid,
  todayKey,
  streak,
  participated,
  progress,
  answers,
  commentsCount,
  favoritesCount,
  badges,
}: {
  uid: string
  todayKey: string
  streak: { current: number; best: number }
  participated: ReadonlySet<string>
  /** Das eigene Fortschrittsdokument – `null`, solange keines besteht. */
  progress: ImpulseProgress | null
  /** Die eigenen Quizantworten. */
  answers: ImpulseAnswer[]
  commentsCount: number
  favoritesCount: number
  badges: ImpulseBadge[]
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

  const earned = new Set(badges.map((badge) => badge.id))

  /*
   * Der Weg zu jedem Abzeichen – dieselben Schwellen wie in
   * `earnedImpulseBadges`, hier als Stand «3 von 4». Wer alles hat,
   * sieht sechs volle Balken: auch das ein schönes Bild.
   */
  const milestoneProgress: Record<string, { value: number; max: number }> = {
    dabei: { value: participated.size, max: 1 },
    mitgeredet: { value: commentsCount, max: 1 },
    'volle-woche': {
      value: weekStates.reduce(
        (most, state) => Math.max(most, new Set(state?.days ?? []).size),
        0,
      ),
      max: 7,
    },
    'vier-wochen': { value: streak.best, max: 4 },
    'acht-wochen': { value: streak.best, max: 8 },
    'zehn-fragen': { value: answers.length, max: 10 },
  }

  /* Die letzten zwölf Wochen, älteste zuerst – die laufende zuletzt. */
  const timeline = Array.from({ length: 12 }, (_, index) => {
    const week = weekKeyOffset(todayKey, index - 11) ?? todayKey
    return { week, participated: participated.has(week), current: week === todayKey }
  })

  const usage = readImpulseUsage(uid)
  /* Die Übersicht zählt nicht als «Bereich geöffnet» – sie ist der Flur. */
  const sectionOpens = (
    Object.entries(usage.opens) as [ImpulseSectionKey | 'uebersicht', number][]
  ).filter(([key]) => key !== 'uebersicht' && key in IMPULSE_SECTIONS)
  const opensTotal = sectionOpens.reduce((sum, [, count]) => sum + (count ?? 0), 0)
  const topSections = [...sectionOpens].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const topMax = topSections[0]?.[1] ?? 0

  const theme = IMPULSE_SECTIONS.fortschritt
  const target = streak.current < 4 ? 4 : 8

  return (
    <div className="space-y-4">
      {/* Die Serie – das Herzstück, gross und warm. */}
      <section className="card flex items-center gap-5 p-5">
        <ImpulseRing value={streak.current} max={target} size={96} stroke={7} arcClass={theme.ring}>
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
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {streak.current > 0 ? (
              <>
                Noch {Math.max(target - streak.current, 0)}{' '}
                {target - streak.current === 1 ? 'Woche' : 'Wochen'} bis «{target} Wochen in
                Folge».
                {streak.best > streak.current && ` Deine beste Serie: ${streak.best}.`}
              </>
            ) : (
              'Sie beginnt, sobald du diese Woche etwas abhakst oder eine Frage beantwortest.'
            )}
          </p>
          <p className="hint">Eine Jokerwoche pro Monat ist eingebaut.</p>
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

      {/* Die Meilensteine – erreicht oder unterwegs, nie «versäumt». */}
      <section>
        <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Meilensteine
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {IMPULSE_BADGES.map((badge) => {
            const isEarned = earned.has(badge.id)
            const state = milestoneProgress[badge.id] ?? { value: 0, max: 1 }
            const value = Math.min(state.value, state.max)
            return (
              <div key={badge.id} className="card p-4" title={badge.hint}>
                <div className="flex items-center gap-2">
                  <Award
                    className={cn(
                      'size-4.5 shrink-0',
                      isEarned ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600',
                    )}
                    aria-hidden
                  />
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold">{badge.label}</p>
                </div>
                {isEarned ? (
                  <p className="mt-2.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-300">
                    <Check className="size-3.5" aria-hidden />
                    Erreicht
                  </p>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <Meter share={state.max > 0 ? value / state.max : 0} barClass={theme.bar} />
                    <span className="tabular shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                      {value}/{state.max}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Die eigenen Zahlen – alles, was je zusammengekommen ist. */}
      <section>
        <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Alles gezählt
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile value={participated.size} label="Wochen dabei" />
          <StatTile value={goalsDone} label="Wochenziele geschafft" />
          <StatTile value={challengeDays} label="Challenge-Tage" sub={fullWeeks > 0 ? `${fullWeeks} volle ${fullWeeks === 1 ? 'Woche' : 'Wochen'}` : undefined} />
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

      {/* Die Gerätestatistik – bei dir gezählt, bei dir geblieben. */}
      <section>
        <h2 className="mt-6 mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <Smartphone className="size-4" aria-hidden />
          Auf diesem Gerät
        </h2>
        <div className="card space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="tabular text-2xl font-bold">
                {formatImpulseDuration(usage.seconds)}
              </p>
              <p className="hint">Zeit im Impuls</p>
            </div>
            <div>
              <p className="tabular text-2xl font-bold">{opensTotal}</p>
              <p className="hint">Bereiche geöffnet</p>
            </div>
          </div>

          {topSections.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Deine meistbesuchten Bereiche
              </p>
              <ul className="mt-2 space-y-2">
                {topSections.map(([key, count]) => {
                  const section = IMPULSE_SECTIONS[key as ImpulseSectionKey]
                  if (!section) return null
                  return (
                    <li key={key} className="flex items-center gap-2.5">
                      <section.icon className={cn('size-4 shrink-0', section.text)} aria-hidden />
                      <span className="w-28 shrink-0 truncate text-xs">{section.label}</span>
                      <Meter share={topMax > 0 ? count / topMax : 0} barClass={section.bar} />
                      <span className="tabular shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {count}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <p className="hint">
            Zeit und Besuche zählt nur dieses Gerät – sie verlassen es nicht.
            {usage.since && ` Gezählt seit ${formatDayMonthYear(new Date(usage.since))}.`}
          </p>
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
