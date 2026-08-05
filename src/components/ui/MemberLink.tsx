import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { originState } from '@/hooks/useBack'

/**
 * Ein Verweis auf ein Mitgliederprofil, der weiss, woher er kommt.
 *
 * Zurück führt in aller Regel der Browserverlauf (siehe `hooks/useBack`) –
 * damit landet man wieder genau in der Ansicht, die man verlassen hat. Der
 * mitgegebene Ursprung ist der Rückfall für den Fall, dass es keinen Verlauf
 * gibt: nach einem Neuladen oder wenn jemand die Adresse geteilt hat.
 */
export function MemberLink({
  memberId,
  label,
  className,
  children,
}: {
  memberId: string
  /** Wie die Seite heisst, von der aus verwiesen wird */
  label?: string
  className?: string
  children: ReactNode
}) {
  const location = useLocation()
  return (
    <Link to={`/mitglieder/${memberId}`} state={originState(location, label)} className={className}>
      {children}
    </Link>
  )
}
