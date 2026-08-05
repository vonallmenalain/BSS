import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
  type WriteBatch,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { resyncCollections } from '@/lib/collectionStore'
import { requireOnline } from '@/lib/sync'
import { uid } from '@/lib/utils'
import { readDocxXml, parseDocxBlocks } from '@/lib/docx'
import { parseMinutes, type ParsedMinutes, type ParsedMinutesItem } from '@/lib/minutes'
import type { Actor } from '@/services/agenda'
import type { ItemKind, ItemStatus, MeetingStatus } from '@/lib/types'

/*
 * Das Lesen liegt firestore-frei in `lib/docx` und `lib/minutes` – von hier
 * mitverteilt, damit die Seite nur einen Ort kennen muss.
 */
export {
  parseMinutes,
  parseMinutesDate,
  minutesItem,
  type ParsedMinutes,
  type ParsedMinutesItem,
  type ParsedMinutesMeeting,
} from '@/lib/minutes'

/**
 * Die bisherigen Protokolle übernehmen.
 *
 * Ein einmaliger Vorgang: Aus jeder Tabelle des Word-Dokuments wird eine
 * Sitzung, aus jeder Zeile ein Traktandum, und aus der Tabelle «Offene
 * Pendenzen» werden Pendenzen im Sammelkorb. Danach wird in der App
 * weitergearbeitet und die Datei nicht mehr angefasst.
 *
 * Alles Übernommene trägt `importedFrom: 'minutes'`. Damit ist der Import
 * wiederholbar: Ein zweiter Anlauf nach einer Korrektur räumt genau das
 * weg, was er selbst angelegt hat – und lässt jede von Hand erfasste
 * Sitzung stehen.
 */

export const MINUTES_SOURCE = 'minutes'

/** Firestore nimmt höchstens 500 Schreibvorgänge pro Stapel. */
const CHUNK_SIZE = 400

export interface MinutesImportResult {
  meetings: number
  items: number
  pending: number
  removed: number
}

export interface MinutesImportOptions {
  /** Titel der Sitzungen, wie er in den Einstellungen steht */
  title: string
  /** Beginn als «19:30» – im Dokument steht keine Uhrzeit */
  time: string
  actor: Actor
  /** Vorher alles entfernen, was ein früherer Import angelegt hat */
  replace: boolean
}

/** Eine Word-Datei einlesen und verstehen – ohne etwas zu schreiben. */
export async function readMinutesFile(file: File): Promise<ParsedMinutes> {
  const xml = await readDocxXml(await file.arrayBuffer())
  return parseMinutes(parseDocxBlocks(xml))
}

/**
 * Sammelt Schreibvorgänge und gibt sie in Stapeln ab.
 *
 * Ein Stapel fasst höchstens 500 Vorgänge, und bei über sechshundert
 * Traktanden wäre jeder einzeln geschrieben quälend langsam.
 */
function batchWriter(total: number, onProgress?: (done: number, total: number) => void) {
  let batch = writeBatch(db)
  let pending = 0
  let done = 0

  return {
    add(write: (target: WriteBatch) => void) {
      write(batch)
      pending += 1
    },
    /** Schreibt den Stapel, sobald er voll ist – `force` auch den letzten. */
    async flush(force = false) {
      if (pending === 0) return
      if (!force && pending < CHUNK_SIZE) return
      await batch.commit()
      done += pending
      onProgress?.(Math.min(done, total), total)
      batch = writeBatch(db)
      pending = 0
    },
  }
}

function historyEntry(actor: Actor, at: Date) {
  return {
    id: uid(),
    action: 'Aus dem bisherigen Protokoll übernommen',
    authorId: actor.id,
    authorName: actor.name,
    createdAt: at.toISOString(),
  }
}

function itemDocument(
  item: ParsedMinutesItem,
  options: {
    meetingId: string | null
    order: number
    kind: ItemKind
    status: ItemStatus
    at: Date
    actor: Actor
  },
) {
  const stamp = Timestamp.fromDate(options.at)
  return {
    title: item.title,
    description: item.description,
    meetingId: options.meetingId,
    firstMeetingId: options.meetingId,
    order: options.order,
    kind: options.kind,
    status: options.status,
    assignees: [],
    memberRefs: [],
    deferCount: 0,
    history: [historyEntry(options.actor, options.at)],
    importedFrom: MINUTES_SOURCE,
    /*
     * Zeitstempel des Protokolls und nicht der Import selbst: Sonst stünde
     * die ganze Vergangenheit im Archiv unter «heute geändert» und
     * verdeckte, was wirklich neu ist.
     */
    createdAt: stamp,
    updatedAt: stamp,
    createdBy: options.actor.id,
    completedAt: options.status === 'done' ? stamp : null,
    completedBy: null,
  }
}

