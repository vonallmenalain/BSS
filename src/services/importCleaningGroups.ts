// Mit Dateiendung, damit sich das Modul auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { matchesGivenNames, nameKeys } from '../lib/names.ts'
import { pdfLines, pdfSegments, pdfTextItems, type PdfSegment } from '../lib/pdfText.ts'
import { buildMemberIndex, matchMemberByName, type MemberIndex } from './importMatch.ts'
import type { Member } from '../lib/types.ts'

/**
 * Die Gruppeneinteilung fürs Putzen einlesen.
 *
 * Die Liste der Gemeinde ist eine Tabelle aus Google Docs: links «Gruppe 1»
 * bis «Gruppe 10», rechts je Gruppe die Haushalte – «Bader Roger & Sylvie»,
 * «Römer David» –, der zuständige **fett** zuoberst. Sie kommt auf zwei Wegen
 * herein:
 *
 *  - **als PDF**, wie sie verschickt wird. Gelesen wird die Datei selbst
 *    (`lib/pdfText`): Sie kennt die Lage jedes Wortes und die Schrift, und
 *    damit auch, wer fett dasteht.
 *  - **als eingefügter Text** – aus Google Docs oder einem PDF-Programm. Dann
 *    gilt der erste Eintrag einer Gruppe als zuständig, wie auf der Liste.
 *
 * Beides läuft auf dieselben Zeilen hinaus: «Gruppe N» beginnt eine Gruppe,
 * jede weitere Zeile ist ein Eintrag. Was davor steht – die Überschrift mit
 * der Version –, fällt weg.
 *
 * Danach werden die Einträge den **aktiven Mitgliedern** zugeordnet
 * (`matchEntryMembers`). Was sich nicht zuordnen lässt, bleibt als Name
 * stehen und wird gemeldet; zugeordnet wird es danach von Hand unter
 * «Putzplan › Gruppeneinteilung».
 *
 * Bewusst frei von Firestore und React, damit sich das Lesen mit
 * `node --test` prüfen lässt.
 */

/** Eine Zeile der Liste – ihre Spalten, und ob sie fett gesetzt sind. */
export type GroupLine = PdfSegment[]

export interface ParsedCleaningGroupEntry {
  label: string
  /** Fett gesetzt – so markiert die Liste den zuständigen Haushalt */
  bold: boolean
}

export interface ParsedCleaningGroup {
  number: number
  /** Der zuständige Eintrag steht zuoberst */
  entries: ParsedCleaningGroupEntry[]
}

export interface ParsedCleaningGroups {
  groups: ParsedCleaningGroup[]
  /** «Version 12.05.2026» – aus der Überschrift, sofern sie eine nennt */
  version: string
  /**
   * Die Liste kam spaltenweise: erst alle «Gruppe N», dann alle Namen am
   * Stück. Welcher Name in welche Gruppe gehört, lässt sich dann nicht mehr
   * sagen – die Vorschau bittet um das PDF.
   */
  columns: boolean
}

/** «Gruppe 7», « Gruppe 10:» – und was danach auf derselben Zeile steht. */
const GROUP_HEADING = /^\s*gruppe\s*(\d{1,2})\b[\s:.\-–—|]*(.*)$/i

/** Text aus dem Eingabefeld als Zeilen – Tabulatoren trennen Spalten. */
export function linesFromText(text: string): GroupLine[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .split('\t')
        .map((cell) => cell.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .map((cell) => ({ text: cell, bold: false })),
    )
    .filter((line) => line.length > 0)
}

/** Eine PDF-Datei als Zeilen – leer, wenn sie sich so nicht lesen lässt. */
export async function linesFromPdf(bytes: Uint8Array): Promise<GroupLine[]> {
  try {
    return pdfLines(await pdfTextItems(bytes))
      .map((line) => pdfSegments(line))
      .filter((line) => line.length > 0)
  } catch (error) {
    console.warn('[import] PDF nicht lesbar:', error)
    return []
  }
}

