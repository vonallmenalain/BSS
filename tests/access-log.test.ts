import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  areaLabel,
  buildRows,
  changeSummary,
  describeChange,
  fieldLabels,
  formatPlace,
  groupByDay,
  parseDevice,
  sessionMinutes,
  sortRows,
} from '../src/lib/accessLog.ts'
import { CHANGE_OP_LABELS } from '../src/lib/types.ts'
import type { AppUser, ChangeEntry, LogEntry, SessionEntry } from '../src/lib/types.ts'

/*
 * Läuft ohne Bundler direkt in Node (Typen werden beim Laden entfernt,
 * Node >= 22.18): `npm run test:import`.
 *
 * Das Zugriffsprotokoll wird an zwei Stellen gebraucht – beim Schreiben, um
 * einer Änderung einen Titel zu geben, und beim Lesen, um aus Tausenden
 * Einträgen eine Zeile je Konto zu machen. Beides ist reine Rechnerei ohne
 * Firestore, und beides ist die Art Code, bei der ein Fehler nicht auffällt:
 * Eine falsch gezählte Zeile sieht aus wie eine richtige.
 */

/* ------------------------------------------------------------------ */
/* Hilfsmittel                                                         */
/* ------------------------------------------------------------------ */

/**
 * Ein Zeitstempel, wie ihn Firestore liefert.
 *
 * `toDate()` erkennt ihn an `toDate()`; mehr braucht es hier nicht, und ein
 * echtes `Timestamp`-Objekt hiesse, das Firebase-SDK in den Test zu holen.
 */
function ts(iso: string) {
  const date = new Date(iso)
  return { toDate: () => date, seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }
}

function session(partial: Partial<SessionEntry> & { id: string; at: string }): SessionEntry {
  const { at, ...rest } = partial
  return {
    kind: 'session',
    uid: 'uid-1',
    email: 'anna@example.ch',
    displayName: 'Anna Muster',
    views: 1,
    ...rest,
    at: ts(at),
  } as unknown as SessionEntry
}

function change(partial: Partial<ChangeEntry> & { id: string; at: string }): ChangeEntry {
  const { at, ...rest } = partial
  return {
    kind: 'change',
    uid: 'uid-1',
    email: 'anna@example.ch',
    displayName: 'Anna Muster',
    collectionId: 'agendaItems',
    op: 'update',
    ...rest,
    at: ts(at),
  } as unknown as ChangeEntry
}

function user(partial: Partial<AppUser> & { id: string }): AppUser {
  return {
    email: `${partial.id}@example.ch`,
    displayName: 'Unbenannt',
    role: 'secretary',
    active: true,
    ...partial,
  } as AppUser
}

const NOW = new Date('2026-08-11T20:00:00Z')

/* ------------------------------------------------------------------ */
/* Bereiche und Felder                                                 */
/* ------------------------------------------------------------------ */

test('benennt die Bereiche mit den Namen der Oberfläche', () => {
  assert.equal(areaLabel('agendaItems'), 'Traktanden und Pendenzen')
  assert.equal(areaLabel('apActivities'), 'Aktivitäten AP')
  // Eine unbekannte Sammlung behält ihren Namen, statt zu verschwinden.
  assert.equal(areaLabel('etwasNeues'), 'etwasNeues')
})

test('lässt Buchhaltungsfelder aus der Feldliste weg', () => {
  const fields = fieldLabels('agendaItems', {
    title: 'Budget',
    status: 'done',
    updatedAt: 'egal',
    editedAt: 'egal',
    createdBy: 'uid-1',
  })
  assert.deepEqual(fields.sort(), ['Status', 'Titel'])
})

test('führt einen verschachtelten Pfad auf sein oberstes Feld zurück', () => {
  // «hymns.opening» ist eine Änderung an den Liedern und nicht an «opening».
  assert.deepEqual(fieldLabels('sacramentMeetings', { 'hymns.opening': {} }), ['Lieder'])
})

/* ------------------------------------------------------------------ */
/* Titel einer Änderung                                                */
/* ------------------------------------------------------------------ */

test('nimmt den Titel aus dem, was geschrieben wurde', () => {
  assert.equal(describeChange('agendaItems', 'a1', { title: 'Budget 2027' }), 'Budget 2027')
  assert.equal(
    describeChange('members', 'm1', { firstName: 'Peter', lastName: 'Meier' }),
    'Peter Meier',
  )
  assert.equal(describeChange('talks', 't1', { memberName: 'Anna Muster' }), 'Anna Muster')
})

test('schlägt im geladenen Bestand nach, wenn die Änderung den Titel nicht enthält', () => {
  // Der Normalfall: Eine Änderung schreibt nur, was sich ändert.
  const peek = (collectionId: string, id: string) =>
    collectionId === 'agendaItems' && id === 'a1' ? { title: 'Budget 2027' } : null

  assert.equal(describeChange('agendaItems', 'a1', { status: 'done' }, peek), 'Budget 2027')
  // Kennt der Bestand ihn nicht, bleibt die Zeile ohne Titel – besser als eine ID.
  assert.equal(describeChange('agendaItems', 'a2', { status: 'done' }, peek), '')
})

