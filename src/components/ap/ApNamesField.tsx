import { useId, useMemo, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { useApActivities } from '@/hooks/useFirestore'
import { formatPlanNames, parsePlanNames, planNameSuggestions } from '@/lib/apInvolvement'
import { cn } from '@/lib/utils'
import { updateUserProfile } from '@/services/users'
import type { AppUser } from '@/lib/types'

/**
 * Unter welchen Namen jemand im Aktivitätenplan steht – die Verknüpfung
 * zwischen den Namen im Plan und dem Konto (siehe `lib/apInvolvement`).
 *
 * Ein Textfeld, mehrere Namen durch Komma getrennt, gespeichert beim
 * Verlassen – wie die übrigen Felder der Einstellungen. Vorgeschlagen werden
 * die Namen, die im Plan bereits vorkommen: Auf die Schreibweise dort kommt
 * es an, und so stimmt sie.
 */
export function ApNamesField({
  user,
  label,
  id,
  placeholder = 'z. B. Carden, JM',
  className,
}: {
  user: Pick<AppUser, 'id' | 'displayName' | 'apNames'>
  /** Für Bildschirmleser – das sichtbare Label setzt der Aufrufer */
  label: string
  id?: string
  placeholder?: string
  className?: string
}) {
  const toast = useToast()
  const { data: activities } = useApActivities()
  const listId = useId()

  const saved = formatPlanNames(user.apNames)
  const [draft, setDraft] = useState(saved)
  /* Ändert sich der gespeicherte Stand von anderswo – das Administrator-Konto
     trägt etwas ein –, zieht das Feld nach. */
  const [base, setBase] = useState(saved)
  if (base !== saved) {
    setBase(saved)
    setDraft(saved)
  }

  const suggestions = useMemo(() => planNameSuggestions(activities), [activities])

  const commit = async () => {
    const names = parsePlanNames(draft)
    const next = formatPlanNames(names)
    setDraft(next)
    if (next === saved) return
    try {
      const outcome = await updateUserProfile(user.id, { apNames: names })
      toast.saved(
        names.length > 0
          ? `${user.displayName} steht im Plan als ${next}.`
          : `${user.displayName} ist mit keinem Namen im Plan mehr verknüpft.`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Die Namen konnten nicht gespeichert werden.')
    }
  }

  return (
    <>
      <input
        id={id}
        className={cn('input', className)}
        value={draft}
        list={listId}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          event.currentTarget.blur()
        }}
      />
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  )
}
