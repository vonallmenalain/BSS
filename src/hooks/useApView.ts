import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { saveApView } from '@/services/users'
import { DEFAULT_AP_VIEW, type ApView } from '@/lib/types'

/**
 * Wie der Aktivitätenplan dargestellt wird – an zwei Orten gemerkt.
 *
 * Im **Browser**, damit die Wahl sofort und auch ohne Netz stimmt: Sie ist
 * schon da, bevor der erste Schnappschuss aus Firestore eintrifft, und ein
 * Neustart der App beginnt nicht wieder bei der Standardansicht.
 *
 * Am **Konto**, damit sie auf jedem Gerät gilt. Wer den Plan am Laptop als
 * Kacheln eingestellt hat, will ihn am Telefon nicht wieder als Liste.
 *
 * Beim ersten Eintreffen des Profils gewinnt das Konto – es ist der Stand,
 * der zuletzt irgendwo gesetzt wurde. Danach schreibt jede Änderung beides
 * zugleich; das gemerkte Konto folgt also der letzten Wahl und überschreibt
 * sie nicht mehr nachträglich.
 */
export function useApView(): [ApView, (patch: Partial<ApView>) => void] {
  const { profile } = useAuth()
  const [view, setView] = useLocalStorage<ApView>('bss:ap:ansicht', DEFAULT_AP_VIEW)

  /* Einmal übernehmen, danach nie wieder – sonst zöge ein verspäteter
     Schnappschuss die eben getroffene Wahl zurück. */
  const settled = useRef(false)

  useEffect(() => {
    if (settled.current) return
    const stored = profile?.apView
    if (!stored) return
    settled.current = true
    setView((current) => ({ ...current, ...stored }))
  }, [profile?.apView, setView])

  const update = useCallback(
    (patch: Partial<ApView>) => {
      settled.current = true
      const next = { ...view, ...patch }
      setView(next)
      // Ein misslungenes Merken ist kein Fehler, den jemand sehen müsste:
      // Die Ansicht steht bereits, und im Browser ist sie festgehalten.
      if (profile) void saveApView(profile.id, next).catch(() => {})
    },
    [view, profile, setView],
  )

  return [view, update]
}
