import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  callingChangesConcern,
  callingChangesToText,
  emptyCallingChanges,
  isCallingChangesEmpty,
  isOwnItem,
  MAX_CALLING_ROWS,
  newCallingMemberRow,
  newCallingOpenRow,
  normalizeCallingChanges,
  serializeCallingChanges,
} from '../src/lib/callingChanges.ts'
import type { AgendaItem, CallingChanges } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Die Berufungsrunde ist eine Ideenliste – gerechnet wird darin fast
 * nichts. Zwei Dinge müssen trotzdem stimmen, und beide stehen hier:
 * Ein Datensatz aus Firestore darf kaputt sein, ohne die Seite mitzureissen
 * (`normalizeCallingChanges`), und die Frage «gehört das mir?» muss beide
 * Wege kennen – das eingetragene Konto und den erwähnten Namen.
 */

const ALAIN = { id: 'm1', name: 'Alain von Allmen' }

function changes(patch: Partial<CallingChanges> = {}): CallingChanges {
  return { ...emptyCallingChanges(), ...patch }
}

/* ---------------- Ausgangszustand ---------------- */

test('leere Runde: je eine Zeile, und die zählt als leer', () => {
  const value = emptyCallingChanges()
  assert.equal(value.members.length, 1)
  assert.equal(value.open.length, 1)
  assert.ok(isCallingChangesEmpty(value))
})

test('eine ausgefüllte Zeile macht die Runde nicht mehr leer', () => {
  const value = changes({ open: [{ ...newCallingOpenRow(), calling: 'PV-Leiterin' }] })
  assert.equal(isCallingChangesEmpty(value), false)
})

test('eine Farbe allein zählt schon als Inhalt', () => {
  const value = changes({ members: [{ ...newCallingMemberRow(), urgency: 'high' }] })
  assert.equal(isCallingChangesEmpty(value), false)
})

/* ---------------- Aus Firestore lesen ---------------- */

test('normalisieren: was fehlt, wird ergänzt, was fremd ist, fällt weg', () => {
  const value = normalizeCallingChanges({
    members: [
      // Kein `id`, kein `assignees`, eine Farbe, die es nicht gibt.
      { memberIds: ['m1', '', 7], calling: 'PV-Lehrerin', urgency: 'violett' },
    ],
    open: undefined,
  } as never)

  assert.equal(value.members.length, 1)
  const row = value.members[0]
  assert.ok(row.id)
  assert.deepEqual(row.memberIds, ['m1'])
  assert.equal(row.calling, 'PV-Lehrerin')
  assert.equal(row.ideas, '')
  assert.deepEqual(row.assignees, [])
  assert.equal(row.urgency, undefined)

  // Eine Tabelle ohne Zeile liesse sich nicht ausfüllen.
  assert.equal(value.open.length, 1)
})

test('normalisieren: aus gar nichts wird eine leere Runde', () => {
  const value = normalizeCallingChanges(null)
  assert.equal(value.members.length, 1)
  assert.equal(value.open.length, 1)
  assert.ok(isCallingChangesEmpty(value))
})

test('normalisieren: gültige Farben bleiben stehen', () => {
  const value = normalizeCallingChanges({
    members: [{ id: 'a', memberIds: [], calling: '', ideas: '', assignees: [], urgency: 'medium' }],
    open: [],
  })
  assert.equal(value.members[0].urgency, 'medium')
})

test('normalisieren: eine verunglückte Liste wird gekappt', () => {
  const many = Array.from({ length: MAX_CALLING_ROWS + 20 }, () => newCallingOpenRow())
  const value = normalizeCallingChanges({ members: [], open: many })
  assert.equal(value.open.length, MAX_CALLING_ROWS)
})

/* ---------------- Nach Firestore schreiben ---------------- */

test('serialisieren: kein einziges undefined im Objekt', () => {
  const value = changes({
    members: [{ ...newCallingMemberRow(), memberIds: ['m1'] }],
    open: [{ ...newCallingOpenRow(), calling: 'Sekretär', urgency: 'low' }],
  })
  const stored = serializeCallingChanges(value)

  const seen = JSON.stringify(stored, (_key, entry) =>
    entry === undefined ? '<undefined>' : entry,
  )
  assert.equal(seen.includes('<undefined>'), false)

  // Ohne Farbe steht der Schlüssel gar nicht erst da.
  assert.equal('urgency' in stored.members[0], false)
  assert.equal(stored.open[0].urgency, 'low')
})

