import { useEffect, useState } from 'react'

/**
 * Aktuelle Zeit als React-State.
 *
 * `Date.now()` direkt im Render aufzurufen macht die Komponente unrein und
 * lässt Ableitungen wie «überfällig» beim Datumswechsel veralten. Dieser Hook
 * liefert stattdessen einen stabilen Wert, der sich in festen Abständen
 * erneuert – standardmässig minütlich, was für Fälligkeiten und Tagesgrenzen
 * genau genug ist.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
