import assert from 'node:assert/strict'
import { test } from 'node:test'

import { tablePdf, textWidth, toWinAnsi, wrapText } from '../src/lib/pdf.ts'
import {
  CLEANING_PLAN_LABEL,
  CLEANING_PLAN_URL,
  cleaningPdf,
  cleaningPdfFilename,
  cleaningPeriod,
  cleaningRows,
  cleaningWeekNumber,
  groupNumber,
  isoWeek,
  repeatReasons,
  spellOutNote,
  weeksInRange,
} from '../src/services/cleaningPdf.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird der Putzplan als PDF: welche Wochen aufs Blatt kommen, was in
 * den vier Spalten steht – und dass die Datei so gebaut ist, wie ein
 * PDF-Programm sie erwartet.
 */

function week(startDate: string, endDate: string, group: string, team: string, note = '') {
  return { startDate, endDate, group, team, note }
}

const PLAN = [
  week('2026-10-12', '2026-10-17', 'Gruppe 2', 'Müller Hans & Käthi'),
  week('2026-10-05', '2026-10-10', 'Gruppe 1', 'Bader Roger & Sylvie'),
  week('2026-10-19', '2026-10-24', 'Gruppe 3', ''),
  week('2026-12-28', '2027-01-02', 'Gruppe 4', 'Familie Lüthi'),
]

/** Die Datei als Text – jedes Byte ein Zeichen. */
function asText(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes)
}

/* ------------------------------------------------------------------ */
/* Was aufs Blatt kommt                                                */
/* ------------------------------------------------------------------ */

test('die Kalenderwoche zählt nach ISO – auch über den Jahreswechsel', () => {
  assert.equal(isoWeek('2026-10-05'), 41)
  // 2026 hat 53 Wochen: Der 1. Januar 2026 war ein Donnerstag.
  assert.equal(isoWeek('2026-12-28'), 53)
  assert.equal(isoWeek('2027-01-01'), 53)
  assert.equal(isoWeek('2027-01-04'), 1)
})

test('eine Putzwoche ab Sonntag zählt zur Kalenderwoche ihrer Werktage', () => {
  // Montag bis Samstag und Sonntag bis Samstag – beide sind KW 41.
  assert.equal(cleaningWeekNumber({ startDate: '2026-10-05', endDate: '2026-10-10' }), 41)
  assert.equal(cleaningWeekNumber({ startDate: '2026-10-04', endDate: '2026-10-10' }), 41)
})

test('Datum und Gruppe stehen kurz da', () => {
  assert.equal(cleaningPeriod(PLAN[1]), '05.10. – 10.10.2026')
  assert.equal(groupNumber('Gruppe 2'), '2')
  assert.equal(groupNumber('G 12'), '12')
  assert.equal(groupNumber('Reserve'), 'Reserve')
})

test('in den Zeitraum fällt jede Woche, die ihn berührt – der Reihe nach', () => {
  const weeks = weeksInRange(PLAN, '2026-10-08', '2026-10-19')
  assert.deepEqual(
    weeks.map((entry) => entry.startDate),
    ['2026-10-05', '2026-10-12', '2026-10-19'],
  )
})

test('je Woche: Woche, Datum, wer an der Reihe ist, Gruppe', () => {
  assert.deepEqual(cleaningRows(weeksInRange(PLAN, '2026-10-01', '2027-01-31')), [
    ['41', '05.10. – 10.10.2026', 'Bader Roger & Sylvie', '1'],
    ['42', '12.10. – 17.10.2026', 'Müller Hans & Käthi', '2'],
    ['43', '19.10. – 24.10.2026', '–', '3'],
    ['53', '28.12. – 02.01.2027', 'Familie Lüthi', '4'],
  ])
})

test('der Dateiname sortiert sich im Download-Ordner', () => {
  assert.equal(
    cleaningPdfFilename('2026-10-05', '2027-03-27'),
    'Putzplan_2026-10-05_bis_2027-03-27.pdf',
  )
})

