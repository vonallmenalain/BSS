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
    { number: 1, suffix: '', title: 'Der Morgen naht' },
    { number: 2, suffix: '', title: 'Der Geist aus den Höhen' },
    { number: 3, suffix: '', title: 'O Fülle des Heiles' },
    { number: 32, suffix: '', title: 'Für die Wunder dieser Welt' },
    { number: 109, suffix: '', title: 'Jesus von Nazareth' },
    { number: 207, suffix: '', title: 'Als Schwestern in Zion (Frauenstimmen)' },
    { number: 210, suffix: '', title: 'Das heilge Priestertum (Männerstimmen)' },
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
  assert.deepEqual(hymns, [{ number: 134, suffix: '', title: 'Stille Nacht, heilige Nacht' }])
})

test('nimmt eine Nummer ohne Titel nicht auf', () => {
  // Der leere zweite Eintrag des Brotkrumenpfads. Nähme man den Titel aus
  // der nächsten Zeile, hiesse Nr. 2 plötzlich wie die Seite.
  const hymns = parsePastedHymns(
    ['2. ', 'Liederbuch für Kinder der Kirche Jesu Christi', '7.', '8.'].join('\n'),
  )
  assert.deepEqual(hymns, [])
})

test('sortiert nach Nummer und lässt Dubletten weg', () => {
  const hymns = parsePastedHymns(
    ['40. Ein feste Burg ist unser Gott', '2. Der Geist aus den Höhen', '2. Doppelt kopiert'].join(
      '\n',
    ),
  )

  assert.deepEqual(hymns, [
    { number: 2, suffix: '', title: 'Der Geist aus den Höhen' },
    { number: 40, suffix: '', title: 'Ein feste Burg ist unser Gott' },
  ])
})

test('verträgt Tabulatoren und geschützte Leerzeichen', () => {
  const hymns = parsePastedHymns('19.\tKommt, Heilge, kommt!')
  assert.deepEqual(hymns, [{ number: 19, suffix: '', title: 'Kommt, Heilge, kommt!' }])
})

/* ------------------------------------------------------------------ */
/* Liederbuch für Kinder                                               */
/* ------------------------------------------------------------------ */

/*
 * Die PV-Seite kommt je nach Browser als Markdown-Liste mit Verweisen.
 * Darüber steht dann ein Brotkrumenpfad, der wie ein Lied aussieht –
 * «1. Musikarchiv» – und sich nur am Ziel des Verweises verrät.
 */
const CHILDREN_PAGE = [
  'Filter zurücksetzen',
  'Derzeit wurden alle ausgewählten Filter angewendet.',
  'Filtern',
  '',
  '1. [Musikarchiv](https://www.churchofjesuschrist.org/media/music?lang=deu)',
  '2. ',
  '',
  'Liederbuch für Kinder der Kirche Jesu Christi der Heiligen der Letzten Tage',
  'Ich bin ein Kind von Gott',
  'Gesang (Kinder)Begleitung',
  '00:00',
  '03:21',
  'Alles einblenden',
  '121 Ergebnisse',
  'Der himmlische Vater',
  '',
  '* [2. Ich bin ein Kind von Gott](https://www.churchofjesuschrist.org/media/music/songs/i-am-a-child-of-god-wolford?crumbs=childrens-songbook&order=number&lang=deu)',
  '* [6. Gebet eines Kindes](https://www.churchofjesuschrist.org/media/music/songs/a-childs-prayer?crumbs=childrens-songbook&order=number&lang=deu)',
  '* [18a. Dankkanon](https://www.churchofjesuschrist.org/media/music/songs/for-health-and-strength?crumbs=childrens-songbook&order=number&lang=deu)',
  '* [18b. Den Kopf geneigt](https://www.churchofjesuschrist.org/media/music/songs/we-bow-our-heads?crumbs=childrens-songbook&order=number&lang=deu)',
  '',
  'Der Erretter',
  '',
  '* [20. Er sandte seinen Sohn](https://www.churchofjesuschrist.org/media/music/songs/he-sent-his-son?crumbs=childrens-songbook&order=number&lang=deu)',
].join('\n')

test('liest die PV-Liste aus der Markdown-Fassung', () => {
  assert.deepEqual(parsePastedHymns(CHILDREN_PAGE), [
    { number: 2, suffix: '', title: 'Ich bin ein Kind von Gott' },
    { number: 6, suffix: '', title: 'Gebet eines Kindes' },
    { number: 18, suffix: 'a', title: 'Dankkanon' },
    { number: 18, suffix: 'b', title: 'Den Kopf geneigt' },
    { number: 20, suffix: '', title: 'Er sandte seinen Sohn' },
  ])
})

test('hält den Brotkrumenpfad nicht für ein Lied', () => {
  // «1. Musikarchiv» hat die Form eines Liedes, führt aber zur Übersicht.
  const hymns = parsePastedHymns(CHILDREN_PAGE)
  assert.equal(
    hymns.some((hymn) => hymn.title === 'Musikarchiv'),
    false,
  )
})

test('hält Doppelnummern auseinander und sortiert sie', () => {
  const hymns = parsePastedHymns(['129b. Singen macht Spaß!', '129a. Kopf, Schulter'].join('\n'))

  assert.deepEqual(hymns, [
    { number: 129, suffix: 'a', title: 'Kopf, Schulter' },
    { number: 129, suffix: 'b', title: 'Singen macht Spaß!' },
  ])
})
