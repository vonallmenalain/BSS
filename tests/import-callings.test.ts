import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parsePastedCallings } from '../src/services/importCallings.ts'
import { buildCallingsPreview } from '../src/services/importMatch.ts'
import type { Calling, CallingStatus, Member, Organization } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Testdaten sind erfunden, haben aber denselben Aufbau wie die
 * kopierten LCR-Seiten «Organisationen» und «Berufungen ausserhalb der
 * Einheit».
 *
 * Schwerpunkt ist das Entlassen: Ein Import ersetzt seinen Bereich, statt
 * ihn zu ergänzen. Das ist der einzige Teil, der Daten wegnimmt – er
 * gehört deshalb besonders geprüft.
 */

/* ------------------------------------------------------------------ */
/* Testdaten                                                           */
/* ------------------------------------------------------------------ */

const ORGANIZATION_PAGE = [
  'Skip to Main ContentSign In',
  'Kirche Jesu Christi der Heiligen der Letzten Tage',
  'Hilfsmittel für Führungsbeamte und Sekretäre',
  'Organisationen',
  '',
  'Bischofschaft',
  'Berufung\tName\tBestätigt\tEingesetzt',
  'Bischof',
  'Amsler, Peter Daniel',
  '6 Nov 2022\t13 Nov 2022',
  'Erster Ratgeber',
  'Brunner, Simon',
  '6 Nov 2022',
  'Zweiter Ratgeber',
  'Berufung offen',
  'Anzahl: 3',
  '',
  'Sonntagsschule',
  'Lehrkräfte',
  'Berufung\tName\tBestätigt\tEingesetzt',
  'Sonntagsschullehrer',
  'Cadonau, Rita',
  '4 Feb 2024',
  'Anzahl: 1',
  'Feedback geben',
].join('\n')

const OUT_OF_UNIT_PAGE = [
  'Hilfsmittel für Führungsbeamte und Sekretäre',
  'Berufungen ausserhalb der Einheit',
  'Seminarlehrer\tDahinden, Marc\t14 Aug 2023',
  'Institutslehrerin\tEgger, Nadja Vera\t1 Sep 2024',
  'Anzahl: 2',
].join('\n')

function member(id: string, lastName: string, firstName: string): Member {
  return {
    id,
    lastName,
    firstName,
    gender: 'unknown',
    birthDate: null,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
  }
}

function calling(
  id: string,
  memberId: string,
  position: string,
  organization: Organization,
  status: CallingStatus,
  extra: Partial<Calling> = {},
): Calling {
  return {
    id,
    memberId,
    memberName: '',
    position,
    organization,
    status,
    proposedDate: null,
    extendedDate: null,
    sustainedDate: null,
    setApartDate: null,
    releasedDate: null,
    ...extra,
  }
}

const MEMBERS = [
  member('m1', 'Amsler', 'Peter Daniel'),
  member('m2', 'Brunner', 'Simon'),
  member('m3', 'Cadonau', 'Rita'),
  member('m4', 'Dahinden', 'Marc'),
  member('m5', 'Egger', 'Nadja Vera'),
  member('m6', 'Frei', 'Lukas'),
]

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

test('liest die Organisationsseite mit Untergruppe und offener Berufung', () => {
  const parsed = parsePastedCallings(ORGANIZATION_PAGE)

  assert.equal(parsed.source, 'organizations')
  assert.equal(parsed.vacant, 1)
  assert.deepEqual(
    parsed.callings.map((c) => [c.fullName, c.position, c.organization, c.group]),
    [
      ['Amsler, Peter Daniel', 'Bischof', 'bishopric', ''],
      ['Brunner, Simon', 'Erster Ratgeber', 'bishopric', ''],
      ['Cadonau, Rita', 'Sonntagsschullehrer', 'sunday_school', 'Lehrkräfte'],
    ],
  )
  assert.equal(parsed.callings[0].setApart, '13 Nov 2022')
  assert.equal(parsed.callings[1].setApart, '')
})

test('behält die Reihenfolge der Quelle', () => {
  // Im LCR steht der Bischof zuoberst, dann die Ratgeber. Alphabetisch
  // sortiert stünde er zwischen den Lehrern.
  const parsed = parsePastedCallings(ORGANIZATION_PAGE)
  assert.deepEqual(
    parsed.callings.map((c) => [c.order, c.position]),
    [
      [0, 'Bischof'],
      [1, 'Erster Ratgeber'],
      [2, 'Sonntagsschullehrer'],
    ],
  )
})

test('meldet, welche Organisationen die Quelle abdeckt', () => {
  const parsed = parsePastedCallings(ORGANIZATION_PAGE)
  assert.deepEqual([...parsed.organizations].sort(), ['bishopric', 'sunday_school'])
})

test('deckt auch eine Organisation ab, in der jede Berufung offen ist', () => {
  const parsed = parsePastedCallings(
    [
      'Junge Damen',
      'Berufung\tName\tBestätigt\tEingesetzt',
      'JD-Leiterin',
      'Berufung offen',
      'Anzahl: 1',
    ].join('\n'),
  )
  assert.deepEqual(parsed.organizations, ['young_women'])
  assert.equal(parsed.callings.length, 0)
  assert.equal(parsed.vacant, 1)
})

test('liest die Seite «ausserhalb der Einheit»', () => {
  const parsed = parsePastedCallings(OUT_OF_UNIT_PAGE)

  assert.equal(parsed.source, 'outOfUnit')
  assert.deepEqual(parsed.organizations, [])
  assert.deepEqual(
    parsed.callings.map((c) => [c.fullName, c.position, c.outOfUnit]),
    [
      ['Dahinden, Marc', 'Seminarlehrer', true],
      ['Egger, Nadja Vera', 'Institutslehrerin', true],
    ],
  )
})

