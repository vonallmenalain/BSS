import assert from 'node:assert/strict'
import { test } from 'node:test'

import { format } from 'date-fns'
import { impulseFirstName, impulseWeekKey, quizAnswerCorrect } from '../src/lib/impulse.ts'
import {
  changePreviewProgress,
  emptyPreviewData,
  initialPreviewDay,
  patchPreviewDoc,
  PREVIEW_UID,
  previewMoment,
  removePreviewDoc,
  upsertPreviewDoc,
  withPreviewDocs,
} from '../src/lib/impulsePreview.ts'
import type { ImpulseProgress, TS } from '../src/lib/types.ts'

/*
 * Die Vorschau der Redaktion spielt eine Woche, als liefe sie, und
 * speichert nichts: Was die Jugendlichen in die Datenbank schrieben,
 * führt sie im Arbeitsspeicher nach. Hier stehen der gespielte Tag und
 * die Regeln, nach denen ein Schreibvorgang diesen Stand verändert –
 * dieselben, die Firestore mit `merge`, `arrayUnion` und `arrayRemove`
 * anwendet.
 */

/** Ein Zeitstempel zum Wiedererkennen – mehr braucht der Stand nicht. */
const at = (label: string) => ({ label }) as unknown as TS
const person = { uid: PREVIEW_UID, firstName: 'Alain' }

test('initialPreviewDay: die laufende Woche beginnt heute, jede andere am Montag', () => {
  // Mittwoch, 7. Oktober 2026, in der Woche 2026-W41.
  const wednesday = new Date(2026, 9, 7, 18, 30).getTime()
  assert.equal(initialPreviewDay('2026-W41', wednesday), 2)
  assert.equal(initialPreviewDay('2026-W42', wednesday), 0)
  assert.equal(initialPreviewDay('2026-W40', wednesday), 0)
  // Sonntag gehört noch zur Woche.
  assert.equal(initialPreviewDay('2026-W40', new Date(2026, 9, 4, 23, 59).getTime()), 6)
  assert.equal(initialPreviewDay('keine-woche', wednesday), 0)
})

test('previewMoment: der gewählte Tag der Woche, zur echten Uhrzeit', () => {
  const real = new Date(2026, 9, 4, 17, 45, 12).getTime() // Sonntag in W40
  const monday = previewMoment('2026-W41', 0, real)
  assert.equal(format(monday, 'yyyy-MM-dd HH:mm:ss'), '2026-10-05 17:45:12')
  assert.equal(impulseWeekKey(monday), '2026-W41')
  const sunday = previewMoment('2026-W41', 6, real)
  assert.equal(format(sunday, 'yyyy-MM-dd HH:mm'), '2026-10-11 17:45')
  assert.equal(impulseWeekKey(sunday), '2026-W41')
  // Ausserhalb von Montag bis Sonntag wird geklemmt – die Woche bleibt dieselbe.
  assert.equal(impulseWeekKey(previewMoment('2026-W41', 9, real)), '2026-W41')
  assert.equal(impulseWeekKey(previewMoment('2026-W41', -3, real)), '2026-W41')
  // Ein unbrauchbarer Schlüssel lässt die echte Zeit stehen.
  assert.equal(previewMoment('keine-woche', 2, real), real)
})

test('changePreviewProgress: der erste Schreibvorgang legt das Dokument an', () => {
  const progress = changePreviewProgress(
    null,
    person,
    { kind: 'last-seen', week: '2026-W41' },
    at('t1'),
  )
  assert.equal(progress.id, PREVIEW_UID)
  assert.equal(progress.uid, PREVIEW_UID)
  assert.equal(progress.firstName, 'Alain')
  assert.equal(progress.lastSeenWeek, '2026-W41')
  assert.deepEqual(progress.createdAt, at('t1'))
  assert.deepEqual(progress.updatedAt, at('t1'))
})

test('changePreviewProgress: die erste Woche wird einmal vermerkt und bleibt', () => {
  let progress = changePreviewProgress(
    null,
    person,
    { kind: 'last-seen', week: '2026-W41', firstSeenWeek: '2026-W41' },
    at('t1'),
  )
  assert.equal(progress.firstSeenWeek, '2026-W41')
  progress = changePreviewProgress(
    progress,
    person,
    { kind: 'last-seen', week: '2026-W42' },
    at('t2'),
  )
  assert.equal(progress.lastSeenWeek, '2026-W42')
  assert.equal(progress.firstSeenWeek, '2026-W41')
})

test('changePreviewProgress: Haken der Woche werden zusammengeführt, nicht ersetzt', () => {
  let progress: ImpulseProgress | null = null
  progress = changePreviewProgress(
    progress,
    person,
    { kind: 'week', week: '2026-W41', patch: { goal: true } },
    at('t1'),
  )
  progress = changePreviewProgress(
    progress,
    person,
    { kind: 'week', week: '2026-W41', patch: { share: true } },
    at('t2'),
  )
  progress = changePreviewProgress(
    progress,
    person,
    { kind: 'week', week: '2026-W42', patch: { feed: true } },
    at('t3'),
  )
  assert.deepEqual(progress.weeks, {
    '2026-W41': { goal: true, share: true },
    '2026-W42': { feed: true },
  })
  // Zurückgenommen ist zurückgenommen – der andere Haken bleibt.
  progress = changePreviewProgress(
    progress,
    person,
    { kind: 'week', week: '2026-W41', patch: { goal: false } },
    at('t4'),
  )
  assert.deepEqual(progress.weeks?.['2026-W41'], { goal: false, share: true })
  assert.deepEqual(progress.createdAt, at('t1'))
  assert.deepEqual(progress.updatedAt, at('t4'))
})

