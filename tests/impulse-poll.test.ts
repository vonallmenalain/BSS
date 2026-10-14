import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cleanPollText,
  matchPollText,
  POLL_CUSTOM_MAX,
  pollAllowsCustom,
  pollChoiceId,
  pollHiddenEntries,
  pollRowsShown,
  pollTextKey,
  pollTextUsable,
  pollVoteChoice,
  resolvePollReply,
  tallyPollChoices,
  type PollVote,
} from '../src/lib/impulsePoll.ts'
import type { ImpulsePoll } from '../src/lib/types.ts'

/*
 * Die eigene Antwort in der Umfrage: aufräumen, vergleichen, auszählen –
 * ohne Datenbank. Die Stimmen sind Ausschnitte von `ImpulseAnswer`, wie
 * sie die Karte aus `impulseAnswers` bekommt.
 */

const POLL: ImpulsePoll = {
  form: 'choice',
  options: ['Locker «Nein danke» sagen', 'Mit einem Witz ablenken', 'Gehen'],
  min: 1,
  max: 10,
  minLabel: '',
  maxLabel: '',
  unit: '',
  explanation: '',
}

const at = (millis: number) => ({ toMillis: () => millis })
const option = (index: number): PollVote => ({ choiceIndex: index, text: '' })
const custom = (text: string, millis?: number): PollVote => ({
  choiceIndex: null,
  text,
  answeredAt: millis === undefined ? null : at(millis),
})

/* ------------------------------------------------------------------ */
/* Aufräumen und vergleichen                                           */
/* ------------------------------------------------------------------ */

test('cleanPollText: eine Zeile, ohne doppelte Leerzeichen, höchstens die Grenze', () => {
  assert.equal(cleanPollText('  Mit   den Eltern\n reden  '), 'Mit den Eltern reden')
  const long = 'a'.repeat(POLL_CUSTOM_MAX + 30)
  assert.equal(cleanPollText(long).length, POLL_CUSTOM_MAX)
})

test('cleanPollText: kürzt nach Zeichen – ein Emoji am Ende bleibt ganz', () => {
  const text = `${'a'.repeat(POLL_CUSTOM_MAX - 1)}🙏🙏`
  const clean = cleanPollText(text)
  assert.equal(Array.from(clean).length, POLL_CUSTOM_MAX)
  assert.ok(clean.endsWith('🙏'))
})

test('pollTextKey: Gross/klein, Leerzeichen und Satzzeichen zählen nicht', () => {
  const key = pollTextKey('Nein, danke!')
  assert.equal(pollTextKey('nein danke'), key)
  assert.equal(pollTextKey('  NEIN-DANKE … '), key)
  assert.equal(pollTextKey('«Nein danke»'), key)
  assert.equal(pollTextKey('Neindanke'), key)
})

test('pollTextKey: Umlaute und Emoji bleiben, «ß» wird «ss»', () => {
  assert.notEqual(pollTextKey('schön'), pollTextKey('schon'))
  assert.equal(pollTextKey('Grüße'), pollTextKey('grüsse'))
  assert.equal(pollTextKey('🙏'), '🙏')
  // Die Varianten-Auswahl eines Emoji ist unsichtbar – sie trennt nichts.
  assert.equal(pollTextKey('❤️'), pollTextKey('❤'))
})

test('pollTextUsable: nur Satzzeichen oder Leerzeichen taugen nicht', () => {
  assert.equal(pollTextUsable('???'), false)
  assert.equal(pollTextUsable('   '), false)
  assert.equal(pollTextUsable('… !'), false)
  assert.equal(pollTextUsable('Beten'), true)
  assert.equal(pollTextUsable('🙏'), true)
})

test('pollAllowsCustom: bei der Auswahl standardmässig ja, bei der Skala nie', () => {
  assert.equal(pollAllowsCustom(POLL), true)
  assert.equal(pollAllowsCustom({ ...POLL, allowCustom: true }), true)
  assert.equal(pollAllowsCustom({ ...POLL, allowCustom: false }), false)
  assert.equal(pollAllowsCustom({ ...POLL, form: 'scale' }), false)
})

/* ------------------------------------------------------------------ */
/* Wofür eine Stimme zählt                                             */
/* ------------------------------------------------------------------ */

