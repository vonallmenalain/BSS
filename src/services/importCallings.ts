// Mit Dateiendung, damit sich der Parser auch ohne Bundler ausführen lässt
// (`node --test`). Vite und TypeScript lösen das genauso auf.
import { parseDirectoryDate } from './importPaste.ts'
import type { Organization } from '@/lib/types'

/**
 * Berufungen aus «Hilfsmittel für Führungsbeamte und Sekretäre» (LCR)
 * als Text einlesen – aus zwei Quellen:
 *
 *  - Organisationen (`/mlt/orgs`): die Berufungen der eigenen Gemeinde,
 *    nach Organisation und Untergruppe gegliedert.
 *  - Berufungen ausserhalb der Einheit (`/mlt/orgs/out-of-unit-callings`):
 *    eine flache Tabelle Berufung / Name / Bestätigt.
 *
 * Aufbau eines Eintrags auf der Organisationsseite (Tabulatoren als →):
 *
 *     Bischofschaft                      ← Organisation
 *     Berufung → Name → Bestätigt → Eingesetzt
 *     Bischof                            ← Berufung
 *     Wilson, Joshua Howard              ← Name (fehlt bei «Berufung offen»)
 *     6 Nov 2022                         ← bestätigt, optional eingesetzt
 *     Anzahl: 12                         ← Ende der Tabelle
 *
 * Offene Berufungen werden gelesen, aber nicht importiert – sie gehören
 * keiner Person. Sie zu zählen ist trotzdem nützlich, deshalb erscheinen
 * sie in der Vorschau.
 *
 * Wie `importPaste.ts` bewusst ohne Abhängigkeiten zur Firestore-Schicht,
 * damit sich der Parser mit `node --test` direkt ausführen lässt.
 */

/* ------------------------------------------------------------------ */
/* Zeilen vorbereiten                                                  */
/* ------------------------------------------------------------------ */

/** Kleinbuchstaben, Umlaute aufgelöst, Mehrfach-Leerzeichen normalisiert. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Navigation und Bedienelemente der LCR-Seite. */
const JUNK = new Set([
  'skip to main content',
  'sign in',
  'anmelden',
  'kirche jesu christi der heiligen der letzten tage',
  'hilfsmittel fur fuhrungsbeamte und sekretare',
  'profile picture',
  'hilfe',
  'suchen',
  'drucken',
  'mitglieder, berichte und formulare suchen',
  'meine gemeinde',
  'andere einheiten und fuhrungsverantwortliche',
  'organisationen',
  'anwesenheitslisten',
  'ergebnisse filtern',
  'optionen',
  'spalten',
  'berufung hinzufugen',
  'keine berufungen',
  'feedback geben',
  'berufungen der mitglieder',
  'berufungen ausserhalb der einheit',
  'tabelle durchsuchen',
  'berufungen im pfahl',
  'erfullt eine berufung ausserhalb der zugewiesenen einheit',
  'lebt ausserhalb der einheit',
  'berufungen',
  'mitglieder',
  'betreuung',
  'bei der berufung neuer fuhrungsverantwortlicher kann es bis zu 24 stunden dauern, bis die anderungen in allen damit verbundenen systemen angezeigt werden.',
])

/** «Anzahl: 12» schliesst eine Tabelle ab. */
const COUNT_LINE = /^anzahl: ?\d+/
/** Tabellenkopf der Berufungsliste – geprüft wird die gefaltete Zeile,
 *  in der Tabulatoren bereits zu Leerzeichen geworden sind. */
const TABLE_HEAD = /^berufung name bestatigt/
/** Zusatz unter dem Berufungsnamen. */
const CUSTOM = 'benutzerdefinierte berufung'
/** Platzhalter, wenn die Berufung niemandem zugewiesen ist. */
const VACANT = 'berufung offen'

/**
 * Zerlegt den eingefügten Text in Zeilen und wirft Seitenelemente weg.
 * Zellen bleiben durch Tabulatoren getrennt, damit sich Kopfzeile und
 * Datumsspalten weiterhin erkennen lassen.
 */
function prepareLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u202f]/g, ' ')
    .split('\n')
    .map((line) =>
      line
        .split('\t')
        .map((cell) => cell.trim())
        .filter((cell) => cell && !JUNK.has(fold(cell)))
        .join('\t'),
    )
    .filter(Boolean)
}

/* ------------------------------------------------------------------ */
/* Organisation bestimmen                                              */
/* ------------------------------------------------------------------ */