test('ohne Woche im Zeitraum entsteht keine Datei', () => {
  assert.equal(
    cleaningPdf({ weeks: PLAN, from: '2025-01-01', to: '2025-12-31', today: '2026-10-02' }),
    null,
  )
})

/* ------------------------------------------------------------------ */
/* Die Datei                                                           */
/* ------------------------------------------------------------------ */

test('das PDF trägt Titel, Gemeinde, Namen und den Stand', () => {
  const bytes = cleaningPdf({
    weeks: PLAN,
    from: '2026-10-01',
    to: '2026-10-31',
    wardName: 'Gemeinde Burgdorf',
    today: '2026-10-02',
  })
  assert.ok(bytes)
  const text = asText(bytes)

  assert.ok(text.startsWith('%PDF-1.4\n'))
  assert.ok(text.trimEnd().endsWith('%%EOF'))
  assert.ok(text.includes('(Putzplan)'))
  // Gesetzt in WinAnsi: «ü» ist das Byte 0xFC.
  assert.ok(text.includes('(Gemeinde Burgdorf)'))
  assert.ok(text.includes('(Müller Hans & Käthi)'))
  assert.ok(text.includes('(Stand: 02.10.2026)'))
  assert.ok(text.includes('(Seite 1 von 1)'))
  // Der Zeitraum steht in der Tabelle – über ihr nicht noch einmal.
  assert.ok(!text.includes('Oktober 2026'))
  // Ohne Haken weder Adresse noch QR-Code.
  assert.ok(!text.includes(CLEANING_PLAN_LABEL))
  assert.ok(!text.includes(' re\n'))
})

test('die Voreinstellung «Gemeinde» steht nicht auf dem Blatt', () => {
  const text = asText(
    cleaningPdf({
      weeks: PLAN,
      from: '2026-10-01',
      to: '2026-10-10',
      wardName: 'Gemeinde',
      today: '2026-10-02',
    })!,
  )
  assert.ok(!text.includes('(Gemeinde)'))
  assert.ok(text.includes('(Bader Roger & Sylvie)'))
})

/* ------------------------------------------------------------------ */
/* Zweimal hintereinander                                              */
/* ------------------------------------------------------------------ */

/*
 * Der Plan der Gemeinde läuft ab August von Sonntag bis Samstag. Am 4. Oktober
 * 2026 ist Generalkonferenz – die Gruppe 5 putzt deshalb zwei Wochen, und die
 * Tabelle schreibt «Generalkonf.» neben die erste.
 */
const AUTUMN = [
  week('2026-09-20', '2026-09-26', 'Gruppe 4', 'Weidmann Fabian & Angela'),
  week('2026-09-27', '2026-10-03', 'Gruppe 5', 'Morales-Römer Oscar & Céleste', 'Generalkonf.'),
  week('2026-10-04', '2026-10-10', 'Gruppe 5', 'Morales-Römer Oscar & Céleste'),
  week('2026-10-11', '2026-10-17', 'Gruppe 6', 'von Allmen Adrian & Bea'),
  week('2026-11-08', '2026-11-14', 'Gruppe 10', 'Künzli Dominik & Lena'),
  week('2026-11-15', '2026-11-21', 'Gruppe 10', 'Künzli Dominik & Lena'),
  week('2026-11-22', '2026-11-28', 'Gruppe 1', 'Römer Nathan'),
]

test('die Generalkonferenz erkennt der Plan von selbst – an der zweiten Woche', () => {
  const reasons = repeatReasons(AUTUMN)
  assert.equal(reasons.get('2026-10-04'), 'Generalkonferenz')
  // Die erste Woche des Paares ist keine Wiederholung.
  assert.equal(reasons.has('2026-09-27'), false)
  // Für November weiss der Plan ohne erfassten Sonntag keinen Grund.
  assert.equal(reasons.has('2026-11-15'), false)
  assert.equal(reasons.size, 1)
})

