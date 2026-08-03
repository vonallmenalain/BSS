import { collection, doc, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { requireOnline } from '@/lib/sync'
import { parseDirectoryDate } from '@/services/importPaste'
import type { CallingRow, CallingsPreview, MinisteringPreview } from '@/services/importMatch'
import type { Calling } from '@/lib/types'

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