/**
 * Die festen Überschriften der Organisationsseite.
 *
 * Nur diese gelten als Organisation; alles andere vor einer Tabelle ist
 * eine Untergruppe («Präsidentschaft des Ältestenkollegiums», «Musik» …).
 */
const ORGANIZATIONS: [RegExp, Organization][] = [
  [/^bischofschaft$/, 'bishopric'],
  [/^altestenkollegium$/, 'elders_quorum'],
  [/^frauenhilfsvereinigung$/, 'relief_society'],
  [/aaronischen priestertums/, 'young_men'],
  [/^junge damen$/, 'young_women'],
  [/^sonntagsschule$/, 'sunday_school'],
  [/^primarvereinigung$/, 'primary'],
  [/^gemeindemissionare$/, 'missionary'],
  [/^tempel und familiengeschichte$/, 'temple_family_history'],
  [/^junger alleinstehender erwachsener$/, 'other'],
  [/^sonstige berufungen$/, 'other'],
]

/**
 * Untergruppen, die für sich eine eigene Organisation ergeben.
 * Greift nur unter «Sonstige Berufungen» – unter der FHV bleibt «Musik»
 * bei der FHV, sonst verlöre die Zuordnung ihre Aussage.
 */
const SUB_ORGANIZATIONS: [RegExp, Organization][] = [
  [/^musik$/, 'music'],
  [/^wohlfahrt und eigenstandigkeit$/, 'welfare'],
]

