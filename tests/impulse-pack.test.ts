import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { format } from 'date-fns'
import {
  deckOrder,
  puzzlePieces,
  puzzleSolution,
  readyProblems,
  weekEnd,
  weekKeyOffset,
  weekStart,
} from '../src/lib/impulse.ts'
import {
  deckOrders,
  isPackItem,
  PACK_CORRECTIONS,
  PACK_RETIRED,
  PACK_ID_PREFIX,
  PACK_WEEKS,
  packWeekPlans,
  planPackCorrections,
  planPackRetirements,
  planPackItems,
} from '../src/lib/impulsePack.ts'
import { impulseVideoSource } from '../src/lib/impulseVideo.ts'
import { SITE_URL } from '../src/lib/sharePreview.ts'
import { IMPULSE_CREST_PALETTE_LABELS, IMPULSE_CREST_SYMBOL_LABELS } from '../src/lib/types.ts'

/*
 * Das Themenpaket nach dem Leitfaden «Für eine starke Jugend».
 *
 * Es verspricht «bereit» – also muss jeder seiner Inhalte die Prüfung
 * bestehen, die auch das Redaktionsformular anwendet. Dazu die Zusagen,
 * von denen die Woche lebt: Jede Woche endet mit dem Sonntag ihrer
 * Lektion, trägt Lektion und Wappen, und ihr Feed wechselt den Takt.
 * Die festen IDs halten einen zweiten Lauf frei von Dubletten.
 */

const ALL = PACK_WEEKS.flatMap(packWeekPlans)

test('Themenpaket: sieben Wochen am Stück, vom 5. Oktober bis 22. November 2026', () => {
  assert.deepEqual(
    PACK_WEEKS.map((week) => week.week),
    ['2026-W41', '2026-W42', '2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47'],
  )
  for (const [index, week] of PACK_WEEKS.entries()) {
    if (index === 0) continue
    assert.equal(weekKeyOffset(PACK_WEEKS[index - 1].week, 1), week.week)
  }
  assert.equal(format(weekStart('2026-W41')!, 'yyyy-MM-dd'), '2026-10-05')
})

test('Themenpaket: jede Woche endet mit dem Sonntag ihrer Lektion', () => {
  /* Die Sonntage aus dem Heft Oktober 2026: 2., 3. und letzter Sonntag im
     Oktober, dann Fastsonntag, 2., 3. und letzter Sonntag im November. */
  const sundays = PACK_WEEKS.map((week) => format(weekEnd(week.week)!, 'yyyy-MM-dd'))
  assert.deepEqual(sundays, [
    '2026-10-11',
    '2026-10-18',
    '2026-10-25',
    '2026-11-01',
    '2026-11-08',
    '2026-11-15',
    '2026-11-22',
  ])
  assert.equal(PACK_WEEKS[0].theme.lesson.label, 'Erfahre mehr über das Wort der Weisheit')
  assert.equal(PACK_WEEKS[1].theme.lesson.label, 'Erfahre mehr über das Gesetz der Keuschheit')
  assert.equal(PACK_WEEKS[4].theme.lesson.label, 'Erfahre mehr über das Schriftstudium')
  assert.equal(PACK_WEEKS[5].theme.lesson.label, 'Erfahre mehr über die Suche nach Wahrheit')
})

test('Themenpaket: Wochenthema mit Monatszeile, Lektion samt Link und Wappen', () => {
  for (const week of PACK_WEEKS) {
    const theme = week.theme
    assert.ok(theme.kicker.trim(), `${week.week}: Zeile über dem Titel fehlt`)
    assert.ok(theme.lesson.label.trim(), `${week.week}: Lektion fehlt`)
    assert.ok(
      theme.lesson.url.startsWith('https://www.churchofjesuschrist.org/'),
      `${week.week}: Lektion ohne Link`,
    )
    assert.ok(theme.crest.symbol in IMPULSE_CREST_SYMBOL_LABELS, `${week.week}: Zeichen`)
    assert.ok(theme.crest.palette in IMPULSE_CREST_PALETTE_LABELS, `${week.week}: Farbe`)
    assert.ok(
      theme.crest.motto.trim().length > 0 && theme.crest.motto.length <= 32,
      `${week.week}: Spruch`,
    )
  }
  // Jede Woche sieht anders aus: keine zwei Wappen mit derselben Farbe hintereinander.
  for (let index = 1; index < PACK_WEEKS.length; index += 1) {
    assert.notEqual(
      PACK_WEEKS[index].theme.crest.palette,
      PACK_WEEKS[index - 1].theme.crest.palette,
    )
  }
})

