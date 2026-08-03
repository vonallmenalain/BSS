import { useCallback, useEffect, useRef, useState } from 'react'

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
  /**
   * Den Ausgangsstand auf den aktuellen Serverstand nachziehen, ohne den
   * Entwurf anzutasten – nach einem eigenen Schreibvorgang.
   */
  rebase: () => void
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
    rebase: () =>
      setDraft((current) =>
        current && current.base !== serverJson ? { ...current, base: serverJson } : current,
      ),
  }
}

/* ------------------------------------------------------------------ */
/* Entwurf, der sich selbst speichert                                  */
/* ------------------------------------------------------------------ */

export interface AutoDraft<T> extends Draft<T> {
  /** Ein Schreibvorgang läuft gerade. */
  saving: boolean
  /** Anstehende Änderung sofort schreiben, ohne die Pause abzuwarten. */
  flush: () => Promise<void>
}

/**
 * Entwurf, der kurz nach der letzten Eingabe von selbst speichert.
 *
 * Wer eine Bekanntmachung eintippt, soll nicht daran denken müssen, danach
 * noch auf «Speichern» zu drücken. Geschrieben wird deshalb nach einer kurzen
 * Tippause – und spätestens, wenn die Seite verlassen wird oder der Browser
 * in den Hintergrund geht. Firestore hält die Änderung ohnehin sofort lokal
 * fest, ein abrupt geschlossener Deckel kostet also nichts.
 *
 * Die Konfliktprüfung aus `useDraft` bleibt erhalten; sie greift jetzt nur
 * noch für die Sekunde zwischen Eingabe und Schreibvorgang.
 */
export function useAutoDraft<T>(
  serverValue: T,
  save: (value: T) => Promise<unknown>,
  options: { delay?: number; onError?: (error: unknown) => void } = {},
): AutoDraft<T> {
  const { delay = 700, onError } = options
  const draft = useDraft(serverValue)
  const [saving, setSaving] = useState(false)
  /** Was zuletzt geschrieben wurde – daran ist der eigene Schnappschuss zu erkennen. */
  const [written, setWritten] = useState<string | null>(null)

  /*
   * Alles Veränderliche liegt in Refs: Der Aufräumer beim Verlassen der Seite
   * läuft genau einmal und sähe sonst den Stand vom ersten Rendern statt den
   * letzten Tastendruck.
   */
  const pending = useRef<{ value: T } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ save, onError, reset: draft.reset, set: draft.set, rebase: draft.rebase })

  useEffect(() => {
    latest.current = { save, onError, reset: draft.reset, set: draft.set, rebase: draft.rebase }
  })

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const waiting = pending.current
    if (!waiting) return
    pending.current = null

    setSaving(true)
    setWritten(JSON.stringify(waiting.value))
    try {
      await latest.current.save(waiting.value)
      // Nur zurücksetzen, wenn zwischenzeitlich nichts Neues getippt wurde –
      // sonst überschriebe der Serverstand die frischere Eingabe.
      if (!pending.current) latest.current.reset()
      // Wer weitertippt, behält seinen Entwurf – aber auf dem eben
      // geschriebenen Stand. Bliebe der alte Ausgangsstand stehen, käme der
      // eigene Schreibvorgang beim nächsten Schnappschuss als fremde
      // Änderung zurück.
      else latest.current.rebase()
    } catch (error) {
      // Der Entwurf bleibt bestehen und wird beim nächsten Anlauf erneut
      // versucht; verloren geht dadurch nichts.
      pending.current = waiting
      console.error(error)
      latest.current.onError?.(error)
    } finally {
      setSaving(false)
    }
  }, [])

  const set = useCallback(
    (next: T) => {
      pending.current = { value: next }
      latest.current.set(next)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delay)
    },
    [delay, flush],
  )

  useEffect(() => {
    const hide = () => void flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', hide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', hide)
      void flush()
    }
  }, [flush])

  /*
   * Der eigene Schreibvorgang ist keine fremde Änderung.
   *
   * Firestore hält ihn sofort lokal fest und meldet ihn als Schnappschuss
   * zurück, lange bevor der Server bestätigt. Für den Entwurf sah das aus wie
   * eine fremde Fassung: Bei jeder Eingabe blitzte die Konfliktmeldung einen
   * Sekundenbruchteil auf und schob die ganze Seite an – erst nach unten, dann
   * wieder nach oben. Solange geschrieben wird und solange der Serverstand
   * genau dem Geschriebenen entspricht, gilt deshalb kein Konflikt. Eine
   * fremde Änderung weicht davon ab und wird weiterhin gemeldet.
   */
  const ownWrite = written !== null && written === JSON.stringify(serverValue ?? null)

  return {
    ...draft,
    conflict: draft.conflict && !saving && !ownWrite,
    set,
    reset: () => {
      pending.current = null
      setWritten(null)
      if (timer.current) clearTimeout(timer.current)
      draft.reset()
    },
    saving,
    flush,
  }
}
