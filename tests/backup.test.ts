import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Timestamp } from 'firebase/firestore'

import { backupDocument, backupFilename, backupTotal, toJsonValue } from '../src/lib/backup.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Geprüft wird der eine Handgriff, bei dem eine Sicherung stillschweigend
 * unbrauchbar werden könnte: die Übersetzung nach JSON. Ein Zeitstempel, der
 * dabei verloren geht oder als `{"seconds":…}` in der Datei landet, fällt
 * sonst erst an dem Tag auf, an dem die Datei gebraucht wird.
 */

const AM_SECHSTEN = Timestamp.fromDate(new Date('2026-08-06T16:30:00.000Z'))

/* ------------------------------------------------------------------ */
/* Zeitstempel                                                         */
/* ------------------------------------------------------------------ */

test('ein Zeitstempel wird zur ISO-Zeichenkette', () => {
  assert.equal(toJsonValue(AM_SECHSTEN), '2026-08-06T16:30:00.000Z')
})

test('ein Date wird ebenso behandelt', () => {
  assert.equal(toJsonValue(new Date('2026-08-06T16:30:00.000Z')), '2026-08-06T16:30:00.000Z')
})

test('Zeitstempel in verschachtelten Listen und Objekten kommen mit', () => {
  const item = {
    title: 'Berufung',
    callingChanges: [{ name: 'Muster', sustainedAt: AM_SECHSTEN, rows: [{ at: AM_SECHSTEN }] }],
    meta: { updatedAt: AM_SECHSTEN },
  }

  assert.deepEqual(toJsonValue(item), {
    title: 'Berufung',
    callingChanges: [
      {
        name: 'Muster',
        sustainedAt: '2026-08-06T16:30:00.000Z',
        rows: [{ at: '2026-08-06T16:30:00.000Z' }],
      },
    ],
    meta: { updatedAt: '2026-08-06T16:30:00.000Z' },
  })
})

/* ------------------------------------------------------------------ */
/* Alles Übrige bleibt, wie es ist                                     */
/* ------------------------------------------------------------------ */

test('einfache Werte bleiben unverändert – auch null und leere Listen', () => {
  const data = {
    text: 'Notiz',
    zahl: 3,
    ja: true,
    nichts: null,
    leer: [] as unknown[],
    tags: ['a', 'b'],
  }
  assert.deepEqual(toJsonValue(data), data)
})

test('die Sicherung übersteht den Weg durch JSON', () => {
  const roundtrip = JSON.parse(JSON.stringify(toJsonValue({ updatedAt: AM_SECHSTEN }))) as {
    updatedAt: string
  }
  assert.equal(roundtrip.updatedAt, '2026-08-06T16:30:00.000Z')
  // Und zurück: Genau so wird die Datei wieder eingespielt.
  assert.equal(Timestamp.fromDate(new Date(roundtrip.updatedAt)).isEqual(AM_SECHSTEN), true)
})

/* ------------------------------------------------------------------ */
/* Dokument, Dateiname, Summe                                          */
/* ------------------------------------------------------------------ */

test('die Firestore-ID steht als Feld in der Datei', () => {
  const doc = backupDocument('abc123', { lastName: 'Muster', updatedAt: AM_SECHSTEN })
  assert.equal(doc.id, 'abc123')
  assert.equal(doc.lastName, 'Muster')
  assert.equal(doc.updatedAt, '2026-08-06T16:30:00.000Z')
})

test('der Dateiname trägt Datum und Uhrzeit', () => {
  // Ortszeit: Die Datei soll sagen, wann man sie gezogen hat.
  assert.equal(backupFilename(new Date(2026, 7, 6, 18, 30)), 'bss-sicherung-2026-08-06-1830.json')
})

test('gezählt wird über alle Sammlungen', () => {
  assert.equal(backupTotal({ members: 412, meetings: 37, notes: 0 }), 449)
  assert.equal(backupTotal({}), 0)
})
