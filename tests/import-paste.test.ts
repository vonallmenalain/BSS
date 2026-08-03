import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseDirectoryDate, parsePastedDirectory } from '../src/services/importPaste.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Testdaten sind erfunden, haben aber denselben Aufbau wie das kopierte
 * LCR-Mitgliederverzeichnis – inklusive Navigation und Fusszeile der Seite.
 */

const CHROME_TOP = [
  'Skip to Main ContentSign In',
  'Kirche Jesu Christi der Heiligen der Letzten Tage',
  'Hilfsmittel für Führungsbeamte und Sekretäre',
  '',
  'Profile Picture',
  'Hilfe',
  'Mitglieder, Berichte und Formulare suchen',
  '',
  'Suchen',
  '',
  'Meine Gemeinde',
  '',
  'Andere Einheiten und Führungsverantwortliche',
  'Pfahl Musterstadt (514462)',
  'Gemeinde Musterdorf (62723)',
  'Mitgliederverzeichnis',
  'Drucken',
  '',
  'Personen',
  '',
  'Haushalte',
  'Tabelle durchsuchen',
  '',
  '',
  'Alle Mitglieder',
  '',
  '',
  'Anzeigen',
  '\tName',
  'Geschlecht',
  'Alter',
  'Geburtsdatum',
  'Anschrift',
  'Telefonnummer\tE-Mail-Adresse',
  '',
].join('\n')

const CHROME_BOTTOM = ['Anzahl: 10', 'Feedback geben', 'Mitgliederverzeichnis'].join('\n')

/** Ein Eintrag pro Sonderfall, den das Verzeichnis in der Praxis liefert. */
const ENTRIES = [
  // Vollständig, Mobilnummer
  'Alder, Beat Simon\tM\t42\t13 Apr 1984\t\nMusterweg 4\n3400 Burgdorf\n079 123 45 67\tbeat.alder@example.ch',
  // Festnetz, keine E-Mail (die Zelle bleibt leer)
  'Berger, Anna\tW\t67\t1 Okt 1958\t\nBeispielgasse 12\nCH-3422 Kirchberg\n034 123 45 67\t',
  // Weder Telefon noch E-Mail
  'Cavelti, Nino\tM\t4\t23 Jun 2022\t\nMusterweg 4\n3400 Burgdorf',
  // Nur E-Mail, Ort mit Kantonskürzel
  'Dubach, Sarah\tW\t29\t11 Feb 1997\t\nTestweg 1\n3422 Kirchberg BE\nsarah.dubach@example.com',
  // Anschrift über drei Zeilen
  'Eggli, Ruth Maria\tW\t91\t10 Jul 1935\t\nBeispielstrasse 16\nWohnpark Beispiel\n3400 Burgdorf\n076 987 65 43\truth.eggli@example.ch',
  // Vermerk unter dem Namen – schiebt den Namen auf eine eigene Zeile
  'Frei, Tim Noah\nnicht getauft\nM\t22\t24 Okt 2003\t\nFeldweg 17\n3432 Musterdorf\n079 111 22 33\t',
  // Komma in der Strasse, «CH » mit Leerzeichen, ausländische Nummer
  'Gerber, Luca\tM\t30\t14 Mär 1996\t\nKlinik, St. Muster\nCH 4900 Langenthal\n(385) 223-9552\tluca.gerber@example.org',
  // Alter 0
  'Hofer, Mia\tW\t0\t27 Dez 2025\t\nMusterweg 4\n3400 Burgdorf',
  // Kleingeschriebenes Namensteilchen
  'von Arx, Elin\tW\t5\t16 Jun 2021\t\nTestweg 1\n3422 Kirchberg',
  // «CH- » mit Leerzeichen nach dem Bindestrich
  'Iten, Peter\tM\t78\t12 Nov 1947\t\nBeispielhof 3\nCH- 3400 Burgdorf',
]

const SAMPLE = `${CHROME_TOP}\n${ENTRIES.join('\n\n')}\n${CHROME_BOTTOM}\n`

const parse = (text: string) => parsePastedDirectory(text)
const find = (text: string, name: string) => {
  const person = parse(text).people.find((p) => p.fullName === name)
  assert.ok(person, `«${name}» nicht gefunden`)
  return person
}

/* ------------------------------------------------------------------ */
/* Datum                                                               */
/* ------------------------------------------------------------------ */

test('parseDirectoryDate liest deutsche Monatsnamen', () => {
  const cases: [string, [number, number, number]][] = [
    ['13 Apr 1996', [1996, 3, 13]],
    ['1 Okt 1968', [1968, 9, 1]],
    ['17 Mär 1952', [1952, 2, 17]],
    ['22 Dez 2001', [2001, 11, 22]],
    ['5 Mai 2004', [2004, 4, 5]],
    ['30 Jan 1942', [1942, 0, 30]],
    ['1. Februar 1963', [1963, 1, 1]],
    ['Apr 13, 1996', [1996, 3, 13]],
  ]
  for (const [input, [year, month, day]] of cases) {
    const date = parseDirectoryDate(input)
    assert.ok(date, `«${input}» wurde nicht gelesen`)
    assert.deepEqual([date.getFullYear(), date.getMonth(), date.getDate()], [year, month, day])
  }
})

test('parseDirectoryDate weist Unlesbares zurück', () => {
  for (const input of ['', '   ', '31 Feb 2020', '13 Xyz 1996', '13.04.1996', '1996-04-13']) {
    assert.equal(parseDirectoryDate(input), null, `«${input}» hätte null liefern müssen`)
  }
})

