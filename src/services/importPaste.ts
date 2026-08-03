import type { MemberField, ParsedSheet } from './import'

/**
 * Mitgliederverzeichnis aus «Hilfsmittel für Führungsbeamte und Sekretäre»
 * (LCR) als **Text** einlesen.
 *
 * Das Verzeichnis lässt sich dort nur ansehen, nicht herunterladen. Markieren
 * und Kopieren liefert aber einen gut strukturierten Text – dieser Parser
 * macht daraus dieselbe Tabelle, die sonst aus einer Datei entsteht, damit
 * Zuordnung, Vorschau und Abgleich unverändert weiterlaufen.
 *
 * Aufbau eines Eintrags (Tabulatoren als → dargestellt):
 *
 *     Aeschbacher, Branden Charles → M → 30 → 13 Apr 1996
 *     Gässli 4
 *     3472 Wynigen
 *     079 341 53 75 → branden.aeschbacher@gmail.com
 *
 * Nicht jeder Eintrag ist vollständig: Telefon, E-Mail und die ganze
 * Anschrift können fehlen, die Anschrift kann eine Zusatzzeile haben, und
 * Vermerke wie «nicht getauft» schieben den Namen auf eine eigene Zeile.
 *
 * Das Modul kommt bewusst ohne Abhängigkeiten aus – so lässt es sich mit
 * `node --test` direkt ausführen, ohne Bundler und ohne Firebase.
 */

/* ------------------------------------------------------------------ */
/* Datum mit Monatsnamen                                               */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 0,
  januar: 0,
  january: 0,
  feb: 1,
  februar: 1,
  february: 1,
  mar: 2,
  mrz: 2,
  marz: 2,
  march: 2,
  apr: 3,
  april: 3,
  mai: 4,
  may: 4,
  jun: 5,
  juni: 5,
  june: 5,
  jul: 6,
  juli: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oct: 9,
  oktober: 9,
  october: 9,
  nov: 10,
  november: 10,
  dez: 11,
  dec: 11,
  dezember: 11,
  december: 11,
}

/** Kleinbuchstaben, Umlaute und Akzente aufgelöst: «Mär.» → «mar». */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function monthIndex(token: string): number | null {
  const key = fold(token)
  return key in MONTHS ? MONTHS[key] : null
}

function makeDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day)
  // Unmögliche Tage wie «31 Feb» würden in den Folgemonat rutschen.
  return date.getMonth() === month && date.getDate() === day ? date : null
}

/**
 * Erkennt Datumsangaben mit ausgeschriebenem Monat, wie sie das Verzeichnis
 * liefert: «13 Apr 1996», «1 Okt 1968», «17 Mär 1952» – ebenso die
 * englische Schreibweise «Apr 13, 1996».
 */
export function parseDirectoryDate(value: string): Date | null {
  const text = value.trim()
  if (!text) return null

  const dmy = text.match(/^(\d{1,2})\.?\s+(\p{L}+)\.?\s+(\d{4})$/u)
  if (dmy) {
    const month = monthIndex(dmy[2])
    if (month !== null) return makeDate(Number(dmy[3]), month, Number(dmy[1]))
  }

  const mdy = text.match(/^(\p{L}+)\.?\s+(\d{1,2})\.?,?\s+(\d{4})$/u)
  if (mdy) {
    const month = monthIndex(mdy[1])
    if (month !== null) return makeDate(Number(mdy[3]), month, Number(mdy[2]))
  }

  return null
}

/* ------------------------------------------------------------------ */
/* Zeilen vorbereiten                                                  */
/* ------------------------------------------------------------------ */

/**
 * Navigation, Tabellenkopf und Fusszeile der LCR-Seite.
 *
 * Wer die Seite mit Strg + A markiert, kopiert sie zwangsläufig mit. Der
 * Vergleich läuft über `fold()`, deshalb stehen die Einträge klein und ohne
 * Umlaute hier.
 */
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
  'mitgliederverzeichnis',
  'personen',
  'haushalte',
  'tabelle durchsuchen',
  'alle mitglieder',
  'anzeigen',
  'name',
  'geschlecht',
  'alter',
  'geburtsdatum',
  'anschrift',
  'telefonnummer',
  'e-mail-adresse',
  'feedback geben',
  'zuruck nach oben',
])

/** «Anzahl: 237» am Ende der Liste. */
const COUNT_FOOTER = /^anzahl:?\s*\d+$/

/**
 * Zerlegt den eingefügten Text in Zeilen, wirft Seitenelemente weg und
 * normalisiert die Zellen. Leere Zeilen verschwinden dabei – die Struktur
 * hängt an den Kopfzeilen der Personen, nicht an Leerzeilen.
 */
function prepareLines(text: string): string[] {
  return (
    text
      .replace(/\r\n?/g, '\n')
      // Geschützte Leerzeichen kommen beim Kopieren aus dem Browser häufig mit.
      .replace(/[\u00a0\u202f]/g, ' ')
      .split('\n')
      .map((line) =>
        line
          .split('\t')
          .map((cell) => cell.trim())
          .filter((cell) => {
            if (!cell) return false
            const key = fold(cell)
            return !JUNK.has(key) && !COUNT_FOOTER.test(key)
          })
          .join('\t'),
      )
      .filter(Boolean)
  )
}

