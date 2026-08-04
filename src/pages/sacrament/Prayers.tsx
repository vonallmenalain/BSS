import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HandHeart, History } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { usePrayers } from '@/hooks/useFirestore'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/Feedback'
import { SegmentedControl } from '@/components/ui/Pickers'
import { MemberSearchSelect } from '@/components/sacrament/MemberSearchSelect'
import { SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { formatDate, formatDateShort, toDate, toDateInput } from '@/lib/dates'
import {
  lastPrayerByMember,
  rankPrayerCandidates,
  setPrayer,
  sortPrayersByDate,
} from '@/services/prayers'
import { PRAYER_SLOTS, PRAYER_SLOT_LABELS, type Member, type PrayerSlot } from '@/lib/types'

type Tab = 'plan' | 'history'

/**
 * Anfangs- und Schlussgebet je Sonntag.
 *
 * Beim Zuteilen steht bei jedem Vorschlag, wann die Person zuletzt gebetet
 * hat – genau wie bei den Ansprachen. Wer noch nie gebetet hat, steht zuoberst.
 */
export function Prayers() {
  const { date } = useSacrament()
  const { members, settings } = useData()
  const { data: prayers, loading } = usePrayers(400)
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('plan')

  const dateKey = toDateInput(date)

  const assigned = useMemo(() => {
    const map = new Map<PrayerSlot, string>()
    for (const prayer of prayers) {
      if (toDateInput(toDate(prayer.date)) === dateKey) map.set(prayer.slot, prayer.memberId)
    }
    return map
  }, [prayers, dateKey])

  const candidates = useMemo(
    () => rankPrayerCandidates(members, prayers, { gapMonths: settings.prayerGapMonths }),
    [members, prayers, settings.prayerGapMonths],
  )

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

  const history = useMemo(() => sortPrayersByDate(prayers), [prayers])

  return (
    <>
      <SectionHeader title="Gebet" />

      <SegmentedControl<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'plan', label: 'Zuteilen' },
          { value: 'history', label: 'Verlauf', count: history.length },
        ]}
      />

      {tab === 'plan' ? (
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
                suggestions={candidates.map((candidate) => candidate.member)}
                meta={describe}
                placeholder="Name eingeben oder aus den Vorschlägen wählen"
              />
            </section>
          ))}
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
                <Link
                  to={`/mitglieder/${prayer.memberId}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {prayer.memberName}
                </Link>
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