test('Themenpaket: jeder Inhalt ist bereit und vollständig', () => {
  for (const plan of ALL) {
    assert.equal(plan.status, 'ready', plan.id)
    assert.deepEqual(readyProblems(plan), [], `${plan.id}: ${readyProblems(plan).join(' ')}`)
  }
})

test('Themenpaket: feste, eindeutige IDs mit Vorsilbe', () => {
  const ids = ALL.map((plan) => plan.id)
  assert.equal(new Set(ids).size, ids.length, 'doppelte ID')
  for (const id of ids) {
    assert.ok(id.startsWith(PACK_ID_PREFIX), id)
    assert.ok(isPackItem(id), id)
  }
  assert.ok(ids.includes('fsy26-w41-impuls'))
  assert.ok(ids.includes('fsy26-w41-umfrage-1'))
  assert.ok(ids.includes('fsy26-w47-teilen'))
  assert.equal(isPackItem('starter-w1-impuls'), false)
})

test('Themenpaket: der Feed wechselt den Takt – und endet mit der Teilen-Aufgabe', () => {
  for (const week of PACK_WEEKS) {
    const active = week.deck.filter((card) => !card.retired)
    // Nach der Teilen-Aufgabe darf nur noch das Video stehen, das ins Minispiel einführt.
    const deck = week.game && active.at(-1)?.kind === 'video' ? active.slice(0, -1) : active
    const kinds = deck.map((card) => card.kind)
    assert.equal(kinds.at(-1), 'teilen', `${week.week}: Teilen-Aufgabe nicht zuletzt`)
    assert.equal(kinds.filter((kind) => kind === 'teilen').length, 1, week.week)
    for (const kind of ['umfrage', 'quiz', 'puzzle', 'frage'] as const) {
      assert.ok(kinds.includes(kind), `${week.week}: keine Karte der Art ${kind}`)
    }
    // Und eine Geschichte – als Textkarte oder als Video.
    assert.ok(kinds.includes('feed') || kinds.includes('video'), `${week.week}: keine Geschichte`)
    // Eine Skala und ein «Was würdest du tun?» gehören zu jeder Woche.
    assert.ok(
      week.deck.some((card) => card.poll?.form === 'scale'),
      `${week.week}: keine Skala`,
    )
    assert.ok(
      week.deck.some(
        (card) => card.poll?.form === 'choice' && card.title.startsWith('Was würdest du tun?'),
      ),
      `${week.week}: kein «Was würdest du tun?»`,
    )
    // Nie zwei gleiche Arten direkt hintereinander – ausser Videos: Auf einen Short der
    // Kirche darf das eigene Video folgen, das die nächste Karte einführt.
    for (let index = 1; index < kinds.length; index += 1) {
      if (kinds[index] === 'video') continue
      assert.notEqual(
        kinds[index],
        kinds[index - 1],
        `${week.week}: zweimal ${kinds[index]} am Stück`,
      )
    }
    const keys = week.deck.map((card) => card.key)
    assert.equal(new Set(keys).size, keys.length, `${week.week}: doppelter Schlüssel`)
  }
})

test('Themenpaket: die Wochen bis zum Schriftstudium enden mit ihrem Minispiel – jede mit einem eigenen', () => {
  const expected = [
    ['2026-W41', 'fsy26-w41-spiel', 'sortieren'],
    ['2026-W42', 'fsy26-w42-spiel', 'abwehren'],
    ['2026-W43', 'fsy26-w43-spiel', 'springen'],
    ['2026-W44', 'fsy26-w44-spiel', 'befreien'],
    ['2026-W45', 'fsy26-w45-spiel', 'stapeln'],
  ] as const
  for (const [weekKey, id, game] of expected) {
    const week = PACK_WEEKS.find((entry) => entry.week === weekKey)!
    const last = packWeekPlans(week).at(-1)!
    assert.equal(last.id, id)
    assert.equal(last.kind, 'spiel')
    assert.equal(last.game, game)
    assert.equal(last.status, 'ready')
    // Nach allen Karten – auf dem Platz, den es schon in der Datenbank hat:
    // Nachgereichte Karten verschieben ihn nicht.
    const places = week.deck.filter((card) => !card.late).length
    assert.equal(last.order, places + 1, `${weekKey}: nach allen Karten`)
    assert.ok(!`${last.title} ${last.body}`.includes('ß'), `${weekKey}: Schweizer Schreibweise`)
  }
  // Höchstens ein Minispiel je Woche – und nur dort, wo das Paket eines vorsieht.
  for (const week of PACK_WEEKS) {
    const games = packWeekPlans(week).filter((plan) => plan.kind === 'spiel')
    assert.ok(games.length <= 1, week.week)
    assert.equal(games.length, week.game ? 1 : 0, week.week)
  }
  // Kein Spiel zweimal: Jede Woche bringt einen neuen Griff.
  const games = PACK_WEEKS.flatMap((week) => (week.game ? [week.game.game] : []))
  assert.equal(new Set(games).size, games.length)
})

