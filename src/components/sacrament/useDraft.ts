import { useState } from 'react'

/**
 * Entwurf gegenüber dem Stand in Firestore.
 *
 * Solange nichts bearbeitet wurde, zeigt die Seite direkt die Daten aus
 * Firestore – eine Änderung vom Telefon des Ratgebers erscheint also sofort.
 * Ab der ersten Eingabe übernimmt der Entwurf, bis gespeichert wird.
 *
 * **Warum das mehr ist als lokaler Zustand:** Firestore kennt keine
 * Versionskonflikte. Wer zuletzt schreibt, gewinnt. Bei ganzen Listen
 * – Bekanntmachungen, Angelegenheiten, Musik – hiesse das: Speichert eine
 * zweite Person, während hier noch getippt wird, verschwinden deren Einträge
 * beim nächsten Speichern kommentarlos.
 *
 * Deshalb merkt sich der Entwurf den Stand, auf dem er aufsetzt. Weicht der
 * Server davon ab, meldet `conflict` das – und die Oberfläche kann fragen,
 * statt zu überschreiben.
 */
export interface Draft<T> {
  /** Der anzuzeigende Wert: Entwurf, sonst der Stand aus Firestore. */
  value: T
  /** Es gibt ungespeicherte Änderungen. */
  dirty: boolean
  /** Der Server hat sich geändert, seit dieser Entwurf begonnen wurde. */
  conflict: boolean
  set: (next: T) => void
  /** Entwurf verwerfen – nach dem Speichern oder zugunsten der fremden Fassung. */
  reset: () => void
}

export function useDraft<T>(serverValue: T): Draft<T> {
  const [draft, setDraft] = useState<{ base: string; value: T } | null>(null)

  // Vergleich über den Inhalt, nicht über die Objektidentität: Firestore
  // liefert bei jedem Schnappschuss neue Objekte, auch wenn sich nichts ändert.
  const serverJson = JSON.stringify(serverValue ?? null)

  return {
    value: draft ? draft.value : serverValue,
    dirty: draft !== null,
    conflict: draft !== null && draft.base !== serverJson,
    // Der Ausgangsstand wird beim ersten Tastendruck festgehalten und bleibt
    // danach stehen – er ist der Bezugspunkt für die Konfliktprüfung.
    set: (next: T) => setDraft((current) => ({ base: current?.base ?? serverJson, value: next })),
    reset: () => setDraft(null),
  }
}
