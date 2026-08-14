import { useEffect, useRef, useState } from 'react'
import { Check, Maximize } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import {
  FULL_RECT,
  cropImageStyle,
  nextCropRect,
  toCropRect,
  toImpulseCrop,
  type CropHandle,
  type CropRect,
} from '@/lib/impulseCrop'
import type { ImpulseImageCrop } from '@/lib/types'

/*
 * Das Zuschneidefenster – es öffnet sich neben dem Bild-Link, in der
 * Redaktion wie in der Mitmach-Ecke (`ImpulseItemFields`).
 *
 * Es zeigt das Bild und darüber einen Rahmen: verschieben mit dem Finger
 * oder der Maus, an den vier Ecken grösser und kleiner ziehen. Was
 * ausserhalb liegt, liegt im Schatten – so sieht man auf einen Blick,
 * was die Karte später zeigt. Darunter steht dasselbe noch einmal so,
 * wie es auf der Karte ankommt.
 *
 * Zugeschnitten wird dabei nichts: Gespeichert werden vier Masse in
 * Prozent (`lib/impulseCrop`), das Bild selbst bleibt unangetastet in
 * der Mediathek liegen. «Ganzes Bild» legt den Rahmen wieder um alles –
 * damit ist der Ausschnitt weg, nicht bloss gross.
 *
 * Das Fenster wird von seinem Formular ein- und ausgehängt statt auf-
 * und zugeklappt: So beginnt der Rahmen bei jedem Öffnen dort, wo der
 * gespeicherte Ausschnitt liegt, ohne dass ein Effekt ihn zurückstellen
 * müsste.
 */

const HANDLES: { handle: CropHandle; position: string; cursor: string }[] = [
  { handle: 'nw', position: 'top-1 left-1', cursor: 'cursor-nwse-resize' },
  { handle: 'ne', position: 'top-1 right-1', cursor: 'cursor-nesw-resize' },
  { handle: 'sw', position: 'bottom-1 left-1', cursor: 'cursor-nesw-resize' },
  { handle: 'se', position: 'bottom-1 right-1', cursor: 'cursor-nwse-resize' },
]