test('pollVoteChoice: Index, eigene Antwort – und ein Text wie eine Vorgabe zählt für sie', () => {
  assert.deepEqual(pollVoteChoice(POLL, option(1)), { kind: 'option', index: 1 })
  assert.deepEqual(pollVoteChoice(POLL, custom('Beten')), { kind: 'custom', key: 'beten' })
  assert.deepEqual(pollVoteChoice(POLL, custom('gehen!')), { kind: 'option', index: 2 })
  assert.equal(pollVoteChoice(POLL, option(7)), null)
  assert.equal(pollVoteChoice(POLL, custom('???')), null)
  assert.equal(pollVoteChoice(POLL, { choiceIndex: null, text: '' }), null)
  assert.equal(pollVoteChoice({ ...POLL, form: 'scale' }, option(1)), null)
})

test('pollChoiceId: fest je Möglichkeit', () => {
  assert.equal(pollChoiceId({ kind: 'option', index: 2 }), 'o:2')
  assert.equal(pollChoiceId({ kind: 'custom', key: 'beten' }), 'c:beten')
})

/* ------------------------------------------------------------------ */
/* Auszählung                                                          */
/* ------------------------------------------------------------------ */

test('tallyPollChoices: Vorgaben und eigene Antworten zusammen, Anteile über alle', () => {
  const tally = tallyPollChoices(POLL, [
    option(0),
    option(0),
    option(1),
    custom('Beten', 300),
    custom('beten!', 400),
    custom('Mit den Eltern reden', 200),
  ])
  assert.equal(tally.total, 6)
  assert.deepEqual(
    tally.options.map((row) => [row.label, row.count]),
    [
      ['Locker «Nein danke» sagen', 2],
      ['Mit einem Witz ablenken', 1],
      ['Gehen', 0],
    ],
  )
  // Nach Stimmen geordnet, bei Gleichstand die frühere zuerst.
  assert.deepEqual(
    tally.custom.map((row) => [row.label, row.count, row.custom]),
    [
      ['Beten', 2, true],
      ['Mit den Eltern reden', 1, true],
    ],
  )
  assert.equal(tally.custom[0].share, 2 / 6)
  const shares = [...tally.options, ...tally.custom].reduce((sum, row) => sum + row.share, 0)
  assert.ok(Math.abs(shares - 1) < 1e-9)
})

test('tallyPollChoices: gleiche Texte sind eine Antwort – mit der Schreibweise der ersten', () => {
  const tally = tallyPollChoices(POLL, [
    custom('nein, ich geh nach hause', 500),
    custom('Nein – ich geh nach Hause!', 100),
    custom('NEIN ich geh nach hause', 900),
  ])
  assert.equal(tally.custom.length, 1)
  assert.equal(tally.custom[0].label, 'Nein – ich geh nach Hause!')
  assert.equal(tally.custom[0].count, 3)
})

test('tallyPollChoices: eine noch nicht bestätigte Stimme gibt der Antwort nicht den Namen', () => {
  // Die eigene, eben abgegebene Stimme hat noch keinen Zeitstempel.
  const tally = tallyPollChoices(POLL, [custom('BETEN'), custom('Beten', 100)])
  assert.equal(tally.custom[0].label, 'Beten')
})

test('tallyPollChoices: ein Text wie eine Vorgabe zählt bei der Vorgabe', () => {
  const tally = tallyPollChoices(POLL, [custom('Mit einem Witz ablenken.'), option(1)])
  assert.equal(tally.custom.length, 0)
  assert.equal(tally.options[1].count, 2)
  assert.equal(tally.total, 2)
})

test('tallyPollChoices: vor der Stimme in der Reihenfolge des Hinzufügens', () => {
  const votes = [custom('Später', 900), custom('Später', 950), custom('Zuerst', 100)]
  assert.deepEqual(
    tallyPollChoices(POLL, votes, { order: 'added' }).custom.map((row) => row.label),
    ['Zuerst', 'Später'],
  )
  assert.deepEqual(
    tallyPollChoices(POLL, votes).custom.map((row) => row.label),
    ['Später', 'Zuerst'],
  )
})

test('tallyPollChoices: Ausgeblendetes fällt aus Zeilen und Gesamtzahl', () => {
  const votes = [option(0), custom('Doofe Antwort', 100), custom('doofe antwort', 200)]
  const tally = tallyPollChoices(POLL, votes, { hidden: ['Doofe Antwort!'] })
  assert.equal(tally.custom.length, 0)
  assert.equal(tally.total, 1)
  assert.equal(tally.hiddenVotes, 2)
  assert.equal(tally.options[0].share, 1)
})