/* ---------------- Als Text ---------------- */

test('als Text: Überschriften, leere Zeilen bleiben weg, Namen werden aufgelöst', () => {
  const value: CallingChanges = {
    members: [
      {
        ...newCallingMemberRow(),
        memberIds: ['m1'],
        calling: 'PV-Lehrerin,\nmöchte entlassen werden',
        ideas: 'Sonntagsschule',
        assignees: ['u1'],
      },
      newCallingMemberRow(),
    ],
    open: [newCallingOpenRow()],
  }

  const text = callingChangesToText(value, (id) => (id === 'm1' ? 'Alain von Allmen' : 'Bischof'))

  assert.ok(text.includes('Mitglieder ohne Berufungen'))
  assert.ok(
    text.includes('Alain von Allmen · PV-Lehrerin, möchte entlassen werden · Sonntagsschule'),
  )
  assert.ok(text.includes('Zuständig: Bischof'))
  // Die zweite, leere Zeile und die ganze zweite Tabelle stehen nicht da.
  assert.equal(text.includes('Offene Berufungen'), false)
  assert.equal(text.split('\n').length, 2)
})

test('als Text: ohne Inhalt bleibt nichts übrig', () => {
  assert.equal(callingChangesToText(emptyCallingChanges()), '')
  assert.equal(callingChangesToText(null), '')
})

/* ---------------- Wen geht das an? ---------------- */

test('meine Zeile: das eingetragene Konto zählt', () => {
  const value = changes({ open: [{ ...newCallingOpenRow(), assignees: ['u1'] }] })
  assert.ok(callingChangesConcern(value, 'u1', null))
  assert.equal(callingChangesConcern(value, 'u2', null), false)
})

test('meine Zeile: der Name in der Spalte «Name» zählt', () => {
  const value = changes({ members: [{ ...newCallingMemberRow(), memberIds: ['m1'] }] })
  assert.ok(callingChangesConcern(value, 'u1', ALAIN))
  // Ohne verknüpftes Mitglied hat die App keinen Anhaltspunkt.
  assert.equal(callingChangesConcern(value, 'u1', null), false)
})

test('meine Zeile: der erwähnte Name im Freitext zählt', () => {
  const value = changes({
    open: [{ ...newCallingOpenRow(), next: 'Alain von Allmen fragt bis Ende Monat an' }],
  })
  assert.ok(callingChangesConcern(value, 'u1', ALAIN))
})

test('ein Name mitten in einem Wort ist keine Erwähnung', () => {
  const value = changes({
    open: [{ ...newCallingOpenRow(), candidates: 'Alain von Allmensbach' }],
  })
  assert.equal(callingChangesConcern(value, 'u1', ALAIN), false)
})

test('eine fremde Runde gehört niemandem', () => {
  const value = changes({
    members: [{ ...newCallingMemberRow(), memberIds: ['m9'], calling: 'Lehrer' }],
    open: [{ ...newCallingOpenRow(), calling: 'Sekretär', assignees: ['u9'] }],
  })
  assert.equal(callingChangesConcern(value, 'u1', ALAIN), false)
})

test('«Meine Pendenzen»: Zuweisung am Eintrag oder eine Zeile darin', () => {
  const item = (patch: Partial<AgendaItem>) =>
    ({ assignees: [], callingChanges: null, ...patch }) as AgendaItem

  assert.ok(isOwnItem(item({ assignees: ['u1'] }), 'u1', null))
  assert.equal(isOwnItem(item({ assignees: ['u2'] }), 'u1', null), false)

  const runde = changes({ members: [{ ...newCallingMemberRow(), assignees: ['u1'] }] })
  assert.ok(isOwnItem(item({ callingChanges: runde }), 'u1', null))

  // Ohne Konto gehört niemandem etwas – auch nicht die leere Runde.
  assert.equal(isOwnItem(item({ callingChanges: emptyCallingChanges() }), null, ALAIN), false)
})
