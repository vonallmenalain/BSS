import { useMemo, useState } from 'react'
import { CalendarOff, HandHeart, History, RotateCcw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { usePrayers } from '@/hooks/useFirestore'
import { useUrlState } from '@/hooks/useUrlState'
import { MemberLink } from '@/components/ui/MemberLink'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/Feedback'
import { SegmentedControl } from '@/components/ui/Pickers'
import { MemberSearchSelect } from '@/components/sacrament/MemberSearchSelect'
import { SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { cn } from '@/lib/utils'
import { formatDate, formatDateShort, toDate, toDateInput } from '@/lib/dates'
import {
  isPrayerHeld,
  lastPrayerByMember,
  PRAYER_HOLD_DAYS,
  rankPrayerCandidates,
  setPrayer,
  setPrayerHold,
  sortPrayersByDate,
} from '@/services/prayers'
import {
  PRAYER_SLOTS,
  PRAYER_SLOT_LABELS,
  PRAYER_SLOT_SHORT,
  type Member,
  type PrayerSlot,
} from '@/lib/types'

/** Der Reiter steht in der Adresse – siehe `hooks/useUrlState`. */
type Tab = 'zuteilen' | 'verlauf'

const TABS: readonly Tab[] = ['zuteilen', 'verlauf']

/**
 * Wie viele Vorschläge dastehen.
 *
 * Acht waren es, solange die Liste zweimal auf der Seite stand. Einmal
 * dargestellt ist Platz für mehr – und mehr braucht es auch: Wer die ersten
 * paar überspringt, weil sie gerade nicht passen, steht sonst schnell vor
 * einer leeren Liste.
 */
const SUGGESTION_COUNT = 20

/**
 * Anfangs- und Schlussgebet je Sonntag.
 *
 * Oben stehen die beiden Plätze, darunter **eine** Vorschlagsliste für beide.
 * Zwei Listen standen hier einmal nebeneinander – dieselben Namen in
 * derselben Reihenfolge, zweimal untereinander. Sie beantworteten dieselbe
 * Frage («wer war lange nicht dran?») und verdoppelten bloss die Höhe der
 * Seite. Jetzt steht der Name einmal da, und daneben, für welchen der beiden
 * Plätze er gilt.
 *
 * «Heute nicht» nimmt jemanden für einen Monat aus der Liste. Ohne das
 * blieben die immer gleichen drei Namen zuoberst stehen – jemand, der gerade
 * krank ist, verschwindet nicht dadurch, dass man ihn übergeht.
 */
export function Prayers() {
  const { date } = useSacrament()
  const { members, settings } = useData()
  const { canEditSacramentArea } = useAuth()
  const { data: prayers, loading } = usePrayers(400)
  const toast = useToast()
  const [tab, setTab] = useUrlState<Tab>('ansicht', 'zuteilen', TABS)

  /*
   * Eine Assistenz kann das Gebet auch bloss zum Nachschauen haben (siehe
   * `AuthContext`). Wer nachliest, sieht dieselben Namen und dieselbe
   * Reihenfolge – nur die Knöpfe fehlen, die zuteilen oder überspringen.
   */
  const readOnly = !canEditSacramentArea('prayers')

  const dateKey = toDateInput(date)

  const assigned = useMemo(() => {
    const map = new Map<PrayerSlot, string>()
    for (const prayer of prayers) {
      if (toDateInput(toDate(prayer.date)) === dateKey) map.set(prayer.slot, prayer.memberId)
    }
    return map
  }, [prayers, dateKey])

  /** Zeigt auch, wen «Heute nicht» gerade heraushält – zum Aufheben. */
  const [showHeld, setShowHeld] = useState(false)

  const candidates = useMemo(
    () =>
      rankPrayerCandidates(members, prayers, { gapMonths: settings.prayerGapMonths }).slice(
        0,
        SUGGESTION_COUNT,
      ),
    [members, prayers, settings.prayerGapMonths],
  )

  /** Wer gerade zurückgestellt ist – die Liste hinter «Übersprungene». */
  const held = useMemo(() => members.filter((member) => isPrayerHeld(member)), [members])

  const lastByMember = useMemo(() => lastPrayerByMember(prayers), [prayers])

  const describe = (member: Member) => {
    const last = lastByMember.get(member.id)
    if (!last) return 'noch nie gebetet'
    return `zuletzt ${formatDate(last)}`
  }

  const assign = async (slot: PrayerSlot, member: Member | null) => {
    try {
      const outcome = await setPrayer(date, slot, member)
      toast.saved(
        member
          ? `${PRAYER_SLOT_LABELS[slot]}: ${member.firstName} ${member.lastName}`
          : `${PRAYER_SLOT_LABELS[slot]} freigegeben.`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  const hold = async (member: Member, days: number) => {
    try {
      await setPrayerHold(member.id, days)
      toast.success(
        days > 0
          ? `${member.firstName} ${member.lastName} wird ${days} Tage übersprungen.`
          : `${member.firstName} ${member.lastName} steht wieder in den Vorschlägen.`,
      )
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  const history = useMemo(() => sortPrayersByDate(prayers), [prayers])

  return (
    <>
      <SectionHeader title="Gebet" readOnly={readOnly} />

      <SegmentedControl<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'zuteilen', label: 'Zuteilen' },
          { value: 'verlauf', label: 'Verlauf', count: history.length },
        ]}
      />

      {tab === 'zuteilen' ? (
        <div className="space-y-4">
          {/* Die beiden Plätze: gewählte Person oder Feld zum Suchen. Die
              Vorschläge stehen darunter – einmal für beide. */}
          <div className="grid gap-4 md:grid-cols-2">
            {PRAYER_SLOTS.map((slot) => (
              <section key={slot} className="card p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <HandHeart className="size-4 text-slate-400" aria-hidden />
                  {PRAYER_SLOT_LABELS[slot]}
                </h3>

                <MemberSearchSelect
                  value={assigned.get(slot) ?? null}
                  onChange={(member) => void assign(slot, member)}
                  meta={describe}
                  compact
                  placeholder="Name eingeben"
                  disabled={readOnly}
                />
              </section>
            ))}
          </div>

          <section className="card p-4">
            <h3 className="mb-1 text-sm font-semibold">Vorschläge</h3>
            <p className="hint mb-3 mt-0">
              {readOnly
                ? 'Wer am längsten nicht gebetet hat, steht zuoberst.'
                : 'Wer am längsten nicht gebetet hat, steht zuoberst. Ein Griff auf «Anfang» oder «Schluss» teilt zu.'}
            </p>

            {candidates.length === 0 ? (
              <p className="text-sm text-slate-400">
                Keine Vorschläge – entweder fehlen aktive Mitglieder oder alle sind übersprungen.
              </p>
            ) : (
              <ul className="divide-list">
                {candidates.map(({ member, alreadyPlanned }) => (
                  <CandidateRow
                    key={member.id}
                    member={member}
                    meta={describe(member)}
                    dimmed={alreadyPlanned}
                    assigned={PRAYER_SLOTS.filter((slot) => assigned.get(slot) === member.id)}
                    onAssign={(slot) => void assign(slot, member)}
                    onHold={() => void hold(member, PRAYER_HOLD_DAYS)}
                    readOnly={readOnly}
                  />
                ))}
              </ul>
            )}

            {held.length > 0 && (
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  className="btn-ghost btn-sm -ml-2"
                  onClick={() => setShowHeld((open) => !open)}
                  aria-expanded={showHeld}
                >
                  <CalendarOff className="size-3.5" aria-hidden />
                  {held.length} übersprungen
                </button>

                {showHeld && (
                  <ul className="divide-list mt-1">
                    {held.map((member) => (
                      <li key={member.id} className="flex items-center gap-3 py-2">
                        <Avatar
                          name={`${member.firstName} ${member.lastName}`}
                          id={member.id}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {member.firstName} {member.lastName}
                        </span>
                        <span className="tabular shrink-0 text-xs text-slate-400">
                          {member.prayerHoldUntil
                            ? `bis ${formatDate(member.prayerHoldUntil)}`
                            : 'auf Weiteres'}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            className="btn-ghost btn-sm shrink-0"
                            onClick={() => void hold(member, 0)}
                          >
                            <RotateCcw className="size-3.5" aria-hidden />
                            <span className="hidden sm:inline">Wieder anzeigen</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      ) : loading ? (
        <div className="card">
          <EmptyState icon={History} title="Verlauf wird geladen …" />
        </div>
      ) : history.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={History}
            title="Noch keine Gebete erfasst"
            description="Sobald du Gebete zuteilst, entsteht hier der Verlauf."
          />
        </div>
      ) : (
        <ul className="card divide-list overflow-hidden">
          {history.slice(0, 100).map((prayer) => (
            <li key={prayer.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={prayer.memberName} id={prayer.memberId} size="sm" />
              <div className="min-w-0 flex-1">
                <MemberLink
                  memberId={prayer.memberId}
                  label="Gebet"
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {prayer.memberName}
                </MemberLink>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {PRAYER_SLOT_LABELS[prayer.slot]}
                </p>
              </div>
              <span className="tabular shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {formatDateShort(prayer.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Eine Zeile der Vorschlagsliste                                      */
/* ------------------------------------------------------------------ */

/**
 * Ein Vorschlag mit allem, was ein Griff auslösen kann.
 *
 * Drei Handgriffe, mehr gibt es hier nicht: für den einen Platz zuteilen,
 * für den anderen – oder die Person für einen Monat übergehen. Wer schon
 * eingeteilt ist, steht blasser da und trägt den Platz als Kennzeichnung;
 * sie verschwindet nicht, sonst wäre unklar, ob man sie eben zugeteilt hat.
 */
function CandidateRow({
  member,
  meta,
  dimmed,
  assigned,
  onAssign,
  onHold,
  readOnly = false,
}: {
  member: Member
  meta: string
  /** Bereits für einen kommenden Sonntag eingeteilt */
  dimmed: boolean
  /** Plätze an diesem Sonntag, die diese Person bereits hat */
  assigned: PrayerSlot[]
  onAssign: (slot: PrayerSlot) => void
  onHold: () => void
  /**
   * Nur nachschauen: Statt der drei Knöpfe steht dann bloss da, für welchen
   * Platz jemand schon eingeteilt ist – die Auskunft, wegen der die Liste
   * auch dem offensteht, der nichts ändern darf.
   */
  readOnly?: boolean
}) {
  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 py-2', dimmed && 'opacity-60')}>
      <Avatar name={`${member.firstName} ${member.lastName}`} id={member.id} size="sm" />

      <div className="min-w-0 flex-1">
        <MemberLink
          memberId={member.id}
          label="Gebet"
          className="block truncate text-sm font-medium hover:underline"
        >
          {member.firstName} {member.lastName}
        </MemberLink>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {meta}
          {dimmed && ' · schon eingeteilt'}
        </p>
      </div>

      {readOnly ? (
        assigned.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            {assigned.map((slot) => (
              <span
                key={slot}
                className="badge bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
              >
                {PRAYER_SLOT_LABELS[slot]}
              </span>
            ))}
          </div>
        )
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {PRAYER_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              className={cn('btn-sm', assigned.includes(slot) ? 'btn-primary' : 'btn-secondary')}
              onClick={() => onAssign(slot)}
              aria-label={`${member.firstName} ${member.lastName} für ${PRAYER_SLOT_LABELS[slot]}`}
            >
              {PRAYER_SLOT_SHORT[slot]}
            </button>
          ))}

          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={onHold}
            title={`Für ${PRAYER_HOLD_DAYS} Tage nicht mehr vorschlagen`}
          >
            <CalendarOff className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Heute nicht</span>
          </button>
        </div>
      )}
    </li>
  )
}
