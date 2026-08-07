import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AP_TIMEZONE,
  buildApIcs,
  escapeIcsText,
  foldIcsLine,
  icsDay,
  icsStamp,
  nextDayKey,
  parseIcsTime,
  type IcsActivity,
} from '../src/lib/apIcs.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Übersetzung des Aktivitätenplans in eine Kalenderdatei.
 * Die Fehler, die dabei drohen, sieht man einer Datei nicht an – ein
 * fehlender letzter Lagertag, ein zerrissenes «ä», eine UID, die sich beim
 * Bearbeiten ändert und den Termin im Google-Kalender verdoppelt. Genau
 * diese Fälle stehen hier.
 */

const now = new Date('2026-08-07T09:41:12.000Z')

const activity = (partial: Partial<IcsActivity> & { date: string }): IcsActivity => ({
  id: `id-${partial.date}`,
  kind: 'activity',
  title: 'Bouldern',
  ...partial,
})

/**
 * Die Faltung rückgängig machen.
 *
 * Sie ist im Format vorgeschrieben und deshalb richtig – zum Prüfen steht
 * aber der Inhalt einer Zeile in Frage und nicht, an welcher Stelle sie
 * umbrochen wurde. Ein «Bemerkung: Schuhe mitbringen» darf mitten im Wort
 * über zwei Zeilen gehen.
 */
const unfold = (ics: string) => ics.replace(/\r\n /g, '')

/** Die logischen Zeilen der Datei – gefaltete wieder zusammengesetzt. */
const linesOf = (ics: string) => unfold(ics).split('\r\n')

const build = (
  activities: IcsActivity[],
  options: Partial<Parameters<typeof buildApIcs>[1]> = {},
) => buildApIcs(activities, { name: 'Aktivitäten AP', domain: 'bss.example.ch', now, ...options })

/* ------------------------------------------------------------------ */
/* Text absichern                                                      */
/* ------------------------------------------------------------------ */

test('Komma und Semikolon werden maskiert – sie trennen sonst Werte', () => {
  assert.equal(
    escapeIcsText('Kleine Entscheidungen, grosse Folgen'),
    'Kleine Entscheidungen\\, grosse Folgen',
  )
  assert.equal(escapeIcsText('Josh; Alain'), 'Josh\\; Alain')
})

test('der Rückstrich wird zuerst maskiert und nicht doppelt', () => {
  assert.equal(escapeIcsText('a\\b,c'), 'a\\\\b\\,c')
})

test('Zeilenumbrüche werden zu \\n, der Doppelpunkt bleibt stehen', () => {
  assert.equal(escapeIcsText('Zeile 1\nZeile 2'), 'Zeile 1\\nZeile 2')
  assert.equal(escapeIcsText('Treffpunkt: Kirche'), 'Treffpunkt: Kirche')
})

/* ------------------------------------------------------------------ */
/* Zeilen falten                                                       */
/* ------------------------------------------------------------------ */

test('kurze Zeilen bleiben, wie sie sind', () => {
  assert.equal(foldIcsLine('SUMMARY:Bouldern'), 'SUMMARY:Bouldern')
})

test('lange Zeilen brechen bei 75 Oktetten und werden mit Leerzeichen fortgesetzt', () => {
  const folded = foldIcsLine(`SUMMARY:${'x'.repeat(200)}`)
  const parts = folded.split('\r\n')

  assert.ok(parts.length > 1)
  assert.equal(parts[0].length, 75)
  for (const part of parts.slice(1)) {
    assert.equal(part.startsWith(' '), true)
    assert.ok(Buffer.byteLength(part, 'utf8') <= 75)
  }
  // Nichts geht verloren: Ohne die Faltung steht wieder das Original da.
  assert.equal(folded.replace(/\r\n /g, ''), `SUMMARY:${'x'.repeat(200)}`)
})

test('gezählt wird in Bytes, und ein Umlaut wird nicht zerrissen', () => {
  // 40 «ä» sind 80 Oktette: Der Umbruch muss vor dem 38. Zeichen liegen.
  const folded = foldIcsLine('ä'.repeat(40))
  const parts = folded.split('\r\n')

  assert.ok(parts.length > 1)
  for (const part of parts) assert.ok(Buffer.byteLength(part, 'utf8') <= 75)
  // Kein halbes Zeichen: Wieder zusammengesetzt sind es genau 40 «ä».
  assert.equal(folded.replace(/\r\n /g, ''), 'ä'.repeat(40))
})

/* ------------------------------------------------------------------ */
/* Daten und Zeiten                                                    */
/* ------------------------------------------------------------------ */

test('Tagesschlüssel werden zu kompakten Daten', () => {
  assert.equal(icsDay('2026-01-07'), '20260107')
})