test('Themenpaket: ein schon eingespieltes Paket holt die neuen Minispiele nach – nur sie', () => {
  /* So kam schon «Gut für dich?» in den Bereich: Das Paket lag längst in
     der Datenbank, der Kasten «Themenpaket» bot danach genau das Fehlende
     an. Mitten in der Woche zum Gesetz der Keuschheit fehlen die Spiele
     dieser und der zwei folgenden Wochen – die vergangene bleibt weg. */
  const before = PACK_WEEKS.flatMap(packWeekPlans).filter(
    (plan) => !['fsy26-w42-spiel', 'fsy26-w43-spiel', 'fsy26-w44-spiel'].includes(plan.id),
  )
  assert.deepEqual(
    planPackItems(before, '2026-W42').map((plan) => [plan.id, plan.game]),
    [
      ['fsy26-w42-spiel', 'abwehren'],
      ['fsy26-w43-spiel', 'springen'],
      ['fsy26-w44-spiel', 'befreien'],
    ],
  )
})

test('Themenpaket: der Feed liegt im Bereich genau in der Reihenfolge des Pakets', () => {
  for (const week of PACK_WEEKS) {
    const plans = packWeekPlans(week).filter(
      (plan) => plan.kind !== 'wochenziel' && plan.kind !== 'tageschallenge',
    )
    // Gemischt hereingegeben, wie die Datenbank sie liefert …
    const shuffled = [...plans].reverse()
    // … und vom Feed wieder in die Ordnung des Pakets gelegt.
    assert.deepEqual(
      deckOrder(shuffled).map((plan) => plan.id),
      plans.map((plan) => plan.id),
      week.week,
    )
  }
})

test('deckOrders: eine nachgereichte Karte schiebt sich dazwischen – keine rückt', () => {
  const late = { late: true } as const
  assert.deepEqual(deckOrders([{}, {}, {}]), [1, 2, 3])
  assert.deepEqual(deckOrders([{}, late, {}, {}, late]), [1, 1.5, 2, 3, 3.5])
  // Zwei hintereinander teilen sich die Lücke, statt denselben Platz zu nehmen.
  assert.deepEqual(deckOrders([{}, late, late, {}]), [1, 1.5, 1.75, 2])
  assert.deepEqual(deckOrders([late, {}]), [0.5, 1])
})

/* ------------------------------------------------------------------ */
/* YouTube-Shorts der Kirche                                           */
/* ------------------------------------------------------------------ */

const SHORTS = ALL.filter((plan) => plan.kind === 'video')

/** Die Wochen mit eigenen Shorts – vor jedem interaktiven Element eines. */
const SHORT_WEEKS = ['2026-W43', '2026-W44', '2026-W45']

test('Shorts: die Wochen zu Helamans jungen Kriegern, zur Wahrheit und zum Schriftstudium tragen sie – und nur sie', () => {
  assert.deepEqual(
    [...new Set(SHORTS.map((plan) => plan.week))],
    SHORT_WEEKS,
    'Shorts nur in den Wochen, für die sie gemacht sind',
  )
})

/** Die eigenen Shorts der App: Videodateien unter `public/shorts/`. */
const OWN_SHORTS = SHORTS.filter((plan) => impulseVideoSource(plan.videoUrl)?.art === 'datei')
const CHURCH_SHORTS = SHORTS.filter((plan) => !OWN_SHORTS.includes(plan))

