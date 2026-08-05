import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  activeTalkFilterCount,
  DEFAULT_TALK_FILTER,
  filterTalkCandidates,
  NEVER_SPOKE,
  plannedTalkMemberIds,
  rankTalkCandidates,
  talkYearOptions,
  type TalkCandidate,
  type TalkCandidateFilter,
} from '../src/lib/talkCandidates.ts'
import type { Member, Talk } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Vorschlagsliste der Ansprachen – vor allem die Grenze,
 * an der «bereits eingeplant» endet: Eine Zusage bleibt am Eintrag stehen,
 * auch wenn der Sonntag zwei Jahre zurückliegt. Zählte sie weiter als
 * Einplanung, wäre in der Liste gesperrt, wer je gesprochen hat – und das
 * sind mit den Jahren alle.
 */

/* ------------------------------------------------------------------ */
/* Testdaten                                                           */
/* ------------------------------------------------------------------ */

const JETZT = new Date('2026-08-05T14:00:00')

const member = (id: string, partial: Partial<Member> = {}): Member =>
  ({
    id,
    lastName: id,
    firstName: 'Test',
    gender: 'unknown',
    birthDate: null,
    status: 'active',
    availableForTalks: true,
    lastTalkDate: null,
    talkCount: 0,
    tags: [],
    ...partial,
  }) as unknown as Member

const talk = (memberId: string, iso: string, status: Talk['status'] = 'confirmed'): Talk =>
  ({
    id: `${memberId}-${iso}`,
    memberId,
    memberName: 'Person',
    date: new Date(`${iso}T10:00:00`),
    slot: 1,
    status,
  }) as unknown as Talk

/** Ein Geburtsdatum, das immer dasselbe Alter ergibt – egal, wann geprüft wird. */
const jahreAlt = (years: number) => new Date(new Date().getFullYear() - years, 0, 1)

/*
 * `monthsSince` und `getAge` rechnen gegen den heutigen Tag und nicht gegen
 * `JETZT` – ein Abstand wird deshalb von heute aus zurückgerechnet, damit die
 * Prüfung in einem Jahr noch dasselbe misst.
 */
const monateZurueck = (months: number) => {
  const date = new Date()
  date.setDate(15)
  date.setMonth(date.getMonth() - months)
  return date
}

const kandidat = (partial: Partial<TalkCandidate> & { member?: Member } = {}): TalkCandidate => ({
  member: member('m'),
  age: 40,
  monthsSince: null,
  lastTalkYear: null,
  alreadyPlanned: false,
  onHold: false,
  score: 0,
  ...partial,
})

const filter = (partial: Partial<TalkCandidateFilter> = {}): TalkCandidateFilter => ({
  ...DEFAULT_TALK_FILTER,
  ...partial,
})

/* ------------------------------------------------------------------ */
/* Bereits eingeplant – oder längst gehalten                           */
/* ------------------------------------------------------------------ */

test('eine gehaltene Ansprache ist keine Einplanung', () => {
  // Der Fall aus der Liste: zuletzt vor Jahren gesprochen, seither nichts.
  const ids = plannedTalkMemberIds([talk('m1', '2021-01-24')], JETZT)
  assert.equal(ids.has('m1'), false)
})

test('wer für einen kommenden Sonntag eingetragen ist, zählt – in jedem Status', () => {
  for (const status of ['planned', 'asked', 'confirmed'] as Talk['status'][]) {
    const ids = plannedTalkMemberIds([talk('m1', '2026-08-23', status)], JETZT)
    assert.equal(ids.has('m1'), true, status)
  }
})

test('am Sonntag selbst gilt die Ansprache noch als eingeplant', () => {
  // Gezählt wird ab Tagesbeginn: Anfragen würde man an diesem Tag ohnehin
  // niemanden mehr, ob die Versammlung nun vorbei ist oder nicht.
  const ids = plannedTalkMemberIds([talk('m1', '2026-08-05')], JETZT)
  assert.equal(ids.has('m1'), true)
})

test('ein vergangener, nie abgeschlossener Eintrag hält niemanden fest', () => {
  // «Vorgesehen» für einen Sonntag, der vorbei ist: Der Platz ist Geschichte,
  // die Person darf wieder angefragt werden.
  const ids = plannedTalkMemberIds([talk('m1', '2026-06-14', 'planned')], JETZT)
  assert.equal(ids.has('m1'), false)
})