/* ------------------------------------------------------------------ */
/* Zellen erkennen                                                     */
/* ------------------------------------------------------------------ */

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@,;]{2,}/g

/** Telefonnummer: keine Buchstaben, mindestens sechs Ziffern. */
function isPhoneNumber(value: string): boolean {
  if (/\p{L}/u.test(value)) return false
  return value.replace(/\D/g, '').length >= 6
}

/** Schweizer Mobilnummer (076–079), auch mit Landesvorwahl. */
function isMobileNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  const local = digits.startsWith('41') ? digits.slice(2) : digits.replace(/^0/, '')
  return /^7[5-9]\d{7}$/.test(local)
}

function isGender(value: string): boolean {
  const key = fold(value)
  return ['m', 'w', 'f', 'mannlich', 'weiblich', 'male', 'female'].includes(key)
}

function isAge(value: string): boolean {
  return /^\d{1,3}$/.test(value.trim())
}

/** Vermerk unter dem Namen, z. B. «nicht getauft». */
function isAnnotation(line: string): boolean {
  return !/\d/.test(line) && /^(nicht|kein|keine|ohne)\s/i.test(line.trim())
}

/**
 * Kommt die Zeile als Name in Frage?
 *
 * Absichtlich grob: Namen enthalten keine Ziffern und kein «@», das trennt
 * sie zuverlässig von Anschrift, Telefon und E-Mail der Person davor.
 */
function isNameLine(line: string): boolean {
  const text = line.trim()
  if (!text || text.includes('@') || /\d/.test(text)) return false
  return /\p{L}/u.test(text)
}

/* ------------------------------------------------------------------ */
/* Kopfzeile einer Person                                              */
/* ------------------------------------------------------------------ */

/** Variante ohne Tabulatoren – alles in einer Zeile, nur mit Leerzeichen. */
const INLINE_HEAD = /^(.+?)\s+([MWFmwf])\s+(\d{1,3})\s+(\d{1,2}\.?\s+\p{L}{3,}\.?\s+\d{4})$/u

/** Dieselbe Zeile ohne Namen – der steht dann eine Zeile darüber. */
const HEADLESS_HEAD = /^([MWFmwf])\s+(\d{1,3})\s+(\d{1,2}\.?\s+\p{L}{3,}\.?\s+\d{4})$/u

interface Head {
  /** Zeilenindex, ab dem die Person beginnt (Namenszeile) */
  start: number
  /** Zeilenindex nach der Kopfzeile – dort beginnen Anschrift und Kontakt */
  end: number
  name: string
  gender: string
  birthDate: string
  note: string
}

/**
 * Liest die Kopfzeile ab `index`, falls dort eine steht.
 *
 * Drei Schreibweisen kommen vor, je nachdem wie der Browser kopiert:
 * Name und Angaben in einer Zeile mit Tabulatoren, dasselbe nur mit
 * Leerzeichen, oder jedes Feld auf einer eigenen Zeile.
 */
function readHead(lines: string[], index: number): Head | null {
  const cells = lines[index].split('\t')

  let name = ''
  let gender: string
  let birthDate: string
  let end = index + 1

  const at = cells.findIndex(
    (cell, i) =>
      isGender(cell) &&
      isAge(cells[i + 1] ?? '') &&
      parseDirectoryDate(cells[i + 2] ?? '') !== null,
  )

  if (at >= 0) {
    gender = cells[at]
    birthDate = cells[at + 2]
    name = cells.slice(0, at).join(' ').trim()
  } else if (
    isGender(lines[index]) &&
    isAge(lines[index + 1] ?? '') &&
    parseDirectoryDate(lines[index + 2] ?? '') !== null
  ) {
    gender = lines[index]
    birthDate = lines[index + 2]
    end = index + 3
  } else {
    const inline = lines[index].match(INLINE_HEAD)
    const headless = inline ? null : lines[index].match(HEADLESS_HEAD)
    if (inline) {
      name = inline[1].trim()
      gender = inline[2]
      birthDate = inline[4]
    } else if (headless) {
      gender = headless[1]
      birthDate = headless[3]
    } else {
      return null
    }
  }

  let start = index
  const notes: string[] = []

  if (!name) {
    // Der Name steht über der Kopfzeile, dazwischen liegen allfällige
    // Vermerke wie «nicht getauft».
    let cursor = index - 1
    while (cursor >= 0 && isAnnotation(lines[cursor])) {
      notes.unshift(lines[cursor])
      cursor--
    }
    if (cursor < 0 || !isNameLine(lines[cursor])) return null
    name = lines[cursor].trim()
    start = cursor
  }

  return { start, end, name, gender, birthDate, note: notes.join(' · ') }
}

/* ------------------------------------------------------------------ */
/* Anschrift und Kontakt                                               */
/* ------------------------------------------------------------------ */

/** «3472 Wynigen», «CH-3552 Bärau», «CH 4900 Langenthal» */
const ZIP_CITY = /^(?:CH|FL|LI|DE|AT)?\s*[-–]?\s*(\d{4,5})\s+(\S.*)$/

