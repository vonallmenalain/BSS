import { collection, getDocs } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { backupDocument, backupFilename, type Backup, type BackupDocument } from '@/lib/backup'

/**
 * Der ganze Bestand als eine Datei auf dem eigenen Gerät.
 *
 * ## Warum es das braucht
 *
 * Firestore kennt ohne Zutun weder Sicherung noch Papierkorb, und Wege, viel
 * auf einmal zu verlieren, gibt es reichlich: Der Mitgliederimport entfernt
 * auf Wunsch alle, die in der Quelle fehlen, der AP-Import ersetzt den ganzen
 * Jahresplan, und Sitzungen, Notizen und Ansprachen lassen sich einzeln
 * löschen. Eine falsche Datei genügt.
 *
 * Die eigentliche Rückversicherung dagegen ist **Point-in-time-Recovery** im
 * Firebase-Projekt: sieben Tage lang jeder Stand, ohne dass jemand daran
 * gedacht haben muss (Anleitung im README unter «Sicherung»). Diese Datei
 * hier ist das Zweite daneben – die Kopie, die ohne Konsole zu lesen ist,
 * älter als sieben Tage werden darf und auch dann noch da ist, wenn das
 * Projekt selbst abhandenkommt.
 *
 * ## Was sie kostet
 *
 * Einmal den ganzen Bestand lesen, also ein Lesevorgang je Datensatz – bei
 * einer Gemeinde ein paar Tausend. Das ist der Grund, weshalb hier ein Knopf
 * steht und kein Automatismus: Ein tägliches Lesen des gesamten Bestands
 * widerspräche allem, was `lib/collectionStore` einspart, und deckte doch nur
 * ab, was PITR ohnehin abdeckt.
 */

/**
 * Was gesichert wird: jede Sammlung, die die App führt.
 *
 * Aus `COLLECTIONS` abgeleitet und nicht von Hand aufgezählt. Eine neue
 * Sammlung fiele sonst genau bis zum Tag der Wiederherstellung nicht auf.
 */
export const BACKUP_COLLECTIONS: string[] = Object.values(COLLECTIONS)

/**
 * Alle Sammlungen lesen und zur Sicherung zusammensetzen.
 *
 * Eine nach der anderen und nicht alle zugleich: So lässt sich anschreiben,
 * wie weit es ist («4 von 15»), und der Server bekommt nicht fünfzehn
 * vollständige Abfragen im selben Augenblick.
 *
 * Ohne Verbindung liefert `getDocs` den Stand aus der lokalen Kopie, statt zu
 * scheitern. Das ist erwünscht – eine Sicherung von gestern ist besser als
 * keine –, muss aber in der Datei stehen: `source`.
 */
export async function createBackup(
  createdBy: string,
  onProgress?: (done: number, total: number) => void,
): Promise<Backup> {
  const data: Record<string, BackupDocument[]> = {}
  const counts: Record<string, number> = {}
  let fromCache = false

  for (const [index, name] of BACKUP_COLLECTIONS.entries()) {
    const snapshot = await getDocs(collection(db, name))
    if (snapshot.metadata.fromCache) fromCache = true
    data[name] = snapshot.docs.map((entry) =>
      /*
       * «estimate»: Eine eigene, noch nicht übertragene Änderung trägt für
       * `serverTimestamp()`-Felder sonst `null` – in einer Sicherung stünde
       * dann bei frisch Bearbeitetem kein Datum. Geschätzt wird die lokale
       * Uhrzeit, also genau das, was gemeint ist (siehe `collectionStore`).
       */
      backupDocument(entry.id, entry.data({ serverTimestamps: 'estimate' })),
    )
    counts[name] = snapshot.size
    onProgress?.(index + 1, BACKUP_COLLECTIONS.length)
  }

  return {
    format: 'bss-sicherung',
    version: 1,
    createdAt: new Date().toISOString(),
    createdBy,
    source: fromCache ? 'cache' : 'server',
    counts,
    data,
  }
}

/**
 * Die Sicherung als Datei auf das Gerät legen. Gibt den Dateinamen zurück,
 * damit die Meldung sagen kann, wonach im Download-Ordner zu suchen ist.
 *
 * Eingerückt gespeichert: Die Datei ist zum Lesen gemacht. Wer nachsehen
 * will, ob die eine Notiz noch drinsteht, soll sie öffnen können, statt sie
 * erst durch ein Werkzeug schicken zu müssen.
 */
export function downloadBackup(backup: Backup, now = new Date()): string {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFilename(now)
  link.click()
  /*
   * Erst später freigeben. Wird die Adresse im selben Zug wieder verworfen,
   * bricht der Download je nach Browser ab, bevor er begonnen hat – die
   * Datei ist bei einer Gemeinde einige Megabyte gross.
   */
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return link.download
}
