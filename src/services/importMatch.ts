// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { normalize } from '../lib/utils.ts'
import { matchesGivenNames, nameKeys, sameGivenNames } from '../lib/names.ts'
import { isoDate } from './importHistory.ts'
import { parseDirectoryDate } from './importPaste.ts'
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

/**
 * Ein Berufungswechsel: Dieselbe Person verliert eine Berufung und erhält
 * im selben Import eine neue.
 *
 * Das ist der Regelfall einer Umberufung, und er ist der einzige Moment, in
 * dem sich das Entlassungsdatum ehrlich bestimmen lässt: Wer am 6. Juli als
 * Sekretär bestätigt wird, ist an ebendiesem Tag aus der bisherigen Aufgabe
 * entlassen worden. Das LCR schreibt darüber nichts – es zeigt nur den
 * heutigen Stand, und die alte Berufung ist dort schlicht verschwunden.
 *
 * Deshalb wird der Wechsel vor dem Schreiben gezeigt und nicht still
 * angenommen: Bestätigt werden kann er mit einem Blick, und wo das Datum
 * nicht stimmt, lässt es sich von Hand setzen.
 */
export interface CallingChange {
  memberId: string
  memberName: string
  /** Die laufende Berufung, die in der Quelle fehlt */
  released: Calling
  /** Die neue Berufung derselben Person aus der Quelle */
  incoming: CallingRow
  /**
   * Vorgeschlagenes Entlassungsdatum «yyyy-MM-dd» – das Berufungsdatum der
   * neuen Berufung. `null`, wenn die Quelle dazu nichts hergibt.
   */
  releaseDate: string | null
}

export interface CallingsPreview {
  rows: CallingRow[]
  /** Laufende Berufungen, die in der Quelle fehlen – werden entlassen */
  releases: Calling[]
  /** Entlassungen, zu denen dieselbe Person eine neue Berufung erhält */
  changes: CallingChange[]
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
 * mitkommt: Wer heute FHV-Lehrerin ist, war es vielleicht schon einmal.
 * Zwei Regeln halten den Abgleich davon ab, den falschen zu treffen.
 *
 * **Übernommene Vergangenheit zählt nicht mit.** Sie ist abgeschlossen und
 * soll es bleiben; ein Import würde sie sonst wieder aufwecken und dabei
 * ihre Daten überschreiben.
 *
 * **Unter den übrigen gilt die laufende.** Sonst entliesse ein Import die
 * laufende Berufung und weckte eine frühere – und beim nächsten Mal
 * wanderte es zurück.
 */
function indexByKey(callings: Calling[]): Map<string, Calling> {
  const index = new Map<string, Calling>()
  for (const calling of callings) {
    if (calling.history) continue
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
    changes: pairChanges(rows, releases),
    createCount: rows.filter((r) => r.action === 'create').length,
    updateCount: rows.filter((r) => r.action === 'update').length,
    skipCount: rows.filter((r) => r.action === 'skip').length,
    vacant: pasted.vacant,
  }
}

/** Das Berufungsdatum einer gelesenen Zeile als «yyyy-MM-dd». */
function startDateOf(row: CallingRow): string | null {
  // Bestätigt zuerst: Ab da erfüllt jemand die Aufgabe, das Einsetzen folgt
  // oft erst eine Woche später. Fehlt es, dient das Einsetzungsdatum.
  const date = parseDirectoryDate(row.parsed.sustained) ?? parseDirectoryDate(row.parsed.setApart)
  return date ? isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) : null
}

/**
 * Ordnet jeder wegfallenden Berufung eine neue derselben Person zu.
 *
 * Gepaart wird der Reihe nach und höchstens einmal: Wer zwei Berufungen
 * abgibt und eine neue erhält, hat einen Wechsel und eine gewöhnliche
 * Entlassung – welche welche ist, weiss die Quelle nicht, und geraten wird
 * hier nichts. Beides steht in der Vorschau und lässt sich dort richtigstellen.
 *
 * Nur **neue** Berufungen zählen als Gegenstück. Eine bloss aktualisierte
 * bestand schon vorher; sie erklärt keine Entlassung.
 */
function pairChanges(rows: CallingRow[], releases: Calling[]): CallingChange[] {
  const open = new Map<string, CallingRow[]>()
  for (const row of rows) {
    if (row.action !== 'create' || !row.memberId) continue
    push(open, row.memberId, row)
  }

  return releases.flatMap((released) => {
    const incoming = open.get(released.memberId)?.shift()
    if (!incoming) return []
    return [
      {
        memberId: released.memberId,
        memberName: released.memberName,
        released,
        incoming,
        releaseDate: startDateOf(incoming),
      },
    ]
  })
}

/* ------------------------------------------------------------------ */
/* Berufungshistorie                                                   */
/* ------------------------------------------------------------------ */

/**
 * Was mit einer gelesenen Berufung geschieht.
 *
 *  - `create`  – wird als abgeschlossene Berufung in den Verlauf geschrieben.
 *  - `running` – die Person erfüllt diese Berufung laut Bestand heute noch;
 *                der Eintrag wird **nicht** geschrieben und der laufende
 *                Datensatz **nicht** angefasst.
 *  - `skip`    – kein Mitglied gefunden; wird gemeldet, nicht geschrieben.
 *  - `ignore`  – als «kein Mitglied unserer Gemeinde» abgelegt.
 */