test('Shorts: jeder ist ein YouTube-Short der Kirche – ein Wisch, ohne Text darüber', () => {
  const ids = new Set<string>()
  for (const plan of CHURCH_SHORTS) {
    const video = impulseVideoSource(plan.videoUrl)
    assert.ok(video?.art === 'youtube' && video.short, `${plan.id}: kein YouTube-Short`)
    assert.match(video.id, /^[\w-]{11}$/, plan.id)
    ids.add(video.id)
    assert.equal(plan.videoTextPage, false, plan.id)
    // Die Quelle führt auf den Short selbst und sagt, woher er kommt.
    assert.equal(plan.source?.url, plan.videoUrl, plan.id)
    assert.match(plan.source?.label ?? '', /Kirche/, plan.id)
    assert.ok(plan.body.trim(), `${plan.id}: ohne Satz dazu`)
  }
  assert.equal(ids.size, CHURCH_SHORTS.length, 'ein Short doppelt')
  // Andere Arten tragen kein Video.
  for (const plan of ALL.filter((entry) => entry.kind !== 'video')) {
    assert.equal(plan.videoUrl, null, plan.id)
    assert.equal(plan.videoTextPage, null, plan.id)
  }
})

test('Shorts der Kirche: von der Redaktion gelöscht – das Paket bietet sie nicht wieder an', () => {
  assert.deepEqual(CHURCH_SHORTS, [])
  // Im Deck stehen sie als ersetzt, damit kein Platz rückt (`deckOrders`).
  const week = PACK_WEEKS.find((entry) => entry.week === '2026-W43')!
  const church = week.deck.filter((card) => card.key.startsWith('short-'))
  assert.equal(church.length, 6)
  for (const card of church) assert.ok(card.retired && card.late, card.key)
  // Und «Einspielen» schlägt sie nicht vor, auch wenn sie in der Datenbank fehlen.
  const plans = planPackItems([], '2026-W43').map((plan) => plan.id)
  for (const card of church) assert.ok(!plans.includes(`fsy26-w43-${card.key}`), card.key)
})

test('Eigene Shorts: Videodateien der App – liegen bereit und spielen ohne Text darüber', () => {
  assert.deepEqual(
    OWN_SHORTS.map((plan) => plan.id.replace(PACK_ID_PREFIX, '')),
    [
      'w43-eigen-held',
      'w43-eigen-schwerter',
      'w43-eigen-brief',
      'w43-eigen-fall',
      'w43-eigen-show',
      'w43-eigen-lockvogel',
      'w43-eigen-puzzle',
      'w43-eigen-liste',
      'w43-eigen-monat',
      'w43-eigen-staffel',
      'w43-eigen-spiel',
      'w44-eigen-chat',
      'w44-eigen-wahrheit',
      'w44-eigen-abinadi',
      'w44-eigen-mars',
      'w44-eigen-item',
      'w44-eigen-korihor',
      'w44-eigen-ester',
      'w44-eigen-traum',
      'w44-eigen-petrus',
      'w44-eigen-spiel',
      'w45-eigen-platten',
      'w45-eigen-wueste',
      'w45-eigen-josia',
      'w45-eigen-moroni',
      'w45-eigen-feed',
      'w45-eigen-festmahl',
      'w45-eigen-josua',
      'w45-eigen-emmaus',
      'w45-eigen-enos',
      'w45-eigen-spiel',
    ],
  )
  const files = new Set<string>()
  for (const plan of OWN_SHORTS) {
    const url = new URL(plan.videoUrl!)
    // Von der eigenen Seite, aus public/shorts – die Datei muss im Repo liegen.
    assert.equal(url.origin, SITE_URL, plan.id)
    assert.match(url.pathname, /^\/shorts\/[\w-]+\.mp4$/, plan.id)
    assert.ok(fs.existsSync(path.join('public', url.pathname)), `${plan.id}: ${url.pathname} fehlt`)
    files.add(url.pathname)
    assert.equal(plan.videoTextPage, false, plan.id)
    // Die Quelle ist die Schriftstelle oder das Heft, um das es geht.
    assert.ok(plan.source?.url, plan.id)
    assert.ok(plan.body.trim(), `${plan.id}: ohne Satz dazu`)
  }
  assert.equal(files.size, OWN_SHORTS.length, 'eine Datei doppelt')
  // Keine Videodatei liegt ungenutzt im Repo – jede kostet Platz in jedem Deploy.
  const stored = fs.readdirSync(path.join('public', 'shorts')).map((name) => `/shorts/${name}`)
  assert.deepEqual(stored.sort(), [...files].sort())
})

