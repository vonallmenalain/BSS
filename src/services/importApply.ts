import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  Timestamp,
  type DocumentReference,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { toDate } from '@/lib/dates'
import { requireOnline } from '@/lib/sync'
import { parseDirectoryDate } from '@/services/importPaste'
import { fromIsoDate, isoDate } from '@/services/importHistory'
import { prayerDocId } from '@/services/prayers'
import type {
  CallingRow,
  CallingsPreview,
  HistoryPreview,
  KnownPrayer,
  KnownTalk,
  MinisteringPreview,
} from '@/services/importMatch'
import type { Calling, Prayer, Talk } from '@/lib/types'

/**
 * Der letzte Schritt der Text-Importe: die geprüfte Vorschau nach
 * Firestore schreiben.
 *
 * Parser (`importCallings`, `importMinistering`) und Zuordnung
 * (`importMatch`) bleiben frei von Firestore, damit sie sich ohne Bundler
 * testen lassen. Hier kommt beides zusammen.
 *
 * Geschrieben wird in Blöcken zu 400 – Firestore erlaubt 500
 * Schreibvorgänge pro Batch, und wir lassen Luft.
 */

const CHUNK_SIZE = 400

export interface ImportOutcome {
  created: number
  updated: number
  skipped: number
}

export interface CallingsOutcome extends ImportOutcome {
  /** Berufungen, die als entlassen markiert wurden */
  released: number
}

/* ------------------------------------------------------------------ */
/* Berufungen                                                          */
/* ------------------------------------------------------------------ */

/** Ein Schreibvorgang: entweder eine Zeile der Quelle oder eine Entlassung. */
type CallingWrite = { kind: 'row'; row: CallingRow } | { kind: 'release'; calling: Calling }

/**
 * Schreibt die Berufungen und entlässt, was in der Quelle fehlt.
 *
 * Die LCR-Seite ist die vollständige Wahrheit über die aktuelle
 * Besetzung: Wer dort nicht mehr steht, erfüllt die Berufung nicht mehr.
 * Entlassen heisst dabei nicht löschen – die Berufung behält ihren
 * Verlauf und erscheint weiterhin unter «Entlassen», damit die
 * Bischofschaft nachvollziehen kann, wer wann was getan hat.
 *
 * `releaseMissing` lässt sich abschalten, wenn die Quelle bewusst
 * unvollständig ist.
 */
export async function runCallingsImport(
  preview: CallingsPreview,
  options: { releaseMissing?: boolean } = {},
  onProgress?: (done: number, total: number) => void,
): Promise<CallingsOutcome> {
  requireOnline()

  const writes: CallingWrite[] = [
    ...preview.rows
      .filter((row) => row.action !== 'skip')
      .map((row): CallingWrite => ({ kind: 'row', row })),
    ...(options.releaseMissing === false
      ? []
      : preview.releases.map((calling): CallingWrite => ({ kind: 'release', calling }))),
  ]

  const callings = collection(db, COLLECTIONS.callings)
  // Alle Entlassungen desselben Imports tragen dasselbe Datum.
  const releasedDate = Timestamp.fromDate(new Date())
  let created = 0
  let updated = 0
  let released = 0

  for (let offset = 0; offset < writes.length; offset += CHUNK_SIZE) {
    const chunk = writes.slice(offset, offset + CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const write of chunk) {
      if (write.kind === 'release') {
        batch.update(doc(db, COLLECTIONS.callings, write.calling.id), {
          status: 'released',
          releasedDate,
          updatedAt: serverTimestamp(),
        })
        released++
        continue
      }

      const row = write.row
      const sustained = parseDirectoryDate(row.parsed.sustained)
      const setApart = parseDirectoryDate(row.parsed.setApart)

      const base: Record<string, unknown> = {
        memberId: row.memberId,
        memberName: row.memberName,
        position: row.parsed.position,
        organization: row.parsed.organization,
        group: row.parsed.group,
        order: row.parsed.order,
        custom: row.parsed.custom,
        outOfUnit: row.parsed.outOfUnit,
        sustainedDate: sustained ? Timestamp.fromDate(sustained) : null,
        setApartDate: setApart ? Timestamp.fromDate(setApart) : null,
        // Eingesetzt ist der weitergehende Schritt; ohne Datum gilt die
        // Berufung als bestätigt.
        status: setApart ? 'set_apart' : 'sustained',
        updatedAt: serverTimestamp(),
      }

      if (row.existingId) {
        batch.update(doc(db, COLLECTIONS.callings, row.existingId), {
          ...base,
          // Eine früher entlassene Berufung lebt wieder auf, wenn das LCR
          // sie erneut führt – dann darf das alte Datum nicht stehen bleiben.
          releasedDate: null,
        })
        updated++
      } else {
        batch.set(doc(callings), {
          ...base,
          proposedDate: null,
          extendedDate: null,
          releasedDate: null,
          responsibleId: null,
          notes: '',
          createdAt: serverTimestamp(),
        })
        created++
      }
    }

    await batch.commit()
    onProgress?.(Math.min(offset + chunk.length, writes.length), writes.length)
  }

  return { created, updated, released, skipped: preview.skipCount }
}

/* ------------------------------------------------------------------ */
/* Betreuungsaufträge                                                  */
/* ------------------------------------------------------------------ */

