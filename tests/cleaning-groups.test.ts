import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deflateSync } from 'node:zlib'

import {
  assignedMemberIds,
  cleaningGroupNumber,
  entriesKey,
  entryLabelFromMembers,
  groupOfMember,
  homeWithAssignedParents,
  householdKey,
  isAdult,
  normalizedEntries,
  renamedTeams,
  responsibleEntry,
  unassignedMembers,
  wifeFirst,
  wifeFirstChanges,
  withoutConfirmed,
  withPendingGroups,
} from '../src/lib/cleaningGroups.ts'
import { pdfLines, pdfSegments, pdfTextItems } from '../src/lib/pdfText.ts'
import {
  activeMemberIndex,
  linesFromPdf,
  linesFromText,
  matchEntryMembers,
  parseCleaningGroups,
  splitEntryLabel,
} from '../src/services/importCleaningGroups.ts'
import type { Member } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Gruppeneinteilung fürs Putzen: das Lesen der Liste – aus
 * einem PDF wie dem von Google Docs und aus eingefügtem Text –, die
 * Zuordnung zu den Mitgliedern und was sich aus den Gruppen ablesen lässt.
 * Die Namen sind erfunden.
 */

/* ------------------------------------------------------------------ */
/* Ein PDF wie aus Google Docs                                         */
/* ------------------------------------------------------------------ */

/**
 * Baut ein kleines PDF im Stil von Google Docs: Schriften mit zwei Bytes je
 * Zeichen und einer `ToUnicode`-Tabelle, jedes Zeichen einzeln gesetzt, das
 * Koordinatensystem gespiegelt und gepackt – genau das, was der Leser können
 * muss.
 */
function googleDocsPdf(rows: { x: number; y: number; text: string; bold?: boolean }[]): Uint8Array {
  const chars = [...new Set(rows.flatMap((row) => [...row.text]))]
  const code = (char: string) =>
    (chars.indexOf(char) + 3).toString(16).padStart(4, '0').toUpperCase()
  const cmap = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '1 begincodespacerange <0000> <FFFF> endcodespacerange',
    `${chars.length} beginbfchar`,
    ...chars.map((char) => `<${code(char)}> <${char.charCodeAt(0).toString(16).padStart(4, '0')}>`),
    'endbfchar endcmap CMapName currentdict /CMap defineresource pop end end',
  ].join('\n')

  const content = ['1 0 0 -1 0 842 cm', 'q', '.75 0 0 .75 51 60 cm']
  for (const row of rows) {
    content.push('BT', `/${row.bold ? 'F5' : 'F4'} 14.666667 Tf`)
    ;[...row.text].forEach((char, index) => {
      // Wie Skia: je Zeichen eine eigene Position, die Schrift gespiegelt.
      content.push(`1 0 0 -1 ${row.x + index * 8} ${row.y} Tm <${code(char)}> Tj`)
    })
    content.push('ET')
  }
  content.push('Q')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 596 842] /Resources << /Font << /F4 4 0 R /F5 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /AAAAAA+ArialMT /Encoding /Identity-H /ToUnicode 6 0 R >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /BAAAAA+Arial-BoldMT /Encoding /Identity-H /ToUnicode 6 0 R >>',
  ]
  const parts: (string | Buffer)[] = ['%PDF-1.4\n']
  objects.forEach((body, index) => parts.push(`${index + 1} 0 obj\n${body}\nendobj\n`))
  for (const [id, data] of [
    [6, deflateSync(Buffer.from(cmap, 'latin1'))],
    [7, deflateSync(Buffer.from(content.join('\n'), 'latin1'))],
  ] as const) {
    parts.push(
      `${id} 0 obj\n<< /Filter /FlateDecode /Length ${data.length} >>\nstream\n`,
      data,
      '\nendstream\nendobj\n',
    )
  }
  parts.push('trailer\n<< /Root 1 0 R >>\n%%EOF\n')
  return new Uint8Array(
    Buffer.concat(
      parts.map((part) => (typeof part === 'string' ? Buffer.from(part, 'latin1') : part)),
    ),
  )
}

