import { useState, type DragEvent } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react'
import { moveInList } from '@/services/sacrament'

/**
 * Umsortieren einer Liste – mit Pfeilen und, am Zeigergerät, mit Ziehen.
 *
 * Beides zusammen, weil beides gebraucht wird: Am Telefon wird die Liste
 * vorbereitet, und dort gibt es kein Ziehen; am Schreibtisch ist Ziehen der
 * kürzere Weg, sobald ein Eintrag nicht eine Stelle weiter soll, sondern
 * nach ganz oben. Dieselben zwei Wege stehen an der Pendenzenliste und in
 * einer Berufungsrunde – hier ist es derselbe Griff.
 *
 * Gezogen wird nur am Griff. In den Zeilen stehen Textfelder; wäre die ganze
 * Zeile zum Ziehen freigegeben, liesse sich darin kein Wort mehr markieren.
 * `draggable` gilt deshalb erst ab dem Griff der Maus auf den Griff – und
 * danach wieder nicht.
 */
export interface ReorderRow {
  /** Auf das Element der Zeile */
  dragProps: {
    draggable: boolean
    onDragStart: (event: DragEvent<HTMLElement>) => void
    onDragOver: (event: DragEvent<HTMLElement>) => void
    onDrop: (event: DragEvent<HTMLElement>) => void
    onDragEnd: () => void
    onMouseUp: () => void
  }
  /** Diese Zeile wird gerade gezogen. */
  dragging: boolean
  /** Hier würde sie abgelegt. */
  dropTarget: boolean
}

export interface Reorder {
  /** Ein Element um eine Stelle nach oben (-1) oder unten (+1) schieben. */
  move: (index: number, delta: number) => void
  row: (key: string) => ReorderRow
  /** Auf den Griff – er gibt die Zeile zum Ziehen frei. */
  grab: (key: string) => void
}

export function useReorder<T>(
  items: T[],
  keyOf: (item: T) => string,
  onOrder: (next: T[]) => void,
): Reorder {
  const [grabbed, setGrabbed] = useState<string | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const release = () => {
    setGrabbed(null)
    setDragged(null)
    setOver(null)
  }

  const move = (index: number, delta: number) => {
    const next = moveInList(items, index, delta)
    if (next !== items) onOrder(next)
  }

  /*
   * Abgelegt wird **auf** eine Zeile, und der gezogene Eintrag tritt an ihre
   * Stelle: Wer von unten nach oben zieht, landet vor der Zeile, auf der er
   * loslässt – wer von oben nach unten zieht, dahinter. Beides ergibt sich
   * von selbst, wenn der Eintrag zuerst herausgenommen und dann an der
   * Stelle der Zielzeile wieder eingesetzt wird.
   */
  const drop = (key: string) => {
    if (dragged === null || dragged === key) return
    const from = items.findIndex((item) => keyOf(item) === dragged)
    const to = items.findIndex((item) => keyOf(item) === key)
    if (from < 0 || to < 0) return

    const next = [...items]
    const [entry] = next.splice(from, 1)
    next.splice(to, 0, entry)
    onOrder(next)
  }

  return {
    move,
    grab: setGrabbed,
    row: (key) => ({
      dragging: dragged === key,
      dropTarget: over === key && dragged !== key,
      dragProps: {
        draggable: grabbed === key,
        onDragStart: (event) => {
          setDragged(key)
          event.dataTransfer.effectAllowed = 'move'
        },
        onDragOver: (event) => {
          if (dragged === null) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setOver(key)
        },
        onDrop: (event) => {
          event.preventDefault()
          drop(key)
          release()
        },
        onDragEnd: release,
        // Wer den Griff loslässt, ohne gezogen zu haben, gibt die Zeile
        // wieder frei – sonst bliebe sie zum Ziehen offen und der Text darin
        // unmarkierbar.
        onMouseUp: release,
      },
    }),
  }
}

/**
 * Die schmale Spalte zum Umsortieren: Griff und zwei Pfeile.
 *
 * Der Griff steht nur am Zeigergerät da – am Telefon zeigt der Browser kein
 * Ziehen an, und ein Zeichen, das nichts tut, ist schlimmer als keines. Die
 * Pfeile stehen überall und sind dort der einzige Weg.
 */
export function ReorderControls({
  label,
  first,
  last,
  onMove,
  onGrab,
  onRemove,
  removeLabel = 'Entfernen',
}: {
  /** Für die Vorlesehilfe, z. B. «Bekanntmachung 2» */
  label: string
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onGrab: () => void
  /** Fehlt er, steht der Papierkorb an anderer Stelle – oder gar nicht. */
  onRemove?: () => void
  removeLabel?: string
}) {
  return (
    <div className="flex shrink-0 flex-col items-center">
      <span
        className="hidden cursor-grab py-0.5 text-slate-300 active:cursor-grabbing sm:block dark:text-slate-600"
        onMouseDown={onGrab}
        title="Ziehen zum Umsortieren"
        aria-hidden
      >
        <GripVertical className="size-4" />
      </span>

      <button
        type="button"
        className="btn-ghost p-1.5"
        onClick={() => onMove(-1)}
        disabled={first}
        aria-label={`${label} nach oben`}
      >
        <ChevronUp className="size-4" aria-hidden />
      </button>

      <button
        type="button"
        className="btn-ghost p-1.5"
        onClick={() => onMove(1)}
        disabled={last}
        aria-label={`${label} nach unten`}
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>

      {onRemove && (
        <button
          type="button"
          className="btn-ghost p-1.5 text-rose-600 dark:text-rose-400"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
