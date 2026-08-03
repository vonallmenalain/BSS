import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Music, TriangleAlert } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { saveHymn, searchHymns } from '@/services/hymns'
import type { HymnChoice } from '@/lib/types'

/**
 * Eingabe eines Liedes über die Nummer.
 *
 * Der Titel kommt aus der importierten Liederliste, sobald die Nummer erkannt
 * wird – man tippt also nur eine Zahl. Ist eine Nummer nicht in der Liste
 * (oder wurde noch keine Liste hochgeladen), lässt sich der Titel von Hand
 * eintragen und auf Wunsch in die Liste übernehmen.
 *
 * Der Titel wird immer mitgespeichert, damit ein bereits verteiltes Programm
 * auch nach einem Neuimport der Liederliste unverändert bleibt.
 *
 * Das Feld hält keinen eigenen Zustand: Alles steht im Wert, den die Seite
 * verwaltet. Damit können zwei Geräte nicht auseinanderlaufen.
 */
export function HymnField({
  label,
  value,
  onChange,
  optional = false,
  hint,
}: {
  label: string
  value: HymnChoice | undefined
  onChange: (next: HymnChoice | undefined) => void
  optional?: boolean
  hint?: string
}) {
  const { hymns, hymnsByNumber } = useData()
  const toast = useToast()
  const fieldId = useId()
  const [remembering, setRemembering] = useState(false)

  const number = value?.number ?? null
  const title = value?.title ?? ''
  const known = number != null ? hymnsByNumber.get(number) : undefined

  const matches = useMemo(
    () => (title.trim() && !known ? searchHymns(hymns, title, 5) : []),
    [hymns, title, known],
  )

  const set = (nextNumber: number | null, nextTitle: string) => {
    onChange(
      nextNumber === null && !nextTitle ? undefined : { number: nextNumber, title: nextTitle },
    )
  }

  const changeNumber = (text: string) => {
    const parsed = Number.parseInt(text, 10)
    if (!text.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      set(null, title)
      return
    }
    // Bekannte Nummer: Titel automatisch übernehmen. Ein von Hand
    // eingetragener Titel bleibt stehen, wenn die Nummer unbekannt ist.
    const found = hymnsByNumber.get(parsed)
    set(parsed, found ? found.title : title)
  }

  const canRemember = number != null && !known && title.trim().length > 2

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-24">
          <label className="label" htmlFor={`${fieldId}-nr`}>
            {label}
          </label>
          <input
            id={`${fieldId}-nr`}
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            className="input tabular"
            value={number ?? ''}
            onChange={(event) => changeNumber(event.target.value)}
            placeholder="Nr."
          />
        </div>

        <div className="min-w-48 flex-1">
          <label className="label" htmlFor={`${fieldId}-titel`}>
            Titel
          </label>
          <input
            id={`${fieldId}-titel`}
            className="input"
            value={title}
            onChange={(event) => set(number, event.target.value)}
            placeholder={
              hymns.length === 0
                ? 'Noch keine Liederliste hinterlegt'
                : 'Wird aus der Liederliste ergänzt'
            }
          />
        </div>

        {optional && (number != null || title) && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(undefined)}>
            Entfernen
          </button>
        )}
      </div>

      {known && (
        <p className="hint flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" aria-hidden />
          Aus der Liederliste übernommen
        </p>
      )}

      {matches.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {matches.map((hymn) => (
            <li key={hymn.id}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => set(hymn.number, hymn.title)}
              >
                <Music className="size-3" aria-hidden />
                {hymn.number} – {hymn.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {canRemember && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-3.5" aria-hidden />
            Nummer {number} steht nicht in der Liederliste.
          </span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={remembering}
            onClick={() => {
              setRemembering(true)
              void saveHymn(number, title)
                .then(() => toast.success(`Nr. ${number} in die Liederliste aufgenommen.`))
                .catch(() => toast.error('Speichern fehlgeschlagen.'))
                .finally(() => setRemembering(false))
            }}
          >
            Merken
          </button>
        </div>
      )}

      {hymns.length === 0 && (
        <p className="hint">
          Damit Titel automatisch erscheinen:{' '}
          <Link to="/einstellungen" className="underline">
            Liederliste in den Einstellungen hochladen
          </Link>
          .
        </p>
      )}

      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}
