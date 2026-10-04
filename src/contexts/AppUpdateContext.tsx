import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface AppUpdateValue {
  /** Eine neue Fassung der App ist geladen und wartet darauf, übernommen zu werden. */
  needRefresh: boolean
  /** Die wartende Fassung übernehmen – die Seite lädt dabei neu. */
  applyUpdate: () => void
  /** Den Hinweis für diese Sitzung wegklicken. */
  dismiss: () => void
  /**
   * Beim Server nachfragen, ob es eine neue Fassung gibt.
   *
   * `true`, wenn eine unterwegs ist oder schon wartet – sie meldet sich
   * dann über `needRefresh`, sobald sie bereitliegt.
   */
  checkForUpdate: () => Promise<boolean>
}

const AppUpdateContext = createContext<AppUpdateValue | undefined>(undefined)

/**
 * Der Service Worker der App – registriert an der Wurzel, nicht im Layout.
 *
 * Neue Fassungen werden nicht ungefragt geladen: Mitten in der Sitzung soll
 * die App nicht neu starten und Eingaben verlieren. Bis anhin hing deshalb
 * alles am Hinweis «Eine neue Version ist verfügbar» – und der stand im
 * Layout. Wer vor dem Layout stehen blieb, etwa im Wartebereich, bekam die
 * neue Fassung nie angeboten. Ausgerechnet dort kann sie aber den Unterschied
 * machen: Eine Rolle, die neuer ist als die App auf dem Gerät, lässt sich nur
 * mit der neuen Fassung öffnen. Darum steht die Registrierung hier, und
 * `UpdatePrompt` wie der Wartebereich fragen sie ab.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration
      // Stündlich nach einer neuen Fassung schauen.
      if (registration) {
        setInterval(() => void registration.update(), 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.warn('[pwa] Service Worker konnte nicht registriert werden:', error)
    },
  })

  const checkForUpdate = useCallback(async () => {
    const registration = registrationRef.current
    if (!registration) return false
    try {
      await registration.update()
    } catch (error) {
      console.warn('[pwa] Nach einer neuen Fassung zu fragen ist fehlgeschlagen:', error)
      return false
    }
    return Boolean(registration.installing || registration.waiting)
  }, [])

  const value = useMemo<AppUpdateValue>(
    () => ({
      needRefresh,
      applyUpdate: () => void updateServiceWorker(true),
      dismiss: () => setNeedRefresh(false),
      checkForUpdate,
    }),
    [needRefresh, updateServiceWorker, setNeedRefresh, checkForUpdate],
  )

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppUpdate(): AppUpdateValue {
  const context = useContext(AppUpdateContext)
  if (!context)
    throw new Error('useAppUpdate muss innerhalb von <AppUpdateProvider> verwendet werden.')
  return context
}