/** Liest die Gruppen aus den Zeilen der Liste. */
export function parseCleaningGroups(lines: readonly GroupLine[]): ParsedCleaningGroups {
  const groups: ParsedCleaningGroup[] = []
  let version = ''
  let current: ParsedCleaningGroup | null = null

  const add = (label: string, bold: boolean) => {
    const text = label.replace(/\s+/g, ' ').trim()
    if (current && text) current.entries.push({ label: text, bold })
  }

  for (const line of lines) {
    const joined = line.map((segment) => segment.text).join(' ')
    const heading = GROUP_HEADING.exec(joined)
    if (heading) {
      const number = Number(heading[1])
      current = groups.find((group) => group.number === number) ?? null
      if (!current) {
        current = { number, entries: [] }
        groups.push(current)
      }
      // Steht der erste Name auf derselben Zeile, ist er eine eigene Spalte –
      // fett oder nicht, wie sein Stück.
      const rest = heading[2].trim()
      if (rest) {
        const named = line.filter((segment) => !GROUP_HEADING.test(segment.text))
        const bold =
          named.length > 0 ? named.every((segment) => segment.bold) : (line.at(-1)?.bold ?? false)
        add(rest, bold)
      }
      continue
    }
    if (!current) {
      const found = joined.match(/version\s+([\d.]+)/i)
      if (found) version = found[1]
      continue
    }
    add(joined, line.length > 0 && line.every((segment) => segment.bold))
  }

  groups.sort((a, b) => a.number - b.number)

  // Spaltenweise: Alle Gruppen bis auf die letzte sind leer, die letzte hat
  // alle Namen. Eine Liste mit genau einer Gruppe ist davon nicht betroffen.
  const columns =
    groups.length > 1 &&
    groups.slice(0, -1).every((group) => group.entries.length === 0) &&
    (groups.at(-1)?.entries.length ?? 0) > 0

  // Wer zuständig ist, steht zuoberst: der fett gesetzte Eintrag – ohne
  // Fettdruck (eingefügter Text) bleibt der erste, wie auf der Liste.
  for (const group of groups) {
    const index = group.entries.findIndex((entry) => entry.bold)
    if (index > 0) group.entries.unshift(...group.entries.splice(index, 1))
  }

  return { groups, version, columns }
}

/* ------------------------------------------------------------------ */
/* Den Mitgliedern zuordnen                                            */
/* ------------------------------------------------------------------ */

export interface EntryMatch {
  /** Die zugeordneten Mitglieder, in der Reihenfolge der Namen */
  memberIds: string[]
  /** Namen, die sich niemandem zuordnen liessen – «Seeber Jennife» */
  unmatched: string[]
}

