import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  Cake,
  ChevronsLeftRight,
  HandHeart,
  Lightbulb,
  Mail,
  MapPin,
  Mic,
  Pencil,
  Phone,
  UserRound,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useBack } from '@/hooks/useBack'
import { useCallingRounds, useMemberCallings, usePrayers, useTalks } from '@/hooks/useFirestore'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Feedback'
import { Avatar } from '@/components/ui/Avatar'
import { CallingStatusBadge, StatusBadge, TalkStatusBadge } from '@/components/ui/Badge'
import { CallingRowSummary } from '@/components/agenda/CallingChanges'
import { FOCUS_PARAM } from '@/components/agenda/MeetingFocus'
import {
  callingRowsAbout,
  normalizeCallingChanges,
  type CallingRowMatch,
} from '@/lib/callingChanges'
import { prayerAvailability, talkAvailability, type Availability } from '@/lib/availability'
import { formatDate, getAge, monthsSince, toDate, toDateInput } from '@/lib/dates'
import { cn, formatPhone, telHref } from '@/lib/utils'
import { updateMember } from '@/services/members'
import { callingPeriod, callingsForMember } from '@/services/callings'
import { sortPrayersByDate } from '@/services/prayers'
import {
  ACTIVE_CALLING_STATUSES,
  GENDER_LABELS,
  lastEditedAt,
  MEMBER_STATUS_LABELS,
  ORGANIZATION_LABELS,
  PRAYER_SLOT_LABELS,
  type AgendaItem,
  type Calling,
  type Member,
  type MemberStatus,
  type Prayer,
  type Talk,
} from '@/lib/types'

