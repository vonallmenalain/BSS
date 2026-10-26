import type { ReactNode } from 'react'
import { SORT_SIDES } from '@/lib/impulseGame'

/*
 * Die Erklärungen vor der ersten Runde – je Spiel zwei Kästchen (was
 * wohin, mit Beispielen) und ein paar Sätze, wie man spielt. Die Bühne
 * (`ImpulseGameStage`) setzt Titel und Startknopf darum herum; welches
 * Spiel welche Erklärung bekommt, steht in `games.ts`.
 *
 * Kurz gehalten: Wer die Karte öffnet, will spielen, nicht lesen. Die
 * Regeln, die man erst im Spiel braucht, sagt das Spiel selbst – mit dem
 * Hinweis am Anfang jeder Runde und dem Grund nach jedem Fehler.
 */

type Tone = 'red' | 'green' | 'violet' | 'amber' | 'slate'

const TONES: Record<Tone, string> = {
  red: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/30',
  green:
    'bg-green-50 text-green-800 ring-green-200 dark:bg-green-500/10 dark:text-green-200 dark:ring-green-400/30',
  violet:
    'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-400/30',
  amber:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30',
  slate:
    'bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:ring-slate-400/30',
}

function Box({
  tone,
  emoji,
  title,
  hint,
}: {
  tone: Tone
  emoji: string
  title: string
  hint: string
}) {
  return (
    <div className={`rounded-2xl p-3 ring-1 ${TONES[tone]}`}>
      <p className="text-2xl leading-none" aria-hidden>
        {emoji}
      </p>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="text-xs opacity-80">{hint}</p>
    </div>
  )
}

function Intro({ boxes, children }: { boxes: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">{boxes}</div>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{children}</p>
    </>
  )
}

/** «Gut für dich?» – die zwei Seiten, mit Beispielen. */
export function SortIntro() {
  return (
    <Intro
      boxes={
        <>
          <Box
            tone="red"
            emoji="🚬 🍺 ☕"
            title={`← ${SORT_SIDES.left}`}
            hint="nach links wischen"
          />
          <Box
            tone="green"
            emoji="🥦 🌾 🏃"
            title={`${SORT_SIDES.right} →`}
            hint="nach rechts wischen"
          />
        </>
      }
    >
      Dran ist der Gegenstand mit dem Ring. Wische ihn auf die richtige Seite – oder tippe links
      bzw. rechts –, bevor er unten ankommt. Drei Leben, zehn richtige am Stück geben eines zurück.
      Und es wird schnell schneller.
    </Intro>
  )
}

/** «Schild hoch!» – was abprallen soll und was durch darf. */
export function ShieldIntro() {
  return (
    <Intro
      boxes={
        <>
          <Box tone="violet" emoji="📱 🙈 🗯️" title="Abwehren" hint="Schild davor – ein Punkt" />
          <Box tone="amber" emoji="🎵 🤝 🙏" title="Durchlassen" hint="ans Herz – drei Punkte" />
        </>
      }
    >
      Tippe dorthin, woher etwas kommt – oder zieh den Finger im Kreis; am Rechner gehen die
      Pfeiltasten. Dunkle Pfeile wehrst du ab, Lichter lässt du ans Herz: Sie geben ein verlorenes
      Leben zurück. Drei Leben – und es wird schnell schneller.
    </Intro>
  )
}

/** «Keine Ausreden!» – worüber man springt und was man einsammelt. */
export function RunIntro() {
  return (
    <Intro
      boxes={
        <>
          <Box
            tone="slate"
            emoji="⏰ 🛋️ 🐌"
            title="Ausreden"
            hint="Hürden, Lücken, Klüfte überwinden"
          />
          <Box tone="amber" emoji="🙏 📖 🧹" title="Aufgaben" hint="selten – und nur im Sprung" />
        </>
      }
    >
      Tippe irgendwo, um zu springen – länger drücken springt höher. Am Rechner gehen Leertaste und
      Pfeil nach oben. Bald kommen Klüfte, Trittsteine und Gabelungen: Wähl die richtige Route und
      spring genau, sonst fällst du. Drei Treffer oder Stürze beenden die Runde, fünfzehn
      Hindernisse am Stück heilen eine Wunde – wie bei den jungen Kriegern: verwundet, aber nicht
      gefallen.
    </Intro>
  )
}

/** «Ketten sprengen» – Notlügen und der Schlüssel. */
export function ChainIntro() {
  return (
    <Intro
      boxes={
        <>
          <Box tone="violet" emoji="🏃 🙈 🐕" title="Notlügen" hint="wegtippen: +3, +2, +1" />
          <Box tone="amber" emoji="🗝️" title="Schlüssel" hint="sprengt alles auf einmal" />
        </>
      }
    >
      Jede Notlüge beginnt als dünne Schnur und wird zur Kette. Tippe sie weg, solange sie dünn ist
      – je früher, desto mehr Punkte. Schnappt eine zu, kostet das eines von drei Leben; der
      Schlüssel bringt eines zurück. Daneben tippen lähmt kurz. Am Rechner: Tasten 1 bis 9.
    </Intro>
  )
}