test('macht aus einem Datum in der Dokument-ID ein lesbares Datum', () => {
  assert.equal(describeChange('sacramentMeetings', '2026-08-09', null), '09.08.2026')
  assert.equal(describeChange('apMonths', '2026-01', { month: '2026-01' }, undefined), '01.2026')
})

/* ------------------------------------------------------------------ */
/* Gerät und Ort                                                       */
/* ------------------------------------------------------------------ */

test('erkennt Gerät und Browser trotz der üblichen Verkleidung', () => {
  // Safari auf dem iPhone nennt sich auch «Mozilla» und «Gecko».
  assert.equal(
    parseDevice(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    ),
    'iPhone · Safari',
  )
  // Edge nennt sich auch Chrome und Safari – die Reihenfolge entscheidet.
  assert.equal(
    parseDevice(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    ),
    'Windows · Edge',
  )
  assert.equal(parseDevice(''), '')
})

test('fasst den Ort zusammen, ohne denselben Namen zweimal zu nennen', () => {
  assert.equal(
    formatPlace(
      session({ id: 's1', at: '2026-08-11T08:00:00Z', city: 'Zürich', country: 'Schweiz' }),
    ),
    'Zürich, Schweiz',
  )
  // Stadt und Kanton heissen oft gleich.
  assert.equal(
    formatPlace(
      session({
        id: 's2',
        at: '2026-08-11T08:00:00Z',
        city: 'Zürich',
        region: 'Zürich',
        country: 'Schweiz',
      }),
    ),
    'Zürich, Schweiz',
  )
  // Ohne Ortsangabe bleibt die Zeitzone des Geräts.
  assert.equal(
    formatPlace(session({ id: 's3', at: '2026-08-11T08:00:00Z', timezone: 'Europe/Zurich' })),
    'Europe/Zurich',
  )
})

test('rechnet die Dauer eines Besuchs in Minuten', () => {
  const entry = session({
    id: 's1',
    at: '2026-08-11T20:14:00Z',
    endedAt: ts('2026-08-11T20:41:00Z'),
  } as never)
  assert.equal(sessionMinutes(entry), 27)
  // Ein Besuch ohne Ende ist kein Fehler, sondern ein sehr kurzer.
  assert.equal(sessionMinutes(session({ id: 's2', at: '2026-08-11T20:14:00Z' })), 0)
})

/* ------------------------------------------------------------------ */
/* Eine Zeile je Konto                                                 */
/* ------------------------------------------------------------------ */

const ENTRIES: LogEntry[] = [
  session({
    id: 's1',
    at: '2026-08-11T19:00:00Z',
    endedAt: ts('2026-08-11T19:30:00Z'),
    views: 12,
    device: 'iPhone · Safari',
    city: 'Burgdorf',
    country: 'Schweiz',
  } as never),
  session({ id: 's2', at: '2026-08-09T09:00:00Z', endedAt: ts('2026-08-09T09:10:00Z') } as never),
  change({ id: 'c1', at: '2026-08-11T19:05:00Z', label: 'Budget 2027', fields: ['Titel'] }),
  change({ id: 'c2', at: '2026-08-11T19:06:00Z', collectionId: 'members', count: 312 }),
  session({
    id: 's3',
    at: '2026-08-10T07:00:00Z',
    uid: 'uid-2',
    email: 'beat@example.ch',
    displayName: 'Beat Meier',
  } as never),
]

const USERS = [
  user({ id: 'uid-1', displayName: 'Anna Muster', email: 'anna@example.ch' }),
  user({ id: 'uid-2', displayName: 'Beat Meier', email: 'beat@example.ch', role: 'bishop' }),
  user({ id: 'uid-3', displayName: 'Carla Weber', email: 'carla@example.ch' }),
]

test('zählt Besuche und Änderungen je Konto', () => {
  const rows = buildRows(ENTRIES, USERS, { days: 30, now: NOW })
  const anna = rows.find((row) => row.uid === 'uid-1')

  assert.ok(anna)
  assert.equal(anna.visits, 2)
  // Eine zusammengefasste Änderung zählt mit ihrer Menge: 1 + 312.
  assert.equal(anna.changeCount, 313)
  assert.equal(anna.minutes, 40)
  assert.equal(anna.known, true)
})

test('nimmt Gerät und Ort aus dem jüngsten Besuch', () => {
  const rows = buildRows(ENTRIES, USERS, { days: 30, now: NOW })
  const anna = rows.find((row) => row.uid === 'uid-1')

  assert.ok(anna)
  assert.equal(anna.device, 'iPhone · Safari')
  assert.equal(anna.place, 'Burgdorf, Schweiz')
})

test('führt auch Konten auf, die noch nie da waren', () => {
  const rows = buildRows(ENTRIES, USERS, { days: 30, now: NOW })
  const carla = rows.find((row) => row.uid === 'uid-3')

  assert.ok(carla)
  assert.equal(carla.visits, 0)
  assert.equal(carla.lastAt, null)
  assert.equal(carla.entries.length, 0)
})

