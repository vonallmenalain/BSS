import {
  addDoc as fbAddDoc,
  deleteDoc as fbDeleteDoc,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  writeBatch as fbWriteBatch,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type SetOptions,
  type WriteBatch,
} from 'firebase/firestore'
import { peekDoc } from '@/lib/collectionStore'
import { noteChange } from '@/lib/audit'
import type { ChangeOp } from '@/lib/types'

/**
 * Firestore, aber mit Protokoll.
 *
 * Alle Dienste in `src/services` holen ihre Schreibfunktionen hier statt
 * direkt bei `firebase/firestore`. Sie verhalten sich genau gleich – dieselben
 * Namen, dieselben Aufrufe, dieselben Rückgabewerte – und melden nebenbei,
 * was sie geschrieben haben (siehe `lib/audit`).
 *
 * ## Warum an dieser Stelle
 *
 * Weil es die einzige ist, an der man nichts vergessen kann. Die Alternative
 * wäre, in jedem Dienst eine Protokollzeile mitzuschreiben – zwei Dutzend
 * Dateien, in denen es beim nächsten neuen Handgriff fehlt. Hier genügt es,
 * die Importzeile zu ändern; wer künftig einen Dienst schreibt, greift
 * ohnehin zum Nachbarn und übernimmt sie mit.
 *
 * Die Lesefunktionen sind bewusst mit dabei und unverändert weitergereicht.
 * Müssten die Dienste ihre Abfragen weiterhin bei `firebase/firestore` holen
 * und nur die Schreibvorgänge hier, stünden in jeder Datei zwei Importzeilen
 * aus zwei Modulen – und die Frage, welche wofür gilt, bei jedem Blick neu.
 *
 * ## Was nicht darüber läuft
 *
 * Zwei Dinge, jedes mit Absicht:
 *
 *  - **Die Anmeldung** (`contexts/AuthContext`). Sie schreibt bei jedem
 *    Start den Zeitpunkt der letzten Anmeldung ins eigene Profil. Das ist
 *    keine Änderung, über die jemand Auskunft haben möchte – es stünde in
 *    jeder Zeile des Protokolls und verdeckte, worum es geht. Dass jemand da
 *    war, hält der Besuchseintrag ohnehin fest.
 *  - **Das Protokoll selbst** (`lib/audit`). Es schreibt direkt, sonst
 *    protokollierte es sich in einer Endlosschleife selbst.
 */

/* ------------------------------------------------------------------ */
/* Lesen und Bauen – unverändert weitergereicht                        */
/* ------------------------------------------------------------------ */

export {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore'

export type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
  WriteBatch,
} from 'firebase/firestore'

/* ------------------------------------------------------------------ */
/* Melden                                                              */
/* ------------------------------------------------------------------ */

/** «agendaItems/abc» → Sammlung und Datensatz. */
function split(reference: DocumentReference | CollectionReference): [string, string] {
  const parts = reference.path.split('/')
  return [parts[0] ?? '', parts.length > 1 ? (parts[parts.length - 1] ?? '') : '']
}

function note(
  reference: DocumentReference | CollectionReference,
  op: ChangeOp,
  data: DocumentData | null,
): void {
  const [collectionId, docId] = split(reference)
  noteChange(collectionId, docId, op, data)
}

/**
 * Eine Änderung von Hand melden.
 *
 * Für den einen Weg, der sich nicht kapseln lässt: `runTransaction()` liest
 * und schreibt in einem Rutsch, und was dabei geschrieben wird, steht in
 * einer Rückruffunktion, die Firestore selbst aufruft – auch mehrmals, wenn
 * jemand dazwischenkommt. Ein Stellvertreter darum herum meldete diese
 * Wiederholungen als weitere Änderungen. Gemeldet wird deshalb einmal
 * ausserhalb, von der Stelle, die weiss, was sie vorhat.
 */
export function noteWrite(
  reference: DocumentReference,
  op: ChangeOp,
  data: DocumentData | null = null,
): void {
  note(reference, op, data)
}

