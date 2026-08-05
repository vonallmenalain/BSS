import { useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { isOwnItem } from '@/lib/callingChanges'
import type { Mention } from '@/lib/mention'
import type { AgendaItem } from '@/lib/types'

/**
 * «Meine» – dieselbe Frage auf der Übersicht und in der Pendenzenliste.
 *
 * Sie steht an zwei Stellen, und zwei Antworten darauf wären ein Fehler:
 * Die Kachel «Meine Pendenzen» und der Ausschnitt «Meine» müssen dieselbe
 * Liste zeigen, sonst zählt die eine, was die andere nicht zeigt.
 *
 * Beantwortet wird sie in `lib/callingChanges`; hier kommt nur dazu, wer
 * gerade angemeldet ist – und welches Mitglied zu diesem Konto gehört
 * (siehe «Einstellungen → Benutzer und Rollen»). Ohne diese Verknüpfung
 * zählt allein, wo das Konto als zuständig eingetragen ist.
 */
export function useOwnItem(): (item: AgendaItem) => boolean {
  const { profile } = useAuth()
  const { membersById } = useData()

  const userId = profile?.id ?? null
  const memberId = profile?.memberId ?? null

  const member = useMemo<Mention | null>(() => {
    const linked = memberId ? membersById.get(memberId) : undefined
    return linked ? { id: linked.id, name: `${linked.firstName} ${linked.lastName}` } : null
  }, [memberId, membersById])

  return useCallback((item: AgendaItem) => isOwnItem(item, userId, member), [userId, member])
}
