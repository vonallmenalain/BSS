import { useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useAllSacramentMeetings, useCallings } from '@/hooks/useFirestore'
import { MemberSearchSelect } from '@/components/sacrament/MemberSearchSelect'
import { formatDate, toDate } from '@/lib/dates'
import { isOrganistCalling, organistCandidates, organistOf } from '@/lib/organist'
import { saveOrganist } from '@/services/sacrament'
import type { Member, SacramentMeeting } from '@/lib/types'

/**
 * Wer an diesem Sonntag die Orgel spielt.
 *
 * Genau eine Person, und sie spielt alle Lieder – deshalb steht das Feld
 * über den Liedern und nicht bei jedem einzelnen.
 *
 * Gewählt wird wie bei «Wer trägt vor?»: Ein Griff ins Feld zeigt die
 * Vorschläge, ohne dass etwas getippt werden müsste. Zuoberst stehen die
 * Mitglieder mit der Berufung **Organist**, darunter, wer schon einmal
 * eingeteilt war. Gesucht werden kann trotzdem in der ganzen Gemeinde – und
 * wer gar nicht im Verzeichnis steht (der Besuch, der einspringt), lässt
 * sich als blosser Name eintragen, ohne dass daran eine Berufung hängt.
 *
 * Gespeichert wird sofort und nicht über den Entwurf der Seite: Es ist eine
 * einzelne Angabe, die mit einem Griff gesetzt ist – wie das Gebet.
 */
export function OrganistField({
  date,
  meeting,
  readOnly = false,
}: {
  date: Date
  meeting: SacramentMeeting | null
  /** Ohne Bearbeitungsrecht steht der Name da, sonst nichts. */
  readOnly?: boolean
}) {
  const { members, membersById } = useData()
  const toast = useToast()
  /*
   * Die Berufungen liest nur der Vollzugriff (siehe `firestore.rules`):
   * Dort stehen auch laufende Berufungsvorgänge, die niemanden ausserhalb
   * der Bischofschaft etwas angehen. Für die Assistenz «Musik» bleibt die
   * Liste deshalb leer – ihre Vorschläge kommen dann aus den bisherigen
   * Sonntagen, und suchen kann sie ohnehin in der ganzen Gemeinde.
   */
  const { data: callings } = useCallings(2000)
  const { data: meetings } = useAllSacramentMeetings()

  const organist = organistOf(meeting, (id) => {
    const member = membersById.get(id)
    return member ? `${member.firstName} ${member.lastName}` : undefined
  })

  /** Die Bezeichnung der Berufung – «Organist», «Organistin». */
  const positions = useMemo(() => {
    const map = new Map<string, string>()
    for (const calling of callings) {
      if (isOrganistCalling(calling) && !map.has(calling.memberId)) {
        map.set(calling.memberId, calling.position)
      }
    }
    return map
  }, [callings])

  /** Wann eine Person zuletzt gespielt hat – künftige Sonntage zählen nicht. */
  const lastPlayed = useMemo(() => {
    const map = new Map<string, Date>()
    const now = new Date()
    for (const entry of meetings) {
      const played = organistOf(entry)
      const when = toDate(entry.date)
      if (!played?.memberId || !when || when > now) continue
      const known = map.get(played.memberId)
      if (!known || when > known) map.set(played.memberId, when)
    }
    return map
  }, [meetings])

  /*
   * Zuerst die Berufenen, danach die schon einmal Eingeteilten.
   *
   * Die zweite Gruppe ist keine Verlegenheit: Wer ohne Berufung einspringt,
   * springt meist mehrmals ein – und für die Assistenz «Musik» ist es die
   * einzige Quelle, die ihr offensteht.
   */
  const suggestions = useMemo(() => {
    const called = organistCandidates(members, callings)
    const seen = new Set(called.map((member) => member.id))
    const before: Member[] = []
    for (const id of lastPlayed.keys()) {
      const member = membersById.get(id)
      if (member && !seen.has(id)) {
        seen.add(id)
        before.push(member)
      }
    }
    return [...called, ...before]
  }, [members, membersById, callings, lastPlayed])

  const describe = (member: Member) => {
    const position = positions.get(member.id)
    if (position) return position
    const last = lastPlayed.get(member.id)
    return last ? `zuletzt ${formatDate(last)}` : null
  }

  const save = async (next: { memberId: string | null; name: string } | null) => {
    try {
      const outcome = await saveOrganist(date, next)
      toast.saved(next?.name ? `Organist: ${next.name}` : 'Organist entfernt.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  return (
    <MemberSearchSelect
      /* Ohne Beschriftung: Die Überschrift der Karte sagt bereits
         «Organist», und zweimal dasselbe übereinander ist einmal zu viel –
         wie beim Gebet. */
      value={organist?.memberId ?? null}
      onChange={(member) =>
        void save(
          member ? { memberId: member.id, name: `${member.firstName} ${member.lastName}` } : null,
        )
      }
      /* Steht am Sonntag ein Name ohne Mitglied – oder eines, das es im
         Verzeichnis nicht mehr gibt –, wird er gezeigt statt verschluckt. */
      freeText={organist?.name ?? ''}
      onFreeText={(name) => void save(name ? { memberId: null, name } : null)}
      suggestions={suggestions}
      meta={describe}
      compact
      placeholder="Mitglied suchen …"
      disabled={readOnly}
    />
  )
}
