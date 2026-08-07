import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Timestamp } from 'firebase/firestore'

import {
  isOrganizationTag,
  isPrimaryAge,
  isYouthAge,
  matchesOrganizations,
  organizationsOf,
  primaryStart,
  turnedEighteenSince,
  withTag,
} from '../src/lib/organizations.ts'
import type { Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die vier Organisationen der Gemeinde schliessen lückenlos aneinander an,
 * und genau an den Nahtstellen entscheidet sich, ob der Filter taugt: der
 * Tag, an dem ein Kind anderthalb wird; der Jahreswechsel, an dem die PV
 * endet und JD/AP beginnt; der achtzehnte Geburtstag, an dem JAE anfängt.
 */

const day = (iso: string) => new Date(`${iso}T12:00:00`)

function member(partial: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    lastName: 'Muster',
    firstName: 'Hans',
    gender: 'm',
    birthDate: null,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
    ...partial,
  } as Member
}

const born = (iso: string) => Timestamp.fromDate(day(iso))

/* ------------------------------------------------------------------ */
/* PV                                                                  */
/* ------------------------------------------------------------------ */

test('primaryStart liegt genau achtzehn Monate nach der Geburt', () => {
  assert.equal(primaryStart(day('2024-03-14')).toDateString(), day('2025-09-14').toDateString())
  assert.equal(primaryStart(day('2024-01-31')).toDateString(), day('2025-07-31').toDateString())
})

test('primaryStart rutscht nicht in den Folgemonat', () => {
  // 31. August + 18 Monate wäre der 31. Februar – den gibt es nicht.
  assert.equal(primaryStart(day('2024-08-31')).toDateString(), day('2026-02-28').toDateString())
})

test('die PV beginnt auf den Tag genau mit anderthalb Jahren', () => {
  const birth = day('2024-03-14')
  assert.equal(isPrimaryAge(birth, day('2025-09-13')), false)
  assert.equal(isPrimaryAge(birth, day('2025-09-14')), true)
})

test('die PV endet erst am Jahresende – nicht am elften Geburtstag', () => {
  const birth = day('2015-01-20')
  // Elf wird das Kind im Januar 2026 …
  assert.equal(isPrimaryAge(birth, day('2026-01-21')), true)
  // … und bleibt bis Silvester in der PV.
  assert.equal(isPrimaryAge(birth, day('2026-12-31')), true)
  assert.equal(isPrimaryAge(birth, day('2027-01-01')), false)
})

/* ------------------------------------------------------------------ */
/* JD / AP                                                             */
/* ------------------------------------------------------------------ */

test('JD/AP beginnt mit dem Jahreswechsel, nicht mit dem zwölften Geburtstag', () => {
  const birth = day('2015-01-20')
  assert.equal(isYouthAge(birth, day('2026-12-31')), false)
  // Am 1. Januar des Jahres, in dem das Kind zwölf wird.
  assert.equal(isYouthAge(birth, day('2027-01-01')), true)
})

test('PV und JD/AP schliessen lückenlos und überschneidungsfrei an', () => {
  const birth = day('2015-07-04')
  for (const date of ['2026-12-31', '2027-01-01']) {
    const pv = isPrimaryAge(birth, day(date))
    const youth = isYouthAge(birth, day(date))
    assert.equal(pv !== youth, true, `${date}: genau eine der beiden Gruppen`)
  }
})

test('JD/AP endet auf den Tag genau mit dem achtzehnten Geburtstag', () => {
  const birth = day('2008-05-20')
  assert.equal(isYouthAge(birth, day('2026-05-19')), true)
  assert.equal(isYouthAge(birth, day('2026-05-20')), false)
})

/* ------------------------------------------------------------------ */
/* Die Gruppe eines Mitglieds                                          */
/* ------------------------------------------------------------------ */

test('JAE und AE kommen aus dem Schlagwort', () => {
  const jae = member({ tags: ['JAE'] })
  const ae = member({ tags: ['AE', 'Neubekehrt'] })
  assert.deepEqual(organizationsOf(jae, day('2026-08-07')), ['jae'])
  assert.deepEqual(organizationsOf(ae, day('2026-08-07')), ['ae'])
})

test('ohne Geburtsdatum bleiben PV und JD/AP aussen vor', () => {
  assert.deepEqual(organizationsOf(member({ birthDate: null }), day('2026-08-07')), [])
})

