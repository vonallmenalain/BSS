import { collection, doc, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { normalize } from '@/lib/utils'
import { requireOnline } from '@/lib/sync'
import { parseDirectoryDate } from '@/services/importPaste'
import type { PastedCalling } from '@/services/importCallings'
import type { MinisteringEntry } from '@/services/importMinistering'
import type { Calling, Member } from '@/lib/types'

/**
 * Die zweite Hälfte der Text-Importe: gelesene Einträge einer Person
 * zuordnen, eine Vorschau bauen und nach Firestore schreiben.
 *
 * Die Parser selbst (`importCallings`, `importMinistering`) bleiben frei
 * von Firestore, damit sie sich ohne Bundler testen lassen. Hier kommt
 * beides zusammen.
 *
 * Grundlage ist immer die Mitgliederliste: Was sich keiner erfassten
 * Person zuordnen lässt, wird nicht angelegt, sondern gemeldet. Sonst
 * entstünden aus Tippfehlern stille Karteileichen.
 */

/* ------------------------------------------------------------------ */
/* Personen zuordnen                                                   */
/* ------------------------------------------------------------------ */

export interface MemberIndex {
  /** «nachname|vorname» → Mitglied */
  exact: Map<string, Member[]>
  /** «nachname» → Mitglieder */
  byLastName: Map<string, Member[]>
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const bucket = map.get(key)
  if (bucket) bucket.push(value)
  else map.set(key, [value])
}

export function buildMemberIndex(members: Member[]): MemberIndex {
  const exact = new Map<string, Member[]>()
  const byLastName = new Map<string, Member[]>()
  for (const member of members) {
    push(exact, normalize(`${member.lastName}|${member.firstName}`), member)
    push(byLastName, normalize(member.lastName), member)
  }
  return { exact, byLastName }
}

export interface MemberMatch {
  member: Member | null
  /** Mehrere Personen passen – dann wird bewusst keine gewählt */
  ambiguous: boolean
}

const NO_MATCH: MemberMatch = { member: null, ambiguous: false }

/**
 * Ordnet «Nachname, Vorname» einer erfassten Person zu.
 *
 * Drei Stufen: genaue Übereinstimmung, dann Nachname mit passendem
 * ersten Vornamen (das LCR kürzt Zweitnamen gelegentlich ab, etwa
 * «Bader, Joshua B.»), zuletzt ein eindeutiger Nachname allein.
 */
export function matchMemberByName(fullName: string, index: MemberIndex): MemberMatch {
  const text = fullName.trim()
  if (!text) return NO_MATCH

  const [rawLast, ...rest] = text.split(',')
  const last = normalize(rawLast)
  const first = normalize(rest.join(',').trim())
  if (!last) return NO_MATCH

  const exact = index.exact.get(`${last}|${first}`)
  if (exact?.length === 1) return { member: exact[0], ambiguous: false }
  if (exact && exact.length > 1) return { member: null, ambiguous: true }

  const sameLastName = index.byLastName.get(last) ?? []
  if (sameLastName.length === 0) return NO_MATCH

  if (first) {
    const firstToken = first.split(/\s+/)[0]
    const byFirstToken = sameLastName.filter((member) => {
      const candidate = normalize(member.firstName).split(/\s+/)[0]
      return candidate === firstToken
    })
    if (byFirstToken.length === 1) return { member: byFirstToken[0], ambiguous: false }
    if (byFirstToken.length > 1) return { member: null, ambiguous: true }
    return NO_MATCH
  }

  if (sameLastName.length === 1) return { member: sameLastName[0], ambiguous: false }
  return { member: null, ambiguous: true }
}

/* ------------------------------------------------------------------ */
/* Berufungen                                                          */
/* ------------------------------------------------------------------ */

export interface CallingRow {
  parsed: PastedCalling
  memberId: string | null
  memberName: string
  /** Bestehende Berufung derselben Person in derselben Rolle */
  existingId: string | null
  action: 'create' | 'update' | 'skip'
  warnings: string[]
}

export interface CallingsPreview {
  rows: CallingRow[]
  createCount: number
  updateCount: number
  skipCount: number
  /** Offene Berufungen aus der Quelle – werden nicht geschrieben */
  vacant: number
}

/**
 * Schlüssel für den Abgleich: Person, Rolle und Organisation.
 *
 * Die Organisation gehört bewusst dazu. Das LCR führt die Bischofschaft
 * doppelt – einmal als «Bischofschaft», einmal als «Präsidentschaft des
 * Aaronischen Priestertums» – und das sind zwei echte Berufungen.
 */
function callingKey(memberId: string, position: string, organization: string): string {
  return `${memberId}|${normalize(position)}|${organization}`
}

export function buildCallingsPreview(
  parsed: PastedCalling[],
  vacant: number,
  members: Member[],
  existing: Calling[],
): CallingsPreview {
  const index = buildMemberIndex(members)

  const existingByKey = new Map<string, Calling>()
  for (const calling of existing) {
    existingByKey.set(callingKey(calling.memberId, calling.position, calling.organization), calling)
  }

  const rows: CallingRow[] = parsed.map((entry) => {
    const warnings: string[] = []
    const { member, ambiguous } = matchMemberByName(entry.fullName, index)

    if (ambiguous) warnings.push('Mehrere Personen mit diesem Namen – bitte von Hand zuordnen')
    else if (!member) warnings.push('Keine passende Person in der Mitgliederliste')

    const existingId = member
      ? (existingByKey.get(callingKey(member.id, entry.position, entry.organization))?.id ?? null)
      : null

    return {
      parsed: entry,
      memberId: member?.id ?? null,
      memberName: member ? `${member.lastName}, ${member.firstName}` : entry.fullName,
      existingId,
      action: !member ? 'skip' : existingId ? 'update' : 'create',
      warnings,
    }
  })

  return {
    rows,
    createCount: rows.filter((r) => r.action === 'create').length,
    updateCount: rows.filter((r) => r.action === 'update').length,
    skipCount: rows.filter((r) => r.action === 'skip').length,
    vacant,
  }
}

export interface ImportOutcome {
  created: number
  updated: number
  skipped: number
}

/**
 * Schreibt die Berufungen in Blöcken zu 400 – Firestore erlaubt 500
 * Schreibvorgänge pro Batch, und wir lassen Luft.
 */
export async function runCallingsImport(
  preview: CallingsPreview,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportOutcome> {
  requireOnline()
  const rows = preview.rows.filter((row) => row.action !== 'skip')
  const callings = collection(db, COLLECTIONS.callings)
  let created = 0
  let updated = 0

  for (let offset = 0; offset < rows.length; offset += 400) {
    const chunk = rows.slice(offset, offset + 400)
    const batch = writeBatch(db)

    for (const row of chunk) {
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
        batch.update(doc(db, COLLECTIONS.callings, row.existingId), base)
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
    onProgress?.(Math.min(offset + chunk.length, rows.length), rows.length)
  }

  return { created, updated, skipped: preview.skipCount }
}

/* ------------------------------------------------------------------ */
/* Betreuungsaufträge                                                  */
/* ------------------------------------------------------------------ */

export interface MinisteringRow {
  entry: MinisteringEntry
  memberId: string | null
  partnerIds: string[]
  assignedIds: string[]
  /** Namen, die sich keiner erfassten Person zuordnen liessen */
  unresolved: string[]
  action: 'update' | 'skip'
  warnings: string[]
}

export interface MinisteringPreview {
  rows: MinisteringRow[]
  updateCount: number
  skipCount: number
  /** Zuteilungen insgesamt (Partner und Auftrag zusammen) */
  linkCount: number
}

export function buildMinisteringPreview(
  entries: MinisteringEntry[],
  members: Member[],
): MinisteringPreview {
  const index = buildMemberIndex(members)

  const rows: MinisteringRow[] = entries.map((entry) => {
    const warnings: string[] = []
    const unresolved: string[] = []

    const resolve = (names: string[]): string[] => {
      const ids: string[] = []
      for (const name of names) {
        const { member } = matchMemberByName(name, index)
        if (member) ids.push(member.id)
        else unresolved.push(name)
      }
      return ids
    }

    const { member, ambiguous } = matchMemberByName(entry.fullName, index)
    const partnerIds = resolve(entry.partners)
    const assignedIds = resolve(entry.assigned)

    if (ambiguous) warnings.push('Mehrere Personen mit diesem Namen')
    else if (!member) warnings.push('Keine passende Person in der Mitgliederliste')
    if (unresolved.length) warnings.push(`${unresolved.length} Name(n) nicht zugeordnet`)

    return {
      entry,
      memberId: member?.id ?? null,
      partnerIds,
      assignedIds,
      unresolved,
      action: member ? 'update' : 'skip',
      warnings,
    }
  })

  return {
    rows,
    updateCount: rows.filter((r) => r.action === 'update').length,
    skipCount: rows.filter((r) => r.action === 'skip').length,
    linkCount: rows.reduce((sum, r) => sum + r.partnerIds.length + r.assignedIds.length, 0),
  }
}

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

  for (let offset = 0; offset < rows.length; offset += 400) {
    const chunk = rows.slice(offset, offset + 400)
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