test('der Folgetag über Monats-, Jahres- und Schaltjahresgrenzen', () => {
  assert.equal(nextDayKey('2026-01-07'), '2026-01-08')
  assert.equal(nextDayKey('2026-01-31'), '2026-02-01')
  assert.equal(nextDayKey('2026-12-31'), '2027-01-01')
  assert.equal(nextDayKey('2028-02-28'), '2028-02-29')
})

test('der Folgetag stimmt auch am Tag der Zeitumstellung', () => {
  // In Zürich hat der 25. Oktober 2026 nur 23 Stunden, der 26. deren 25.
  assert.equal(nextDayKey('2026-10-25'), '2026-10-26')
  assert.equal(nextDayKey('2026-03-29'), '2026-03-30')
})

test('Zeitstempel stehen in UTC ohne Millisekunden', () => {
  assert.equal(icsStamp(now), '20260807T094112Z')
})

test('die Uhrzeit wird nachsichtig gelesen', () => {
  assert.deepEqual(parseIcsTime('19:30'), { hour: 19, minute: 30 })
  assert.deepEqual(parseIcsTime('19.30'), { hour: 19, minute: 30 })
  assert.deepEqual(parseIcsTime('19:30 Uhr'), { hour: 19, minute: 30 })
  assert.deepEqual(parseIcsTime('9:00'), { hour: 9, minute: 0 })
})

test('was keine Zeit ist, gilt als keine Zeit', () => {
  assert.equal(parseIcsTime(''), null)
  assert.equal(parseIcsTime(undefined), null)
  assert.equal(parseIcsTime('nach Absprache'), null)
  assert.equal(parseIcsTime('25:00'), null)
  assert.equal(parseIcsTime('19:70'), null)
})

/* ------------------------------------------------------------------ */
/* Der Rahmen                                                          */
/* ------------------------------------------------------------------ */

test('die Datei trägt Kopf, Zeitzone und Abschluss', () => {
  const lines = linesOf(build([]))

  assert.equal(lines[0], 'BEGIN:VCALENDAR')
  assert.ok(lines.includes('VERSION:2.0'))
  assert.ok(lines.includes(`TZID:${AP_TIMEZONE}`))
  assert.ok(lines.includes('BEGIN:VTIMEZONE'))
  assert.ok(lines.includes('END:VTIMEZONE'))
  assert.ok(lines.includes('X-WR-CALNAME:Aktivitäten AP'))
  // Die letzte Zeile ist leer, weil die Datei mit CRLF endet.
  assert.equal(lines.at(-2), 'END:VCALENDAR')
})

test('Zeilen enden mit CRLF, nicht mit LF', () => {
  const ics = build([activity({ date: '2026-01-07' })])

  assert.ok(ics.endsWith('\r\n'))
  // Kein einziges LF ohne davorstehendes CR.
  assert.equal(/[^\r]\n/.test(ics), false)
})

test('Termine stehen nach Datum geordnet, unabhängig von der Reihenfolge', () => {
  const ics = build([
    activity({ date: '2026-03-04', id: 'spaet' }),
    activity({ date: '2026-01-07', id: 'frueh' }),
  ])

  assert.ok(ics.indexOf('UID:frueh@') < ics.indexOf('UID:spaet@'))
})

/* ------------------------------------------------------------------ */
/* Ein einzelner Termin                                                */
/* ------------------------------------------------------------------ */

test('ohne Uhrzeit wird der Termin ganztägig, DTEND ist der Folgetag', () => {
  const lines = linesOf(build([activity({ date: '2026-01-07' })]))

  assert.ok(lines.includes('DTSTART;VALUE=DATE:20260107'))
  assert.ok(lines.includes('DTEND;VALUE=DATE:20260108'))
})

test('ohne Ende bekommt der Termin die übliche Länge', () => {
  const lines = linesOf(build([activity({ date: '2026-01-07', time: '19:30' })]))

  assert.ok(lines.includes(`DTSTART;TZID=${AP_TIMEZONE}:20260107T193000`))
  assert.ok(lines.includes('DURATION:PT90M'))
  assert.ok(lines.includes('TRANSP:OPAQUE'))
})

test('die übliche Länge lässt sich vorgeben', () => {
  const lines = linesOf(
    build([activity({ date: '2026-01-07', time: '19:30' })], { durationMinutes: 120 }),
  )

  assert.ok(lines.includes('DURATION:PT120M'))
})

/* ------------------------------------------------------------------ */
/* Von – bis                                                           */
/* ------------------------------------------------------------------ */

test('mit Ende steht der Termin genau so lange – nichts wird geschätzt', () => {
  const lines = linesOf(
    build([activity({ date: '2026-01-07', time: '19:30', endTime: '21:00' })], {
      durationMinutes: 120,
    }),
  )

  assert.ok(lines.includes(`DTSTART;TZID=${AP_TIMEZONE}:20260107T193000`))
  assert.ok(lines.includes(`DTEND;TZID=${AP_TIMEZONE}:20260107T210000`))
  // Entweder das eine oder das andere: Beides zusammen wäre ungültig.
  assert.equal(
    lines.some((line) => line.startsWith('DURATION:')),
    false,
  )
})