test('ein von Hand erfasster Name gehört zu keinem Mitglied', () => {
  const ids = plannedTalkMemberIds([talk('', '2026-08-23')], JETZT)
  assert.equal(ids.size, 0)
})

/* ------------------------------------------------------------------ */
/* Die Bewertung                                                       */
/* ------------------------------------------------------------------ */

test('wer vor Jahren gesprochen hat, steht wieder zur Verfügung', () => {
  const members = [member('m1', { lastTalkDate: new Date('2021-01-24') as never })]
  const [candidate] = rankTalkCandidates(members, [talk('m1', '2021-01-24')], { now: JETZT })

  assert.equal(candidate.alreadyPlanned, false)
  assert.equal(candidate.lastTalkYear, 2021)
})

test('eine kommende Zusage schiebt nach hinten, ohne zu verstecken', () => {
  const members = [member('m1'), member('m2')]
  const ranked = rankTalkCandidates(members, [talk('m1', '2026-08-23', 'asked')], { now: JETZT })

  assert.deepEqual(
    ranked.map((c) => c.member.id),
    ['m2', 'm1'],
  )
  assert.equal(ranked[1].alreadyPlanned, true)
})

test('noch nie gesprochen wiegt schwerer als ein gewöhnlicher Abstand', () => {
  // 30 Monate sind weit über der Schwelle und trotzdem weniger dringend als
  // «war noch gar nie dran» (dort zählt `gapMonths * 2 + 24`).
  const members = [member('lange', { lastTalkDate: monateZurueck(30) as never }), member('nie')]
  const ranked = rankTalkCandidates(members, [], { now: JETZT })

  assert.deepEqual(
    ranked.map((c) => c.member.id),
    ['nie', 'lange'],
  )
})

test('wer nicht angefragt werden darf, kommt gar nicht erst vor', () => {
  const members = [member('m1', { availableForTalks: false })]
  assert.equal(rankTalkCandidates(members, [], { now: JETZT }).length, 0)
})

test('Mindestalter und «nur Aktive» entscheiden, wer bewertet wird', () => {
  const members = [
    member('kind', { birthDate: jahreAlt(8) as never }),
    member('inaktiv', { status: 'inactive' }),
    member('erwachsen', { birthDate: jahreAlt(40) as never }),
  ]

  const streng = rankTalkCandidates(members, [], { minAge: 12, onlyActive: true, now: JETZT })
  assert.deepEqual(
    streng.map((c) => c.member.id),
    ['erwachsen'],
  )

  const offen = rankTalkCandidates(members, [], { minAge: 0, onlyActive: false, now: JETZT })
  assert.equal(offen.length, 3)
})

test('ohne Geburtsdatum bleibt jemand in der Liste', () => {
  // Ein fehlendes Datum ist kein Grund, jemanden zu übergehen.
  const ranked = rankTalkCandidates([member('m1')], [], { minAge: 12, now: JETZT })
  assert.equal(ranked.length, 1)
  assert.equal(ranked[0].age, null)
})

test('Zurückgestellte stehen zuunterst', () => {
  const members = [
    member('zurueck', { talkHold: true }),
    member('offen', { lastTalkDate: new Date('2024-01-01') as never }),
  ]
  const ranked = rankTalkCandidates(members, [], { now: JETZT })

  assert.deepEqual(
    ranked.map((c) => c.member.id),
    ['offen', 'zurueck'],
  )
  assert.equal(ranked[1].onHold, true)
})

/* ------------------------------------------------------------------ */
/* Die Filter                                                          */
/* ------------------------------------------------------------------ */

test('Zurückgestellte sind ausgeblendet, bis der Haken sie holt', () => {
  const liste = [kandidat({ member: member('m1'), onHold: true })]

  assert.equal(filterTalkCandidates(liste, filter(), 18).length, 0)
  assert.equal(filterTalkCandidates(liste, filter({ showOnHold: true }), 18).length, 1)
})

test('«nur seit über X Monaten» lässt die Kurzfristigen weg', () => {
  const liste = [
    kandidat({ member: member('frisch'), monthsSince: 4, lastTalkYear: 2026 }),
    kandidat({ member: member('lange'), monthsSince: 40, lastTalkYear: 2023 }),
    kandidat({ member: member('nie') }),
  ]

  assert.deepEqual(
    filterTalkCandidates(liste, filter(), 18).map((c) => c.member.id),
    ['lange', 'nie'],
  )
  assert.equal(filterTalkCandidates(liste, filter({ onlyOverdue: false }), 18).length, 3)
})

