import { ArrowDownAZ, History, Shuffle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { formatWeekRange } from '@/lib/impulse'

/*
 * Die Impuls-Einstellungen – der unterste Punkt im Impuls-Menü.
 *
 * Zwei Dinge, beide klein gehalten:
 *
 * **Die Reihenfolge der Karten.** Der Reihe nach (Wochenimpuls zuerst)
 * oder zufällig gemischt – die Mischung bleibt innerhalb der Woche
 * gleich, damit der Stapel beim Wiederkommen so liegt wie verlassen.
 * Die Wahl merkt sich das Gerät (localStorage, siehe `Impuls`).
 *
 * **Die Woche.** Standard ist immer die laufende; wer alte Karten noch
 * einmal anschauen will, wechselt hier in eine frühere Woche. Die Wahl
 * gilt nur für diesen Besuch – beim nächsten Öffnen des Bereichs steht
 * wieder die aktuelle Woche da, ganz ohne Zurückstellen.
 */

export type ImpulseOrder = 'geordnet' | 'zufall'

export function ImpulseSettingsModal({
  open,
  onClose,
  order,
  onOrder,
  weeks,
  week,
  currentWeek,
  onWeek,
}: {
  open: boolean
  onClose: () => void
  order: ImpulseOrder
  onOrder: (order: ImpulseOrder) => void
  /** Wählbare frühere Wochen, jüngste zuerst (ohne die laufende). */
  weeks: string[]
  /** Die gerade angezeigte Woche. */
  week: string
  /** Die laufende Woche – der Standard. */
  currentWeek: string
  onWeek: (week: string) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Impuls-Einstellungen" size="sm">
      <div className="space-y-5">
        <section>
          <h3 className="label">Reihenfolge der Karten</h3>
          <div className="space-y-1.5" role="radiogroup" aria-label="Reihenfolge der Karten">
            <ChoiceRow
              icon={<ArrowDownAZ className="size-4" aria-hidden />}
              label="Der Reihe nach"
              hint="Wochenimpuls zuerst, dann Quiz, Ziel, Challenge, Frage und Feed."
              active={order === 'geordnet'}
              onClick={() => onOrder('geordnet')}
            />
            <ChoiceRow
              icon={<Shuffle className="size-4" aria-hidden />}
              label="Zufällig gemischt"
              hint="Bunt durcheinander – die Mischung bleibt die Woche über gleich."
              active={order === 'zufall'}
              onClick={() => onOrder('zufall')}
            />
          </div>
        </section>

        <section>
          <h3 className="label">Woche</h3>
          <div className="space-y-1.5" role="radiogroup" aria-label="Woche">
            <ChoiceRow
              label={`Aktuelle Woche · ${formatWeekRange(currentWeek)}`}
              active={week === currentWeek}
              onClick={() => onWeek(currentWeek)}
            />
            {weeks.map((pastWeek) => (
              <ChoiceRow
                key={pastWeek}
                icon={<History className="size-4" aria-hidden />}
                label={formatWeekRange(pastWeek)}
                active={week === pastWeek}
                onClick={() => onWeek(pastWeek)}
              />
            ))}
          </div>
          <p className="hint mt-2">
            Der Rückblick gilt nur für diesen Besuch – beim nächsten Öffnen steht wieder die
            aktuelle Woche da.
          </p>
        </section>
      </div>
    </Modal>
  )
}

/** Eine wählbare Zeile – dieselbe Sprache wie die Quiz-Antworten. */
function ChoiceRow({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon?: React.ReactNode
  label: string
  hint?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition',
        active
          ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950'
          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
          active ? 'border-brand-600 bg-brand-600' : 'border-slate-300 dark:border-slate-600',
        )}
        aria-hidden
      >
        {active && <span className="size-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-medium">
          {icon}
          {label}
        </span>
        {hint && <span className="hint mt-0.5 block">{hint}</span>}
      </span>
    </button>
  )
}
