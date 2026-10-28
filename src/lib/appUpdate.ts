import { registerSW } from 'virtual:pwa-register'
import { APP_VERSION, isAppVersion } from '@/lib/appVersion'

/**
 * Hält die App von selbst auf der neuesten Fassung – ohne Hinweis und ohne
 * Knopf.
 *
 * Bis anhin meldete sich eine neue Fassung mit «Eine neue Version ist
 * verfügbar», und bis jemand «Aktualisieren» antippte, lieferte der Service
 * Worker die alte aus dem Cache – auch nach mehrmaligem Neuladen, auf manchen
 * Geräten tagelang. Wer sich in dieser Lage registrierte, bekam ein Konto
 * nach den Regeln der alten Fassung. Das soll nicht mehr vorkommen. Darum
 * drei Sicherungen, jede für sich genügend:
 *
 *  1. **Seitenaufrufe gehen ans Netz** (siehe `vite.config.ts`). Wer die App
 *     öffnet oder neu lädt, bekommt die `index.html` vom Server und damit die
 *     neueste Fassung. Die gespeicherte springt nur ohne Verbindung ein.
 *  2. **Der Service Worker übernimmt sofort** (`autoUpdate`) – ein neuer
 *     wartet nicht mehr, bis ihn jemand freigibt.
 *  3. **Die App vergleicht ihre Fassung mit `/version.json`** – beim Start,
 *     wenn sie wieder in den Vordergrund kommt, und alle paar Minuten.
 *     Liefert der Server eine andere, lädt sie neu. Kommt sie nach dem
 *     Neuladen trotzdem nicht an, räumt sie Service Worker und Caches ganz
 *     weg und lädt noch einmal – lieber einmal mehr neu laden als eine alte
 *     Fassung zeigen.
 *
 * Neu geladen wird in einem Moment, in dem es niemand merkt und nichts
 * verloren geht: gleich beim Start, wenn die App nach einer Weile wieder in
 * den Vordergrund kommt, oder beim Wechsel in einen anderen Bereich – und
 * nie, solange ein Dialog offen ist oder jemand in einem Feld schreibt
 * (`busy`). Dann wartet die neue Fassung auf den nächsten solchen Moment.
 */

/** Wie oft im Vordergrund nachgefragt wird. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000
/** Mindestabstand zwischen zwei Nachfragen, die nicht ausdrücklich verlangt sind. */
const CHECK_GAP_MS = 10 * 1000
/** So lange gilt die App als «gerade gestartet» – eine neue Fassung kommt dann sofort. */
const STARTUP_MS = 15 * 1000
/** So lange muss die App im Hintergrund gewesen sein, damit die Rückkehr neu laden darf. */
const AWAY_MS = 30 * 1000
/** Wie oft für dieselbe Fassung neu geladen wird, bevor die App aufgibt (keine Schleife). */
const MAX_ATTEMPTS = 3
/** Nach dieser Zeit beginnt die Zählung der Versuche von vorn. */
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const ATTEMPTS_KEY = 'bss:update-attempts'

let started = false
let registration: ServiceWorkerRegistration | undefined
/** Die neuere Fassung auf dem Server, sobald eine gefunden ist. */
let pending: string | null = null
let lastCheck = 0
let hiddenSince: number | null = null

/** Neu laden würde jetzt etwas wegnehmen: ein offener Dialog oder ein Feld, in dem jemand schreibt. */
function busy(): boolean {
  if (document.querySelector('[aria-modal="true"], dialog[open]')) return true
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  if (active.isContentEditable || active instanceof HTMLTextAreaElement) return true
  if (active instanceof HTMLSelectElement) return true
  return (
    active instanceof HTMLInputElement &&
    !['button', 'checkbox', 'radio', 'range', 'reset', 'submit', 'color', 'file'].includes(
      active.type,
    )
  )
}

interface Attempts {
  target: string
  count: number
  at: number
}

function readAttempts(): Attempts | null {
  try {
    const raw = sessionStorage.getItem(ATTEMPTS_KEY)
    return raw ? (JSON.parse(raw) as Attempts) : null
  } catch {
    return null
  }
}

function writeAttempts(attempts: Attempts | null) {
  try {
    if (attempts) sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))
    else sessionStorage.removeItem(ATTEMPTS_KEY)
  } catch {
    // Ohne Sitzungsspeicher fehlt nur die Bremse gegen eine Schleife.
  }
}

/** Service Worker abmelden und alle Caches leeren – der letzte Ausweg. */
async function clearOfflineCopy() {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((registrations ?? []).map((r) => r.unregister()))
  } catch (error) {
    console.warn('[update] Service Worker liess sich nicht abmelden:', error)
  }
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch (error) {
    console.warn('[update] Caches liessen sich nicht leeren:', error)
  }
}

