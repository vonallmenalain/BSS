import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CLEANING_DEFAULT_TEXT,
  cleaningAround,
  fillCleaningText,
  parseCleaningSheet,
} from '../src/services/importCleaning.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Zeilen stammen aus dem Putzplan der Gemeinde – Aufbau unverändert,
 * Namen erfunden. Die Tabelle hat keine Kopfzeile, verstreute Spalten und
 * nennt nur Tag und Monat; das Jahr steht in der Überschrift und wechselt
 * am Ende des Plans.
 */

const SHEET: string[][] = [
  ['Putzplan 2026 Juli - Dezember', '', '', '', '', '', ''],
  ['', '', '', '', '', '', ''],
  ['Gruppe 2', '', 'Bader Roger & Sylvie', '', '', '29.6. - 4.7.', ''],
  ['', '', '', '', '', '', ''],
  ['Gruppe 3', '', 'Nanogjoka Arbi & Melina', '', '', '6.7. - 11.7.', ''],
  ['', '', '', '', '', '', ''],
  ['Gruppe 5', '', 'Morales-Römer Oscar & Céleste', '', '', '27.9. - 3.10.', ' Generalkonf.'],
  ['', '', '', '', '', '', ''],
  ['Gruppe 6', '', 'von Allmen Adrian & Bea', '', '', '27.12. - 2.1.', ''],
]

/* ------------------------------------------------------------------ */
/* Lesen                                                               */
/* ------------------------------------------------------------------ */

test('liest Gruppe, Team und Zeitraum aus verstreuten Spalten', () => {
  const plan = parseCleaningSheet(SHEET)

  assert.equal(plan.year, 2026)
  assert.equal(plan.yearFromTitle, true)
  assert.equal(plan.weeks.length, 4)

  assert.deepEqual(plan.weeks[0], {
    startDate: '2026-06-29',
    endDate: '2026-07-04',
    group: 'Gruppe 2',
    team: 'Bader Roger & Sylvie',
    note: '',
    row: 3,
  })
})

test('übernimmt die Bemerkung neben dem Zeitraum', () => {
  const plan = parseCleaningSheet(SHEET)
  const week = plan.weeks.find((entry) => entry.startDate === '2026-09-27')
  assert.equal(week?.note, 'Generalkonf.')
  assert.equal(week?.team, 'Morales-Römer Oscar & Céleste')
})

test('erkennt den Jahreswechsel innerhalb des Plans', () => {
  // «27.12. - 2.1.» beginnt 2026 und endet 2027.
  const plan = parseCleaningSheet(SHEET)
  const week = plan.weeks.at(-1)
  assert.equal(week?.startDate, '2026-12-27')
  assert.equal(week?.endDate, '2027-01-02')
})

test('nimmt das laufende Jahr, wenn keines in der Datei steht – und meldet das', () => {
  const plan = parseCleaningSheet([['Gruppe 1', 'Römer Nathan', '5.1. - 10.1.']], 2030)
  assert.equal(plan.year, 2030)
  assert.equal(plan.yearFromTitle, false)
  assert.equal(plan.weeks[0].startDate, '2030-01-05')
})

test('überspringt Titel, Leerzeilen und alles ohne Zeitraum', () => {
  const plan = parseCleaningSheet([
    ['Putzplan 2026'],
    [],
    ['Bitte Fenster nicht vergessen!'],
    ['Gruppe 1', 'Römer Nathan', '5.1. - 10.1.'],
  ])
  assert.equal(plan.weeks.length, 1)
  assert.equal(plan.incomplete, 0)
})

test('meldet eine Woche ohne Namen, statt sie leer anzulegen', () => {
  const plan = parseCleaningSheet([['Putzplan 2026'], ['Gruppe 4', '', '12.1. - 17.1.']])
  assert.deepEqual(plan.weeks, [])
  assert.equal(plan.incomplete, 1)
})

test('kommt mit Gedankenstrich und fehlenden Punkten zurecht', () => {
  const plan = parseCleaningSheet([['Putzplan 2026'], ['Gruppe 8', 'Muster Hans', '2.8 – 8.8']])
  assert.equal(plan.weeks[0].startDate, '2026-08-02')
  assert.equal(plan.weeks[0].endDate, '2026-08-08')
})

/* ------------------------------------------------------------------ */
/* Der Sonntag zwischen zwei Wochen                                    */
/* ------------------------------------------------------------------ */