const LIST = googleDocsPdf([
  { x: 0, y: 0, text: 'Gruppeneinteilung Putzen, Version 12.05.2026' },
  { x: 0, y: 30, text: 'Gruppe 1' },
  { x: 120, y: 30, text: 'Muster Hans & Anna', bold: true },
  { x: 120, y: 47, text: 'Beispiel Lea' },
  { x: 120, y: 64, text: 'von Gunten Paul & Mia' },
  { x: 0, y: 81, text: 'Gruppe 2' },
  { x: 120, y: 81, text: 'Schär Noé & Céline', bold: true },
  { x: 120, y: 98, text: 'Hansruedi Bürki' },
])

test('das PDF liest sich Zeile für Zeile – mit Umlauten und Fettdruck', async () => {
  const lines = pdfLines(await pdfTextItems(LIST))
  const texts = lines.map((line) => pdfSegments(line).map((segment) => segment.text))
  assert.deepEqual(texts, [
    ['Gruppeneinteilung Putzen, Version 12.05.2026'],
    ['Gruppe 1', 'Muster Hans & Anna'],
    ['Beispiel Lea'],
    ['von Gunten Paul & Mia'],
    ['Gruppe 2', 'Schär Noé & Céline'],
    ['Hansruedi Bürki'],
  ])
  assert.deepEqual(
    pdfSegments(lines[1]).map((segment) => segment.bold),
    [false, true],
  )
})

test('aus dem PDF werden Gruppen – der fett gesetzte Haushalt ist zuständig', async () => {
  const parsed = parseCleaningGroups(await linesFromPdf(LIST))
  assert.equal(parsed.version, '12.05.2026')
  assert.equal(parsed.columns, false)
  assert.deepEqual(
    parsed.groups.map((group) => [group.number, group.entries.map((entry) => entry.label)]),
    [
      [1, ['Muster Hans & Anna', 'Beispiel Lea', 'von Gunten Paul & Mia']],
      [2, ['Schär Noé & Céline', 'Hansruedi Bürki']],
    ],
  )
  assert.equal(parsed.groups[0].entries[0].bold, true)
})

test('eine Datei, die kein PDF ist, ergibt nichts – statt eines Fehlers', async () => {
  assert.deepEqual(await linesFromPdf(new TextEncoder().encode('Gruppe 1 Muster')), [])
})

/* ------------------------------------------------------------------ */
/* Eingefügter Text                                                    */
/* ------------------------------------------------------------------ */

test('eingefügter Text: Zeile für Zeile oder als Tabelle mit Tabulatoren', () => {
  const rows =
    'Gruppeneinteilung Putzen\nGruppe 1 Muster Hans & Anna\nBeispiel Lea\nGruppe 2\tSchär Noé\n  Bürki Hansruedi  \n'
  const parsed = parseCleaningGroups(linesFromText(rows))
  assert.deepEqual(
    parsed.groups.map((group) => [group.number, group.entries.map((entry) => entry.label)]),
    [
      [1, ['Muster Hans & Anna', 'Beispiel Lea']],
      [2, ['Schär Noé', 'Bürki Hansruedi']],
    ],
  )
  // Ohne Fettdruck gilt der erste Eintrag als zuständig – er steht schon oben.
  assert.equal(parsed.groups[0].entries[0].label, 'Muster Hans & Anna')
})

test('spaltenweise kopiert, lässt sich nichts zuordnen – und das wird gemeldet', () => {
  const columns =
    'Gruppe 1\n\nGruppe 2\n\nGruppe 3\nMuster Hans\nBeispiel Lea\nSchär Noé\nBürki Hansruedi\n'
  assert.equal(parseCleaningGroups(linesFromText(columns)).columns, true)
})

