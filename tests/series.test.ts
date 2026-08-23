import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  announcementKey,
  announcementsFor,
  endedBefore,
  isLastWeekOfMonth,
  previousDay,
  seriesAppliesTo,
  weekOfMonth,
  withoutSunday,
} from '../src/lib/series.ts'
import type { AnnouncementSeries } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Wiederkehrende Bekanntmachungen werden nicht gespeichert, sondern
 * gerechnet. Damit hängt alles an einer Frage: Gilt diese Serie an diesem
 * Sonntag? Sie wird hier geprüft – samt der beiden Wege, auf denen eine
 * Serie wieder verschwindet.
 */

function series(partial: Partial<AnnouncementSeries> = {}): AnnouncementSeries {
  return {
    id: 's1',
    text: 'Tempeltag der Gemeinde',
    details: '',
    rhythm: 'monthly',
    weeks: [3],
    startDate: '2026-01-01',
    endDate: null,
    skipDates: [],
    source: 'manual',
    ...partial,
  }
}

/* ------------------------------------------------------------------ */
/* Der wievielte Sonntag                                               */
/* ------------------------------------------------------------------ */

test('zählt die Sonntage im Kalender, nicht ab dem ersten Sonntag', () => {
  // August 2026 beginnt an einem Samstag; der 1. Sonntag ist der 2. August.
  assert.equal(weekOfMonth('2026-08-02'), 1)
  assert.equal(weekOfMonth('2026-08-09'), 2)
  assert.equal(weekOfMonth('2026-08-16'), 3)
  assert.equal(weekOfMonth('2026-08-23'), 4)
  assert.equal(weekOfMonth('2026-08-30'), 5)

  // November 2026 beginnt an einem Sonntag – dann ist der 1. der 1. Sonntag.
  assert.equal(weekOfMonth('2026-11-01'), 1)
  assert.equal(weekOfMonth('2026-11-15'), 3)
})

test('erkennt den letzten Sonntag des Monats', () => {
  assert.equal(isLastWeekOfMonth('2026-08-30'), true)
  assert.equal(isLastWeekOfMonth('2026-08-23'), false)
  // Februar 2027 hat 28 Tage – der 28. ist ein Sonntag und der letzte.
  assert.equal(isLastWeekOfMonth('2027-02-28'), true)
  assert.equal(isLastWeekOfMonth('2027-02-21'), false)
})

/* ------------------------------------------------------------------ */
/* Fälligkeit                                                          */
/* ------------------------------------------------------------------ */

test('gilt am 3. Sonntag im Monat und sonst nicht', () => {
  const entry = series({ weeks: [3] })
  assert.equal(seriesAppliesTo(entry, '2026-08-16'), true)
  assert.equal(seriesAppliesTo(entry, '2026-08-09'), false)
  assert.equal(seriesAppliesTo(entry, '2026-09-20'), true)
})

test('gilt an mehreren gewählten Sonntagen', () => {
  const entry = series({ weeks: [1, 3] })
  assert.equal(seriesAppliesTo(entry, '2026-08-02'), true)
  assert.equal(seriesAppliesTo(entry, '2026-08-16'), true)
  assert.equal(seriesAppliesTo(entry, '2026-08-23'), false)
})

test('«letzter Sonntag» folgt der Monatslänge', () => {
  const entry = series({ weeks: [-1] })
  assert.equal(seriesAppliesTo(entry, '2026-08-30'), true)
  assert.equal(seriesAppliesTo(entry, '2026-08-23'), false)
})

test('gilt wöchentlich an jedem Sonntag', () => {
  const entry = series({ rhythm: 'weekly', weeks: [] })
  assert.equal(seriesAppliesTo(entry, '2026-08-02'), true)
  assert.equal(seriesAppliesTo(entry, '2026-08-09'), true)
})

test('gilt nicht vor ihrem Beginn und nicht nach ihrem Ende', () => {
  const entry = series({ rhythm: 'weekly', startDate: '2026-08-09', endDate: '2026-08-23' })
  assert.equal(seriesAppliesTo(entry, '2026-08-02'), false)
  assert.equal(seriesAppliesTo(entry, '2026-08-09'), true)
  assert.equal(seriesAppliesTo(entry, '2026-08-23'), true)
  assert.equal(seriesAppliesTo(entry, '2026-08-30'), false)
})

