import { useMemo } from 'react'
import { Eye, X } from 'lucide-react'
import { formatWeekRange } from '@/lib/impulse'
import { IMPULSE_KIND_THEME } from '@/lib/impulseSections'
import {
  ImpulseDeepeningCard,
  ImpulseImageBackdrop,
  QuizCard,
  VideoDeckCard,
  WocheDeckCard,
} from '@/components/impulse/ImpulseCards'
import { ChallengeCard, GoalCard } from '@/components/impulse/ImpulseProgressCards'
import { ImpulseFeedCard } from '@/components/impulse/ImpulseFeedCard'
import { ImpulseQuestionCard } from '@/components/impulse/ImpulseQuestionCard'
import { ImpulseShareCard } from '@/components/impulse/ImpulseShareCard'
import { ImpulseVideoPlayer } from '@/components/impulse/ImpulseVideoPlayer'
import { impulseVideoSource } from '@/lib/impulseVideo'
import { ImpulseFeedScreen, type ImpulseDeckCard } from '@/components/impulse/ImpulseFeedScreen'
import type { ImpulseItem } from '@/lib/types'

/**
 * Die Vorschau der Redaktion – der **echte** Vollbild-Feed, kein
 * nachgebautes Fenster: dieselben Karten, dasselbe Wischen, dieselben
 * Vertiefungen. Zwei Spielarten: die ganze Woche (in Lesereihenfolge,
 * Entwürfe angeschrieben) oder eine einzelne Karte.
 *
 * Damit niemand die Vorschau mit dem Bereich verwechselt, sitzt oben
 * eine unübersehbare Leiste: «Vorschau – Änderungen werden nicht
 * gespeichert». Und das stimmt wörtlich: Quiz, Frage der Woche, Teilen,
 * Amen und Merken laufen hier im Vorschau-Modus der Karten – alles lebt
 * nur im Fenster und verschwindet mit ihm.
 */
export function ImpulseEditorPreview({
  week,
  items,
  label,
  onClose,
}: {
  week: string
  /** Die Karten der Vorschau, in Lesereihenfolge – eine oder die ganze Woche. */
  items: ImpulseItem[]
  /** Die Zeile in der Leiste – ohne Angabe steht die Woche da. */
  label?: string
  onClose: () => void
}) {
  const cards = useMemo<ImpulseDeckCard[]>(
    () =>
      items.map((raw) => {
        /* Wie im Feed: Bild und Video liegen als Fläche hinter der
           Karte, nicht im Text. */
        const item = raw.image?.url ? { ...raw, image: null } : raw
        const videoSource = impulseVideoSource(raw.videoUrl)
        const image = raw.image
        const media: ImpulseDeckCard['media'] =
          raw.kind === 'video' && videoSource
            ? ({ active }) => (
                <ImpulseVideoPlayer
                  source={videoSource}
                  poster={image?.url ?? null}
                  title={raw.title}
                  active={active}
                />
              )
            : image?.url
              ? () => <ImpulseImageBackdrop image={image} />
              : null
        /* Wie im Feed: Die Video-Karte steht für sich, solange die
           Redaktion keinen Text über dem Video will. */
        const mediaOnly = raw.kind === 'video' && Boolean(videoSource) && !raw.videoTextPage
        const node = (() => {
          switch (item.kind) {
            case 'quiz':
            case 'bilderraetsel':
              return <QuizCard item={item} answer={null} preview plain progressDocs={[]} />
            case 'video':
              return <VideoDeckCard item={item} progressDocs={[]} preview />
            case 'frage':
              return (
                <ImpulseQuestionCard item={item} comments={[]} progressDocs={[]} preview plain />
              )
            case 'feed':
              return <ImpulseFeedCard item={item} progressDocs={[]} preview />
            case 'teilen':
              return (
                <ImpulseShareCard
                  item={item}
                  week={week}
                  done={false}
                  preview
                  plain
                  progressDocs={[]}
                />
              )
            case 'wochenziel':
              return <GoalCard item={item} week={week} done={false} preview plain />
            case 'tageschallenge':
              return <ChallengeCard item={item} week={week} days={[]} preview plain />
            default:
              return <WocheDeckCard item={item} progressDocs={[]} preview />
          }
        })()
        return {
          id: `${item.kind}-${item.id}`,
          itemId: item.id,
          section: IMPULSE_KIND_THEME[item.kind],
          media,
          mediaOnly,
          node:
            item.status === 'draft' ? (
              <div>
                <p className="mb-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  Entwurf – erscheint bei den AP’s noch nicht
                </p>
                {node}
              </div>
            ) : (
              node
            ),
          /* Die Vertiefung steht in der Vorschau immer offen – die
             Redaktion will sehen, was sie geschrieben hat. */
          deepening: item.deepening ? <ImpulseDeepeningCard item={item} /> : null,
        }
      }),
    [items, week],
  )

  return (
    <ImpulseFeedScreen
      cards={cards}
      onClose={onClose}
      banner={
        <div className="border-b border-amber-300/60 bg-amber-100/95 pt-safe text-amber-900 backdrop-blur-sm dark:border-amber-800/60 dark:bg-amber-950/95 dark:text-amber-100">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Eye className="size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 text-sm leading-tight">
              <span className="font-semibold">Vorschau</span>
              <span className="mx-1.5">·</span>
              {label ?? formatWeekRange(week)}
              <span className="block text-xs opacity-80">Änderungen werden nicht gespeichert.</span>
            </p>
            <button
              type="button"
              className="btn-secondary btn-sm shrink-0"
              onClick={onClose}
              aria-label="Vorschau schliessen"
            >
              <X className="size-4" aria-hidden />
              Schliessen
            </button>
          </div>
        </div>
      }
    />
  )
}
