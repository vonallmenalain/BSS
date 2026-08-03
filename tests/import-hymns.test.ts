import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parsePastedHymns } from '../src/services/importHymns.ts'
import { parseHymnCode } from '../src/lib/hymnCode.ts'

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

/* ------------------------------------------------------------------ */
/* Gesangbuch für zuhause und für die Kirche                           */
/* ------------------------------------------------------------------ */

/*
 * Die neue Sammlung zählt ab 1001 und springt zwischen ihren Abschnitten
 * (1001 ff., dann 1201 ff.). Vierstellige Nummern müssen deshalb durch.
 */
const HOME_CHURCH_PAGE = [
  'Derzeit wurden alle ausgewählten Filter angewendet.',
  'Filtern',
  '',
  '1. [Musikarchiv](https://www.churchofjesuschrist.org/media/music?lang=deu)',
  '2. ',
  '',
  'Gesangbuch für zuhause und für die Kirche',
  'Komm, du Quelle jedes Segens',
  'GesangBegleitungBegleitung (Gitarre)',
  '00:00',
  '02:33',
  'Downloads',
  'Alles einblenden',
  '60 Ergebnisse',
  'Sabbat und Wochentag',
  '',
  '* [1001. Komm, du Quelle jedes Segens](https://www.churchofjesuschrist.org/media/music/songs/come-thou-fount-of-every-blessing?crumbs=hymns-for-home-and-church&order=number&lang=deu)',
  '* [1002. Wenn der Heiland wiederkehrt](https://www.churchofjesuschrist.org/media/music/songs/when-the-savior-comes-again?crumbs=hymns-for-home-and-church&order=number&lang=deu)',
  '',
  'Ostern und Weihnachten',
  '',
  '* [1201. Preist den Herrn, der auferstand](https://www.churchofjesuschrist.org/media/music/songs/hail-the-day-that-sees-him-rise?crumbs=hymns-for-home-and-church&order=number&lang=deu)',
  '* [1207. Still, Still, Still](https://www.churchofjesuschrist.org/media/music/songs/still-still-still?crumbs=hymns-for-home-and-church&order=number&lang=deu)',
].join('\n')

test('liest die vierstelligen Nummern der neuen Sammlung', () => {
  assert.deepEqual(parsePastedHymns(HOME_CHURCH_PAGE), [
    { number: 1001, suffix: '', title: 'Komm, du Quelle jedes Segens' },
    { number: 1002, suffix: '', title: 'Wenn der Heiland wiederkehrt' },
    { number: 1201, suffix: '', title: 'Preist den Herrn, der auferstand' },
    { number: 1207, suffix: '', title: 'Still, Still, Still' },
  ])
})

test('lässt sich von der Trefferzahl der neuen Sammlung nicht täuschen', () => {
  assert.deepEqual(parsePastedHymns('60 Ergebnisse'), [])
})

/* ------------------------------------------------------------------ */
/* Codes                                                               */
/* ------------------------------------------------------------------ */

test('leitet das Buch aus dem Code ab', () => {
  assert.deepEqual(parseHymnCode('6'), {
    book: 'hymns',
    number: 6,
    suffix: '',
    code: '6',
  })
  assert.deepEqual(parseHymnCode('pv 6'), {
    book: 'children',
    number: 6,
    suffix: '',
    code: 'PV 6',
  })
  // Ab 1001 die neue Sammlung – ohne Kürzel, weil nichts zusammenstösst.
  assert.deepEqual(parseHymnCode('1001'), {
    book: 'home_church',
    number: 1001,
    suffix: '',
    code: '1001',
  })
  // Die Grenze liegt sauber zwischen den Büchern.
  assert.equal(parseHymnCode('210')?.book, 'hymns')
  assert.equal(parseHymnCode('1000')?.book, 'hymns')
})

test('führt Schreibweisen desselben Codes zusammen', () => {
  for (const text of ['PV 18a', 'pv18a', 'Pv 18 a']) {
    assert.equal(parseHymnCode(text)?.code, 'PV 18a', text)
  }
})

test('weist zurück, was keine Liednummer ist', () => {
  for (const text of ['', 'Abendmahl', '0', '12345', 'PV', '6x7']) {
    assert.equal(parseHymnCode(text), null, text)
  }
})
