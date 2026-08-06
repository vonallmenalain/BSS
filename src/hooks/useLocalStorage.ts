import { useCallback, useEffect, useState } from 'react'

/**
 * Zustand, der einen Reload übersteht – für Ansichtseinstellungen wie
 * Sortierung, Filter oder Dark-Mode. Nicht für Daten verwenden.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Privater Modus oder voller Speicher – nicht kritisch.
    }
  }, [key, value])

  const reset = useCallback(() => setValue(initialValue), [initialValue])

  return [value, setValue, reset] as const
}

/** Zeigt an, ob das Gerät gerade online ist. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

type Theme = 'light' | 'dark' | 'system'

/** Hell/Dunkel-Umschaltung, die der Systemeinstellung folgen kann. */
export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>('bss:theme', 'system')

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', dark)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0f172a' : '#1e3a5f')
    }

    /*
     * Gedruckt wird immer hell.
     *
     * Papier ist weiss: Die dunkle Darstellung ergäbe helle Schrift auf
     * hellem Grund, und vom Ausdruck bliebe wenig übrig. Der Browser
     * meldet den Druck an, bevor er die Seiten setzt; danach kommt die
     * gewählte Darstellung von selbst zurück.
     */
    const beforePrint = () => root.classList.remove('dark')

    apply()
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', apply)
    if (theme === 'system') media.addEventListener('change', apply)

    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', apply)
      media.removeEventListener('change', apply)
    }
  }, [theme])

  return [theme, setTheme] as const
}
