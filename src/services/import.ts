import { collection, doc, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore'
import Papa from 'papaparse'
// Nur der Browser-Einstiegspunkt ist hier korrekt – die Node-Variante würde
// Server-APIs erwarten, die es im Bundle nicht gibt. `readSheet` liefert die
// Zeilen des ersten Arbeitsblatts; die Standardausgabe wäre eine Liste aller
// Blätter, und mehrblättrige Mitgliederlisten kommen in der Praxis nicht vor.
import { readSheet } from 'read-excel-file/browser'
import { db, COLLECTIONS } from '@/lib/firebase'
import { parseDirectoryDate } from '@/services/importPaste'
import { normalize } from '@/lib/utils'
import { requireOnline } from '@/lib/sync'
import { buildSearchName } from '@/services/members'
import type { Gender, Member, MemberStatus } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Dateien einlesen                                                    */
/* ------------------------------------------------------------------ */

export interface ParsedSheet {
  headers: string[]
  rows: string[][]
}

/** Liest XLSX oder CSV und liefert immer dieselbe Struktur zurück. */
export async function parseFile(file: File): Promise<ParsedSheet> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
  const raw = isCsv ? await parseCsv(file) : await parseXlsx(file)

  // Führende Leerzeilen überspringen – Exporte haben oft einen Titelkopf.
  const firstDataRow = raw.findIndex((row) => row.filter((cell) => cell.trim()).length >= 2)
  if (firstDataRow === -1) return { headers: [], rows: [] }

  const [headerRow, ...rest] = raw.slice(firstDataRow)
  const headers = headerRow.map((cell, index) => cell.trim() || `Spalte ${index + 1}`)

  const rows = rest
    .filter((row) => row.some((cell) => cell.trim()))
    // Auf Kopfzeilenbreite normalisieren, damit Index-Zugriffe sicher sind.
    .map((row) => headers.map((_, index) => (row[index] ?? '').trim()))

  return { headers, rows }
}

async function parseCsv(file: File): Promise<string[][]> {
  const text = await file.text()
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    // Trennzeichen automatisch erkennen (Semikolon ist im deutschsprachigen Raum üblich).
    delimiter: '',
  })
  return result.data.map((row) => row.map((cell) => String(cell ?? '')))
}

async function parseXlsx(file: File): Promise<string[][]> {
  const rows = await readSheet(file)
  return rows.map((row) =>
    row.map((cell) => {
      if (cell == null) return ''
      if (cell instanceof Date) {
        // Als ISO-Datum weitergeben, damit die Datumserkennung greift.
        return cell.toISOString().slice(0, 10)
      }
      return String(cell)
    }),
  )
}

/* ------------------------------------------------------------------ */
/* Spalten zuordnen                                                    */
/* ------------------------------------------------------------------ */

export type MemberField =
  | 'ignore'
  | 'lastName'
  | 'firstName'
  | 'fullName'
  | 'gender'
  | 'birthDate'
  | 'email'
  | 'phone'
  | 'mobile'
  | 'street'
  | 'zip'
  | 'city'
  | 'status'
  | 'lastTalkDate'
  | 'notes'
  | 'externalId'

export const FIELD_LABELS: Record<MemberField, string> = {
  ignore: '— nicht importieren —',
  lastName: 'Nachname',
  firstName: 'Vorname',
  fullName: 'Name (Nachname, Vorname)',
  gender: 'Geschlecht',
  birthDate: 'Geburtsdatum',
  email: 'E-Mail',
  phone: 'Telefon',
  mobile: 'Mobile',
  street: 'Strasse',
  zip: 'PLZ',
  city: 'Ort',
  status: 'Status (aktiv/inaktiv)',
  lastTalkDate: 'Letzte Ansprache',
  notes: 'Notiz',
  externalId: 'Mitglieds-Nr. (für Abgleich)',
}

/** Stichwörter je Zielfeld – deckt gängige Exporte (auch englische) ab. */
const HEADER_HINTS: Record<Exclude<MemberField, 'ignore'>, string[]> = {
  lastName: ['nachname', 'name nachname', 'familienname', 'last name', 'surname'],
  firstName: ['vorname', 'first name', 'given name', 'rufname'],
  fullName: ['name', 'vollstandiger name', 'preferred name', 'full name', 'mitglied'],
  gender: ['geschlecht', 'gender', 'sex', 'm/w'],
  birthDate: ['geburtsdatum', 'geburtstag', 'birth', 'birthdate', 'geb'],
  email: ['e-mail', 'email', 'mail', 'e mail'],
  phone: ['telefon', 'festnetz', 'phone', 'tel'],
  mobile: ['mobile', 'handy', 'natel', 'mobiltelefon', 'cell'],
  street: ['strasse', 'street', 'adresse', 'address'],
  zip: ['plz', 'postleitzahl', 'zip', 'postal'],
  city: ['ort', 'stadt', 'city', 'wohnort'],
  status: ['status', 'aktiv', 'aktivitat', 'active'],
  lastTalkDate: [
    'letzte ansprache',
    'ansprache',
    'letzte rede',
    'talk',
    'last talk',
    'zuletzt gesprochen',
  ],
  notes: ['notiz', 'notizen', 'bemerkung', 'kommentar', 'note', 'comment'],
  externalId: ['mitgliedsnummer', 'mitglieds-nr', 'nummer', 'id', 'member number', 'record number'],
}