test('eine Pfahlkonferenz, sobald sie am Sonntag eingetragen ist', () => {
  const sundays = [{ id: '2026-11-15', kind: 'stake_conference' }]
  assert.equal(repeatReasons(AUTUMN, sundays).get('2026-11-15'), 'Pfahlkonferenz')

  // Findet sie ausnahmsweise in der Gemeinde statt, ist sie kein Grund.
  const atHome = [{ id: '2026-11-15', kind: 'stake_conference', meets: true }]
  assert.equal(repeatReasons(AUTUMN, atHome).has('2026-11-15'), false)

  // Ein selbst erfasster Grund ohne Versammlung trägt seine eigene Bezeichnung.
  const own = [{ id: '2026-11-15', kind: 'ausflug', kindLabel: 'Gemeindeausflug', meets: false }]
  assert.equal(repeatReasons(AUTUMN, own).get('2026-11-15'), 'Gemeindeausflug')
})

test('ohne Sonntag gilt die Bemerkung – zuerst die eigene, dann die der Woche davor', () => {
  const plan = [
    week('2026-11-08', '2026-11-14', 'Gruppe 10', 'Künzli', 'Pfahlkonf.'),
    week('2026-11-15', '2026-11-21', 'Gruppe 10', 'Künzli'),
  ]
  assert.equal(repeatReasons(plan).get('2026-11-15'), 'Pfahlkonferenz')

  plan[1] = { ...plan[1], note: 'Tausch mit Gruppe 3' }
  assert.equal(repeatReasons(plan).get('2026-11-15'), 'Tausch mit Gruppe 3')

  // Der Sonntag geht der Bemerkung vor: Er sagt es mit dem richtigen Wort.
  const october = [
    week('2026-09-27', '2026-10-03', 'Gruppe 5', 'Morales', 'GK'),
    week('2026-10-04', '2026-10-10', 'Gruppe 5', 'Morales'),
  ]
  assert.equal(repeatReasons(october).get('2026-10-04'), 'Generalkonferenz')
})

test('auch im alten Takt von Montag bis Samstag – der Sonntag liegt dazwischen', () => {
  // Am 5. April 2026 ist Generalkonferenz.
  const spring = [
    week('2026-03-30', '2026-04-04', 'Gruppe 8', 'Lauener Roland & Michèle'),
    week('2026-04-06', '2026-04-11', 'Gruppe 8', 'Lauener Roland & Michèle'),
  ]
  assert.equal(repeatReasons(spring).get('2026-04-06'), 'Generalkonferenz')
})

test('nur wer wirklich zweimal hintereinander dran ist', () => {
  // Andere Gruppe am Konferenzsonntag – nichts zu erklären.
  const others = [
    week('2026-09-27', '2026-10-03', 'Gruppe 4', 'Weidmann', 'Generalkonf.'),
    week('2026-10-04', '2026-10-10', 'Gruppe 5', 'Morales'),
  ]
  assert.equal(repeatReasons(others).size, 0)

  // Eine Lücke im Plan: Dieselbe Gruppe davor und danach putzt nicht «hintereinander».
  const gap = [
    week('2026-09-20', '2026-09-26', 'Gruppe 5', 'Morales'),
    week('2026-10-04', '2026-10-10', 'Gruppe 5', 'Morales'),
  ]
  assert.equal(repeatReasons(gap).size, 0)

  // Ohne Gruppennummer zählt das Team.
  const teams = [
    week('2026-09-27', '2026-10-03', '', 'Familie Lüthi'),
    week('2026-10-04', '2026-10-10', '', 'familie lüthi'),
  ]
  assert.equal(repeatReasons(teams).get('2026-10-04'), 'Generalkonferenz')
})

