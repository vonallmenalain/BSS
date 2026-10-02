import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AP_LESSON_SLOT_LABELS,
  apClassTitle,
  apLessonsWithoutClass,
  apTopicRows,
  parsePastedApTopics,
} from '../src/services/importApTopics.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird, was aus einer eingefügten Seite von «Für eine starke
 * Jugend» wird: welche Monate, welches Thema, welche vier Lektionen – an
 * welchem Sonntag sie landen und unter welchem Titel.
 */

/**
 * So kommt eine Seite im Textfeld der App an: ohne Verweise und ohne
 * Aufzählungszeichen, jeder Eintrag auf seiner eigenen Zeile.
 */
function withoutLinks(page: string): string {
  return page
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1\n')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s+/, ''))
    .join('\n')
}

/** Dieselbe Seite für einen anderen Monat – in den Adressen und im Text. */
function asMonth(page: string, month: string, name: string): string {
  return page.replace(/\/2026\/09\//g, `/2026/${month}/`).replace(/September 2026/g, `${name} 2026`)
}

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

/**
 * Das Heft vom Oktober 2026, gekürzt um einen Teil der Artikel.
 *
 * Es enthält **zwei Monate**: die Lektionen für den Oktober und gleich
 * auch die für den November – diese unter `…/ftsoy/2026/10/…`, also mit
 * der Adresse des Oktoberhefts und ohne `fsy-lessons/`, mitten zwischen
 * den Artikeln. Über jedem Thema steht als Rubrik der Monatsname.
 */
const OKTOBER = `
[Mehr dazu](https://www.churchofjesuschrist.org/feature/general-conference?lang=deu)
[Hören Sie das Wort Gottes bei der Generalkonferenz am 3. und 4. Oktober](https://www.churchofjesuschrist.org/feature/general-conference?lang=deu)
[Skip to Main Content](https://www.churchofjesuschrist.org/study/ftsoy/2026/10?lang=deu#main)Sign In
[Zeitschrift „Für eine starke Jugend“](https://www.churchofjesuschrist.org/study/youth/for-the-strength-of-youth-magazine?lang=deu)
Für eine starke Jugend, Oktober 2026

* [Inhalt](https://www.churchofjesuschrist.org/study/ftsoy/2026/10?lang=deu)
* [Gott kennt und liebt euch](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-god-knows-and-loves-you?lang=deu)
[Ulisses Soares](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-god-knows-and-loves-you?lang=deu)
* [Stimmen von Jugendlichen](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04-we-can-find-hope?lang=deu)
[Wir können Hoffnung finden](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04-we-can-find-hope?lang=deu)
[Desiree J.](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04-we-can-find-hope?lang=deu)
* [Geschichten aus dem Alten Testament](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/12-the-lions-den?lang=deu)
[Die Löwengrube](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/12-the-lions-den?lang=deu)
[Jessica Zoey Strong](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/12-the-lions-den?lang=deu)
* Oktober: Lektionen am Sonntag – Für eine starke Jugend
   * [Oktober](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/00-intro?lang=deu)
[Dein Körper ist heilig](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/00-intro?lang=deu)
   * [Fastensonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/01-fast-sunday?lang=deu)
[1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu)
[2. Erfahre mehr über das Wort der Weisheit](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu)
   * [Dritter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/03-third-sunday?lang=deu)
[3. Erfahre mehr über das Gesetz der Keuschheit](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/03-third-sunday?lang=deu)
   * [Letzter Sonntag: Junge Damen](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04a-fourth-sunday?lang=deu)
[4. Eine Tochter Gottes werden, die ihre Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04a-fourth-sunday?lang=deu)
   * [Letzter Sonntag: Kollegien des Aaronischen Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04b-fourth-sunday?lang=deu)
[4. Ein Sohn Gottes werden, der seine Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04b-fourth-sunday?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05a-activity-idea?lang=deu)
[Kochwettbewerb für einen gesunden Körper](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05a-activity-idea?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05b-activity-idea?lang=deu)
[Nutzt eure fünf Sinne](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05b-activity-idea?lang=deu)
* November: Lektionen am Sonntag – Für eine starke Jugend
   * [November](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/00-intro?lang=deu)
[Die Wahrheit befreit dich](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/00-intro?lang=deu)
   * [Fastensonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/01-fast-sunday?lang=deu)
[1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-second-sunday?lang=deu)
[2. Erfahre mehr über das Schriftstudium](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-second-sunday?lang=deu)
   * [Dritter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/03-third-sunday?lang=deu)
[3. Erfahre mehr über die Suche nach Wahrheit](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/03-third-sunday?lang=deu)
   * [Letzter Sonntag: Junge Damen](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04a-fourth-sunday?lang=deu)
[4. Eine Tochter Gottes werden, die ihre Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04a-fourth-sunday?lang=deu)
   * [Letzter Sonntag: Kollegien des Aaronischen Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04b-fourth-sunday?lang=deu)
[4. Ein Sohn Gottes werden, der seine Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04b-fourth-sunday?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05a-activity-idea?lang=deu)
[Drei Wahrheiten, eine Lüge](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05a-activity-idea?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05b-activity-idea?lang=deu)
[Durch die Wahrheit befreit](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05b-activity-idea?lang=deu)

Für eine starke Jugend, Oktober 2026
Für eine starke Jugend, Oktober 2026

* [Ulisses Soares](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-god-knows-and-loves-you?lang=deu)
[Gott kennt und liebt euch](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-god-knows-and-loves-you?lang=deu)
[Euer Vater im Himmel hat euch schon immer gekannt. Er liebt euch. Und er wird immer bei euch sein.](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-god-knows-and-loves-you?lang=deu)
* [Geschichten aus dem Alten Testament](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/12-the-lions-den?lang=deu)
[Jessica Zoey Strong](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/12-the-lions-den?lang=deu)
[Die Löwengrube](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/12-the-lions-den?lang=deu)
[Kurzfassung der alttestamentlichen Geschichte von Daniel in der Löwengrube](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/12-the-lions-den?lang=deu)
* Oktober: Lektionen am Sonntag – Für eine starke Jugend
   * [Oktober](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/00-intro?lang=deu)
[Dein Körper ist heilig](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/00-intro?lang=deu)
[Einstieg für den Unterricht bei den Jugendlichen, Oktober 2026](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/00-intro?lang=deu)
   * [Fastensonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/01-fast-sunday?lang=deu)
[1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/01-fast-sunday?lang=deu)
[Studienhilfen für den ersten Sonntag im Oktober](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu)
[2. Erfahre mehr über das Wort der Weisheit](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu)
[Studienhilfen für den zweiten Sonntag im Oktober](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu)
   * [Dritter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/03-third-sunday?lang=deu)
[3. Erfahre mehr über das Gesetz der Keuschheit](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/03-third-sunday?lang=deu)
[Studienhilfen für den dritten Sonntag im Oktober](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/03-third-sunday?lang=deu)
   * [Letzter Sonntag: Junge Damen](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04a-fourth-sunday?lang=deu)
[4. Eine Tochter Gottes werden, die ihre Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04a-fourth-sunday?lang=deu)
[Studienhilfen für die JD-Klasse am vierten Sonntag im Oktober](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04a-fourth-sunday?lang=deu)
   * [Letzter Sonntag: Kollegien des Aaronischen Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04b-fourth-sunday?lang=deu)
[4. Ein Sohn Gottes werden, der seine Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04b-fourth-sunday?lang=deu)
[Studienhilfen für die AP-Kollegien am vierten Sonntag im Oktober](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/04b-fourth-sunday?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05a-activity-idea?lang=deu)
[Kochwettbewerb für einen gesunden Körper](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05a-activity-idea?lang=deu)
[Anregung für eine Aktivität: Kochwettbewerb](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05a-activity-idea?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05b-activity-idea?lang=deu)
[Nutzt eure fünf Sinne](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05b-activity-idea?lang=deu)
[Ein Ratespiel, bei dem es ums Riechen, Schmecken, Fühlen, Hören und Sehen geht](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/05b-activity-idea?lang=deu)
* November: Lektionen am Sonntag – Für eine starke Jugend
   * [November](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/00-intro?lang=deu)
[Die Wahrheit befreit dich](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/00-intro?lang=deu)
[Einstieg für den Unterricht bei den Jugendlichen, November 2026](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/00-intro?lang=deu)
   * [Fastensonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/01-fast-sunday?lang=deu)
[1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/01-fast-sunday?lang=deu)
[Studienhilfen für den ersten Sonntag im November](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-second-sunday?lang=deu)
[2. Erfahre mehr über das Schriftstudium](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-second-sunday?lang=deu)
[Studienhilfen für den zweiten Sonntag im November](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-second-sunday?lang=deu)
   * [Dritter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/03-third-sunday?lang=deu)
[3. Erfahre mehr über die Suche nach Wahrheit](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/03-third-sunday?lang=deu)
[Studienhilfen für den dritten Sonntag im November](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/03-third-sunday?lang=deu)
   * [Letzter Sonntag: Junge Damen](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04a-fourth-sunday?lang=deu)
[4. Eine Tochter Gottes werden, die ihre Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04a-fourth-sunday?lang=deu)
[Studienhilfen für die JD-Klasse am vierten Sonntag im November](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04a-fourth-sunday?lang=deu)
   * [Letzter Sonntag: Kollegien des Aaronischen Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04b-fourth-sunday?lang=deu)
[4. Ein Sohn Gottes werden, der seine Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04b-fourth-sunday?lang=deu)
[Studienhilfen für die AP-Kollegien am vierten Sonntag im November](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04b-fourth-sunday?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05a-activity-idea?lang=deu)
[Drei Wahrheiten, eine Lüge](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05a-activity-idea?lang=deu)
[Ein Spiel, bei dem es darum geht, zwischen Wahrheit und Irrtum zu unterscheiden](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05a-activity-idea?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05b-activity-idea?lang=deu)
[Durch die Wahrheit befreit](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05b-activity-idea?lang=deu)
[Ein Spiel, das veranschaulicht, wie Wahrheit uns frei macht](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/05b-activity-idea?lang=deu)

[Anregungen](https://research.churchofjesuschrist.org/jfe/form/SV_da3uAscVgcSOlxA?lang=deu?pageUrl=https%3A%2F%2Fwww.churchofjesuschrist.org%2Fstudy%2Fftsoy%2F2026%2F10%3Flang%3Ddeu)
`

/**
 * Das Heft vom Dezember 2026, nur das Inhaltsverzeichnis. Hier heisst die
 * Rubrik der Jungen Damen «Vierter Sonntag», die der Kollegien weiterhin
 * «Letzter Sonntag», und der erste Sonntag ist der «Fastsonntag».
 */
const DEZEMBER = `
Für eine starke Jugend, Dezember 2026

* Dezember: Lektionen am Sonntag – Für eine starke Jugend
   * [Dezember](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/00-intro?lang=deu)
[Jesus Christus schenkt dir Freude](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/00-intro?lang=deu)
   * [Fastsonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/01-fast-sunday?lang=deu)
[1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/02-second-sunday?lang=deu)
[2. Erfahre mehr darüber, wie du auf Jesus Christus vertrauen kannst](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/02-second-sunday?lang=deu)
   * [Dritter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/03-third-sunday?lang=deu)
[3. Erfahre mehr über Hoffnung](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/03-third-sunday?lang=deu)
   * [Vierter Sonntag: Junge Damen](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/04a-fourth-sunday?lang=deu)
[4. Eine Tochter Gottes werden, die ihre Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/04a-fourth-sunday?lang=deu)
   * [Letzter Sonntag: Kollegien des Aaronischen Priestertums](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/04b-fourth-sunday?lang=deu)
[4. Ein Sohn Gottes werden, der seine Bündnisse hält](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/04b-fourth-sunday?lang=deu)
   * [Anregung für eine Jugendaktivität](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/05a-activity-idea?lang=deu)
[Ein Abend im Dienst am Nächsten](https://www.churchofjesuschrist.org/study/ftsoy/2026/12/fsy-lessons/05a-activity-idea?lang=deu)

Für eine starke Jugend, Dezember 2026
Für eine starke Jugend, Dezember 2026
`

/* ------------------------------------------------------------------ */
/* Die Seite lesen                                                     */
/* ------------------------------------------------------------------ */

test('aus der Monatsseite werden Monat, Thema und vier Lektionen', () => {
  const months = parsePastedApTopics(SEPTEMBER)

  assert.equal(months.length, 1)
  assert.equal(months[0].month, '2026-09')
  assert.equal(months[0].intro, 'Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet')
  assert.deepEqual(months[0].lessons, [
    {
      slot: 'fast',
      topic: 'Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“',
    },
    { slot: 'second', topic: 'Erfahre mehr über die Wiederherstellung des Priestertums' },
    { slot: 'third', topic: 'Erfahre mehr über Priestertumsschlüssel' },
    { slot: 'fourth', topic: 'Ein Sohn Gottes werden, der seine Bündnisse hält' },
  ])
})

test('das Oktoberheft bringt auch den November mit', () => {
  const months = parsePastedApTopics(OKTOBER)

  assert.deepEqual(
    months.map((month) => month.month),
    ['2026-10', '2026-11'],
  )

  // Über dem Thema steht der Monatsname als Rubrik – er ist nicht das Thema.
  const [oktober, november] = months
  assert.equal(oktober.intro, 'Dein Körper ist heilig')
  assert.deepEqual(
    oktober.lessons.map((lesson) => lesson.topic),
    [
      'Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“',
      'Erfahre mehr über das Wort der Weisheit',
      'Erfahre mehr über das Gesetz der Keuschheit',
      'Ein Sohn Gottes werden, der seine Bündnisse hält',
    ],
  )

  // Die Adressen sagen «2026/10» – den November nennt die Überschrift.
  assert.equal(november.intro, 'Die Wahrheit befreit dich')
  assert.deepEqual(
    november.lessons.map((lesson) => lesson.topic),
    [
      'Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“',
      'Erfahre mehr über das Schriftstudium',
      'Erfahre mehr über die Suche nach Wahrheit',
      'Ein Sohn Gottes werden, der seine Bündnisse hält',
    ],
  )
})

test('ohne Verweise ergibt die Seite dasselbe', () => {
  assert.deepEqual(parsePastedApTopics(withoutLinks(OKTOBER)), parsePastedApTopics(OKTOBER))
  assert.deepEqual(parsePastedApTopics(withoutLinks(DEZEMBER)), parsePastedApTopics(DEZEMBER))
  assert.deepEqual(parsePastedApTopics(withoutLinks(SEPTEMBER)), parsePastedApTopics(SEPTEMBER))
})

test('der vierte Sonntag gehört den Kollegien und nicht den Jungen Damen', () => {
  // «4. Eine Tochter Gottes werden» steht auf der Seite zuerst – sie gehört
  // zur Klasse der Jungen Damen und hat im AP-Plan nichts zu suchen.
  for (const page of [SEPTEMBER, DEZEMBER, withoutLinks(DEZEMBER)]) {
    const [month] = parsePastedApTopics(page)
    assert.equal(month.lessons.at(-1)?.topic, 'Ein Sohn Gottes werden, der seine Bündnisse hält')
  }
})

test('der Dezember hat sein eigenes Thema', () => {
  const [dezember] = parsePastedApTopics(DEZEMBER)

  assert.equal(dezember.month, '2026-12')
  assert.equal(dezember.intro, 'Jesus Christus schenkt dir Freude')
  assert.deepEqual(
    dezember.lessons.map((lesson) => lesson.slot),
    ['fast', 'second', 'third', 'fourth'],
  )
})

test('die Rubrik weicht dem Titel, die Beschreibung zählt nicht', () => {
  const topics = parsePastedApTopics(OKTOBER).flatMap((month) =>
    month.lessons.map((lesson) => lesson.topic),
  )

  assert.equal(
    topics.some((topic) => topic.startsWith('Studienhilfen')),
    false,
  )
  assert.equal(topics.includes('Zweiter Sonntag'), false)
})

test('Artikel neben den Lektionen sind keine Lektionen', () => {
  // Gleicher Ordner wie die Lektionen für den November, gleiche Ziffer vorn.
  const artikel = `
Für eine starke Jugend, Oktober 2026
* [Gott kennt und liebt euch](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/02-god-knows-and-loves-you?lang=deu)
* [Wir können Hoffnung finden](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/04-we-can-find-hope?lang=deu)
`
  assert.deepEqual(parsePastedApTopics(artikel), [])
})

test('ohne Titel bleibt die Rubrik – besser als gar nichts', () => {
  const nurRubriken = `
   * [Fastensonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/01-fast-sunday?lang=deu)
   * [Zweiter Sonntag](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/02-second-sunday?lang=deu)
`
  const [oktober] = parsePastedApTopics(nurRubriken)

  assert.equal(oktober.month, '2026-10')
  assert.deepEqual(
    oktober.lessons.map((lesson) => lesson.topic),
    ['Fastensonntag', 'Zweiter Sonntag'],
  )
})

test('ein Verweis auf das nächste Heft ergibt keinen weiteren Monat', () => {
  const mitArchiv = `${SEPTEMBER}
[Oktober 2026](https://www.churchofjesuschrist.org/study/ftsoy/2026/10/fsy-lessons/00-intro?lang=deu)
`
  assert.deepEqual(
    parsePastedApTopics(mitArchiv).map((month) => month.month),
    ['2026-09'],
  )
})

test('ohne Verweise zählen die nummerierten Zeilen – bei der Vier die der Kollegien', () => {
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
  const [september] = parsePastedApTopics(alsText)

  assert.equal(september.month, '2026-09')
  assert.equal(september.intro, 'Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet')
  assert.deepEqual(
    september.lessons.map((lesson) => lesson.topic),
    [
      'Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“',
      'Erfahre mehr über die Wiederherstellung des Priestertums',
      'Erfahre mehr über Priestertumsschlüssel',
      'Ein Sohn Gottes werden, der seine Bündnisse hält',
    ],
  )
})

test('ein Dezemberheft mit Lektionen für den Januar meint das neue Jahr', () => {
  const dezemberheft = `
Für eine starke Jugend, Dezember 2026
Januar: Lektionen am Sonntag – Für eine starke Jugend
Januar
Ein neuer Anfang
Fastensonntag
1. Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“
`
  const [januar] = parsePastedApTopics(dezemberheft)

  assert.equal(januar.month, '2027-01')
  assert.equal(januar.intro, 'Ein neuer Anfang')
})

test('was keine Monatsseite ist, ergibt nichts', () => {
  assert.deepEqual(parsePastedApTopics(''), [])
  assert.deepEqual(parsePastedApTopics('Irgendein Text ohne Monat und ohne Lektion'), [])
})

/* ------------------------------------------------------------------ */
/* Der Titel der Klasse                                                */
/* ------------------------------------------------------------------ */

test('der Titel nennt erst das Thema des Monats, dann das der Woche', () => {
  assert.equal(
    apClassTitle('Dein Körper ist heilig', 'Erfahre mehr über das Wort der Weisheit'),
    'Dein Körper ist heilig – Erfahre mehr über das Wort der Weisheit',
  )
})

test('vom Fastsonntag bleibt das Kapitel aus dem Wegweiser', () => {
  assert.equal(
    apClassTitle(
      'Dein Körper ist heilig',
      'Befasse dich mit dem Kapitel aus dem Wegweiser „Für eine starke Jugend“',
    ),
    'Dein Körper ist heilig – Kapitel aus dem Wegweiser „Für eine starke Jugend“',
  )
})

test('ohne Monatsthema steht die Lektion allein, ohne Lektion bleibt der Titel leer', () => {
  assert.equal(apClassTitle('', 'Erfahre mehr über Hoffnung'), 'Erfahre mehr über Hoffnung')
  assert.equal(apClassTitle('Jesus Christus schenkt dir Freude', ''), '')
})

/* ------------------------------------------------------------------ */
/* Auf die Sonntage verteilen                                          */
/* ------------------------------------------------------------------ */

test('die vier Lektionen landen auf den vier Sonntagen im September', () => {
  const rows = apTopicRows(parsePastedApTopics(SEPTEMBER)[0])

  assert.deepEqual(
    rows.map((row) => row.date),
    ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'],
  )
  assert.deepEqual(
    rows.map((row) => row.slot),
    ['fast', 'second', 'third', 'fourth'],
  )
  assert.equal(
    rows[0].title,
    'Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet – Kapitel aus dem Wegweiser „Für eine starke Jugend“',
  )
  assert.equal(
    rows[3].title,
    'Durch Priestertumsschlüssel und -vollmacht wirst du gesegnet – Ein Sohn Gottes werden, der seine Bündnisse hält',
  )
})

test('im Oktober ist der erste Sonntag Generalkonferenz – seine Lektion fällt weg', () => {
  const [oktober] = parsePastedApTopics(OKTOBER)
  const rows = apTopicRows(oktober)

  assert.deepEqual(
    rows.map((row) => row.date),
    ['2026-10-11', '2026-10-18', '2026-10-25'],
  )
  assert.deepEqual(
    rows.map((row) => row.title),
    [
      'Dein Körper ist heilig – Erfahre mehr über das Wort der Weisheit',
      'Dein Körper ist heilig – Erfahre mehr über das Gesetz der Keuschheit',
      'Dein Körper ist heilig – Ein Sohn Gottes werden, der seine Bündnisse hält',
    ],
  )
  assert.deepEqual(apLessonsWithoutClass(oktober), [
    { slot: 'fast', date: '2026-10-04', conference: true },
  ])
})

test('in einem Monat mit fünf Sonntagen bleibt der fünfte offen', () => {
  // November 2026: 1., 8., 15., 22. und 29. – gezählt wird vom Monatsanfang,
  // die vierte Lektion gehört also dem 22. und nicht dem 29.
  const [, november] = parsePastedApTopics(OKTOBER)
  const rows = apTopicRows(november)

  assert.deepEqual(
    rows.map((row) => row.date),
    ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'],
  )
  assert.deepEqual(
    rows.map((row) => row.slot),
    ['fast', 'second', 'third', 'fourth', null],
  )
  assert.equal(
    rows[0].title,
    'Die Wahrheit befreit dich – Kapitel aus dem Wegweiser „Für eine starke Jugend“',
  )
  assert.equal(
    rows[3].title,
    'Die Wahrheit befreit dich – Ein Sohn Gottes werden, der seine Bündnisse hält',
  )
  assert.equal(rows[4].title, '')
  assert.deepEqual(apLessonsWithoutClass(november), [])
})

test('vor September 2026 gibt es nur am 2. und 4. Sonntag eine Klasse', () => {
  // Juli 2026: Sonntage am 5., 12., 19. und 26. – Klasse am 12. und 26.
  const [juli] = parsePastedApTopics(asMonth(SEPTEMBER, '07', 'Juli'))
  const rows = apTopicRows(juli)

  assert.deepEqual(
    rows.map((row) => row.date),
    ['2026-07-12', '2026-07-26'],
  )
  assert.deepEqual(
    rows.map((row) => row.slot),
    ['second', 'fourth'],
  )
  assert.deepEqual(apLessonsWithoutClass(juli), [
    { slot: 'fast', date: '2026-07-05', conference: false },
    { slot: 'third', date: '2026-07-19', conference: false },
  ])
})

test('jede Lektion hat eine Beschriftung für die Vorschau', () => {
  assert.equal(AP_LESSON_SLOT_LABELS.fast, 'Fastensonntag')
  assert.equal(AP_LESSON_SLOT_LABELS.fourth, 'Vierter Sonntag')
})
