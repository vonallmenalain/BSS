import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  FULL_RECT,
  MIN_CROP,
  cropFrameStyle,
  cropImageStyle,
  impulseCrop,
  nextCropRect,
  toCropRect,
  toImpulseCrop,
} from '../src/lib/impulseCrop.ts'
import type { ImpulseImage } from '../src/lib/types.ts'

/*
 * Der Bildausschnitt einer Karte (src/lib/impulseCrop.ts).
 *
 * Zwei Dinge müssen stimmen, sonst steht das Bild schief in der Karte:
 * die Rechnung, die aus dem gezogenen Rahmen den gespeicherten
 * Ausschnitt macht (Grenzen, Rundung, Seitenverhältnis) – und die
 * Rechnung, die daraus Prozentwerte fürs Zeichnen macht.
 *
 * Dazu die Nachsicht mit dem, was aus der Datenbank kommt: Ältere Karten
 * kennen das Feld gar nicht, und Unsinn darf höchstens dazu führen, dass
 * das ganze Bild dasteht – nie zu einem verzerrten Bild.
 */

const image = (crop: unknown): ImpulseImage =>
  ({ url: 'https://example.org/bild.jpg', crop }) as ImpulseImage

test('ohne Ausschnitt gilt das ganze Bild', () => {
  assert.equal(impulseCrop(null), null)
  assert.equal(impulseCrop(undefined), null)
  assert.equal(impulseCrop({ url: 'https://example.org/bild.jpg' }), null)
  assert.equal(impulseCrop(image(null)), null)
})

test('ein Ausschnitt über das ganze Bild ist keiner', () => {
  assert.equal(impulseCrop(image({ x: 0, y: 0, width: 100, height: 100, ratio: 1.5 })), null)
  // Ein Teil davon ist einer – auch wenn nur die Höhe beschnitten ist.
  assert.deepEqual(impulseCrop(image({ x: 0, y: 10, width: 100, height: 80, ratio: 2 })), {
    x: 0,
    y: 10,
    width: 100,
    height: 80,
    ratio: 2,
  })
})

test('unbrauchbare Masse zeigen lieber das ganze Bild', () => {
  const kaputt = [
    { x: 0, y: 0, width: 50, height: 50 }, // ohne Seitenverhältnis
    { x: 0, y: 0, width: 50, height: 50, ratio: 0 },
    { x: 0, y: 0, width: 0, height: 50, ratio: 1 },
    { x: -5, y: 0, width: 50, height: 50, ratio: 1 },
    { x: 60, y: 0, width: 50, height: 50, ratio: 1 }, // ragt hinaus
    { x: 0, y: 60, width: 50, height: 50, ratio: 1 },
    { x: 0, y: 0, width: 50, height: 50, ratio: Number.NaN },
    { x: '10', y: 0, width: 50, height: 50, ratio: 1 },
  ]
  for (const crop of kaputt) assert.equal(impulseCrop(image(crop)), null, JSON.stringify(crop))
})

test('aus dem gezogenen Rahmen wird der gespeicherte Ausschnitt', () => {
  const crop = toImpulseCrop({ x: 10, y: 20, width: 50, height: 25 }, { width: 1600, height: 900 })
  assert.ok(crop)
  assert.deepEqual(crop, {
    x: 10,
    y: 20,
    width: 50,
    height: 25,
    // (50 % von 1600) ÷ (25 % von 900) = 800 ÷ 225
    ratio: 3.5556,
  })
  // Was gespeichert wird, kommt auch wieder heraus.
  assert.deepEqual(impulseCrop(image(crop)), crop)
})

test('der Rahmen bleibt im Bild – auch wenn der Zug hinausführt', () => {
  const crop = toImpulseCrop(
    { x: 90, y: -30, width: 40, height: 40 },
    { width: 1000, height: 1000 },
  )
  assert.deepEqual(crop, { x: 60, y: 0, width: 40, height: 40, ratio: 1 })
})