test('das Alter allein macht niemanden zum JAE', () => {
  // Zweiundzwanzig, aber auf keiner Liste – über den Familienstand weiss die
  // App nichts, und sie soll nichts erfinden.
  const grown = member({ birthDate: born('2004-03-01'), tags: [] })
  assert.deepEqual(organizationsOf(grown, day('2026-08-07')), [])
})

/* ------------------------------------------------------------------ */
/* Die Lücke zwischen zwei Importen                                    */
/* ------------------------------------------------------------------ */

test('wer seit dem letzten Import achtzehn wurde, gilt als JAE', () => {
  const young = member({ birthDate: born('2008-06-15') })
  const now = day('2026-08-07')
  // Die Liste wurde im Mai eingelesen, der Geburtstag war im Juni.
  assert.deepEqual(organizationsOf(young, now, day('2026-05-01')), ['jae'])
})

test('wer schon vor dem letzten Import achtzehn wurde, gilt nicht als JAE', () => {
  // Er war beim Import volljährig und stand trotzdem nicht auf der Liste –
  // dann gehört er auch nicht dazu (verheiratet, weggezogen, was auch immer).
  const young = member({ birthDate: born('2008-01-15') })
  assert.deepEqual(organizationsOf(young, day('2026-08-07'), day('2026-05-01')), [])
})

test('ohne Import geschieht nichts', () => {
  const young = member({ birthDate: born('2008-06-15') })
  assert.deepEqual(organizationsOf(young, day('2026-08-07'), null), [])
  assert.equal(turnedEighteenSince(young, null, day('2026-08-07')), false)
})

test('der achtzehnte Geburtstag in der Zukunft zählt nicht', () => {
  const child = member({ birthDate: born('2010-06-15') })
  assert.equal(turnedEighteenSince(child, day('2026-05-01'), day('2026-08-07')), false)
})

test('wer als AE geführt wird, wird nicht nebenbei zum JAE', () => {
  const single = member({ birthDate: born('2008-06-15'), tags: ['AE'] })
  assert.deepEqual(organizationsOf(single, day('2026-08-07'), day('2026-05-01')), ['ae'])
})

test('JD/AP und die Lücke überschneiden sich nicht', () => {
  const birth = born('2008-06-15')
  const teen = member({ birthDate: birth })
  const since = day('2026-01-01')
  // Am Tag vor dem achtzehnten Geburtstag: JD/AP, sonst nichts.
  assert.deepEqual(organizationsOf(teen, day('2026-06-14'), since), ['jdap'])
  // Am Geburtstag selbst: JAE, sonst nichts.
  assert.deepEqual(organizationsOf(teen, day('2026-06-15'), since), ['jae'])
})

/* ------------------------------------------------------------------ */
/* Der Filter                                                          */
/* ------------------------------------------------------------------ */

test('nichts gewählt heisst alle', () => {
  assert.equal(matchesOrganizations(member(), [], day('2026-08-07')), true)
  assert.equal(matchesOrganizations(member(), undefined, day('2026-08-07')), true)
})

test('mehrere gewählte Gruppen wirken als «oder»', () => {
  const jae = member({ tags: ['JAE'] })
  assert.equal(matchesOrganizations(jae, ['jae', 'ae'], day('2026-08-07')), true)
  assert.equal(matchesOrganizations(jae, ['ae'], day('2026-08-07')), false)
  assert.equal(matchesOrganizations(jae, ['pv', 'jdap'], day('2026-08-07')), false)
})

/* ------------------------------------------------------------------ */
/* Schlagworte                                                         */
/* ------------------------------------------------------------------ */

test('isOrganizationTag erkennt die beiden Schlagworte der Listen', () => {
  assert.equal(isOrganizationTag('JAE'), true)
  assert.equal(isOrganizationTag('AE'), true)
  assert.equal(isOrganizationTag('Neubekehrt'), false)
  assert.equal(isOrganizationTag('jae'), false)
})

test('withTag setzt, nimmt weg und lässt die übrigen in Ruhe', () => {
  assert.deepEqual(withTag(['Neubekehrt'], 'JAE', true), ['Neubekehrt', 'JAE'])
  assert.deepEqual(withTag(['Neubekehrt', 'JAE'], 'JAE', false), ['Neubekehrt'])
  assert.deepEqual(withTag(undefined, 'AE', true), ['AE'])
})

test('withTag schreibt nichts doppelt und ändert die Reihenfolge nicht', () => {
  assert.deepEqual(withTag(['JAE', 'Neubekehrt'], 'JAE', true), ['JAE', 'Neubekehrt'])
  assert.deepEqual(withTag(['Neubekehrt'], 'JAE', false), ['Neubekehrt'])
})
