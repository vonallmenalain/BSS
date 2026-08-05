import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'ruht' | 'speichert' | 'gespeichert' | 'fehler'

export interface Autosave {
  state: SaveState
  /** Sofort speichern, ohne die Pause abzuwarten. */
  flush: () => void
  /** Nichts mehr speichern – etwa, weil der Datensatz gerade gelöscht wurde. */
  stop: () => void
}

/**
 * Speichert von selbst: nach einer Pause, beim Weglegen des Geräts und beim
 * Schliessen.
 *
 * Ein Speichern-Knopf ist die einzige Stelle, an der sich Geschriebenes
 * verlieren lässt – und auf dem Handy die wahrscheinlichste, weil ein Anruf
 * oder ein Wisch die Ansicht wegnimmt, bevor man ihn trifft.
 *
 * `delayMs` sagt, wie lange nach dem letzten Tastendruck gewartet wird. Kurz
 * ist gut, wo eine Änderung sofort feststehen soll; lang ist besser, wo
 * jemand längere Texte schreibt und der Rückweg aus Firestore die Ansicht
 * neu zeichnet – dort ruft der Aufrufer `flush()`, sobald das Feld verlassen
 * wird (siehe `components/agenda/AgendaItemEditor`).
 *
 * Zwei Dinge zählen dabei:
 *
 *  - Läuft schon ein Schreibvorgang, wird kein zweiter danebengestartet,
 *    sondern gleich danach nachgezogen. Sonst käme der ältere Stand als
 *    letzter an – oder beim ersten Mal entstünde ein zweiter Datensatz.
 *  - Geschrieben wird nur, was vom Stand beim Öffnen abweicht. Ohne diese
 *    Bremse schriebe schon das Öffnen jeden Datensatz unverändert zurück, und
 *    «zuletzt bearbeitet» hielte fest, was jemand angeschaut hat statt was er
 *    geändert hat.
 *
 * Der Entwurf unter «Leitung» (`useAutoDraft`) tut Verwandtes, löst aber eine
 * andere Aufgabe: Dort wird ein Firestore-Dokument mitgeschrieben, das mehrere
 * Personen zugleich ändern. Hier gehört der Stand einem einzigen Fenster.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  options: {
    /** Ob sich der aktuelle Stand überhaupt speichern lässt. */
    savable?: (value: T) => boolean
    delayMs?: number
  } = {},
): Autosave {
  const { savable, delayMs = 900 } = options
  const [state, setState] = useState<SaveState>('ruht')

  /*
   * Alles Veränderliche liegt in Refs und wird beim Rendern nachgeführt: Das
   * Speichern zum Schluss läuft, wenn die Komponente nicht mehr zeichnet, und
   * sähe sonst den Stand vom ersten Rendern statt den letzten Tastendruck.
   */
  const latest = useRef({ value, save, savable })
  const dirty = useRef(false)
  const running = useRef(false)
  const stopped = useRef(false)

  useEffect(() => {
    latest.current = { value, save, savable }
  })

  const run = useCallback(async () => {
    if (stopped.current || running.current) return
    running.current = true

    try {
      // Die Schleife zieht nach, was während des Schreibens dazugekommen ist.
      // Zwei Schreibvorgänge nebeneinander gingen nicht: Der ältere käme
      // womöglich als letzter an – oder beim ersten Mal entstünde ein zweiter
      // Datensatz.
      while (dirty.current && !stopped.current) {
        const { value, save, savable } = latest.current
        if (savable && !savable(value)) break

        dirty.current = false
        setState('speichert')
        try {
          await save(value)
          setState('gespeichert')
        } catch (error) {
          // Der Stand bleibt als ungeschrieben vermerkt und wird beim nächsten
          // Anlauf erneut versucht; verloren geht dadurch nichts.
          console.error(error)
          dirty.current = true
          setState('fehler')
          break
        }
      }
    } finally {
      running.current = false
    }
  }, [])

  // Der Vergleich läuft über den Inhalt, nicht über die Objektidentität: Ein
  // Objekt ist bei jedem Rendern ein neues, der Text darin aber meist derselbe.
  const signature = JSON.stringify(value)
  const opened = useRef(signature)

  useEffect(() => {
    // Verglichen wird gegen den Stand beim Öffnen, nicht gegen «schon einmal
    // hier gewesen»: Wer eine Änderung wieder rückgängig macht, hat nichts
    // geändert und soll auch nichts schreiben.
    if (signature === opened.current) return

    dirty.current = true
    const timer = setTimeout(() => void run(), delayMs)
    return () => clearTimeout(timer)
  }, [signature, delayMs, run])

  // Beim Schliessen – auch über die Zurück-Geste – das Angefangene sichern.
  useEffect(() => () => void run(), [run])

  /*
   * Und beim Weglegen des Geräts.
   *
   * Wer am Telefon die App wechselt, kommt womöglich nie mehr zurück: Der
   * Browser räumt den Tab weg, und die Aufräumarbeit oben läuft dann nicht
   * mehr. `visibilitychange` ist der einzige Zeitpunkt, auf den dabei Verlass
   * ist – und er stört niemanden, denn zu sehen ist die Seite gerade nicht.
   */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void run()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [run])

  return {
    state,
    flush: () => void run(),
    stop: () => {
      stopped.current = true
      dirty.current = false
    },
  }
}

/** Was im Fenster steht, solange gespeichert wird. */
export function saveStateLabel(state: SaveState, hint?: string): string {
  if (hint) return hint
  if (state === 'speichert') return 'Speichert …'
  if (state === 'fehler') return 'Nicht gespeichert'
  if (state === 'gespeichert') return 'Gespeichert'
  return 'Wird laufend gespeichert'
}
