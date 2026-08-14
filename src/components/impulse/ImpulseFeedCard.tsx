import { useState } from 'react'
import { Bookmark, HandHeart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { ContributorLine, SourceLink } from '@/components/impulse/ImpulseCards'
import { setImpulseAmen, setImpulseFavorite } from '@/services/impulse'
import type { ImpulseItem, ImpulseProgress } from '@/lib/types'

/**
 * Eine Karte des Feeds – seit dem Stapel-Umbau eine Karte im
 * Wischstapel der Hauptseite statt eines eigenen Vollbilds.
 *
 * Zwei stille Knöpfe: **«Amen»** (die eine Reaktion – darunter stehen
 * Vornamen, keine Zählstände) und **Merken** für die eigene
 * Favoritensammlung. «Durchgetippt» vermerkt die Seite, sobald alle
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
  /** Vorschau der Redaktion: Amen und Merken leben nur im Fenster. */
  preview?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [previewAmen, setPreviewAmen] = useState(false)
  const [previewFavorite, setPreviewFavorite] = useState(false)

  const uid = profile?.id ?? ''
  const mine = progressDocs.find((progress) => progress.uid === uid)
  const amen = preview ? previewAmen : (mine?.amens?.includes(item.id) ?? false)
  const favorite = preview ? previewFavorite : (mine?.favorites?.includes(item.id) ?? false)

  /** Wer zu dieser Karte «Amen» gesagt hat – Vornamen, alphabetisch. */
  const names = progressDocs
    .filter((progress) => progress.amens?.includes(item.id))
    .map((progress) => progress.firstName || '–')
    .sort((a, b) => a.localeCompare(b, 'de'))

  const toggleAmen = async () => {
    if (preview) {
      setPreviewAmen((value) => !value)
      return
    }
    if (!profile) return
    try {
      await setImpulseAmen({ uid: profile.id, displayName: profile.displayName }, item.id, !amen)
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    }
  }

  const toggleFavorite = async () => {
    if (preview) {
      setPreviewFavorite((value) => !value)
      return
    }
    if (!profile) return
    try {
      await setImpulseFavorite(
        { uid: profile.id, displayName: profile.displayName },
        item.id,
        !favorite,
      )
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht gespeichert werden.')
    }
  }

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

      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => void toggleAmen()}
          aria-pressed={amen}
          className={cn(
            'btn-secondary',
            amen &&
              'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-200',
          )}
        >
          <HandHeart className={cn('size-4', amen && 'fill-current')} aria-hidden />
          Amen
        </button>
        <button
          type="button"
          onClick={() => void toggleFavorite()}
          aria-pressed={favorite}
          className={cn(
            'btn-secondary',
            favorite &&
              'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-200',
          )}
        >
          <Bookmark className={cn('size-4', favorite && 'fill-current')} aria-hidden />
          {favorite ? 'Gemerkt' : 'Merken'}
        </button>
      </div>
      {names.length > 0 && <p className="hint mt-2">Amen von {names.join(', ')}</p>}
    </section>
  )
}
