import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, CircleAlert, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { usePrayers, useTalks } from '@/hooks/useFirestore'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { MemberPicker } from '@/components/ui/Pickers'
import { HymnField } from '@/components/sacrament/HymnField'
import { LeaderField } from '@/components/sacrament/LeaderField'
import { MemberSearchSelect } from '@/components/sacrament/MemberSearchSelect'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { useAutoDraft } from '@/components/sacrament/useDraft'
import { formatDate, formatDateLong, toDate, toDateInput } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { formatHymn } from '@/services/hymns'
import { lastPrayerByMember, rankPrayerCandidates, setPrayer } from '@/services/prayers'
import { createTalk, deleteTalk, rankTalkCandidates, updateTalk } from '@/services/talks'
import {
  addTalkSlot,
  buildProgram,
  emptySacramentMeeting,
  findGaps,
  moveInList,
  newAnnouncement,
  newBusinessEntry,
  newMusicalNumber,
  removeTalkSlot,
  replaceInList,
  saveProgramOrder,
  saveSacramentMeeting,
  talkSlotsFor,
  talksForDate,
  type ProgramEntry,
} from '@/services/sacrament'
import {
  BUSINESS_TYPE_LABELS,
  HYMN_SLOT_LABELS,
  PRAYER_SLOT_LABELS,
  SACRAMENT_KIND_LABELS,
  TALK_KIND_LABELS,
  type AnnouncementEntry,
  type BusinessEntry,
  type BusinessType,
  type HymnChoice,
  type HymnSlot,
  type Member,
  type MusicalNumber,
  type PrayerSlot,
  type SacramentKind,
  type SacramentMeeting,
  type TalkKind,
} from '@/lib/types'

/** Die Felder des Sonntagsprogramms, die auf dieser Seite bearbeitet werden. */
interface MeetingDraft {
  kind: SacramentKind
  presidingId: string
  presidingName: string
  conductingId: string
  conductingName: string
  visitors: string
  notes: string
  announcements: AnnouncementEntry[]
  business: BusinessEntry[]
  hymns: Partial<Record<HymnSlot, HymnChoice>>
  musicalNumbers: MusicalNumber[]
}

interface StepDef {
  key: string
  title: string
  /** Der Fachbereich, aus dem der Punkt stammt */
  to?: string
  content: ReactNode
}

/**
 * Leitung: der ganze Ablauf auf einer Seite – und alles davon hier änderbar.
 *
 * Der Aufbau folgt dem Handbuch (Abschnitt 29.2.1), bewusst gekürzt auf das,
 * was am Pult gebraucht wird: Vorspiel, Willkommensgruss und Nachspiel stehen
 * nicht im Programm, sie ergeben sich von selbst.
 *
 * Nichts wird doppelt geführt. Ansprachen liegen in `talks`, alles Übrige im
 * Programm des Sonntags – dieselben Daten, die «Ansprachen», «Musik», «Gebet»,
 * «Bekanntmachungen» und «Angelegenheiten» zeigen. Wer hier eine Ansprache
 * einfügt oder verschiebt, sieht es dort genauso, und umgekehrt.
 *
 * Geschrieben wird laufend: Es gibt keinen Speichern-Knopf, sondern eine kurze
 * Pause nach der letzten Eingabe.
 */
