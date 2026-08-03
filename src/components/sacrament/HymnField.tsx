import { useId, useMemo, useState } from 'react'
import { Check, Music, TriangleAlert } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { saveHymn, searchHymns } from '@/services/hymns'
import { codeOf, hymnKey, parseHymnCode } from '@/lib/hymnCode'
import type { HymnChoice } from '@/lib/types'

/**
 * Eingabe eines Liedes über seine Nummer.
 *
 * Der Titel kommt aus der importierten Liederliste, sobald die Nummer erkannt
 * wird – man tippt also nur die Nummer. Ist sie nicht in der Liste (oder wurde
 * noch keine Liste hochgeladen), lässt sich der Titel von Hand eintragen und
 * auf Wunsch in die Liste übernehmen.
 *
 * Aus dem Liederbuch für Kinder wird «PV» vorangestellt: «PV 6». Es zählt wie
 * das Gesangbuch ab 1, ohne das Kürzel wäre nicht zu sagen, welches gemeint
 * ist. Doppelnummern behalten ihren Buchstaben: «PV 18a». «Für zuhause und
 * für die Kirche» beginnt bei 1001 und braucht kein Kürzel.
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
  const { hymns, hymnsByCode } = useData()
  const toast = useToast()
  const fieldId = useId()
  const [remembering, setRemembering] = useState(false)

  const code = value?.code ?? (value?.number != null ? String(value.number) : '')
  const title = value?.title ?? ''
  const known = code ? hymnsByCode.get(hymnKey(code)) : undefined

  const matches = useMemo(
    () => (title.trim() && !known ? searchHymns(hymns, title, 5) : []),
    [hymns, title, known],
  )

  const set = (nextCode: string, nextTitle: string) => {
    if (!nextCode && !nextTitle) {
      onChange(undefined)
      return
    }
    const parsed = parseHymnCode(nextCode)
    onChange({
      number: parsed?.number ?? null,
      code: parsed?.code ?? nextCode,
      title: nextTitle,
    })
  }

  const changeCode = (text: string) => {
    const parsed = parseHymnCode(text)
    if (!parsed) {
      // Halb getippt («PV ») – stehen lassen, statt die Eingabe wegzunehmen.
      set(text.trim(), title)
      return
    }
    // Bekannter Code: Titel automatisch übernehmen. Ein von Hand
    // eingetragener Titel bleibt stehen, wenn der Code unbekannt ist.
    const found = hymnsByCode.get(hymnKey(parsed.code))
    set(parsed.code, found ? found.title : title)
  }

  const canRemember = Boolean(parseHymnCode(code)) && !known && title.trim().length > 2

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <label className="label" htmlFor={`${fieldId}-nr`}>
            {label}
          </label>
          <input
            id={`${fieldId}-nr`}
            type="text"
            className="input tabular"
            value={code}
            onChange={(event) => changeCode(event.target.value)}
            placeholder="Nr."
            aria-describedby={`${fieldId}-hilfe`}
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
            onChange={(event) => set(code, event.target.value)}
            placeholder={
              hymns.length === 0
                ? 'Noch keine Liederliste hinterlegt'
                : 'Wird aus der Liederliste ergänzt'
            }
          />
        </div>

        {optional && (code || title) && (
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
                onClick={() => set(codeOf(hymn), hymn.title)}
              >
                <Music className="size-3" aria-hidden />
                {codeOf(hymn)} – {hymn.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {canRemember && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-3.5" aria-hidden />
            Nr. {code} steht nicht in der Liederliste.
          </span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={remembering}
            onClick={() => {
              setRemembering(true)
              void saveHymn(code, title)
                .then(() => toast.success(`Nr. ${code} in die Liederliste aufgenommen.`))
                .catch(() => toast.error('Speichern fehlgeschlagen.'))
                .finally(() => setRemembering(false))
            }}
          >
            Merken
          </button>
        </div>
      )}

      <p id={`${fieldId}-hilfe`} className="hint">
        {hymns.length === 0 ? (
          // Kein Knopf, nur der Hinweis: Importe laufen gesammelt über die
          // Einstellungen, damit sie niemandem beim Arbeiten in die Quere kommen.
          <>
            Damit Titel automatisch erscheinen, unter «Einstellungen › Importe» die Liederliste
            übernehmen.
          </>
        ) : (
          'Nur die Nummer – aus dem PV-Liederbuch mit «PV» davor: «PV 6».'
        )}
      </p>

      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}
