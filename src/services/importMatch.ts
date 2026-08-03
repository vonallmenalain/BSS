// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { normalize } from '../lib/utils.ts'
import { matchesGivenNames, nameKeys, sameGivenNames } from '../lib/names.ts'
import { isoDate } from './importHistory.ts'
import type { PastedCalling, PastedCallings } from './importCallings.ts'
import type { MinisteringEntry } from './importMinistering.ts'
import type { ParsedHistory } from './importHistory.ts'
import type { HistoricCalling, ParsedCallingHistory } from './importCallingHistory.ts'
import type { Calling, CallingStatus, Member, PrayerSlot } from '../lib/types.ts'

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
  /** Vergleichsform des Nachnamens → Mitglieder */
  byLastName: Map<string, Member[]>
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const bucket = map.get(key)
  if (bucket) bucket.push(value)
  else map.set(key, [value])
}

export function buildMemberIndex(members: Member[]): MemberIndex {
  const byLastName = new Map<string, Member[]>()
  for (const member of members) {
    // Beide Schreibweisen des Nachnamens – «Bürge» ist auch unter
    // «buerge» zu finden, und umgekehrt.
    for (const key of nameKeys(member.lastName)) push(byLastName, key, member)
  }
  return { byLastName }
}

export interface MemberMatch {
  member: Member | null
  /** Mehrere Personen passen – dann wird bewusst keine gewählt */
  ambiguous: boolean
}

const NO_MATCH: MemberMatch = { member: null, ambiguous: false }

function single(members: Member[]): MemberMatch | null {
  if (members.length === 1) return { member: members[0], ambiguous: false }
  if (members.length > 1) return { member: null, ambiguous: true }
  return null
}

/**
 * Ordnet «Nachname, Vorname» einer erfassten Person zu.
 *
 * Der Nachname grenzt ein – in beiden Schreibweisen, damit «Buerge» und
 * «Bürge» zusammenfinden. Unter den Übriggebliebenen gilt zuerst der
 * ganze Vorname; erst wenn das niemanden oder mehrere ergibt, zählt die
 * lockerere Regel, dass jeder genannte Vorname vorkommen muss. So bleibt
 * eine genaue Übereinstimmung eindeutig, auch wenn daneben jemand mit
 * einem zusätzlichen Zweitnamen steht.
 *
 * Was danach offenbleibt, wird gemeldet statt geraten.
 */