test('lässt einen einzeln gestrichenen Sonntag aus', () => {
  const entry = series({ rhythm: 'weekly', skipDates: ['2026-08-09'] })
  assert.equal(seriesAppliesTo(entry, '2026-08-02'), true)
  assert.equal(seriesAppliesTo(entry, '2026-08-09'), false)
  assert.equal(seriesAppliesTo(entry, '2026-08-16'), true)
})

test('gilt nie, wenn kein Sonntag im Monat gewählt ist', () => {
  assert.equal(seriesAppliesTo(series({ weeks: [] }), '2026-08-16'), false)
})

/* ------------------------------------------------------------------ */
/* Zusammenrechnen                                                     */
/* ------------------------------------------------------------------ */

const plain = (entry: AnnouncementSeries) => ({ text: entry.text, details: entry.details ?? '' })

test('hängt fällige Serien hinten an die erfassten Einträge', () => {
  const stored = [{ id: 'a1', text: 'Gemeindeausflug' }]
  const result = announcementsFor('2026-08-16', stored, [series()], plain)

  assert.deepEqual(
    result.map((entry) => entry.text),
    ['Gemeindeausflug', 'Tempeltag der Gemeinde'],
  )
  assert.equal(result[1].seriesId, 's1')
  assert.ok(result[1].id.startsWith('serie:'))
})

test('lässt eine Serie weg, die an diesem Sonntag nicht fällig ist', () => {
  const result = announcementsFor('2026-08-09', [], [series()], plain)
  assert.deepEqual(result, [])
})

test('lässt eine Serie weg, deren Text sich nicht füllen liess', () => {
  const result = announcementsFor('2026-08-16', [], [series()], () => null)
  assert.deepEqual(result, [])
})

test('zeigt eine für diesen Sonntag angepasste Serie nur einmal', () => {
  // Der angepasste Eintrag trägt die Serien-ID und tritt an ihre Stelle.
  const stored = [{ id: 'a1', text: 'Tempeltag – ausnahmsweise am Freitag', seriesId: 's1' }]
  const result = announcementsFor('2026-08-16', stored, [series()], plain)

  assert.equal(result.length, 1)
  assert.equal(result[0].text, 'Tempeltag – ausnahmsweise am Freitag')
})

test('gibt jedem Sonntag eine eigene ID für denselben Serieneintrag', () => {
  const [first] = announcementsFor('2026-08-16', [], [series()], plain)
  const [second] = announcementsFor('2026-09-20', [], [series()], plain)
  assert.notEqual(first.id, second.id)
})

/* ------------------------------------------------------------------ */
/* Reihenfolge                                                         */
/* ------------------------------------------------------------------ */

/*
 * Die Reihenfolge steht am Sonntag (`announcementOrder`) und nicht an den
 * Einträgen: Nur so lassen sich erfasste Bekanntmachungen und Serien
 * miteinander ordnen – eine Serie wird ja gar nicht in den Sonntag
 * geschrieben.
 */

test('nimmt für eine Serie ihre ID als Schlüssel, nicht die des Eintrags', () => {
  const [entry] = announcementsFor('2026-08-16', [], [series()], plain)
  assert.equal(announcementKey(entry), 'serie:s1')

  // Derselbe Schlüssel an einem anderen Sonntag – die ID des Eintrags nicht.
  const [other] = announcementsFor('2026-09-20', [], [series()], plain)
  assert.equal(announcementKey(other), 'serie:s1')
  assert.notEqual(entry.id, other.id)
})

test('nimmt für einen erfassten Eintrag seine eigene ID', () => {
  assert.equal(announcementKey({ id: 'a1', text: 'Gemeindeausflug' }), 'a1')
})

test('lässt die gewohnte Folge stehen, solange nichts gelegt wurde', () => {
  const stored = [{ id: 'a1', text: 'Gemeindeausflug' }]
  const result = announcementsFor('2026-08-16', stored, [series()], plain, [])

  assert.deepEqual(
    result.map((entry) => entry.text),
    ['Gemeindeausflug', 'Tempeltag der Gemeinde'],
  )
})

