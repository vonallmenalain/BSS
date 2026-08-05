/**
 * Wo gerade geschrieben wird – über einen Neuaufbau der Ansicht hinweg.
 *
 * ## Warum es das braucht
 *
 * Gespeichert wird, während getippt wird: kurz nach dem letzten Tastendruck
 * geht der Eintrag zu Firestore, und Firestore meldet ihn im selben Atemzug
 * als geändert zurück. Für die Liste ist das ein neuer Stand – sie ordnet
 * sich um, ein Eintrag wechselt unter eine andere Tageüberschrift, und React
 * baut ihn an der neuen Stelle **neu** auf. Für den Browser ist das ein
 * anderes Feld: Der Cursor ist weg, und wer weiterschreiben will, muss erst
 * wieder hineinklicken. Mitten im Satz ist das das Ärgerlichste, was eine
 * Sitzungs-App tun kann.
 *
 * Deshalb liegt der Merkzettel hier – ausserhalb von React und damit
 * ausserhalb dessen, was beim Neuaufbau verlorengeht: **welches Feld**
 * beschrieben wird und **wo darin der Cursor** steht. Baut sich dasselbe Feld
 * wieder auf, nimmt es beides auf und schreibt weiter, als wäre nichts
 * gewesen.
 *
 * ## Wie lange er gilt
 *
 * Nur für den Augenblick des Neuaufbaus. Verschwindet ein Feld wirklich – die
 * Zeile wird zugeklappt, die Seite gewechselt –, wird der Merkzettel
 * unmittelbar danach weggeworfen (`releaseWriting`). Kommt das Feld im selben
 * Zug zurück, hält `holdWriting` ihn fest. Beides läuft in
 * `useLayoutEffect` und damit noch im selben Durchgang, in dem React die
 * Oberfläche umbaut – die Lücke dazwischen ist nicht einmal ein Bildaufbau
 * lang.
 *
 * Ein ausdrückliches Verlassen des Feldes (`stopWriting`) wirft ihn sofort
 * weg: Wer weiterklickt, will nicht weiterschreiben.
 *
 * Ein einziger Merkzettel genügt – geschrieben wird immer nur an einer
 * Stelle.
 */

export interface WritingSpot {
  /** Dieselbe `id`, die das Feld im HTML trägt */
  id: string
  /** Anfang und Ende der Auswahl; beim blossen Cursor sind beide gleich */
  start: number
  end: number
}

let spot: WritingSpot | null = null

/** Läuft, solange ein Feld abgebaut ist – siehe `releaseWriting()`. */
let forgetting: ReturnType<typeof setTimeout> | null = null

function keep(): void {
  if (forgetting === null) return
  clearTimeout(forgetting)
  forgetting = null
}

/** Hier wird von jetzt an geschrieben. */
export function startWriting(id: string, start: number, end: number = start): void {
  keep()
  spot = { id, start, end }
}

/**
 * Der Cursor ist weitergewandert.
 *
 * Nur für das Feld, in dem ohnehin geschrieben wird: Ein Feld, das gar nicht
 * beschrieben wird, hat keinen Platz zu merken.
 */
export function noteCaret(id: string, start: number, end: number = start): void {
  if (spot?.id !== id) return
  spot = { id, start, end }
}

/** Hier wird nicht mehr geschrieben – das Feld wurde verlassen. */
export function stopWriting(id: string): void {
  if (spot?.id !== id) return
  keep()
  spot = null
}

/** Wird in diesem Feld geschrieben? */
export function isWriting(id: string): boolean {
  return spot?.id === id
}

/** Wo der Cursor stand – `null`, wenn hier gar nicht geschrieben wird. */
export function caretOf(id: string): WritingSpot | null {
  return spot?.id === id ? spot : null
}

/**
 * Das Feld ist (wieder) da – der Merkzettel gilt weiter.
 *
 * Gehört zu `releaseWriting()`: Wird ein Feld abgebaut und im selben Zug
 * andernorts wieder aufgebaut, hebt dieser Aufruf das Vergessen wieder auf.
 */
export function holdWriting(id: string): void {
  if (spot?.id !== id) return
  keep()
}

/**
 * Das Feld wurde abgebaut.
 *
 * Kommt es nicht im selben Zug zurück, ist der Merkzettel hinfällig. Deshalb
 * wird er nicht sofort weggeworfen, sondern erst, wenn der Umbau der
 * Oberfläche durch ist – bis dahin kann `holdWriting()` ihn zurückholen.
 */
export function releaseWriting(id: string): void {
  if (spot?.id !== id) return
  keep()
  forgetting = setTimeout(() => {
    forgetting = null
    if (spot?.id === id) spot = null
  }, 0)
}