/**
 * Rät für jede Spalte das passende Zielfeld.
 * Der Nutzer kann die Zuordnung im Import-Assistenten korrigieren –
 * das Raten spart bei 15 Spalten aber viel Klickarbeit.
 */
export function guessMapping(headers: string[]): MemberField[] {
  const used = new Set<MemberField>()

  return headers.map((header) => {
    const normalized = normalize(header)
    if (!normalized) return 'ignore'

    let best: { field: MemberField; score: number } = { field: 'ignore', score: 0 }

    for (const [field, hints] of Object.entries(HEADER_HINTS) as [
      Exclude<MemberField, 'ignore'>,
      string[],
    ][]) {
      // Jedes Feld nur einmal vergeben – ausser «ignore».
      if (used.has(field)) continue
      for (const hint of hints) {
        let score = 0
        if (normalized === hint) score = 100
        else if (normalized.startsWith(hint)) score = 80
        else if (normalized.includes(hint)) score = 60
        if (score > best.score) best = { field, score }
      }
    }

    if (best.field !== 'ignore') used.add(best.field)
    return best.field
  })
}

/* ------------------------------------------------------------------ */
/* Werte umwandeln                                                     */
/* ------------------------------------------------------------------ */

/**
 * Erkennt die gängigen Datumsschreibweisen: «14.08.1985», «1985-08-14»,
 * «14/08/1985», «14 Aug 1985» sowie Excel-Seriennummern.
 */