/* ------------------------------------------------------------------ */
/* Personen erkennen                                                   */
/* ------------------------------------------------------------------ */

test('erkennt alle Personen und ignoriert Seitenelemente', () => {
  const result = parse(SAMPLE)
  assert.equal(result.people.length, ENTRIES.length)
  assert.equal(result.rows.length, ENTRIES.length)
  // Weder Navigation noch «Anzahl: 10» dürfen als Person durchrutschen.
  for (const person of result.people) {
    assert.match(person.fullName, /^[^\d]+,/)
  }
})

test('liefert dieselbe Tabellenform wie eine Datei', () => {
  const result = parse(SAMPLE)
  assert.equal(result.headers.length, result.mapping.length)
  for (const row of result.rows) assert.equal(row.length, result.headers.length)
  assert.deepEqual(result.mapping, [
    'fullName',
    'gender',
    'birthDate',
    'street',
    'zip',
    'city',
    'phone',
    'mobile',
    'email',
    'ignore',
  ])
})

test('liest einen vollständigen Eintrag', () => {
  assert.deepEqual(find(SAMPLE, 'Alder, Beat Simon'), {
    fullName: 'Alder, Beat Simon',
    gender: 'M',
    birthDate: '13 Apr 1984',
    street: 'Musterweg 4',
    zip: '3400',
    city: 'Burgdorf',
    phone: '',
    mobile: '079 123 45 67',
    email: 'beat.alder@example.ch',
    note: '',
  })
})

test('trennt Festnetz und Mobile nach Vorwahl', () => {
  const berger = find(SAMPLE, 'Berger, Anna')
  assert.equal(berger.phone, '034 123 45 67')
  assert.equal(berger.mobile, '')
  assert.equal(berger.email, '')

  // Ausländische Nummern gelten als Festnetz.
  const gerber = find(SAMPLE, 'Gerber, Luca')
  assert.equal(gerber.phone, '(385) 223-9552')
  assert.equal(gerber.mobile, '')
})

test('kommt mit fehlenden Kontaktangaben zurecht', () => {
  const cavelti = find(SAMPLE, 'Cavelti, Nino')
  assert.deepEqual(
    [cavelti.phone, cavelti.mobile, cavelti.email],
    ['', '', ''],
    'ohne Kontaktzeile bleiben alle drei Felder leer',
  )
  assert.equal(cavelti.street, 'Musterweg 4')

  const dubach = find(SAMPLE, 'Dubach, Sarah')
  assert.equal(dubach.email, 'sarah.dubach@example.com')
  assert.equal(dubach.phone, '')
  assert.equal(dubach.city, 'Kirchberg BE')
})

test('erkennt Ländervorsatz und Zusatzzeile in der Anschrift', () => {
  assert.deepEqual(pick(find(SAMPLE, 'Berger, Anna')), ['Beispielgasse 12', '3422', 'Kirchberg'])
  assert.deepEqual(pick(find(SAMPLE, 'Gerber, Luca')), ['Klinik, St. Muster', '4900', 'Langenthal'])
  assert.deepEqual(pick(find(SAMPLE, 'Iten, Peter')), ['Beispielhof 3', '3400', 'Burgdorf'])
  assert.deepEqual(pick(find(SAMPLE, 'Eggli, Ruth Maria')), [
    'Beispielstrasse 16, Wohnpark Beispiel',
    '3400',
    'Burgdorf',
  ])
})

function pick(person: { street: string; zip: string; city: string }) {
  return [person.street, person.zip, person.city]
}

test('nimmt den Vermerk «nicht getauft» als eigene Spalte auf', () => {
  const frei = find(SAMPLE, 'Frei, Tim Noah')
  assert.equal(frei.note, 'nicht getauft')
  assert.equal(frei.birthDate, '24 Okt 2003')
  assert.equal(frei.street, 'Feldweg 17')
  assert.equal(frei.mobile, '079 111 22 33')

  // Der Vermerk bleibt unzugeordnet – darüber entscheidet der Nutzer.
  const result = parse(SAMPLE)
  assert.equal(result.mapping[result.headers.indexOf('Hinweis')], 'ignore')
})

test('liest Alter 0 und kleingeschriebene Namensteile', () => {
  assert.equal(find(SAMPLE, 'Hofer, Mia').birthDate, '27 Dez 2025')
  assert.equal(find(SAMPLE, 'von Arx, Elin').gender, 'W')
})

/* ------------------------------------------------------------------ */
/* Schreibweisen der Zwischenablage                                    */
/* ------------------------------------------------------------------ */

test('liefert dasselbe, wenn der Browser keine Tabulatoren kopiert', () => {
  const withTabs = parse(SAMPLE)
  const withSpaces = parse(SAMPLE.replaceAll('\t', ' '))
  const withNewlines = parse(SAMPLE.replaceAll('\t', '\n'))

  assert.deepEqual(withSpaces.people, withTabs.people)
  assert.deepEqual(withNewlines.people, withTabs.people)
})

test('bleibt bei leerem oder unpassendem Text ruhig', () => {
  for (const text of ['', '   \n\n  ', 'Irgendein Text ohne Liste.\nNoch eine Zeile.']) {
    assert.deepEqual(parse(text).people, [])
    assert.deepEqual(parse(text).rows, [])
  }
})