/**
 * Schreibt Betreuungspartner und -auftrag an die Mitglieder.
 *
 * Beide Listen werden ersetzt, nicht ergänzt: Die LCR-Seite ist die
 * vollständige Wahrheit über die aktuelle Zuteilung, und wer aus einer
 * Partnerschaft herausfällt, soll auch hier verschwinden.
 */
export async function runMinisteringImport(
  preview: MinisteringPreview,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportOutcome> {
  requireOnline()
  const rows = preview.rows.filter((row) => row.action !== 'skip')
  let updated = 0

  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const row of chunk) {
      if (!row.memberId) continue
      batch.update(doc(db, COLLECTIONS.members, row.memberId), {
        ministeringPartnerIds: row.partnerIds,
        ministeringAssignedIds: row.assignedIds,
        updatedAt: serverTimestamp(),
      })
      updated++
    }

    await batch.commit()
    onProgress?.(Math.min(offset + chunk.length, rows.length), rows.length)
  }

  return { created: 0, updated, skipped: preview.skipCount }
}

/* ------------------------------------------------------------------ */
/* Verlauf von Ansprachen und Gebeten                                  */
/* ------------------------------------------------------------------ */

export interface HistoryOutcome {
  talks: number
  prayers: number
  members: number
}

/** Ein Schreibvorgang des Verlaufs – neue Dokumente und nachgeführte Statistik. */
interface HistoryWrite {
  mode: 'set' | 'update'
  ref: DocumentReference
  data: Record<string, unknown>
}

/**
 * Liest den bereits erfassten Verlauf – einmal und vollständig.
 *
 * Ohne Obergrenze, anders als die Abfragen der Ansichten: Der Import muss
 * den ganzen Bestand kennen. Sonst zählte er Ansprachen doppelt, die knapp
 * ausserhalb eines Ausschnitts lägen, und überschriebe Gebete, die er nicht
 * gesehen hat.
 */
export async function loadKnownHistory(): Promise<{
  talks: KnownTalk[]
  prayers: KnownPrayer[]
}> {
  const [talks, prayers] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.talks), where('status', '==', 'held'))),
    getDocs(collection(db, COLLECTIONS.prayers)),
  ])

  const asIsoDate = (value: unknown): string | null => {
    const date = toDate(value as Timestamp | null)
    return date ? isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) : null
  }

  return {
    talks: talks.docs.flatMap((entry) => {
      const talk = entry.data() as Talk
      const date = asIsoDate(talk.date)
      return date ? [{ memberId: talk.memberId, date }] : []
    }),
    prayers: prayers.docs.flatMap((entry) => {
      const prayer = entry.data() as Prayer
      const date = asIsoDate(prayer.date)
      return date ? [{ date, slot: prayer.slot, memberId: prayer.memberId }] : []
    }),
  }
}

/**
 * Schreibt den eingelesenen Verlauf.
 *
 * Die Dokument-IDs entstehen aus Datum und Person, nicht zufällig. Damit
 * bleibt ein zweiter Durchlauf folgenlos: Er schreibt dieselben Dokumente
 * noch einmal, statt den Verlauf zu verdoppeln.
 *
 * Zum Schluss werden `lastTalkDate` und `talkCount` der betroffenen
 * Personen gesetzt – nicht hochgezählt, sondern auf den Wert, der sich aus
 * Bestand und Import zusammen ergibt. Genau diese beiden Felder treiben die
 * Frage «wer war lange nicht dran».
 */
export async function runHistoryImport(
  preview: HistoryPreview,
  onProgress?: (done: number, total: number) => void,
): Promise<HistoryOutcome> {
  requireOnline()

  const writes: HistoryWrite[] = [
    ...preview.talks.map((talk): HistoryWrite => {
      return {
        mode: 'set',
        ref: doc(db, COLLECTIONS.talks, `${talk.date}_${talk.memberId}`),
        data: {
          memberId: talk.memberId,
          memberName: talk.memberName,
          date: Timestamp.fromDate(fromIsoDate(talk.date)),
          slot: talk.slot,
          kind: 'talk',
          status: 'held',
          topic: '',
          notes: talk.note,
          askedById: null,
          askedAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      }
    }),
    ...preview.prayers.map((prayer): HistoryWrite => {
      return {
        mode: 'set',
        ref: doc(db, COLLECTIONS.prayers, prayerDocId(prayer.date, prayer.slot)),
        data: {
          date: Timestamp.fromDate(fromIsoDate(prayer.date)),
          slot: prayer.slot,
          memberId: prayer.memberId,
          memberName: prayer.memberName,
          notes: '',
          updatedAt: serverTimestamp(),
        },
      }
    }),
    ...preview.members.map((member): HistoryWrite => {
      return {
        mode: 'update',
        ref: doc(db, COLLECTIONS.members, member.memberId),
        data: {
          talkCount: member.talkCount,
          lastTalkDate: member.lastTalkDate
            ? Timestamp.fromDate(fromIsoDate(member.lastTalkDate))
            : null,
          updatedAt: serverTimestamp(),
        },
      }
    }),
  ]

  for (let offset = 0; offset < writes.length; offset += CHUNK_SIZE) {
    const chunk = writes.slice(offset, offset + CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const write of chunk) {
      if (write.mode === 'set') batch.set(write.ref, write.data)
      else batch.update(write.ref, write.data)
    }

    await batch.commit()
    onProgress?.(Math.min(offset + chunk.length, writes.length), writes.length)
  }

  return {
    talks: preview.talks.length,
    prayers: preview.prayers.length,
    members: preview.members.length,
  }
}
