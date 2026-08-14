import { useState } from 'react'
import { Bookmark, HandHeart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { setImpulseAmen, setImpulseFavorite } from '@/services/impulse'
import type { ImpulseItem, ImpulseProgress } from '@/lib/types'

/**
 * «Amen» und «Merken» – die beiden stillen Knöpfe jeder Karte.
 *
 * Lange gehörten sie allein der Feed-Karte; jetzt trägt sie jede Karte
 * des Stapels (Wochenthema, Quiz, Bilderrätsel, Frage, Feed, Teilen):
 * **«Amen»** ist die eine Reaktion – darunter stehen Vornamen, keine
 * Zählstände –, **Merken** legt die Karte in die eigene
 * Favoritensammlung. Beides hängt am Inhalt, nicht an der Woche, und
 * bleibt darum auch im Rückblick lebendig.
 *
 * Im Vorschau-Modus (`preview`) leben beide Knöpfe nur im Fenster –
 * gespeichert wird nichts, genau wie der Rest der Vorschau verspricht.
 */
export function ImpulseCardActions({
  item,
  progressDocs,
  preview = false,
  centered = true,
}: {
  item: ImpulseItem
  progressDocs: ImpulseProgress[]
  preview?: boolean
  /** Mittig (Feed, Wochenthema) oder linksbündig (Quiz, Frage & Co.). */
  centered?: boolean
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

  const CARD_ACTION =
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition select-none active:scale-[0.98]'
  const CARD_ACTION_OFF =
    'bg-slate-900/[0.06] text-slate-700 hover:bg-slate-900/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15'
  const CARD_ACTION_ON =
    'bg-brand-600/15 text-brand-800 hover:bg-brand-600/20 dark:bg-brand-400/20 dark:text-brand-100'

  return (
    <>
      {/* Zwei stille Knöpfe ohne Rahmen: Seit die Karten ohne Kachel
          dastehen, wäre ein Strich um sie herum der einzige im Bild.
          Eine getönte Fläche genügt – gedrückt trägt sie die Markenfarbe. */}
      <div className={cn('mt-5 flex gap-2', centered ? 'justify-center' : 'justify-start')}>
        <button
          type="button"
          onClick={() => void toggleAmen()}
          aria-pressed={amen}
          className={cn(CARD_ACTION, amen ? CARD_ACTION_ON : CARD_ACTION_OFF)}
        >
          <HandHeart className={cn('size-4', amen && 'fill-current')} aria-hidden />
          Amen
        </button>
        <button
          type="button"
          onClick={() => void toggleFavorite()}
          aria-pressed={favorite}
          className={cn(CARD_ACTION, favorite ? CARD_ACTION_ON : CARD_ACTION_OFF)}
        >
          <Bookmark className={cn('size-4', favorite && 'fill-current')} aria-hidden />
          {favorite ? 'Gemerkt' : 'Merken'}
        </button>
      </div>
      {names.length > 0 && (
        <p className={cn('hint mt-2', centered && 'text-center')}>Amen von {names.join(', ')}</p>
      )}
    </>
  )
}
