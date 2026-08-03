/**
 * Schreiben, das ohne Netz nicht hängen bleibt.
 *
 * Firestore schreibt eine Änderung **sofort** in den lokalen Zwischenspeicher
 * und stellt sie zu; das Versprechen aus `setDoc()`, `updateDoc()` und Co.
 * löst sich aber erst auf, wenn der Server bestätigt hat. Ohne Netz bleibt es
 * damit offen – die Oberfläche wartete früher endlos auf «gespeichert»,
 * obwohl die Daten längst sicher lagen.
 *
 * `commit()` dreht das um: Es wartet kurz auf die Bestätigung und meldet
 * sonst «zwischengespeichert». Die Änderung ist in beiden Fällen sicher –
 * Firestore hält sie in IndexedDB und überträgt sie, sobald wieder Verbindung
 * besteht, auch über einen Neustart der App hinweg.
 */

export type SaveOutcome =
  /** Der Server hat bestätigt. */
  | 'synced'
  /** Lokal gespeichert und in der Warteschlange – wird später übertragen. */
  | 'queued'

/**
 * Wie lange auf die Server-Bestätigung gewartet wird, bevor der Schreibvorgang
 * als «unterwegs» gilt. Bei bestehender Verbindung antwortet Firestore in
 * deutlich unter einer Sekunde; die Wartezeit greift nur bei schlechtem Empfang.
 */
const GRACE_MS = 2000

/* ------------------------------------------------------------------ */
/* Offene Schreibvorgänge                                              */
/* ------------------------------------------------------------------ */

let pending = 0
const pendingListeners = new Set<(count: number) => void>()

function setPending(next: number) {
  pending = next
  pendingListeners.forEach((listener) => listener(pending))
}

/** Anzahl Änderungen, die noch auf die Übertragung warten. */
export function pendingWrites(): number {
  return pending
}

/** Meldet sich bei jeder Änderung der Warteschlange. Gibt die Abmeldung zurück. */
export function subscribePendingWrites(listener: (count: number) => void): () => void {
  pendingListeners.add(listener)
  return () => {
    pendingListeners.delete(listener)
  }
}

/* ------------------------------------------------------------------ */
/* Später auftretende Fehler                                           */
/* ------------------------------------------------------------------ */

type FailureReporter = (error: unknown) => void
let reportFailure: FailureReporter | null = null

/**
 * Hinterlegt, wie ein Fehler gemeldet wird, der erst bei der Übertragung
 * auftritt – etwa wenn die Zugriffsregeln eine zwischengespeicherte Änderung
 * ablehnen. Ohne diesen Weg bliebe so ein Fehler unsichtbar.
 */
export function setSyncFailureReporter(reporter: FailureReporter | null): void {
  reportFailure = reporter
}

/* ------------------------------------------------------------------ */
/* Schreiben                                                           */
/* ------------------------------------------------------------------ */

/**
 * Führt einen Firestore-Schreibvorgang aus und wartet höchstens kurz auf die
 * Bestätigung.
 *
 * - `synced` – der Server hat bestätigt.
 * - `queued` – lokal gespeichert, Übertragung folgt.
 *
 * Wirft nur, wenn der Schreibvorgang **sofort** scheitert; dann liegt ein
 * echter Fehler vor (fehlende Berechtigung, ungültige Daten). Scheitert er
 * erst später bei der Übertragung, geht die Meldung an
 * `setSyncFailureReporter()` – der aufrufende Code hat da längst weitergemacht.
 */
export function commit<T>(write: Promise<T>): Promise<SaveOutcome> {
  return new Promise<SaveOutcome>((resolve, reject) => {
    let settled = false

    const markQueued = () => {
      if (settled) return
      settled = true

      setPending(pending + 1)
      // Die Zählung endet, sobald der Schreibvorgang tatsächlich durch ist –
      // ob erfolgreich oder nicht, spielt für die Warteschlange keine Rolle.
      const done = () => setPending(Math.max(0, pending - 1))
      void write.then(done, done)

      resolve('queued')
    }

    // Ohne Netz braucht es kein Warten: Die Bestätigung kann gar nicht kommen.
    const timer = window.setTimeout(markQueued, navigator.onLine ? GRACE_MS : 0)

    write.then(
      () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve('synced')
      },
      (error) => {
        if (settled) {
          // Zu spät für den Aufrufer – aber der Fehler darf nicht verschwinden.
          reportFailure?.(error)
          return
        }
        settled = true
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Für Massenschreibvorgänge (Mitglieder- und Liederimport).
 *
 * Hunderte Dokumente in die Warteschlange zu legen ist keine gute Idee: Der
 * Fortschritt liesse sich nicht ehrlich anzeigen, und ein abgelehnter Import
 * fiele erst Stunden später auf. Deshalb verlangen diese Wege eine Verbindung.
 */
export function requireOnline(): void {
  if (!navigator.onLine) {
    throw new Error(
      'Dafür braucht es eine Internetverbindung. Versuche es erneut, sobald du wieder online bist.',
    )
  }
}
