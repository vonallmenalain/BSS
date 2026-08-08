/**
 * Welches Textfeld gerade beschrieben wird – für das Formatierungsmenü.
 *
 * ## Warum es das braucht
 *
 * Das Menü steht nicht am Feld, sondern oben rechts an der Karte: bei den
 * Pendenzen und Traktanden neben dem Pfeil zum Auf- und Zuklappen, in einer
 * Notiz neben dem Kreuz. Das ist der richtige Ort – dort steht auch sonst
 * alles, was den ganzen Eintrag betrifft, und er bleibt gleich, gleichgültig
 * in welchem der Felder gerade geschrieben wird.
 *
 * Nur weiss ein Menü an dieser Stelle nichts vom Feld darunter. Beide sitzen
 * in verschiedenen Ästen des Baums, und ein gemeinsamer Zustand weiter oben
 * hiesse: Jeder Tastendruck zeichnet die ganze Karte neu. Deshalb liegt der
 * Merkzettel hier – ausserhalb von React –, ganz wie bei `lib/writing`.
 *
 * ## Wie es zusammenspielt
 *
 * Jedes Feld meldet sich beim Erscheinen an und beim Verschwinden ab. Wer
 * zuletzt den Fokus hatte, ist das Ziel. **Der Fokus muss dabei im Feld
 * bleiben**: Das Menü verhindert deshalb, dass ein Griff darauf ihn wegnimmt
 * (`onMouseDown` mit `preventDefault`) – sonst wäre die Markierung weg, kaum
 * dass man sie färben wollte, und der Eintrag fiele aus dem Schreib- ins
 * Lesemodus zurück.
 *
 * Geschrieben wird über zwei Wege zugleich: unmittelbar ins Feld (damit
 * Auswahl und Cursor stehen bleiben) und über `onChange` in den Zustand der
 * App (damit gespeichert wird). Denselben Doppelgriff macht die Erwähnung,
 * wenn sie einen Namen einsetzt.
 */

import type { Edit } from './textFormat.ts'

export type FormatField = HTMLInputElement | HTMLTextAreaElement

export interface FormatTarget {
  field: FormatField
  /** Der neue Inhalt geht zusätzlich in den Zustand der App. */
  onChange: (next: string) => void
  /** Wo der Cursor danach steht – für den Merkzettel in `lib/writing`. */
  onCaret?: (start: number, end: number) => void
  /** Nur mehrzeilige Felder kennen eine Aufzählung. */
  multiline?: boolean
}

const targets = new Map<FormatField, FormatTarget>()
const listeners = new Set<() => void>()

let current: FormatField | null = null
/** Läuft, solange ein Feld abgebaut ist – siehe `unregisterFormatTarget()`. */
let forgetting: ReturnType<typeof setTimeout> | null = null

function announce(): void {
  for (const listener of listeners) listener()
}

function keep(): void {
  if (forgetting === null) return
  clearTimeout(forgetting)
  forgetting = null
}

/** Ein Feld ist da und darf formatiert werden. */
export function registerFormatTarget(target: FormatTarget): void {
  targets.set(target.field, target)
  if (document.activeElement === target.field) {
    keep()
    current = target.field
  }
  announce()
}

/**
 * Das Feld ist weg.
 *
 * Wie beim Merkzettel fürs Schreiben wird nicht sofort vergessen: Ein Feld,
 * das die Liste bloss an anderer Stelle wieder aufbaut, ist im selben Zug
 * zurück und meldet sich neu an. Erst wenn nach dem Umbau nichts kommt, ist
 * wirklich niemand mehr da.
 */
export function unregisterFormatTarget(field: FormatField): void {
  targets.delete(field)
  if (current !== field) {
    announce()
    return
  }
  keep()
  forgetting = setTimeout(() => {
    forgetting = null
    if (current === field) {
      current = null
      announce()
    }
  }, 0)
}

/** Hier wird von jetzt an geschrieben. */
export function focusFormatTarget(field: FormatField): void {
  keep()
  if (current === field) return
  current = field
  announce()
}

/** Wer erfahren will, ob ein Feld bereitsteht – für den Zustand des Menüs. */
export function subscribeFormatTarget(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Das Feld, auf das sich das Menü bezieht.
 *
 * `within` grenzt ein: Das Menü einer Karte formatiert nur, was in derselben
 * Karte steht. Ohne das färbte der Griff oben rechts unter Umständen einen
 * Text zwei Einträge weiter unten – dort nämlich, wo zuletzt geschrieben
 * wurde.
 */
export function activeFormatTarget(within?: HTMLElement | null): FormatTarget | null {
  if (!current || !current.isConnected) return null
  if (within && !within.contains(current)) return null
  return targets.get(current) ?? null
}

/** Anfang und Ende der Auswahl im Feld. */
export function selectionOf(target: FormatTarget): { start: number; end: number } {
  const { field } = target
  const length = field.value.length
  return {
    start: field.selectionStart ?? length,
    end: field.selectionEnd ?? length,
  }
}

/**
 * Eine Änderung ins Feld schreiben.
 *
 * Erst ins Feld, dann melden – so wie beim Einsetzen eines erwähnten Namens:
 * Der neue Inhalt steht sofort da, die Auswahl bleibt auf demselben Stück
 * Text, und weil der Wert danach derselbe ist, rührt React das Feld nicht
 * mehr an.
 */
export function applyToField(target: FormatTarget, next: Edit): void {
  const { field } = target
  field.focus()
  field.value = next.text
  field.setSelectionRange(next.start, next.end)
  target.onChange(next.text)
  target.onCaret?.(next.start, next.end)
}
