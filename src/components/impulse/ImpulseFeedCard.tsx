import { ContributorLine, SourceLink } from '@/components/impulse/ImpulseCards'
import { ImpulseCardActions } from '@/components/impulse/ImpulseCardActions'
import type { ImpulseItem, ImpulseProgress } from '@/lib/types'

/**
 * Eine Karte des Feeds – seit dem Stapel-Umbau eine Karte im
 * Wischstapel der Hauptseite statt eines eigenen Vollbilds.
 *
 * «Amen» und «Merken» stellt der gemeinsame Baustein
 * (`ImpulseCardActions`) – dieselben Knöpfe tragen inzwischen alle
 * Karten des Stapels. «Durchgetippt» vermerkt die Seite, sobald alle
 * Feed-Karten der Woche einmal im Bild waren – die Karte selbst weiss
 * davon nichts.
 *
 * Auch im Rückblick auf frühere Wochen bleiben beide Knöpfe lebendig:
 * Amen und Merken hängen am Inhalt, nicht an der Woche.
 */
export function ImpulseFeedCard({
  item,
  progressDocs,
  preview = false,
}: {
  item: ImpulseItem
  progressDocs: ImpulseProgress[]
  /** Vorschau: Amen und Merken leben nur im Fenster. */
  preview?: boolean
}) {
  return (
    <section className="card p-6 text-center sm:p-8">
      <h2 className="text-xl leading-snug font-semibold text-balance">{item.title}</h2>
      {item.body && (
        <p className="mt-3 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
      )}
      <div className="mt-4 flex flex-col items-center">
        <SourceLink item={item} />
        <ContributorLine item={item} />
      </div>

      <ImpulseCardActions item={item} progressDocs={progressDocs} preview={preview} />
    </section>
  )
}