test('ein Ende, das nicht nach dem Beginn liegt, zählt nicht', () => {
  for (const endTime of ['19:30', '09:00']) {
    const lines = linesOf(build([activity({ date: '2026-01-07', time: '19:30', endTime })]))

    assert.equal(
      lines.some((line) => line.startsWith('DTEND;TZID')),
      false,
      `«${endTime}» hätte kein DTEND ergeben dürfen`,
    )
    assert.ok(lines.includes('DURATION:PT90M'))
  }
})

test('ein Ende ohne Beginn macht aus dem Termin keinen Zeitpunkt', () => {
  const lines = linesOf(build([activity({ date: '2026-01-07', endTime: '21:00' })]))

  assert.ok(lines.includes('DTSTART;VALUE=DATE:20260107'))
  assert.ok(lines.includes('DTEND;VALUE=DATE:20260108'))
})

/* ------------------------------------------------------------------ */
/* Die Klasse – immer von 11 bis 12                                    */
/* ------------------------------------------------------------------ */

test('die Klasse steht von 11 bis 12, auch ohne Zeitangabe am Termin', () => {
  // Der 11. Januar 2026 ist der 2. Sonntag.
  const lines = linesOf(build([activity({ date: '2026-01-11', kind: 'class', title: 'Glaube' })]))

  assert.ok(lines.includes(`DTSTART;TZID=${AP_TIMEZONE}:20260111T110000`))
  assert.ok(lines.includes(`DTEND;TZID=${AP_TIMEZONE}:20260111T120000`))
  // Kein ganztägiger Balken mehr – die Stunde steht fest.
  assert.equal(
    lines.some((line) => line.startsWith('DTSTART;VALUE=DATE')),
    false,
  )
  assert.ok(lines.includes('TRANSP:OPAQUE'))
})

test('eine verschobene Klasse dauert ihre Stunde ab dem eingetragenen Beginn', () => {
  const lines = linesOf(
    build([activity({ date: '2026-01-11', kind: 'class', time: '09:00', title: 'Glaube' })]),
  )

  assert.ok(lines.includes(`DTSTART;TZID=${AP_TIMEZONE}:20260111T090000`))
  assert.ok(lines.includes(`DTEND;TZID=${AP_TIMEZONE}:20260111T100000`))
})

test('ein eingetragenes Ende gilt auch bei der Klasse', () => {
  const lines = linesOf(
    build([
      activity({ date: '2026-01-11', kind: 'class', time: '11:00', endTime: '11:45', title: 'K' }),
    ]),
  )

  assert.ok(lines.includes(`DTEND;TZID=${AP_TIMEZONE}:20260111T114500`))
})

test('die übliche Länge gilt der Klasse nicht – sie ist eine Stunde', () => {
  const lines = linesOf(
    build([activity({ date: '2026-01-11', kind: 'class', title: 'Glaube' })], {
      durationMinutes: 120,
    }),
  )

  assert.ok(lines.includes(`DTEND;TZID=${AP_TIMEZONE}:20260111T120000`))
})

test('die feste Stunde gilt der Klasse und keiner anderen Art', () => {
  const lines = linesOf(
    build([
      activity({ date: '2026-01-07', id: 'mittwoch' }),
      activity({ date: '2026-01-10', id: 'lager', kind: 'special', title: 'Lager' }),
      activity({ date: '2026-01-21', id: 'fhv', kind: 'cancelled', title: 'FHV' }),
    ]),
  )

  // Ohne Zeitangabe bleibt alles Übrige ganztägig – «11:00» wäre geraten.
  assert.equal(lines.filter((line) => line.startsWith('DTSTART;VALUE=DATE')).length, 3)
  assert.equal(
    lines.some((line) => line.startsWith('DTSTART;TZID')),
    false,
  )
})

test('ein mehrtägiger Anlass reicht bis zum Tag nach dem letzten – nicht bis zum letzten', () => {
  // Das Lager vom Freitag bis zum Sonntag: DTEND ist der Montag.
  const lines = linesOf(
    build([activity({ date: '2026-07-31', endDate: '2026-08-02', title: 'Lager' })]),
  )

  assert.ok(lines.includes('DTSTART;VALUE=DATE:20260731'))
  assert.ok(lines.includes('DTEND;VALUE=DATE:20260803'))
})