test('eine gewählte Jahrzahl sticht «nur seit über X Monaten»', () => {
  // Wer 2026 gesprochen hat, ist nicht überfällig – sonst wäre die Frage
  // «wer sprach 2026?» gar nicht zu stellen.
  const liste = [
    kandidat({ member: member('frisch'), monthsSince: 4, lastTalkYear: 2026 }),
    kandidat({ member: member('lange'), monthsSince: 40, lastTalkYear: 2023 }),
  ]

  assert.deepEqual(
    filterTalkCandidates(liste, filter({ years: [2026] }), 18).map((c) => c.member.id),
    ['frisch'],
  )
})

test('mehrere Jahre lassen sich zusammen wählen', () => {
  const liste = [
    kandidat({ member: member('a'), monthsSince: 20, lastTalkYear: 2024 }),
    kandidat({ member: member('b'), monthsSince: 8, lastTalkYear: 2025 }),
    kandidat({ member: member('c'), monthsSince: 60, lastTalkYear: 2021 }),
  ]

  assert.deepEqual(
    filterTalkCandidates(liste, filter({ years: [2024, 2025] }), 18).map((c) => c.member.id),
    ['a', 'b'],
  )
})

test('«noch nie gesprochen» ist eine Jahrzahl wie jede andere', () => {
  const liste = [
    kandidat({ member: member('nie') }),
    kandidat({ member: member('2024'), monthsSince: 20, lastTalkYear: 2024 }),
  ]

  assert.deepEqual(
    filterTalkCandidates(liste, filter({ years: [NEVER_SPOKE] }), 18).map((c) => c.member.id),
    ['nie'],
  )
})

test('nach Geschlecht eingrenzen', () => {
  const liste = [
    kandidat({ member: member('frau', { gender: 'f' }) }),
    kandidat({ member: member('mann', { gender: 'm' }) }),
    kandidat({ member: member('unbekannt') }),
  ]

  assert.deepEqual(
    filterTalkCandidates(liste, filter({ gender: 'f' }), 18).map((c) => c.member.id),
    ['frau'],
  )
  assert.deepEqual(
    filterTalkCandidates(liste, filter({ gender: 'm' }), 18).map((c) => c.member.id),
    ['mann'],
  )
  assert.equal(filterTalkCandidates(liste, filter(), 18).length, 3)
})

test('die Namenssuche findet über beide Schreibweisen eines Umlauts', () => {
  const liste = [kandidat({ member: member('m1', { firstName: 'Jürg', lastName: 'Müller' }) })]

  assert.equal(filterTalkCandidates(liste, filter({ search: 'muell' }), 18).length, 1)
  assert.equal(filterTalkCandidates(liste, filter({ search: 'Jürg Müller' }), 18).length, 1)
  assert.equal(filterTalkCandidates(liste, filter({ search: 'Meier' }), 18).length, 0)
})

/* ------------------------------------------------------------------ */
/* Die Auswahl im Menü                                                 */
/* ------------------------------------------------------------------ */

test('zur Wahl stehen nur Jahre, die auch vorkommen – das jüngste zuerst', () => {
  const liste = [
    kandidat({ member: member('a'), lastTalkYear: 2021 }),
    kandidat({ member: member('b'), lastTalkYear: 2025 }),
    kandidat({ member: member('c'), lastTalkYear: 2021 }),
    kandidat({ member: member('nie') }),
  ]

  assert.deepEqual(talkYearOptions(liste), [NEVER_SPOKE, 2025, 2021])
})

test('ohne «noch nie» führt das jüngste Jahr die Auswahl an', () => {
  const liste = [kandidat({ member: member('a'), lastTalkYear: 2024 })]
  assert.deepEqual(talkYearOptions(liste), [2024])
})

test('der Knopf zählt, was von der Voreinstellung abweicht', () => {
  assert.equal(activeTalkFilterCount(DEFAULT_TALK_FILTER), 0)
  // Die Namenssuche zählt nicht mit – sie steht sichtbar daneben.
  assert.equal(activeTalkFilterCount(filter({ search: 'Meier' })), 0)
  assert.equal(activeTalkFilterCount(filter({ gender: 'f' })), 1)
  assert.equal(activeTalkFilterCount(filter({ gender: 'f', years: [2024], showOnHold: true })), 3)
  assert.equal(activeTalkFilterCount(filter({ onlyOverdue: false, minAge: false })), 2)
})
