import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parsePastedHymns } from '../src/services/importHymns.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Liedtitel stammen aus dem Gesangbuch, das Drumherum aus dem
 * Musikarchiv: Menü, Filterleiste, Rubriken, das laufende Hörbeispiel und
 * die Trefferzahl. Genau dieses Drumherum kopiert man zwangsläufig mit.
 */

const ARCHIVE_PAGE = [
  'Skip to Main ContentSign In',
  'Kirche Jesu Christi der Heiligen der Letzten Tage',
  'Meine Seite',
  'Archive',
  'Filter Search',
  'Suchen',
  'Deutsch',
  'Profile Picture',
  'Filter zurücksetzen',
  'Filter für die Liederliste',
  'Nur dieses Wort oder diese Formulierung',
  'Thema',
  'Aufnahme verfügbar',
  'Schwierigkeitsgrad',
  'Textdichter',
  'Komponist',
  'Derzeit wurden alle ausgewählten Filter angewendet.Filtern',
  'Musikarchiv',
  'Gesangbuch der Kirche Jesu Christi der Heiligen der Letzen Tage',
  'Hymnal Audio Cover Art',
  // Das laufende Hörbeispiel: Titel ohne Nummer, dazu die Spieldauer.
  'Der Morgen naht',
  'Begleitung',
  '00:00',
  '03:52',
  'Nach Nummer sortieren',
  'Alles einblenden',
  '210 Ergebnisse',
  'Wiederherstellung',
  '',
  '1. Der Morgen naht',
  '',
  '2. Der Geist aus den Höhen',
  '',
  '3. O Fülle des Heiles',
  'Lobpreis und Danksagung',
  '',
  '32. Für die Wunder dieser Welt',
  'Abendmahl',
  '',
  '109. Jesus von Nazareth',
  'Frauenstimmen',
  '',
  '207. Als Schwestern in Zion (Frauenstimmen)',
  'Männerstimmen',
  '',
  '210. Das heilge Priestertum (Männerstimmen)',
  'Zurück nach oben',
].join('\n')

test('liest die Lieder aus der kopierten Archivseite', () => {
  assert.deepEqual(parsePastedHymns(ARCHIVE_PAGE), [
    { number: 1, title: 'Der Morgen naht' },
    { number: 2, title: 'Der Geist aus den Höhen' },
    { number: 3, title: 'O Fülle des Heiles' },
    { number: 32, title: 'Für die Wunder dieser Welt' },
    { number: 109, title: 'Jesus von Nazareth' },
    { number: 207, title: 'Als Schwestern in Zion (Frauenstimmen)' },
    { number: 210, title: 'Das heilge Priestertum (Männerstimmen)' },
  ])
})

test('hält die Trefferzahl nicht für ein Lied – der Punkt entscheidet', () => {
  const hymns = parsePastedHymns(['210 Ergebnisse', '5 Herr, unser Erlöser'].join('\n'))
  assert.deepEqual(hymns, [])
})

test('übergeht Rubriken und die Spieldauer des Hörbeispiels', () => {
  const hymns = parsePastedHymns(
    ['Weihnachten', '00:00', '03:52', '134. Stille Nacht, heilige Nacht'].join('\n'),
  )
  assert.deepEqual(hymns, [{ number: 134, title: 'Stille Nacht, heilige Nacht' }])
})

test('findet den Titel auch eine Zeile tiefer', () => {
  // Manche Browser trennen Nummer und Titel beim Kopieren.
  const hymns = parsePastedHymns(
    ['1.', 'Der Morgen naht', '2.', 'Der Geist aus den Höhen'].join('\n'),
  )

  assert.deepEqual(hymns, [
    { number: 1, title: 'Der Morgen naht' },
    { number: 2, title: 'Der Geist aus den Höhen' },
  ])
})

test('nimmt eine Nummer ohne Titel nicht auf', () => {
  assert.deepEqual(parsePastedHymns(['7.', '', '8.'].join('\n')), [])
})

test('sortiert nach Nummer und lässt Dubletten weg', () => {
  const hymns = parsePastedHymns(
    ['40. Ein feste Burg ist unser Gott', '2. Der Geist aus den Höhen', '2. Doppelt kopiert'].join(
      '\n',
    ),
  )

  assert.deepEqual(hymns, [
    { number: 2, title: 'Der Geist aus den Höhen' },
    { number: 40, title: 'Ein feste Burg ist unser Gott' },
  ])
})

test('verträgt Tabulatoren und geschützte Leerzeichen', () => {
  const hymns = parsePastedHymns('19.\tKommt, Heilge, kommt!')
  assert.deepEqual(hymns, [{ number: 19, title: 'Kommt, Heilge, kommt!' }])
})