/**
 * Auf die Fassung `target` wechseln.
 *
 * Der erste Versuch ist ein gewöhnliches Neuladen – die Seite kommt vom
 * Server. Steht danach immer noch die alte Fassung da, kam die Seite aus
 * einem Cache; dann wird alles Gespeicherte weggeräumt. Nach `MAX_ATTEMPTS`
 * Versuchen für dieselbe Fassung hört die App auf, statt endlos neu zu laden.
 */
async function reloadTo(target: string): Promise<boolean> {
  const previous = readAttempts()
  const fresh =
    !previous || previous.target !== target || Date.now() - previous.at > ATTEMPT_WINDOW_MS
  const count = fresh ? 1 : previous.count + 1
  if (count > MAX_ATTEMPTS) {
    console.warn(`[update] Fassung ${target} kommt nach ${MAX_ATTEMPTS} Versuchen nicht an.`)
    return false
  }
  writeAttempts({ target, count, at: Date.now() })
  if (count > 1) await clearOfflineCopy()
  window.location.reload()
  return true
}

/** Eine gefundene neue Fassung übernehmen, wenn gerade nichts dagegen spricht. */
function applyIfIdle(): boolean {
  if (!pending || busy()) return false
  void reloadTo(pending)
  return true
}

/**
 * Beim Server nachfragen, welche Fassung er ausliefert.
 *
 * `true`, wenn sie sich von der laufenden unterscheidet – sie ist dann als
 * `pending` vorgemerkt, und der Service Worker holt sie im Hintergrund.
 */
async function fetchNewer(force: boolean): Promise<boolean> {
  if (import.meta.env.DEV) return false
  if (!force && Date.now() - lastCheck < CHECK_GAP_MS) return pending !== null
  lastCheck = Date.now()
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return pending !== null
    const server: unknown = await response.json()
    if (!isAppVersion(server)) return pending !== null
    if (server.id === APP_VERSION.id) {
      pending = null
      writeAttempts(null)
      return false
    }
    pending = server.id
  } catch {
    // Ohne Verbindung gibt es nichts nachzuschauen.
    return pending !== null
  }
  // Den Service Worker gleich mitziehen, damit auch der Rückfall ohne
  // Verbindung die neue Fassung kennt.
  registration?.update().catch(() => {})
  return true
}

/**
 * Nach einer neuen Fassung fragen und sie sofort laden.
 *
 * Für ausdrückliche Anlässe – etwa «Neu prüfen» im Wartebereich. `true`,
 * wenn eine neue Fassung gefunden wurde und die Seite gleich neu lädt.
 */
export async function checkForUpdate(): Promise<boolean> {
  if (!(await fetchNewer(true)) || !pending) return false
  return reloadTo(pending)
}

/**
 * Beim Wechsel in einen anderen Bereich: Liegt eine neue Fassung bereit,
 * wird die neue Seite gleich mit ihr geladen (siehe `useUpdateOnNavigation`).
 */
export function applyPendingUpdate() {
  if (pending) applyIfIdle()
  else void fetchNewer(false).then((found) => found && applyIfIdle())
}

/** Einmal beim Start der App: Service Worker anmelden und die Wächter aufstellen. */
export function startAppUpdates() {
  if (started || typeof window === 'undefined') return
  started = true

  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registration = r
    },
    // Ein neuer Service Worker hat übernommen. Ob die Seite neu laden muss,
    // entscheidet der Vergleich mit dem Server – meist läuft die neue
    // Fassung längst, weil die Seite selbst schon vom Netz kam.
    onNeedReload() {
      void fetchNewer(true).then((found) => found && applyIfIdle())
    },
    onRegisterError(error) {
      console.warn('[pwa] Service Worker konnte nicht registriert werden:', error)
    },
  })

  // Beim Start: Kam die Seite doch aus einem Cache, gleich die neue holen.
  void fetchNewer(true).then((found) => {
    if (found && performance.now() < STARTUP_MS) applyIfIdle()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenSince = Date.now()
      return
    }
    const away = hiddenSince !== null && Date.now() - hiddenSince >= AWAY_MS
    hiddenSince = null
    void fetchNewer(away).then((found) => found && away && applyIfIdle())
  })
  window.addEventListener('online', () => void fetchNewer(true))
  window.addEventListener('focus', () => void fetchNewer(false))
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void fetchNewer(false)
  }, CHECK_INTERVAL_MS)

  /*
   * Ein Teil der App liess sich nicht nachladen – meist, weil eine neue
   * Fassung die Dateien der alten ersetzt hat, während diese noch offen war.
   * Dann hilft nur die neue Fassung.
   */
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    void fetchNewer(true).then(() => reloadTo(pending ?? `nachladen:${APP_VERSION.id}`))
  })
}