/** Was ein früherer Import angelegt hat, wieder entfernen. */
async function removePreviousImport(): Promise<number> {
  let removed = 0
  for (const name of [COLLECTIONS.agendaItems, COLLECTIONS.meetings]) {
    const found = await getDocs(
      query(collection(db, name), where('importedFrom', '==', MINUTES_SOURCE)),
    )
    for (let offset = 0; offset < found.docs.length; offset += CHUNK_SIZE) {
      const batch = writeBatch(db)
      for (const entry of found.docs.slice(offset, offset + CHUNK_SIZE)) batch.delete(entry.ref)
      await batch.commit()
    }
    removed += found.docs.length
  }
  return removed
}

export async function importMinutes(
  parsed: ParsedMinutes,
  options: MinutesImportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<MinutesImportResult> {
  requireOnline()

  const removed = options.replace ? await removePreviousImport() : 0

  const meetings = [...parsed.meetings].sort((a, b) => a.date.localeCompare(b.date))
  const total =
    meetings.length + meetings.reduce((sum, m) => sum + m.items.length, 0) + parsed.pending.length
  const writer = batchWriter(total, onProgress)
  const now = new Date()

  let items = 0

  for (const meeting of meetings) {
    const at = new Date(`${meeting.date}T${options.time || '19:30'}:00`)
    const stamp = Timestamp.fromDate(at)
    const past = at.getTime() < now.getTime()
    const meetingRef = doc(collection(db, COLLECTIONS.meetings))

    writer.add((batch) =>
      batch.set(meetingRef, {
        date: stamp,
        title: options.title,
        location: '',
        // Vergangene Sitzungen sind abgeschlossen; die eine noch bevorstehende
        // bleibt geplant, damit sie in der Übersicht dort steht, wo sie hingehört.
        status: (past ? 'closed' : 'planned') satisfies MeetingStatus,
        attendees: [],
        openingPrayer: '',
        closingPrayer: '',
        spiritualThought: '',
        startedAt: past ? stamp : null,
        closedAt: past ? stamp : null,
        importedFrom: MINUTES_SOURCE,
        createdAt: stamp,
        updatedAt: stamp,
        createdBy: options.actor.id,
      }),
    )
    await writer.flush()

    for (const [index, item] of meeting.items.entries()) {
      writer.add((batch) =>
        batch.set(
          doc(collection(db, COLLECTIONS.agendaItems)),
          itemDocument(item, {
            meetingId: meetingRef.id,
            order: (index + 1) * 100,
            kind: 'traktandum',
            // Was besprochen wurde, ist erledigt – offen bleibt allein, was
            // in der Tabelle «Offene Pendenzen» steht.
            status: past ? 'done' : 'new',
            at,
            actor: options.actor,
          }),
        ),
      )
      items += 1
      await writer.flush()
    }
  }

  for (const [index, item] of parsed.pending.entries()) {
    writer.add((batch) =>
      batch.set(
        doc(collection(db, COLLECTIONS.agendaItems)),
        itemDocument(item, {
          meetingId: null,
          order: (index + 1) * 100,
          // Die Tabelle «Offene Pendenzen» heisst so, weil genau das
          // darinsteht: Punkte, die frühere Sitzungen überdauert haben.
          kind: 'pendenz',
          status: 'pending',
          at: now,
          actor: options.actor,
        }),
      ),
    )
    await writer.flush()
  }

  await writer.flush(true)

  // Gelöschtes und rückdatierte Zeitstempel sieht der schrittweise Abgleich
  // nicht – nach einem Import wird der Bestand einmal frisch gelesen.
  resyncCollections([COLLECTIONS.meetings, COLLECTIONS.agendaItems])

  return { meetings: meetings.length, items, pending: parsed.pending.length, removed }
}

/** Der Zeitpunkt einer Sitzung – die Datei nennt nur das Datum. */
export function minutesDate(date: string, time: string): Date {
  return new Date(`${date}T${time || '19:30'}:00`)
}
