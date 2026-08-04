import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  automaticSacramentKind,
  openTalkSlots,
  plannedTalksFor,
  sundayProgram,
} from '../src/lib/sunday.ts'
import type { SacramentMeeting, Talk } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Geprüft wird die Regel, auf der «Leitung», «Ansprachen» und die Übersicht
 * aufbauen: Was am Sonntag erfasst ist, gilt; sonst entscheidet der
 * Kalender. Und was daraus folgt – vor allem, wann keine Ansprachen
 * eingeplant werden.
 */

/** Ein Sonntag als lokales Datum, wie ihn die Oberfläche berechnet. */
const sunday = (iso: string) => new Date(`${iso}T12:00:00`)

const meeting = (partial: Partial<SacramentMeeting>): SacramentMeeting =>
  ({
    id: 'x',
    date: null,
    hymns: {},
    musicalNumbers: [],
    announcements: [],
    business: [],
    ...partial,
  }) as unknown as SacramentMeeting

const talk = (slot: number, status: Talk['status'] = 'confirmed'): Talk =>
  ({ id: `t${slot}`, memberId: 'm', memberName: 'Person', slot, status }) as unknown as Talk

/* ------------------------------------------------------------------ */
/* Die Regel                                                           */
/* ------------------------------------------------------------------ */

test('erster Sonntag im Monat ist die Fast- und Zeugnisversammlung', () => {
  assert.equal(automaticSacramentKind(sunday('2026-02-01')), 'fast_testimony')
  assert.equal(automaticSacramentKind(sunday('2026-03-01')), 'fast_testimony')
  // Der erste Sonntag kann bis auf den 7. fallen – nie später.
  assert.equal(automaticSacramentKind(sunday('2026-11-01')), 'fast_testimony')
})

test('im April und im Oktober ist an diesem Tag Generalkonferenz', () => {
  assert.equal(automaticSacramentKind(sunday('2026-04-05')), 'general_conference')
  assert.equal(automaticSacramentKind(sunday('2026-10-04')), 'general_conference')
  // Der zweite Sonntag im Konferenzmonat ist wieder gewöhnlich.
  assert.equal(automaticSacramentKind(sunday('2026-04-12')), 'regular')
})

test('alle übrigen Sonntage sind gewöhnliche Abendmahlsversammlungen', () => {
  assert.equal(automaticSacramentKind(sunday('2026-02-08')), 'regular')
  assert.equal(automaticSacramentKind(sunday('2026-02-22')), 'regular')
})

/* ------------------------------------------------------------------ */
/* Erfasstes vor Regel                                                 */
/* ------------------------------------------------------------------ */

test('ohne Eintrag entscheidet die Regel – und sagt es', () => {
  const program = sundayProgram(sunday('2026-02-01'), null)
  assert.equal(program.kind, 'fast_testimony')
  assert.equal(program.automatic, true)
  assert.equal(program.meets, true)
  assert.equal(program.plansTalks, false)
})

test('ein festgelegter Sonntag sticht die Regel', () => {
  // Erster Sonntag, aber von Hand als gewöhnliche Versammlung festgelegt.
  const program = sundayProgram(sunday('2026-02-01'), meeting({ kind: 'regular' }))
  assert.equal(program.kind, 'regular')
  assert.equal(program.automatic, false)
  assert.equal(program.plansTalks, true)
})

test('Pfahlkonferenz heisst: keine Versammlung, keine Ansprachen', () => {
  const program = sundayProgram(sunday('2026-05-17'), meeting({ kind: 'stake_conference' }))
  assert.equal(program.meets, false)
  assert.equal(program.plansTalks, false)
})

test('Darbietung der Kinder und JAE-Sonntag brauchen die Leitung, aber keine Ansprachen', () => {
  for (const kind of ['primary_program', 'ysa'] as const) {
    const program = sundayProgram(sunday('2026-05-17'), meeting({ kind }))
    assert.equal(program.meets, true, kind)
    assert.equal(program.plansTalks, false, kind)
  }
})

test('die Haken übersteuern die Art – und werden als Abweichung erkannt', () => {
  const withoutMeeting = sundayProgram(sunday('2026-05-17'), meeting({ meets: false }))
  assert.equal(withoutMeeting.meets, false)
  // Ohne Versammlung gibt es nichts zu sprechen, auch wenn die Art es vorsähe.
  assert.equal(withoutMeeting.plansTalks, false)
  assert.equal(withoutMeeting.adjusted, true)

  const conferenceAtHome = sundayProgram(
    sunday('2026-05-17'),
    meeting({ kind: 'stake_conference', meets: true, plansTalks: true }),
  )
  assert.equal(conferenceAtHome.meets, true)
  assert.equal(conferenceAtHome.plansTalks, true)
  assert.equal(conferenceAtHome.adjusted, true)

  const plain = sundayProgram(sunday('2026-05-17'), meeting({ kind: 'regular' }))
  assert.equal(plain.adjusted, false)
})

/* ------------------------------------------------------------------ */
/* Was daraus folgt                                                    */
/* ------------------------------------------------------------------ */

test('an Sonntagen ohne Ansprachen ist kein Platz vorgesehen', () => {
  assert.equal(plannedTalksFor(sunday('2026-02-01'), null, 3), 0)
  assert.equal(plannedTalksFor(sunday('2026-04-05'), null, 3), 0)
  assert.equal(plannedTalksFor(sunday('2026-05-17'), meeting({ kind: 'primary_program' }), 3), 0)
})

test('sonst gilt der Standard – oder die Ausnahme des Sonntags', () => {
  assert.equal(plannedTalksFor(sunday('2026-02-08'), null, 3), 3)
  assert.equal(plannedTalksFor(sunday('2026-02-08'), meeting({ talkSlots: 2 }), 3), 2)
  assert.equal(plannedTalksFor(sunday('2026-02-08'), meeting({ talkSlots: 0 }), 3), 0)
})

test('offene Plätze zählen nur, wo Ansprachen vorgesehen sind', () => {
  const talks = [talk(1), talk(3)]
  assert.equal(openTalkSlots(sunday('2026-02-08'), null, talks, 3), 1)
  // Derselbe Bestand an einer Zeugnisversammlung: nichts offen, nichts fehlt.
  assert.equal(openTalkSlots(sunday('2026-02-01'), null, talks, 3), 0)
})

test('abgesagte Zusagen geben ihren Platz wieder frei', () => {
  const talks = [talk(1, 'cancelled'), talk(2)]
  assert.equal(openTalkSlots(sunday('2026-02-08'), null, talks, 3), 2)
})