export function matchMemberByName(fullName: string, index: MemberIndex): MemberMatch {
  const text = fullName.trim()
  if (!text) return NO_MATCH

  const [rawLast, ...rest] = text.split(',')
  const given = rest.join(',').trim()
  if (!rawLast.trim()) return NO_MATCH

  const seen = new Set<string>()
  const candidates: Member[] = []
  for (const key of nameKeys(rawLast)) {
    for (const member of index.byLastName.get(key) ?? []) {
      if (seen.has(member.id)) continue
      seen.add(member.id)
      candidates.push(member)
    }
  }

  if (candidates.length === 0) return NO_MATCH
  if (!given) return single(candidates) ?? NO_MATCH

  const exact = candidates.filter((member) => sameGivenNames(given, member.firstName))
  if (exact.length > 0) return single(exact) ?? NO_MATCH

  return (
    single(candidates.filter((member) => matchesGivenNames(given, member.firstName))) ?? NO_MATCH
  )
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
 * Schlüssel für den Abgleich: Person, Rolle, Organisation und Bereich.
 *
 * Die Organisation gehört bewusst dazu. Das LCR führt die Bischofschaft
 * doppelt – einmal als «Bischofschaft», einmal als «Präsidentschaft des
 * Aaronischen Priestertums» – und das sind zwei echte Berufungen.
 *
 * Ebenso der Bereich: Der Sonntagsschulpräsident des Pfahls ist nicht der
 * Sonntagsschulpräsident der Gemeinde. Beide tragen dieselbe Bezeichnung,
 * und ohne diese Unterscheidung überschriebe der eine den anderen.
 */
function callingKey(
  memberId: string,
  position: string,
  organization: string,
  outOfUnit: boolean | undefined,
): string {
  return `${memberId}|${normalize(position)}|${organization}|${outOfUnit ? 'aus' : 'gem'}`
}

/**
 * Bestehende Berufungen nach diesem Schlüssel greifbar machen.
 *
 * Zu einer Rolle kann es mehrere Einträge geben, seit die Berufungshistorie
 * mitimportiert wird: Wer heute FHV-Lehrerin ist, war es vielleicht schon
 * einmal. Der Abgleich muss dann die **laufende** treffen – sonst weckte
 * ein Import die alte wieder auf und entliesse die laufende, und beim
 * nächsten Mal wanderte es zurück.
 */
function indexByKey(callings: Calling[]): Map<string, Calling> {
  const index = new Map<string, Calling>()
  for (const calling of callings) {
    const key = callingKey(
      calling.memberId,
      calling.position,
      calling.organization,
      calling.outOfUnit,
    )
    const current = index.get(key)
    if (!current || (!isRunning(current) && isRunning(calling))) index.set(key, calling)
  }
  return index
}

function isRunning(calling: Calling): boolean {
  return calling.status !== 'released' && calling.status !== 'declined'
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

  const existingByKey = indexByKey(existing)

  const rows: CallingRow[] = pasted.callings.map((entry) => {
    const warnings: string[] = []
    const { member, ambiguous } = matchMemberByName(entry.fullName, index)

    if (ambiguous) warnings.push('Mehrere Personen mit diesem Namen – bitte von Hand zuordnen')
    else if (!member) warnings.push('Keine passende Person in der Mitgliederliste')

    const existingId = member
      ? (existingByKey.get(
          callingKey(member.id, entry.position, entry.organization, entry.outOfUnit),
        )?.id ?? null)
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
/* Berufungshistorie                                                   */
/* ------------------------------------------------------------------ */

/**
 * Was mit einer gelesenen Berufung geschieht.
 *
 *  - `create` – wird als neue Berufung geschrieben.
 *  - `merge`  – die Person hat diese Berufung bereits erfasst; ergänzt
 *               werden nur die Daten, die dort fehlen.
 *  - `known`  – bereits erfasst, und es gibt nichts zu ergänzen.
 *  - `skip`   – kein Mitglied gefunden; wird gemeldet, nicht geschrieben.
 *  - `ignore` – als «kein Mitglied unserer Gemeinde» abgelegt.
 */
export type CallingHistoryAction = 'create' | 'merge' | 'known' | 'skip' | 'ignore'

export interface CallingHistoryRow {
  calling: HistoricCalling
  memberId: string | null
  memberName: string
  /** Bestehende Berufung derselben Person in derselben Rolle */
  existingId: string | null
  /** Nur bei `merge`: die Felder, die dort noch fehlen */
  patch: Partial<Record<'extendedDate' | 'sustainedDate' | 'setApartDate', string>>
  status: CallingStatus
  action: CallingHistoryAction
  warnings: string[]
}

/**
 * Entscheidungen, die in der Vorschau von Hand getroffen wurden.
 *
 * Beides gehört zusammen und beides gehört in die Oberfläche, nicht in den
 * Code: Wer nach einer Heirat anders heisst, wird zugeordnet – wer gar nie
 * zur Gemeinde gehörte, wird weggelegt. Ohne die zweite Möglichkeit bliebe
 * die Liste der offenen Namen für immer lang, und man sähe nicht mehr, was
 * darin noch der Bearbeitung harrt.
 */
export interface CallingHistoryDecisions {
  /** «Nachname, Vorname» → Mitglied */
  overrides: Record<string, string>
  /** Namen, die zu keinem Mitglied der Gemeinde gehören */
  ignored: string[]
}

export interface CallingHistoryPreview {
  rows: CallingHistoryRow[]
  createCount: number
  mergeCount: number
  knownCount: number
  skipCount: number
  ignoredCount: number
  /** Personen, die Verlauf erhalten – mit der Anzahl ihrer Berufungen */
  members: { memberId: string; memberName: string; count: number }[]
  /** Namen ohne erfasste Person, mit der Anzahl ihrer Einträge */
  unmatched: { fullName: string; count: number }[]
  /** Weggelegte Namen – «kein Mitglied unserer Gemeinde» */
  dismissed: { fullName: string; count: number }[]
}

/** Welche Felder eine bestehende Berufung noch brauchen könnte. */
const FILLABLE = ['extendedDate', 'sustainedDate', 'setApartDate'] as const

/**
 * Ordnet die gelesene Berufungshistorie den erfassten Personen zu.
 *
 * Zwei Fragen entscheidet diese Stelle.
 *
 * **Wem gehört der Eintrag?** Wie überall gilt der Abgleich über den Namen;
 * was offenbleibt, wird gemeldet statt geraten. Von Hand zugeordnete Namen
 * kommen mit, weggelegte verschwinden ganz.
 *
 * **Läuft die Berufung noch?** Die Tabelle sagt es nur mittelbar: Wo keine
 * Entlassung steht, ist entweder keine erfasst worden oder die Person hat
 * die Aufgabe heute noch. Beides sieht gleich aus, und in der Mehrzahl ist
 * es das erste – über zehn Jahre sammeln sich mehr vergessene Entlassungen
 * als laufende Berufungen. Solche Einträge kommen deshalb als Verlauf in
 * die App, mit dem Vermerk «Entlassung nicht erfasst» statt mit einem
 * erfundenen Datum. Wer es anders will, stellt `keepOpen` um.
 *
 * Der laufende Bestand bleibt davon unberührt: Ist dieselbe Berufung schon
 * erfasst – aus dem LCR oder von Hand –, wird sie nicht verdoppelt, sondern
 * höchstens um fehlende Daten ergänzt.
 */
export function buildCallingHistoryPreview(
  parsed: ParsedCallingHistory,
  members: Member[],
  existing: Calling[],
  decisions: CallingHistoryDecisions = { overrides: {}, ignored: [] },
  keepOpen = false,
): CallingHistoryPreview {
  const index = buildMemberIndex(members)
  const byId = new Map(members.map((member) => [member.id, member]))
  const existingByKey = indexByKey(existing)
  const ignored = new Set(decisions.ignored)

  const unmatched = new Map<string, number>()
  const dismissed = new Map<string, number>()
  const perMember = new Map<string, number>()

  const rows: CallingHistoryRow[] = parsed.callings.map((calling) => {
    const warnings: string[] = []
    const assigned = decisions.overrides[calling.fullName]
    const found = assigned ? byId.get(assigned) : null
    const match = assigned
      ? { member: found ?? null, ambiguous: false }
      : matchMemberByName(calling.fullName, index)
    const member = match.member

    const status: CallingStatus =
      calling.released || !keepOpen ? 'released' : calling.setApartDate ? 'set_apart' : 'sustained'

    if (ignored.has(calling.fullName)) {
      dismissed.set(calling.fullName, (dismissed.get(calling.fullName) ?? 0) + 1)
      return {
        calling,
        memberId: null,
        memberName: calling.fullName,
        existingId: null,
        patch: {},
        status,
        action: 'ignore',
        warnings: [],
      }
    }

    if (!member) {
      if (match.ambiguous) warnings.push('Mehrere Personen mit diesem Namen')
      else warnings.push('Keine passende Person in der Mitgliederliste')
      unmatched.set(calling.fullName, (unmatched.get(calling.fullName) ?? 0) + 1)
      return {
        calling,
        memberId: null,
        memberName: calling.fullName,
        existingId: null,
        patch: {},
        status,
        action: 'skip',
        warnings,
      }
    }

    if (!calling.position) warnings.push('Ohne Amt in der Quelle')

    /*
     * Nur Berufungen ohne erfasste Entlassung können die laufende meinen.
     * Eine abgeschlossene ist immer ein eigener Abschnitt – wer eine
     * Aufgabe zweimal innehatte, soll sie auch zweimal sehen.
     */
    const existingCalling = calling.released
      ? undefined
      : existingByKey.get(
          callingKey(member.id, calling.position, calling.organization, calling.outOfUnit),
        )

    if (existingCalling) {
      const patch: CallingHistoryRow['patch'] = {}
      for (const field of FILLABLE) {
        const value = calling[field]
        if (value && !existingCalling[field]) patch[field] = value
      }
      return {
        calling,
        memberId: member.id,
        memberName: `${member.lastName}, ${member.firstName}`,
        existingId: existingCalling.id,
        patch,
        status: existingCalling.status,
        action: Object.keys(patch).length > 0 ? 'merge' : 'known',
        warnings,
      }
    }

    perMember.set(member.id, (perMember.get(member.id) ?? 0) + 1)
    return {
      calling,
      memberId: member.id,
      memberName: `${member.lastName}, ${member.firstName}`,
      existingId: null,
      patch: {},
      status,
      action: 'create',
      warnings,
    }
  })

  const count = (action: CallingHistoryAction) => rows.filter((row) => row.action === action).length

  return {
    rows,
    createCount: count('create'),
    mergeCount: count('merge'),
    knownCount: count('known'),
    skipCount: count('skip'),
    ignoredCount: count('ignore'),
    members: [...perMember.entries()]
      .flatMap(([memberId, entries]) => {
        const member = byId.get(memberId)
        return member
          ? [{ memberId, memberName: `${member.lastName}, ${member.firstName}`, count: entries }]
          : []
      })
      .sort((a, b) => b.count - a.count || a.memberName.localeCompare(b.memberName)),
    unmatched: byCount(unmatched),
    dismissed: byCount(dismissed),
  }
}

/** Namen mit ihrer Trefferzahl, die häufigsten zuerst. */
function byCount(counts: Map<string, number>): { fullName: string; count: number }[] {
  return [...counts.entries()]
    .map(([fullName, count]) => ({ fullName, count }))
    .sort((a, b) => b.count - a.count || a.fullName.localeCompare(b.fullName))
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

/* ------------------------------------------------------------------ */
/* Verlauf von Ansprachen und Gebeten                                  */
/* ------------------------------------------------------------------ */

/** Eine bereits erfasste, gehaltene Ansprache – auf das Nötige eingedampft. */
export interface KnownTalk {
  memberId: string
  /** «2024-10-20» */
  date: string
}

/** Ein bereits vergebener Gebetsplatz. */
export interface KnownPrayer {
  date: string
  slot: PrayerSlot
  memberId: string
}

export interface HistoryTalkRow {
  memberId: string
  memberName: string
  date: string
  /** Position im Programm – hinter dem, was für diesen Sonntag schon erfasst ist */
  slot: number
  note: string
}

export interface HistoryPrayerRow {
  memberId: string
  memberName: string
  date: string
  slot: PrayerSlot
}

/** Nachgeführte Statistik eines Mitglieds. */
export interface HistoryMemberRow {
  memberId: string
  memberName: string
  talkCount: number
  lastTalkDate: string | null
}

/**
 * Namen aus der Tabelle, die von Hand einer Person zugewiesen wurden.
 *
 * Nicht jeder Unterschied lässt sich aus den Namen ableiten: Nach einer
 * Heirat steht in der alten Tabelle noch der frühere Nachname, und wo zwei
 * Personen Vor- und Nachname teilen, hilft kein Verfahren weiter. Statt
 * solche Fälle im Code zu hinterlegen – wo sie veralten und Personendaten
 * ins Repository tragen –, werden sie einmalig in der Vorschau zugewiesen.
 */
export type HistoryOverrides = Record<string, string>

export interface HistoryPreview {
  talks: HistoryTalkRow[]
  prayers: HistoryPrayerRow[]
  members: HistoryMemberRow[]
  /** Einträge, die bereits erfasst sind – sie werden nicht doppelt geschrieben */
  known: number
  /** Namen ohne erfasste Person, mit der Anzahl ihrer Einträge */
  unmatched: { fullName: string; count: number }[]
  /** Gebete, für die an ihrem Sonntag kein Platz mehr frei ist */
  crowded: { date: string; memberName: string }[]
}

const PRAYER_SLOTS_IN_ORDER: PrayerSlot[] = ['opening', 'closing']

/**
 * Ordnet den gelesenen Verlauf den erfassten Personen zu.
 *
 * Zwei Eigenheiten prägen das Ergebnis:
 *
 * **Gebete kennen nur zwei Plätze pro Sonntag** – Anfang und Schluss –, und
 * die Tabelle sagt nicht, welcher es war. Vergeben wird deshalb der Reihe
 * nach; wo an einem Sonntag mehr als zwei Personen stehen (das kommt aus den
 * Jahren mit zwei Versammlungen), bleibt der Rest liegen und wird gemeldet
 * statt stillschweigend verworfen.
 *
 * **Ansprachen kennen keine solche Grenze.** Ihr Platz ist nur eine
 * Reihenfolge im Programm, deshalb passen beliebig viele auf einen Sonntag.
 *
 * Was bereits erfasst ist, bleibt unangetastet: Ein zweiter Durchlauf
 * schreibt nichts doppelt und überschreibt keine Zuteilung, die in der App
 * gepflegt wurde.
 */
export function buildHistoryPreview(
  parsed: ParsedHistory,
  members: Member[],
  knownTalks: KnownTalk[],
  knownPrayers: KnownPrayer[],
  overrides: HistoryOverrides = {},
): HistoryPreview {
  const index = buildMemberIndex(members)
  const byId = new Map(members.map((member) => [member.id, member]))

  // Reihenfolge festklopfen: Erst danach werden Plätze vergeben, und die
  // sollen bei gleichem Ausgangsstand immer gleich herauskommen.
  const entries = [...parsed.entries].sort(
    (a, b) =>
      isoDate(a.year, a.month, a.day).localeCompare(isoDate(b.year, b.month, b.day)) ||
      a.fullName.localeCompare(b.fullName),
  )

  const talks: HistoryTalkRow[] = []
  const prayers: HistoryPrayerRow[] = []
  const crowded: HistoryPreview['crowded'] = []
  const unmatched = new Map<string, number>()
  let known = 0

  /* Bestand ------------------------------------------------------- */

  const talksByMember = new Map<string, string[]>()
  const talksPerDate = new Map<string, number>()
  for (const talk of knownTalks) {
    push(talksByMember, talk.memberId, talk.date)
    talksPerDate.set(talk.date, (talksPerDate.get(talk.date) ?? 0) + 1)
  }

  const takenSlots = new Map<string, Map<PrayerSlot, string>>()
  for (const prayer of knownPrayers) {
    const forDate = takenSlots.get(prayer.date) ?? new Map<PrayerSlot, string>()
    forDate.set(prayer.slot, prayer.memberId)
    takenSlots.set(prayer.date, forDate)
  }

  /* Einträge ------------------------------------------------------ */

  const writtenTalks = new Set<string>()
  const newTalksByMember = new Map<string, string[]>()

  for (const entry of entries) {
    const assigned = overrides[entry.fullName]
    const member = assigned ? byId.get(assigned) : matchMemberByName(entry.fullName, index).member
    if (!member) {
      // Eine Zuweisung ins Leere zählt als «nicht übernehmen» und wird
      // nicht noch einmal als offen gemeldet.
      if (!assigned) unmatched.set(entry.fullName, (unmatched.get(entry.fullName) ?? 0) + 1)
      continue
    }

    const date = isoDate(entry.year, entry.month, entry.day)
    const memberName = `${member.firstName} ${member.lastName}`.trim()

    if (entry.kind === 'talk') {
      const key = `${member.id}|${date}`
      if (writtenTalks.has(key) || talksByMember.get(member.id)?.includes(date)) {
        known++
        continue
      }
      writtenTalks.add(key)
      push(newTalksByMember, member.id, date)

      const slot = (talksPerDate.get(date) ?? 0) + 1
      talksPerDate.set(date, slot)
      talks.push({ memberId: member.id, memberName, date, slot, note: entry.note })
      continue
    }

    const forDate = takenSlots.get(date) ?? new Map<PrayerSlot, string>()
    takenSlots.set(date, forDate)
    if ([...forDate.values()].includes(member.id)) {
      known++
      continue
    }

    const free = PRAYER_SLOTS_IN_ORDER.find((slot) => !forDate.has(slot))
    if (!free) {
      crowded.push({ date, memberName })
      continue
    }
    forDate.set(free, member.id)
    prayers.push({ memberId: member.id, memberName, date, slot: free })
  }

  /* Statistik der Mitglieder -------------------------------------- */

  const memberRows: HistoryMemberRow[] = []
  for (const [memberId, dates] of newTalksByMember) {
    const member = byId.get(memberId)
    if (!member) continue
    const all = [...(talksByMember.get(memberId) ?? []), ...dates]
    memberRows.push({
      memberId,
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      talkCount: all.length,
      // ISO-Daten lassen sich als Text vergleichen – das jüngste ist das grösste.
      lastTalkDate: all.reduce((latest, date) => (date > latest ? date : latest)),
    })
  }

  return {
    talks,
    prayers,
    members: memberRows,
    known,
    unmatched: [...unmatched.entries()]
      .map(([fullName, count]) => ({ fullName, count }))
      .sort((a, b) => b.count - a.count || a.fullName.localeCompare(b.fullName)),
    crowded,
  }
}
