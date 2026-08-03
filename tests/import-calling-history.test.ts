import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  historyNote,
  parseCallingHistory,
  parseListDate,
} from '../src/services/importCallingHistory.ts'
import { buildCallingHistoryPreview, buildCallingsPreview } from '../src/services/importMatch.ts'
import { parsePastedCallings } from '../src/services/importCallings.ts'
import type { RawSheet, SheetCell } from '../src/services/importHistory.ts'
import type { Calling, Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Testdaten sind erfunden, haben aber denselben Aufbau wie die
 * gewachsene Berufungsliste – samt ihrer Eigenheiten: das Kennzeichen
 * «B/E», das es in den ältesten Blättern noch nicht gibt, drei
 * Schreibweisen für dasselbe Datum und Ämter, die einmal mit und einmal
 * ohne Organisationskürzel geschrieben wurden.
 *
 * Schwerpunkt ist das Zusammenfügen: Aus zwei Zeilen – Berufung und
 * Entlassung – wird eine Berufung mit Anfang und Ende. Trifft es die
 * falsche, entsteht ein Verlauf, den es nie gab.
 */

/* ------------------------------------------------------------------ */
/* Testdaten                                                           */
/* ------------------------------------------------------------------ */

/** Ein Blatt mit der Kopfzeile, wie sie seit 2016 geführt wird. */
function sheet(name: string, rows: SheetCell[][]): RawSheet {
  return {
    sheet: name,
    data: [
      [
        'Nr.',
        ' \n Organisation',
        ' \n Amt',
        ' \n Name',
        ' \n Vorname',
        ' Berufung/Entlassung \nerfolgt durch',
        'berufen/\nentlassen\nam',
        'bestätigt/\nDanke für Dienst am',
        'ein-\ngesetzt\nam',
        'Eingesetzt von',
        'LDS.org',
        'Berufung/\nEntlassung\nB/E',
      ],
      ...rows,
    ],
  }
}

/** Ein Blatt aus der Zeit vor der Spalte «B/E». */
function oldSheet(name: string, rows: SheetCell[][]): RawSheet {
  return {
    sheet: name,
    data: [
      [
        '\n Nr.',
        ' \n Organisation',
        ' \n Amt',
        ' \n Name',
        ' \n Vorname',
        ' Berufung Beauftragung Entlassung er-\n folgt durch',
        'berufen beauftragt\nentlassen\nam',
        ' in Vers.\n bestätigt\n am',
        'ein-\ngesetzt\nam',
        'eingesetzt\nvon',
      ],
      ...rows,
    ],
  }
}

const LISTE: RawSheet[] = [
  oldSheet('Arbeitsblatt ab 2013', [
    // Berufung ohne Kennzeichen: «eingesetzt am» ist ausgefüllt.
    [
      '1001',
      'PV',
      'Lehrerin',
      'Amsler',
      'Rita',
      'Simon Brunner',
      '14.04.13',
      '21.04.13',
      '21.04.13',
      'Simon Brunner',
    ],
    // Entlassung ohne Kennzeichen: «eingesetzt am» ist durchgestrichen.
    [
      '1002',
      'PV',
      'Präsidentin',
      'Bürge',
      'Nadja',
      'Simon Brunner',
      '02.06.13',
      '09.06.13',
      '//////',
      '//////',
    ],
    ['1003', 'Soschu', 'Lehrer', 'Cadonau', 'Marc', 'Simon Brunner', null, null, null, null],
  ]),
  sheet('Arbeitsblatt ab 2016', [
    // Dieselbe Aufgabe, anders geschrieben – die Entlassung gehört zu 1001.
    [
      '001',
      'PV',
      'Lehrerin PV',
      'Amsler',
      'Rita',
      'Simon Brunner',
      '3/26/2017',
      '3/26/2017',
      null,
      null,
      null,
      'E',
    ],
    [
      '002',
      'FHV',
      'Beauftragte für Geburtstagskarten',
      'Amsler',
      'Rita',
      'Simon Brunner',
      '2.4.2017',
      null,
      null,
      null,
      null,
      'B',
    ],
    // Entlassung ohne Berufung: Die Aufgabe begann vor der Tabelle.
    [
      '003',
      'Bischofschaft',
      'Gemeindesekretär',
      'Dahinden',
      'Peter',
      'Simon Brunner',
      '15,01,2018',
      null,
      '///',
      '///',
      null,
      'E',
    ],
    // Berufung ausserhalb der Einheit – am Amt zu erkennen.
    [
      '004',
      'Anderes',
      'Seminarlehrerin',
      'Egger',
      'Nadja Vera',
      'Simon Brunner',
      new Date(2018, 7, 12),
      null,
      null,
      null,
      null,
      'B',
    ],
    // Unbekanntes Kürzel: kommt unter «Übrige» mit und wird gemeldet.
    [
      '005',
      'Nachbarschaft',
      'Kontaktperson',
      'Cadonau',
      'Marc',
      null,
      '20.05.2018',
      null,
      null,
      null,
      null,
      'B',
    ],
  ]),
]

const MEMBERS: Member[] = [
  member('m1', 'Amsler', 'Rita'),
  member('m2', 'Buerge', 'Nadja'),
  member('m3', 'Cadonau', 'Marc'),
  member('m4', 'Egger', 'Nadja Vera'),
]

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

function find(parsed: ReturnType<typeof parseCallingHistory>, position: string) {
  const found = parsed.callings.filter((calling) => calling.position === position)
  assert.equal(found.length, 1, `«${position}» sollte genau einmal vorkommen`)
  return found[0]
}

/* ------------------------------------------------------------------ */
/* Datum                                                               */
/* ------------------------------------------------------------------ */

test('Datum: Punkt heisst Tag zuerst, Schrägstrich Monat zuerst', () => {
  assert.equal(parseListDate('24.03.13'), '2013-03-24')
  assert.equal(parseListDate('3/26/2017'), '2017-03-26')
  // Vorne eine Zahl über zwölf: dann war doch der Tag gemeint.
  assert.equal(parseListDate('26/3/2017'), '2017-03-26')
  // Mit Komma getippt, wie es in der Liste vorkommt.
  assert.equal(parseListDate('15,01,2015'), '2015-01-15')
  assert.equal(parseListDate(new Date(2020, 10, 8)), '2020-11-08')
})

test('Datum: was sich nicht sicher lesen lässt, bleibt leer', () => {
  for (const value of ['????', 'längst', '######', '//////', '20.10', '', null, '07.02.106']) {
    assert.equal(parseListDate(value), null, `«${value}» sollte ungelesen bleiben`)
  }
  // Den 31. Februar gibt es nicht.
  assert.equal(parseListDate('31.02.2017'), null)
})

/* ------------------------------------------------------------------ */
/* Lesen und Zusammenfügen                                             */
/* ------------------------------------------------------------------ */

test('Berufung und Entlassung werden zu einer Berufung mit Anfang und Ende', () => {
  const parsed = parseCallingHistory(LISTE)
  const lehrerin = find(parsed, 'Lehrerin')

  assert.equal(lehrerin.fullName, 'Amsler, Rita')
  assert.equal(lehrerin.organization, 'primary')
  assert.equal(lehrerin.startDate, '2013-04-14')
  assert.equal(lehrerin.extendedDate, '2013-04-14')
  assert.equal(lehrerin.sustainedDate, '2013-04-21')
  assert.equal(lehrerin.setApartDate, '2013-04-21')
  // «Lehrerin PV» meint dasselbe Amt wie «Lehrerin».
  assert.equal(lehrerin.released, true)
  assert.equal(lehrerin.releasedDate, '2017-03-26')
})

test('Ohne Spalte «B/E» gilt als Entlassung, was durchgestrichen ist', () => {
  const parsed = parseCallingHistory(LISTE)
  const praesidentin = find(parsed, 'Präsidentin')

  assert.equal(praesidentin.released, true)
  assert.equal(praesidentin.releasedDate, '2013-06-02')
  // Eine Entlassung ohne Berufung hat keinen Anfang – sie begann vor der Tabelle.
  assert.equal(praesidentin.startDate, null)
  assert.equal(praesidentin.sustainedDate, null)
})

test('Eine Berufung ohne Entlassung bleibt offen', () => {
  const parsed = parseCallingHistory(LISTE)
  const karten = find(parsed, 'Beauftragte für Geburtstagskarten')

  assert.equal(karten.released, false)
  assert.equal(karten.releasedDate, null)
  assert.equal(karten.startDate, '2017-04-02')
  assert.equal(parsed.open, 4)
  assert.match(historyNote(karten), /Keine Entlassung erfasst/)
})

test('Berufungen ausserhalb der Einheit werden erkannt', () => {
  const parsed = parseCallingHistory(LISTE)
  const seminar = find(parsed, 'Seminarlehrerin')

  assert.equal(seminar.outOfUnit, true)
  assert.equal(seminar.startDate, '2018-08-12')
  assert.equal(find(parsed, 'Lehrerin').outOfUnit, false)
})

test('Unbekannte Kürzel werden gemeldet, nicht verschwiegen', () => {
  const parsed = parseCallingHistory(LISTE)

  assert.deepEqual(parsed.unknownOrganizations, ['Nachbarschaft'])
  assert.equal(find(parsed, 'Kontaktperson').organization, 'other')
})

test('Jede Quellzeile trägt eine eigene, stabile Kennung', () => {
  const parsed = parseCallingHistory(LISTE)
  const refs = parsed.callings.map((calling) => calling.ref)

  assert.equal(new Set(refs).size, refs.length)
  assert.equal(find(parsed, 'Lehrerin').ref, '2013-002')
  // Zweimal dasselbe Blatt gelesen ergibt dieselben Kennungen.
  assert.deepEqual(
    parseCallingHistory(LISTE).callings.map((c) => c.ref),
    refs,
  )
})

test('Blätter ohne Kopfzeile werden übersprungen', () => {
  const parsed = parseCallingHistory([
    ...LISTE,
    { sheet: 'Drop-down', data: [['Bischofschaft'], ['FHV'], ['PV']] },
  ])

  assert.deepEqual(parsed.skippedSheets, ['Drop-down'])
})

/* ------------------------------------------------------------------ */
/* Zuordnen                                                            */
/* ------------------------------------------------------------------ */

test('Berufungen werden den erfassten Personen zugeordnet', () => {
  const parsed = parseCallingHistory(LISTE)
  const preview = buildCallingHistoryPreview(parsed, MEMBERS, [])

  const lehrerin = preview.rows.find((row) => row.calling.position === 'Lehrerin')
  assert.equal(lehrerin?.memberId, 'm1')
  assert.equal(lehrerin?.action, 'create')
  assert.equal(lehrerin?.existingId, null)

  // «Bürge» findet «Buerge» – wie überall beim Abgleich.
  assert.equal(preview.rows.find((row) => row.calling.position === 'Präsidentin')?.memberId, 'm2')

  assert.equal(preview.createCount, 6)
  assert.equal(preview.members.length, 4)
})

test('Namen ohne Person werden gemeldet, nicht geraten', () => {
  const parsed = parseCallingHistory(LISTE)
  const preview = buildCallingHistoryPreview(parsed, [MEMBERS[0]], [])

  assert.deepEqual(
    preview.unmatched.map((entry) => entry.fullName),
    ['Cadonau, Marc', 'Bürge, Nadja', 'Dahinden, Peter', 'Egger, Nadja Vera'],
  )
  assert.equal(preview.skipCount, 5)
  assert.equal(preview.rows.filter((row) => row.action === 'skip').length, 5)
})

test('Von Hand zugeordnete Namen kommen mit, weggelegte verschwinden', () => {
  const parsed = parseCallingHistory(LISTE)
  const preview = buildCallingHistoryPreview(parsed, [MEMBERS[0]], [], {
    overrides: { 'Bürge, Nadja': 'm1' },
    ignored: ['Cadonau, Marc'],
  })

  assert.equal(preview.rows.find((row) => row.calling.position === 'Präsidentin')?.memberId, 'm1')
  assert.deepEqual(preview.dismissed, [{ fullName: 'Cadonau, Marc', count: 2 }])
  assert.equal(preview.ignoredCount, 2)
  // Weggelegte Namen stehen nicht mehr unter den offenen.
  assert.deepEqual(
    preview.unmatched.map((entry) => entry.fullName),
    ['Dahinden, Peter', 'Egger, Nadja Vera'],
  )
})

/* ------------------------------------------------------------------ */
/* Bestand                                                             */
/* ------------------------------------------------------------------ */

const RUNNING: Calling = {
  id: 'c1',
  memberId: 'm1',
  memberName: 'Amsler, Rita',
  position: 'Beauftragte für Geburtstagskarten',
  organization: 'relief_society',
  status: 'set_apart',
  proposedDate: null,
  extendedDate: null,
  sustainedDate: null,
  setApartDate: null,
  releasedDate: null,
}

test('Was im Bestand noch läuft, bleibt unberührt', () => {
  const parsed = parseCallingHistory(LISTE)
  const preview = buildCallingHistoryPreview(parsed, MEMBERS, [RUNNING])
  const karten = preview.rows.find(
    (row) => row.calling.position === 'Beauftragte für Geburtstagskarten',
  )

  // Kein Schreibvorgang: weder ein zweiter Eintrag noch eine Ergänzung am
  // laufenden. Der LCR ist die Wahrheit über den heutigen Stand.
  assert.equal(karten?.action, 'running')
  assert.equal(karten?.existingId, 'c1')
  assert.equal(preview.runningCount, 1)
  assert.equal(preview.createCount, 5)
  assert.equal(preview.withoutRelease.length, 3)
})

test('Ein entlassener Eintrag im Bestand hält den Verlauf nicht auf', () => {
  const parsed = parseCallingHistory(LISTE)
  const preview = buildCallingHistoryPreview(parsed, MEMBERS, [{ ...RUNNING, status: 'released' }])

  assert.equal(preview.runningCount, 0)
  assert.equal(preview.createCount, 6)
})

test('Eine abgeschlossene Berufung ist immer ein eigener Abschnitt', () => {
  const parsed = parseCallingHistory(LISTE)
  // Rita Amsler ist heute wieder PV-Lehrerin – der frühere Abschnitt bleibt
  // trotzdem ein eigener Eintrag.
  const preview = buildCallingHistoryPreview(parsed, MEMBERS, [
    { ...RUNNING, id: 'c2', position: 'Lehrerin', organization: 'primary' },
  ])

  assert.equal(preview.rows.find((row) => row.calling.position === 'Lehrerin')?.action, 'create')
})

test('Aus einer fehlenden Entlassung wird nie eine laufende Berufung', () => {
  const parsed = parseCallingHistory(LISTE)
  const preview = buildCallingHistoryPreview(parsed, MEMBERS, [])

  // Sie kommen als Verlauf mit und stehen danach zum Nachbearbeiten bereit.
  assert.deepEqual(
    new Set(preview.withoutRelease.map((row) => row.calling.position)),
    new Set(['Lehrer', 'Beauftragte für Geburtstagskarten', 'Seminarlehrerin', 'Kontaktperson']),
  )
  assert.equal(
    preview.withoutRelease.every((row) => row.action === 'create' && !row.calling.released),
    true,
  )
})

test('Übernommene Vergangenheit ist für den LCR-Abgleich unsichtbar', () => {
  // Rita Amsler war 2013–2017 PV-Lehrerin und ist es seit 2024 wieder.
  const earlier: Calling = {
    ...RUNNING,
    id: 'bh-2013-002',
    position: 'Lehrerin',
    organization: 'primary',
    status: 'released',
    history: true,
  }

  const pasted = parsePastedCallings(
    [
      'Primarvereinigung',
      'Berufung\tName\tBestätigt\tEingesetzt',
      'Lehrerin',
      'Amsler, Rita',
      '4 Feb 2024',
      'Anzahl: 1',
    ].join('\n'),
    'organizations',
  )
  const preview = buildCallingsPreview(pasted, MEMBERS, [earlier])

  // Der frühere Abschnitt wird nicht wiederbelebt, sondern bleibt stehen –
  // die heutige Berufung entsteht als eigener Eintrag.
  assert.equal(preview.rows[0].action, 'create')
  assert.equal(preview.rows[0].existingId, null)
  assert.equal(preview.releases.length, 0)
})
