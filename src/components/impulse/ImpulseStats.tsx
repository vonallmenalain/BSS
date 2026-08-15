import { useState } from 'react'
import { Award, Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatWeekRange,
  weekKeyOffset,
  type ImpulseMilestoneStep,
  type ImpulseWeekMilestone,
} from '@/lib/impulse'
import { IMPULSE_SECTIONS } from '@/lib/impulseSections'
import { Modal } from '@/components/ui/Modal'
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
 * Jeder Meilenstein lässt sich antippen: Das Fenster dahinter beantwortet
 * die Frage, die eine Zahl offenlässt – wie er zustande kommt und welche
 * Karte, welcher Tag noch fehlt (`MilestoneModal`).
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
  /* Offen bleibt die **Kennung**, nicht der Meilenstein selbst: Er wird
     bei jedem Rendern neu gerechnet, und so steht im Fenster immer der
     frische Stand – auch wenn nebenher ein Haken dazukommt. */
  const [openId, setOpenId] = useState<ImpulseWeekMilestone['id'] | null>(null)
  const open = milestones.find((milestone) => milestone.id === openId) ?? null

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

      {/* Die Meilensteine der Woche – erreicht oder unterwegs, nie «versäumt».
          Jede Karte lässt sich antippen; das Fenster darunter erzählt, wie
          der Meilenstein zustande kommt und was noch fehlt. */}
      <section>
        <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Meilensteine pro Woche
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {milestones.map((milestone) => (
            <button
              key={milestone.id}
              type="button"
              onClick={() => setOpenId(milestone.id)}
              aria-haspopup="dialog"
              className="card w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] active:shadow-xs"
            >
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
                <ChevronRight
                  className="size-3.5 shrink-0 text-slate-300 dark:text-slate-600"
                  aria-hidden
                />
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
            </button>
          ))}
        </div>
        <p className="hint mt-2">Tippe auf einen Meilenstein – dort steht, was noch fehlt.</p>
        <MilestoneModal milestone={open} onClose={() => setOpenId(null)} barClass={theme.bar} />
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

/**
 * Das Detailfenster zu einem Meilenstein.
 *
 * Eine Zahl wie «21 von 22» sagt nicht, welche Karte die fehlende ist –
 * und «Dabei!» sagt nicht, wofür es das gibt. Genau das steht hier: ein
 * Satz, wie der Meilenstein zustande kommt, und darunter die Schritte.
 * Das Offene zuerst (das ist die Frage, mit der jemand hier hereinkommt),
 * das Erledigte danach – damit sichtbar bleibt, was schon zählt, statt
 * nur zu mahnen, was fehlt.
 */
function MilestoneModal({
  milestone,
  onClose,
  barClass,
}: {
  /** Der offene Meilenstein – `null`, solange keiner gewählt ist. */
  milestone: ImpulseWeekMilestone | null
  onClose: () => void
  barClass: string
}) {
  const openSteps = milestone?.steps.filter((step) => !step.done) ?? []
  const doneSteps = milestone?.steps.filter((step) => step.done) ?? []

  return (
    <Modal
      open={Boolean(milestone)}
      onClose={onClose}
      title={milestone?.label ?? ''}
      size="sm"
    >
      {milestone && (
        <div className="space-y-4">
          {milestone.earned ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-300">
              <Check className="size-4" aria-hidden />
              Erreicht – diese Woche geschafft.
            </p>
          ) : milestone.progress.max > 1 ? (
            <div className="flex items-center gap-2">
              <Meter
                share={milestone.progress.value / milestone.progress.max}
                barClass={barClass}
              />
              <span className="tabular shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {milestone.progress.value} von {milestone.progress.max}
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Noch offen.</p>
          )}

          <p className="text-sm text-slate-600 dark:text-slate-300">{milestone.how}</p>

          {openSteps.length > 0 && (
            <section>
              <h3 className="label">Das fehlt noch</h3>
              <StepList steps={openSteps} />
            </section>
          )}

          {doneSteps.length > 0 && (
            <section>
              <h3 className="label">Schon dabei</h3>
              <StepList steps={doneSteps} />
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Die Schritte eines Meilensteins – Tage, Karten, die Frage der Woche. */
function StepList({ steps }: { steps: ImpulseMilestoneStep[] }) {
  return (
    <ul className="mt-1.5 space-y-1.5">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2 text-sm">
          <span
            className={cn(
              'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
              step.done
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-300 dark:border-slate-600',
            )}
            aria-hidden
          >
            {step.done && <Check className="size-3" />}
          </span>
          {/* Kartentitel sind ganze Sätze – zwei Zeilen genügen, um sie
              wiederzuerkennen; sonst wird die Liste zur Wand. */}
          <span className="line-clamp-2 min-w-0 flex-1">
            <span className="sr-only">{step.done ? 'Erledigt: ' : 'Offen: '}</span>
            <span className={step.done ? 'text-slate-500 dark:text-slate-400' : undefined}>
              {step.label}
            </span>
            {step.note && (
              <span className="text-xs text-slate-400 dark:text-slate-500"> · {step.note}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
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
