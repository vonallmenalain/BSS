import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface AppUpdateValue {
  /** Eine neue Fassung der App ist geladen und wartet darauf, übernommen zu werden. */
  needRefresh: boolean
  /** Der Wechsel auf die neue Fassung läuft – gleich lädt die Seite neu. */
  applying: boolean
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

/** So lange darf der Wechsel auf die neue Fassung dauern, bevor der Hinweis wieder bereitsteht. */
const UPDATE_TIMEOUT_MS = 5000

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

  /*
   * Die neue Fassung übernehmen – und danach auf jeden Fall neu laden.
   *
   * Bis anhin ging das über `updateServiceWorker(true)` aus vite-plugin-pwa.
   * Das schickt dem wartenden Service Worker «SKIP_WAITING» und lädt neu,
   * sobald er übernimmt – aber nur, wenn die Seite schon beim Start von
   * einem Service Worker gesteuert war (`isUpdate` in workbox-window). Beim
   * ersten Öffnen der App ist sie das nicht: Der erste Service Worker
   * übernimmt die Seite erst danach (`clientsClaim`). Kam in derselben
   * Sitzung eine neue Fassung, übernahm sie beim Klick zwar, die Seite lud
   * aber nicht neu. Der Hinweis blieb stehen, und jeder weitere Klick ging
   * ins Leere – es wartete ja nichts mehr.
   *
   * Darum lauscht die App selbst auf den Wechsel und lädt in jedem Fall neu.
   * Wartet gar nichts (mehr), etwa weil die neue Fassung schon übernommen
   * hat, wird sofort neu geladen – damit kommt die Seite auf den Stand des
   * Service Workers, der sie steuert. Bleibt der Wechsel aus, steht der
   * Hinweis nach einer Frist wieder bereit, statt eine Schleife aus
   * Neuladen zu riskieren.
   */
  const [applying, setApplying] = useState(false)
  const applyUpdate = useCallback(() => {
    const reload = () => window.location.reload()
    const waiting = registrationRef.current?.waiting
    if (!('serviceWorker' in navigator) || !waiting) {
      reload()
      return
    }
    setApplying(true)
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
    waiting.postMessage({ type: 'SKIP_WAITING' })
    window.setTimeout(() => {
      // Hat der Worker inzwischen übernommen, ohne dass es hier ankam, wird
      // trotzdem neu geladen; wartet er noch, bleibt es beim Hinweis.
      if (registrationRef.current?.waiting !== waiting) reload()
      else setApplying(false)
    }, UPDATE_TIMEOUT_MS)
  }, [])

  const value = useMemo<AppUpdateValue>(
    () => ({
      needRefresh,
      applying,
      applyUpdate,
      dismiss: () => setNeedRefresh(false),
      checkForUpdate,
    }),
    [needRefresh, applying, applyUpdate, setNeedRefresh, checkForUpdate],
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
