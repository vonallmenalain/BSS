import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { addDays } from 'date-fns'
import { Eye, X } from 'lucide-react'
import { useNow } from '@/hooks/useNow'
import { useImpulseItems } from '@/hooks/useFirestore'
import {
  ImpulsePreviewContext,
  previewImpulseWrites,
  useImpulsePreview,
  type ImpulsePreviewState,
} from '@/hooks/useImpulseRuntime'
import { formatDayShort } from '@/lib/dates'
import { formatWeekRange, weekStart } from '@/lib/impulse'
import { emptyPreviewData, initialPreviewDay, previewMoment } from '@/lib/impulsePreview'

/**
 * Die Vorschau der Redaktion um den ganzen Bereich herum.
 *
 * Darin sieht die Seite genau so aus wie bei den Jugendlichen – nur dass
 * sie die gewählte Woche für die laufende hält, eine gespielte Person
 * zeigt und alles, was sie schreiben würde, im Arbeitsspeicher behält
 * (siehe `hooks/useImpulseRuntime` und `lib/impulsePreview`). Wer die
 * Vorschau verlässt, lässt den Stand mit ihr fallen.
 *
 * Oben liegt eine Leiste, die nie verschwindet – auch nicht über dem
 * Vollbild-Feed und den Räumen: Ihre Höhe steht als `--imp-preview-top`
 * am `<html>`, die Seite rückt darunter, und die Vollbild-Ebenen
 * beginnen dort statt am oberen Rand.
 */
export function ImpulsePreviewProvider({
  week,
  onExit,
  children,
}: {
  week: string
  onExit: () => void
  children: ReactNode
}) {
  const realNow = useNow()
  const itemsState = useImpulseItems()
  const [day, setDay] = useState(() => initialPreviewDay(week, Date.now()))
  const [data, setData] = useState(emptyPreviewData)
  /* Die Schreibwege stempeln mit dem gespielten Tag – wechselt er, gibt
     es sie neu. Der Stand bleibt dabei stehen. */
  const writes = useMemo(() => previewImpulseWrites(setData, week, day), [week, day])
  const setCelebrated = useCallback(
    (tag: string) => setData((current) => ({ ...current, celebrated: tag })),
    [],
  )
  const hiddenDrafts = itemsState.data.filter(
    (item) => item.week === week && item.status !== 'ready',
  ).length
  const now = previewMoment(week, day, realNow)

  const value = useMemo<ImpulsePreviewState>(
    () => ({ week, day, setDay, now, data, writes, setCelebrated, hiddenDrafts, exit: onExit }),
    [week, day, setDay, now, data, writes, setCelebrated, hiddenDrafts, onExit],
  )

  return (
    <ImpulsePreviewContext.Provider value={value}>
      <ImpulsePreviewBar />
      <div style={{ paddingTop: 'var(--imp-preview-top, 0px)' }}>{children}</div>
    </ImpulsePreviewContext.Provider>
  )
}

/**
 * Die Leiste der Vorschau: welche Woche, welcher Tag – und der Weg
 * hinaus. Dieselbe Farbe wie die Vorschau einzelner Karten, damit sie
 * niemand mit dem Bereich verwechselt.
 */
function ImpulsePreviewBar() {
  const preview = useImpulsePreview()
  const barRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = barRef.current
    if (!element) return
    const root = document.documentElement
    const apply = () => root.style.setProperty('--imp-preview-top', `${element.offsetHeight}px`)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--imp-preview-top')
    }
  }, [])

  if (!preview) return null
  const start = weekStart(preview.week)
  const days = start ? Array.from({ length: 7 }, (_, index) => addDays(start, index)) : []
  const drafts = preview.hiddenDrafts

  return createPortal(
    <div
      ref={barRef}
      role="region"
      aria-label="Vorschau"
      className="fixed inset-x-0 top-0 z-[80] border-b border-amber-300/60 bg-amber-100/95 pt-safe text-amber-900 backdrop-blur-sm dark:border-amber-800/60 dark:bg-amber-950/95 dark:text-amber-100"
    >
      <div className="mx-auto max-w-3xl px-3 py-2">
        <div className="flex items-center gap-2.5">
          <Eye className="size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm leading-tight">
            <span className="font-semibold">Vorschau</span>
            <span className="hidden sm:inline">
              <span className="mx-1.5">·</span>
              {formatWeekRange(preview.week)}
            </span>
          </p>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={preview.exit}>
            <X className="size-4" aria-hidden />
            Vorschau verlassen
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 ps-6.5 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="opacity-80">Tag</span>
            <select
              value={preview.day}
              onChange={(event) => preview.setDay(Number(event.target.value))}
              className="rounded-md border border-amber-300/80 bg-white/70 px-1.5 py-0.5 font-medium dark:border-amber-800/80 dark:bg-amber-900/40"
            >
              {days.map((date, index) => (
                <option key={index} value={index}>
                  {formatDayShort(date)}
                </option>
              ))}
            </select>
          </label>
          <span className="opacity-80">
            So sehen es die Jugendlichen – gespeichert wird nichts.
            {drafts > 0 &&
              ` ${drafts} ${drafts === 1 ? 'Entwurf ist' : 'Entwürfe sind'} ausgeblendet.`}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
