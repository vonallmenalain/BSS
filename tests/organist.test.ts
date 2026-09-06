import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  exportRows,
  isOrganistCalling,
  organistCandidates,
  organistKey,
  organistOf,
  rangeEnd,
  scheduledOrganists,
  sundaysInRange,
  sundaysOf,
} from '../src/lib/organist.ts'
import type { Calling, CallingStatus, Member, SacramentMeeting } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird, was am Organisten hängt: dass ein Mitglied und ein von Hand
 * erfasster Name dieselbe Person bleiben, dass die Berufung «Organist» die
 * Vorschläge liefert, und dass Filter und Ausdruck dieselben Sonntage
 * zeigen.
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
/* Wer spielt                                                          */
/* ------------------------------------------------------------------ */

test('erkennt Mitglied und Namen von Hand als dieselbe Auskunft', () => {
  const withMember = organistOf(
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Bir' }),
  )
  assert.deepEqual(withMember, { key: 'mitglied:m1', memberId: 'm1', name: 'Anna Bir' })

  const byName = organistOf(meeting('2026-09-13', { organistName: 'Besuch aus Thun' }))
  assert.deepEqual(byName, {
    key: 'name:besuch aus thun',
    memberId: null,
    name: 'Besuch aus Thun',
  })

  assert.equal(organistOf(meeting('2026-09-20')), null)
  assert.equal(organistOf(meeting('2026-09-20', { organistName: '  ' })), null)
  assert.equal(organistOf(null), null)
})

test('schlägt den Namen eines Mitglieds im Verzeichnis nach', () => {
  // Geheiratet: Am Sonntag steht der alte Name, im Verzeichnis der neue.
  const row = organistOf(
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Bir' }),
    () => 'Anna Muster',
  )
  assert.equal(row?.name, 'Anna Muster')
  // Der Schlüssel bleibt derselbe – sonst zerfielen ihre Sonntage in zwei Personen.
  assert.equal(row?.key, organistKey('m1', 'Anna Bir'))
})

test('vergleicht Namen ohne Rücksicht auf Schreibweise', () => {
  assert.equal(organistKey(null, 'Hans Müller'), organistKey(null, '  hans müller '))
  assert.notEqual(organistKey(null, 'Hans Müller'), organistKey('m1', 'Hans Müller'))
})

/* ------------------------------------------------------------------ */
/* Wer kommt in Frage                                                  */
/* ------------------------------------------------------------------ */

test('findet die Berufung an der Orgel über den Wortstamm', () => {
  assert.ok(isOrganistCalling(calling('m1', 'Organist')))
  assert.ok(isOrganistCalling(calling('m2', 'Organistin')))
  assert.ok(isOrganistCalling(calling('m3', 'Musik – Organist')))
  assert.ok(!isOrganistCalling(calling('m4', 'Musikleiterin')))
  // Entlassen ist keine laufende Berufung mehr.
  assert.ok(!isOrganistCalling(calling('m5', 'Organist', 'released')))
})

test('schlägt die Organisten alphabetisch vor', () => {
  const members = [
    member('m1', 'Anna', 'Zaugg'),
    member('m2', 'Beat', 'Aebi'),
    member('m3', 'Cla', 'Meier'),
  ]
  const callings = [calling('m1', 'Organistin'), calling('m2', 'Organist')]
  assert.deepEqual(
    organistCandidates(members, callings).map((m) => m.id),
    ['m2', 'm1'],
  )
})

test('nimmt auch die bisher Eingeteilten in die Auswahl', () => {
  const meetings = [
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-13', { organistName: 'Besuch aus Thun' }),
    // Dieselbe Person ein zweites Mal – sie steht trotzdem nur einmal da.
    meeting('2026-09-20', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-27'),
  ]
  assert.deepEqual(
    scheduledOrganists(meetings).map((entry) => entry.name),
    ['Anna Zaugg', 'Besuch aus Thun'],
  )
})

/* ------------------------------------------------------------------ */
/* Die Sonntage einer Person                                           */
/* ------------------------------------------------------------------ */

test('zeigt alle Sonntage einer Person, nach Datum geordnet', () => {
  const meetings = [
    meeting('2026-09-20', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-13', { organistName: 'Besuch aus Thun' }),
  ]
  assert.deepEqual(
    sundaysOf(meetings, ['mitglied:m1']).map((row) => row.dateKey),
    ['2026-09-06', '2026-09-20'],
  )
  assert.deepEqual(
    sundaysOf(meetings, ['name:besuch aus thun']).map((row) => row.dateKey),
    ['2026-09-13'],
  )
  assert.deepEqual(sundaysOf(meetings, []), [])
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
  assert.equal(rows[0].organist, null)
  assert.equal(rows[1].hymns.opening?.title, 'Der Geist aus den Höhen')
})

test('schränkt den Ausdruck auf ausgewählte Organisten ein', () => {
  const meetings = [
    meeting('2026-09-06', { organistId: 'm1', organistName: 'Anna Zaugg' }),
    meeting('2026-09-13', { organistName: 'Besuch aus Thun' }),
    meeting('2026-09-20', { organistId: 'm2', organistName: 'Beat Aebi' }),
  ]
  const start = sunday('2026-09-06')

  // Ohne Auswahl: alle Sonntage, auch die ohne Organist.
  assert.equal(exportRows(start, 'month', meetings).length, 5)

  assert.deepEqual(
    exportRows(start, 'month', meetings, ['mitglied:m1', 'name:besuch aus thun']).map(
      (row) => row.dateKey,
    ),
    ['2026-09-06', '2026-09-13'],
  )
})
