import { ArrowDownAZ, History, Moon, Shuffle, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { formatWeekRange } from '@/lib/impulse'
import type { ImpulseAppearance } from '@/hooks/useLocalStorage'

/*
 * Die Anti-Doom-Einstellungen – der unterste Punkt im Anti-Doom-Menü.
 *
 * Drei Dinge, alle klein gehalten:
 *
 * **Die Darstellung.** Der Bereich ist dunkel, wie er sich gehört – wem
 * das nicht liegt, stellt hier auf hell. Die Wahl gilt nur für «Anti
 * Doom»; die übrige App behält ihre eigene (siehe `useImpulseAppearance`).
 *
 * **Die Reihenfolge der Karten.** Der Reihe nach (Wochenthema zuerst)
 * oder zufällig gemischt – die Mischung bleibt innerhalb der Woche
 * gleich, damit der Stapel beim Wiederkommen so liegt wie verlassen.
 * Die Wahl merkt sich das Gerät (localStorage, siehe `Impuls`).
 *
 * **Die Woche.** Standard ist immer die laufende; wer alte Karten noch
 * einmal anschauen will, wechselt hier in eine frühere Woche. Die Wahl
 * gilt nur für diesen Besuch – beim nächsten Öffnen des Bereichs steht
 * wieder die aktuelle Woche da, ganz ohne Zurückstellen.
 *
 * Das Fenster ist ein Fenster: Es legt sich über das, was gerade offen
 * ist – Feed oder Raum bleiben stehen und sind beim Schliessen noch da
 * (siehe `Impuls`).
 */

export type ImpulseOrder = 'geordnet' | 'zufall'

export function ImpulseSettingsModal({
  open,
  onClose,
  look,
  onLook,
  order,
  onOrder,
  weeks,
  week,
  currentWeek,
  onWeek,
}: {
  open: boolean
  onClose: () => void
  /** Die Darstellung des Bereichs – dunkel, solange nichts gewählt ist. */
  look: ImpulseAppearance
  onLook: (look: ImpulseAppearance) => void
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
    <Modal open={open} onClose={onClose} title="Anti-Doom-Einstellungen" size="sm">
      <div className="space-y-5">
        <section>
          <h3 className="label">Darstellung</h3>
          <div className="space-y-1.5" role="radiogroup" aria-label="Darstellung">
            <ChoiceRow
              icon={<Moon className="size-4" aria-hidden />}
              label="Dunkel"
              hint="Der Standard – ruhiger Grund, die Karten stehen im Vordergrund."
              active={look !== 'hell'}
              onClick={() => onLook('dunkel')}
            />
            <ChoiceRow
              icon={<Sun className="size-4" aria-hidden />}
              label="Hell"
              hint="Nur hier – die übrige App behält ihre eigene Darstellung."
              active={look === 'hell'}
              onClick={() => onLook('hell')}
            />
          </div>
        </section>

        <section>
          <h3 className="label">Reihenfolge der Karten</h3>
          <div className="space-y-1.5" role="radiogroup" aria-label="Reihenfolge der Karten">
            <ChoiceRow
              icon={<ArrowDownAZ className="size-4" aria-hidden />}
              label="Der Reihe nach"
              hint="Wochenthema zuerst, dann Quiz, Bilderrätsel, Frage, Feed und Teilen."
              active={order === 'geordnet'}
              onClick={() => onOrder('geordnet')}
            />
            <ChoiceRow
              icon={<Shuffle className="size-4" aria-hidden />}
              label="Zufällig gemischt"
              hint="Bunt durcheinander – nur das Wochenthema bleibt zuoberst, und die Mischung bleibt die Woche über gleich."
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

/**
 * Eine wählbare Zeile – dieselbe Sprache wie die Quiz-Antworten: eine
 * ruhige Fläche statt eines Rahmens, die gewählte in der Markenfarbe.
 */
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
        'flex w-full items-start gap-2.5 rounded-xl p-3 text-left text-sm transition active:scale-[0.99]',
        active
          ? 'bg-brand-500/15 text-brand-900 dark:text-brand-50'
          : 'bg-slate-100 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full transition',
          active
            ? 'bg-brand-600 dark:bg-brand-400'
            : 'ring-1 ring-slate-300 ring-inset dark:ring-white/25',
        )}
        aria-hidden
      >
        {active && <span className="dark:bg-brand-950 size-1.5 rounded-full bg-white" />}
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