function splitAddress(lines: string[]): { street: string; zip: string; city: string } {
  // Von hinten suchen: die Ortszeile steht zuletzt, davor kann eine
  // Zusatzzeile stehen («Bernstrasse 16 / Wohnpark Buchegg / 3400 Burgdorf»).
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(ZIP_CITY)
    if (match) {
      const rest = [...lines.slice(0, i), ...lines.slice(i + 1)]
      return { street: rest.join(', '), zip: match[1], city: match[2].trim() }
    }
  }
  return { street: lines.join(', '), zip: '', city: '' }
}

interface Details {
  street: string
  zip: string
  city: string
  phone: string
  mobile: string
  email: string
}

/**
 * Verteilt die Zeilen unterhalb der Kopfzeile auf Anschrift, Telefon und
 * E-Mail. Die Reihenfolge im Verzeichnis ist stabil, die Vollständigkeit
 * nicht – deshalb entscheidet der Inhalt jeder Zelle, nicht ihre Position.
 */
function readDetails(lines: string[]): Details {
  const address: string[] = []
  const numbers: string[] = []
  let email = ''

  for (const line of lines) {
    for (const cell of line.split('\t')) {
      if (!cell) continue

      // Fehlt der Tabulator zwischen Telefon und E-Mail, stehen beide in
      // derselben Zelle. Die Adresse zuerst von der E-Mail befreien.
      const found = cell.match(EMAIL)
      if (found) {
        if (!email) email = found[0]
      }
      const rest = (found ? cell.replace(EMAIL, ' ') : cell).replace(/\s+/g, ' ').trim()

      if (!rest) continue
      if (isPhoneNumber(rest)) numbers.push(rest)
      else address.push(rest)
    }
  }

  // Das Verzeichnis kennt nur eine Spalte «Telefonnummer». Die App trennt
  // Festnetz und Mobile, deshalb sortieren wir nach Vorwahl ein.
  const mobileAt = numbers.findIndex(isMobileNumber)
  const mobile = mobileAt >= 0 ? numbers[mobileAt] : ''
  const phone = numbers.find((_, i) => i !== mobileAt) ?? ''

  return { ...splitAddress(address), phone, mobile, email }
}

/* ------------------------------------------------------------------ */
/* Ergebnis                                                            */
/* ------------------------------------------------------------------ */

export interface PastedPerson {
  /** «Nachname, Vorname» wie im Verzeichnis */
  fullName: string
  gender: string
  birthDate: string
  street: string
  zip: string
  city: string
  phone: string
  mobile: string
  email: string
  /** Vermerk unter dem Namen, z. B. «nicht getauft» */
  note: string
}

export interface PastedDirectory extends ParsedSheet {
  people: PastedPerson[]
  /** Zuordnung der festen Spalten – passend zu `headers` */
  mapping: MemberField[]
}

/**
 * Die Spalten, die aus dem eingefügten Text entstehen.
 *
 * «Hinweis» bleibt standardmässig unzugeordnet: ob «nicht getauft» in die
 * Notiz gehört, entscheidet der Nutzer im Zuordnungsschritt.
 */
const COLUMNS: {
  header: string
  field: MemberField
  value: (person: PastedPerson) => string
}[] = [
  { header: 'Name', field: 'fullName', value: (p) => p.fullName },
  { header: 'Geschlecht', field: 'gender', value: (p) => p.gender },
  { header: 'Geburtsdatum', field: 'birthDate', value: (p) => p.birthDate },
  { header: 'Strasse', field: 'street', value: (p) => p.street },
  { header: 'PLZ', field: 'zip', value: (p) => p.zip },
  { header: 'Ort', field: 'city', value: (p) => p.city },
  { header: 'Telefon', field: 'phone', value: (p) => p.phone },
  { header: 'Mobile', field: 'mobile', value: (p) => p.mobile },
  { header: 'E-Mail', field: 'email', value: (p) => p.email },
  { header: 'Hinweis', field: 'ignore', value: (p) => p.note },
]

/**
 * Wandelt den eingefügten Text in Personen und in dieselbe Tabellenform um,
 * die `parseFile()` aus einer Datei erzeugt.
 */
export function parsePastedDirectory(text: string): PastedDirectory {
  const lines = prepareLines(text)

  const heads: Head[] = []
  for (let i = 0; i < lines.length; i++) {
    const head = readHead(lines, i)
    if (!head) continue
    heads.push(head)
    i = head.end - 1
  }

  const people = heads.map((head, index) => {
    // Alles bis zum Namen der nächsten Person gehört zu dieser.
    const until = heads[index + 1]?.start ?? lines.length
    const details = readDetails(lines.slice(head.end, Math.max(head.end, until)))
    return {
      fullName: head.name,
      gender: head.gender,
      birthDate: head.birthDate,
      note: head.note,
      ...details,
    }
  })

  return {
    headers: COLUMNS.map((column) => column.header),
    rows: people.map((person) => COLUMNS.map((column) => column.value(person))),
    mapping: COLUMNS.map((column) => column.field),
    people,
  }
}