/**
 * Anlegen oder ändern – `setDoc` beantwortet das nicht von sich aus.
 *
 * Die App benutzt es für beides: mit `{ merge: true }` dort, wo ein Dokument
 * beim ersten Eintrag noch gar nicht existiert (ein Sonntag, eine
 * Einstellung), ohne Optionen dort, wo ein Datensatz ganz neu geschrieben
 * wird. Das allein trüge aber falsche Auskunft ins Protokoll, denn ein
 * vollständiges Überschreiben eines bestehenden Datensatzes ist eine
 * Änderung und kein Anlegen.
 *
 * Entschieden wird deshalb am geladenen Bestand: Kennt ihn die App schon,
 * war es eine Änderung. Kennt sie ihn nicht – weil er neu ist oder weil die
 * Sammlung in dieser Sitzung nie gebraucht wurde –, bleibt die Angabe aus
 * den Optionen. Der schlimmste Fall ist ein «angelegt», wo «geändert»
 * richtiger wäre; die Zeile im Protokoll steht so oder so.
 */
function setOp(reference: DocumentReference, merge: boolean): ChangeOp {
  const [collectionId, docId] = split(reference)
  if (peekDoc(collectionId, docId)) return 'update'
  return merge ? 'update' : 'create'
}

/* ------------------------------------------------------------------ */
/* Schreiben                                                           */
/* ------------------------------------------------------------------ */

export function setDoc(
  reference: DocumentReference,
  data: DocumentData,
  options?: SetOptions,
): Promise<void> {
  note(reference, setOp(reference, options !== undefined), data)
  return options === undefined ? fbSetDoc(reference, data) : fbSetDoc(reference, data, options)
}

export function updateDoc(reference: DocumentReference, data: DocumentData): Promise<void> {
  note(reference, 'update', data)
  return fbUpdateDoc(reference, data)
}

export function addDoc(
  reference: CollectionReference,
  data: DocumentData,
): Promise<DocumentReference> {
  /*
   * Gemeldet wird sofort und nicht erst, wenn der Server die ID vergeben hat.
   * Ohne Netz käme diese Bestätigung erst Stunden später – und bis dahin
   * fehlte im Protokoll ausgerechnet der neue Eintrag. Die ID bleibt dafür
   * leer; der Titel steht ohnehin in den Daten, die gerade geschrieben werden.
   */
  note(reference, 'create', data)
  return fbAddDoc(reference, data)
}

export function deleteDoc(reference: DocumentReference): Promise<void> {
  // Vor dem Löschen melden: Danach ist der Datensatz weg, und mit ihm der
  // Titel, unter dem er im Protokoll stehen soll.
  note(reference, 'delete', null)
  return fbDeleteDoc(reference)
}

/** Welche Methoden eines Stapels eine Änderung sind – und welche. */
const BATCH_OPS: Record<string, ChangeOp> = {
  set: 'create',
  update: 'update',
  delete: 'delete',
}

/**
 * Ein Stapel, der mitschreibt.
 *
 * Stapel sind der Weg, auf dem in dieser App viel auf einmal geschieht: ein
 * Mitgliederimport, eine umsortierte Traktandenliste, ein ganzer Jahresplan.
 * Genau das will man im Protokoll sehen – und zwar als eine Zeile mit einer
 * Zahl, nicht als vierhundert. Das Zusammenfassen erledigt `lib/audit`; hier
 * wird nur gemeldet.
 *
 * Als Stellvertreter und nicht als nachgebautes Objekt: Ein Stapel wird in
 * `services/importMinutes` weitergereicht und dort als `WriteBatch`
 * getippt. Der Stellvertreter **ist** einer – er schiebt bloss vor jeder
 * Änderung eine Meldung ein.
 */
export function writeBatch(firestore: Firestore): WriteBatch {
  const batch = fbWriteBatch(firestore)

  return new Proxy(batch, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown
      if (typeof value !== 'function') return value

      const op = typeof property === 'string' ? BATCH_OPS[property] : undefined
      const method = value as (...args: unknown[]) => unknown
      if (!op) return (...args: unknown[]) => method.apply(target, args)

      return (...args: unknown[]) => {
        const reference = args[0] as DocumentReference
        const data = op === 'delete' ? null : ((args[1] ?? null) as DocumentData | null)
        note(reference, op === 'create' ? setOp(reference, args[2] !== undefined) : op, data)
        return method.apply(target, args)
      }
    },
  })
}