export function parseImportDate(value: string): Date | null {
  const text = value.trim()
  if (!text) return null

  // Excel-Seriennummer (Tage seit 30.12.1899)
  if (/^\d{5}$/.test(text)) {
    const serial = Number.parseInt(text, 10)
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? 1900 + Number.parseInt(y, 10) : Number.parseInt(y, 10)
    const date = new Date(year, Number.parseInt(m, 10) - 1, Number.parseInt(d, 10))
    return Number.isNaN(date.getTime()) ? null : date
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    const date = new Date(
      Number.parseInt(y, 10),
      Number.parseInt(m, 10) - 1,
      Number.parseInt(d, 10),
    )
    return Number.isNaN(date.getTime()) ? null : date
  }

  // «13 Apr 1996» und Verwandte – deutsche Monatsnamen versteht `new Date()` nicht.
  const named = parseDirectoryDate(text)
  if (named) return named

  const fallback = new Date(text)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

export function parseGender(value: string): Gender {
  const text = normalize(value)
  if (['m', 'mann', 'mannlich', 'male', 'herr', 'br', 'bruder', '1'].includes(text)) return 'm'
  if (['w', 'f', 'frau', 'weiblich', 'female', 'schwester', 'sr', '2'].includes(text)) return 'f'
  return 'unknown'
}

export function parseStatus(value: string): MemberStatus {
  const text = normalize(value)
  if (!text) return 'active'
  // «Weniger aktiv» und «weggezogen» kannte die App früher als eigene
  // Zustände. Sie kommen in alten Dateien noch vor und zählen jetzt,
  // wie alles andere ausser «aktiv», als inaktiv.
  const inactive = ['inaktiv', 'inactive', 'weniger', 'weggezogen', 'moved', 'nein', 'no', 'false']
  return inactive.some((word) => text.includes(word)) ? 'inactive' : 'active'
}

/** Zerlegt «von Allmen, Alain» oder «Alain von Allmen» in Vor- und Nachname. */
export function splitFullName(value: string): { firstName: string; lastName: string } {
  const text = value.trim()
  if (text.includes(',')) {
    const [last, first] = text.split(',')
    return { lastName: last.trim(), firstName: (first ?? '').trim() }
  }
  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: '', lastName: text }
  // Ohne Komma nehmen wir das letzte Wort als Nachnamen an.
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

/* ------------------------------------------------------------------ */
/* Vorschau und Abgleich                                               */
/* ------------------------------------------------------------------ */

export interface ImportRow {
  rowIndex: number
  data: Partial<Member> & { lastName: string; firstName: string }
  birthDate: Date | null
  lastTalkDate: Date | null
  externalId: string | null
  /** Bestehender Datensatz, falls erkannt */
  matchId: string | null
  matchReason: 'externalId' | 'name+birth' | 'name' | null
  action: 'create' | 'update' | 'skip'
  warnings: string[]
}

export interface ImportPreview {
  rows: ImportRow[]
  createCount: number
  updateCount: number
  skipCount: number
}

/**
 * Baut aus Rohdaten und Spaltenzuordnung eine Vorschau und markiert,
 * was neu angelegt und was aktualisiert würde.
 *
 * Der Abgleich läuft in drei Stufen: Mitgliedsnummer (sicher), dann
 * Name + Geburtsdatum (fast sicher), dann Name allein (mit Warnung).
 */
export function buildPreview(
  sheet: ParsedSheet,
  mapping: MemberField[],
  existing: Member[],
): ImportPreview {
  const byExternalId = new Map<string, Member>()
  const byNameAndBirth = new Map<string, Member>()
  const byName = new Map<string, Member[]>()

  for (const member of existing) {
    if (member.externalId) byExternalId.set(member.externalId, member)
    const nameKey = normalize(`${member.lastName}|${member.firstName}`)
    const birth = member.birthDate
      ? (member.birthDate instanceof Timestamp
          ? member.birthDate.toDate()
          : new Date(String(member.birthDate))
        )
          .toISOString()
          .slice(0, 10)
      : ''
    if (birth) byNameAndBirth.set(`${nameKey}|${birth}`, member)
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), member])
  }

  const rows: ImportRow[] = sheet.rows.map((cells, rowIndex) => {
    const warnings: string[] = []
    const values: Partial<Record<MemberField, string>> = {}

    mapping.forEach((field, columnIndex) => {
      if (field === 'ignore') return
      const value = cells[columnIndex]?.trim()
      if (value) values[field] = value
    })

    let firstName = values.firstName ?? ''
    let lastName = values.lastName ?? ''
    if (!firstName && !lastName && values.fullName) {
      const split = splitFullName(values.fullName)
      firstName = split.firstName
      lastName = split.lastName
    }

    const birthDate = values.birthDate ? parseImportDate(values.birthDate) : null
    if (values.birthDate && !birthDate) warnings.push('Geburtsdatum nicht lesbar')

    const lastTalkDate = values.lastTalkDate ? parseImportDate(values.lastTalkDate) : null
    if (values.lastTalkDate && !lastTalkDate)
      warnings.push('Datum der letzten Ansprache nicht lesbar')

    const externalId = values.externalId ?? null

    /* Abgleich mit bestehenden Datensätzen */
    let matchId: string | null = null
    let matchReason: ImportRow['matchReason'] = null

    const nameKey = normalize(`${lastName}|${firstName}`)
    if (externalId && byExternalId.has(externalId)) {
      matchId = byExternalId.get(externalId)!.id
      matchReason = 'externalId'
    } else if (
      birthDate &&
      byNameAndBirth.has(`${nameKey}|${birthDate.toISOString().slice(0, 10)}`)
    ) {
      matchId = byNameAndBirth.get(`${nameKey}|${birthDate.toISOString().slice(0, 10)}`)!.id
      matchReason = 'name+birth'
    } else {
      const candidates = byName.get(nameKey) ?? []
      if (candidates.length === 1) {
        matchId = candidates[0].id
        matchReason = 'name'
        warnings.push('Zuordnung nur über den Namen – bitte prüfen')
      } else if (candidates.length > 1) {
        warnings.push(`${candidates.length} Personen mit gleichem Namen – keine Zuordnung`)
      }
    }

    const valid = Boolean(lastName || firstName)
    if (!valid) warnings.push('Kein Name gefunden')

    return {
      rowIndex,
      data: {
        lastName,
        firstName,
        gender: values.gender ? parseGender(values.gender) : 'unknown',
        email: values.email ?? '',
        phone: values.phone ?? '',
        mobile: values.mobile ?? '',
        street: values.street ?? '',
        zip: values.zip ?? '',
        city: values.city ?? '',
        status: values.status ? parseStatus(values.status) : 'active',
        notes: values.notes ?? '',
      },
      birthDate,
      lastTalkDate,
      externalId,
      matchId,
      matchReason,
      action: !valid ? 'skip' : matchId ? 'update' : 'create',
      warnings,
    }
  })

  return {
    rows,
    createCount: rows.filter((r) => r.action === 'create').length,
    updateCount: rows.filter((r) => r.action === 'update').length,
    skipCount: rows.filter((r) => r.action === 'skip').length,
  }
}

/* ------------------------------------------------------------------ */
/* Schreiben                                                           */
/* ------------------------------------------------------------------ */

