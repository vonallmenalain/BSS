import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { originState } from '@/hooks/useBack'

/**
 * Ein Verweis auf ein Mitgliederprofil, der weiss, woher er kommt.
 *
 * Zurück führt in aller Regel der Browserverlauf (siehe `hooks/useBack`) –
 * damit landet man wieder genau in der Ansicht, die man verlassen hat. Der
 * mitgegebene Ursprung ist der Rückfall für den Fall, dass es keinen Verlauf
 * gibt: nach einem Neuladen oder wenn jemand die Adresse geteilt hat.
 *
 * **Ohne Vollzugriff kein Verweis.** Die Assistenz der
 * Abendmahlsversammlung liest die Namen der Gemeinde – das Verzeichnis
 * selbst gehört ihr aber nicht. Ein Verweis dorthin führte sie im Kreis
 * zurück auf ihre Seite; sie bekommt deshalb denselben Text ohne Verweis
 * darunter. Der Ort, an dem das entschieden wird, ist genau hier: In den
 * Listen von Ansprachen, Gebet und Musik stehen Dutzende solcher Namen, und
 * jede von ihnen müsste die Frage sonst selbst stellen.
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
  const { isApproved } = useAuth()

  if (!isApproved) return <span className={className}>{children}</span>

  return (
    <Link to={`/mitglieder/${memberId}`} state={originState(location, label)} className={className}>
      {children}
    </Link>
  )
}