export function MemberDetail() {
  const { memberId } = useParams<{ memberId: string }>()
  const { membersById, loading } = useData()
  const { data: talks } = useTalks(300)
  /* Wann jemand zuletzt gebetet hat, steht nicht am Mitglied, sondern in den
     Gebeten – wie in der Mitgliederliste. */
  const { data: prayers } = usePrayers(600)
  const { data: callings } = useMemberCallings(memberId)
  /* Die Berufungsrunden der Bischofschaft – für «Potentielle
     Berufungsänderungen» weiter unten. */
  const { data: rounds } = useCallingRounds()

  /*
   * Zurück dorthin, woher der Aufruf kam – und zwar wirklich dorthin.
   *
   * Wer in der Vorschlagsliste unter «Ansprachen» ein Mitglied öffnet, will
   * danach wieder bei den Vorschlägen stehen und nicht in der
   * Mitgliederliste, in der er nie war. `useBack()` geht deshalb einen
   * Schritt im Browserverlauf zurück; die vorige Ansicht steht damit so da,
   * wie man sie verlassen hat.
   */
  const back = useBack({ to: '/mitglieder', label: 'Mitglieder' })

  const [editOpen, setEditOpen] = useState(false)

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

  const memberPrayers = useMemo(
    () => sortPrayersByDate(prayers.filter((prayer) => prayer.memberId === memberId)),
    [prayers, memberId],
  )

  const memberCallings = useMemo(
    () => (memberId ? callingsForMember(callings, memberId) : []),
    [callings, memberId],
  )

  /*
   * Wo diese Person in einer Berufungsrunde vorkommt.
   *
   * Zusammengesucht wird über beide Wege, auf denen jemand in einer Runde
   * landet: als Name in der Spalte «Name» oder mit «@» in einem der
   * Freitextfelder erwähnt (siehe `callingRowsAbout`). Was dabei nichts
   * findet, fällt weg – die Kachel erscheint nur, wenn es etwas zu zeigen
   * gibt.
   */
  const ideas = useMemo(() => {
    if (!member) return []
    const mention = { id: member.id, name: `${member.firstName} ${member.lastName}` }
    return rounds
      .map((item) => ({
        item,
        // Erst geradeziehen: Was aus Firestore kommt, darf kaputt sein, und
        // ein Profil soll daran nicht zerbrechen.
        matches: callingRowsAbout(normalizeCallingChanges(item.callingChanges), mention),
      }))
      .filter((entry) => entry.matches.length > 0)
  }, [rounds, member])
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
  const resolve = (ids: string[] | undefined): Member[] =>
    (ids ?? []).map((id) => membersById.get(id)).filter((m): m is Member => m !== undefined)
  const partners = resolve(member.ministeringPartnerIds)
  const assigned = resolve(member.ministeringAssignedIds)

  const talkStatus = talkAvailability(member)
  const prayerStatus = prayerAvailability(member)

  return (
    <>
      <Link
        to={back.to}
        onClick={(event) => {
          // Mittelklick und «in neuem Tab öffnen» sollen weiterhin die
          // Adresse benutzen – abgefangen wird nur der gewöhnliche Klick.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
          event.preventDefault()
          back.go()
        }}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {back.label}
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
              {/* Der Vermerk «nicht anfragen» – hier sichtbar, damit er nicht
                  in den Listen verschwindet, die er selbst ausblendet. */}
              <HoldBadge status={talkStatus} topic="Ansprachen" />
              <HoldBadge status={prayerStatus} topic="Gebete" />
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

          {/* Kein Löschen: Wer nicht mehr zur Gemeinde gehört, fehlt im LCR –
              und der nächste Import räumt ihn weg. Von Hand gelöscht wäre er
              beim übernächsten Import wieder da. */}
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden />
              Bearbeiten
            </button>
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

        {/* ---------- Ansprachen und Gebete ---------- */}
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Ansprachen und Gebete</h2>

          {/* Beide Fragen stehen beisammen, weil sie zusammen gestellt werden:
              Wer am Pult vorgesehen ist, ist es selten nur für das eine. Und
              beide werden gleich beantwortet – zuletzt dran, und ob eine
              Anfrage im Moment überhaupt in Frage kommt. */}
          <div className="space-y-4">
            <TalkPanel talks={memberTalks} member={member} status={talkStatus} />
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <PrayerPanel prayers={memberPrayers} status={prayerStatus} />
            </div>
          </div>
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

        {/* ---------- Potentielle Berufungsänderungen ----------
             Steht nur da, wenn diese Person in einer Berufungsrunde
             vorkommt: An den meisten Profilen gäbe es nichts zu zeigen, und
             eine dauerhaft leere Kachel unter den Berufungen behauptete, es
             fehle etwas. */}
        {ideas.length > 0 && <CallingIdeas entries={ideas} />}
      </div>

      <MemberForm open={editOpen} onClose={() => setEditOpen(false)} member={member} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Potentielle Berufungsänderungen                                     */
/* ------------------------------------------------------------------ */

/**
 * Was die Bischofschaft in ihren Berufungsrunden über diese Person notiert
 * hat.
 *
 * Die Runde selbst steht in einer Pendenz oder einem Traktandum und geht
 * zwanzig Namen durch; hier steht davon genau das, was diese eine Person
 * betrifft – die Zeilen, in denen sie genannt oder erwähnt ist, mit Farbe,
 * Feldern und Zuständigen wie in der Runde.
 *
 * **Es ist eine Ideenliste.** Nichts davon ist eine Berufung; wer welche
 * hat, steht in der Kachel darüber und kommt allein aus dem LCR. Deshalb
 * heisst es «potentiell» und steht bewusst **unter** den Berufungen.
 *
 * Jeder Abschnitt trägt den Titel seines Eintrags und führt dorthin – in die
 * Sitzung, in der die Runde steht, oder in die Pendenzenliste. Wer hier
 * etwas ändern will, tut es dort, wo die ganze Runde beisammen ist.
 */
function CallingIdeas({
  entries,
}: {
  entries: { item: AgendaItem; matches: CallingRowMatch[] }[]
}) {
  return (
    <section className="card p-4 lg:col-span-3">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="size-4 text-slate-400" aria-hidden />
        Potentielle Berufungsänderungen
      </h2>
      <p className="hint mb-3">
        Zeilen aus den Berufungsrunden der Bischofschaft. Eine Ideenliste – an den Berufungen ändert
        sie nichts.
      </p>

      <div className="space-y-4">
        {entries.map(({ item, matches }) => (
          <div key={item.id}>
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link
                to={
                  item.meetingId
                    ? `/sitzungen/${item.meetingId}?${FOCUS_PARAM}=${item.id}`
                    : `/pendenzen?pendenz=${item.id}`
                }
                className="text-brand-700 dark:text-brand-300 text-sm font-medium hover:underline"
              >
                {item.title || 'Ohne Titel'}
              </Link>
              {item.status === 'done' && <StatusBadge status="done" />}
              {lastEditedAt(item) && (
                <span className="tabular text-xs text-slate-400">
                  {formatDate(lastEditedAt(item))}
                </span>
              )}
            </div>

            <ul className="space-y-2">
              {matches.map((match) => (
                <CallingRowSummary key={match.row.id} match={match} memberRefs={item.memberRefs} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Anfragen: Ansprachen und Gebete                                     */
/* ------------------------------------------------------------------ */

/**
 * «Nicht anfragen» als Etikett – oben neben dem Namen.
 *
 * Es steht nur da, wenn der Vermerk gerade gilt: Ein Etikett «kann angefragt
 * werden» an jedem zweiten Profil sagte nichts, denn das ist der Normalfall.
 * Bis wann er gilt, steht gleich mit dabei – ohne Datum gilt er auf Weiteres.
 */
function HoldBadge({ status, topic }: { status: Availability; topic: string }) {
  if (status.available) return null
  return (
    <span
      className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
      title={
        status.changedAt
          ? `Seit ${formatDate(status.changedAt)} vermerkt – erscheint nicht in den Vorschlägen`
          : 'Erscheint nicht in den Vorschlägen'
      }
    >
      Keine {topic}
      {status.until && ` bis ${formatDate(status.until)}`}
    </span>
  )
}

/**
 * Der Stand in Worten – für die Kachel im Profil.
 *
 * Drei Fälle, und alle drei kommen vor: Der Vermerk gilt, er ist abgelaufen
 * (dann ist die Person wieder frei, und das Datum erklärt, warum sie eine
 * Weile fehlte), oder er stand nie. Wann die Entscheidung getroffen wurde,
 * steht dabei – ein «nicht anfragen» ohne Zeitpunkt lässt offen, ob es von
 * letzter Woche stammt oder von vor drei Jahren.
 */
function AvailabilityNote({ status, topic }: { status: Availability; topic: string }) {
  if (!status.available) {
    return (
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
        {status.until
          ? `Nicht für ${topic} anfragen bis ${formatDate(status.until)}`
          : `Nicht für ${topic} anfragen`}
        {status.changedAt && (
          <span className="text-slate-500 dark:text-slate-400">
            {' '}
            · vermerkt am {formatDate(status.changedAt)}
          </span>
        )}
      </p>
    )
  }

  return (
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
      Kann angefragt werden
      {status.expired && status.until
        ? ` · Vermerk lief am ${formatDate(status.until)} ab`
        : status.changedAt && ` · seit ${formatDate(status.changedAt)}`}
    </p>
  )
}

/** Zuletzt gesprochen, der Stand der Anfragen und die letzten Einträge. */
function TalkPanel({
  talks,
  member,
  status,
}: {
  talks: Talk[]
  member: Member
  status: Availability
}) {
  const months = monthsSince(member.lastTalkDate)

  return (
    <div>
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        <Mic className="size-3.5" aria-hidden />
        Ansprachen
      </h3>

      <p className="mt-1.5 text-sm">
        {member.lastTalkDate ? (
          <>
            Zuletzt <strong>{formatDate(member.lastTalkDate)}</strong>
            {months !== null && (
              <span className="text-slate-500 dark:text-slate-400"> · vor {months} Monaten</span>
            )}
          </>
        ) : (
          <span className="text-amber-600 dark:text-amber-400">Noch keine Ansprache</span>
        )}
      </p>

      <AvailabilityNote status={status} topic="Ansprachen" />

      {talks.length > 0 && (
        <ul className="divide-list -mx-1 mt-2 text-sm">
          {talks.slice(0, 5).map((talk) => (
            <li key={talk.id} className="flex items-center justify-between gap-2 px-1 py-2">
              <span className="tabular">{formatDate(talk.date)}</span>
              <TalkStatusBadge status={talk.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Dasselbe für die Gebete.
 *
 * «Zuletzt» meint das letzte gehaltene Gebet und nicht die nächste
 * Zuteilung: Wer fragt, wie lange jemand nicht mehr dran war, meint die
 * Vergangenheit. Was noch bevorsteht, steht in der Liste darunter und ist
 * dort als kommend angeschrieben.
 */
function PrayerPanel({ prayers, status }: { prayers: Prayer[]; status: Availability }) {
  const now = new Date()
  const last = prayers.map((prayer) => toDate(prayer.date)).find((date) => date && date <= now)
  const months = monthsSince(last)

  return (
    <div>
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        <HandHeart className="size-3.5" aria-hidden />
        Gebete
      </h3>

      <p className="mt-1.5 text-sm">
        {last ? (
          <>
            Zuletzt <strong>{formatDate(last)}</strong>
            {months !== null && (
              <span className="text-slate-500 dark:text-slate-400"> · vor {months} Monaten</span>
            )}
          </>
        ) : (
          <span className="text-amber-600 dark:text-amber-400">Noch kein Gebet</span>
        )}
      </p>

      <AvailabilityNote status={status} topic="Gebete" />

      {prayers.length > 0 && (
        <ul className="divide-list -mx-1 mt-2 text-sm">
          {prayers.slice(0, 5).map((prayer) => {
            const date = toDate(prayer.date)
            return (
              <li key={prayer.id} className="flex items-center justify-between gap-2 px-1 py-2">
                <span className="tabular">{formatDate(prayer.date)}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {PRAYER_SLOT_LABELS[prayer.slot]}
                  {date && date > now && ' · geplant'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
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
  status: MemberStatus
  lastTalkDate: string
  availableForTalks: boolean
  /** Bis wann «nicht anfragen» gilt – leer heisst «auf Weiteres» */
  talkHoldUntil: string
  availableForPrayers: boolean
  prayerHoldUntil: string
  notes: string
  tags: string
}

const EMPTY: FormState = {
  status: 'active',
  lastTalkDate: '',
  availableForTalks: true,
  talkHoldUntil: '',
  availableForPrayers: true,
  prayerHoldUntil: '',
  notes: '',
  tags: '',
}

/**
 * Ein Datum aus dem Formular als Ende eines Vermerks.
 *
 * Der letzte Moment des Tages und nicht der Mittag: «bis 31.12.2026» heisst,
 * dass der 31. noch dazugehört. Bei Mittag fiele der halbe Tag weg, und das
 * merkte niemand – ausser der Person, die an jenem Sonntag plötzlich wieder
 * in der Liste stünde.
 */
function holdDate(value: string): Date | null {
  return value ? new Date(`${value}T23:59:59`) : null
}

/** Hat sich an dieser Entscheidung etwas geändert? */
function holdChanged(before: Availability, available: boolean, until: Date | null): boolean {
  if (before.available !== available) return true
  if (available) return false
  return toDateInput(before.until) !== toDateInput(until)
}

/**
 * Ein Mitglied bearbeiten.
 *
 * **Das Verzeichnis gehört dem LCR.** Name, Geschlecht, Geburtsdatum,
 * Adresse, Kontakt und Betreuung kommen von dort und werden dort gepflegt –
 * hier stehen sie, lassen sich aber nicht ändern. Von Hand nachgeführt hiesse,
 * zwei Stände nebeneinander zu führen, und der eine wäre falsch: Was hier
 * entstünde, wäre beim nächsten Import ohnehin wieder überschrieben.
 *
 * Bearbeiten lässt sich, was allein diese App führt – der Status, wann jemand
 * zuletzt gesprochen hat, ob er für Ansprachen und Gebete angefragt werden
 * kann, dazu Notiz und Schlagworte. Anlegen lässt sich hier niemand; auch das
 * geschieht beim Import.
 */
export function MemberForm({
  open,
  onClose,
  member,
}: {
  open: boolean
  onClose: () => void
  member: Member
}) {
  const toast = useToast()
  const { membersById } = useData()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    // Aus dem **geltenden** Stand und nicht aus den rohen Feldern: Ein
    // abgelaufener Vermerk steht als Haken wieder da, wo er hingehört, und
    // räumt sich beim nächsten Speichern von selbst weg.
    const talk = talkAvailability(member)
    const prayer = prayerAvailability(member)
    setForm({
      status: member.status,
      lastTalkDate: toDateInput(member.lastTalkDate),
      availableForTalks: talk.available,
      talkHoldUntil: talk.available ? '' : toDateInput(talk.until),
      availableForPrayers: prayer.available,
      prayerHoldUntil: prayer.available ? '' : toDateInput(prayer.until),
      notes: member.notes ?? '',
      tags: (member.tags ?? []).join(', '),
    })
  }, [open, member])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const names = (ids: string[] | undefined): string =>
    (ids ?? [])
      .map((id) => membersById.get(id))
      .filter((entry): entry is Member => entry !== undefined)
      .map((entry) => `${entry.firstName} ${entry.lastName}`)
      .join(', ')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    setSaving(true)
    try {
      const talkBefore = talkAvailability(member)
      const prayerBefore = prayerAvailability(member)
      const talkUntil = form.availableForTalks ? null : holdDate(form.talkHoldUntil)
      const prayerUntil = form.availableForPrayers ? null : holdDate(form.prayerHoldUntil)
      const now = new Date()

      const payload = {
        status: form.status,
        lastTalkDate: form.lastTalkDate ? new Date(`${form.lastTalkDate}T12:00:00`) : null,

        availableForTalks: form.availableForTalks,
        talkHoldUntil: talkUntil,
        // Der frühere zweite Haken wird beim Speichern still abgeräumt –
        // stehen geblieben hielte er die Person weiter heraus.
        talkHold: false,

        availableForPrayers: form.availableForPrayers,
        prayerHoldUntil: prayerUntil,

        notes: form.notes.trim(),
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),

        // Nur, wenn sich tatsächlich etwas geändert hat: Ein Zeitpunkt, den
        // jedes Speichern neu setzt, beantwortet die Frage «seit wann?» nicht
        // mehr.
        ...(holdChanged(talkBefore, form.availableForTalks, talkUntil) && {
          talkAvailabilityChangedAt: now,
        }),
        ...(holdChanged(prayerBefore, form.availableForPrayers, prayerUntil) && {
          prayerAvailabilityChangedAt: now,
        }),
      }

      const outcome = await updateMember(member.id, payload)
      toast.saved('Mitglied aktualisiert.', outcome)
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
      title="Mitglied bearbeiten"
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
        </div>

        <AvailabilityField
          id="m-talk"
          label="Kann für Ansprachen angefragt werden"
          hint="Abwählen, wenn eine Anfrage nicht in Frage kommt – dann steht die Person in keiner Vorschlagsliste mehr."
          available={form.availableForTalks}
          until={form.talkHoldUntil}
          changedAt={talkAvailability(member).changedAt}
          onChange={(next) => setForm((current) => ({ ...current, ...next }))}
          availableKey="availableForTalks"
          untilKey="talkHoldUntil"
        />

        <AvailabilityField
          id="m-prayer"
          label="Kann für Gebete angefragt werden"
          hint="Abwählen, wenn im Moment kein Gebet in Frage kommt. Das «Heute nicht» beim Zuteilen setzt hier ein Datum ein paar Wochen voraus."
          available={form.availableForPrayers}
          until={form.prayerHoldUntil}
          changedAt={prayerAvailability(member).changedAt}
          onChange={(next) => setForm((current) => ({ ...current, ...next }))}
          availableKey="availableForPrayers"
          untilKey="prayerHoldUntil"
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
          />
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
          />
          <p className="hint">Mit Komma trennen.</p>
        </div>

        {/* Ab hier steht der Bestand des LCR: sichtbar, damit das Profil
            vollständig bleibt, und gesperrt, weil er dort gepflegt wird. */}
        <fieldset
          disabled
          className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">Vorname</span>
              <input className="input" value={member.firstName} readOnly />
            </div>
            <div>
              <span className="label">Nachname</span>
              <input className="input" value={member.lastName} readOnly />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">Geschlecht</span>
              <input className="input" value={GENDER_LABELS[member.gender]} readOnly />
            </div>
            <div>
              <span className="label">Geburtsdatum</span>
              <input className="input" value={toDateInput(member.birthDate)} type="date" readOnly />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <span className="label">E-Mail</span>
              <input className="input" value={member.email ?? ''} readOnly />
            </div>
            <div>
              <span className="label">Mobile</span>
              <input className="input" value={member.mobile ?? ''} readOnly />
            </div>
            <div>
              <span className="label">Festnetz</span>
              <input className="input" value={member.phone ?? ''} readOnly />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <span className="label">Strasse</span>
              <input className="input" value={member.street ?? ''} readOnly />
            </div>
            <div>
              <span className="label">PLZ</span>
              <input className="input" value={member.zip ?? ''} readOnly />
            </div>
            <div>
              <span className="label">Ort</span>
              <input className="input" value={member.city ?? ''} readOnly />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">Betreuungspartner</span>
              <input className="input" value={names(member.ministeringPartnerIds)} readOnly />
            </div>
            <div>
              <span className="label">Betreuungsauftrag</span>
              <input className="input" value={names(member.ministeringAssignedIds)} readOnly />
            </div>
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}

/**
 * Ein Haken mit einem «bis wann» – für Ansprachen wie für Gebete.
 *
 * **Aus zwei Haken ist einer geworden.** «Kann angefragt werden» und daneben
 * «vorerst nicht anfragen» stellten dieselbe Frage zweimal; beide zugleich
 * angehakt ergaben keinen Sinn, und welcher von beiden dann galt, wusste
 * niemand. Jetzt steht eine Entscheidung da, und das Datum sagt, wie lange
 * sie gilt: leer heisst «auf Weiteres», ein Datum lässt den Vermerk von
 * selbst ablaufen.
 *
 * Das Feld erscheint erst, wenn der Haken weg ist: Ein «bis wann» zu jemandem,
 * der angefragt werden darf, beantwortet keine Frage.
 */
function AvailabilityField<A extends string, U extends string>({
  id,
  label,
  hint,
  available,
  until,
  changedAt,
  onChange,
  availableKey,
  untilKey,
}: {
  id: string
  label: string
  hint: string
  available: boolean
  until: string
  /** Wann die Entscheidung zuletzt getroffen wurde – `null`, solange nie */
  changedAt: Date | null
  onChange: (patch: Partial<Record<A, boolean> & Record<U, string>>) => void
  availableKey: A
  untilKey: U
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="checkbox mt-0.5"
          checked={available}
          onChange={(event) =>
            onChange({
              [availableKey]: event.target.checked,
              // Wieder anfragbar heisst: Das «bis wann» hat sich erledigt.
              [untilKey]: event.target.checked ? '' : until,
            } as Partial<Record<A, boolean> & Record<U, string>>)
          }
        />
        <span className="text-sm">
          {label}
          <span className="hint mt-0.5 block">{hint}</span>
        </span>
      </label>

      {!available && (
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <label className="label" htmlFor={id}>
            Nicht anfragen bis
          </label>
          <input
            id={id}
            type="date"
            className="input sm:max-w-56"
            value={until}
            onChange={(event) =>
              onChange({ [untilKey]: event.target.value } as Partial<
                Record<A, boolean> & Record<U, string>
              >)
            }
          />
          <p className="hint">
            Leer heisst «auf Weiteres». Mit Datum steht die Person am Tag danach von selbst wieder
            in den Vorschlägen.
          </p>
        </div>
      )}

      {changedAt && <p className="hint">Zuletzt geändert am {formatDate(changedAt)}.</p>}
    </div>
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