export interface ImportOptions {
  /** Leere Zellen sollen bestehende Werte nicht überschreiben */
  keepExistingOnEmpty: boolean
  /** Notizen beim Aktualisieren unangetastet lassen */
  preserveNotes: boolean
  /** Status bestehender Mitglieder nicht überschreiben */
  preserveStatus: boolean
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  keepExistingOnEmpty: true,
  preserveNotes: true,
  preserveStatus: true,
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
}

/**
 * Schreibt die Vorschau nach Firestore.
 *
 * In Batches zu 400 Dokumenten – Firestore erlaubt 500 Schreibvorgänge
 * pro Batch, und wir lassen bewusst Luft.
 */
export async function runImport(
  preview: ImportPreview,
  options: ImportOptions = DEFAULT_IMPORT_OPTIONS,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  // Ein Import schreibt Hunderte Dokumente. Die gehören nicht in die
  // Offline-Warteschlange – siehe requireOnline().
  requireOnline()
  const rows = preview.rows.filter((row) => row.action !== 'skip')
  const membersCollection = collection(db, COLLECTIONS.members)
  let created = 0
  let updated = 0

  for (let offset = 0; offset < rows.length; offset += 400) {
    const chunk = rows.slice(offset, offset + 400)
    const batch = writeBatch(db)

    for (const row of chunk) {
      const base: Record<string, unknown> = {
        lastName: row.data.lastName,
        firstName: row.data.firstName,
        searchName: buildSearchName(row.data.firstName ?? '', row.data.lastName ?? ''),
        gender: row.data.gender,
        birthDate: row.birthDate ? Timestamp.fromDate(row.birthDate) : null,
        email: row.data.email,
        phone: row.data.phone,
        mobile: row.data.mobile,
        street: row.data.street,
        zip: row.data.zip,
        city: row.data.city,
        externalId: row.externalId,
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      if (row.action === 'create') {
        batch.set(doc(membersCollection), {
          ...base,
          status: row.data.status ?? 'active',
          notes: row.data.notes ?? '',
          availableForTalks: true,
          ministeringPartnerIds: [],
          ministeringAssignedIds: [],
          lastTalkDate: row.lastTalkDate ? Timestamp.fromDate(row.lastTalkDate) : null,
          talkCount: 0,
          tags: [],
          createdAt: serverTimestamp(),
        })
        created++
      } else if (row.matchId) {
        const patch: Record<string, unknown> = { ...base }

        if (options.keepExistingOnEmpty) {
          // Leere Importwerte entfernen, damit gepflegte Daten erhalten bleiben.
          for (const key of ['email', 'phone', 'mobile', 'street', 'zip', 'city'] as const) {
            if (!patch[key]) delete patch[key]
          }
          if (!row.birthDate) delete patch.birthDate
          if (!row.externalId) delete patch.externalId
        }
        if (!options.preserveStatus && row.data.status) patch.status = row.data.status
        if (!options.preserveNotes && row.data.notes) patch.notes = row.data.notes
        // Ein neueres Ansprachedatum aus der Liste darf nachgetragen werden.
        if (row.lastTalkDate) patch.lastTalkDate = Timestamp.fromDate(row.lastTalkDate)

        batch.update(doc(db, COLLECTIONS.members, row.matchId), patch)
        updated++
      }
    }

    await batch.commit()
    onProgress?.(Math.min(offset + chunk.length, rows.length), rows.length)
  }

  return { created, updated, skipped: preview.skipCount }
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

/** Erzeugt eine CSV-Sicherung der Mitgliederliste (Excel-freundlich). */
export function membersToCsv(members: Member[]): string {
  const header = [
    'Mitglieds-Nr.',
    'Nachname',
    'Vorname',
    'Geschlecht',
    'Geburtsdatum',
    'E-Mail',
    'Telefon',
    'Mobile',
    'Strasse',
    'PLZ',
    'Ort',
    'Status',
    'Letzte Ansprache',
    'Anzahl Ansprachen',
    'Notiz',
  ]

  const asDate = (value: unknown): string => {
    if (!value) return ''
    const date = value instanceof Timestamp ? value.toDate() : new Date(String(value))
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
  }

  const rows = members.map((m) => [
    m.externalId ?? '',
    m.lastName,
    m.firstName,
    m.gender,
    asDate(m.birthDate),
    m.email ?? '',
    m.phone ?? '',
    m.mobile ?? '',
    m.street ?? '',
    m.zip ?? '',
    m.city ?? '',
    m.status,
    asDate(m.lastTalkDate),
    String(m.talkCount ?? 0),
    (m.notes ?? '').replace(/\r?\n/g, ' '),
  ])

  return Papa.unparse([header, ...rows], { delimiter: ';' })
}

/** Löst im Browser einen Datei-Download aus. */
export function downloadCsv(content: string, filename: string): void {
  // BOM voranstellen, damit Excel die Umlaute korrekt liest.
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
