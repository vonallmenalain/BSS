import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

/*
 * Dieselbe Einstellung an zwei Orten.
 *
 * Manche Wahl wird an einer Stelle getroffen und an einer anderen
 * gebraucht – die Darstellung von «Anti Doom» etwa steht in den
 * Anti-Doom-Einstellungen und wirkt in der Hülle der App. `localStorage`
 * allein genügt dafür nicht: Es meldet Änderungen nur an *andere* Tabs,
 * im eigenen bliebe die zweite Stelle auf ihrem alten Stand sitzen.
 *
 * Darum eine kleine Liste von Mithörern je Schlüssel: Wer schreibt, sagt
 * es den übrigen. Der Zustand selbst bleibt Reacts Zustand – hier läuft
 * nur die Nachricht.
 *
 * Der Mithörer ist `setValue` selbst: Diese Funktion bleibt über die
 * ganze Lebenszeit einer Komponente dieselbe und taugt darum zugleich
 * als Empfänger und als Ausweis, an dem die eigene Nachricht erkannt und
 * übersprungen wird.
 */
type Listener = (value: unknown) => void
const listeners = new Map<string, Set<Listener>>()

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

  /* Gespeichert wird ein Wert, gemeldet ein Wert – die Übersetzung in
     `Listener` ist genau das und sonst nichts. */
  const receive = setValue as unknown as Listener

  useEffect(() => {
    const others = listeners.get(key) ?? new Set<Listener>()
    listeners.set(key, others)
    others.add(receive)
    return () => {
      others.delete(receive)
      if (others.size === 0) listeners.delete(key)
    }
  }, [key, receive])

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Privater Modus oder voller Speicher – nicht kritisch.
    }
    listeners.get(key)?.forEach((listener) => {
      if (listener !== receive) listener(value)
    })
  }, [key, value, receive])

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

/**
 * Hell/Dunkel-Umschaltung, die der Systemeinstellung folgen kann.
 *
 * `forced` schlägt die Wahl der App vorübergehend: «Anti Doom» ist von
 * sich aus dunkel (siehe `useImpulseAppearance`). Die Wahl der App bleibt
 * daneben stehen und gilt wieder, sobald man den Bereich verlässt.
 */
export function useTheme(forced?: 'light' | 'dark' | null) {
  const [theme, setTheme] = useLocalStorage<Theme>('bss:theme', 'system')

  /*
   * `useLayoutEffect`: Die Klasse sitzt, bevor das Bild steht. Nach dem
   * Zeichnen gesetzt, blitzte beim Eintritt in «Anti Doom» das helle Bild
   * der App auf, ehe der dunkle Grund des Bereichs kam.
   */
  useLayoutEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const dark = forced
        ? forced === 'dark'
        : theme === 'dark' || (theme === 'system' && media.matches)
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
  }, [theme, forced])

  return [theme, setTheme] as const
}

/** Hell oder dunkel im Bereich «Anti Doom» – dunkel ist der Standard. */
export type ImpulseAppearance = 'dunkel' | 'hell'

/**
 * Die Darstellung des Bereichs «Anti Doom».
 *
 * Der Bereich ist eine App in der App und dunkel gehalten: Er wird abends
 * gelesen, seine Karten stehen im Vollbild, und der dunkle Grund lässt
 * die Farben der Bereiche ruhiger wirken. Wem das nicht liegt, stellt in
 * den Anti-Doom-Einstellungen auf «Hell» – die Wahl merkt sich das Gerät
 * und gilt nur hier; die Darstellung der übrigen App bleibt, wie sie ist.
 *
 * Gelesen wird sie an zwei Orten (Hülle und Einstellungen), darum der
 * gemeinsame Schlüssel oben statt zweier Zustände nebeneinander.
 */
export function useImpulseAppearance() {
  return useLocalStorage<ImpulseAppearance>('bss:anti-doom:darstellung', 'dunkel')
}