export type CallingHistoryAction = 'create' | 'running' | 'skip' | 'ignore'

export interface CallingHistoryRow {
  calling: HistoricCalling
  memberId: string | null
  memberName: string
  /** Laufende Berufung derselben Person in derselben Rolle – bleibt unberührt */
  existingId: string | null
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
  runningCount: number
  skipCount: number
  ignoredCount: number
  /** Personen, die Verlauf erhalten – mit der Anzahl ihrer Berufungen */
  members: { memberId: string; memberName: string; count: number }[]
  /** Namen ohne erfasste Person, mit der Anzahl ihrer Einträge */
  unmatched: { fullName: string; count: number }[]
  /** Weggelegte Namen – «kein Mitglied unserer Gemeinde» */
  dismissed: { fullName: string; count: number }[]
  /**
   * Übernommene Berufungen, zu denen keine Entlassung in der Liste steht
   * und die im laufenden Bestand fehlen.
   *
   * Sie sind der Grund, weshalb dieser Import nichts anlegt, was laufen
   * könnte: Ob die Person die Aufgabe heute noch hat oder ob bloss die
   * Entlassung nie eingetragen wurde, weiss die Tabelle nicht. Deshalb
   * kommen sie als Verlauf mit und stehen danach hier – zum Nachschauen
   * und Nachtragen von Hand.
   */
  withoutRelease: CallingHistoryRow[]
}

/**
 * Ordnet die gelesene Berufungshistorie den erfassten Personen zu.
 *
 * **Dieser Import schreibt nur Vergangenes.** Die Wahrheit über den
 * laufenden Stand steht im LCR; was von dort kommt, wird hier weder
 * geändert noch ergänzt noch entlassen. Jede übernommene Berufung ist
 * deshalb eine abgeschlossene – auch die, zu der keine Entlassung erfasst
 * ist.
 *
 * Das ist keine Bequemlichkeit, sondern die einzige Lesart, die nichts
 * kaputtmacht. Wo in der Tabelle keine Entlassung steht, ist entweder
 * keine eingetragen worden oder die Person hat die Aufgabe heute noch –
 * beides sieht gleich aus. Eine laufende Berufung daraus abzuleiten hiesse
 * raten, und geraten würde ausgerechnet dort, wo der Organisationsplan der
 * Gemeinde steht. Solche Einträge kommen deshalb als Verlauf mit dem
 * Vermerk «keine Entlassung erfasst» und erscheinen danach in
 * `withoutRelease` – von Hand nachzutragen, wenn wirklich etwas fehlt.
 *
 * Wo derselbe Eintrag im Bestand noch läuft, wird gar nichts geschrieben:
 * Der laufende Datensatz bleibt, wie das LCR ihn kennt, und daneben soll
 * kein zweiter mit denselben Angaben stehen.
 */
export function buildCallingHistoryPreview(
  parsed: ParsedCallingHistory,
  members: Member[],
  existing: Calling[],
  decisions: CallingHistoryDecisions = { overrides: {}, ignored: [] },
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

    if (ignored.has(calling.fullName)) {
      dismissed.set(calling.fullName, (dismissed.get(calling.fullName) ?? 0) + 1)
      return {
        calling,
        memberId: null,
        memberName: calling.fullName,
        existingId: null,
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
        action: 'skip',
        warnings,
      }
    }

    if (!calling.position) warnings.push('Ohne Amt in der Quelle')

    /*
     * Nur eine Berufung ohne erfasste Entlassung kann die laufende meinen.
     * Eine abgeschlossene ist immer ein eigener Abschnitt – wer eine
     * Aufgabe zweimal innehatte, soll sie auch zweimal sehen.
     */
    const running = calling.released
      ? undefined
      : existingByKey.get(
          callingKey(member.id, calling.position, calling.organization, calling.outOfUnit),
        )

    if (running && isRunning(running)) {
      return {
        calling,
        memberId: member.id,
        memberName: `${member.lastName}, ${member.firstName}`,
        existingId: running.id,
        action: 'running',
        warnings,
      }
    }

    perMember.set(member.id, (perMember.get(member.id) ?? 0) + 1)
    return {
      calling,
      memberId: member.id,
      memberName: `${member.lastName}, ${member.firstName}`,
      existingId: null,
      action: 'create',
      warnings,
    }
  })

  const count = (action: CallingHistoryAction) => rows.filter((row) => row.action === action).length

  return {
    rows,
    createCount: count('create'),
    runningCount: count('running'),
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
    // Die jüngsten zuoberst: Je näher der Eintrag an heute liegt, desto eher
    // steckt dahinter eine Aufgabe, die jemand noch erfüllt – und desto eher
    // lohnt das Nachschauen.
    withoutRelease: rows
      .filter((row) => row.action === 'create' && !row.calling.released)
      .sort((a, b) => (b.calling.startDate ?? '').localeCompare(a.calling.startDate ?? '')),
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