test('ein fett gesetzter Haushalt weiter unten rückt nach oben', () => {
  const parsed = parseCleaningGroups([
    [{ text: 'Gruppe 4', bold: false }],
    [{ text: 'Beispiel Lea', bold: false }],
    [{ text: 'Muster Hans & Anna', bold: true }],
  ])
  assert.deepEqual(
    parsed.groups[0].entries.map((entry) => entry.label),
    ['Muster Hans & Anna', 'Beispiel Lea'],
  )
})

/* ------------------------------------------------------------------ */
/* Den Mitgliedern zuordnen                                            */
/* ------------------------------------------------------------------ */

let counter = 0
function member(firstName: string, lastName: string, extra: Partial<Member> = {}): Member {
  counter++
  return {
    id: `m${counter}`,
    firstName,
    lastName,
    status: 'active',
    birthDate: null,
    ...extra,
  } as Member
}

const MEMBERS = [
  member('Hans Peter', 'Muster'),
  member('Anna', 'Muster'),
  member('Lea', 'Beispiel'),
  member('Paul', 'von Gunten'),
  member('Mia', 'von Gunten'),
  member('Noé', 'Schär'),
  member('Céline', 'Schär-Bühler'),
  member('Hansruedi', 'Bürki'),
  member('Jennifer', 'Seeber'),
  member('Kevin', 'Seeber'),
  member('Sarah', 'Lauener'),
  member('Sarah', 'Lauener', { birthDate: { toDate: () => new Date(1990, 0, 1) } as never }),
  member('Nathan', 'Lauener'),
  member('Oscar', 'Morales-Römer'),
  member('Céleste', 'Römer'),
  member('Ruud', 'Den Brower'),
  member('Astrid', 'Den Brower'),
  member('Regina', 'Bürge'),
  member('Alt', 'Muster', { status: 'inactive' }),
]
const INDEX = activeMemberIndex(MEMBERS)
const ids = (...names: string[]) =>
  names.map((name) => MEMBERS.find((entry) => `${entry.firstName} ${entry.lastName}` === name)!.id)

test('Nachname und Vornamen – auch mehrteilig und andersherum', () => {
  assert.deepEqual(splitEntryLabel('Muster Hans & Anna', INDEX), {
    lastName: 'Muster',
    givenNames: ['Hans', 'Anna'],
  })
  assert.deepEqual(splitEntryLabel('von Gunten Paul & Mia', INDEX), {
    lastName: 'von Gunten',
    givenNames: ['Paul', 'Mia'],
  })
  assert.deepEqual(splitEntryLabel('Den Brower Ruud und Astrid', INDEX), {
    lastName: 'Den Brower',
    givenNames: ['Ruud', 'Astrid'],
  })
  assert.deepEqual(splitEntryLabel('Hansruedi Bürki', INDEX), {
    lastName: 'Bürki',
    givenNames: ['Hansruedi'],
  })
})

test('jedes Paar wird seinen beiden Mitgliedern zugeordnet', () => {
  // «Hans» genügt für «Hans Peter» – Zweitnamen stehen auf der Liste nicht.
  assert.deepEqual(matchEntryMembers('Muster Hans & Anna', INDEX), {
    memberIds: ids('Hans Peter Muster', 'Anna Muster'),
    unmatched: [],
  })
  assert.deepEqual(
    matchEntryMembers('Den Brower Ruud und Astrid', INDEX).memberIds,
    ids('Ruud Den Brower', 'Astrid Den Brower'),
  )
  assert.deepEqual(matchEntryMembers('Hansruedi Bürki', INDEX).memberIds, ids('Hansruedi Bürki'))
})