test('changePreviewProgress: Listen wie arrayUnion und arrayRemove', () => {
  let progress: ImpulseProgress | null = null
  const card = (value: string, add = true) =>
    ({ kind: 'week-list', week: '2026-W41', field: 'cards', value, add }) as const
  progress = changePreviewProgress(progress, person, card('a'), at('t1'))
  progress = changePreviewProgress(progress, person, card('b'), at('t2'))
  // Ein zweites Mal dieselbe Karte: kein Doppel.
  progress = changePreviewProgress(progress, person, card('a'), at('t3'))
  assert.deepEqual(progress.weeks?.['2026-W41']?.cards, ['a', 'b'])
  progress = changePreviewProgress(progress, person, card('a', false), at('t4'))
  assert.deepEqual(progress.weeks?.['2026-W41']?.cards, ['b'])

  progress = changePreviewProgress(
    progress,
    person,
    { kind: 'list', field: 'amens', value: 'x', add: true },
    at('t5'),
  )
  progress = changePreviewProgress(
    progress,
    person,
    { kind: 'list', field: 'favorites', value: 'y', add: true },
    at('t6'),
  )
  progress = changePreviewProgress(
    progress,
    person,
    { kind: 'list', field: 'amens', value: 'x', add: false },
    at('t7'),
  )
  assert.deepEqual(progress.amens, [])
  assert.deepEqual(progress.favorites, ['y'])
  // Die Liste der Woche bleibt von den Listen am Dokument unberührt.
  assert.deepEqual(progress.weeks?.['2026-W41']?.cards, ['b'])
})

test('changePreviewProgress: das Wappen trägt den Tag, an dem es vollendet wurde', () => {
  const progress = changePreviewProgress(
    { id: PREVIEW_UID, uid: PREVIEW_UID, firstName: 'Alt', weeks: { '2026-W41': { goal: true } } },
    person,
    { kind: 'week', week: '2026-W41', patch: { crest: '2026-10-07' } },
    at('t1'),
  )
  assert.deepEqual(progress.weeks?.['2026-W41'], { goal: true, crest: '2026-10-07' })
  // Der Vorname wird bei jedem Schreiben mitgeschrieben, wie im Dienst.
  assert.equal(progress.firstName, 'Alain')
})

test('Dokumente: einsetzen, nachführen, entfernen', () => {
  let list = [{ id: 'a', text: 'eins' }]
  list = upsertPreviewDoc(list, { id: 'b', text: 'zwei' })
  list = upsertPreviewDoc(list, { id: 'a', text: 'eins, neu' })
  assert.deepEqual(list, [
    { id: 'a', text: 'eins, neu' },
    { id: 'b', text: 'zwei' },
  ])
  list = patchPreviewDoc(list, 'b', { text: 'zwei, neu' })
  list = patchPreviewDoc(list, 'fehlt', { text: 'nichts' })
  assert.deepEqual(
    list.map((entry) => entry.text),
    ['eins, neu', 'zwei, neu'],
  )
  assert.deepEqual(removePreviewDoc(list, 'a'), [{ id: 'b', text: 'zwei, neu' }])
})

test('withPreviewDocs: die Vorschau liegt über dem Bestand', () => {
  const real = [
    { id: 'q_anna', uid: 'anna' },
    { id: 'q_vorschau', uid: 'alt' },
  ]
  // Ohne Vorschau-Stand: dieselbe Liste, kein neues Objekt.
  assert.equal(withPreviewDocs(real, []), real)
  assert.deepEqual(withPreviewDocs(real, [{ id: 'q_vorschau', uid: PREVIEW_UID }]), [
    { id: 'q_anna', uid: 'anna' },
    { id: 'q_vorschau', uid: PREVIEW_UID },
  ])
  assert.deepEqual(emptyPreviewData(), {
    answers: [],
    comments: [],
    progress: null,
    submissions: [],
    celebrated: '',
  })
})

test('impulseFirstName und quizAnswerCorrect: Dienst und Vorschau rechnen gleich', () => {
  assert.equal(impulseFirstName('  Alain von Allmen '), 'Alain')
  assert.equal(impulseFirstName('Alain'), 'Alain')
  const quiz = {
    quiz: { form: 'choice', options: ['a', 'b'], answerIndex: 1, answerText: '', explanation: '' },
  } as never
  assert.equal(quizAnswerCorrect(quiz, { choiceIndex: 1 }), true)
  assert.equal(quizAnswerCorrect(quiz, { choiceIndex: 0 }), false)
  assert.equal(quizAnswerCorrect(quiz, {}), null)
  assert.equal(quizAnswerCorrect({ quiz: null } as never, { choiceIndex: 1 }), null)
})
