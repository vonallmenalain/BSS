import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus, X } from 'lucide-react'
import { cropImageStyle } from '@/lib/impulseCrop'
import { lockScroll } from '@/lib/scrollLock'
import type { ImpulseImageCrop } from '@/lib/types'

/*
 * Das Vollbild eines Bilderrätsel-Bildes – ein Tipp auf das Bild öffnet
 * es hier, gross und zoombar: Details erkennen gehört beim Rätseln dazu.
 *
 * Hat die Karte einen Ausschnitt, gilt er auch hier: Das Vollbild ist
 * die Lupe auf die Karte, nicht der Blick hinter sie – sonst stünde beim
 * Bilderrätsel plötzlich da, was die Redaktion weggelassen hat.
 *
 * Gezoomt wird, wie es das Gerät hergibt: mit zwei Fingern (Pinch), mit
 * dem Mausrad, mit Doppeltipp (hinein und wieder heraus) – und immer auch
 * über die Knöpfe unten, für alle ohne Geste. Verschoben wird nativ: Der
 * Rollcontainer übernimmt das Ziehen mit einem Finger oder der Maus,
 * darum bleibt die Mechanik klein. Geschlossen wird mit dem Knopf oben
 * rechts oder mit Escape – Escape wandert dabei nicht weiter zum
 * Vollbild-Feed darunter.
 */

const MIN_SCALE = 1
const MAX_SCALE = 5

