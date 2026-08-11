import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import type { LogEntry } from '@/lib/types'

/**
 * Das Zugriffsprotokoll lesen und aufräumen.
 *
 * Gelesen wird **einmal auf Abruf** und nicht laufend mitverfolgt. Das ist
 * anders als überall sonst in der App (siehe `lib/collectionStore`) und hat
 * einen Grund: Das Protokoll ist die einzige Sammlung, die von selbst wächst,
 * und sie interessiert genau eine Person ein paar Mal im Jahr. Ein offener
 * Horcher darauf kostete jeden Tag Lesevorgänge für eine Frage, die niemand
 * gestellt hat. Der Knopf «Neu laden» auf der Seite ist der ehrlichere Weg.
 *
 * Geschrieben wird hier nichts – das tut `lib/audit` beim Arbeiten. Diese
 * Datei geht deshalb bewusst direkt zu `firebase/firestore` und nicht über
 * `lib/db`: Ihre einzige Änderung ist das Aufräumen, und dass der Administrator
 * altes Protokoll wegwirft, muss nicht seinerseits im Protokoll stehen.
 */

/**
 * Wie viele Einträge höchstens geholt werden.
 *
 * Eine Notbremse und keine Einstellung: Bei einer Bischofschaft von acht
 * Personen kommen im Monat vielleicht tausend Einträge zusammen. Wer «alles»
 * wählt und ein Jahr Betrieb hinter sich hat, soll trotzdem nicht
 * versehentlich zwanzigtausend Dokumente lesen. Wird die Grenze erreicht,
 * sagt es die Seite.
 */
export const MAX_ENTRIES = 4000

export interface AccessLogPage {
  entries: LogEntry[]
  /** Die Grenze war erreicht – es gibt Älteres, das hier fehlt. */
  truncated: boolean
}

/**
 * Die Einträge der letzten `days` Tage, neueste zuerst.
 *
 * Abgefragt wird nach `at`; ein zusammengesetzter Index braucht es dafür
 * nicht, weil nur ein Feld beteiligt ist.
 */
export async function loadAccessLog(days: number): Promise<AccessLogPage> {
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (days - 1))

  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.accessLog),
      where('at', '>=', Timestamp.fromDate(since)),
      orderBy('at', 'desc'),
      limit(MAX_ENTRIES),
    ),
  )

  const entries = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as LogEntry)
  return { entries, truncated: entries.length === MAX_ENTRIES }
}

/**
 * Wirft weg, was älter ist als `days` Tage.
 *
 * Ein Protokoll, das nie endet, ist kein Protokoll mehr, sondern ein Archiv
 * über das Verhalten von Leuten, die davon nichts haben. Deshalb steht der
 * Knopf gleich unter der Liste – und nicht in einer Anleitung, die niemand
 * liest.
 *
 * Gelöscht wird einzeln und nicht als Stapel: Firestore begrenzt einen Stapel
 * auf fünfhundert Vorgänge, und hier zählt nicht die Geschwindigkeit, sondern
 * dass es zu Ende läuft. Gemeldet wird, wie viele es waren.
 */
export async function pruneAccessLog(days: number): Promise<number> {
  const until = new Date()
  until.setHours(0, 0, 0, 0)
  until.setDate(until.getDate() - days)

  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.accessLog),
      where('at', '<', Timestamp.fromDate(until)),
      orderBy('at', 'asc'),
      limit(MAX_ENTRIES),
    ),
  )

  for (const entry of snapshot.docs) {
    await deleteDoc(doc(db, COLLECTIONS.accessLog, entry.id))
  }

  return snapshot.size
}