test('Wochen mit eigenen Shorts: vor jedem interaktiven Element ein eigenes Video, das es einführt', () => {
  for (const key of SHORT_WEEKS) {
    const week = PACK_WEEKS.find((entry) => entry.week === key)!
    const feed = deckOrder(
      packWeekPlans(week).filter(
        (plan) => plan.kind !== 'wochenziel' && plan.kind !== 'tageschallenge',
      ),
    )
    const own = new Set(OWN_SHORTS.filter((plan) => plan.week === key).map((plan) => plan.id))
    const interactive = feed.filter((plan) => !['impuls', 'video', 'feed'].includes(plan.kind))
    assert.ok(interactive.length >= 10, `${key}: ${interactive.length} interaktive Elemente`)
    for (const plan of interactive) {
      const before = feed[feed.indexOf(plan) - 1]
      assert.ok(before && own.has(before.id), `${plan.id}: davor ${before?.id ?? 'nichts'}`)
    }
    // Und jedes eigene Video steht direkt vor einem interaktiven Element.
    for (const id of own) {
      const next = feed[feed.findIndex((plan) => plan.id === id) + 1]
      assert.ok(next && interactive.includes(next), `${id}: danach ${next?.id ?? 'nichts'}`)
    }
    // Keine Textkarte mehr ohne Interaktion – nur das Wochenthema, das das Wappen trägt.
    assert.deepEqual(
      feed.filter((plan) => plan.kind === 'feed').map((plan) => plan.id),
      [],
      key,
    )
  }
})

test('Shorts: eine schon eingespielte Woche holt sie nach – und keine Karte rückt', () => {
  /* So steht es in der Datenbank: das Paket ohne die Shorts, die Karten
     auf ihren ganzen Plätzen (W43: 1 bis 13, W44: 1 bis 12, W45: 1 bis 12),
     das Minispiel direkt dahinter – in der Woche zum Schriftstudium kam es
     erst mit den Shorts, zusammen mit dem Quiz, das die eiserne Stange
     ablöst. */
  for (const [key, places, retiredCards, added] of [
    ['2026-W43', 14, ['feed-1', 'feed-2', 'feed-3'], []],
    ['2026-W44', 13, ['feed-1', 'feed-2', 'feed-3'], []],
    ['2026-W45', 12, ['feed-1', 'feed-2', 'feed-3', 'quiz-1'], ['quiz-4', 'spiel']],
  ] as const) {
    const week = PACK_WEEKS.find((entry) => entry.week === key)!
    const tag = key.slice(-3).toLowerCase()
    const id = (card: string) => `${PACK_ID_PREFIX}${tag}-${card}`
    const newIds = new Set<string>(added.map(id))
    // Damals noch mit den Karten, die inzwischen ersetzt sind
    const original = { ...week, deck: week.deck.map((card) => ({ ...card, retired: undefined })) }
    const stored = packWeekPlans(original).filter(
      (plan) => plan.kind !== 'video' && !newIds.has(plan.id),
    )
    assert.deepEqual(
      stored.filter((plan) => plan.order !== null && plan.order > 0).map((plan) => plan.order),
      Array.from({ length: places }, (_, index) => index + 1),
      key,
    )

    const plans = planPackItems(stored, key)
    const missing = plans.filter((plan) => plan.week === key)
    assert.deepEqual(
      missing.map((plan) => plan.id).sort(),
      [...SHORTS.filter((plan) => plan.week === key).map((plan) => plan.id), ...newIds].sort(),
      key,
    )
    // Jeder Short (und das neue Quiz) liegt zwischen zwei Karten, nie auf dem Platz einer
    // anderen – das Minispiel hinter der letzten.
    for (const plan of missing)
      if (plan.kind === 'spiel') assert.equal(plan.order, places + 1, plan.id)
      else assert.ok(!Number.isInteger(plan.order), plan.id)

    // Zusammen – und mit den ersetzten Karten zurückgestellt – ergibt das genau
    // den Feed, den ein frisch eingespieltes Paket legt.
    const retired = new Set(planPackRetirements(stored).map((entry) => entry.id))
    assert.deepEqual([...retired].sort(), retiredCards.map(id).sort(), key)
    const feed = (entries: typeof stored) =>
      deckOrder(
        entries.filter((plan) => plan.kind !== 'wochenziel' && plan.kind !== 'tageschallenge'),
      ).map((plan) => plan.id)
    assert.deepEqual(
      feed([...stored.filter((plan) => !retired.has(plan.id)), ...missing].reverse()),
      feed(packWeekPlans(week)),
      key,
    )
  }
})

