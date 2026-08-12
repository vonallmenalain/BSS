import { CheckCircle2, Inbox, LayoutList, Lightbulb, Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/Pickers'
import {
  endOfCalendarWeek,
  formatDayMonth,
  formatDayMonthYear,
  startOfCalendarWeek,
} from '@/lib/dates'

/**
 * «Impuls» – der geistige Bereich für die AP’s (docs/KONZEPT-IMPULS.md).
 *
 * Das ist die Etappe 0: das Gerüst. Die Seite steht am richtigen Ort,
 * hinter dem richtigen Schalter (`users/{uid}.impulse`, siehe
 * `RequireImpulse` in App.tsx) und zeigt den Wochentakt, in dem der
 * Bereich leben wird – aber noch ohne Inhalte. Sie sagt an, was hier
 * entsteht, damit der Aufbau in der App selbst sichtbar ist und nicht nur
 * im Konzept.
 */

/** Die Bausteine aus dem Konzept, in der Reihenfolge der Etappen. */
const UPCOMING = [
  {
    icon: Lightbulb,
    title: 'Wochenimpuls',
    text: 'Eine Schriftstelle oder ein Gedanke aus einer Konferenzansprache – jede Woche neu, passend zum Thema der AP-Klasse vom Sonntag.',
  },
  {
    icon: Search,
    title: 'Quizfrage der Woche',
    text: 'Montags gestellt, sonntags aufgelöst – und die Antwort steht nicht hier, sondern in den Schriften oder der verlinkten Ansprache.',
  },
  {
    icon: CheckCircle2,
    title: 'Wochenziel und Tages-Challenge',
    text: 'Ein Ziel für die Woche, eine kleine Aufgabe für jeden Tag – mit Serie, Abzeichen und dem Blick darauf, was die Gruppe zusammen schafft.',
  },
  {
    icon: LayoutList,
    title: 'Impuls-Feed',
    text: 'Kurze Karten zum Durchtippen: Verse, Zitate, «Wusstest du?» – fünf bis zehn pro Woche, dann ist bewusst Schluss.',
  },
  {
    icon: Users,
    title: 'Frage der Woche',
    text: 'Eine Frage, kurze Antworten mit Vornamen – und wer selbst geantwortet hat, liest die Antworten der anderen.',
  },
]

export function Impuls() {
  /*
   * Die Woche ist die tragende Einheit des Bereichs – Montag bis Sonntag,
   * wie im Konzept. Sie steht von Anfang an im Kopf der Seite, damit der
   * Takt sichtbar ist, noch bevor die erste Woche gefüllt ist.
   */
  const now = new Date()
  const weekLabel = `${formatDayMonth(startOfCalendarWeek(now))} – ${formatDayMonthYear(endOfCalendarWeek(now))}`

  return (
    <>
      <PageHeader title="Impuls" subtitle="Der geistige Bereich für die AP’s" />

      <div className="mx-auto max-w-2xl space-y-4">
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Diese Woche</h2>
          <p className="hint">{weekLabel}</p>

          <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
            <Inbox className="size-6 text-slate-400" aria-hidden />
            <p className="mt-2 text-sm font-medium">Noch keine Inhalte</p>
            <p className="hint mt-1 max-w-sm">
              Hier steht künftig, was diese Woche ansteht: der Impuls, die Quizfrage, das
              Wochenziel. Der Rahmen ist bereit – gefüllt wird er mit der nächsten Etappe.
            </p>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">Was hier entsteht</h2>
          <ul className="mt-3 space-y-3">
            {UPCOMING.map((item) => (
              <li key={item.title} className="flex gap-3">
                <item.icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="hint">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="hint mt-4">
            Alles aus offiziellem Material der Kirche, kurz gefasst und immer mit Quelle – das
            Ganze steht in <span className="font-medium">docs/KONZEPT-IMPULS.md</span>.
          </p>
        </section>
      </div>
    </>
  )
}