test('tallyPollChoices: die eigene Wahl bleibt für die Person selbst stehen', () => {
  const votes = [option(0), custom('Doofe Antwort', 100)]
  const tally = tallyPollChoices(POLL, votes, {
    hidden: ['Doofe Antwort'],
    reveal: 'c:doofeantwort',
  })
  assert.equal(tally.total, 2)
  assert.equal(tally.custom.length, 1)
  assert.equal(tally.custom[0].hidden, true)
  assert.equal(tally.custom[0].counted, true)
  assert.equal(tally.custom[0].share, 0.5)
})

test('tallyPollChoices: die Redaktion sieht Ausgeblendetes – zuletzt und ohne Anteil', () => {
  const votes = [option(0), custom('Doofe Antwort', 100), custom('Gut', 200)]
  const tally = tallyPollChoices(POLL, votes, { hidden: ['Doofe Antwort'], showHidden: true })
  assert.deepEqual(
    tally.custom.map((row) => [row.label, row.hidden, row.counted, row.share]),
    [
      ['Gut', false, true, 0.5],
      ['Doofe Antwort', true, false, 0],
    ],
  )
  assert.equal(tally.total, 2)
})

test('tallyPollChoices: ein überlanger Text wird beim Lesen gekürzt', () => {
  const tally = tallyPollChoices(POLL, [custom('x'.repeat(500), 100)])
  assert.equal(tally.custom[0].label.length, POLL_CUSTOM_MAX)
})

/* ------------------------------------------------------------------ */
/* Eintippen                                                           */
/* ------------------------------------------------------------------ */

test('resolvePollReply: Vorgabe, bestehende Antwort oder neu', () => {
  const offered = tallyPollChoices(POLL, [custom('Mit den Eltern reden', 100)], {
    order: 'added',
  }).custom
  assert.deepEqual(resolvePollReply(POLL, ' gehen ', offered), { choiceIndex: 2 })
  assert.deepEqual(resolvePollReply(POLL, 'mit den eltern reden!', offered), {
    text: 'Mit den Eltern reden',
  })
  assert.deepEqual(resolvePollReply(POLL, '  Beten  und  lesen ', offered), {
    text: 'Beten und lesen',
  })
  assert.equal(resolvePollReply(POLL, '?!', offered), null)
})

test('resolvePollReply: eine ausgeblendete Antwort wird nicht übernommen', () => {
  const offered = tallyPollChoices(POLL, [custom('Doofe Antwort', 100)], {
    hidden: ['Doofe Antwort'],
    showHidden: true,
  }).custom
  assert.deepEqual(resolvePollReply(POLL, 'doofe antwort', offered), { text: 'doofe antwort' })
})

test('matchPollText: sagt, was es schon gibt', () => {
  const offered = tallyPollChoices(POLL, [custom('Beten', 100)]).custom
  assert.deepEqual(matchPollText(POLL, 'GEHEN', offered), {
    kind: 'option',
    index: 2,
    label: 'Gehen',
  })
  const match = matchPollText(POLL, 'beten.', offered)
  assert.equal(match?.kind, 'custom')
  assert.equal(match?.kind === 'custom' && match.row.label, 'Beten')
  assert.equal(matchPollText(POLL, 'Singen', offered), null)
  assert.equal(matchPollText(POLL, '…', offered), null)
})

/* ------------------------------------------------------------------ */
/* Einklappen und Wiederzeigen                                         */
/* ------------------------------------------------------------------ */

test('pollRowsShown: die ersten paar – die eigene Wahl immer dazu', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))
  assert.deepEqual(pollRowsShown(rows, 3), { shown: rows.slice(0, 3), more: 3 })
  const own = pollRowsShown(rows, 3, 'f')
  assert.deepEqual(
    own.shown.map((row) => row.id),
    ['a', 'b', 'c', 'f'],
  )
  assert.equal(own.more, 2)
  // Bliebe genau eine übrig, steht sie gleich mit da.
  assert.deepEqual(pollRowsShown(rows.slice(0, 4), 3), { shown: rows.slice(0, 4), more: 0 })
})

test('pollHiddenEntries: alle Schreibweisen derselben Antwort', () => {
  assert.deepEqual(pollHiddenEntries(['Doof!', 'doof', 'Gut'], 'DOOF'), ['Doof!', 'doof'])
  assert.deepEqual(pollHiddenEntries(['Doof'], '???'), [])
})