test('Doppelnamen, Tippfehler und Umlaute finden trotzdem zusammen', () => {
  // Céleste heisst nur «Römer», Oscar «Morales-Römer».
  assert.deepEqual(
    matchEntryMembers('Morales-Römer Oscar & Céleste', INDEX).memberIds,
    ids('Oscar Morales-Römer', 'Céleste Römer'),
  )
  // «Jennife» – das «r» fehlt auf der Liste.
  assert.deepEqual(
    matchEntryMembers('Seeber Kevin & Jennife', INDEX).memberIds,
    ids('Kevin Seeber', 'Jennifer Seeber'),
  )
  // «Buerge» für «Bürge».
  assert.deepEqual(matchEntryMembers('Buerge Regina', INDEX).memberIds, ids('Regina Bürge'))
  // Céline heisst «Schär-Bühler».
  assert.deepEqual(
    matchEntryMembers('Schär Noé & Céline', INDEX).memberIds,
    ids('Noé Schär', 'Céline Schär-Bühler'),
  )
})

test('Mehrdeutiges und Unbekanntes wird gemeldet statt geraten', () => {
  // Zwei Sarah Lauener – welche gemeint ist, entscheidet ein Mensch.
  assert.deepEqual(matchEntryMembers('Lauener Nathan & Sarah', INDEX), {
    memberIds: ids('Nathan Lauener'),
    unmatched: ['Lauener Sarah'],
  })
  assert.deepEqual(matchEntryMembers('Unbekannt Max', INDEX), {
    memberIds: [],
    unmatched: ['Unbekannt Max'],
  })
  // Inaktive Mitglieder werden nicht eingeteilt.
  assert.deepEqual(matchEntryMembers('Muster Alt', INDEX).memberIds, [])
})

/* ------------------------------------------------------------------ */
/* Was sich aus den Gruppen ablesen lässt                              */
/* ------------------------------------------------------------------ */

const GROUPS = [
  {
    number: 2,
    entries: [
      { id: 'a', label: 'Schär Noé & Céline', memberIds: ids('Noé Schär', 'Céline Schär-Bühler') },
      { id: 'b', label: 'Hansruedi Bürki', memberIds: ids('Hansruedi Bürki') },
    ],
  },
  {
    number: 1,
    entries: [
      { id: 'c', label: 'Muster Hans & Anna', memberIds: ids('Hans Peter Muster', 'Anna Muster') },
    ],
  },
]

test('zuständig ist, wer zuoberst steht', () => {
  assert.equal(responsibleEntry(GROUPS[0])?.label, 'Schär Noé & Céline')
  assert.equal(responsibleEntry({ entries: [] }), null)
  assert.equal(cleaningGroupNumber('Gruppe 10'), 10)
  assert.equal(cleaningGroupNumber(''), null)
})

test('die Bezeichnung entsteht aus den Mitgliedern – wie auf der Liste', () => {
  assert.equal(
    entryLabelFromMembers([
      { firstName: 'Hans Peter', lastName: 'Muster' },
      { firstName: 'Anna', lastName: 'Muster' },
    ]),
    'Muster Hans & Anna',
  )
  assert.equal(
    entryLabelFromMembers([
      { firstName: 'Noé', lastName: 'Schär' },
      { firstName: 'Céline', lastName: 'Schär-Bühler' },
    ]),
    'Schär Noé & Schär-Bühler Céline',
  )
})

test('wer noch in keiner Gruppe steht – Erwachsene, auf Wunsch auch Kinder', () => {
  const today = new Date(2026, 9, 2)
  const child = member('Kind', 'Muster', {
    birthDate: { toDate: () => new Date(2015, 5, 1) } as never,
  })
  const all = [...MEMBERS, child]
  assert.equal(assignedMemberIds(GROUPS).size, 5)

  const open = unassignedMembers(all, GROUPS, today).map(
    (entry) => `${entry.firstName} ${entry.lastName}`,
  )
  assert.ok(open.includes('Lea Beispiel'))
  assert.ok(!open.includes('Anna Muster'), 'eingeteilt')
  assert.ok(!open.includes('Alt Muster'), 'inaktiv')
  assert.ok(!open.includes('Kind Muster'), 'minderjährig')
  assert.ok(unassignedMembers(all, GROUPS, today, true).some((entry) => entry.id === child.id))
  // Nach Nachname sortiert.
  assert.equal(open[0], 'Lea Beispiel')

  assert.equal(isAdult({ birthDate: new Date(2008, 9, 2) }, today), true)
  assert.equal(isAdult({ birthDate: new Date(2008, 9, 3) }, today), false)
  // Offline liefert Firestore manchmal ein reines Objekt statt eines Timestamps.
  assert.equal(
    isAdult({ birthDate: { seconds: new Date(2012, 0, 1).getTime() / 1000 } }, today),
    false,
  )
  assert.equal(groupOfMember(GROUPS, ids('Hansruedi Bürki')[0])?.group.number, 2)
})

