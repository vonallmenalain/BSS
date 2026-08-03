// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { normalize } from '../lib/utils.ts'
import type { PastedCalling, PastedCallings } from './importCallings.ts'
import type { MinisteringEntry } from './importMinistering.ts'
import type { Calling, CallingStatus, Member } from '../lib/types.ts'

/**
 * Die Mitte der Text-Importe: gelesene Einträge einer Person zuordnen und
 * daraus eine Vorschau bauen.
 *
 * Bewusst frei von Firestore – geschrieben wird in `importApply.ts`. So
 * lässt sich gerade der heikle Teil, das Entlassen fehlender Berufungen,
 * mit `node --test` prüfen, ohne Bundler und ohne Netz.
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
  /** Laufende Berufungen, die in der Quelle fehlen – werden entlassen */
  releases: Calling[]
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

/**
 * Status, die das LCR kennt.
 *
 * Nur wer dort steht, kann dort auch fehlen. Was die Bischofschaft erst
 * vorbereitet – vorgeschlagen, genehmigt, ausgesprochen –, ist der Seite
 * naturgemäss unbekannt und darf durch einen Import nicht verschwinden.
 */
const RECORDED_IN_LCR: CallingStatus[] = ['sustained', 'set_apart']

/**
 * Welche bestehenden Berufungen die Quelle überhaupt abdeckt.
 *
 * `null`, wenn sich das nicht sicher sagen lässt – dann wird nichts
 * entlassen. Die Seite «ausserhalb der Einheit» hat keine Überschrift,
 * an der sich erkennen liesse, dass sie wirklich vorlag; ein Fehlgriff
 * würde sonst die ganze Liste abräumen.
 */
function releaseScope(pasted: PastedCallings): ((calling: Calling) => boolean) | null {
  if (pasted.source === 'outOfUnit') {
    if (pasted.callings.length === 0) return null
    return (calling) => calling.outOfUnit === true
  }

  if (pasted.organizations.length === 0) return null
  const covered = new Set(pasted.organizations)
  // Berufungen ausserhalb der Einheit stehen auf einer eigenen Seite und
  // gehören keiner Organisation der Gemeinde – sie bleiben unberührt.
  return (calling) => !calling.outOfUnit && covered.has(calling.organization)
}

/**
 * Baut die Vorschau: was neu entsteht, was sich ändert und was entfällt.
 *
 * Die Quelle ersetzt ihren Bereich, sie ergänzt ihn nicht. Was das LCR
 * für eine kopierte Organisation nicht mehr führt, gilt als entlassen –
 * genau wie bei den Betreuungsaufträgen. Reicht die Quelle nur über einen
 * Teil der Gemeinde, reicht auch die Ersetzung nur so weit.
 */
export function buildCallingsPreview(
  pasted: PastedCallings,
  members: Member[],
  existing: Calling[],
): CallingsPreview {
  const index = buildMemberIndex(members)

  const existingByKey = new Map<string, Calling>()
  for (const calling of existing) {
    existingByKey.set(callingKey(calling.memberId, calling.position, calling.organization), calling)
  }

  const rows: CallingRow[] = pasted.callings.map((entry) => {
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

  const inScope = releaseScope(pasted)
  const kept = new Set(rows.flatMap((row) => (row.existingId ? [row.existingId] : [])))
  const releases = inScope
    ? existing.filter(
        (calling) =>
          RECORDED_IN_LCR.includes(calling.status) && inScope(calling) && !kept.has(calling.id),
      )
    : []

  return {
    rows,
    releases,
    createCount: rows.filter((r) => r.action === 'create').length,
    updateCount: rows.filter((r) => r.action === 'update').length,
    skipCount: rows.filter((r) => r.action === 'skip').length,
    vacant: pasted.vacant,
  }
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