function matchOrganization(line: string): Organization | null {
  const key = fold(line)
  for (const [pattern, organization] of ORGANIZATIONS) {
    if (pattern.test(key)) return organization
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Ergebnis                                                            */
/* ------------------------------------------------------------------ */

export interface PastedCalling {
  /** «Nachname, Vorname» wie im Verzeichnis – leer bei offener Berufung */
  fullName: string
  position: string
  organization: Organization
  /** Überschrift der Organisation, wie sie im LCR steht */
  organizationLabel: string
  /** Untergruppe innerhalb der Organisation, z. B. «Lehrkräfte» */
  group: string
  /** Datum der Bestätigung, im Originalformat («6 Nov 2022») */
  sustained: string
  /** Datum der Einsetzung, sofern erfasst */
  setApart: string
  /** «Benutzerdefinierte Berufung» */
  custom: boolean
  /** Berufung ausserhalb der eigenen Einheit */
  outOfUnit: boolean
}

export interface PastedCallings {
  /** Welche der beiden Seiten gelesen wurde */
  source: CallingSource
  /** Berufungen mit zugewiesener Person */
  callings: PastedCalling[]
  /** Anzahl gelesener, aber offener Berufungen */
  vacant: number
  /**
   * Organisationen, deren Tabelle in der Quelle stand – auch dann, wenn
   * darin nur offene Berufungen standen.
   *
   * Sie legen fest, wie weit die Quelle reicht. Das LCR zeigt die Seite
   * zwar vollständig, kopiert wird aber gelegentlich nur ein Ausschnitt;
   * wer die Sonntagsschule einfügt, soll nicht die ganze Gemeinde
   * entlassen.
   */
  organizations: Organization[]
}

/* ------------------------------------------------------------------ */
/* Organisationsseite                                                  */
/* ------------------------------------------------------------------ */

/** Ist die Zeile ein Datum wie «6 Nov 2022»? */
function isDate(value: string): boolean {
  return parseDirectoryDate(value) !== null
}

/**
 * Liest die Seite «Organisationen».
 *
 * Der Zustandsautomat sammelt die Zeilen einer Berufung, bis entweder ein
 * Datum (Berufung ist besetzt) oder «Berufung offen» kommt. Leerzeilen
 * taugen nicht als Trenner – im Bereich des Aaronischen Priestertums
 * stehen die Einträge ohne Abstand untereinander.
 */
function parseOrganizationPage(lines: string[]): PastedCallings {
  const callings: PastedCalling[] = []
  const covered = new Set<Organization>()
  let vacant = 0

  let organization: Organization = 'other'
  let organizationLabel = ''
  let group = ''
  let inTable = false
  let buffer: string[] = []
  let custom = false

  const flush = (sustained: string, setApart: string, isVacant: boolean) => {
    const position = buffer[0]?.trim() ?? ''
    // Bei besetzten Berufungen steht der Name als letzte gesammelte Zeile.
    const fullName = isVacant ? '' : (buffer[buffer.length - 1]?.trim() ?? '')
    buffer = []
    const wasCustom = custom
    custom = false
    if (!position) return
    if (isVacant || !fullName || fullName === position) {
      vacant++
      return
    }
    callings.push({
      fullName,
      position,
      organization,
      organizationLabel,
      group,
      sustained,
      setApart,
      custom: wasCustom,
      outOfUnit: false,
    })
  }

  for (const line of lines) {
    const key = fold(line)

    if (TABLE_HEAD.test(key)) {
      inTable = true
      buffer = []
      custom = false
      // Die Tabelle gehört zur zuletzt gelesenen Überschrift. Sie hier zu
      // vermerken erfasst auch Organisationen, in denen alle Berufungen
      // offen sind – auch das ist eine Aussage der Quelle.
      covered.add(organization)
      continue
    }

    if (COUNT_LINE.test(key)) {
      inTable = false
      buffer = []
      custom = false
      // Die Untergruppe gilt nur für ihre Tabelle. Ohne das Zurücksetzen
      // erbte die nächste Tabelle eine Überschrift, die nicht zu ihr gehört.
      group = ''
      continue
    }

    if (!inTable) {
      // Zwischen den Tabellen stehen Überschriften: erst die Organisation,
      // dann – direkt vor der Tabelle – die Untergruppe.
      const matched = matchOrganization(line)
      if (matched) {
        organization = matched
        organizationLabel = line.trim()
        group = ''
      } else if (!line.trim().endsWith('.')) {
        // Erläuterungen wie «Diese Klasse vereinigt: Tapfere 9, Tapfere 10.»
        // stehen zwischen Überschrift und Tabelle – sie sind keine Gruppe.
        group = line.trim()
        if (organizationLabel && fold(organizationLabel) === 'sonstige berufungen') {
          const sub = SUB_ORGANIZATIONS.find(([pattern]) => pattern.test(fold(line)))
          organization = sub ? sub[1] : 'other'
        }
      }
      continue
    }

    if (key === CUSTOM) {
      custom = true
      continue
    }

    if (key === VACANT) {
      flush('', '', true)
      continue
    }

    const cells = line.split('\t')
    if (isDate(cells[0])) {
      flush(cells[0], cells[1] && isDate(cells[1]) ? cells[1] : '', false)
      continue
    }

    buffer.push(line)
  }

  return { source: 'organizations', callings, vacant, organizations: [...covered] }
}

/* ------------------------------------------------------------------ */
/* Berufungen ausserhalb der Einheit                                   */
/* ------------------------------------------------------------------ */

/**
 * Liest die Seite «Berufungen ausserhalb der Einheit».
 *
 * Dort steht alles in einer Zeile – Berufung, Name und Bestätigungsdatum
 * durch Tabulatoren getrennt. Verliert der Browser die Tabulatoren, stehen
 * die drei Angaben untereinander; beides wird unterstützt.
 */
function parseOutOfUnitPage(lines: string[]): PastedCallings {
  const callings: PastedCallings['callings'] = []

  const add = (position: string, fullName: string, sustained: string) => {
    if (!position || !fullName) return
    callings.push({
      fullName,
      position,
      organization: 'other',
      organizationLabel: 'Ausserhalb der Einheit',
      group: '',
      sustained,
      setApart: '',
      custom: false,
      outOfUnit: true,
    })
  }

  let buffer: string[] = []

  for (const line of lines) {
    if (COUNT_LINE.test(fold(line))) break

    const cells = line.split('\t')
    if (cells.length >= 3 && isDate(cells[2])) {
      add(cells[0], cells[1], cells[2])
      buffer = []
      continue
    }

    // Ohne Tabulatoren: Berufung, Name und Datum stehen untereinander.
    if (isDate(line) && buffer.length >= 2) {
      add(buffer[buffer.length - 2], buffer[buffer.length - 1], line)
      buffer = []
      continue
    }

    buffer.push(line)
  }

  return { source: 'outOfUnit', callings, vacant: 0, organizations: [] }
}

/* ------------------------------------------------------------------ */
/* Einstiegspunkt                                                      */
/* ------------------------------------------------------------------ */

export type CallingSource = 'organizations' | 'outOfUnit'

/**
 * Wandelt den eingefügten Text in Berufungen um.
 *
 * Welche der beiden LCR-Seiten vorliegt, erkennt der Parser am
 * Tabellenkopf: die Organisationsseite hat einen, die Liste der
 * Berufungen ausserhalb der Einheit nicht.
 */
export function parsePastedCallings(text: string, source?: CallingSource): PastedCallings {
  const lines = prepareLines(text)
  const detected: CallingSource =
    source ?? (lines.some((line) => TABLE_HEAD.test(fold(line))) ? 'organizations' : 'outOfUnit')

  return detected === 'organizations' ? parseOrganizationPage(lines) : parseOutOfUnitPage(lines)
}