export function ImpulseImageLightbox({
  url,
  alt,
  crop = null,
  onClose,
}: {
  url: string
  alt?: string
  /** Der Ausschnitt der Karte – ohne ihn gilt das ganze Bild. */
  crop?: ImpulseImageCrop | null
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  /* Der Massstab: 1 = eingepasst. `base` ist die eingepasste Grösse in
     Pixeln – gemessen, sobald das Bild da ist; daraus rechnet der Zoom. */
  const [scale, setScale] = useState(1)
  const scaleRef = useRef(1)
  const [base, setBase] = useState<{ w: number; h: number } | null>(null)
  const pendingScroll = useRef<{ left: number; top: number } | null>(null)

  /* Hinter dem Vollbild soll nichts mitrollen. */
  useEffect(() => lockScroll(), [])

  /* Escape schliesst nur das Bild – nicht auch noch den Feed darunter:
     Der Lauscher hängt in der Capture-Phase und stoppt das Ereignis. */
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  /* Die eingepasste Grösse: so gross wie möglich, ohne Beschnitt.
     Gemessen wird, was gezeigt wird – beim Ausschnitt also nur sein
     Teil des Bildes. Die Rechnung hängt an den beiden Massen, nicht am
     Ausschnitt selbst: Der ist bei jedem Zeichnen ein neues Objekt und
     würde das Messen endlos anstossen. */
  const shownPart = { width: crop?.width ?? 100, height: crop?.height ?? 100 }
  const measure = useCallback(() => {
    const img = imgRef.current
    const box = boxRef.current
    if (!img || !box || !img.naturalWidth || !img.naturalHeight) return
    const shownW = (img.naturalWidth * shownPart.width) / 100
    const shownH = (img.naturalHeight * shownPart.height) / 100
    const availableW = Math.max(box.clientWidth - 32, 1)
    const availableH = Math.max(box.clientHeight - 32, 1)
    const fit = Math.min(availableW / shownW, availableH / shownH)
    setBase({ w: shownW * fit, h: shownH * fit })
  }, [shownPart.width, shownPart.height])
  useEffect(() => {
    // Ein aus dem Speicher geladenes Bild feuert `onLoad` nicht immer.
    if (imgRef.current?.complete) measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  /**
   * Zoomen um einen Brennpunkt: Der Punkt unter Finger bzw. Zeiger bleibt
   * beim Vergrössern an Ort – dafür wird die Rollposition mitgerechnet
   * und nach dem Zeichnen gesetzt (`pendingScroll`).
   */
  const zoomAt = (next: number, clientX?: number, clientY?: number) => {
    const box = boxRef.current
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
    const current = scaleRef.current
    if (clamped === current) return
    if (box) {
      const rect = box.getBoundingClientRect()
      const focusX = (clientX ?? rect.left + rect.width / 2) - rect.left
      const focusY = (clientY ?? rect.top + rect.height / 2) - rect.top
      const ratio = clamped / current
      pendingScroll.current = {
        left: (box.scrollLeft + focusX) * ratio - focusX,
        top: (box.scrollTop + focusY) * ratio - focusY,
      }
    }
    scaleRef.current = clamped
    setScale(clamped)
  }
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box || !pendingScroll.current) return
    box.scrollTo(pendingScroll.current)
    pendingScroll.current = null
  }, [scale])

  /* Mausrad zoomt – von Hand angehängt, weil `preventDefault` einen
     nicht-passiven Lauscher braucht. */
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2
      zoomAt(scaleRef.current * factor, event.clientX, event.clientY)
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [])

  /* Pinch: zwei Zeiger, der Abstand macht den Massstab. Das Ziehen mit
     einem Finger bleibt beim Rollcontainer (touch-action erlaubt Pan). */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; scale: number } | null>(null)
  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const onPointerDown = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      pinch.current = { distance: pinchDistance(), scale: scaleRef.current }
    }
  }
  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size !== 2 || !pinch.current) return
    const [a, b] = [...pointers.current.values()]
    zoomAt(
      pinch.current.scale * (pinchDistance() / pinch.current.distance),
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
    )
  }
  const onPointerEnd = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const zoomedIn = scale > 1.01

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Bild vergrössert'}
      tabIndex={-1}
      className="animate-fade-in fixed inset-0 z-[60] bg-slate-950/95 outline-none"
    >
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={(event) =>
          zoomedIn ? zoomAt(1) : zoomAt(2.5, event.clientX, event.clientY)
        }
        className="no-scrollbar h-full w-full touch-pan-x touch-pan-y overflow-auto overscroll-contain"
      >
        <div className="flex min-h-full w-max min-w-full p-4">
          {crop ? (
            /* Der Ausschnitt in einem Rahmen, der ihn abschneidet – das
               Bild darin ist so gross, wie es der Zoom sagt. Solange
               nichts gemessen ist, steht der Rahmen in Bildschirmbreite:
               richtig geschnitten, nur noch nicht eingepasst. */
            <div
              className="relative m-auto shrink-0 overflow-hidden select-none"
              style={
                base
                  ? { width: base.w * scale, height: base.h * scale }
                  : { width: '90vw', aspectRatio: `${crop.ratio}` }
              }
            >
              <img
                ref={imgRef}
                src={url}
                alt={alt || 'Bild zum Rätsel'}
                onLoad={measure}
                draggable={false}
                className="max-w-none select-none"
                style={cropImageStyle(crop)}
              />
            </div>
          ) : (
            <img
              ref={imgRef}
              src={url}
              alt={alt || 'Bild zum Rätsel'}
              onLoad={measure}
              draggable={false}
              style={
                base
                  ? { width: base.w * scale, height: base.h * scale, maxWidth: 'none' }
                  : undefined
              }
              className={
                base
                  ? 'm-auto shrink-0 select-none'
                  : 'm-auto max-h-full max-w-full object-contain select-none'
              }
            />
          )}
        </div>
      </div>

      {/* Schliessen oben rechts – gut erreichbar, über der Notch-Luft. */}
      <div className="absolute inset-x-0 top-0 pt-safe">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
          aria-label="Bild schliessen"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* Die Zoom-Leiste – für alle ohne Pinch und Rad. Der Zwischenstand
          ist zugleich der Weg zurück auf «eingepasst». */}
      <div className="absolute inset-x-0 bottom-0 pb-safe">
        <div className="mx-auto mb-3 flex w-fit items-center gap-1 rounded-full bg-white/10 p-1 text-white backdrop-blur-sm">
          <button
            type="button"
            onClick={() => zoomAt(scale / 1.5)}
            disabled={!zoomedIn}
            className="grid size-9 place-items-center rounded-full transition hover:bg-white/15 active:scale-95 disabled:opacity-40"
            aria-label="Verkleinern"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => zoomAt(1)}
            className="tabular min-w-14 rounded-full px-2 py-1.5 text-center text-xs font-medium transition hover:bg-white/15"
            title="Wieder einpassen"
          >
            {Math.round(scale * 100)} %
          </button>
          <button
            type="button"
            onClick={() => zoomAt(scale * 1.5)}
            disabled={scale >= MAX_SCALE - 0.01}
            className="grid size-9 place-items-center rounded-full transition hover:bg-white/15 active:scale-95 disabled:opacity-40"
            aria-label="Vergrössern"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