export function ImpulseImageCropper({
  url,
  alt,
  crop,
  onApply,
  onClose,
}: {
  url: string
  alt?: string
  /** Der bisherige Ausschnitt – der Rahmen beginnt, wo er aufhörte. */
  crop: ImpulseImageCrop | null
  /** `null` heisst: das ganze Bild. */
  onApply: (crop: ImpulseImageCrop | null) => void
  onClose: () => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [rect, setRect] = useState<CropRect>(() => toCropRect(crop))
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)

  /* Ohne die echte Bildgrösse kein Seitenverhältnis – und ohne das
     wüsste keine Karte, wie hoch der Ausschnitt steht. */
  const measure = () => {
    const img = imgRef.current
    if (!img?.naturalWidth || !img.naturalHeight) return
    setNatural({ width: img.naturalWidth, height: img.naturalHeight })
  }
  useEffect(() => {
    // Ein aus dem Speicher geladenes Bild feuert `onLoad` nicht immer.
    if (imgRef.current?.complete) measure()
  }, [])

  /*
   * Escape schliesst nur dieses Fenster, nicht auch das Formular
   * darunter: Der Lauscher hängt am Fenster und kommt damit vor dem des
   * Dialogs (der am Dokument hängt) – wie beim Vollbild eines Bildes.
   */
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  /* Ein Zug merkt sich, wo er begann: Gerechnet wird immer vom
     Ausgangsrahmen aus, nie vom letzten Zwischenstand – so läuft nichts
     davon, wenn ein Ereignis ausfällt. */
  const drag = useRef<{
    mode: 'move' | CropHandle
    x: number
    y: number
    rect: CropRect
    box: DOMRect
  } | null>(null)

  const begin = (mode: 'move' | CropHandle, event: React.PointerEvent) => {
    const box = frameRef.current?.getBoundingClientRect()
    if (!box?.width || !box.height) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { mode, x: event.clientX, y: event.clientY, rect, box }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const gesture = drag.current
    if (!gesture) return
    const dx = ((event.clientX - gesture.x) / gesture.box.width) * 100
    const dy = ((event.clientY - gesture.y) / gesture.box.height) * 100
    setRect(nextCropRect(gesture.mode, gesture.rect, dx, dy))
  }

  const onPointerEnd = () => {
    drag.current = null
  }

  /* Was jetzt gälte – zugleich die Vorschau und das, was «Übernehmen»
     weitergibt. `null` heisst: das ganze Bild. */
  const applied = natural ? toImpulseCrop(rect, natural) : null
  const whole = rect.width >= 100 && rect.height >= 100

  return (
    <Modal
      open
      onClose={onClose}
      title="Bildausschnitt"
      size="lg"
      footer={
        <>
          <button
            type="button"
            className="btn-ghost me-auto"
            onClick={() => setRect({ ...FULL_RECT })}
            disabled={whole}
          >
            <Maximize className="size-4" aria-hidden />
            Ganzes Bild
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!natural}
            onClick={() => {
              onApply(applied)
              onClose()
            }}
          >
            <Check className="size-4" aria-hidden />
            Übernehmen
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex justify-center">
          <div
            ref={frameRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            className="relative w-fit touch-none overflow-hidden rounded-lg select-none"
          >
            <img
              ref={imgRef}
              src={url}
              alt={alt || 'Bild der Karte'}
              onLoad={measure}
              draggable={false}
              className="block max-h-[50vh] max-w-full"
            />
            {/* Ein einziger, riesiger Schlagschatten legt alles ausserhalb
                des Rahmens ins Dunkel; der helle Strich liegt innen, damit
                ihn der Schatten nicht verschluckt. */}
            <div
              onPointerDown={(event) => begin('move', event)}
              className="absolute cursor-move touch-none"
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.width}%`,
                height: `${rect.height}%`,
                boxShadow:
                  'inset 0 0 0 2px rgb(255 255 255 / 0.9), 0 0 0 9999px rgb(2 6 23 / 0.55)',
              }}
            >
              {HANDLES.map(({ handle, position, cursor }) => (
                <span
                  key={handle}
                  onPointerDown={(event) => begin(handle, event)}
                  className={cn(
                    'bg-brand-500 absolute size-5 touch-none rounded-full border-2 border-white shadow',
                    position,
                    cursor,
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="label">Auf der Karte</p>
          <ImpulseCropPreview url={url} alt={alt} crop={applied} height="7rem" />
        </div>
      </div>
    </Modal>
  )
}

/**
 * Das Bild, wie die Karte es zeigt – mit Ausschnitt, wenn einer gewählt
 * ist. Es steht im Zuschneidefenster unter dem Rahmen und im Formular
 * unter dem Bild-Link, damit man dort nicht raten muss.
 */
export function ImpulseCropPreview({
  url,
  alt,
  crop,
  height = '12rem',
}: {
  url: string
  alt?: string
  crop: ImpulseImageCrop | null
  /** Wie hoch die Vorschau höchstens steht. */
  height?: string
}) {
  const shape =
    'rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800'
  if (!crop) {
    return (
      <img
        src={url}
        alt={alt || 'Vorschau des Bildes'}
        style={{ maxHeight: height }}
        className={cn('mx-auto block w-auto max-w-full object-contain', shape)}
      />
    )
  }
  return (
    <div
      className={cn('relative mx-auto overflow-hidden', shape)}
      style={{ aspectRatio: `${crop.ratio}`, width: `min(100%, calc(${height} * ${crop.ratio}))` }}
    >
      <img
        src={url}
        alt={alt || 'Vorschau des Bildes'}
        draggable={false}
        className="max-w-none"
        style={cropImageStyle(crop)}
      />
    </div>
  )
}
