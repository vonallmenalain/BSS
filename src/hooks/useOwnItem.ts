import { useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { isOwnCallingRow, isOwnItem } from '@/lib/callingChanges'
import type { Mention } from '@/lib/mention'
import type { AgendaItem, CallingMemberRow, CallingOpenRow } from '@/lib/types'

/**
 * Wer gerade angemeldet ist – als Konto **und** als Mitglied.
 *
 * Welches Mitglied zum Konto gehört, steht unter «Einstellungen → Benutzer
 * und Rollen». Ohne diese Verknüpfung zählt allein, wo das Konto als
 * zuständig eingetragen ist: Ein Name im Text ist dann bloss ein Name.
 */
function useMe(): { userId: string | null; member: Mention | null } {
  const { profile } = useAuth()
  const { membersById } = useData()

  const userId = profile?.id ?? null
  const memberId = profile?.memberId ?? null

  const member = useMemo<Mention | null>(() => {
    const linked = memberId ? membersById.get(memberId) : undefined
    return linked ? { id: linked.id, name: `${linked.firstName} ${linked.lastName}` } : null
  }, [memberId, membersById])

  return useMemo(() => ({ userId, member }), [userId, member])
}

/**
 * «Meine» – dieselbe Frage auf der Übersicht und in der Pendenzenliste.
 *
 * Sie steht an zwei Stellen, und zwei Antworten darauf wären ein Fehler:
 * Die Kachel «Meine Pendenzen» und der Ausschnitt «Meine» müssen dieselbe
 * Liste zeigen, sonst zählt die eine, was die andere nicht zeigt.
 *
 * Beantwortet wird sie in `lib/callingChanges`; hier kommt nur dazu, wer
 * gerade angemeldet ist.
 */
export function useOwnItem(): (item: AgendaItem) => boolean {
  const { userId, member } = useMe()
  return useCallback((item: AgendaItem) => isOwnItem(item, userId, member), [userId, member])
}

/**
 * Dieselbe Frage an eine **Zeile** einer Berufungsrunde.
 *
 * Eine Runde ist ein Eintrag mit zwanzig Zeilen, die untereinander verteilt
 * werden. Sie kommt deshalb auf die Liste «Meine», sobald **eine** davon mich
 * angeht – und genau die zeigt sie, wenn sie von dort aus geöffnet wird
 * (siehe `components/agenda/CallingChanges`).
 */
export function useOwnCallingRow(): (row: CallingMemberRow | CallingOpenRow) => boolean {
  const { userId, member } = useMe()
  return useCallback(
    (row: CallingMemberRow | CallingOpenRow) => isOwnCallingRow(row, userId, member),
    [userId, member],
  )
}