test('bei einem Ehepaar steht die Frau zuerst', () => {
  assert.equal(
    entryLabelFromMembers([
      { firstName: 'Roger', lastName: 'Bader', gender: 'm' },
      { firstName: 'Sylvie', lastName: 'Bader', gender: 'f' },
    ]),
    'Bader Sylvie & Roger',
  )
  assert.equal(
    entryLabelFromMembers([
      { firstName: 'Hans', lastName: 'Muster', gender: 'm' },
      { firstName: 'Anna', lastName: 'Meier', gender: 'f' },
    ]),
    'Meier Anna & Muster Hans',
  )
})

test('eine bestehende Bezeichnung: Frau zuerst, wo es eindeutig ist', () => {
  const roger = { firstName: 'Roger', lastName: 'Bader', gender: 'm' as const }
  const sylvie = { firstName: 'Sylvie Marie', lastName: 'Bader', gender: 'f' as const }
  assert.equal(wifeFirst('Bader Roger & Sylvie', [roger, sylvie]), 'Bader Sylvie & Roger')
  assert.equal(wifeFirst('Bader Roger und Sylvie', [roger, sylvie]), 'Bader Sylvie & Roger')
  // Schon richtig – oder nicht zu entscheiden: bleibt, wie es ist.
  assert.equal(wifeFirst('Bader Sylvie & Roger', [roger, sylvie]), 'Bader Sylvie & Roger')
  assert.equal(wifeFirst('Bader Roger & Sylvie', []), 'Bader Roger & Sylvie')
  assert.equal(
    wifeFirst('Bader Roger & Sylvie', [roger, { ...sylvie, gender: 'unknown' as const }]),
    'Bader Roger & Sylvie',
  )
  assert.equal(wifeFirst('Roger Bader', [roger]), 'Roger Bader')
  // «Muster Hans» ist kein Nachname – nicht tauschen, statt Unsinn zu bilden.
  assert.equal(
    wifeFirst('Muster Hans Peter & Anna', [
      { firstName: 'Hans Peter', lastName: 'Muster', gender: 'm' },
      { firstName: 'Anna', lastName: 'Muster', gender: 'f' },
    ]),
    'Muster Hans Peter & Anna',
  )
  // Der Nachname kann auch nur ein Teil eines Doppelnamens sein.
  assert.equal(
    wifeFirst('Schär Noé & Céline', [
      { firstName: 'Noé', lastName: 'Schär', gender: 'm' },
      { firstName: 'Céline', lastName: 'Schär-Bühler', gender: 'f' },
    ]),
    'Schär Céline & Noé',
  )
  assert.equal(
    wifeFirst('Bader Roger & Sylvie & Tim', [roger, sylvie]),
    'Bader Roger & Sylvie & Tim',
  )
  // Mehrteiliger Nachname, Kurzform des Vornamens.
  assert.equal(
    wifeFirst('von Gunten Paul & Bea', [
      { firstName: 'Paul', lastName: 'von Gunten', gender: 'm' },
      { firstName: 'Beatrice', lastName: 'von Gunten', gender: 'f' },
    ]),
    'von Gunten Bea & Paul',
  )
  // Verschiedene Nachnamen: die beiden Hälften tauschen.
  assert.equal(
    wifeFirst('Muster Hans & Meier Anna', [
      { firstName: 'Hans', lastName: 'Muster', gender: 'm' },
      { firstName: 'Anna', lastName: 'Meier', gender: 'f' },
    ]),
    'Meier Anna & Muster Hans',
  )
})

