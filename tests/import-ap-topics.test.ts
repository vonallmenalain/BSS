import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AP_LESSON_SLOT_LABELS,
  apTopicRows,
  parsePastedApTopics,
} from '../src/services/importApTopics.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird, was aus einer eingefügten Monatsseite von «Für eine starke
 * Jugend» wird: welcher Monat, welche vier Lektionen – und an welchem
 * Sonntag sie landen.
 */

/**
 * Der Ausschnitt der Seite, auf den es ankommt – September 2026.
 *
 * So kommt sie aus dem Browser: erst das Inhaltsverzeichnis, weiter unten
 * dieselben Lektionen noch einmal als Sammlung, dort zusätzlich mit ihrer
 * Beschreibung. Jede Lektion steht also zwei- bis dreimal da.
 */
const SEPTEMBER = `
Für eine starke Jugend, September 2026

* Lektionen am Sonntag – Für eine starke Jugend
   * [Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/00-intro?lang=deu)
   * [Fastensonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/01-fast-sunday?lang=deu)
[1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/02-second-sunday?lang=deu)
[2. Erfahre mehr über die Wiederherstellung des Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/02-second-sunday?lang=deu)
   * [Dritter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/03-third-sunday?lang=deu)
[3. Erfahre mehr über Priestertumsschlüssel](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/03-third-sunday?lang=deu)
   * [Letzter Sonntag: Junge Damen](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/04a-fourth-sunday?lang=deu)
[4. Eine Tochter Gottes werden, die ihre Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/04a-fourth-sunday?lang=deu)
   * [Letzter Sonntag: Kollegien des Aaronischen Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/04b-fourth-sunday?lang=deu)
[4. Ein Sohn Gottes werden, der seine Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/04b-fourth-sunday?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/05a-activity-idea?lang=deu)
[Wer schafft das: Feuer mit nur einem Streichholz](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/05a-activity-idea?lang=deu)

* Lektionen am Sonntag – Für eine starke Jugend
   * [Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/00-intro?lang=deu)
[Einstieg für den Unterricht bei den Jugendlichen, September 2026](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/00-intro?lang=deu)
   * [Fastensonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/01-fast-sunday?lang=deu)
[1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/01-fast-sunday?lang=deu)
[Studienhilfen für den Fastsonntag im September](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/02-second-sunday?lang=deu)
[2. Erfahre mehr über die Wiederherstellung des Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/02-second-sunday?lang=deu)
[Studienhilfen für den zweiten Sonntag im September](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/02-second-sunday?lang=deu)
   * [Dritter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/03-third-sunday?lang=deu)
[3. Erfahre mehr über Priestertumsschlüssel](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/03-third-sunday?lang=deu)
[Studienhilfen für den dritten Sonntag im September](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/03-third-sunday?lang=deu)
   * [Letzter Sonntag: Kollegien des Aaronischen Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/04b-fourth-sunday?lang=deu)
[4. Ein Sohn Gottes werden, der seine Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/04b-fourth-sunday?lang=deu)
[Studienhilfen für die AP-Kollegien am vierten Sonntag im September](https://www.churchofjesuschrist.org/study/ftsoy/2026/09/fsy-lessons/04b-fourth-sunday?lang=deu)
`

/* ------------------------------------------------------------------ */
/* Die Seite lesen                                                     */
/* ------------------------------------------------------------------ */

test('aus der Monatsseite werden Monat, Thema und vier Lektionen', () => {
  const parsed = parsePastedApTopics(SEPTEMBER)

  assert.ok(parsed)
  assert.equal(parsed.month, '2026-09')
  assert.equal(parsed.intro, 'Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet')
  assert.deepEqual(parsed.lessons, [
    {
      slot: 'fast',
      topic: 'Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“',
    },
    { slot: 'second', topic: 'Erfahre mehr über die Wiederherstellung des Priestertums' },
    { slot: 'third', topic: 'Erfahre mehr über Priestertumsschlüssel' },
    { slot: 'last', topic: 'Ein Sohn Gottes werden, der seine Bündnisse hält' },
  ])
})

test('der vierte Sonntag gehört den Kollegien und nicht den Jungen Damen', () => {
  const parsed = parsePastedApTopics(SEPTEMBER)

  // «4. Eine Tochter Gottes werden» steht auf der Seite zuerst – sie gehört
  // zur Klasse der Jungen Damen und hat im AP-Plan nichts zu suchen.
  assert.equal(parsed?.lessons.at(-1)?.topic, 'Ein Sohn Gottes werden, der seine Bündnisse hält')
})

