import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  exportRows,
  isMusicCalling,
  musicCandidates,
  musicPersonKey,
  musicPersonOf,
  musicRoleFields,
  rangeEnd,
  scheduledMusicPeople,
  sundaysInRange,
  sundaysOf,
} from '../src/lib/musicRoles.ts'
import type { Calling, CallingStatus, Member, SacramentMeeting } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird, was an Organist und Dirigent hängt: dass ein Mitglied und
 * ein von Hand erfasster Name dieselbe Person bleiben, dass die beiden
 * Rollen sich nicht vermischen, dass die Berufungen die Vorschläge liefern –
 * und dass Filter und Ausdruck dieselben Sonntage zeigen.
 */

const sunday = (iso: string) => new Date(`${iso}T12:00:00`)

const meeting = (iso: string, partial: Partial<SacramentMeeting> = {}): SacramentMeeting =>
  ({
    id: iso,
    date: sunday(iso),
    hymns: {},
    musicalNumbers: [],
    announcements: [],
    business: [],
    programOrder: [],
    ...partial,
  }) as unknown as SacramentMeeting

const member = (id: string, firstName: string, lastName: string): Member =>
  ({ id, firstName, lastName, status: 'active' }) as unknown as Member

const calling = (
  memberId: string,
  position: string,
  status: CallingStatus = 'set_apart',
): Calling =>
  ({
    id: `c-${memberId}`,
    memberId,
    memberName: memberId,
    position,
    organization: 'other',
    status,
  }) as unknown as Calling

/* ------------------------------------------------------------------ */
/* Wer eingeteilt ist                                                  */
/* ------------------------------------------------------------------ */

test('erkennt Mitglied und Namen von Hand als dieselbe Auskunft', () => {
  const withMember = musicPersonOf(
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Bir' }),
    'organist',
  )
  assert.deepEqual(withMember, {
    key: 'organist:mitglied:m1',
    role: 'organist',
    memberId: 'm1',
    name: 'Anna Bir',
  })

  const byName = musicPersonOf(
    meeting('2026-09-13', { choristerName: 'Besuch aus Thun' }),
    'chorister',
  )
  assert.deepEqual(byName, {
    key: 'chorister:name:besuch aus thun',
    role: 'chorister',
    memberId: null,
    name: 'Besuch aus Thun',
  })

  assert.equal(musicPersonOf(meeting('2026-09-20'), 'organist'), null)
  assert.equal(musicPersonOf(meeting('2026-09-20', { organistName: '  ' }), 'organist'), null)
  assert.equal(musicPersonOf(null, 'chorister'), null)
})

test('hält die beiden Rollen auseinander', () => {
  const both = meeting('2026-09-06', {
    organistId: 'm1',
    organistName: 'Anna Zaugg',
    choristerId: 'm2',
    choristerName: 'Beat Aebi',
  })
  assert.equal(musicPersonOf(both, 'organist')?.name, 'Anna Zaugg')
  assert.equal(musicPersonOf(both, 'chorister')?.name, 'Beat Aebi')

  // Dieselbe Person in beiden Rollen ergibt zwei verschiedene Schlüssel –
  // sonst liesse sich nicht nach «wann spielt sie» und «wann dirigiert sie»
  // getrennt fragen.
  assert.notEqual(
    musicPersonKey('organist', 'm1', 'Anna'),
    musicPersonKey('chorister', 'm1', 'Anna'),
  )
})

test('schlägt den Namen eines Mitglieds im Verzeichnis nach', () => {
  // Geheiratet: Am Sonntag steht der alte Name, im Verzeichnis der neue.
  const row = musicPersonOf(
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Bir' }),
    'organist',
    () => 'Anna Muster',
  )
  assert.equal(row?.name, 'Anna Muster')
  // Der Schlüssel bleibt derselbe – sonst zerfielen ihre Sonntage in zwei Personen.
  assert.equal(row?.key, musicPersonKey('organist', 'm1', 'Anna Bir'))
})

