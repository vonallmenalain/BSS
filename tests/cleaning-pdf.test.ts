import assert from 'node:assert/strict'
import { test } from 'node:test'

import { tablePdf, textWidth, toWinAnsi, wrapText } from '../src/lib/pdf.ts'
import {
  cleaningPdf,
  cleaningPdfFilename,
  cleaningPeriod,
  cleaningRows,
  cleaningWeekNumber,
  groupNumber,
  isoWeek,
  weeksInRange,
} from '../src/services/cleaningPdf.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird der Putzplan als PDF: welche Wochen aufs Blatt kommen, was in
 * den vier Spalten steht – und dass die Datei so gebaut ist, wie ein
 * PDF-Programm sie erwartet.
 */

function week(startDate: string, endDate: string, group: string, team: string) {
  return { startDate, endDate, group, team }
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

test('das PDF trägt Titel, Zeitraum, Namen und den Stand', () => {
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
  // Gesetzt in WinAnsi: «ü» ist das Byte 0xFC, der Gedankenstrich 0x96.
  assert.ok(text.includes('(Gemeinde Burgdorf · 5. Oktober 2026 \u0096 24. Oktober 2026)'))
  assert.ok(text.includes('(Müller Hans & Käthi)'))
  assert.ok(text.includes('(Stand: 02.10.2026)'))
  assert.ok(text.includes('(Seite 1 von 1)'))
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
  assert.ok(text.includes('(5. Oktober 2026 \u0096 10. Oktober 2026)'))
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