test('Bemerkungen werden ausgeschrieben', () => {
  assert.equal(spellOutNote('Generalkonf.'), 'Generalkonferenz')
  assert.equal(spellOutNote(' (Pfahlkonf) '), 'Pfahlkonferenz')
  assert.equal(spellOutNote('Pfahlkonf. 15.11.'), 'Pfahlkonferenz 15.11.')
  assert.equal(spellOutNote('Konf.'), 'Konferenz')
  assert.equal(spellOutNote('Generalkonferenz'), 'Generalkonferenz')
  assert.equal(spellOutNote('konfus'), 'konfus')
  assert.equal(spellOutNote(undefined), '')
})

test('der Grund steht grau in Klammern hinter den Namen', () => {
  const weeks = weeksInRange(AUTUMN, '2026-10-04', '2026-10-17')
  assert.deepEqual(cleaningRows(weeks, repeatReasons(AUTUMN)), [
    [
      '41',
      '04.10. – 10.10.2026',
      { text: 'Morales-Römer Oscar & Céleste', aside: '(Generalkonferenz)' },
      '5',
    ],
    ['42', '11.10. – 17.10.2026', 'von Allmen Adrian & Bea', '6'],
  ])

  // Der Ausdruck beginnt mit der zweiten Woche des Paares – sie trägt den Grund trotzdem.
  const text = asText(
    cleaningPdf({ weeks: AUTUMN, from: '2026-10-04', to: '2026-10-17', today: '2026-10-02' })!,
  )
  // In der PDF-Zeichenkette sind die Klammern maskiert – und gesetzt in Grau,
  // auf derselben Zeile wie die Namen.
  const names = text.match(/0\.1 g [\d.]+ ([\d.]+) Td \(Morales-Römer Oscar & Céleste\) Tj/)
  const reason = text.match(/0\.45 g [\d.]+ ([\d.]+) Td \(\\\(Generalkonferenz\\\)\) Tj/)
  assert.ok(names && reason)
  assert.equal(reason[1], names[1])
})

test('passt der Zusatz nicht mehr dahinter, steht er als Ganzes darunter', () => {
  const text = asText(
    tablePdf({
      title: 'Probe',
      columns: [
        { label: 'Team', width: 1 },
        { label: 'Rest', width: 3 },
      ],
      rows: [[{ text: 'Bader Roger & Sylvie', aside: '(Generalkonferenz)' }, '']],
    }),
  )
  const y = (pattern: string) => Number(text.match(new RegExp(`([\\d.]+) Td ${pattern} Tj`))?.[1])
  const names = y('\\(Bader Roger & Sylvie\\)')
  const reason = y('\\(\\\\\\(Generalkonferenz\\\\\\)\\)')
  // Eine Zeile tiefer, nicht mitten in der Klammer umgebrochen.
  assert.equal(Math.round(names - reason), 13)
})

/* ------------------------------------------------------------------ */
/* Adresse und QR-Code                                                 */
/* ------------------------------------------------------------------ */

test('mit Haken stehen unten die Adresse und ein QR-Code', () => {
  assert.equal(CLEANING_PLAN_URL, 'https://bss.alae.app/putzplan')
  assert.equal(CLEANING_PLAN_LABEL, 'bss.alae.app/putzplan')

  const text = asText(
    cleaningPdf({
      weeks: PLAN,
      from: '2026-10-01',
      to: '2026-10-31',
      today: '2026-10-02',
      withLink: true,
    })!,
  )
  assert.ok(text.includes('(Immer aktuell unter)'))
  assert.ok(text.includes('(bss.alae.app/putzplan)'))
  // Die Seitenzahl rückt zum Stand – rechts steht der QR-Code.
  assert.ok(text.includes('(Stand: 02.10.2026 · Seite 1 von 1)'))
  // Der QR-Code: schwarze Rechtecke, gefüllt in einem Zug.
  const rects = text.match(/ re\n/g)?.length ?? 0
  assert.ok(rects > 100, `${rects} Rechtecke`)
  assert.ok(text.includes(' re\nf'))
})