test('findet die Woche davor und die Woche danach', () => {
  const weeks = parseCleaningSheet(SHEET).weeks
  // Sonntag, 5. Juli 2026 – zwischen «29.6. – 4.7.» und «6.7. – 11.7.».
  const { previous, next } = cleaningAround(weeks, '2026-07-05')

  assert.equal(previous?.startDate, '2026-06-29')
  assert.equal(next?.startDate, '2026-07-06')
})

test('kommt mit Wochen zurecht, die am Sonntag beginnen', () => {
  /*
   * Die Tabelle der Gemeinde wechselt mitten im Plan die Zählweise: bis
   * Juli von Montag bis Samstag, ab August von Sonntag bis Samstag. Am
   * 2. August 2026 ist der Sonntag damit der erste Tag der neuen Woche –
   * angekündigt gehört sie trotzdem, nicht die übernächste.
   */
  const weeks = [
    { startDate: '2026-07-27', endDate: '2026-08-01' },
    { startDate: '2026-08-02', endDate: '2026-08-08' },
    { startDate: '2026-08-09', endDate: '2026-08-15' },
  ]
  const { previous, next } = cleaningAround(weeks, '2026-08-02')

  assert.equal(previous?.startDate, '2026-07-27')
  assert.equal(next?.startDate, '2026-08-02')
})

test('kommt mit Wochen zurecht, die am Sonntag enden', () => {
  const weeks = [
    { startDate: '2026-06-29', endDate: '2026-07-05' },
    { startDate: '2026-07-06', endDate: '2026-07-12' },
  ]
  const { previous, next } = cleaningAround(weeks, '2026-07-05')

  assert.equal(previous?.startDate, '2026-06-29')
  assert.equal(next?.startDate, '2026-07-06')
})

test('überspringt Lücken im Plan, statt aufzugeben', () => {
  const weeks = parseCleaningSheet(SHEET).weeks
  // Sonntag, 20. September – der Plan hat davor und danach eine Lücke.
  const { previous, next } = cleaningAround(weeks, '2026-09-20')
  assert.equal(previous?.startDate, '2026-07-06')
  assert.equal(next?.startDate, '2026-09-27')
})

test('meldet nichts, wo der Plan nicht hinreicht', () => {
  const weeks = parseCleaningSheet(SHEET).weeks
  assert.equal(cleaningAround(weeks, '2026-06-28').previous, null)
  assert.equal(cleaningAround(weeks, '2027-02-07').next, null)
})

test('kündigt am letzten Sonntag des Jahres die Woche über den Jahreswechsel an', () => {
  // «27.12. – 2.1.» beginnt an einem Sonntag – genau an dem, an dem sie
  // angekündigt wird.
  const weeks = parseCleaningSheet(SHEET).weeks
  const { previous, next } = cleaningAround(weeks, '2026-12-27')

  assert.equal(previous?.startDate, '2026-09-27')
  assert.equal(next?.startDate, '2026-12-27')
  assert.equal(next?.endDate, '2027-01-02')
})

/* ------------------------------------------------------------------ */
/* Der Wortlaut am Sonntag                                             */
/* ------------------------------------------------------------------ */

test('setzt die Platzhalter ein', () => {
  const text = fillCleaningText(CLEANING_DEFAULT_TEXT, {
    previousGroup: 'Gruppe 2',
    previousTeam: 'Bader Roger & Sylvie',
    nextGroup: 'Gruppe 3',
    nextTeam: 'Nanogjoka Arbi & Melina',
  })

  assert.equal(
    text,
    'Herzlichen Dank an Bader Roger & Sylvie (Gruppe 2) für das Putzen in der vergangenen Woche. ' +
      'In der kommenden Woche ist Gruppe 3 an der Reihe: Nanogjoka Arbi & Melina.',
  )
})

test('gibt nichts zurück, wenn ein gebrauchter Platzhalter leer bliebe', () => {
  const facts = {
    previousGroup: '',
    previousTeam: '',
    nextGroup: 'Gruppe 3',
    nextTeam: 'Nanogjoka Arbi & Melina',
  }
  assert.equal(fillCleaningText(CLEANING_DEFAULT_TEXT, facts), null)

  // Ein Text, der die fehlenden Angaben gar nicht braucht, geht durch.
  assert.equal(
    fillCleaningText('Diese Woche putzt {gruppe-neu}.', facts),
    'Diese Woche putzt Gruppe 3.',
  )
})

test('lässt unbekannte Klammerausdrücke stehen', () => {
  assert.equal(
    fillCleaningText('Bis {irgendwann} um {gruppe-neu}', {
      previousGroup: 'Gruppe 2',
      previousTeam: 'Team',
      nextGroup: 'Gruppe 3',
      nextTeam: 'Team',
    }),
    'Bis {irgendwann} um Gruppe 3',
  )
})
