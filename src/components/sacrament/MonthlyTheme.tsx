import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Quote } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { formatMonthKey, monthKey } from '@/lib/monthlyDuties'
import { saveSacramentTheme } from '@/services/settings'
import { sacramentThemeFor } from '@/lib/types'

/**
 * Das Monatsthema der Abendmahlsversammlung – unter dem Datum, in jedem
 * Bereich.
 *
 * Die Bischofschaft gibt dem Monat ein Thema, und die vier oder fünf
 * Sonntage darunter tragen es alle: Wer die Ansprachen anfragt, soll es beim
 * Anfragen vor sich haben; wer die Lieder aussucht, ebenso. Genau deshalb
 * steht es hier im Rahmen und nicht auf einer der Unterseiten – es ist
 * überall dieselbe Auskunft, wie das Datum darüber.
 *
 * **Festgelegt wird es dort, wo es steht.** Der Vollzugriff findet neben dem
 * Thema den Stift; ist noch keines erfasst, steht an derselben Stelle ein
 * unaufdringliches «Monatsthema». Ein Feld in den Einstellungen wäre die
 * zweite Antwort auf die Frage «wo stelle ich das ein?» – und die falsche:
 * Man denkt daran, während man den Monat plant.
 *
 * **Die Assistenz liest bloss.** Nicht, weil ihr zu misstrauen wäre,
 * sondern weil das Thema dem Monat gehört und nicht dem Bereich: Es steht in
 * den Einstellungen der Gemeinde, und die ändert die Bischofschaft. Die
 * Zugriffsregeln setzen genau das durch – am Knopf hängt keine zweite
 * Prüfung, er steht schlicht nicht da.
 */
export function MonthlyTheme({ date }: { date: Date }) {
  const { settings } = useData()
  const { isApproved } = useAuth()
  const [open, setOpen] = useState(false)

  const month = monthKey(date)
  const theme = sacramentThemeFor(settings.sacramentThemes, month)

  // Ohne Thema und ohne Recht, eines zu setzen, bleibt die Zeile weg: eine
  // leere Überschrift sagt weniger als gar keine.
  if (!theme && !isApproved) return null

  return (
    <>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {theme ? (
          <>
            <Quote className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            <span className="font-medium text-slate-700 dark:text-slate-200">{theme}</span>
            <span className="text-xs text-slate-400">Monatsthema {formatMonthKey(month)}</span>
            {isApproved && (
              <button
                type="button"
                className="btn-ghost no-print p-1"
                onClick={() => setOpen(true)}
                aria-label={`Monatsthema ${formatMonthKey(month)} ändern`}
                title="Monatsthema ändern"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="btn-ghost btn-sm no-print -ml-2 text-slate-500 dark:text-slate-400"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-3.5" aria-hidden />
            Monatsthema
          </button>
        )}
      </p>

      {/* Erst beim Öffnen gebaut, und je Monat neu: So steht im Feld der
          Stand von diesem Augenblick, ohne dass ein Effekt ihn nachträglich
          hineinschriebe – und was jemand tippt, überlebt einen
          Schnappschuss aus Firestore. */}
      {isApproved && open && (
        <MonthlyThemeDialog
          key={month}
          onClose={() => setOpen(false)}
          month={month}
          theme={theme}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Das Thema eines Monats setzen, ändern oder wieder entfernen.
 *
 * Gefragt wird nach dem Monat des gewählten Sonntags und nicht nach einem
 * beliebigen: Man kommt aus einem Sonntag hierher, und ein zweites
 * Auswahlfeld für den Monat liesse einen versehentlich den falschen
 * beschriften. Für einen anderen Monat wechselt man den Sonntag – dieselbe
 * Bewegung, die man ohnehin macht.
 */
function MonthlyThemeDialog({
  onClose,
  month,
  theme,
}: {
  onClose: () => void
  month: string
  theme: string
}) {
  const toast = useToast()
  const [value, setValue] = useState(theme)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const outcome = await saveSacramentTheme(month, value)
      toast.saved(
        value.trim()
          ? `Monatsthema ${formatMonthKey(month)}: ${value.trim()}`
          : `Monatsthema ${formatMonthKey(month)} entfernt.`,
        outcome,
      )
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Monatsthema konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Monatsthema ${formatMonthKey(month)}`} size="sm">
      <form onSubmit={submit}>
        <label className="label" htmlFor="monatsthema">
          Thema
        </label>
        <input
          id="monatsthema"
          className="input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="z. B. «Der Erretter Jesus Christus»"
          maxLength={120}
          autoFocus
        />
        <p className="hint">Leer lassen entfernt das Thema für diesen Monat.</p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  )
}
