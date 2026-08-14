import type { CSSProperties } from 'react'
import type { ImpulseImage, ImpulseImageCrop } from './types.ts'

/*
 * Der Ausschnitt eines Bildes – was die Karte davon zeigt.
 *
 * Die App lädt Bilder aus der Mediathek der Kirche, sie schneidet keine
 * Dateien zu. Der Ausschnitt ist darum nichts als eine Rechnung: vier
 * Zahlen in Prozent des Originals (linke obere Ecke, Breite, Höhe). Das
 * Bild bleibt, wie es ist – die Karte zeigt einfach nur einen Teil davon.
 *
 * **Warum Prozent?** Weil die Karte nicht weiss, wie gross das Bild ist,
 * und es nicht erst laden soll, um das zu erfahren. Prozent gelten für
 * jede Auflösung gleich.
 *
 * **Warum trotzdem ein Seitenverhältnis?** Weil Prozent allein nicht
 * sagen, wie hoch der Ausschnitt neben seiner Breite steht: Ein halb so
 * breiter Streifen ist bei einem Hochformat etwas anderes als bei einem
 * Panorama. Die Zahl entsteht dort, wo das Bild ohnehin offen liegt – im
 * Zuschneidefenster der Redaktion (`ImpulseImageCropper`) – und macht
 * jede Karte davon frei, das Bild vermessen zu müssen. Wechselt der
 * Bild-Link, fällt der Ausschnitt weg; ein Mass für ein anderes Bild
 * wäre geraten.
 *
 * Gezeichnet wird mit zwei Kunstgriffen (`cropFrameStyle`,
 * `cropImageStyle`): ein Rahmen im Seitenverhältnis des Ausschnitts, der
 * überstehendes abschneidet, und darin das Bild – so weit vergrössert
 * und so weit verschoben, bis genau der Ausschnitt im Rahmen steht.
 */

/** Kleiner darf ein Ausschnitt nicht werden – sonst greift man ins Leere. */
export const MIN_CROP = 5

/** Ab hier ist der «Ausschnitt» wieder das ganze Bild. */
const FULL_CROP = 99.5

/** Der gezogene Rahmen, in Prozent des Bildes – noch ohne Mass. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/** Die vier Ecken, an denen sich der Rahmen ziehen lässt. */
export type CropHandle = 'nw' | 'ne' | 'sw' | 'se'

export const FULL_RECT: CropRect = { x: 0, y: 0, width: 100, height: 100 }

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * Der Ausschnitt eines Bildes – oder `null`, wenn keiner gewählt ist.
 *
 * Hier geht auch alles durch, was aus der Datenbank kommt: Ältere Karten
 * kennen das Feld gar nicht, und was nicht rechnet (fehlende Zahlen, ein
 * Rahmen ausserhalb des Bildes), zeigt lieber das ganze Bild als ein
 * verzerrtes.
 */
export function impulseCrop(image: ImpulseImage | null | undefined): ImpulseImageCrop | null {
  const crop = image?.crop
  if (!crop) return null
  const { x, y, width, height, ratio } = crop
  const numbers = [x, y, width, height, ratio]
  if (numbers.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null
  if (width <= 0 || height <= 0 || ratio <= 0) return null
  if (x < -0.05 || y < -0.05) return null
  if (x + width > 100.05 || y + height > 100.05) return null
  // Das ganze Bild ist kein Ausschnitt – dann gilt der einfache Weg.
  if (width >= FULL_CROP && height >= FULL_CROP) return null
  return { x, y, width, height, ratio }
}

/**
 * Aus dem gezogenen Rahmen wird der gespeicherte Ausschnitt: gerundet,
 * in die Bildgrenzen gelegt und mit dem Seitenverhältnis versehen, das
 * die Karten später brauchen. `null` heisst: das ganze Bild.
 */
export function toImpulseCrop(
  rect: CropRect,
  natural: { width: number; height: number },
): ImpulseImageCrop | null {
  if (!natural.width || !natural.height) return null
  if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y)) return null
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null
  const width = round(clamp(rect.width, MIN_CROP, 100))
  const height = round(clamp(rect.height, MIN_CROP, 100))
  if (width >= FULL_CROP && height >= FULL_CROP) return null
  const x = round(clamp(rect.x, 0, 100 - width))
  const y = round(clamp(rect.y, 0, 100 - height))
  const ratio = round((width * natural.width) / (height * natural.height), 4)
  if (!Number.isFinite(ratio) || ratio <= 0) return null
  return { x, y, width, height, ratio }
}

/** Der gespeicherte Ausschnitt zurück im Zuschneidefenster. */
export function toCropRect(crop: ImpulseImageCrop | null | undefined): CropRect {
  if (!crop) return { ...FULL_RECT }
  return { x: crop.x, y: crop.y, width: crop.width, height: crop.height }
}

/**
 * Der Rahmen nach einem Zug – verschoben (`move`) oder an einer Ecke
 * gezogen. Beides in Prozent, beides bleibt im Bild: Verschieben ändert
 * die Grösse nicht, Ziehen lässt die gegenüberliegende Ecke stehen.
 */
export function nextCropRect(
  mode: 'move' | CropHandle,
  base: CropRect,
  dx: number,
  dy: number,
): CropRect {
  if (mode === 'move') {
    return {
      ...base,
      x: clamp(base.x + dx, 0, 100 - base.width),
      y: clamp(base.y + dy, 0, 100 - base.height),
    }
  }

  const right = base.x + base.width
  const bottom = base.y + base.height
  const west = mode === 'nw' || mode === 'sw'
  const north = mode === 'nw' || mode === 'ne'

  const x = west ? clamp(base.x + dx, 0, right - MIN_CROP) : base.x
  const y = north ? clamp(base.y + dy, 0, bottom - MIN_CROP) : base.y
  const width = west ? right - x : clamp(base.width + dx, MIN_CROP, 100 - base.x)
  const height = north ? bottom - y : clamp(base.height + dy, MIN_CROP, 100 - base.y)

  return { x, y, width, height }
}

/**
 * Der Rahmen: so breit, wie es der Platz hergibt, aber nie höher als
 * `maxHeight` – und immer im Seitenverhältnis des Ausschnitts, damit im
 * Rahmen nichts verzogen steht.
 *
 * Er gehört in einen Kasten bekannter Breite (eine gewöhnliche Zeile im
 * Fluss); in einem Kasten, der sich erst am Inhalt misst (`w-fit`),
 * hätte die Prozentbreite nichts, worauf sie sich beziehen könnte.
 */
export function cropFrameStyle(crop: ImpulseImageCrop, maxHeight: string): CSSProperties {
  return {
    aspectRatio: `${crop.ratio}`,
    width: `min(100%, calc(${maxHeight} * ${crop.ratio}))`,
  }
}

/**
 * Das Bild im Rahmen: so weit vergrössert, dass der Ausschnitt den
 * Rahmen füllt, und so weit hinausgeschoben, dass seine linke obere Ecke
 * in der des Rahmens liegt. Der Rest steht über und wird abgeschnitten
 * (der Rahmen trägt `overflow-hidden`).
 */
export function cropImageStyle(crop: ImpulseImageCrop): CSSProperties {
  return {
    position: 'absolute',
    width: `${(100 / crop.width) * 100}%`,
    height: `${(100 / crop.height) * 100}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
    // Ohne diese Zeile bliebe das Bild bei der Breite der Karte stehen.
    maxWidth: 'none',
  }
}