test('holt eine Serie vor die erfassten Einträge', () => {
  const stored = [{ id: 'a1', text: 'Gemeindeausflug' }]
  const result = announcementsFor('2026-08-16', stored, [series()], plain, ['serie:s1', 'a1'])

  assert.deepEqual(
    result.map((entry) => entry.text),
    ['Tempeltag der Gemeinde', 'Gemeindeausflug'],
  )
})

test('stellt hinten an, was in der Reihenfolge fehlt – in natürlicher Folge', () => {
  const stored = [
    { id: 'a1', text: 'Erste' },
    { id: 'a2', text: 'Zweite' },
    { id: 'a3', text: 'Dritte' },
  ]
  // Nur die dritte ist gelegt: Sie steht vorn, der Rest folgt wie erfasst.
  const result = announcementsFor('2026-08-09', stored, [], plain, ['a3'])

  assert.deepEqual(
    result.map((entry) => entry.text),
    ['Dritte', 'Erste', 'Zweite'],
  )
})

test('stört sich nicht an Schlüsseln, zu denen es nichts mehr gibt', () => {
  const stored = [{ id: 'a2', text: 'Zweite' }]
  const result = announcementsFor('2026-08-09', stored, [], plain, ['a1', 'a2'])

  assert.deepEqual(
    result.map((entry) => entry.text),
    ['Zweite'],
  )
})

test('behält den Platz der Serie, wenn sie für diesen Sonntag übernommen wird', () => {
  const order = ['serie:s1', 'a1']
  const stored = [
    { id: 'a1', text: 'Gemeindeausflug' },
    // Der übernommene Eintrag trägt eine neue ID, aber die Serien-ID – und
    // damit denselben Schlüssel wie die Serie zuvor.
    { id: 'a2', text: 'Tempeltag – ausnahmsweise am Freitag', seriesId: 's1' },
  ]
  const result = announcementsFor('2026-08-16', stored, [series()], plain, order)

  assert.deepEqual(
    result.map((entry) => entry.text),
    ['Tempeltag – ausnahmsweise am Freitag', 'Gemeindeausflug'],
  )
})

test('ordnet mehrere Serien untereinander', () => {
  const weekly = series({ id: 's2', text: 'Dank ans Putzteam', rhythm: 'weekly', weeks: [] })
  const stored = [{ id: 'a1', text: 'Gemeindeausflug' }]
  const result = announcementsFor('2026-08-16', stored, [series(), weekly], plain, [
    'serie:s2',
    'a1',
    'serie:s1',
  ])

  assert.deepEqual(
    result.map((entry) => entry.text),
    ['Dank ans Putzteam', 'Gemeindeausflug', 'Tempeltag der Gemeinde'],
  )
})

/* ------------------------------------------------------------------ */
/* Löschen: nur dieser Sonntag oder alle künftigen                     */
/* ------------------------------------------------------------------ */

test('streicht einen einzelnen Sonntag, ohne ihn doppelt zu vermerken', () => {
  const entry = series({ skipDates: ['2026-08-16'] })
  assert.deepEqual(withoutSunday(entry, '2026-09-20').skipDates, ['2026-08-16', '2026-09-20'])
  assert.deepEqual(withoutSunday(entry, '2026-08-16').skipDates, ['2026-08-16'])
})

test('beendet die Serie am Vortag – der Sonntag selbst fällt schon weg', () => {
  const entry = series({ rhythm: 'weekly', startDate: '2026-01-01' })
  const result = endedBefore(entry, '2026-08-16')
  assert.deepEqual(result, { endDate: '2026-08-15' })

  const ended = series({ ...entry, ...(result as { endDate: string }) })
  assert.equal(seriesAppliesTo(ended, '2026-08-09'), true)
  assert.equal(seriesAppliesTo(ended, '2026-08-16'), false)
})

test('löscht die Serie, wenn sie ab ihrem eigenen Beginn entfällt', () => {
  assert.equal(endedBefore(series({ startDate: '2026-08-16' }), '2026-08-16'), 'delete')
  assert.equal(endedBefore(series({ startDate: '2026-08-16' }), '2026-08-09'), 'delete')
})

test('rechnet den Vortag über Monats- und Jahresgrenzen', () => {
  assert.equal(previousDay('2026-08-01'), '2026-07-31')
  assert.equal(previousDay('2027-01-01'), '2026-12-31')
  assert.equal(previousDay('2028-03-01'), '2028-02-29')
})