test('ein mehrtägiger Anlass bleibt ganztägig, die Uhrzeiten wandern in den Text', () => {
  // Das Lager von Freitag 18:00 bis Sonntag 14:00.
  const ics = unfold(
    build([
      activity({
        date: '2026-07-31',
        endDate: '2026-08-02',
        time: '18:00',
        endTime: '14:00',
        title: 'Lager',
      }),
    ]),
  )

  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260731'))
  assert.equal(ics.includes('DTSTART;TZID'), false)
  assert.equal(ics.includes('DTEND;TZID'), false)
  assert.ok(ics.includes('Beginn: 18:00'))
  assert.ok(ics.includes('Ende: 14:00'))
})

test('endDate gleich date zählt als ein Tag', () => {
  const lines = linesOf(build([activity({ date: '2026-01-07', endDate: '2026-01-07' })]))

  assert.ok(lines.includes('DTEND;VALUE=DATE:20260108'))
})

test('ein ausgefallener Abend bleibt stehen und sagt es im Titel', () => {
  const ics = build([activity({ date: '2026-01-21', kind: 'cancelled', title: 'FHV' })])

  assert.ok(ics.includes('SUMMARY:Fällt aus – FHV'))
  // Nicht STATUS:CANCELLED – etliche Kalender blenden solche Einträge aus.
  assert.equal(ics.includes('STATUS:CANCELLED'), false)
  assert.ok(ics.includes('TRANSP:TRANSPARENT'))
})

test('ein Termin ohne Titel bekommt einen Platzhalter statt einer leeren Zeile', () => {
  const ics = build([activity({ date: '2026-01-07', title: '   ' })])

  assert.ok(ics.includes('SUMMARY:Noch offen'))
})

/* ------------------------------------------------------------------ */
/* Die UID – daran hängt, ob Änderungen ankommen                        */
/* ------------------------------------------------------------------ */

test('die UID ist die Firestore-ID und trägt den Host', () => {
  const ics = build([activity({ date: '2026-01-07', id: 'abc123' })])

  assert.ok(ics.includes('UID:abc123@bss.example.ch'))
})

test('dieselbe ID ergibt dieselbe UID, auch wenn sich alles andere ändert', () => {
  const before = build([activity({ date: '2026-01-07', id: 'abc123', title: 'Bouldern' })])
  const after = build([
    activity({ date: '2026-01-14', id: 'abc123', title: 'Etwas ganz anderes', time: '20:00' }),
  ])

  assert.ok(before.includes('UID:abc123@bss.example.ch'))
  assert.ok(after.includes('UID:abc123@bss.example.ch'))
})

test('LAST-MODIFIED steht nur, wenn der Termin ein Änderungsdatum hat', () => {
  const withDate = build([
    activity({ date: '2026-01-07', updatedAt: new Date('2026-06-01T08:00:00.000Z') }),
  ])
  const without = build([activity({ date: '2026-01-07' })])

  assert.ok(withDate.includes('LAST-MODIFIED:20260601T080000Z'))
  assert.equal(without.includes('LAST-MODIFIED'), false)
})

/* ------------------------------------------------------------------ */
/* Was unter dem Titel steht                                           */
/* ------------------------------------------------------------------ */

test('nur gefüllte Felder stehen im Text', () => {
  const ics = unfold(
    build([
      activity({
        date: '2026-01-07',
        leader: 'Carden',
        bishopric: 'Josh, Alain',
        advisor: '   ',
        note: 'Schuhe mitbringen',
      }),
    ]),
  )

  assert.ok(ics.includes('Zuständig AP: Carden'))
  assert.ok(ics.includes('Bischofschaft: Josh\\, Alain'))
  assert.equal(ics.includes('Berater:'), false)
  assert.ok(ics.includes('Bemerkung: Schuhe mitbringen'))
})

test('ohne jede Angabe entfällt der Text ganz', () => {
  const ics = build([activity({ date: '2026-01-07' })])

  assert.equal(ics.includes('DESCRIPTION:'), false)
})

test('das führende Kollegium des Monats kommt dazu', () => {
  const ics = unfold(
    build([activity({ date: '2026-03-04' })], {
      leadership: new Map([['2026-03', 'Leitung Diakone']]),
    }),
  )

  assert.ok(ics.includes('Monat: Leitung Diakone'))
})

test('der Treffpunkt steht als LOCATION, aber nur wenn es einen gibt', () => {
  const withPlace = linesOf(build([activity({ date: '2026-01-07', location: 'Gemeindehaus' })]))
  const without = linesOf(build([activity({ date: '2026-01-07', location: '  ' })]))

  assert.ok(withPlace.includes('LOCATION:Gemeindehaus'))
  // Ganze Zeilen, nicht Textsuche: Der Zeitzonenblock trägt ein
  // `X-LIC-LOCATION`, und darauf passt ein blosses «LOCATION:» ebenfalls.
  assert.equal(
    without.some((line) => line.startsWith('LOCATION:')),
    false,
  )
})
