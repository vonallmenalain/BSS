import assert from 'node:assert/strict'
import { test } from 'node:test'

import { qrCode } from '../src/lib/qr.ts'

/*
 * Läuft ohne Bundler direkt in Node: `npm run test:import`.
 *
 * Ob ein QR-Code stimmt, entscheidet am Ende das Telefon, das ihn liest. Der
 * Code unten wurde deshalb einmal gegen einen unabhängigen Leser geprüft
 * (jsQR) und Modul für Modul mit einer verbreiteten Bibliothek verglichen
 * (`qrcode` bei gleicher Maske) – über alle Versionen 1 bis 6, mit Umlauten
 * und genau an den Grenzen der Versionen. Hier steht das Ergebnis für die
 * Adresse, um die es geht, dazu die Teile, die jeder Leser zuerst sucht.
 */

const URL = 'https://bss.alae.app/putzplan'

/** `bss.alae.app/putzplan`, Version 3, Maske 0 – so liest ihn jedes Telefon. */
const EXPECTED = [
  '#######....#..#....#..#######',
  '#.....#.####.#...###..#.....#',
  '#.###.#....##..#....#.#.###.#',
  '#.###.#....###..#.###.#.###.#',
  '#.###.#.#...##..#..#..#.###.#',
  '#.....#..#....#######.#.....#',
  '#######.#.#.#.#.#.#.#.#######',
  '...........##..#.#..#........',
  '#.#.#.#..####...##.##...#..#.',
  '.#......######.##.#..##..#..#',
  '.##..###..##..#####.#.#...###',
  '###..#..#..####.##.#....#..#.',
  '.....##.#.#...##.#...##..#.##',
  '#..#.#..###.#.##.##.####.#..#',
  '#####.##.#...#....#.##.#.#.##',
  '#.#....##.#.#..#.#.#.#.#.#.#.',
  '###.######.#....##...###.#.##',
  '.##.#..###.#.#.##...###..##.#',
  '#....##...#...###.....##...##',
  '.#.###.#.######.##.#...#.#.#.',
  '#.#...####.#..##.#..#####....',
  '........#.....##.#.##...#.###',
  '#######..##..#....###.#.##.##',
  '#.....#...###..#.##.#...##...',
  '#.###.#.#####...##..#####..#.',
  '#.###.#...#.#..##..##...#.#..',
  '#.###.#.##.#######.#...###..#',
  '#.....#...#.....##.##..##..#.',
  '#######.####.####.#.###.#..##',
]

function picture(modules: boolean[][]): string[] {
  return modules.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''))
}

/** Die 15 Formatbits der ersten Kopie – um das Suchmuster oben links. */
function formatBits(modules: boolean[][]): number {
  const at = (x: number, y: number) => (modules[y][x] ? 1 : 0)
  let bits = 0
  for (let index = 0; index <= 5; index++) bits |= at(8, index) << index
  bits |= at(8, 7) << 6
  bits |= at(8, 8) << 7
  bits |= at(7, 8) << 8
  for (let index = 9; index < 15; index++) bits |= at(14 - index, 8) << index
  return bits
}

/** Dieselben 15 Bits, zweite Kopie – geteilt zwischen unten links und oben rechts. */
function formatBitsCopy(modules: boolean[][]): number {
  const size = modules.length
  const at = (x: number, y: number) => (modules[y][x] ? 1 : 0)
  let bits = 0
  for (let index = 0; index < 8; index++) bits |= at(size - 1 - index, 8) << index
  for (let index = 8; index < 15; index++) bits |= at(8, size - 15 + index) << index
  return bits
}

test('die Adresse des Putzplans – Modul für Modul', () => {
  assert.deepEqual(picture(qrCode(URL)), EXPECTED)
})

test('die Version wächst mit dem Text – und bei Version 6 ist Schluss', () => {
  assert.equal(qrCode('A').length, 21) // Version 1
  assert.equal(qrCode('x'.repeat(14)).length, 21)
  assert.equal(qrCode('x'.repeat(15)).length, 25) // Version 2
  assert.equal(qrCode(URL).length, 29) // Version 3
  assert.equal(qrCode('x'.repeat(106)).length, 41) // Version 6
  assert.throws(() => qrCode('x'.repeat(107)), RangeError)
  // Ein Umlaut zählt als zwei Bytes: 14 Zeichen, aber 15 Bytes.
  assert.equal(qrCode('ä' + 'x'.repeat(13)).length, 25)
})

test('Suchmuster in drei Ecken, dazwischen die Taktlinien', () => {
  const modules = qrCode(URL)
  const size = modules.length
  const finder = ['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#.....#', '#######']
  const corner = (x: number, y: number) =>
    finder.map((_, row) =>
      modules[y + row]
        .slice(x, x + 7)
        .map((dark) => (dark ? '#' : '.'))
        .join(''),
    )

  assert.deepEqual(corner(0, 0), finder)
  assert.deepEqual(corner(size - 7, 0), finder)
  assert.deepEqual(corner(0, size - 7), finder)
  // Unten rechts steht keines – daran erkennt der Leser, wo oben ist.
  assert.notDeepEqual(corner(size - 7, size - 7), finder)

  for (let index = 8; index < size - 8; index++) {
    assert.equal(modules[6][index], index % 2 === 0, `Taktlinie waagrecht, ${index}`)
    assert.equal(modules[index][6], index % 2 === 0, `Taktlinie senkrecht, ${index}`)
  }
})

test('die Formatangaben stehen zweimal da – Stufe «M», gültig geschützt', () => {
  const modules = qrCode(URL)
  const bits = formatBits(modules)
  assert.equal(formatBitsCopy(modules), bits)

  const raw = bits ^ 0x5412
  assert.equal(raw >>> 13, 0b00, 'Stufe M')
  // Der Rest der Division durch das Generatorpolynom ist null.
  let rest = raw
  for (let bit = 14; bit >= 10; bit--) if ((rest >>> bit) & 1) rest ^= 0x537 << (bit - 10)
  assert.equal(rest, 0)
})