test('«Frau zuerst» für eine bestehende Einteilung – samt dem Plan ab heute', () => {
  const people = new Map([
    ['r', { firstName: 'Roger', lastName: 'Bader', gender: 'm' as const }],
    ['s', { firstName: 'Sylvie', lastName: 'Bader', gender: 'f' as const }],
    ['h', { firstName: 'Hansruedi', lastName: 'Bürki', gender: 'm' as const }],
  ])
  const groups = [
    {
      number: 5,
      entries: [
        { id: 'e1', label: 'Bader Roger & Sylvie', memberIds: ['r', 's'] },
        { id: 'e2', label: 'Hansruedi Bürki', memberIds: ['h'] },
      ],
    },
  ]
  const changes = wifeFirstChanges(groups, (id) => people.get(id))
  assert.deepEqual(changes, [
    { group: 5, entryId: 'e1', from: 'Bader Roger & Sylvie', to: 'Bader Sylvie & Roger' },
  ])

  const weeks = [
    { id: 'w1', endDate: '2026-09-26', team: 'Bader Roger & Sylvie' },
    { id: 'w2', endDate: '2026-10-03', team: 'Bader Roger & Sylvie ' },
    { id: 'w3', endDate: '2026-10-10', team: 'Hansruedi Bürki' },
  ]
  // Vergangenes bleibt; die laufende Woche zählt mit.
  assert.deepEqual(renamedTeams(weeks, changes, '2026-10-02'), [
    { id: 'w2', team: 'Bader Sylvie & Roger' },
  ])
  // Zwei Einträge mit derselben Bezeichnung, verschieden umgestellt: nicht anfassen.
  assert.deepEqual(
    renamedTeams(
      weeks,
      [...changes, { from: 'Bader Roger & Sylvie', to: 'Bader Sylvia & Roger' }],
      '2026-10-02',
    ),
    [],
  )
})

test('ein Haushalt ist eine Postadresse', () => {
  assert.equal(
    householdKey({ street: 'Bahnhofstr. 10', zip: '3400' }),
    householdKey({ street: 'bahnhofstr 10', zip: ' 3400 ' }),
  )
  assert.notEqual(
    householdKey({ street: 'Bahnhofstr. 10', zip: '3400' }),
    householdKey({ street: 'Bahnhofstr. 12', zip: '3400' }),
  )
  assert.equal(householdKey({ street: '', zip: '3400' }), null)
})

test('wer bei eingeteilten Eltern wohnt, fehlt unter «Nicht eingeteilt»', () => {
  const today = new Date(2026, 9, 2)
  const born = (year: number) => ({ toDate: () => new Date(year, 2, 1) }) as never
  const home = { street: 'Lindenweg 4', zip: '3400' }
  const vater = member('Peter', 'Keller', { ...home, birthDate: born(1968) })
  const mutter = member('Ruth', 'Keller-Graf', { ...home, birthDate: born(1970) })
  const sohn = member('Jonas', 'Keller', { ...home, birthDate: born(2003) })
  const tochter = member('Lara', 'Graf', { ...home, birthDate: born(2001) })
  const nachbarin = member('Eva', 'Brunner', { ...home, birthDate: born(2000) })
  const ohneJahr = member('Tim', 'Keller', { ...home, birthDate: null })
  const all = [vater, mutter, sohn, tochter, nachbarin, ohneJahr]
  const groups = [
    { number: 3, entries: [{ id: 'k', label: 'Keller', memberIds: [vater.id, mutter.id] }] },
  ]

  const atHome = homeWithAssignedParents(all, groups)
  assert.equal(atHome.get(sohn.id), 3)
  // Der Nachname der Mutter genügt.
  assert.equal(atHome.get(tochter.id), 3)
  // Eine andere Familie im selben Haus, und wer ohne Geburtsdatum dasteht.
  assert.ok(!atHome.has(nachbarin.id))
  assert.ok(!atHome.has(ohneJahr.id))

  const names = (list: Member[]) => list.map((entry) => entry.firstName)
  assert.deepEqual(names(unassignedMembers(all, groups, today)), ['Eva', 'Tim'])
  assert.deepEqual(names(unassignedMembers(all, groups, today, true)), [
    'Eva',
    'Lara',
    'Jonas',
    'Tim',
  ])

  // Umgekehrt: Ist der Sohn eingeteilt, fehlen die Eltern weiterhin – und
  // ein Geschwister bleibt sichtbar.
  const bruder = member('Nico', 'Keller', { ...home, birthDate: born(2006) })
  const reversed = [
    { number: 1, entries: [{ id: 's', label: 'Keller Jonas', memberIds: [sohn.id] }] },
  ]
  assert.deepEqual(names(unassignedMembers([...all, bruder], reversed, today)), [
    'Eva',
    'Lara',
    'Nico',
    'Peter',
    'Tim',
    'Ruth',
  ])
})