test('behält ein gelöschtes Konto mit dem Namen, der beim Zugriff galt', () => {
  const entries = [
    session({
      id: 's9',
      at: '2026-08-11T10:00:00Z',
      uid: 'uid-weg',
      email: 'weg@example.ch',
      displayName: 'Ehemaliges Konto',
    } as never),
  ]
  const row = buildRows(entries, USERS, { days: 30, now: NOW }).find((r) => r.uid === 'uid-weg')

  assert.ok(row)
  assert.equal(row.name, 'Ehemaliges Konto')
  assert.equal(row.known, false)
})

test('lässt weg, was ausserhalb des Zeitraums liegt', () => {
  // Zwei Tage: der 10. und der 11. August. Der 9. fällt heraus.
  const rows = buildRows(ENTRIES, USERS, { days: 2, now: NOW })
  const anna = rows.find((row) => row.uid === 'uid-1')

  assert.ok(anna)
  assert.equal(anna.visits, 1)
  assert.equal(anna.minutes, 30)
})

test('legt die Tagesbalken rückwärts von heute an', () => {
  const rows = buildRows(ENTRIES, USERS, { days: 7, now: NOW })
  const anna = rows.find((row) => row.uid === 'uid-1')

  assert.ok(anna)
  assert.equal(anna.perDay.length, 7)
  // Das letzte Feld ist heute (11.08.), das vorletzte gestern (10.08.).
  assert.equal(anna.perDay[6], 1)
  assert.equal(anna.perDay[5], 0)
  // Der Besuch vom 9. August liegt zwei Felder davor.
  assert.equal(anna.perDay[4], 1)
})

/* ------------------------------------------------------------------ */
/* Sortieren                                                           */
/* ------------------------------------------------------------------ */

test('stellt Konten ohne jeden Eintrag ans Ende – ausser beim Namen', () => {
  const rows = buildRows(ENTRIES, USERS, { days: 30, now: NOW })

  assert.deepEqual(
    sortRows(rows, 'last').map((row) => row.uid),
    ['uid-1', 'uid-2', 'uid-3'],
  )
  assert.deepEqual(
    sortRows(rows, 'changes').map((row) => row.uid),
    ['uid-1', 'uid-2', 'uid-3'],
  )
  // Nach Namen sortiert steht das leere Konto dort, wo sein Name hingehört.
  assert.deepEqual(
    sortRows(rows, 'name').map((row) => row.name),
    ['Anna Muster', 'Beat Meier', 'Carla Weber'],
  )
})

/* ------------------------------------------------------------------ */
/* Zeitstrahl                                                          */
/* ------------------------------------------------------------------ */

test('bündelt den Zeitstrahl nach Tagen, neuester zuerst', () => {
  const rows = buildRows(ENTRIES, USERS, { days: 30, now: NOW })
  const anna = rows.find((row) => row.uid === 'uid-1')
  assert.ok(anna)

  const days = groupByDay(anna.entries)
  assert.equal(days.length, 2)
  assert.equal(days[0].date.getDate(), 11)
  assert.equal(days[0].entries.length, 3)
  assert.equal(days[1].date.getDate(), 9)
})

/* ------------------------------------------------------------------ */
/* Die Seite bleibt beim Administrator                                 */
/* ------------------------------------------------------------------ */

test('die Route zum Protokoll steht hinter der Admin-Weiche', () => {
  /*
   * Die eigentliche Sperre stehen die Zugriffsregeln (siehe
   * `tests/firestore-rules.test.js`) – ohne sie bekäme die Seite keine Zeile
   * zu sehen. Trotzdem wird hier nachgesehen: Rutschte die Route aus der
   * Weiche, fiele das niemandem auf, weil das Administrator-Konto ohnehin
   * alles sieht. Auffallen würde es erst, wenn jemand anders eine leere Seite
   * mit einer Fehlermeldung vor sich hat.
   */
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const guardedAt = app.indexOf('<Route element={<RequireAdmin to="/" />}>')

  assert.notEqual(guardedAt, -1, 'App.tsx kennt keine Weiche für das Protokoll mehr')
  assert.ok(app.includes('path="zugriffe"'), 'die Route zum Protokoll fehlt')
  assert.ok(
    app.slice(guardedAt).includes('path="zugriffe"'),
    '/zugriffe steht nicht hinter der Admin-Weiche',
  )
})

test('sagt in einer Zeile, was geschehen ist', () => {
  assert.equal(
    changeSummary(change({ id: 'c1', at: '2026-08-11T19:00:00Z' }), CHANGE_OP_LABELS),
    'Traktanden und Pendenzen geändert',
  )
  assert.equal(
    changeSummary(
      change({ id: 'c2', at: '2026-08-11T19:00:00Z', collectionId: 'members', count: 312 }),
      CHANGE_OP_LABELS,
    ),
    '312 × Mitglieder geändert',
  )
  assert.equal(
    changeSummary(
      change({ id: 'c3', at: '2026-08-11T19:00:00Z', collectionId: 'notes', op: 'delete' }),
      CHANGE_OP_LABELS,
    ),
    'Notizen gelöscht',
  )
})
