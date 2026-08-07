// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { parsePastedDirectory, type PastedPerson } from './importPaste.ts'
import type { SinglesKind } from '../lib/types.ts'

/**
 * Die beiden Listen der Alleinstehenden aus «Hilfsmittel für Führungsbeamte
 * und Sekretäre» (LCR) als Text einlesen.
 *
 * Ob jemand verheiratet ist, steht in dieser App nirgends – und soll es auch
 * nicht: Es ist eine Angabe, die sich ändert, ohne dass es jemand meldet, und
 * die niemand hier pflegen möchte. Das LCR weiss es und führt daraus zwei
 * Listen: **Junger Alleinstehender Erwachsener** und **Alleinstehende
 * Erwachsene**. Beide lassen sich markieren und kopieren, und genau das ist
 * der Weg hierher.
 *
 * **Gelesen wird mit demselben Parser wie das Mitgliederverzeichnis.** Beide
 * Seiten sind dieselbe Tabelle des LCR, nur mit weniger Spalten; was
 * `parsePastedDirectory()` daraus macht – Name, Geschlecht, Geburtsdatum –,
 * ist genau das, was hier gebraucht wird. Anschrift, Telefon und E-Mail
 * stehen ohnehin schon am Mitglied; hier geht es allein um die Zugehörigkeit.
 *
 * Aus welcher der beiden Listen ein Text stammt, sagt er selbst: Die
 * Überschrift steht darin. Erraten wird sie trotzdem nur als Vorschlag –
 * entschieden wird im Formular (siehe `pages/ImportSingles`).
 */

/** Wie die beiden Listen im LCR heissen – daran werden sie erkannt. */
const HEADINGS: Record<SinglesKind, RegExp> = {
  // «Junger Alleinstehender Erwachsener», je nach Ansicht auch in der
  // Mehrzahl. Die Jungen zuerst prüfen: Ihre Überschrift enthält die der
  // Älteren nicht, wohl aber umgekehrt das Wort «Alleinstehend».
  jae: /jung\w*\s+alleinstehend/i,
  ae: /alleinstehende?\s+erwachsene/i,
}

/**
 * Aus welcher Liste dieser Text stammt – oder `null`, wenn es nicht dasteht.
 *
 * Geraten wird nicht: Wer eine Seite ohne Überschrift kopiert (weil er nur
 * die Tabelle markiert hat), bekommt die Wahl gestellt, statt stillschweigend
 * die falsche Hälfte der Gemeinde umzuschreiben.
 */
export function detectSinglesKind(text: string): SinglesKind | null {
  if (HEADINGS.jae.test(text)) return 'jae'
  if (HEADINGS.ae.test(text)) return 'ae'
  return null
}

export interface PastedSingles {
  /** Was im Text erkannt wurde – `null`, wenn die Überschrift fehlt */
  detected: SinglesKind | null
  people: PastedPerson[]
}

/** Den eingefügten Text lesen: welche Liste, und wer darin steht. */
export function parsePastedSingles(text: string): PastedSingles {
  return {
    detected: detectSinglesKind(text),
    people: parsePastedDirectory(text).people,
  }
}
