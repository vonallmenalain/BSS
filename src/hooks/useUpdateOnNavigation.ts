import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { applyPendingUpdate } from '@/lib/appUpdate'

/**
 * Wechselt jemand in einen anderen Bereich, kommt eine bereitliegende neue
 * Fassung gleich mit (siehe `lib/appUpdate`).
 *
 * Gezählt wird nur der Bereich – der erste Teil der Adresse. Innerhalb eines
 * Bereichs bleibt die Seite stehen: In «Anti Doom» etwa wechselt die Adresse
 * mit jeder Karte, und dort soll die Position im Stapel nicht verloren gehen.
 * Vom Anmelden kommend ebenfalls nicht – dort legt die App gerade das
 * Profil an.
 */
export function useUpdateOnNavigation() {
  const { pathname } = useLocation()
  const area = pathname.split('/')[1] ?? ''
  const previous = useRef(area)

  useEffect(() => {
    const from = previous.current
    if (from === area) return
    previous.current = area
    if (from === 'anmelden') return
    applyPendingUpdate()
  }, [area])
}