test('vergleicht Namen ohne Rücksicht auf Schreibweise', () => {
  assert.equal(
    musicPersonKey('organist', null, 'Hans Müller'),
    musicPersonKey('organist', null, '  hans müller '),
  )
  assert.notEqual(
    musicPersonKey('organist', null, 'Hans Müller'),
    musicPersonKey('organist', 'm1', 'Hans Müller'),
  )
})

test('schreibt beide Felder einer Rolle gemeinsam', () => {
  assert.deepEqual(musicRoleFields('organist', { memberId: 'm1', name: 'Anna Zaugg' }), {
    organistId: 'm1',
    organistName: 'Anna Zaugg',
  })
  assert.deepEqual(musicRoleFields('chorister', { memberId: null, name: 'Besuch' }), {
    choristerId: null,
    choristerName: 'Besuch',
  })
  // Nichts eingetragen heisst: beide Felder leeren, kein halber Eintrag.
  assert.deepEqual(musicRoleFields('chorister', null), {
    choristerId: null,
    choristerName: null,
  })
  assert.deepEqual(musicRoleFields('organist', { memberId: null, name: '   ' }), {
    organistId: null,
    organistName: null,
  })
})

/* ------------------------------------------------------------------ */
/* Wer in Frage kommt                                                  */
/* ------------------------------------------------------------------ */

test('findet die Berufung über den Wortstamm – je Rolle den eigenen', () => {
  assert.ok(isMusicCalling(calling('m1', 'Organist'), 'organist'))
  assert.ok(isMusicCalling(calling('m2', 'Organistin'), 'organist'))
  assert.ok(isMusicCalling(calling('m3', 'Musik – Organist'), 'organist'))
  assert.ok(!isMusicCalling(calling('m4', 'Musikleiterin'), 'organist'))
  // Entlassen ist keine laufende Berufung mehr.
  assert.ok(!isMusicCalling(calling('m5', 'Organist', 'released'), 'organist'))

  assert.ok(isMusicCalling(calling('m6', 'Dirigent'), 'chorister'))
  assert.ok(isMusicCalling(calling('m7', 'Dirigentin der Gemeinde'), 'chorister'))
  // Und keine der beiden Rollen erbt die Berufung der anderen.
  assert.ok(!isMusicCalling(calling('m6', 'Dirigent'), 'organist'))
  assert.ok(!isMusicCalling(calling('m1', 'Organist'), 'chorister'))
})

test('schlägt die Berufenen alphabetisch vor', () => {
  const members = [
    member('m1', 'Anna', 'Zaugg'),
    member('m2', 'Beat', 'Aebi'),
    member('m3', 'Cla', 'Meier'),
  ]
  const callings = [
    calling('m1', 'Organistin'),
    calling('m2', 'Organist'),
    calling('m3', 'Dirigent'),
  ]
  assert.deepEqual(
    musicCandidates(members, callings, 'organist').map((m) => m.id),
    ['m2', 'm1'],
  )
  assert.deepEqual(
    musicCandidates(members, callings, 'chorister').map((m) => m.id),
    ['m3'],
  )
})