test('Themenpaket: Wochenziel und Tages-Challenge sind Kacheln, keine Feed-Karten', () => {
  for (const week of PACK_WEEKS) {
    const plans = packWeekPlans(week)
    assert.equal(plans.filter((plan) => plan.kind === 'wochenziel').length, 1, week.week)
    assert.equal(plans.filter((plan) => plan.kind === 'tageschallenge').length, 1, week.week)
    for (const plan of plans) {
      if (plan.kind === 'wochenziel' || plan.kind === 'tageschallenge')
        assert.equal(plan.order, null)
      else assert.equal(typeof plan.order, 'number', plan.id)
    }
  }
})

test('Themenpaket: Umfragen und Quizfragen sind in sich stimmig', () => {
  for (const plan of ALL) {
    if (plan.poll?.form === 'choice') {
      assert.ok(plan.poll.options.length >= 2 && plan.poll.options.length <= 6, plan.id)
      assert.ok(plan.poll.explanation.trim(), `${plan.id}: Umfrage ohne Gedanken danach`)
    }
    if (plan.poll?.form === 'scale') {
      assert.ok(plan.poll.min < plan.poll.max, plan.id)
      assert.ok(
        plan.poll.minLabel.trim() && plan.poll.maxLabel.trim(),
        `${plan.id}: Enden ohne Namen`,
      )
    }
    if (plan.quiz?.form === 'choice') {
      assert.ok(
        plan.quiz.answerIndex >= 0 && plan.quiz.answerIndex < plan.quiz.options.length,
        plan.id,
      )
      assert.ok(plan.quiz.explanation.trim(), `${plan.id}: Quiz ohne Auflösung`)
    }
    if (plan.kind === 'quiz') assert.ok(plan.quiz, plan.id)
    if (plan.kind === 'umfrage') assert.ok(plan.poll, plan.id)
    if (plan.kind === 'puzzle') assert.ok(plan.puzzle, plan.id)
  }
})

test('Themenpaket: die Vers-Puzzles bauen ihren Vers', () => {
  for (const plan of ALL.filter((entry) => entry.kind === 'puzzle')) {
    const pieces = puzzlePieces(plan.puzzle!.text)
    assert.ok(pieces.length >= 6, `${plan.id}: nur ${pieces.length} Teile`)
    assert.ok(plan.source, `${plan.id}: ohne Fundstelle`)
  }
  const warriors = ALL.find((plan) => plan.id === 'fsy26-w43-puzzle-1')!
  assert.equal(
    puzzleSolution(warriors.puzzle!.text),
    'zu allen Zeiten und in allem, was ihnen anvertraut war, treu',
  )
})

test('Themenpaket: jede Feed-Karte trägt ihr Emoji', () => {
  for (const plan of ALL) assert.ok(plan.emoji?.trim(), `${plan.id}: ohne Emoji`)
})

test('Themenpaket: Schweizer Schreibweise – kein «ß»', () => {
  for (const plan of ALL) {
    const text = JSON.stringify(plan)
    assert.ok(!text.includes('ß'), `${plan.id} schreibt «ß»`)
  }
})

test('planPackItems: vergangene Wochen bleiben weg', () => {
  const fromStart = planPackItems([], '2026-W41')
  assert.equal(fromStart.length, ALL.length)
  const later = planPackItems([], '2026-W43')
  assert.deepEqual(
    [...new Set(later.map((plan) => plan.week))],
    ['2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47'],
  )
  assert.deepEqual(planPackItems([], '2026-W48'), [])
  // Wer früher einspielt, bekommt alle Wochen – geplant ist geplant.
  assert.equal(planPackItems([], '2026-W40').length, ALL.length)
})

