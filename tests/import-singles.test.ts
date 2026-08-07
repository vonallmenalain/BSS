import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Timestamp } from 'firebase/firestore'

import { detectSinglesKind, parsePastedSingles } from '../src/services/importSingles.ts'
import { buildSinglesPreview } from '../src/services/importMatch.ts'
import type { Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Testdaten sind erfunden, haben aber denselben Aufbau wie die beiden
 * kopierten LCR-Seiten. Sie unterscheiden sich mehr, als es aussieht: Die
 * Liste der Jungen Alleinstehenden setzt den Namen auf eine eigene Zeile und
 * führt zwei Spalten mehr, die der Alleinstehenden Erwachsenen bringt alles
 * in einer Zeile unter.
 */

const TOP = [
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
].join('\n')

/** Die Liste der Jungen Alleinstehenden – Name auf eigener Zeile. */
const JAE_PAGE = [
  TOP,
  'Organisationen',
  'Anwesenheitslisten',
  'Drucken',
  'Ergebnisse filtern',
  '',
  'Gemeinde Musterdorf',
  '',
  'Junger Alleinstehender Erwachsener',
  '',
  'Optionen',
  '',
  'Spalten',
  'Junger Alleinstehender Erwachsener',
  '',
  'Berufungen',
  '',
  'Mitglieder',
  'Name',
  'Geschlecht',
  'Alter',
  'Geburtsdatum',
  'Telefonnummer',
  'E-Mail-Adresse',
  'Muster, Anna Maria',
  'W\t26\t1 Sep 1999\t\t',
  'Beispiel, Peter',
  'M\t27\t6 Sep 1998\t077 943 91 19\tpeter@example.ch',
  'Probe, Valentin',
  'nicht getauft',
  'M\t19\t8 Feb 2007\t\t',
  'Anzahl: 3',
  'Feedback geben',
  'Organisationen',
].join('\n')

/** Die Liste der Alleinstehenden Erwachsenen – alles in einer Zeile. */
const AE_PAGE = [
  TOP,
  'Alleinstehende Erwachsene',
  'Drucken',
  'Tabelle durchsuchen',
  '',
  'Optionen',
  'Name',
  'Geschlecht',
  'Alter',
  'Geburtsdatum',
  'Muster, Heinz\tM\t57\t1 Okt 1968',
  'Beispiel, Regina\tW\t47\t2 Okt 1978',
  'Anzahl: 2',
  'Feedback geben',
  'Alleinstehende Erwachsene',
].join('\n')

/* ------------------------------------------------------------------ */
/* Welche Liste ist es?                                                */
/* ------------------------------------------------------------------ */

test('detectSinglesKind liest die Überschrift', () => {
  assert.equal(detectSinglesKind(JAE_PAGE), 'jae')
  assert.equal(detectSinglesKind(AE_PAGE), 'ae')
})

test('detectSinglesKind hält die beiden Überschriften auseinander', () => {
  // «Junger Alleinstehender Erwachsener» enthält beide Wörter – die längere
  // Bezeichnung muss zuerst greifen.
  assert.equal(detectSinglesKind('Junge Alleinstehende Erwachsene'), 'jae')
  assert.equal(detectSinglesKind('Alleinstehende Erwachsene'), 'ae')
})

test('detectSinglesKind rät nicht', () => {
  assert.equal(detectSinglesKind('Muster, Heinz\tM\t57\t1 Okt 1968'), null)
})

/* ------------------------------------------------------------------ */
/* Wer steht darauf?                                                   */
/* ------------------------------------------------------------------ */

test('die JAE-Liste wird vollständig gelesen', () => {
  const { detected, people } = parsePastedSingles(JAE_PAGE)
  assert.equal(detected, 'jae')
  assert.deepEqual(
    people.map((person) => person.fullName),
    ['Muster, Anna Maria', 'Beispiel, Peter', 'Probe, Valentin'],
  )
  assert.equal(people[0].birthDate, '1 Sep 1999')
  // Der Vermerk unter dem Namen schiebt die Kopfzeile nicht durcheinander.
  assert.equal(people[2].note, 'nicht getauft')
})

test('die AE-Liste wird vollständig gelesen', () => {
  const { detected, people } = parsePastedSingles(AE_PAGE)
  assert.equal(detected, 'ae')
  assert.deepEqual(
    people.map((person) => person.fullName),
    ['Muster, Heinz', 'Beispiel, Regina'],
  )
  assert.equal(people[0].birthDate, '1 Okt 1968')
})

/* ------------------------------------------------------------------ */
/* Was der Import bewirkt                                              */
/* ------------------------------------------------------------------ */

function member(partial: Partial<Member> & { id: string }): Member {
  return {
    lastName: 'Muster',
    firstName: 'Anna Maria',
    gender: 'f',
    birthDate: null,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
    ...partial,
  } as Member
}

const born = (iso: string) => Timestamp.fromDate(new Date(`${iso}T12:00:00`))

test('wer auf der Liste steht, bekommt das Schlagwort', () => {
  const members = [
    member({ id: 'a', lastName: 'Muster', firstName: 'Anna Maria' }),
    member({ id: 'b', lastName: 'Beispiel', firstName: 'Peter', gender: 'm' }),
    member({ id: 'c', lastName: 'Probe', firstName: 'Valentin', gender: 'm' }),
  ]
  const { people } = parsePastedSingles(JAE_PAGE)
  const preview = buildSinglesPreview('jae', people, members)

  assert.equal(preview.tag, 'JAE')
  assert.equal(preview.addCount, 3)
  assert.equal(preview.skipCount, 0)
  assert.deepEqual(preview.additions[0], { memberId: 'a', tags: ['JAE'] })
})

test('wer es schon trägt, wird nicht noch einmal geschrieben', () => {
  const members = [
    member({ id: 'a', tags: ['JAE'] }),
    member({ id: 'b', lastName: 'Beispiel', firstName: 'Peter', gender: 'm' }),
    member({ id: 'c', lastName: 'Probe', firstName: 'Valentin', gender: 'm' }),
  ]
  const preview = buildSinglesPreview('jae', parsePastedSingles(JAE_PAGE).people, members)
  assert.equal(preview.keepCount, 1)
  assert.equal(preview.addCount, 2)
})

test('wer nicht mehr auf der Liste steht, verliert das Schlagwort', () => {
  const members = [
    member({ id: 'a' }),
    member({ id: 'b', lastName: 'Beispiel', firstName: 'Peter', gender: 'm' }),
    member({ id: 'c', lastName: 'Probe', firstName: 'Valentin', gender: 'm' }),
    // Sie hat geheiratet und steht nicht mehr auf der Liste des LCR.
    member({ id: 'd', lastName: 'Ehemals', firstName: 'Sara', tags: ['JAE', 'Neubekehrt'] }),
  ]
  const preview = buildSinglesPreview('jae', parsePastedSingles(JAE_PAGE).people, members)

  assert.equal(preview.removals.length, 1)
  assert.equal(preview.removals[0].memberId, 'd')
  // Die frei vergebenen Schlagworte bleiben stehen.
  assert.deepEqual(preview.removals[0].tags, ['Neubekehrt'])
})

test('die andere Liste bleibt unberührt', () => {
  const members = [
    member({ id: 'a' }),
    member({ id: 'b', lastName: 'Beispiel', firstName: 'Peter', gender: 'm' }),
    member({ id: 'c', lastName: 'Probe', firstName: 'Valentin', gender: 'm' }),
    member({ id: 'e', lastName: 'Aelter', firstName: 'Hans', tags: ['AE'] }),
  ]
  const preview = buildSinglesPreview('jae', parsePastedSingles(JAE_PAGE).people, members)
  assert.equal(preview.removals.length, 0)
})

test('ein Name ohne erfasste Person wird gemeldet statt geraten', () => {
  const preview = buildSinglesPreview('jae', parsePastedSingles(JAE_PAGE).people, [
    member({ id: 'a' }),
  ])
  assert.equal(preview.skipCount, 2)
  const skipped = preview.rows.filter((row) => row.action === 'skip')
  assert.deepEqual(skipped[0].warnings, ['Keine passende Person in der Mitgliederliste'])
})

test('bei gleichem Namen entscheidet das Geburtsdatum', () => {
  const members = [
    member({ id: 'jung', lastName: 'Muster', firstName: 'Anna', birthDate: born('2006-04-14') }),
    member({
      id: 'richtig',
      lastName: 'Muster',
      firstName: 'Anna Maria',
      birthDate: born('1999-09-01'),
    }),
    member({
      id: 'falsch',
      lastName: 'Muster',
      firstName: 'Anna Maria',
      birthDate: born('1975-09-01'),
    }),
  ]
  const preview = buildSinglesPreview('jae', parsePastedSingles(JAE_PAGE).people, members)
  const row = preview.rows[0]
  assert.equal(row.memberId, 'richtig')
  assert.deepEqual(row.warnings, [])
})

test('ohne eindeutiges Geburtsdatum wird gemeldet statt geraten', () => {
  const members = [
    member({ id: 'x', lastName: 'Muster', firstName: 'Anna Maria', birthDate: null }),
    member({ id: 'y', lastName: 'Muster', firstName: 'Anna Maria', birthDate: null }),
  ]
  const preview = buildSinglesPreview('jae', parsePastedSingles(JAE_PAGE).people, members)
  assert.equal(preview.rows[0].action, 'skip')
  assert.deepEqual(preview.rows[0].warnings, ['Mehrere Personen mit diesem Namen'])
})
