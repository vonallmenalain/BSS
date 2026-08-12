import { Inbox } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ImpulseCard, QuizCard } from '@/components/impulse/ImpulseCards'
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
  const ready = items.filter((item) => item.status === 'ready')
  const drafts = items.filter((item) => item.status === 'draft')

  return (
    <Modal open onClose={onClose} title="Vorschau" description={formatWeekRange(week)} size="lg">
      <div className="space-y-4">
        <p className="hint">
          So sieht diese Woche für die AP’s aus, sobald sie beginnt. Antworten in der Vorschau
          werden nicht gespeichert.
        </p>

        {ready.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
            <Inbox className="size-6 text-slate-400" aria-hidden />
            <p className="mt-2 text-sm font-medium">Diese Woche ist noch nichts aufgeschaltet</p>
            <p className="hint mt-1 max-w-sm">
              Genau das sähen die AP’s – der leere Zustand, freundlich angeschrieben.
            </p>
          </div>
        ) : (
          ready.map((item) => {
            switch (item.kind) {
              case 'quiz':
                return <QuizCard key={item.id} item={item} answer={null} preview />
              case 'wochenziel':
                return <GoalCard key={item.id} item={item} week={week} done={false} preview />
              case 'tageschallenge':
                return <ChallengeCard key={item.id} item={item} week={week} days={[]} preview />
              default:
                return <ImpulseCard key={item.id} item={item} />
            }
          })
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
