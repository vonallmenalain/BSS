import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  dutyAppliesTo,
  dutyAssignees,
  dutyIsRunning,
  dutyItemId,
  formatMonthKey,
  isMonthKey,
  monthKey,
  monthLeaders,
  pendingDutyActions,
  previousMonth,
} from '../src/lib/monthlyDuties.ts'
import type { AgendaItem, MonthlyDuty } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Die Monatspendenzen hängen an drei Fragen: Wer führt diesen Monat? Fällt
 * die Aufgabe in ihm an? Und wem gehört sie, wenn die Leitung wechselt? Alle
 * drei werden ohne Firestore beantwortet – und deshalb hier geprüft.
 */

function duty(partial: Partial<MonthlyDuty> = {}): MonthlyDuty {
  return {
    id: 'd1',
    title: 'Ansprachen für den Monat anfragen',
    description: '',
    startMonth: '2026-01',
    endMonth: null,
    ...partial,
  }
}

type DutyItem = Pick<AgendaItem, 'id' | 'dutyId' | 'dutyLeaderId' | 'assignees' | 'status'>

function item(partial: Partial<DutyItem> = {}): DutyItem {
  return {
    id: dutyItemId('d1', '2026-08'),
    dutyId: 'd1',
    dutyLeaderId: 'josh',
    assignees: ['josh'],
    status: 'pending',
    ...partial,
  }
}

/* ------------------------------------------------------------------ */
/* Monate                                                              */
/* ------------------------------------------------------------------ */

test('monthKey liest den Monat aus Datum und Datumsschlüssel', () => {
  assert.equal(monthKey('2026-08-09'), '2026-08')
  assert.equal(monthKey(new Date(2026, 7, 9, 12)), '2026-08')
  // Einstellige Monate bekommen ihre führende Null.
  assert.equal(monthKey(new Date(2026, 0, 31, 12)), '2026-01')
})

test('monthKey liest die lokale Zeit, nicht die von Greenwich', () => {
  // Der 1. August um 00:30 Uhr ist hier der August – in UTC noch der Juli.
  assert.equal(monthKey(new Date(2026, 7, 1, 0, 30)), '2026-08')
})

test('previousMonth geht über den Jahreswechsel', () => {
  assert.equal(previousMonth('2026-08'), '2026-07')
  assert.equal(previousMonth('2026-01'), '2025-12')
  assert.equal(previousMonth('2026-11'), '2026-10')
})

test('isMonthKey erkennt, was ein Monat ist', () => {
  assert.equal(isMonthKey('2026-08'), true)
  assert.equal(isMonthKey('2026-08-09'), false)
  assert.equal(isMonthKey(''), false)
  assert.equal(isMonthKey(null), false)
})

test('formatMonthKey schreibt den Monat aus', () => {
  assert.equal(formatMonthKey('2026-08'), 'August 2026')
  assert.equal(formatMonthKey('2026-01'), 'Januar 2026')
  assert.equal(formatMonthKey('2025-12'), 'Dezember 2025')
})

/* ------------------------------------------------------------------ */
/* Wer führt den Monat?                                                */
/* ------------------------------------------------------------------ */

test('monthLeaders nimmt die Zuständigkeit der Sonntage', () => {
  const leaders = monthLeaders([
    { id: '2026-08-02', responsibleId: 'josh' },
    { id: '2026-08-09', responsibleId: 'josh' },
    { id: '2026-09-06', responsibleId: 'kevin' },
  ])
  assert.equal(leaders.get('2026-08'), 'josh')
  assert.equal(leaders.get('2026-09'), 'kevin')
})

test('monthLeaders lässt einen Vertretungssonntag den Monat nicht kippen', () => {
  const leaders = monthLeaders([
    { id: '2026-08-02', responsibleId: 'josh' },
    // Ferien – an diesem einen Sonntag springt jemand ein.
    { id: '2026-08-09', responsibleId: 'kevin' },
    { id: '2026-08-16', responsibleId: 'josh' },
    { id: '2026-08-23', responsibleId: 'josh' },
  ])
  assert.equal(leaders.get('2026-08'), 'josh')
})

test('monthLeaders entscheidet bei Gleichstand für den früheren Sonntag', () => {
  const spät = monthLeaders([
    { id: '2026-08-16', responsibleId: 'kevin' },
    { id: '2026-08-02', responsibleId: 'josh' },
  ])
  // Die Reihenfolge der Daten darf das Ergebnis nicht bestimmen.
  const früh = monthLeaders([
    { id: '2026-08-02', responsibleId: 'josh' },
    { id: '2026-08-16', responsibleId: 'kevin' },
  ])
  assert.equal(spät.get('2026-08'), 'josh')
  assert.equal(früh.get('2026-08'), 'josh')
})

test('monthLeaders lässt Monate ohne Angabe weg', () => {
  const leaders = monthLeaders([{ id: '2026-08-02', responsibleId: null }, { id: '2026-08-09' }])
  assert.equal(leaders.has('2026-08'), false)
})

/* ------------------------------------------------------------------ */
/* Fällt die Aufgabe an?                                               */
/* ------------------------------------------------------------------ */