export interface EntryName {
  lastName: string
  /** Je Person die Vornamen – «Roger», «Sylvie» */
  givenNames: string[]
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

function knownLastName(text: string, index: MemberIndex): boolean {
  return nameKeys(text).some((key) => index.byLastName.has(key))
}

/**
 * Zerlegt einen Eintrag in Nachname und Vornamen.
 *
 * Die Liste schreibt «Nachname Vorname & Vorname» – meistens. Nachnamen haben
 * auch zwei Wörter («von Allmen», «Den Brower»), und einmal steht der Name
 * andersherum («Hansruedi Rothenbühler»). Entschieden wird deshalb am
 * Verzeichnis: Welcher Anfang – oder welches Ende – des ersten Namens ist ein
 * bekannter Nachname? Ohne Treffer gilt das erste Wort als Nachname.
 */
export function splitEntryLabel(label: string, index: MemberIndex): EntryName {
  const [head = '', ...others] = label
    .split(/\s*(?:&|\+|,|\bund\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
  const parts = words(head)

  let lastName = parts[0] ?? ''
  let first = parts.slice(1).join(' ')
  let found = false
  for (let take = parts.length - 1; take >= 1 && !found; take--) {
    const candidate = parts.slice(0, take).join(' ')
    if (knownLastName(candidate, index)) {
      lastName = candidate
      first = parts.slice(take).join(' ')
      found = true
    }
  }
  for (let skip = 1; skip < parts.length && !found; skip++) {
    const candidate = parts.slice(skip).join(' ')
    if (knownLastName(candidate, index)) {
      lastName = candidate
      first = parts.slice(0, skip).join(' ')
      found = true
    }
  }

  return { lastName, givenNames: [first, ...others].filter(Boolean) }
}

/** Ein Vorname mit Tippfehler am Ende – «Jennife» für «Jennifer». */
function prefixMatch(given: string, lastName: string, index: MemberIndex): Member | null {
  const wanted = nameKeys(given)[0]
  if (!wanted || wanted.length < 4) return null
  const candidates = nameKeys(lastName).flatMap((key) => index.byLastName.get(key) ?? [])
  const hits = [...new Set(candidates)].filter((member) =>
    nameKeys(member.firstName.split(/[\s-]+/)[0] ?? '').some(
      (key) => key.startsWith(wanted) || wanted.startsWith(key),
    ),
  )
  return hits.length === 1 ? hits[0] : null
}

/** Die Bestandteile eines Nachnamens – «Morales-Römer» → «morales», «roemer». */
function namePieces(lastName: string): Set<string> {
  return new Set(
    lastName
      .split(/[\s-]+/)
      .filter((piece) => piece.length > 1)
      .flatMap((piece) => nameKeys(piece)),
  )
}

/**
 * Ein Doppelname auf einer Seite: «Morales-Römer Oscar & Céleste», und
 * Céleste heisst nur «Römer» – oder «Schär Noé & Céline», und Céline heisst
 * «Schär-Bühler». Es genügt ein gemeinsamer Bestandteil des Nachnamens, wenn
 * der Vorname passt und genau eine Person übrig bleibt.
 */
function sharedFamilyName(given: string, lastName: string, index: MemberIndex): Member | null {
  const wanted = namePieces(lastName)
  const everyone = new Set([...index.byLastName.values()].flat())
  const hits = [...everyone].filter(
    (member) =>
      matchesGivenNames(given, member.firstName) &&
      [...namePieces(member.lastName)].some((piece) => wanted.has(piece)),
  )
  return hits.length === 1 ? hits[0] : null
}

/** Eine Person: Nachname der Familie, sonst ein Teil davon, sonst ein Tippfehler. */
function matchPerson(given: string, lastName: string, index: MemberIndex): Member | null {
  const direct = matchMemberByName(`${lastName}, ${given}`, index)
  if (direct.member) return direct.member
  if (direct.ambiguous) return null

  const shared = sharedFamilyName(given, lastName, index)
  if (shared) return shared

  // Ein weiterer Name mit eigenem Nachnamen: «… & Leo Muster».
  const own = words(given)
  if (own.length > 1) {
    const split = splitEntryLabel(given, index)
    if (split.lastName !== lastName) {
      const other = matchMemberByName(`${split.lastName}, ${split.givenNames.join(' ')}`, index)
      if (other.member) return other.member
    }
  }

  return prefixMatch(given, lastName, index)
}

/**
 * Ordnet einen Eintrag den Mitgliedern zu.
 *
 * Je Person wird gesucht: mit dem Nachnamen der Familie, dann mit einem Teil
 * eines Doppelnamens, dann mit einem Vornamen, dessen Ende fehlt. Was danach
 * offen oder mehrdeutig bleibt, wird gemeldet statt geraten – zuordnen lässt
 * es sich danach von Hand.
 */
export function matchEntryMembers(label: string, index: MemberIndex): EntryMatch {
  const { lastName, givenNames } = splitEntryLabel(label, index)
  const memberIds: string[] = []
  const unmatched: string[] = []
  for (const given of givenNames.length > 0 ? givenNames : ['']) {
    const member = given ? matchPerson(given, lastName, index) : null
    if (member && !memberIds.includes(member.id)) memberIds.push(member.id)
    else if (!member) unmatched.push([lastName, given].filter(Boolean).join(' '))
  }
  return { memberIds, unmatched }
}

/** Der Index über die aktiven Mitglieder – nur sie werden eingeteilt. */
export function activeMemberIndex(members: readonly Member[]): MemberIndex {
  return buildMemberIndex(members.filter((member) => member.status === 'active'))
}
