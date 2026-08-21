import { useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { callingRowConcern, isOwnItem } from '@/lib/callingChanges'
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
 * Dieselbe Frage für **irgendjemanden** aus der Bischofschaft.
 *
 * «Meine» ist der häufige Fall und hat deshalb einen eigenen Knopf; die Frage
 * dahinter ist aber nicht an das eigene Konto gebunden. Wer wissen will, was
 * beim Bischof liegt, stellt sie über ihn – und bekommt genau dieselbe
 * Antwort, die der Bischof unter «Meine» bekäme: das ihm Zugewiesene und die
 * Berufungsrunden, in denen er eine Zeile trägt oder namentlich vorkommt.
 *
 * Die Verknüpfung zum Mitglied steht am Konto («Einstellungen → Benutzer und
 * Rollen»). Fehlt sie, zählt auch hier allein die ausdrückliche Zuweisung –
 * ein Name im Text ist dann bloss ein Name.
 */
export function useItemOfUser(): (item: AgendaItem, userId: string) => boolean {
  const { usersById, membersById } = useData()

  return useCallback(
    (item: AgendaItem, userId: string) => {
      const linkedId = usersById.get(userId)?.memberId
      const linked = linkedId ? membersById.get(linkedId) : undefined
      const member: Mention | null = linked
        ? { id: linked.id, name: `${linked.firstName} ${linked.lastName}` }
        : null
      return isOwnItem(item, userId, member)
    },
    [usersById, membersById],
  )
}

/**
 * Dieselbe Frage an eine **Zeile** einer Berufungsrunde.
 *
 * Eine Runde ist ein Eintrag mit zwanzig Zeilen, die untereinander verteilt
 * werden. Sie kommt deshalb auf die Liste «Meine», sobald **eine** davon mich
 * angeht – und genau die zeigt sie, wenn sie von dort aus geöffnet wird
 * (siehe `components/agenda/CallingChanges`).
 *
 * Gefragt ist die Zeile und nicht ihr Stand: Eine erledigte Zeile, die mir
 * zugewiesen war, bleibt meine. Ob das Erledigte überhaupt dasteht, sagt in
 * der Runde ein eigener Schalter – zwei Fragen, zwei Knöpfe. Für die Liste
 * «Meine», wo eine abgehakte Zeile keine Aufgabe mehr ist, beantwortet
 * dieselbe Frage `isOwnCallingRow`.
 */
export function useCallingRowConcern(): (row: CallingMemberRow | CallingOpenRow) => boolean {
  const { userId, member } = useMe()
  return useCallback(
    (row: CallingMemberRow | CallingOpenRow) => callingRowConcern(row, userId, member),
    [userId, member],
  )
}