test('das ganze Bild ist kein Ausschnitt, und ohne Bildgrösse rechnet nichts', () => {
  assert.equal(toImpulseCrop(FULL_RECT, { width: 800, height: 600 }), null)
  assert.equal(
    toImpulseCrop({ x: 0, y: 0, width: 50, height: 50 }, { width: 0, height: 600 }),
    null,
  )
})

test('der gespeicherte Ausschnitt liegt beim Öffnen wieder im Rahmen', () => {
  assert.deepEqual(toCropRect(null), FULL_RECT)
  assert.deepEqual(toCropRect({ x: 5, y: 6, width: 30, height: 40, ratio: 0.8 }), {
    x: 5,
    y: 6,
    width: 30,
    height: 40,
  })
})

test('verschieben ändert die Grösse nicht und hält am Rand an', () => {
  const base = { x: 10, y: 10, width: 40, height: 30 }
  assert.deepEqual(nextCropRect('move', base, 5, -5), {
    x: 15,
    y: 5,
    width: 40,
    height: 30,
  })
  // Oben links ist Schluss …
  assert.deepEqual(nextCropRect('move', base, -50, -50), { x: 0, y: 0, width: 40, height: 30 })
  // … und unten rechts genauso, ohne dass der Rahmen schrumpft.
  assert.deepEqual(nextCropRect('move', base, 90, 90), { x: 60, y: 70, width: 40, height: 30 })
})

test('an einer Ecke ziehen lässt die gegenüberliegende stehen', () => {
  const base = { x: 20, y: 20, width: 40, height: 40 }
  // Unten rechts grösser ziehen: oben links bleibt liegen.
  assert.deepEqual(nextCropRect('se', base, 10, 5), { x: 20, y: 20, width: 50, height: 45 })
  // Oben links ziehen: unten rechts bleibt liegen (60/60).
  const nordwest = nextCropRect('nw', base, 10, 10)
  assert.deepEqual(nordwest, { x: 30, y: 30, width: 30, height: 30 })
  assert.equal(nordwest.x + nordwest.width, 60)
  // Gemischt: links ziehen, unten wachsen.
  assert.deepEqual(nextCropRect('sw', base, -20, 20), { x: 0, y: 20, width: 60, height: 60 })
})

test('der Rahmen wird nicht kleiner als das Mindestmass und nicht grösser als das Bild', () => {
  const base = { x: 20, y: 20, width: 40, height: 40 }
  const winzig = nextCropRect('se', base, -100, -100)
  assert.deepEqual(winzig, { x: 20, y: 20, width: MIN_CROP, height: MIN_CROP })
  // Über die eigene Kante hinaus geht es nicht – die Ecke bleibt stehen.
  const gedreht = nextCropRect('nw', base, 100, 100)
  assert.deepEqual(gedreht, {
    x: 60 - MIN_CROP,
    y: 60 - MIN_CROP,
    width: MIN_CROP,
    height: MIN_CROP,
  })
  const riesig = nextCropRect('se', base, 100, 100)
  assert.deepEqual(riesig, { x: 20, y: 20, width: 80, height: 80 })
})

test('das Bild steht im Rahmen so, dass genau der Ausschnitt zu sehen ist', () => {
  const crop = { x: 25, y: 10, width: 50, height: 20, ratio: 2 }
  const style = cropImageStyle(crop)
  // Halb so breiter Ausschnitt heisst doppelt so breites Bild …
  assert.equal(style.width, '200%')
  assert.equal(style.height, '500%')
  // … und die linke Kante des Ausschnitts liegt auf der des Rahmens.
  assert.equal(style.left, '-50%')
  assert.equal(style.top, '-50%')
  assert.equal(style.maxWidth, 'none')
})

test('der Rahmen hält das Seitenverhältnis und die Höhengrenze', () => {
  const style = cropFrameStyle({ x: 0, y: 0, width: 50, height: 25, ratio: 1.75 }, '16rem')
  assert.equal(style.aspectRatio, '1.75')
  assert.equal(style.width, 'min(100%, calc(16rem * 1.75))')
})