/* ------------------------------------------------------------------ */
/* Was gerade unterwegs ist                                            */
/* ------------------------------------------------------------------ */

test('Einträge werden gespeichert, wie sie verglichen werden', () => {
  assert.deepEqual(
    normalizedEntries([
      { id: 'a', label: '  Bader Roger & Sylvie ', memberIds: ['m2', 'm3', 'm2'] },
    ]),
    [{ id: 'a', label: 'Bader Roger & Sylvie', memberIds: ['m2', 'm3'] }],
  )
  // Die Reihenfolge der Felder spielt keine Rolle – Firestore liefert sie, wie es will.
  assert.equal(
    entriesKey([{ memberIds: ['m1'], label: 'Römer Nathan', id: 'x' }]),
    entriesKey([{ id: 'x', label: 'Römer Nathan ', memberIds: ['m1', 'm1'] }]),
  )
  assert.notEqual(
    entriesKey([{ id: 'x', label: 'Römer Nathan', memberIds: ['m1'] }]),
    entriesKey([{ id: 'x', label: 'Römer Nathan', memberIds: [] }]),
  )
})

test('zwei Handgriffe kurz hintereinander bauen aufeinander auf', () => {
  const entry = (id: string, memberIds: string[] = []) => ({ id, label: id, memberIds })
  const stored = [
    { id: '1', number: 1, entries: [entry('Römer Nathan', ['m1'])] },
    { id: '2', number: 2, entries: [entry('Bader Roger & Sylvie', ['m2', 'm3'])] },
  ]
  // Der erste Handgriff ist geschrieben, aber noch nicht zurückgemeldet …
  const pending = new Map([[1, [entry('Römer Nathan', ['m1']), entry('Muster Lea', ['m9'])]]])
  // … und dazu eine eben angelegte Gruppe 3.
  pending.set(3, [])
  const shown = withPendingGroups(stored, pending)
  assert.deepEqual(
    shown.map((group) => [group.number, group.entries.map((item) => item.id)]),
    [
      [1, ['Römer Nathan', 'Muster Lea']],
      [2, ['Bader Roger & Sylvie']],
      [3, []],
    ],
  )
  assert.equal(shown[2].id, '3')

  // Solange der Listener den alten Stand meldet, bleibt die Vormerkung.
  assert.equal(withoutConfirmed(pending, stored), pending)
  // Meldet er Gruppe 1 so, wie sie geschrieben wurde, fällt sie weg – Gruppe 3 bleibt.
  const confirmed = withoutConfirmed(pending, [
    { number: 1, entries: [entry('Römer Nathan', ['m1']), entry('Muster Lea', ['m9'])] },
    stored[1],
  ])
  assert.deepEqual([...confirmed.keys()], [3])
  assert.equal(withPendingGroups(stored, new Map()).length, 2)
})