test('mit QR-Code passt ein halbes Jahr weiterhin auf eine Seite', () => {
  const halfYear = Array.from({ length: 26 }, (_, index) => {
    const start = new Date(Date.UTC(2026, 7, 2 + index * 7))
    const end = new Date(start.getTime() + 6 * 86_400_000)
    return week(
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
      `Gruppe ${(index % 10) + 1}`,
      'Morales-Römer Oscar & Céleste',
    )
  })
  const text = asText(
    cleaningPdf({
      weeks: halfYear,
      from: '2026-08-01',
      to: '2027-01-31',
      wardName: 'Gemeinde Burgdorf',
      today: '2026-07-20',
      withLink: true,
    })!,
  )
  assert.ok(text.includes('(Stand: 20.07.2026 · Seite 1 von 1)'))
})

test('das Verzeichnis zeigt auf jedes Objekt', () => {
  const text = asText(
    tablePdf({ title: 'Probe', columns: [{ label: 'A', width: 1 }], rows: [['eins'], ['zwei']] }),
  )
  const xrefAt = Number(text.match(/startxref\n(\d+)\n/)?.[1])
  assert.ok(text.startsWith('xref\n', xrefAt))

  const entries = [...text.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) =>
    Number(match[1]),
  )
  assert.ok(entries.length >= 6)
  entries.forEach((offset, index) => {
    assert.ok(text.startsWith(`${index + 1} 0 obj\n`, offset), `Objekt ${index + 1}`)
  })

  // Die Länge jedes Inhalts stimmt mit dem, was zwischen «stream» und «endstream» steht.
  for (const match of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = (match.index ?? 0) + match[0].length
    assert.ok(text.startsWith('\nendstream', start + Number(match[1])))
  }
})

test('eine lange Liste geht über mehrere Seiten – die Kopfzeile jedes Mal mit', () => {
  const rows = Array.from({ length: 60 }, (_, index) => [String(index + 1), `Team ${index + 1}`])
  const text = asText(
    tablePdf({
      title: 'Lang',
      columns: [
        { label: 'Nr', width: 1 },
        { label: 'Team', width: 4 },
      ],
      rows,
    }),
  )
  const pages = Number(text.match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/)?.[1])
  assert.ok(pages >= 3)
  assert.equal(text.split('(Team) Tj').length - 1, pages)
  assert.ok(text.includes(`(Seite ${pages} von ${pages})`))
})

/* ------------------------------------------------------------------ */
/* Schrift                                                             */
/* ------------------------------------------------------------------ */

test('toWinAnsi setzt Umlaute und Satzzeichen, Unbekanntes wird zum Fragezeichen', () => {
  assert.equal(toWinAnsi('Käthi'), 'Käthi')
  assert.equal(toWinAnsi('A – B'), 'A \u0096 B')
  assert.equal(toWinAnsi('„Jugend“'), '\u0084Jugend\u0093')
  assert.equal(toWinAnsi('Ω'), '?')
})

test('Breiten nach den Schriftmetriken – fett ist breiter', () => {
  // «a» ist in Helvetica 556 Tausendstel breit, «i» 222.
  assert.equal(textWidth('ai', 'regular', 10), 7.78)
  assert.ok(textWidth('Putzplan', 'bold', 10) > textWidth('Putzplan', 'regular', 10))
  // Ein Umlaut ist so breit wie sein Grundbuchstabe.
  assert.equal(textWidth('ä', 'regular', 10), textWidth('a', 'regular', 10))
})

test('wrapText bricht an Leerzeichen um und kürzt nach drei Zeilen', () => {
  const lines = wrapText(
    'Familie Gerber-Zürcher mit Grossmutter Anna Gerber und den Zwillingen Lea und Noé',
    'regular',
    10.5,
    150,
  )
  assert.ok(lines.length > 1 && lines.length <= 3)
  for (const line of lines) assert.ok(textWidth(line, 'regular', 10.5) <= 150)
  assert.deepEqual(wrapText('Kurz', 'regular', 10.5, 150), ['Kurz'])
})