test('planPackItems: holt nur nach, was fehlt – und überschreibt nichts', () => {
  const existing = ALL.slice(0, 10).map((plan) => ({ id: plan.id }))
  const plans = planPackItems(existing, '2026-W41')
  assert.equal(plans.length, ALL.length - 10)
  assert.ok(plans.every((plan) => !existing.some((entry) => entry.id === plan.id)))
  assert.deepEqual(
    planPackItems(
      ALL.map((plan) => ({ id: plan.id })),
      '2026-W41',
    ),
    [],
  )
})

/* ------------------------------------------------------------------ */
/* Weniger «für den Sonntag vorbereiten»                               */
/* ------------------------------------------------------------------ */

/** Die Texte einer Karte, die die Jugendlichen lesen. */
const textsOf = (plan: (typeof ALL)[number]) =>
  [plan.title, plan.body, plan.deepening ?? '', plan.puzzle?.explanation ?? ''].join('\n')

test('Themenpaket: keine Vorbereitung auf den Sonntag, nichts zum Mitbringen', () => {
  const sundayPrep =
    /vorbereitet|bereit für (den )?Sonntag|am Sonntag mit\b|Am Sonntag (geht es|lernt|könnt)|am Sonntag etwas zu sagen|am Fastsonntag sprechen|beginnt der Fastsonntag/i
  for (const plan of ALL) {
    assert.doesNotMatch(textsOf(plan), sundayPrep, plan.id)
  }
})

test('Korrekturen: der neue Text steht auch im Paket – ein frischer Lauf spielt ihn gleich ein', () => {
  const plans = new Map(PACK_WEEKS.flatMap(packWeekPlans).map((entry) => [entry.id, entry]))
  for (const correction of PACK_CORRECTIONS) {
    const entry = plans.get(correction.id)
    assert.ok(entry, `${correction.id} gehört nicht zum Paket`)
    assert.equal(entry[correction.field], correction.to)
    assert.notEqual(correction.from, correction.to)
  }
})

test('Korrekturen: nur wo noch der alte Text steht – Bearbeitetes bleibt', () => {
  const correction = PACK_CORRECTIONS[0]
  const item = (title: string) => ({ id: correction.id, title, body: '' })
  assert.deepEqual(planPackCorrections([item(correction.from)]), [correction])
  // Schon übernommen, von der Redaktion selbst geändert oder gar nicht eingespielt: nichts.
  assert.deepEqual(planPackCorrections([item(correction.to)]), [])
  assert.deepEqual(planPackCorrections([item('Eigener Text der Redaktion')]), [])
  assert.deepEqual(planPackCorrections([]), [])
})

test('Ersetzte Karten: das Paket führt sie nicht mehr – und stellt nur zurück, was noch bereit ist', () => {
  const ids = new Set(PACK_WEEKS.flatMap(packWeekPlans).map((entry) => entry.id))
  assert.ok(PACK_RETIRED.length > 0)
  for (const retirement of PACK_RETIRED) {
    assert.ok(!ids.has(retirement.id), `${retirement.id} steht noch im Paket`)
    assert.ok(retirement.reason.trim(), retirement.id)
  }
  assert.equal(new Set(PACK_RETIRED.map((entry) => entry.id)).size, PACK_RETIRED.length, 'doppelt')
  // Dazu gehören die Textkarten, an deren Stelle ein Video getreten ist.
  for (const key of ['feed-1', 'feed-2', 'feed-3'])
    assert.match(
      PACK_RETIRED.find((entry) => entry.id === `fsy26-w43-${key}`)?.reason ?? '',
      /Video/,
    )

  const [first, second] = PACK_RETIRED
  const items = [
    { id: first.id, status: 'ready' as const },
    { id: second.id, status: 'draft' as const },
    { id: 'fsy26-w43-umfrage-1', status: 'ready' as const },
  ]
  // Nur die eine, die noch im Feed steht – Entwürfe und Karten des Pakets bleiben unberührt.
  assert.deepEqual(planPackRetirements(items), [first])
  assert.deepEqual(planPackRetirements([]), [])
})

test('Teilen in der Woche zum Wort der Weisheit: gefragt ist jemand aus dem Umfeld', () => {
  const teilen = PACK_WEEKS.flatMap(packWeekPlans).find((entry) => entry.id === 'fsy26-w41-teilen')
  assert.match(teilen?.title ?? '', /jemanden in deinem Umfeld/)
  assert.doesNotMatch(teilen?.title ?? '', /Eltern|Grosseltern/)
})