export function Conducting() {
  const { date, meeting } = useSacrament()
  const { users, members, membersById, settings } = useData()
  const { profile } = useAuth()
  const { data: talks } = useTalks(400)
  const { data: prayers } = usePrayers(400)
  const toast = useToast()

  // Wer plant, bearbeitet; wer druckt, will das reine Programm. Die Wahl
  // bleibt erhalten, damit man sie nicht jedes Mal neu treffen muss.
  const [editing, setEditing] = useLocalStorage<boolean>('bss:abendmahl:ablauf-bearbeiten', true)

  const dateKey = toDateInput(date)
  const sundayTalks = useMemo(() => talksForDate(talks, date), [talks, date])

  /* ---------------- Entwurf, der sich selbst speichert --------------- */

  const server = useMemo<MeetingDraft>(
    () => ({
      kind: meeting?.kind ?? 'regular',
      presidingId: meeting?.presidingId ?? '',
      presidingName: meeting?.presidingName ?? '',
      conductingId: meeting?.conductingId ?? '',
      conductingName: meeting?.conductingName ?? '',
      visitors: meeting?.visitors ?? '',
      notes: meeting?.notes ?? '',
      announcements: meeting?.announcements ?? [],
      business: meeting?.business ?? [],
      hymns: meeting?.hymns ?? {},
      musicalNumbers: meeting?.musicalNumbers ?? [],
    }),
    [meeting],
  )

  const draft = useAutoDraft<MeetingDraft>(
    server,
    (value) =>
      saveSacramentMeeting(date, {
        kind: value.kind,
        presidingId: value.presidingId || null,
        presidingName: value.presidingName || null,
        conductingId: value.conductingId || null,
        conductingName: value.conductingName || null,
        visitors: value.visitors,
        notes: value.notes,
        announcements: value.announcements,
        business: value.business,
        hymns: value.hymns,
        musicalNumbers: value.musicalNumbers,
      }),
    { onError: () => toast.error('Speichern fehlgeschlagen.') },
  )

  const current = draft.value
  const change = (patch: Partial<MeetingDraft>) => draft.set({ ...current, ...patch })

  const setHymn = (slot: HymnSlot, choice: HymnChoice | undefined) => {
    const hymns = { ...current.hymns }
    // Firestore lehnt `undefined` ab – ein geleertes Lied fällt deshalb aus
    // dem Objekt heraus statt auf `undefined` gesetzt zu werden.
    if (choice) hymns[slot] = choice
    else delete hymns[slot]
    change({ hymns })
  }

  /* ---------------- Programm ----------------------------------------- */

  /** Das Programm samt der Änderungen, die noch auf ihren Schreibvorgang warten. */
  const effective = useMemo<SacramentMeeting>(
    () => ({
      ...emptySacramentMeeting(date),
      ...(meeting ?? {}),
      ...current,
      presidingId: current.presidingId || null,
      presidingName: current.presidingName || null,
      conductingId: current.conductingId || null,
      conductingName: current.conductingName || null,
    }),
    [date, meeting, current],
  )

  const planned = talkSlotsFor(meeting, settings.talksPerSunday)

  const program = useMemo(
    () => buildProgram(effective, sundayTalks, (choice) => formatHymn(choice), planned),
    [effective, sundayTalks, planned],
  )

  const prayerBySlot = useMemo(() => {
    const map = new Map<PrayerSlot, { memberId: string; memberName: string }>()
    for (const prayer of prayers) {
      if (toDateInput(toDate(prayer.date)) === dateKey) {
        map.set(prayer.slot, { memberId: prayer.memberId, memberName: prayer.memberName })
      }
    }
    return map
  }, [prayers, dateKey])

  const gaps = useMemo(
    () =>
      findGaps(
        effective,
        sundayTalks,
        { opening: prayerBySlot.has('opening'), closing: prayerBySlot.has('closing') },
        planned,
      ),
    [effective, sundayTalks, prayerBySlot, planned],
  )

  /* ---------------- Vorschlagslisten --------------------------------- */

  const talkCandidates = useMemo(
    () =>
      rankTalkCandidates(members, talks, {
        gapMonths: settings.talkGapMonths,
        minAge: settings.talkMinAge,
      }).map((candidate) => candidate.member),
    [members, talks, settings.talkGapMonths, settings.talkMinAge],
  )

  const prayerCandidates = useMemo(
    () =>
      rankPrayerCandidates(members, prayers, { gapMonths: settings.prayerGapMonths }).map(
        (candidate) => candidate.member,
      ),
    [members, prayers, settings.prayerGapMonths],
  )

  const lastPrayer = useMemo(() => lastPrayerByMember(prayers), [prayers])

  const describeTalk = (member: Member) =>
    member.lastTalkDate ? `zuletzt ${formatDate(member.lastTalkDate)}` : 'noch nie gesprochen'

  const describePrayer = (member: Member) => {
    const last = lastPrayer.get(member.id)
    return last ? `zuletzt ${formatDate(last)}` : 'noch nie gebetet'
  }

  /* ---------------- Änderungen ausserhalb des Entwurfs --------------- */

  const guard = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
    } catch (error) {
      console.error(error)
      toast.error(message)
    }
  }

  const talkDate = useMemo(
    () => new Date(`${dateKey}T${settings.sacramentTime}:00`),
    [dateKey, settings.sacramentTime],
  )

  const assignTalk = (slot: number, member: Member | null) => {
    if (!member) return
    void guard(
      () =>
        createTalk({
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`.trim(),
          date: talkDate,
          slot,
          kind: 'talk',
          status: 'planned',
          askedById: profile?.id ?? null,
        }),
      'Ansprache konnte nicht eingetragen werden.',
    )
  }

  const changeSpeaker = (talkId: string, member: Member | null) => {
    if (!member) {
      // Ohne Person gibt es keine Ansprache mehr – der Platz wird wieder frei.
      void guard(() => deleteTalk(talkId), 'Ansprache konnte nicht entfernt werden.')
      return
    }
    void guard(
      () =>
        updateTalk(talkId, {
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`.trim(),
        }),
      'Ansprache konnte nicht geändert werden.',
    )
  }

  const move = (index: number, delta: number) => {
    const keys = program.map((entry) => entry.key)
    const next = moveInList(keys, index, delta)
    if (next === keys) return
    void guard(
      () => saveProgramOrder(date, next, sundayTalks),
      'Reihenfolge konnte nicht gespeichert werden.',
    )
  }

  const assignPrayer = (slot: PrayerSlot, member: Member | null) =>
    void guard(() => setPrayer(date, slot, member), 'Gebet konnte nicht gespeichert werden.')

  /* ---------------- Drucken ------------------------------------------ */

  const [printPending, setPrintPending] = useState(false)
  const resumeEditing = useRef(false)

  useEffect(() => {
    if (!printPending || editing) return
    setPrintPending(false)
    // Erst nach dem Neuzeichnen drucken, sonst stünden die Eingabefelder
    // statt des Programms auf dem Blatt.
    const frame = requestAnimationFrame(() => {
      const restore = () => {
        window.removeEventListener('afterprint', restore)
        if (!resumeEditing.current) return
        resumeEditing.current = false
        setEditing(true)
      }
      window.addEventListener('afterprint', restore)
      window.print()
    })
    return () => cancelAnimationFrame(frame)
  }, [printPending, editing, setEditing])

  const print = () => {
    if (!editing) {
      window.print()
      return
    }
    // Gedruckt wird das Programm, nicht das Formular: kurz in die Ansicht
    // wechseln und danach dorthin zurück, wo man war.
    void draft.flush()
    resumeEditing.current = true
    setPrintPending(true)
    setEditing(false)
  }

  /* ---------------- Ablauf ------------------------------------------- */

  /** Der Name hinter «Es präsidiert» und «Es leitet» – Konto oder Person ohne Konto. */
  const leaderName = (id: string | null | undefined, name: string | null | undefined) => {
    if (id) return users.find((user) => user.id === id)?.displayName ?? name?.trim() ?? '–'
    return name?.trim() || '–'
  }

  const musicalNumberOf = (key: string) =>
    current.musicalNumbers.find((number) => key === `music:${number.id}`)

  const talkOf = (talkId: string | undefined) =>
    talkId ? sundayTalks.find((talk) => talk.id === talkId) : undefined

  const before: StepDef[] = [
    {
      key: 'vorsitz',
      title: 'Begrüssung der Besucher und Vorsitz',
      content: editing ? (
        <div className="no-print space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Art der Versammlung" htmlFor="lead-kind">
              <select
                id="lead-kind"
                className="input"
                value={current.kind}
                onChange={(event) => change({ kind: event.target.value as SacramentKind })}
              >
                {(Object.keys(SACRAMENT_KIND_LABELS) as SacramentKind[]).map((value) => (
                  <option key={value} value={value}>
                    {SACRAMENT_KIND_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

            <LeaderField
              label="Es präsidiert"
              id="lead-presiding"
              value={{ userId: current.presidingId, name: current.presidingName }}
              onChange={(next) => change({ presidingId: next.userId, presidingName: next.name })}
            />

            <LeaderField
              label="Es leitet"
              id="lead-conducting"
              value={{ userId: current.conductingId, name: current.conductingName }}
              onChange={(next) => change({ conductingId: next.userId, conductingName: next.name })}
            />
          </div>

          <Field label="Besuchende Führungsverantwortliche" htmlFor="lead-visitors">
            <input
              id="lead-visitors"
              className="input"
              value={current.visitors}
              onChange={(event) => change({ visitors: event.target.value })}
              placeholder="z. B. «Bruder Keller, Hoher Rat»"
            />
          </Field>
        </div>
      ) : (
        <>
          <Line
            label="Es präsidiert"
            value={leaderName(effective.presidingId, effective.presidingName)}
          />
          <Line
            label="Es leitet"
            value={leaderName(effective.conductingId, effective.conductingName)}
          />
          {current.visitors.trim() ? (
            <p className="text-sm">{current.visitors}</p>
          ) : (
            <Muted>Keine besuchenden Führungsverantwortlichen angekündigt.</Muted>
          )}
        </>
      ),
    },
    {
      key: 'bekanntmachungen',
      title: 'Bekanntmachungen',
      to: '/abendmahl/bekanntmachungen',
      content: editing ? (
        <AnnouncementEditor
          entries={current.announcements}
          onChange={(next) => change({ announcements: next })}
        />
      ) : current.announcements.length > 0 ? (
        <ol className="space-y-1.5 text-sm">
          {current.announcements.map((entry) => (
            <li key={entry.id}>
              <span className="font-medium">{entry.text || '—'}</span>
              {entry.details?.trim() && (
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {entry.details}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <Muted>Keine Bekanntmachungen.</Muted>
      ),
    },
    {
      key: 'anfang',
      title: 'Anfangslied und Anfangsgebet',
      to: '/abendmahl/musik',
      content: editing ? (
        <div className="no-print space-y-3">
          <HymnField
            label={HYMN_SLOT_LABELS.opening}
            value={current.hymns.opening}
            onChange={(next) => setHymn('opening', next)}
          />
          <MemberSearchSelect
            label={PRAYER_SLOT_LABELS.opening}
            value={prayerBySlot.get('opening')?.memberId ?? null}
            onChange={(member) => assignPrayer('opening', member)}
            suggestions={prayerCandidates}
            meta={describePrayer}
            compact
          />
        </div>
      ) : (
        <>
          <Line
            label={HYMN_SLOT_LABELS.opening}
            value={formatHymn(current.hymns.opening)}
            to="/abendmahl/musik"
          />
          <Line
            label={PRAYER_SLOT_LABELS.opening}
            value={prayerBySlot.get('opening')?.memberName ?? '–'}
            to="/abendmahl/gebet"
          />
        </>
      ),
    },
    {
      key: 'angelegenheiten',
      title: 'Angelegenheiten der Gemeinde',
      to: '/abendmahl/angelegenheiten',
      content: editing ? (
        <BusinessEditor
          entries={current.business}
          onChange={(next) => change({ business: next })}
        />
      ) : (
        <BusinessList entries={current.business} />
      ),
    },
    {
      key: 'sakrament',
      title: 'Abendmahlslied und Spendung des Abendmahls',
      to: '/abendmahl/musik',
      content: editing ? (
        <div className="no-print">
          <HymnField
            label={HYMN_SLOT_LABELS.sacrament}
            value={current.hymns.sacrament}
            onChange={(next) => setHymn('sacrament', next)}
            hint="Das Abendmahlslied handelt vom Erlöser und seinem Opfer."
          />
        </div>
      ) : (
        <>
          <Line
            label={HYMN_SLOT_LABELS.sacrament}
            value={formatHymn(current.hymns.sacrament)}
            to="/abendmahl/musik"
          />
          <Muted>
            Das Abendmahl steht im Mittelpunkt. Andere Teile der Versammlung dürfen nicht davon
            ablenken.
          </Muted>
        </>
      ),
    },
  ]

  const middle: StepDef[] = program.map((entry, index) => {
    const talk = talkOf(entry.talkId)
    const number = musicalNumberOf(entry.key)
    const performers = [
      number?.memberIds
        .map((id) => {
          const member = membersById.get(id)
          return member ? `${member.firstName} ${member.lastName}` : ''
        })
        .filter(Boolean)
        .join(', '),
      number?.performers,
    ]
      .filter(Boolean)
      .join(' · ')

    return {
      key: entry.key,
      title: entry.label,
      to:
        entry.kind === 'hymn' || entry.kind === 'music'
          ? '/abendmahl/musik'
          : '/abendmahl/ansprachen',
      content: (
        <>
          {!editing && <ProgramView entry={entry} performers={performers} />}

          {editing && (
            <div className="no-print space-y-2">
              {talk ? (
                <>
                  <MemberSearchSelect
                    value={talk.memberId}
                    onChange={(member) => changeSpeaker(talk.id, member)}
                    suggestions={talkCandidates}
                    meta={describeTalk}
                    compact
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {(['talk', 'testimony'] as TalkKind[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={(talk.kind ?? 'talk') === value}
                        className={
                          (talk.kind ?? 'talk') === value
                            ? 'btn-primary btn-sm'
                            : 'btn-secondary btn-sm'
                        }
                        onClick={() =>
                          void guard(
                            () => updateTalk(talk.id, { kind: value }),
                            'Art konnte nicht geändert werden.',
                          )
                        }
                      >
                        {TALK_KIND_LABELS[value]}
                      </button>
                    ))}
                    <TopicInput
                      topic={talk.topic ?? ''}
                      onSave={(next) =>
                        void guard(
                          () => updateTalk(talk.id, { topic: next }),
                          'Thema konnte nicht gespeichert werden.',
                        )
                      }
                    />
                  </div>
                </>
              ) : entry.kind === 'hymn' ? (
                <HymnField
                  label={HYMN_SLOT_LABELS.intermediate}
                  value={current.hymns.intermediate}
                  onChange={(next) => setHymn('intermediate', next)}
                  optional
                  hint="Freiwillig – wird zwischen den Ansprachen gesungen."
                />
              ) : entry.kind === 'music' && number ? (
                <MusicalNumberEditor
                  entry={number}
                  onChange={(next) =>
                    change({ musicalNumbers: replaceInList(current.musicalNumbers, next) })
                  }
                  onRemove={() =>
                    change({
                      musicalNumbers: current.musicalNumbers.filter((n) => n.id !== number.id),
                    })
                  }
                />
              ) : (
                <>
                  <MemberSearchSelect
                    value={null}
                    onChange={(member) => assignTalk(entry.slot ?? 1, member)}
                    suggestions={talkCandidates}
                    meta={describeTalk}
                    placeholder="Noch offen – Name eingeben oder wählen"
                    compact
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                    onClick={() =>
                      void guard(
                        () =>
                          removeTalkSlot(
                            date,
                            entry.slot ?? 1,
                            sundayTalks,
                            planned,
                            settings.talksPerSunday,
                          ),
                        'Programmplatz konnte nicht entfernt werden.',
                      )
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Programmplatz streichen
                  </button>
                </>
              )}

              <MoveButtons
                label={entry.label}
                first={index === 0}
                last={index === program.length - 1}
                onMove={(delta) => move(index, delta)}
              />
            </div>
          )}
        </>
      ),
    }
  })

  const after: StepDef[] = [
    {
      key: 'schluss',
      title: 'Schlusslied und Schlussgebet',
      to: '/abendmahl/musik',
      content: editing ? (
        <div className="no-print space-y-3">
          <HymnField
            label={HYMN_SLOT_LABELS.closing}
            value={current.hymns.closing}
            onChange={(next) => setHymn('closing', next)}
          />
          <MemberSearchSelect
            label={PRAYER_SLOT_LABELS.closing}
            value={prayerBySlot.get('closing')?.memberId ?? null}
            onChange={(member) => assignPrayer('closing', member)}
            suggestions={prayerCandidates}
            meta={describePrayer}
            compact
          />
        </div>
      ) : (
        <>
          <Line
            label={HYMN_SLOT_LABELS.closing}
            value={formatHymn(current.hymns.closing)}
            to="/abendmahl/musik"
          />
          <Line
            label={PRAYER_SLOT_LABELS.closing}
            value={prayerBySlot.get('closing')?.memberName ?? '–'}
            to="/abendmahl/gebet"
          />
        </>
      ),
    },
  ]

  const steps = [...before, ...middle, ...after]
  // Nach dem letzten Programmpunkt stehen die Knöpfe zum Ergänzen.
  const toolsAfter = before.length + middle.length

  return (
    <>
      <SectionHeader
        title="Ablauf"
        description={
          editing
            ? 'Alles hier änderbar – Ansprachen, Lieder, Gebete und Bekanntmachungen erscheinen genauso in ihren Bereichen. Gespeichert wird laufend.'
            : 'Alle Angaben stammen aus den übrigen Bereichen und aktualisieren sich automatisch.'
        }
        actions={
          <>
            <button
              type="button"
              className={editing ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setEditing(!editing)}
              aria-pressed={editing}
            >
              <Pencil className="size-4" aria-hidden />
              {editing ? 'Fertig' : 'Bearbeiten'}
            </button>
            <button type="button" className="btn-secondary" onClick={print}>
              <Printer className="size-4" aria-hidden />
              <span className="hidden sm:inline">Drucken</span>
            </button>
          </>
        }
      />

      {draft.conflict && <ConflictNotice onDiscard={draft.reset} />}

      {gaps.length > 0 && (
        <section className="no-print mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <CircleAlert className="size-4" aria-hidden />
            Noch offen für diesen Sonntag
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {gaps.map((gap) => (
              <li key={gap.area}>
                <Link to={gap.to} className="btn-secondary btn-sm">
                  {gap.area}: {gap.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <article className="card p-5">
        <header className="mb-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold">{SACRAMENT_KIND_LABELS[current.kind]}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDateLong(date)} · {settings.sacramentTime} Uhr · {settings.wardName}
          </p>
        </header>

        {/* Die Nummerierung ergibt sich aus der Liste: Ein zusätzlicher
            Programmpunkt verschiebt alles Folgende automatisch. */}
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <Fragment key={step.key}>
              <Step number={index + 1} title={step.title} to={step.to}>
                {step.content}
              </Step>
              {editing && index + 1 === toolsAfter && (
                <li className="no-print flex flex-wrap gap-2 pl-9">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      void guard(
                        () => addTalkSlot(date, sundayTalks, planned),
                        'Programmplatz konnte nicht angelegt werden.',
                      )
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Ansprache
                  </button>
                  {!current.hymns.intermediate && (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setHymn('intermediate', { number: null, code: '', title: '' })}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Zwischenlied
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      change({ musicalNumbers: [...current.musicalNumbers, newMusicalNumber()] })
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Musikeinlage
                  </button>
                </li>
              )}
            </Fragment>
          ))}
        </ol>

        <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Notizen</h3>
          {editing ? (
            <textarea
              className="input no-print mt-1 min-h-20 resize-y"
              value={current.notes}
              onChange={(event) => change({ notes: event.target.value })}
              placeholder="Hinweise für die Person am Pult …"
              aria-label="Notizen zur Versammlung"
            />
          ) : current.notes.trim() ? (
            <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300">
              {current.notes}
            </p>
          ) : (
            <Muted>Keine Notizen.</Muted>
          )}
        </section>
      </article>

      {(draft.dirty || draft.saving) && (
        <p className="no-print mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          {draft.saving ? 'Wird gespeichert …' : 'Änderungen werden automatisch gespeichert.'}
        </p>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bausteine des Ablaufs                                               */
/* ------------------------------------------------------------------ */

function Step({
  number,
  title,
  to,
  children,
}: {
  number: number
  title: string
  to?: string
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {to && (
            <Link
              to={to}
              className="text-brand-600 dark:text-brand-300 no-print text-xs hover:underline"
            >
              Bereich öffnen
            </Link>
          )}
        </div>
        <div className="mt-1 space-y-1">{children}</div>
      </div>
    </li>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Line({ label, value, to }: { label: string; value: string; to?: string }) {
  const missing = value === '–'
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}:</span>
      <span className={cn('font-medium', missing && 'text-amber-600 dark:text-amber-400')}>
        {missing ? 'noch offen' : value}
      </span>
      {missing && to && (
        <Link
          to={to}
          className="text-brand-600 dark:text-brand-300 no-print text-xs hover:underline"
        >
          festlegen
        </Link>
      )}
    </p>
  )
}

function ProgramView({ entry, performers }: { entry: ProgramEntry; performers: string }) {
  return (
    <>
      {entry.title ? (
        <p className="text-sm font-medium">{entry.title}</p>
      ) : (
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">noch offen</p>
      )}
      {entry.detail && <p className="text-xs text-slate-500 dark:text-slate-400">{entry.detail}</p>}
      {performers && <p className="text-xs text-slate-500 dark:text-slate-400">{performers}</p>}
    </>
  )
}

function MoveButtons({
  label,
  first,
  last,
  onMove,
}: {
  label: string
  first: boolean
  last: boolean
  onMove: (delta: number) => void
}) {
  if (first && last) return null
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => onMove(-1)}
        disabled={first}
        aria-label={`${label} nach oben`}
      >
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => onMove(1)}
        disabled={last}
        aria-label={`${label} nach unten`}
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function BusinessList({ entries }: { entries: BusinessEntry[] }) {
  if (entries.length === 0) return <Muted>Keine Angelegenheiten.</Muted>
  return (
    <ul className="space-y-1 text-sm">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {BUSINESS_TYPE_LABELS[entry.type]}
          </span>{' '}
          <span className="font-medium">{entry.text || '—'}</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Kleine Editoren                                                     */
/* ------------------------------------------------------------------ */

/**
 * Thema einer Ansprache.
 *
 * Geschrieben wird beim Verlassen des Feldes statt bei jedem Zeichen: Die
 * Ansprache ist ein eigenes Dokument, jeder Tastendruck wäre ein Schreibvorgang.
 */
function TopicInput({ topic, onSave }: { topic: string; onSave: (next: string) => void }) {
  const [text, setText] = useState(topic)

  useEffect(() => setText(topic), [topic])

  return (
    <input
      className="input min-w-40 flex-1"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (text.trim() !== topic) onSave(text.trim())
      }}
      placeholder="Thema (optional)"
      aria-label="Thema der Ansprache"
    />
  )
}

function AnnouncementEditor({
  entries,
  onChange,
}: {
  entries: AnnouncementEntry[]
  onChange: (next: AnnouncementEntry[]) => void
}) {
  return (
    <div className="no-print space-y-2">
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              className="input"
              value={entry.text}
              onChange={(event) =>
                onChange(replaceInList(entries, { ...entry, text: event.target.value }))
              }
              placeholder="Worum geht es? z. B. «Gemeindeausflug am 30. August»"
              aria-label={`Bekanntmachung ${index + 1}`}
            />
            <input
              className="input text-sm"
              value={entry.details ?? ''}
              onChange={(event) =>
                onChange(replaceInList(entries, { ...entry, details: event.target.value }))
              }
              placeholder="Einzelheiten: Zeit, Ort, wer angesprochen ist …"
              aria-label={`Einzelheiten zu Bekanntmachung ${index + 1}`}
            />
          </div>
          <ListButtons
            index={index}
            length={entries.length}
            onMove={(delta) => onChange(moveInList(entries, index, delta))}
            onRemove={() => onChange(entries.filter((e) => e.id !== entry.id))}
          />
        </div>
      ))}

      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => onChange([...entries, newAnnouncement()])}
      >
        <Plus className="size-3.5" aria-hidden />
        Bekanntmachung
      </button>
    </div>
  )
}

function BusinessEditor({
  entries,
  onChange,
}: {
  entries: BusinessEntry[]
  onChange: (next: BusinessEntry[]) => void
}) {
  return (
    <div className="no-print space-y-2">
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <select
                className="input w-auto py-1.5 text-sm"
                value={entry.type}
                onChange={(event) =>
                  onChange(
                    replaceInList(entries, { ...entry, type: event.target.value as BusinessType }),
                  )
                }
                aria-label={`Art des Eintrags ${index + 1}`}
              >
                {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((type) => (
                  <option key={type} value={type}>
                    {BUSINESS_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <input
                className="input min-w-40 flex-1"
                value={entry.text}
                onChange={(event) =>
                  onChange(replaceInList(entries, { ...entry, text: event.target.value }))
                }
                placeholder="Name und Aufgabe, z. B. «Peter Meier – Lehrer Sonntagsschule»"
                aria-label={`Text des Eintrags ${index + 1}`}
              />
            </div>
            <MemberPicker
              value={entry.memberIds}
              onChange={(next) => onChange(replaceInList(entries, { ...entry, memberIds: next }))}
              label="Betroffene Mitglieder (optional)"
              placeholder="Name eingeben …"
            />
          </div>
          <ListButtons
            index={index}
            length={entries.length}
            onMove={(delta) => onChange(moveInList(entries, index, delta))}
            onRemove={() => onChange(entries.filter((e) => e.id !== entry.id))}
          />
        </div>
      ))}

      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => onChange([...entries, newBusinessEntry()])}
      >
        <Plus className="size-3.5" aria-hidden />
        Eintrag
      </button>
    </div>
  )
}

function MusicalNumberEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: MusicalNumber
  onChange: (next: MusicalNumber) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <input
          className="input"
          value={entry.title}
          onChange={(event) => onChange({ ...entry, title: event.target.value })}
          placeholder="Titel des Stücks"
          aria-label="Titel der Musikeinlage"
        />
        <button
          type="button"
          className="btn-ghost shrink-0 p-2 text-rose-600 dark:text-rose-400"
          onClick={onRemove}
          aria-label="Musikeinlage entfernen"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <MemberPicker
        value={entry.memberIds}
        onChange={(next) => onChange({ ...entry, memberIds: next })}
        label="Wer trägt vor?"
        placeholder="Mitglied suchen …"
      />
      <input
        className="input text-sm"
        value={entry.performers ?? ''}
        onChange={(event) => onChange({ ...entry, performers: event.target.value })}
        placeholder="Ergänzung: Gäste, Chor, Begleitung am Klavier …"
        aria-label="Weitere Mitwirkende der Musikeinlage"
      />
    </div>
  )
}

function ListButtons({
  index,
  length,
  onMove,
  onRemove,
}: {
  index: number
  length: number
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <button
        type="button"
        className="btn-ghost p-1.5"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        aria-label="Nach oben"
      >
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className="btn-ghost p-1.5"
        onClick={() => onMove(1)}
        disabled={index === length - 1}
        aria-label="Nach unten"
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className="btn-ghost p-1.5 text-rose-600 dark:text-rose-400"
        onClick={onRemove}
        aria-label="Entfernen"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  )
}
