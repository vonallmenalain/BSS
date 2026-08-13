import { Inbox } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ImpulseCard, QuizCard } from '@/components/impulse/ImpulseCards'
import { ImpulseQuestionCard } from '@/components/impulse/ImpulseQuestionCard'
import { ImpulseShareCard } from '@/components/impulse/ImpulseShareCard'
import { ChallengeCard, GoalCard } from '@/components/impulse/ImpulseProgressCards'
import { formatWeekRange } from '@/lib/impulse'
import type { ImpulseItem } from '@/lib/types'

/**
 * Die Wochen-Vorschau der Redaktion: die Woche so, wie die AP's sie sehen
 * werden – mit denselben Karten, die auch der Bereich zeichnet
 * (`ImpulseCards`), nur eben schon vor ihrem Montag.
 *
 * Entwürfe erscheinen nicht, genau wie im Bereich – sie werden aber
 * angeschrieben, damit «in der Vorschau fehlt etwas» nicht mit «es ist
 * nichts erfasst» verwechselt wird. Die Quizfrage lässt sich durchspielen;
 * gespeichert wird dabei nichts (siehe `QuizCard`, `preview`).
 */
export function ImpulseWeekPreview({
  week,
  items,
  onClose,
}: {
  week: string
  /** Die Inhalte der Woche, in Lesereihenfolge – Entwürfe eingeschlossen. */
  items: ImpulseItem[]
  onClose: () => void
}) {
  const ready = items.filter((item) => item.status === 'ready' && item.kind !== 'feed')
  const feeds = items.filter((item) => item.status === 'ready' && item.kind === 'feed')
  const drafts = items.filter((item) => item.status === 'draft')

  return (
    <Modal open onClose={onClose} title="Vorschau" description={formatWeekRange(week)} size="lg">
      <div className="space-y-4">
        <p className="hint">
          So sieht diese Woche für die AP’s aus, sobald sie beginnt. Antworten in der Vorschau
          werden nicht gespeichert.
        </p>

        {ready.length === 0 && feeds.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
            <Inbox className="size-6 text-slate-400" aria-hidden />
            <p className="mt-2 text-sm font-medium">Diese Woche ist noch nichts aufgeschaltet</p>
            <p className="hint mt-1 max-w-sm">
              Genau das sähen die AP’s – der leere Zustand, freundlich angeschrieben.
            </p>
          </div>
        ) : (
          ready.map((item) => {
            const card = (() => {
              switch (item.kind) {
                case 'quiz':
                case 'bilderraetsel':
                  return <QuizCard item={item} answer={null} preview />
                case 'wochenziel':
                  return <GoalCard item={item} week={week} done={false} preview />
                case 'tageschallenge':
                  return <ChallengeCard item={item} week={week} days={[]} preview />
                case 'teilen':
                  return <ImpulseShareCard item={item} week={week} done={false} preview />
                case 'frage':
                  return (
                    <ImpulseQuestionCard item={item} comments={[]} progressDocs={[]} preview />
                  )
                default:
                  return <ImpulseCard item={item} />
              }
            })()
            return (
              <div key={item.id}>
                {card}
                <DeepeningNote item={item} />
              </div>
            )
          })
        )}

        {/* Der Feed, Karte für Karte – hier untereinander statt im
            Vollbild; für den Wisch-Eindruck gibt es den Bereich selbst. */}
        {feeds.length > 0 && (
          <div className="space-y-3">
            <p className="hint font-medium">
              Impuls-Feed · {feeds.length} {feeds.length === 1 ? 'Karte' : 'Karten'}, dann ist
              Schluss
            </p>
            {feeds.map((card, index) => (
              <div key={card.id}>
                <section className="card p-5 text-center">
                  <p className="hint">
                    Karte {index + 1} von {feeds.length}
                  </p>
                  <h3 className="mt-2 text-lg leading-snug font-semibold text-balance">
                    {card.title}
                  </h3>
                  {card.body && (
                    <p className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
                      {card.body}
                    </p>
                  )}
                  {card.source?.label && (
                    <p className="hint mt-2">
                      {card.source.label}
                    </p>
                  )}
                </section>
                <DeepeningNote item={card} />
              </div>
            ))}
          </div>
        )}

        {drafts.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Noch Entwurf und deshalb nicht dabei:{' '}
            {drafts.map((draft) => `«${draft.title || 'Ohne Titel'}»`).join(', ')}
          </p>
        )}
      </div>
    </Modal>
  )
}

/** Der stille Vermerk unter einer Karte mit Vertiefung. */
function DeepeningNote({ item }: { item: ImpulseItem }) {
  if (!item.deepening) return null
  return <p className="hint mt-1">Mit Vertiefung – im Feed ein Wisch nach links.</p>
}
