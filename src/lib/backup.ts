import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'

/**
 * Die Form der Sicherung: was in der Datei steht und wie sie heisst.
 *
 * Gelesen wird in `services/backup` – hier steht nur die Umwandlung. Das ist
 * kein Selbstzweck: Ob ein Zeitstempel die Reise in die Datei heil übersteht,
 * lässt sich so ohne Firestore prüfen (`tests/backup.test.ts`), und genau das
 * ist der eine Handgriff, bei dem eine Sicherung stillschweigend unbrauchbar
 * werden könnte.
 */

/* ------------------------------------------------------------------ */
/* Die Datei                                                           */
/* ------------------------------------------------------------------ */

/** Ein Dokument, wie es in der Datei steht: Firestore-ID plus Felder. */
export interface BackupDocument {
  id: string
  [field: string]: unknown
}

export interface Backup {
  /** Kennzeichen, an dem die Datei später wiederzuerkennen ist. */
  format: 'bss-sicherung'
  /** Aufbau der Datei. Ändert er sich, ändert sich diese Zahl. */
  version: 1
  /** Wann die Sicherung entstand – ISO 8601, wie alle Zeiten in der Datei. */
  createdAt: string
  /** Von welchem Konto aus (Anmelde-E-Mail). */
  createdBy: string
  /**
   * Woher die Daten stammen.
   *
   * `cache` heisst: Der Server war nicht erreichbar, gesichert wurde die
   * lokale Kopie. Sie ist vollständig, aber womöglich nicht der neueste
   * Stand – und das gehört in die Datei und nicht bloss in eine Meldung,
   * die niemand mehr sieht, wenn die Sicherung gebraucht wird.
   */
  source: 'server' | 'cache'
  /** Anzahl Datensätze je Sammlung – die Zeile, die man zuerst liest. */
  counts: Record<string, number>
  /** Die Datensätze selbst, je Sammlung. */
  data: Record<string, BackupDocument[]>
}

/* ------------------------------------------------------------------ */
/* Umwandlung                                                          */
/* ------------------------------------------------------------------ */

/**
 * Einen Firestore-Wert in etwas übersetzen, das JSON kennt.
 *
 * Der einzige Wert, der dabei wirklich etwas kostet, ist der Zeitstempel:
 * `JSON.stringify` macht daraus sonst `{"seconds":1786…,"nanoseconds":0}` –
 * richtig, aber für niemanden lesbar. Er wird deshalb zur ISO-Zeichenkette
 * («2026-08-06T16:30:00.000Z»). Beim Zurückspielen wird daraus mit
 * `Timestamp.fromDate(new Date(wert))` wieder ein Zeitstempel; welche Felder
 * das betrifft, sagt `lib/types`.
 *
 * Verschachteltes muss mit: Die Berufungsänderung eines Traktandums ist eine
 * Liste von Objekten, und darin stecken wieder Daten. Ginge das verloren,
 * fiele es erst am Tag der Wiederherstellung auf.
 */
export function toJsonValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        toJsonValue(inner),
      ]),
    )
  }
  return value
}

/**
 * Ein Dokument für die Datei aufbereiten.
 *
 * Die Firestore-ID steht als Feld `id` voran – sie gehört zum Datensatz, ist
 * aber nicht Teil seiner Felder. Ohne sie liesse sich später nichts wieder an
 * seinen Platz legen, und ein Verweis von einem Traktandum auf ein Mitglied
 * zeigte ins Leere.
 */
export function backupDocument(id: string, data: Record<string, unknown>): BackupDocument {
  return { id, ...(toJsonValue(data) as Record<string, unknown>) }
}

/* ------------------------------------------------------------------ */
/* Datei und Zahlen                                                    */
/* ------------------------------------------------------------------ */

/**
 * «bss-sicherung-2026-08-06-1830.json»
 *
 * Datum und Uhrzeit in der Ortszeit dessen, der den Knopf drückt: Im
 * Download-Ordner soll dastehen, wann man sie gezogen hat. Die Reihenfolge
 * Jahr–Monat–Tag sortiert die Dateien dabei von selbst richtig, und die
 * Uhrzeit hält zwei Sicherungen desselben Tages auseinander.
 */
export function backupFilename(date: Date): string {
  return `bss-sicherung-${format(date, 'yyyy-MM-dd-HHmm')}.json`
}

/** Wie viele Datensätze die Sicherung insgesamt enthält. */
export function backupTotal(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}