test('die Rubrik weicht dem Titel, die Beschreibung zählt nicht', () => {
  const parsed = parsePastedApTopics(SEPTEMBER)
  const topics = parsed?.lessons.map((lesson) => lesson.topic) ?? []

  assert.equal(
    topics.some((topic) => topic.startsWith('Studienhilfen')),
    false,
  )
  assert.equal(topics.includes('Zweiter Sonntag'), false)
})

test('ohne Titel bleibt die Rubrik – besser als gar nichts', () => {
  const nurRubriken = `
   * [Fastensonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu)
`
  const parsed = parsePastedApTopics(nurRubriken)

  assert.equal(parsed?.month, '2026-10')
  assert.deepEqual(
    parsed?.lessons.map((lesson) => lesson.topic),
    ['Fastensonntag', 'Zweiter Sonntag'],
  )
})

test('Verweise auf Nachbarmonate ändern den Monat nicht', () => {
  const mitArchiv = `${SEPTEMBER}
[Oktober 2026](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/00-intro?lang=deu)
`
  assert.equal(parsePastedApTopics(mitArchiv)?.month, '2026-09')
})

test('ohne Verweise zählen die nummerierten Zeilen – bei der Vier die zweite', () => {
  const alsText = `
Für eine starke Jugend, September 2026
Lektionen am Sonntag – Für eine starke Jugend
Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet
Fastensonntag
1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“
Zweiter Sonntag
2. Erfahre mehr über die Wiederherstellung des Priestertums
Dritter Sonntag
3. Erfahre mehr über Priestertumsschlüssel
Letzter Sonntag: Junge Damen
4. Eine Tochter Gottes werden, die ihre Bündnisse hält
Letzter Sonntag: Kollegien des Aaronischen Priestertums
4. Ein Sohn Gottes werden, der seine Bündnisse hält
`
  const parsed = parsePastedApTopics(alsText)

  assert.equal(parsed?.month, '2026-09')
  assert.deepEqual(
    parsed?.lessons.map((lesson) => lesson.topic),
    [
      'Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“',
      'Erfahre mehr über die Wiederherstellung des Priestertums',
      'Erfahre mehr über Priestertumsschlüssel',
      'Ein Sohn Gottes werden, der seine Bündnisse hält',
    ],
  )
})

test('was keine Monatsseite ist, ergibt nichts', () => {
  assert.equal(parsePastedApTopics(''), null)
  assert.equal(parsePastedApTopics('Irgendein Text ohne Monat und ohne Lektion'), null)
})

/* ------------------------------------------------------------------ */
/* Auf die Sonntage verteilen                                          */
/* ------------------------------------------------------------------ */

test('die vier Lektionen landen auf den vier Sonntagen im September', () => {
  const rows = apTopicRows(parsePastedApTopics(SEPTEMBER)!)

  assert.deepEqual(
    rows.map((row) => row.date),
    ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'],
  )
  assert.deepEqual(
    rows.map((row) => row.slot),
    ['fast', 'second', 'third', 'last'],
  )
  assert.equal(
    rows[0].topic,
    'Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“',
  )
  assert.equal(rows[3].topic, 'Ein Sohn Gottes werden, der seine Bündnisse hält')
})

test('in einem Monat mit fünf Sonntagen bleibt der vierte offen', () => {
  // November 2026: 1., 8., 15., 22. und 29. – die vierte Lektion gehört dem
  // letzten Sonntag, so wie das Heft sie nennt.
  const november = parsePastedApTopics(SEPTEMBER.replace(/\/2026\/09\//g, '/2026/11/'))!
  const rows = apTopicRows(november)

  assert.deepEqual(
    rows.map((row) => row.date),
    ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'],
  )
  assert.deepEqual(
    rows.map((row) => row.slot),
    ['fast', 'second', 'third', null, 'last'],
  )
  assert.equal(rows[3].topic, '')
  assert.equal(rows[4].topic, 'Ein Sohn Gottes werden, der seine Bündnisse hält')
})

test('vor September 2026 gibt es nur am 2. und 4. Sonntag eine Klasse', () => {
  // Juli 2026: Sonntage am 5., 12., 19. und 26. – Klasse am 12. und 26.
  const juli = parsePastedApTopics(SEPTEMBER.replace(/\/2026\/09\//g, '/2026/07/'))!
  const rows = apTopicRows(juli)

  assert.deepEqual(
    rows.map((row) => row.date),
    ['2026-07-12', '2026-07-26'],
  )
  assert.deepEqual(
    rows.map((row) => row.slot),
    ['second', 'last'],
  )
})

test('jede Lektion hat eine Beschriftung für die Vorschau', () => {
  assert.equal(AP_LESSON_SLOT_LABELS.fast, 'Fastensonntag')
  assert.equal(AP_LESSON_SLOT_LABELS.last, 'Letzter Sonntag')
})
