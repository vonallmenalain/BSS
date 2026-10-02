/*
 * Die App aufs Telefon legen – auch ohne Konto.
 *
 * Chrome, Edge und Android melden mit `beforeinstallprompt`, dass sich die
 * Seite installieren lässt; das Ereignis lässt sich aufheben und später
 * auslösen, wenn jemand auf «Installieren» tippt. Es kommt früh, oft bevor
 * die Seite steht, die den Knopf zeigt – deshalb lauscht dieses Modul ab
 * dem Start der App (`main.tsx` lädt es) und hebt das Ereignis auf.
 *
 * Abgewöhnt wird dem Browser dabei nichts: Sein eigener Hinweis bleibt, wie
 * er ist. Der Knopf auf dem Putzplan ist ein zweiter Weg dorthin.
 *
 * iPhone und iPad kennen das Ereignis nicht. Dort installiert man über das
 * Teilen-Symbol → «Zum Home-Bildschirm», und die Seite kann nur sagen, wie.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function changed() {
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    deferred = event as BeforeInstallPromptEvent
    changed()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    changed()
  })
}

/** Lässt sich die App jetzt mit einem Knopf installieren? */
export function installPromptAvailable(): boolean {
  return deferred !== null
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Den Dialog des Browsers zeigen. Er lässt sich nur einmal je Ereignis
 * öffnen – danach ist der Knopf weg, bis der Browser wieder eines schickt.
 */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  deferred = null
  changed()
  await event.prompt()
  const choice = await event.userChoice
  return choice.outcome === 'accepted'
}

/** Läuft die Seite als installierte App – vom Startbildschirm aus? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

/**
 * iPhone oder iPad? Das iPad gibt sich als Mac aus – verraten wird es durch
 * den Bildschirm, den man anfassen kann.
 */
export function isIos(): boolean {
  const agent = navigator.userAgent
  return /iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
}

/* ------------------------------------------------------------------ */
/* Das Anschlagbrett, auf dem die installierte App beginnt             */
/* ------------------------------------------------------------------ */

const BOARD_KEY = 'bss-anschlagbrett'

/**
 * Welches Anschlagbrett jemand ohne Konto zuletzt gelesen hat – «/putzplan»
 * oder «/ap».
 *
 * Gebraucht von der installierten App: Ihre Startadresse ist «/», und ohne
 * Konto führte die zur Anmeldung. Wer die App vom Putzplan aus installiert
 * hat, will aber den Putzplan (siehe `RequireAuth` in `App.tsx`). Meist
 * erledigt das schon das eigene Manifest des Putzplans; hier steht die
 * Absicherung für die Browser, die es nicht übernehmen.
 */
export function rememberBoard(path: string) {
  try {
    localStorage.setItem(BOARD_KEY, path)
  } catch {
    // Privates Fenster: Dann beginnt die App eben bei der Anmeldung.
  }
}

export function rememberedBoard(): string | null {
  try {
    const path = localStorage.getItem(BOARD_KEY)
    return path === '/putzplan' || path === '/ap' ? path : null
  } catch {
    return null
  }
}
