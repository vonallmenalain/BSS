import { useEffect, useRef } from 'react'
import { impulseFirstName } from '@/lib/impulse'
import type { ImpulseComment, ImpulseProgress } from '@/lib/types'
import { syncImpulseFirstName } from '@/services/impulse'

/**
 * Führt den eigenen Vornamen in «Anti Doom» nach, sobald er nicht mehr zum
 * Profil passt (siehe `syncImpulseFirstName`).
 *
 * Gelesen wird der Stand, wie er gespeichert ist (`stored` der Hooks) –
 * nicht der für die Anzeige schon angeglichene. Nur wer bereits einen
 * Fortschritt hat, bekommt einen nachgeführt; sonst legt erst der erste
 * eigene Schritt ihn an. Ein Versuch je Name und Sitzung: Scheitert das
 * Schreiben, bleibt es bis zum nächsten Öffnen beim alten Namen.
 */
export function useImpulseNameSync({
  profile,
  progress,
  comments,
  enabled,
}: {
  profile: { id: string; displayName: string } | null
  progress: ImpulseProgress[]
  comments: ImpulseComment[]
  enabled: boolean
}) {
  const uid = profile?.id ?? ''
  const name = profile ? impulseFirstName(profile.displayName) : ''
  const own = progress.find((entry) => entry.uid === uid)
  const staleComments = comments
    .filter(
      (comment) =>
        comment.uid === uid &&
        !comment.anonymous &&
        comment.firstName &&
        comment.firstName !== name,
    )
    .map((comment) => comment.id)
  const stale = Boolean(own && own.firstName !== name) || staleComments.length > 0
  const key = stale ? `${uid}|${name}|${staleComments.join(',')}` : null
  const tried = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !profile || !key || tried.current === key) return
    tried.current = key
    syncImpulseFirstName(
      { uid: profile.id, displayName: profile.displayName },
      staleComments,
    ).catch((error: unknown) =>
      console.warn('[anti-doom] Vorname liess sich nicht nachführen:', error),
    )
  }, [enabled, profile, key, staleComments])
}