test('nimmt die bisher Eingeteilten beider Rollen in die Auswahl', () => {
  const meetings = [
    meeting('2026-09-06', {
      organistId: 'm1',
      organistName: 'Anna Zaugg',
      choristerName: 'Besuch aus Thun',
    }),
    // Dieselbe Person ein zweites Mal – sie steht trotzdem nur einmal da.
    meeting('2026-09-20', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-27', { choristerId: 'm2', choristerName: 'Beat Aebi' }),
    meeting('2026-10-04'),
  ]

  // Organisten zuerst, darin nach Namen – so steht es auch im Filter.
  assert.deepEqual(
    scheduledMusicPeople(meetings).map((entry) => `${entry.role}/${entry.name}`),
    ['organist/Anna Zaugg', 'chorister/Beat Aebi', 'chorister/Besuch aus Thun'],
  )
  assert.deepEqual(
    scheduledMusicPeople(meetings, ['chorister']).map((entry) => entry.name),
    ['Beat Aebi', 'Besuch aus Thun'],
  )
})

/* ------------------------------------------------------------------ */
/* Die Sonntage einer Person                                           */
/* ------------------------------------------------------------------ */

test('zeigt alle Sonntage einer Person, nach Datum geordnet', () => {
  const meetings = [
    meeting('2026-09-20', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-13', { choristerId: 'm1', choristerName: 'Anna Zaugg' }),
  ]

  // Nur die Sonntage an der Orgel – der eine am Dirigentenpult zählt nicht mit.
  assert.deepEqual(
    sundaysOf(meetings, ['organist:mitglied:m1']).map((row) => row.dateKey),
    ['2026-09-06', '2026-09-20'],
  )
  assert.deepEqual(
    sundaysOf(meetings, ['chorister:mitglied:m1']).map((row) => row.dateKey),
    ['2026-09-13'],
  )
  assert.deepEqual(sundaysOf(meetings, []), [])
})

test('trägt zu jedem Sonntag beide Rollen mit', () => {
  const rows = sundaysOf(
    [
      meeting('2026-09-06', {
        organistId: 'm1',
        organistName: 'Anna Zaugg',
        choristerId: 'm2',
        choristerName: 'Beat Aebi',
      }),
    ],
    ['organist:mitglied:m1'],
  )
  assert.equal(rows[0].people.organist?.name, 'Anna Zaugg')
  assert.equal(rows[0].people.chorister?.name, 'Beat Aebi')
})

/* ------------------------------------------------------------------ */
/* Der Ausdruck                                                        */
/* ------------------------------------------------------------------ */

test('rechnet den Ausschnitt vom gewählten Sonntag an vorwärts', () => {
  const start = sunday('2026-09-06')
  assert.equal(rangeEnd(start, 'week').getTime(), sunday('2026-09-13').getTime())
  assert.equal(rangeEnd(start, 'quarter').getTime(), sunday('2026-12-06').getTime())

  assert.deepEqual(
    sundaysInRange(start, 'week').map((d) => d.toISOString().slice(0, 10)),
    ['2026-09-06'],
  )
  // Ein Monat *ab* dem gewählten Sonntag – nicht der Kalendermonat. Der
  // 4. Oktober liegt vor dem 6. Oktober und gehört deshalb dazu.
  assert.deepEqual(
    sundaysInRange(start, 'month').map((d) => d.toISOString().slice(0, 10)),
    ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04'],
  )
})

test('nimmt auch Sonntage auf, für die noch nichts erfasst ist', () => {
  const rows = exportRows(sunday('2026-09-06'), 'month', [
    meeting('2026-09-13', {
      organistId: 'm1',
      organistName: 'Anna Zaugg',
      hymns: { opening: { number: 2, code: '2', title: 'Der Geist aus den Höhen' } },
    }),
  ])
  assert.deepEqual(
    rows.map((row) => row.dateKey),
    ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04'],
  )
  assert.equal(rows[0].people.organist, null)
  assert.equal(rows[1].hymns.opening?.title, 'Der Geist aus den Höhen')
})

test('schränkt den Ausdruck auf ausgewählte Personen ein – über beide Rollen', () => {
  const meetings = [
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-13', { choristerName: 'Besuch aus Thun' }),
    meeting('2026-09-20', { choristerId: 'm2', choristerName: 'Beat Aebi' }),
  ]
  const start = sunday('2026-09-06')

  // Ohne Auswahl: alle Sonntage, auch die ohne jede Einteilung.
  assert.equal(exportRows(start, 'month', meetings).length, 5)

  assert.deepEqual(
    exportRows(start, 'month', meetings, [
      'organist:mitglied:m1',
      'chorister:name:besuch aus thun',
    ]).map((row) => row.dateKey),
    ['2026-09-06', '2026-09-13'],
  )
  assert.deepEqual(
    exportRows(start, 'month', meetings, ['chorister:mitglied:m2']).map((row) => row.dateKey),
    ['2026-09-20'],
  )
})
