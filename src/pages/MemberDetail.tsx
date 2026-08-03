import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  Cake,
  ChevronsLeftRight,
  Mail,
  MapPin,
  Mic,
  Pencil,
  Phone,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useMemberCallings, useTalks } from '@/hooks/useFirestore'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Feedback'
import { Avatar } from '@/components/ui/Avatar'
import { CallingStatusBadge, TalkStatusBadge } from '@/components/ui/Badge'
import { MemberPicker } from '@/components/ui/Pickers'
import { formatDate, getAge, monthsSince, toDateInput } from '@/lib/dates'
import { cn, formatPhone, telHref } from '@/lib/utils'
import { createMember, deleteMember, updateMember } from '@/services/members'
import { callingPeriod, callingsForMember } from '@/services/callings'
import {
  ACTIVE_CALLING_STATUSES,
  GENDER_LABELS,
  MEMBER_STATUS_LABELS,
  ORGANIZATION_LABELS,
  type Calling,
  type Gender,
  type Member,
  type MemberStatus,
} from '@/lib/types'

export function MemberDetail() {
  const { memberId } = useParams<{ memberId: string }>()
  const { membersById, loading } = useData()
  const { isApproved } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { data: talks } = useTalks(300)
  const { data: callings } = useMemberCallings(memberId)

  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const member = memberId ? membersById.get(memberId) : undefined

  const memberTalks = useMemo(
    () =>
      talks
        .filter((talk) => talk.memberId === memberId)
        .sort((a, b) => {
          const aTime = a.date && 'toMillis' in a.date ? a.date.toMillis() : 0
          const bTime = b.date && 'toMillis' in b.date ? b.date.toMillis() : 0
          return bTime - aTime
        }),
    [talks, memberId],
  )

  const memberCallings = useMemo(
    () => (memberId ? callingsForMember(callings, memberId) : []),
    [callings, memberId],
  )
  const running = memberCallings.filter((calling) =>
    ACTIVE_CALLING_STATUSES.includes(calling.status),
  )
  const earlier = memberCallings.filter(
    (calling) => !ACTIVE_CALLING_STATUSES.includes(calling.status),
  )

  if (loading) return null

  if (!member) {
    return (
      <div className="card">
        <EmptyState
          icon={UserRound}
          title="Mitglied nicht gefunden"
          action={
            <Link to="/mitglieder" className="btn-primary">
              Zur Mitgliederliste
            </Link>
          }
        />
      </div>
    )
  }

  const age = getAge(member.birthDate)
  const months = monthsSince(member.lastTalkDate)
  const resolve = (ids: string[] | undefined): Member[] =>
    (ids ?? []).map((id) => membersById.get(id)).filter((m): m is Member => m !== undefined)
  const partners = resolve(member.ministeringPartnerIds)
  const assigned = resolve(member.ministeringAssignedIds)

  return (
    <>
      <Link
        to="/mitglieder"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mitglieder
      </Link>

      {/* ---------- Kopf ---------- */}
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar
            name={`${member.firstName} ${member.lastName}`}
            id={member.id}
            size="lg"
            className="size-14 text-lg"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {member.firstName} {member.lastName}
              </h1>
              <StatusToggle member={member} />
              {!member.availableForTalks && (
                <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Keine Ansprachen
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
              {member.birthDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Cake className="size-3.5 text-slate-400" aria-hidden />
                  {formatDate(member.birthDate)}
                  {age !== null && ` (${age})`}
                </span>
              )}
              {member.gender !== 'unknown' && <span>{GENDER_LABELS[member.gender]}</span>}
              {(member.street || member.city) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-slate-400" aria-hidden />
                  {[member.street, [member.zip, member.city].filter(Boolean).join(' ')]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {member.email && (
                <a href={`mailto:${member.email}`} className="btn-secondary btn-sm">
                  <Mail className="size-3.5" aria-hidden />
                  {member.email}
                </a>
              )}
              {member.mobile && (
                <a href={telHref(member.mobile) ?? '#'} className="btn-secondary btn-sm">
                  <Phone className="size-3.5" aria-hidden />
                  {formatPhone(member.mobile)}
                </a>
              )}
              {member.phone && member.phone !== member.mobile && (
                <a href={telHref(member.phone) ?? '#'} className="btn-secondary btn-sm">
                  <Phone className="size-3.5" aria-hidden />
                  {formatPhone(member.phone)}
                </a>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden />
              Bearbeiten
            </button>
            {isApproved && (
              <button
                type="button"
                className="btn-ghost text-rose-600 dark:text-rose-400"
                onClick={() => setConfirmDelete(true)}
                aria-label="Mitglied löschen"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {member.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {member.tags.map((tag) => (
              <span
                key={tag}
                className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------- Notiz ---------- */}
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Notiz</h2>
          {member.notes ? (
            <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">
              {member.notes}
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Keine Notiz erfasst. Hier passen Hinweise zur Betreuung oder Besonderheiten hinein.
            </p>
          )}
          {(partners.length > 0 || assigned.length > 0) && (
            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
              <MemberLinkList label="Betreuungspartner" members={partners} />
              <MemberLinkList label="Betreuungsauftrag" members={assigned} />
            </div>
          )}
        </section>

        {/* ---------- Ansprachen ---------- */}
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Mic className="size-4 text-slate-400" aria-hidden />
            Ansprachen
          </h2>
          <p className="mb-3 text-sm">
            {member.lastTalkDate ? (
              <>
                Zuletzt <strong>{formatDate(member.lastTalkDate)}</strong>
                {months !== null && (
                  <span className="text-slate-500 dark:text-slate-400">
                    {' '}
                    · vor {months} Monaten
                  </span>
                )}
              </>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Noch keine Ansprache</span>
            )}
          </p>

          {memberTalks.length > 0 ? (
            <ul className="divide-list -mx-1 text-sm">
              {memberTalks.slice(0, 6).map((talk) => (
                <li key={talk.id} className="flex items-center justify-between gap-2 px-1 py-2">
                  <span>{formatDate(talk.date)}</span>
                  <TalkStatusBadge status={talk.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">Keine Einträge.</p>
          )}
        </section>

        {/* ---------- Berufungen ---------- */}
        <section className="card p-4 lg:col-span-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Award className="size-4 text-slate-400" aria-hidden />
            Berufungen
          </h2>
          {memberCallings.length === 0 ? (
            <p className="text-sm text-slate-400">Keine Berufung erfasst.</p>
          ) : (
            <>
              <CallingList callings={running} />

              {/*
               * Der Verlauf steht eingeklappt darunter: Er beantwortet die
               * Frage «was hat diese Person schon getan?», die man vor einer
               * neuen Berufung stellt – aber nicht die, mit der man das
               * Profil sonst öffnet.
               */}
              {earlier.length > 0 && (
                <details className={running.length > 0 ? 'mt-3' : undefined}>
                  <summary className="cursor-pointer text-sm font-medium text-slate-500 dark:text-slate-400">
                    Früher · {earlier.length} {earlier.length === 1 ? 'Berufung' : 'Berufungen'}
                  </summary>
                  <CallingList callings={earlier} />
                </details>
              )}
            </>
          )}
        </section>
      </div>

      <MemberForm open={editOpen} onClose={() => setEditOpen(false)} member={member} />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteMember(member.id).then(() => {
            toast.success('Mitglied gelöscht.')
            navigate('/mitglieder')
          })
        }}
        title="Mitglied löschen?"
        message={`${member.firstName} ${member.lastName} wird endgültig entfernt. Erfasste Ansprachen und Berufungen bleiben bestehen, verlieren aber ihren Bezug.`}
        confirmLabel="Löschen"
        danger
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Formular                                                            */
/* ------------------------------------------------------------------ */

/**
 * Status umschalten, ohne den Bearbeiten-Dialog.
 *
 * Aktiv oder inaktiv ist die Angabe, die sich am häufigsten ändert – nach
 * einem Besuch, einem Gespräch, einem Wegzug. Sie dafür jedes Mal durch ein
 * Formular zu führen, hielte niemanden davon ab, es einfach zu lassen.
 */
function StatusToggle({ member }: { member: Member }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const active = member.status === 'active'

  return (
    <button
      type="button"
      disabled={saving}
      aria-pressed={active}
      title={active ? 'Auf «inaktiv» setzen' : 'Auf «aktiv» setzen'}
      onClick={() => {
        setSaving(true)
        void updateMember(member.id, { status: active ? 'inactive' : 'active' })
          .then(() => toast.success(active ? 'Als inaktiv vermerkt.' : 'Als aktiv vermerkt.'))
          .catch(() => toast.error('Speichern fehlgeschlagen.'))
          .finally(() => setSaving(false))
      }}
      className={cn(
        'badge inline-flex items-center gap-1 transition',
        active
          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200'
          : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300',
        saving && 'opacity-50',
      )}
    >
      {MEMBER_STATUS_LABELS[member.status]}
      <ChevronsLeftRight className="size-3" aria-hidden />
    </button>
  )
}

/* ------------------------------------------------------------------ */

interface FormState {
  firstName: string
  lastName: string
  gender: Gender
  birthDate: string
  email: string
  phone: string
  mobile: string
  street: string
  zip: string
  city: string
  status: MemberStatus
  availableForTalks: boolean
  notes: string
  ministeringPartnerIds: string[]
  ministeringAssignedIds: string[]
  lastTalkDate: string
  tags: string
}

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  gender: 'unknown',
  birthDate: '',
  email: '',
  phone: '',
  mobile: '',
  street: '',
  zip: '',
  city: '',
  status: 'active',
  availableForTalks: true,
  notes: '',
  ministeringPartnerIds: [],
  ministeringAssignedIds: [],
  lastTalkDate: '',
  tags: '',
}

export function MemberForm({
  open,
  onClose,
  member,
}: {
  open: boolean
  onClose: () => void
  member?: Member
}) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      member
        ? {
            firstName: member.firstName,
            lastName: member.lastName,
            gender: member.gender,
            birthDate: toDateInput(member.birthDate),
            email: member.email ?? '',
            phone: member.phone ?? '',
            mobile: member.mobile ?? '',
            street: member.street ?? '',
            zip: member.zip ?? '',
            city: member.city ?? '',
            status: member.status,
            availableForTalks: member.availableForTalks ?? true,
            notes: member.notes ?? '',
            ministeringPartnerIds: member.ministeringPartnerIds ?? [],
            ministeringAssignedIds: member.ministeringAssignedIds ?? [],
            lastTalkDate: toDateInput(member.lastTalkDate),
            tags: (member.tags ?? []).join(', '),
          }
        : EMPTY,
    )
  }, [open, member])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.lastName.trim() && !form.firstName.trim()) {
      toast.error('Bitte gib mindestens einen Namen ein.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        birthDate: form.birthDate ? new Date(`${form.birthDate}T12:00:00`) : null,
        email: form.email.trim(),
        phone: form.phone.trim(),
        mobile: form.mobile.trim(),
        street: form.street.trim(),
        zip: form.zip.trim(),
        city: form.city.trim(),
        status: form.status,
        availableForTalks: form.availableForTalks,
        notes: form.notes.trim(),
        ministeringPartnerIds: form.ministeringPartnerIds,
        ministeringAssignedIds: form.ministeringAssignedIds,
        lastTalkDate: form.lastTalkDate ? new Date(`${form.lastTalkDate}T12:00:00`) : null,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      }

      if (member) {
        const outcome = await updateMember(member.id, payload)
        toast.saved('Mitglied aktualisiert.', outcome)
      } else {
        const { outcome } = await createMember(payload)
        toast.saved('Mitglied erfasst.', outcome)
      }
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? 'Mitglied bearbeiten' : 'Neues Mitglied'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" form="member-form" className="btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </>
      }
    >
      <form id="member-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="m-firstName">
              Vorname
            </label>
            <input
              id="m-firstName"
              className="input"
              value={form.firstName}
              onChange={(event) => update('firstName', event.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className="label" htmlFor="m-lastName">
              Nachname
            </label>
            <input
              id="m-lastName"
              className="input"
              value={form.lastName}
              onChange={(event) => update('lastName', event.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="m-gender">
              Geschlecht
            </label>
            <select
              id="m-gender"
              className="input"
              value={form.gender}
              onChange={(event) => update('gender', event.target.value as Gender)}
            >
              {Object.entries(GENDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-birth">
              Geburtsdatum
            </label>
            <input
              id="m-birth"
              type="date"
              className="input"
              value={form.birthDate}
              onChange={(event) => update('birthDate', event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="m-status">
              Status
            </label>
            <select
              id="m-status"
              className="input"
              value={form.status}
              onChange={(event) => update('status', event.target.value as MemberStatus)}
            >
              {Object.entries(MEMBER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label" htmlFor="m-email">
              E-Mail
            </label>
            <input
              id="m-email"
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="m-mobile">
              Mobile
            </label>
            <input
              id="m-mobile"
              type="tel"
              className="input"
              value={form.mobile}
              onChange={(event) => update('mobile', event.target.value)}
              placeholder="079 123 45 67"
            />
          </div>
          <div>
            <label className="label" htmlFor="m-phone">
              Festnetz
            </label>
            <input
              id="m-phone"
              type="tel"
              className="input"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="m-street">
              Strasse
            </label>
            <input
              id="m-street"
              className="input"
              value={form.street}
              onChange={(event) => update('street', event.target.value)}
              autoComplete="street-address"
            />
          </div>
          <div>
            <label className="label" htmlFor="m-zip">
              PLZ
            </label>
            <input
              id="m-zip"
              className="input"
              value={form.zip}
              onChange={(event) => update('zip', event.target.value)}
              autoComplete="postal-code"
            />
          </div>
          <div>
            <label className="label" htmlFor="m-city">
              Ort
            </label>
            <input
              id="m-city"
              className="input"
              value={form.city}
              onChange={(event) => update('city', event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="m-lastTalk">
              Letzte Ansprache
            </label>
            <input
              id="m-lastTalk"
              type="date"
              className="input"
              value={form.lastTalkDate}
              onChange={(event) => update('lastTalkDate', event.target.value)}
            />
            <p className="hint">Steuert die Auswertung «lange nicht mehr dran».</p>
          </div>
          <div>
            <label className="label" htmlFor="m-tags">
              Schlagworte
            </label>
            <input
              id="m-tags"
              className="input"
              value={form.tags}
              onChange={(event) => update('tags', event.target.value)}
              placeholder="Neubekehrt, Rückkehrer"
            />
            <p className="hint">Mit Komma trennen.</p>
          </div>
        </div>

        <MemberPicker
          value={form.ministeringPartnerIds}
          onChange={(next) => update('ministeringPartnerIds', next)}
          label="Betreuungspartner"
          placeholder="Mitglied suchen …"
        />

        <MemberPicker
          value={form.ministeringAssignedIds}
          onChange={(next) => update('ministeringAssignedIds', next)}
          label="Betreuungsauftrag"
          placeholder="Mitglied suchen …"
        />

        <div>
          <label className="label" htmlFor="m-notes">
            Notiz
          </label>
          <textarea
            id="m-notes"
            className="input min-h-24 resize-y"
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="Betreuungshinweise, Besonderheiten, Absprachen …"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <input
            type="checkbox"
            className="size-4 rounded"
            checked={form.availableForTalks}
            onChange={(event) => update('availableForTalks', event.target.checked)}
          />
          <span className="text-sm">
            Kann für Ansprachen angefragt werden
            <span className="hint mt-0.5 block">
              Abwählen bei Kindern oder wenn jemand vorerst nicht angefragt werden soll.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  )
}

/** Berufungen mit Organisation, Stand und Zeitraum – laufende wie frühere. */
function CallingList({ callings }: { callings: Calling[] }) {
  if (callings.length === 0) return null
  return (
    <ul className="divide-list">
      {callings.map((calling) => (
        <li key={calling.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="font-medium">{calling.position}</span>
          {calling.outOfUnit ? (
            <span
              className="badge bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
              title="Pfahl, Seminar, Institut oder Mission – nicht in der Gemeinde"
            >
              Ausserhalb der Einheit
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              {ORGANIZATION_LABELS[calling.organization]}
            </span>
          )}
          <CallingStatusBadge status={calling.status} />
          <span className="tabular text-xs text-slate-400">{callingPeriod(calling)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Verlinkte Namensliste für Betreuungspartner und Betreuungsauftrag.
 * Wird nichts übergeben, verschwindet die Zeile ganz – eine leere
 * Beschriftung sagt nichts aus.
 */
function MemberLinkList({ label, members }: { label: string; members: Member[] }) {
  if (members.length === 0) return null
  return (
    <p>
      <span className="text-slate-500 dark:text-slate-400">{label}: </span>
      {members.map((member, index) => (
        <span key={member.id}>
          {index > 0 && ', '}
          <Link
            to={`/mitglieder/${member.id}`}
            className="text-brand-600 dark:text-brand-300 hover:underline"
          >
            {member.firstName} {member.lastName}
          </Link>
        </span>
      ))}
    </p>
  )
}