test('dutyAppliesTo gilt ab dem Startmonat', () => {
  const d = duty({ startMonth: '2026-08' })
  assert.equal(dutyAppliesTo(d, '2026-07'), false)
  assert.equal(dutyAppliesTo(d, '2026-08'), true)
  assert.equal(dutyAppliesTo(d, '2027-03'), true)
})

test('dutyAppliesTo endet mit dem letzten Monat – und schliesst ihn ein', () => {
  const d = duty({ startMonth: '2026-01', endMonth: '2026-09' })
  assert.equal(dutyAppliesTo(d, '2026-09'), true)
  assert.equal(dutyAppliesTo(d, '2026-10'), false)
})

test('dutyIsRunning sagt, ob noch etwas nachkommt', () => {
  assert.equal(dutyIsRunning(duty(), '2026-08'), true)
  assert.equal(dutyIsRunning(duty({ endMonth: '2026-08' }), '2026-08'), true)
  assert.equal(dutyIsRunning(duty({ endMonth: '2026-07' }), '2026-08'), false)
})

test('dutyItemId ist aus Vorlage und Monat gerechnet', () => {
  assert.equal(dutyItemId('abc123', '2026-08'), 'abc123-2026-08')
  // Keine Schrägstriche – sonst wäre es kein Dokument mehr, sondern ein Pfad.
  assert.equal(dutyItemId('abc123', '2026-08').includes('/'), false)
})

/* ------------------------------------------------------------------ */
/* Wem gehört sie?                                                     */
/* ------------------------------------------------------------------ */

test('dutyAssignees tauscht die Leitung aus und lässt die Übrigen stehen', () => {
  assert.deepEqual(dutyAssignees(['josh', 'alain'], 'josh', 'kevin'), ['kevin', 'alain'])
})

test('dutyAssignees schreibt niemanden doppelt', () => {
  assert.deepEqual(dutyAssignees(['josh', 'kevin'], 'josh', 'kevin'), ['kevin'])
})

test('dutyAssignees lässt die Zuständigen stehen, wenn niemand eingetragen ist', () => {
  assert.deepEqual(dutyAssignees(['josh'], 'josh', null), ['josh'])
})

test('dutyAssignees kommt auch ohne bisherige Zuständige aus', () => {
  assert.deepEqual(dutyAssignees(undefined, null, 'josh'), ['josh'])
})

/* ------------------------------------------------------------------ */
/* Was zu tun ist                                                      */
/* ------------------------------------------------------------------ */

const leaders = new Map([['2026-08', 'josh']])

test('pendingDutyActions legt an, was für den Monat noch fehlt', () => {
  const actions = pendingDutyActions([duty()], [], leaders, '2026-08')
  assert.equal(actions.length, 1)
  assert.equal(actions[0].kind, 'create')
  assert.equal(actions[0].kind === 'create' && actions[0].leader, 'josh')
})

test('pendingDutyActions legt nichts an, was schon dasteht', () => {
  assert.deepEqual(pendingDutyActions([duty()], [item()], leaders, '2026-08'), [])
})

test('pendingDutyActions legt auch ohne Leitung an – dann ohne Zuständigen', () => {
  const actions = pendingDutyActions([duty()], [], new Map(), '2026-08')
  assert.equal(actions.length, 1)
  assert.equal(actions[0].kind === 'create' && actions[0].leader, null)
})

test('pendingDutyActions schreibt um, wenn die Leitung mitten im Monat wechselt', () => {
  const actions = pendingDutyActions(
    [duty()],
    [item({ dutyLeaderId: 'kevin', assignees: ['kevin', 'alain'] })],
    leaders,
    '2026-08',
  )
  assert.equal(actions.length, 1)
  assert.deepEqual(actions[0], {
    kind: 'reassign',
    itemId: dutyItemId('d1', '2026-08'),
    leader: 'josh',
    assignees: ['josh', 'alain'],
  })
})

test('pendingDutyActions lässt Erledigtes in Ruhe', () => {
  const actions = pendingDutyActions(
    [duty()],
    [item({ dutyLeaderId: 'kevin', assignees: ['kevin'], status: 'done' })],
    leaders,
    '2026-08',
  )
  assert.deepEqual(actions, [])
})

test('pendingDutyActions überspringt beendete und noch nicht begonnene Aufgaben', () => {
  const actions = pendingDutyActions(
    [
      duty({ id: 'beendet', endMonth: '2026-07' }),
      duty({ id: 'künftig', startMonth: '2026-09' }),
      duty({ id: 'läuft' }),
    ],
    [],
    leaders,
    '2026-08',
  )
  assert.equal(actions.length, 1)
  assert.equal(actions[0].kind === 'create' && actions[0].duty.id, 'läuft')
})

test('pendingDutyActions rührt einen anderen Monat nicht an', () => {
  // Die Pendenz des Julis steht da; gefragt ist der August.
  const juli = item({ id: dutyItemId('d1', '2026-07') })
  const actions = pendingDutyActions([duty()], [juli], leaders, '2026-08')
  assert.equal(actions.length, 1)
  assert.equal(actions[0].kind, 'create')
})