/* ------------------------------------------------------------------ */
/* Vorschau: anlegen, aktualisieren, überspringen                      */
/* ------------------------------------------------------------------ */

test('erkennt bestehende Berufungen und aktualisiert sie', () => {
  const existing = [calling('c1', 'm1', 'Bischof', 'bishopric', 'set_apart')]
  const preview = buildCallingsPreview(parsePastedCallings(ORGANIZATION_PAGE), MEMBERS, existing)

  assert.equal(preview.createCount, 2)
  assert.equal(preview.updateCount, 1)
  assert.equal(preview.skipCount, 0)
  assert.equal(preview.vacant, 1)
  assert.equal(preview.rows.find((r) => r.parsed.position === 'Bischof')?.existingId, 'c1')
  assert.deepEqual(preview.releases, [])
})

test('überspringt Namen ohne passendes Mitglied, statt sie anzulegen', () => {
  const preview = buildCallingsPreview(parsePastedCallings(ORGANIZATION_PAGE), [MEMBERS[0]], [])

  assert.equal(preview.skipCount, 2)
  assert.equal(preview.createCount, 1)
  assert.ok(preview.rows[1].warnings.length > 0)
})

/* ------------------------------------------------------------------ */
/* Vorschau: entlassen                                                 */
/* ------------------------------------------------------------------ */

test('entlässt, was die Quelle für eine abgedeckte Organisation nicht mehr führt', () => {
  const existing = [
    calling('c1', 'm1', 'Bischof', 'bishopric', 'set_apart'),
    calling('c2', 'm6', 'Gemeindesekretär', 'bishopric', 'sustained'),
  ]
  const preview = buildCallingsPreview(parsePastedCallings(ORGANIZATION_PAGE), MEMBERS, existing)

  assert.deepEqual(
    preview.releases.map((c) => c.id),
    ['c2'],
  )
})

test('hält Gemeinde und Pfahl auseinander, auch bei gleicher Bezeichnung', () => {
  // Dieselbe Person, dieselbe Bezeichnung, verschiedene Einheiten: Der
  // Import darf die eine Berufung nicht für die andere halten.
  const page = [
    'Sonntagsschule',
    'Berufung\tName\tBestätigt\tEingesetzt',
    'Sonntagsschulpräsident',
    'Amsler, Peter Daniel',
    '4 Feb 2024',
    'Anzahl: 1',
  ].join('\n')

  const stakeCalling = calling('c1', 'm1', 'Sonntagsschulpräsident', 'other', 'sustained', {
    outOfUnit: true,
  })
  const preview = buildCallingsPreview(parsePastedCallings(page), MEMBERS, [stakeCalling])

  // Angelegt, nicht aktualisiert – und die Pfahlberufung bleibt stehen.
  assert.equal(preview.createCount, 1)
  assert.equal(preview.updateCount, 0)
  assert.deepEqual(preview.releases, [])
})

test('lässt Organisationen unberührt, die nicht eingefügt wurden', () => {
  const existing = [calling('c1', 'm6', 'FHV-Leiterin', 'relief_society', 'set_apart')]
  const preview = buildCallingsPreview(parsePastedCallings(ORGANIZATION_PAGE), MEMBERS, existing)

  assert.deepEqual(preview.releases, [])
})

test('lässt Berufungen in Vorbereitung stehen – das LCR kennt sie nicht', () => {
  const existing = [
    calling('c1', 'm6', 'Sonntagsschullehrer', 'sunday_school', 'proposed'),
    calling('c2', 'm6', 'Zweiter Ratgeber', 'bishopric', 'extended'),
    calling('c3', 'm6', 'Erster Ratgeber', 'bishopric', 'released'),
  ]
  const preview = buildCallingsPreview(parsePastedCallings(ORGANIZATION_PAGE), MEMBERS, existing)

  assert.deepEqual(preview.releases, [])
})

test('trennt Gemeinde und «ausserhalb der Einheit»', () => {
  const inUnit = calling('c1', 'm6', 'Gemeindesekretär', 'bishopric', 'sustained')
  const outside = calling('c2', 'm6', 'Pfahlsekretär', 'other', 'sustained', { outOfUnit: true })
  const existing = [inUnit, outside]

  const fromOrganizations = buildCallingsPreview(
    parsePastedCallings(ORGANIZATION_PAGE),
    MEMBERS,
    existing,
  )
  assert.deepEqual(
    fromOrganizations.releases.map((c) => c.id),
    ['c1'],
  )

  const fromOutOfUnit = buildCallingsPreview(
    parsePastedCallings(OUT_OF_UNIT_PAGE),
    MEMBERS,
    existing,
  )
  assert.deepEqual(
    fromOutOfUnit.releases.map((c) => c.id),
    ['c2'],
  )
})

test('entlässt nichts, wenn die Quelle nichts hergibt', () => {
  const existing = [
    calling('c1', 'm6', 'Gemeindesekretär', 'bishopric', 'sustained'),
    calling('c2', 'm6', 'Pfahlsekretär', 'other', 'sustained', { outOfUnit: true }),
  ]

  for (const text of ['', '   ', 'Irgendein kopierter Text ohne Tabelle']) {
    const preview = buildCallingsPreview(parsePastedCallings(text), MEMBERS, existing)
    assert.deepEqual(preview.releases, [], `Quelle: «${text}»`)
  }
})
