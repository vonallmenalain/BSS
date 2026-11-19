import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCog,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Mic,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserMinus,
  UserPlus,
  UserX,
  X,
} from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useSacramentMeetings, useTalks } from '@/hooks/useFirestore'
import { useUrlState } from '@/hooks/useUrlState'
import { MemberLink } from '@/components/ui/MemberLink'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, SkeletonList } from '@/components/ui/Feedback'
import { OtherResults } from '@/components/ui/OtherResults'
import { SegmentedControl } from '@/components/ui/Pickers'
import { MenuChips, MenuChoice, MenuDivider, MenuToggle, ViewMenu } from '@/components/ui/ViewMenu'
import { SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import { MemberSearchSelect } from '@/components/sacrament/MemberSearchSelect'
import {
  SundayProgramBadge,
  SundayProgramDialog,
  sundayProgramNote,
} from '@/components/sacrament/SundayProgram'
import {
  ResponsibleButton,
  SundayResponsibleDialog,
} from '@/components/sacrament/SundayResponsible'
import { TalkStatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import {
  formatDate,
  formatDateLong,
  formatDayMonthYear,
  toDate,
  toDateInput,
  upcomingWeekdays,
} from '@/lib/dates'
import { cn, formatPhone, matchesSearch, telHref } from '@/lib/utils'
import { holdAfterDecline, talkAvailability } from '@/lib/availability'
import {
  activeTalkFilterCount,
  declineTalk,
  DEFAULT_TALK_FILTER,
  filterTalkCandidates,
  NEVER_SPOKE,
  rankTalkCandidates,
  setTalkAvailability,
  setTalkSpeaker,
  setTalkStatus,
  speakerFields,
  talkYearOptions,
  updateTalk,
  type TalkCandidate,
  type TalkCandidateFilter,
  type TalkGenderFilter,
  type TalkSpeaker,
} from '@/services/talks'
import {
  addTalkSlot,
  countOpenPositions,
  insertTalk,
  moveTalkPosition,
  nextOpenPosition,
  nextTalkStatus,
  plannedTalksFor,
  removeTalkEntry,
  removeTalkSlot,
  sacramentDocId,
  saveSacramentMeeting,
  sundayProgram,
  talkPositions,
  wasHeld,
  talksForDate,
  talksWithoutConfirmation,
} from '@/services/sacrament'
import {
  isTalkPlaceholder,
  TALK_KIND_LABELS,
  TALK_STATUS_LABELS,
  talkSpeakerLabel,
  type Member,
  type Talk,
  type TalkKind,
  type TalkStatus,
} from '@/lib/types'

/**
 * Der Reiter steht in der Adresse, nicht bloss im Zustand der Komponente.
 *
 * Wer aus den Vorschlägen heraus ein Mitglied öffnet, kommt mit «Zurück»
 * sonst zwar auf diese Seite zurück – aber auf das Programm statt auf die
 * Vorschläge, weil der Zustand beim Verlassen weggeworfen wurde. In der
 * Adresse überlebt er den Weg (siehe `hooks/useUrlState`).
 */
type Tab = 'programm' | 'vorschlaege' | 'verlauf'

const TABS: readonly Tab[] = ['programm', 'vorschlaege', 'verlauf']

export function Talks() {
  const { settings, members } = useData()
  const { date: selectedDate } = useSacrament()
  const { canEditSacramentArea } = useAuth()
  const { data: talks, loading } = useTalks(400)
  const { data: sacramentMeetings } = useSacramentMeetings(40)
  const toast = useToast()
  const [tab, setTab] = useUrlState<Tab>('ansicht', 'programm', TABS)
  /**
   * Wofür der Zuteilungs-Dialog offen ist. `slot: null` heisst «der nächste
   * offene Platz an dem Datum, das im Dialog steht» – er wird dort bestimmt,
   * damit er beim Wechsel des Datums mitgeht.
   */
  const [assignFor, setAssignFor] = useState<{
    date: Date
    slot: number | null
    kind: TalkKind
  } | null>(null)
  /**
   * Welche Ansprache gerade bearbeitet wird – die Nummer, nicht der Eintrag.
   *
   * Ein Schnappschuss veraltete beim ersten Handgriff im Dialog: Wer den
   * Namen entfernte, sah ihn trotz Meldung weiterhin stehen, bis das Fenster
   * geschlossen und neu geöffnet wurde. Über die Nummer kommt der Eintrag
   * laufend aus Firestore.
   */
  const [editTalkId, setEditTalkId] = useState<string | null>(null)
  /** Aus der Vorschlagsliste vorgewähltes Mitglied für den Zuteilungs-Dialog */
  const [presetMember, setPresetMember] = useState<Member | null>(null)
  /** Sonntag, dessen Programm gerade festgelegt wird – derselbe Dialog wie unter «Leitung» */
  const [programFor, setProgramFor] = useState<Date | null>(null)
  const [responsibleFor, setResponsibleFor] = useState<Date | null>(null)

  /*
   * Eine Assistenz kann die Ansprachen auch bloss zum Nachschauen haben
   * (siehe `AuthContext`). Die Seite bleibt dann vollständig – Programm,
   * Vorschläge, Verlauf –, nur die Handgriffe fehlen: zuteilen, umstellen,
   * jemanden ausnehmen. Die Zugriffsregeln sagen ohnehin nein; hier geht es
   * darum, gar nicht erst dagegen zu laufen.
   */
  const readOnly = !canEditSacramentArea('talks')

  const meetingByKey = useMemo(
    () => new Map(sacramentMeetings.map((meeting) => [meeting.id, meeting])),
    [sacramentMeetings],
  )

  /* Verschwindet der Eintrag – etwa weil er entfernt wurde –, schliesst sich
     der Dialog von selbst. */
  const editTalk = useMemo(
    () => (editTalkId ? (talks.find((talk) => talk.id === editTalkId) ?? null) : null),
    [talks, editTalkId],
  )

  /*
   * Acht Versammlungen ab dem oben gewählten Sonntag.
   *
   * Der gewählte Sonntag steht damit immer zuoberst – wer ihn im Kopf der
   * Seite wechselt, sieht sofort dessen Programm, kann aber wie bisher
   * mehrere Wochen im Voraus planen.
   */
  const schedule = useMemo(() => {
    const sundays = upcomingWeekdays(settings.sacramentWeekday, 8, selectedDate)
    return sundays.map((date) => {
      const assigned = talksForDate(talks, date)
      const meeting = meetingByKey.get(sacramentDocId(date)) ?? null
      const program = sundayProgram(date, meeting)
      /*
       * Standard aus den Einstellungen, für diesen Sonntag übersteuerbar –
       * und null, wenn an diesem Sonntag gar keine Ansprachen vorgesehen
       * sind. Bereits vergebene bleiben trotzdem stehen: Eine Zusage
       * verschwindet nicht, weil der Sonntag umgewidmet wurde.
       */
      const planned = plannedTalksFor(date, meeting, settings.talksPerSunday)

      /*
       * Dieselben Plätze wie im Ablauf unter «Leitung» – aus derselben
       * Funktion. Früher stand hier pro Nummer nur die erste Ansprache;
       * teilten sich zwei eine Nummer, fehlte die zweite, obwohl «Leitung»
       * sie zeigte und der Kopf sie mitzählte.
       */
      const slots = talkPositions(assigned, planned)

      return {
        date,
        assigned,
        meeting,
        program,
        planned,
        slots,
        /*
         * Ein besetzter Platz zählt als vorgesehen – die Anzahl des Sonntags
         * ist die Länge der Liste und nicht bloss die Einstellung.
         */
        places: slots.length,
        /*
         * Brächte «Auf Standard zurücksetzen» hier etwas? Nur, wenn danach
         * eine andere Anzahl Plätze dastünde: Wer über den Standard hinaus
         * eingetragen ist, bleibt ja stehen.
         */
        resettable:
          meeting?.talkSlots != null &&
          talkPositions(assigned, settings.talksPerSunday).length !== slots.length,
        /*
         * Ein Platzhalter zählt als offen: Er belegt zwar seine Position,
         * aber es steht noch niemand dahinter – etwa nach einer Absage. An
         * einem Sonntag ohne Ansprachen fehlt dagegen nichts.
         */
        openCount: program.plansTalks ? countOpenPositions(slots) : 0,
        // Besetzt heisst noch nicht zugesagt – auch das ist offene Arbeit.
        pendingCount: talksWithoutConfirmation(assigned),
      }
    })
  }, [talks, meetingByKey, selectedDate, settings.sacramentWeekday, settings.talksPerSunday])

  const openSlots = schedule.reduce((sum, sunday) => sum + sunday.openCount, 0)

  /**
   * Was an einem beliebigen Datum schon eingetragen und vorgesehen ist.
   *
   * Für den Zuteilungs-Dialog: Dort lässt sich das Datum wechseln, und die
   * Position muss zum neuen Sonntag passen – nicht zu dem, von dem aus der
   * Dialog geöffnet wurde. Genau so entstanden früher doppelt belegte
   * Nummern.
   */
  const sundayAt = (date: Date) => {
    const meeting = meetingByKey.get(sacramentDocId(date)) ?? null
    return {
      talks: talksForDate(talks, date),
      planned: plannedTalksFor(date, meeting, settings.talksPerSunday),
    }
  }

  /** Läuft einer der Handgriffe am Sonntag schief, sagt es eine Meldung. */
  const guard = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
    } catch (error) {
      console.error(error)
      toast.error(message)
    }
  }

  /**
   * Der Status eines Eintrags einen Schritt weiter – mit einem Tippen.
   *
   * Der Ablauf ist immer derselbe: vorgesehen, angefragt, zugesagt. Dafür
   * jedes Mal den Dialog zu öffnen, war ein Umweg. Weil ein Tippen schnell
   * daneben geht, steht in der Meldung «Rückgängig».
   */
  const cycleStatus = (talk: Talk) => {
    const previous = talk.status
    const next = nextTalkStatus(previous)
    void guard(async () => {
      await setTalkStatus(talk.id, next)
      toast.undo(
        next === 'confirmed'
          ? `${talkSpeakerLabel(talk)}: zugesagt – zählt damit als gehalten.`
          : `${talkSpeakerLabel(talk)}: ${TALK_STATUS_LABELS[next].toLowerCase()}.`,
        async () => {
          await setTalkStatus(talk.id, previous)
        },
      )
    }, 'Status konnte nicht geändert werden.')
  }

  /** Die Anzahl eines Sonntags wieder dem Standard überlassen. */
  const resetSlots = (date: Date) =>
    guard(
      () => saveSacramentMeeting(date, { talkSlots: null }),
      'Anzahl konnte nicht gespeichert werden.',
    )

  /**
   * Ein Platz eine Position weiter vor oder zurück.
   *
   * Geschrieben wird die Position selbst – dieselbe Zahl, nach der auch der
   * Ablauf unter «Leitung» ordnet. Damit stimmen beide Ansichten überein,
   * gleich von welcher Seite aus verschoben wurde.
   */
  const moveTalk = (sunday: (typeof schedule)[number], position: number, delta: number) =>
    guard(
      () => moveTalkPosition(sunday.assigned, sunday.planned, position, delta),
      'Reihenfolge konnte nicht gespeichert werden.',
    )

  /*
   * Ein einziger Satz Filter für die Vorschläge – er gehört der Seite und
   * nicht der Liste. Zwei davon bestimmen schon, wer überhaupt bewertet wird
   * (Mindestalter und «nur Aktive»), die übrigen erst, was davon zu sehen ist.
   */
  const [filter, setFilter] = useState<TalkCandidateFilter>(DEFAULT_TALK_FILTER)

  const candidates = useMemo(
    () =>
      rankTalkCandidates(members, talks, {
        gapMonths: settings.talkGapMonths,
        onlyActive: filter.onlyActive,
        minAge: filter.minAge ? settings.talkMinAge : 0,
      }),
    [members, talks, settings.talkGapMonths, settings.talkMinAge, filter.onlyActive, filter.minAge],
  )

  /*
   * Dieselbe Bewertung, aber über die ganze Gemeinde.
   *
   * Zwei der Filter entscheiden schon, wer überhaupt bewertet wird – «nur
   * Aktive» und das Mindestalter. Wer einen Namen sucht, den sie wegnehmen,
   * fände ihn deshalb selbst dann nicht, wenn die Suche über die gefilterte
   * Liste ginge. Für die Treffer neben der Auswahl braucht es darum den
   * ungefilterten Stand (siehe `CandidateList`).
   */
  const allCandidates = useMemo(
    () =>
      rankTalkCandidates(members, talks, {
        gapMonths: settings.talkGapMonths,
        onlyActive: false,
        minAge: 0,
        // Wer auf Mission ist, steht nie in den Vorschlägen – gesucht werden
        // soll er trotzdem können.
        includeMission: true,
      }),
    [members, talks, settings.talkGapMonths],
  )

  /* Gehalten heisst: zugesagt und vorbei. Einen eigenen Status dafür gibt es
     nicht mehr – niemand hakt nach der Versammlung noch etwas ab. */
  const history = useMemo(
    () =>
      talks
        .filter((talk) => wasHeld(talk))
        .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0)),
    [talks],
  )

  return (
    <>
      <SectionHeader
        title="Ansprachen und Zeugnisse"
        actions={
          readOnly ? undefined : (
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                setAssignFor({ date: schedule[0]?.date ?? new Date(), slot: 1, kind: 'talk' })
              }
            >
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">Zuteilen</span>
            </button>
          )
        }
      />

      <SegmentedControl<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'programm', label: 'Programm', count: openSlots },
          { value: 'vorschlaege', label: 'Vorschläge' },
          { value: 'verlauf', label: 'Verlauf', count: history.length },
        ]}
      />

      {loading ? (
        <SkeletonList rows={4} />
      ) : tab === 'programm' ? (
        <div className="space-y-3">
          {schedule.map((sunday) => {
            return (
              <section key={sunday.date.toISOString()} className="card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{formatDateLong(sunday.date)}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <SundayProgramBadge program={sunday.program} />
                    {sunday.program.plansTalks && sunday.places !== settings.talksPerSunday && (
                      <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {sunday.places} statt {settings.talksPerSunday}
                      </span>
                    )}
                    {/* Beides ist offene Arbeit und steht deshalb nebeneinander:
                        Plätze, für die noch jemand gesucht wird, und
                        Eingetragene, deren Zusage noch aussteht. Vollständig
                        ist erst, was zugesagt ist – wie in der Übersicht. */}
                    {sunday.program.plansTalks && sunday.openCount > 0 && (
                      <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        {sunday.openCount} offen
                      </span>
                    )}
                    {sunday.program.plansTalks && sunday.pendingCount > 0 && (
                      <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        {sunday.pendingCount} ohne Zusage
                      </span>
                    )}
                    {sunday.program.plansTalks &&
                      sunday.openCount === 0 &&
                      sunday.pendingCount === 0 && (
                        <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          <Check className="size-3" aria-hidden />
                          Vollständig
                        </span>
                      )}
                    {!readOnly && (
                      <>
                        <ResponsibleButton
                          meeting={sunday.meeting}
                          onClick={() => setResponsibleFor(sunday.date)}
                          size="sm"
                        />
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => setProgramFor(sunday.date)}
                          title="Programm des Sonntags festlegen"
                        >
                          <CalendarCog className="size-3.5" aria-hidden />
                          Programm
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Steht an diesem Sonntag etwas anderes an, ist das die
                    Antwort auf «warum sind hier keine Plätze offen?». */}
                {!sunday.program.plansTalks && (
                  <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                    {sundayProgramNote(sunday.program)}
                    {sunday.slots.length > 0 && ' Eingetragene Ansprachen bleiben trotzdem stehen.'}
                  </p>
                )}

                <ul className="space-y-2">
                  {sunday.slots.map(({ position, talk }) => (
                    <li key={talk ? talk.id : `open-${position}`}>
                      {talk ? (
                        <TalkRow
                          talk={talk}
                          position={position}
                          onEdit={() => setEditTalkId(talk.id)}
                          onCycleStatus={() => cycleStatus(talk)}
                          first={position === 1}
                          last={position === sunday.slots.length}
                          onMove={(delta) => void moveTalk(sunday, position, delta)}
                          readOnly={readOnly}
                        />
                      ) : (
                        /* Ein offener Platz ist auch für den eine Auskunft,
                           der nichts vergeben darf – er sagt, dass hier noch
                           jemand fehlt. Nur ist er dann kein Knopf. */
                        <EmptySlot
                          position={position}
                          onAssign={
                            readOnly
                              ? undefined
                              : () =>
                                  setAssignFor({ date: sunday.date, slot: position, kind: 'talk' })
                          }
                          onRemove={
                            readOnly
                              ? undefined
                              : () =>
                                  void guard(
                                    () =>
                                      removeTalkSlot(
                                        sunday.date,
                                        position,
                                        sunday.assigned,
                                        sunday.planned,
                                        settings.talksPerSunday,
                                      ),
                                    'Platz konnte nicht gestrichen werden.',
                                  )
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>

                {/* Für einen einzelnen Sonntag lässt sich mehr vorsehen als der
                    Standard – etwa eine zusätzliche Ansprache oder ein Zeugnis.
                    An einem Sonntag ohne Ansprachen stünden die Knöpfe für
                    etwas, das gar nicht vorgesehen ist. */}
                {sunday.program.plansTalks && !readOnly && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {/* Erst eine bestehende Lücke füllen, sonst hinten
                        anhängen – das bestimmt der Dialog (`slot: null`). */}
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setAssignFor({ date: sunday.date, slot: null, kind: 'talk' })}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Ansprache
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() =>
                        setAssignFor({ date: sunday.date, slot: null, kind: 'testimony' })
                      }
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Zeugnis
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() =>
                        void guard(
                          () =>
                            addTalkSlot(
                              sunday.date,
                              sunday.assigned,
                              sunday.planned,
                              settings.talksPerSunday,
                            ),
                          'Platz konnte nicht angelegt werden.',
                        )
                      }
                    >
                      Leeren Platz hinzufügen
                    </button>
                    {sunday.resettable && (
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => void resetSlots(sunday.date)}
                      >
                        Auf Standard zurücksetzen
                      </button>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : tab === 'vorschlaege' ? (
        <CandidateList
          candidates={candidates}
          allCandidates={allCandidates}
          gapMonths={settings.talkGapMonths}
          minAge={settings.talkMinAge}
          filter={filter}
          onFilter={setFilter}
          readOnly={readOnly}
          onAssign={(member) => {
            // Der erste Sonntag mit einem offenen Platz. Welche Position, ergibt
            // sich im Dialog aus dem Datum (`slot: null`): Sind alle belegt –
            // etwa durch Platzhalter –, kommt der Eintrag hintendran; zwei
            // Einträge auf derselben Position gibt es nicht.
            const target = schedule.find((sunday) => sunday.openCount > 0)
            setPresetMember(member)
            // Ist kein Platz frei, schlägt der Dialog den nächsten Sonntag
            // vor – nicht das heutige Datum: Ein Eintrag an einem Werktag
            // erschiene in keiner Programmansicht und wäre unauffindbar.
            setAssignFor({
              date: target?.date ?? schedule[0]?.date ?? new Date(),
              slot: null,
              kind: 'talk',
            })
          }}
        />
      ) : (
        <HistoryList talks={history} />
      )}

      {/* Sämtliche Fenster dieser Seite ändern etwas – wer nur nachschaut,
          erreicht sie nicht, und deshalb stehen sie gar nicht erst da. */}
      {!readOnly && (
        <>
          <AssignDialog
            open={Boolean(assignFor)}
            onClose={() => {
              setAssignFor(null)
              setPresetMember(null)
            }}
            date={assignFor?.date ?? new Date()}
            slot={assignFor?.slot ?? null}
            kind={assignFor?.kind ?? 'talk'}
            presetMember={presetMember}
            sundayAt={sundayAt}
          />

          {editTalk && (
            <EditTalkDialog
              /* Für eine andere Ansprache baut sich der Dialog neu auf – sonst
                 blieben Art, Thema und Notiz der vorigen im Formular stehen. */
              key={editTalk.id}
              talk={editTalk}
              sundayAt={sundayAt}
              position={
                schedule
                  .flatMap((sunday) => sunday.slots)
                  .find((row) => row.talk?.id === editTalk.id)?.position ?? editTalk.slot
              }
              suggestions={candidates.map((candidate) => candidate.member)}
              onClose={() => setEditTalkId(null)}
            />
          )}

          <SundayProgramDialog
            open={Boolean(programFor)}
            date={programFor ?? new Date()}
            meeting={programFor ? (meetingByKey.get(sacramentDocId(programFor)) ?? null) : null}
            onClose={() => setProgramFor(null)}
          />

          <SundayResponsibleDialog
            open={Boolean(responsibleFor)}
            date={responsibleFor ?? new Date()}
            meeting={
              responsibleFor ? (meetingByKey.get(sacramentDocId(responsibleFor)) ?? null) : null
            }
            onClose={() => setResponsibleFor(null)}
          />
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

function TalkRow({
  talk,
  position,
  onEdit,
  onCycleStatus,
  first,
  last,
  onMove,
  readOnly = false,
}: {
  talk: Talk
  /** Die Nummer im Programm – dieselbe wie unter «Leitung» (siehe `talkPositions`) */
  position: number
  onEdit: () => void
  /** Ein Schritt weiter: Vorgesehen → Angefragt → Zugesagt (siehe `nextTalkStatus`) */
  onCycleStatus: () => void
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  /**
   * Nur nachschauen: Die Zeile sagt dasselbe, ist aber kein Knopf mehr, und
   * die Pfeile zum Umstellen fehlen. Die Telefonnummer bleibt – anrufen
   * ändert nichts am Programm.
   */
  readOnly?: boolean
}) {
  const { membersById } = useData()
  const member = membersById.get(talk.memberId)
  const kind: TalkKind = talk.kind ?? 'talk'
  /* Ein Platzhalter steht mit seiner Art da, aber ohne Namen – in Orange,
     damit beim Durchgehen auffällt, dass hier noch jemand fehlt. */
  const placeholder = isTalkPlaceholder(talk)
  const name = talkSpeakerLabel(talk)
  const declined = (talk.declines ?? []).map((entry) => entry.memberName).join(', ')

  /* Dasselbe Innere in einem Knopf oder in einem schlichten Feld – der
     Inhalt hängt nicht daran, ob man ihn anfassen darf. */
  const inner = (
    <>
      <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
        {position}
      </span>
      <Avatar name={name} id={talk.memberId || undefined} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          <span className={cn(placeholder && 'text-amber-600 dark:text-amber-400')}>{name}</span>
          {kind === 'testimony' && (
            <span className="ml-1.5 align-middle text-xs font-normal text-slate-500 dark:text-slate-400">
              · {TALK_KIND_LABELS.testimony}
            </span>
          )}
        </span>
        {talk.topic && (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {talk.topic}
          </span>
        )}
        {/* Wer für diesen Platz schon abgesagt hat – damit beim Suchen der
            nächsten Person niemand ein zweites Mal gefragt wird. */}
        {placeholder && declined && (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            Abgesagt: {declined}
          </span>
        )}
      </span>
    </>
  )

  /*
   * Der Status ist ein eigener Knopf neben der Zeile und nicht Teil davon:
   * Ein Tippen darauf führt einen Schritt weiter, ohne den Dialog zu öffnen.
   * Ein Platzhalter hat keinen nächsten Schritt – für niemanden lässt sich
   * nichts anfragen –, und wer nur nachschaut, ändert ohnehin nichts.
   */
  const next = nextTalkStatus(talk.status)
  const status =
    readOnly || placeholder ? (
      <span className="shrink-0 px-1">
        <TalkStatusBadge status={talk.status} />
      </span>
    ) : (
      <button
        type="button"
        onClick={onCycleStatus}
        className="shrink-0 rounded-full p-1 transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
        aria-label={`Status von ${name}: ${TALK_STATUS_LABELS[talk.status]} – ändern auf ${TALK_STATUS_LABELS[next]}`}
        title={`Tippen für «${TALK_STATUS_LABELS[next]}»`}
      >
        <TalkStatusBadge status={talk.status} />
      </button>
    )

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 pr-1 dark:border-slate-700">
      {readOnly ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">{inner}</div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          {inner}
        </button>
      )}

      {status}

      {member?.mobile && (
        <a
          href={telHref(member.mobile) ?? '#'}
          className="btn-ghost hidden shrink-0 p-1.5 sm:inline-flex"
          aria-label={`${name} anrufen`}
          title={formatPhone(member.mobile)}
        >
          <Phone className="size-3.5" aria-hidden />
        </a>
      )}

      {/* Dieselbe Reihenfolge wie im Ablauf unter «Leitung». */}
      {!readOnly && (
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            className="btn-ghost p-0.5"
            onClick={() => onMove(-1)}
            disabled={first}
            aria-label={`${name} nach vorne`}
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className="btn-ghost p-0.5"
            onClick={() => onMove(1)}
            disabled={last}
            aria-label={`${name} nach hinten`}
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Ein Platz, hinter dem noch niemand steht.
 *
 * Ohne `onAssign` ist es kein Knopf mehr, sondern bloss die Auskunft, dass
 * hier jemand fehlt – dieselbe Zeile, ohne die Einladung, sie anzufassen.
 *
 * Daneben lässt er sich streichen: Ein leerer Platz, der zu viel ist – etwa
 * einer, der eben mit «Leeren Platz hinzufügen» dazukam –, war bisher nur
 * über «Auf Standard zurücksetzen» wegzubekommen, und das auch nur, wenn
 * der Sonntag danach wieder dem Standard entsprach. Wer dahinter steht,
 * rückt eine Position auf – dasselbe wie «Programmplatz streichen» unter
 * «Leitung».
 */
function EmptySlot({
  position,
  onAssign,
  onRemove,
}: {
  position: number
  onAssign?: () => void
  onRemove?: () => void
}) {
  const inner = (
    <>
      <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
        {position}
      </span>
      <CalendarPlus className="size-4" aria-hidden />
      {onAssign ? 'Ansprache vergeben' : 'Noch offen'}
    </>
  )

  const shell =
    'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-500 dark:text-slate-400'

  return (
    <div className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 pr-1 dark:border-slate-700">
      {onAssign ? (
        <button
          type="button"
          onClick={onAssign}
          className={cn(shell, 'transition hover:bg-slate-50 dark:hover:bg-slate-800/50')}
        >
          {inner}
        </button>
      ) : (
        <div className={shell}>{inner}</div>
      )}

      {onRemove && (
        <button
          type="button"
          className="btn-ghost shrink-0 p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
          onClick={onRemove}
          aria-label={`Platz ${position} streichen`}
          title="Platz streichen – wer dahinter steht, rückt auf"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function CandidateList({
  candidates,
  allCandidates,
  gapMonths,
  minAge,
  filter,
  onFilter,
  onAssign,
  readOnly = false,
}: {
  candidates: TalkCandidate[]
  /** Dieselben Vorschläge ohne «nur Aktive» und ohne Mindestalter */
  allCandidates: TalkCandidate[]
  gapMonths: number
  minAge: number
  filter: TalkCandidateFilter
  onFilter: (next: TalkCandidateFilter) => void
  onAssign: (member: Member) => void
  /**
   * Nur nachschauen: Suchen, filtern und nachsehen, wer wann zuletzt
   * gesprochen hat, bleibt – das ist die Frage, die diese Liste beantwortet.
   * Anfragen und Ausnehmen fallen weg.
   */
  readOnly?: boolean
}) {
  const toast = useToast()
  const { isApproved: fullAccess } = useAuth()

  const visible = useMemo(
    () => filterTalkCandidates(candidates, filter, gapMonths),
    [candidates, filter, gapMonths],
  )

  const searching = filter.search.trim() !== ''

  /*
   * Wen die Suche findet, den die Filter aber wegnehmen.
   *
   * Die Filter stellen die Frage der Seite – wer ist erwachsen, aktiv und
   * lange nicht dran gewesen? Ein gesuchter Name ist dagegen eine andere
   * Frage: Man will wissen, wann diese Person zuletzt gesprochen hat. Sie
   * fällt aber leicht durch jeden der Haken, und bisher stand dann nur
   * «Kein Vorschlag passt zu diesen Filtern» da.
   */
  const otherHits = useMemo(() => {
    if (!searching) return []
    const shown = new Set(visible.map((candidate) => candidate.member.id))
    return allCandidates.filter(
      (candidate) =>
        !shown.has(candidate.member.id) &&
        matchesSearch(`${candidate.member.firstName} ${candidate.member.lastName}`, filter.search),
    )
  }, [searching, visible, allCandidates, filter.search])
  const years = useMemo(() => talkYearOptions(candidates), [candidates])
  const onHoldCount = useMemo(() => candidates.filter((c) => c.onHold).length, [candidates])
  const activeFilters = activeTalkFilterCount(filter)

  const set = <K extends keyof TalkCandidateFilter>(key: K, value: TalkCandidateFilter[K]) =>
    onFilter({ ...filter, [key]: value })

  /** Nicht anfragen – oder wieder aufnehmen. */
  const toggleHold = async (member: Member, onHold: boolean) => {
    try {
      // Ohne Datum: ein Vermerk auf Weiteres. Ein «bis wann» trägt ein, wer
      // im Profil weiss, wie lange es dauert.
      const outcome = await setTalkAvailability(member.id, onHold)
      toast.saved(
        onHold
          ? `${member.firstName} ${member.lastName} steht wieder in den Vorschlägen.`
          : `${member.firstName} ${member.lastName} wird nicht mehr angefragt.`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Konnte nicht gespeichert werden.')
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={Mic}
          title="Keine Kandidaten"
          description="Erfasse zuerst Mitglieder – dann erscheinen hier Vorschläge."
          /* Der Weg ins Verzeichnis nur für den, dem es offensteht: Eine
             Assistenz landete dort wieder auf dieser Seite. */
          action={
            fullAccess && (
              <Link to="/mitglieder" className="btn-primary">
                Zu den Mitgliedern
              </Link>
            )
          }
        />
      </div>
    )
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="input max-w-xs"
          placeholder="Name suchen …"
          value={filter.search}
          onChange={(event) => set('search', event.target.value)}
        />

        {/* Die Haken standen einmal alle nebeneinander über der Liste. Seit
            es mehr als drei sind, stehen sie hinter einem Knopf – die Zahl
            daran sagt, dass etwas eingestellt ist, auch wenn er zu ist. */}
        <ViewMenu
          label={activeFilters > 0 ? `Filter · ${activeFilters}` : 'Filter'}
          width="sm:w-80"
        >
          <MenuToggle
            label={`Nur seit über ${gapMonths} Monaten`}
            checked={filter.onlyOverdue}
            onChange={(next) => set('onlyOverdue', next)}
          />
          <MenuToggle
            label={`Erst ab ${minAge} Jahren`}
            checked={filter.minAge}
            onChange={(next) => set('minAge', next)}
          />
          <MenuToggle
            label="Nur Aktive"
            checked={filter.onlyActive}
            onChange={(next) => set('onlyActive', next)}
          />

          <MenuDivider />

          <MenuChoice<TalkGenderFilter>
            label="Geschlecht"
            value={filter.gender}
            onChange={(next) => set('gender', next)}
            options={[
              { value: 'all', label: 'Alle' },
              { value: 'f', label: 'Frauen' },
              { value: 'm', label: 'Männer' },
            ]}
          />

          <MenuChips<number>
            label="Zuletzt gesprochen"
            values={filter.years}
            onChange={(next) => set('years', next)}
            options={years.map((year) => ({
              value: year,
              label: year === NEVER_SPOKE ? 'Noch nie' : String(year),
            }))}
            allLabel="Egal"
            hint={`Mehrere Jahre lassen sich zusammen wählen. Eine Jahrzahl sticht «nur seit über ${gapMonths} Monaten» – wer letztes Jahr gesprochen hat, ist ja nicht überfällig.`}
          />

          <MenuDivider />

          <MenuToggle
            label={`Ausgenommene zeigen${onHoldCount > 0 ? ` (${onHoldCount})` : ''}`}
            checked={filter.showOnHold}
            onChange={(next) => set('showOnHold', next)}
            hint="Wer nicht angefragt werden soll – auf Weiteres oder bis zu einem Datum –, bleibt sonst ausgeblendet."
          />
        </ViewMenu>

        {(activeFilters > 0 || filter.search.trim() !== '') && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => onFilter(DEFAULT_TALK_FILTER)}
          >
            Zurücksetzen
          </button>
        )}
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Sparkles className="size-3.5" aria-hidden />
        Sortiert nach Dringlichkeit: wer noch nie gesprochen hat, steht zuoberst.
      </p>

      {visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Mic}
            title="Kein Vorschlag passt zu diesen Filtern"
            description={
              otherHits.length > 0
                ? 'Zu diesen Filtern passt niemand – darunter steht, wen die Suche sonst findet.'
                : onHoldCount > 0 && !filter.showOnHold
                  ? `${onHoldCount} ausgenommene Mitglieder sind ausgeblendet – der Filter blendet sie wieder ein.`
                  : 'Setze die Filter zurück oder wähle andere Jahre.'
            }
            action={
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onFilter(DEFAULT_TALK_FILTER)}
              >
                Filter zurücksetzen
              </button>
            }
          />
        </div>
      ) : (
        <CandidateRows
          entries={visible.slice(0, 60)}
          onAssign={onAssign}
          onToggleHold={toggleHold}
          readOnly={readOnly}
        />
      )}

      {visible.length > 60 && (
        <p className="mt-2 text-center text-xs text-slate-400">
          {visible.length - 60} weitere ausgeblendet – grenze die Suche ein.
        </p>
      )}

      {/* Wer zur Suche passt, aber durch die Filter fällt – inaktiv, zu
          jung, im falschen Jahr oder ausgenommen. */}
      {searching && (
        <OtherResults
          items={otherHits}
          listKey={`${filter.search.trim()}|${JSON.stringify(filter)}`}
          pageSize={30}
          hint="Diese Personen passen zur Suche, werden aber durch die Filter ausgeblendet – etwa weil sie nicht als aktiv geführt sind, unter dem Mindestalter liegen, erst kürzlich gesprochen haben, schon für einen Sonntag eingetragen sind oder auf Mission sind."
        >
          {(page) => (
            <CandidateRows
              entries={page}
              onAssign={onAssign}
              onToggleHold={toggleHold}
              readOnly={readOnly}
            />
          )}
        </OtherResults>
      )}
    </>
  )
}

/**
 * Die Zeilen der Vorschlagsliste – ohne Rahmen darum.
 *
 * Sie stehen für sich, weil sie zweimal gebraucht werden: für die Vorschläge
 * selbst und für die Treffer, die die Filter wegnehmen. Auch dort lässt sich
 * anfragen – wer jemanden gezielt sucht, hat sich meist schon entschieden.
 */
function CandidateRows({
  entries,
  onAssign,
  onToggleHold,
  readOnly = false,
}: {
  entries: TalkCandidate[]
  onAssign: (member: Member) => void
  onToggleHold: (member: Member, onHold: boolean) => Promise<void>
  readOnly?: boolean
}) {
  return (
    <ul className="card divide-list overflow-hidden">
      {entries.map(
        ({
          member,
          age,
          monthsSince: months,
          alreadyPlanned,
          scheduled,
          onHold,
          holdUntil,
          onMission,
          missionUntil,
        }) => (
          <li
            key={member.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3',
              (alreadyPlanned || onHold || onMission) && 'opacity-50',
            )}
          >
            <Avatar name={`${member.firstName} ${member.lastName}`} id={member.id} size="md" />

            <div className="min-w-0 flex-1">
              <MemberLink
                memberId={member.id}
                label="Ansprachen"
                className="block truncate text-sm font-medium hover:underline"
              >
                {member.firstName} {member.lastName}
              </MemberLink>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {/* Schon eingetragen: Das zählt statt der letzten Ansprache –
                    bis der Eintrag wieder weg ist. */}
                {scheduled ? (
                  <>
                    <TalkStatusBadge status={scheduled.status} /> für{' '}
                    {formatDayMonthYear(scheduled.date)}
                  </>
                ) : months === null ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    Noch nie gesprochen
                  </span>
                ) : (
                  <>
                    Zuletzt vor {months} Monaten
                    {member.lastTalkDate && ` (${formatDate(member.lastTalkDate)})`}
                  </>
                )}
                {age !== null && ` · ${age} Jahre`}
                {member.status !== 'active' && ' · inaktiv'}
                {onHold &&
                  (holdUntil
                    ? ` · nicht anfragen bis ${formatDate(holdUntil)}`
                    : ' · nicht anfragen')}
                {onMission &&
                  (missionUntil
                    ? ` · auf Mission bis ${formatDate(missionUntil)}`
                    : ' · auf Mission')}
              </p>
            </div>

            {/* Auf Mission lässt sich weder anfragen noch ausnehmen: Das
              regelt allein das Profil, und nach der Rückkehr steht die
              Person von selbst wieder da. */}
            {!readOnly && !onMission && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => onAssign(member)}
                  // Ausgenommen heisst «nicht anfragen»: Wer es trotzdem will,
                  // nimmt die Person nebenan wieder auf.
                  disabled={alreadyPlanned || onHold}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Anfragen
                </button>

                {/* Kein Löschen und kein Status: Wer im Moment nicht angefragt
                werden soll, ist mit einem Griff wieder da. */}
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => void onToggleHold(member, onHold)}
                  aria-label={
                    onHold
                      ? `${member.firstName} ${member.lastName} wieder anfragen`
                      : `${member.firstName} ${member.lastName} nicht mehr anfragen`
                  }
                  title={
                    onHold
                      ? 'Wieder in die Vorschläge aufnehmen'
                      : 'Nicht anfragen – blendet die Person aus den Vorschlägen aus'
                  }
                >
                  {onHold ? (
                    <RotateCcw className="size-3.5" aria-hidden />
                  ) : (
                    <UserMinus className="size-3.5" aria-hidden />
                  )}
                  <span className="hidden sm:inline">
                    {onHold ? 'Wieder anfragen' : 'Nicht anfragen'}
                  </span>
                </button>
              </div>
            )}
          </li>
        ),
      )}
    </ul>
  )
}

/* ------------------------------------------------------------------ */

function HistoryList({ talks }: { talks: Talk[] }) {
  if (talks.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={Clock} title="Noch keine gehaltene Ansprache" />
      </div>
    )
  }

  return (
    <ul className="card divide-list overflow-hidden">
      {talks.map((talk) => (
        <li key={talk.id} className="flex items-center gap-3 px-4 py-3">
          <Avatar name={talkSpeakerLabel(talk)} id={talk.memberId || undefined} size="sm" />
          <div className="min-w-0 flex-1">
            {/* Ein von Hand erfasster Name führt zu keinem Mitglied. */}
            {talk.memberId ? (
              <MemberLink
                memberId={talk.memberId}
                label="Ansprachen"
                className="block truncate text-sm font-medium hover:underline"
              >
                {talk.memberName}
              </MemberLink>
            ) : (
              <p className="truncate text-sm font-medium">{talkSpeakerLabel(talk)}</p>
            )}
            {talk.topic && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{talk.topic}</p>
            )}
          </div>
          <span className="tabular shrink-0 text-xs text-slate-500 dark:text-slate-400">
            {formatDate(talk.date)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Zuteilen                                                            */
/* ------------------------------------------------------------------ */

function AssignDialog({
  open,
  onClose,
  date,
  slot,
  kind: initialKind,
  presetMember: preset,
  sundayAt,
}: {
  open: boolean
  onClose: () => void
  date: Date
  /** Gewünschte Position – `null` heisst «der nächste offene Platz am gewählten Datum» */
  slot: number | null
  kind: TalkKind
  presetMember: Member | null
  /** Was am gewählten Datum schon eingetragen und vorgesehen ist */
  sundayAt: (date: Date) => { talks: Talk[]; planned: number }
}) {
  const { members, settings } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const { data: talks } = useTalks(200)

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  /** Von Hand erfasster Name – für alle, die nicht in der Mitgliederliste stehen. */
  const [manual, setManual] = useState('')
  const [dateValue, setDateValue] = useState('')
  /** Die gewünschte Position – `null` heisst «der nächste offene Platz». */
  const [slotChoice, setSlotChoice] = useState<number | null>(null)
  /**
   * Hat jemand die Position von Hand gesetzt? Solange nicht, geht sie mit dem
   * Datum mit. Früher blieb sie beim Datumswechsel stehen – die Position des
   * ersten Sonntags landete am zweiten auf einer schon vergebenen Nummer.
   */
  const [slotTouched, setSlotTouched] = useState(false)
  const [kind, setKind] = useState<TalkKind>('talk')
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState<number | ''>(10)
  const [status, setStatus] = useState<TalkStatus>('asked')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDateValue(toDateInput(date))
    setSlotChoice(slot)
    setSlotTouched(false)
    setKind(initialKind)
    setSelected(preset)
    setManual('')
    setSearch('')
    setTopic('')
    // Zeugnisse sind deutlich kürzer als eine Ansprache.
    setDuration(initialKind === 'testimony' ? 5 : 10)
    setStatus('asked')
  }, [open, date, slot, initialKind, preset])

  /** Das im Dialog gewählte Datum – mit der Uhrzeit der Versammlung. */
  const chosenDate = useMemo(
    () => (dateValue ? new Date(`${dateValue}T${settings.sacramentTime}:00`) : null),
    [dateValue, settings.sacramentTime],
  )
  const chosenSunday = chosenDate ? sundayAt(chosenDate) : null
  const rows = chosenSunday ? talkPositions(chosenSunday.talks, chosenSunday.planned) : []
  /** Weiter hinten als «angehängt» geht nicht – dort stünde eine Lücke. */
  const lastPosition = rows.length + 1
  // Der erste offene Platz, sonst hinten angehängt – laufend aus dem Bestand.
  const slotValue =
    slotChoice ??
    (chosenSunday ? nextOpenPosition(chosenSunday.talks, chosenSunday.planned) : lastPosition)
  const position = Math.min(Math.max(slotValue, 1), lastPosition)
  const occupant = rows[position - 1]?.talk ?? null

  const changeDate = (value: string) => {
    setDateValue(value)
    // Die Position gehörte zum vorigen Sonntag – ausser, sie wurde von Hand gesetzt.
    if (!slotTouched) setSlotChoice(null)
  }

  const ranked = useMemo(
    () =>
      rankTalkCandidates(members, talks, {
        gapMonths: settings.talkGapMonths,
        minAge: settings.talkMinAge,
      }),
    [members, talks, settings.talkGapMonths, settings.talkMinAge],
  )

  const results = useMemo(() => {
    if (!search.trim()) return ranked.slice(0, 8)
    return ranked
      .filter((c) => matchesSearch(`${c.member.firstName} ${c.member.lastName}`, search))
      .slice(0, 8)
  }, [ranked, search])

  /**
   * Ein Mitglied nur, wenn eines gewählt wurde – sonst der getippte Name.
   *
   * Auch der noch nicht übernommene Suchtext zählt: Wer einen Namen tippt und
   * «Eintragen» drückt, meint diesen Namen und keinen Platzhalter. Ein
   * Mitglied wird dadurch nach wie vor nicht zugeordnet.
   */
  const typed = search.trim()
  const speaker: TalkSpeaker | null = selected
    ? { member: selected }
    : manual.trim()
      ? { name: manual }
      : typed
        ? { name: typed }
        : null

  const takeAsIs = () => {
    if (!search.trim()) return
    setManual(search.trim())
    setSearch('')
  }

  /*
   * Ohne Person ist nichts angefragt.
   *
   * «Angefragt» oder «Zugesagt» beschreibt ein Gespräch mit jemandem – an
   * einem Platzhalter stünde beides für niemanden. Er ist vorgesehen, mehr
   * nicht; die Wahl von oben bleibt erhalten und gilt wieder, sobald ein
   * Name dasteht.
   */
  const effectiveStatus: TalkStatus = speaker ? status : 'planned'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!chosenDate || !chosenSunday) return

    setSaving(true)
    try {
      // Ist die Position belegt, rücken die Folgenden nach – im selben Zug.
      const { outcome } = await insertTalk(
        {
          ...speakerFields(speaker),
          date: chosenDate,
          kind,
          topic: topic.trim(),
          durationMinutes: typeof duration === 'number' ? duration : undefined,
          status: effectiveStatus,
          askedById: speaker ? (profile?.id ?? null) : null,
        },
        position,
        chosenSunday.talks,
        chosenSunday.planned,
      )
      toast.saved(
        speaker
          ? `${TALK_KIND_LABELS[kind]} eingetragen.`
          : `${TALK_KIND_LABELS[kind]} als Platzhalter eingetragen.`,
        outcome,
      )
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Eintragen fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${TALK_KIND_LABELS[kind]} vergeben`}
      description={formatDateLong(chosenDate ?? date)}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          {/* Auch ohne Namen: Der Platz wird dann als Platzhalter vergeben. */}
          <button type="submit" form="talk-form" className="btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert …' : speaker ? 'Eintragen' : 'Platzhalter eintragen'}
          </button>
        </>
      }
    >
      <form id="talk-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <span className="label">Wer spricht?</span>
          {selected ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <Avatar
                name={`${selected.firstName} ${selected.lastName}`}
                id={selected.id}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selected.lastTalkDate
                    ? `Zuletzt ${formatDate(selected.lastTalkDate)}`
                    : 'Noch keine Ansprache'}
                  {selected.mobile && ` · ${formatPhone(selected.mobile)}`}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost p-1.5"
                onClick={() => setSelected(null)}
                aria-label="Auswahl aufheben"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : manual.trim() ? (
            /* Von Hand erfasst: ein Gast, die Missionare, eine Gruppe. */
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <Avatar name={manual} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{manual}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Keinem Mitglied zugeordnet
                </p>
              </div>
              {/* Zurück ins Suchfeld, statt löschen und neu tippen. */}
              <button
                type="button"
                className="btn-ghost p-1.5"
                onClick={() => {
                  setSearch(manual)
                  setManual('')
                }}
                aria-label="Namen bearbeiten"
                title="Namen bearbeiten"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-ghost p-1.5"
                onClick={() => setManual('')}
                aria-label="Auswahl aufheben"
                title="Auswahl aufheben"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                className="input"
                placeholder="Name eingeben oder aus den Vorschlägen wählen"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  // Die Eingabetaste übernimmt den Namen, statt das Formular
                  // abzusenden – dort fehlte sonst noch, wer spricht.
                  event.preventDefault()
                  takeAsIs()
                }}
              />
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {results.map(
                  ({ member, monthsSince: months, alreadyPlanned, scheduled, onHold }) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(member)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Avatar
                          name={`${member.firstName} ${member.lastName}`}
                          id={member.id}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {member.firstName} {member.lastName}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {alreadyPlanned && scheduled ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <TriangleAlert className="size-3" aria-hidden />
                              {TALK_STATUS_LABELS[scheduled.status].toLowerCase()}{' '}
                              {formatDate(scheduled.date)}
                            </span>
                          ) : onHold ? (
                            /* Ausgenommen heisst «nicht anfragen» – gesperrt ist
                               hier trotzdem nichts: Wer die Person ausdrücklich
                               sucht, weiss, was er tut. */
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <UserMinus className="size-3" aria-hidden />
                              nicht anfragen
                            </span>
                          ) : scheduled ? (
                            // Vorbei, aber nie zugesagt – kein Grund zur Warnung.
                            `${TALK_STATUS_LABELS[scheduled.status].toLowerCase()} ${formatDate(scheduled.date)}`
                          ) : months === null ? (
                            'nie'
                          ) : (
                            `${months} Mt.`
                          )}
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ul>

              {results.length === 0 && search.trim().length > 1 && (
                <p className="hint">Keine Übereinstimmung in der Mitgliederliste.</p>
              )}

              {/* Ein Mitglied wird nur zugeordnet, wenn es oben angetippt
                  wird. Alles andere bleibt reiner Text. */}
              {search.trim() && (
                <button type="button" className="btn-secondary btn-sm mt-2" onClick={takeAsIs}>
                  <UserPlus className="size-3.5" aria-hidden />«{search.trim()}» ohne Mitglied
                  eintragen
                </button>
              )}
              <p className="hint">
                Wer nicht in der Mitgliederliste steht – ein besuchender Hoher Rat, die Missionare,
                eine Gruppe –, wird von Hand eingetragen und keinem Mitglied zugeordnet.
              </p>
              {/* Der Platz darf auch vor der Person feststehen. */}
              <p className="hint">
                Ohne Namen entsteht ein Platzhalter: Der Punkt steht mit seiner Art im Programm, der
                Name lässt sich später nachtragen.
              </p>
            </>
          )}
        </div>

        <div>
          <span className="label">Art des Programmpunkts</span>
          <div className="flex flex-wrap gap-2">
            {(['talk', 'testimony'] as TalkKind[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={kind === value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              >
                {TALK_KIND_LABELS[value]}
              </button>
            ))}
          </div>
          <p className="hint">
            Ein Zeugnis belegt wie eine Ansprache einen Platz im Programm, dauert aber kürzer.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="talk-date">
              Datum
            </label>
            <input
              id="talk-date"
              type="date"
              className="input"
              value={dateValue}
              onChange={(event) => changeDate(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="talk-slot">
              Position
            </label>
            <input
              id="talk-slot"
              type="number"
              min={1}
              max={lastPosition}
              className="input"
              value={slotValue}
              onChange={(event) => {
                setSlotTouched(true)
                setSlotChoice(Number.parseInt(event.target.value, 10) || 1)
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="talk-duration">
              Minuten
            </label>
            <input
              id="talk-duration"
              type="number"
              min={1}
              max={45}
              className="input"
              value={duration}
              onChange={(event) =>
                setDuration(event.target.value ? Number.parseInt(event.target.value, 10) : '')
              }
            />
          </div>
        </div>

        {/* Was mit der gewählten Position geschieht – bevor gespeichert wird. */}
        {occupant ? (
          <p className="hint -mt-2">
            Position {position} ist mit {talkSpeakerLabel(occupant)} belegt – der neue Eintrag kommt
            davor, wer dort steht, rückt nach hinten.
          </p>
        ) : slotValue > lastPosition ? (
          <p className="hint -mt-2">Wird als Position {position} hinten angehängt.</p>
        ) : null}

        <div>
          <label className="label" htmlFor="talk-topic">
            Thema
          </label>
          <input
            id="talk-topic"
            className="input"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="talk-status">
            Status
          </label>
          <select
            id="talk-status"
            className="input"
            value={effectiveStatus}
            onChange={(event) => setStatus(event.target.value as TalkStatus)}
            disabled={!speaker}
          >
            {(['planned', 'asked', 'confirmed'] as TalkStatus[]).map((value) => (
              <option key={value} value={value}>
                {TALK_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          {!speaker && (
            <p className="hint">
              Ein Platzhalter ist vorgesehen – angefragt wird, sobald jemand feststeht.
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Bearbeiten                                                          */
/* ------------------------------------------------------------------ */

function EditTalkDialog({
  talk,
  position,
  sundayAt,
  suggestions,
  onClose,
}: {
  /**
   * Der laufende Stand aus Firestore.
   *
   * Wer spricht und der Status werden sofort geschrieben; beides steht damit
   * gleich nach dem Handgriff richtig im Dialog, statt erst beim nächsten
   * Öffnen (siehe `changeSpeaker`).
   */
  talk: Talk
  /** Die Nummer, unter der der Eintrag in der Liste steht */
  position: number
  /** Was an einem Datum eingetragen und vorgesehen ist – fürs Entfernen */
  sundayAt: (date: Date) => { talks: Talk[]; planned: number }
  /** Vorschlagsreihenfolge «wer war lange nicht dran» – wie beim Zuteilen */
  suggestions: Member[]
  onClose: () => void
}) {
  const toast = useToast()
  const { settings } = useData()
  const [declining, setDeclining] = useState(false)
  const placeholder = isTalkPlaceholder(talk)
  /*
   * Art, Thema und Notiz stehen im Formular und werden erst beim Speichern
   * geschrieben. Die Startwerte gelten deshalb nur beim Öffnen: Ein
   * Schnappschuss aus Firestore – etwa der eigene, eben geänderte Name –
   * überschriebe sonst mitten im Tippen, was noch nicht gespeichert ist.
   */
  const [kind, setKind] = useState<TalkKind>(talk.kind ?? 'talk')
  const [topic, setTopic] = useState(talk.topic ?? '')
  const [notes, setNotes] = useState(talk.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const changeStatus = async (status: TalkStatus) => {
    try {
      await setTalkStatus(talk.id, status)
      if (status === 'confirmed') {
        toast.success('Zugesagt – die Ansprache zählt damit als gehalten.')
      }
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Status konnte nicht geändert werden.')
    }
  }

  const save = async () => {
    try {
      const outcome = await updateTalk(talk.id, {
        kind,
        topic: topic.trim(),
        notes: notes.trim(),
      })
      toast.saved('Gespeichert.', outcome)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  /*
   * Wer spricht, wird sofort geschrieben und nicht erst beim Speichern: Es
   * ist ein Handgriff für sich – ein Platzhalter bekommt seinen Namen, oder
   * ein Name fällt wieder weg, weil jemand abgesagt hat.
   */
  const changeSpeaker = async (speaker: TalkSpeaker | null) => {
    try {
      const outcome = await setTalkSpeaker(talk.id, speaker)
      toast.saved(speaker ? 'Eingetragen.' : 'Name entfernt – der Platz bleibt stehen.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={talkSpeakerLabel(talk)}
        description={`${formatDate(talk.date)} · Position ${position} · ${TALK_KIND_LABELS[talk.kind ?? 'talk']}`}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost mr-auto text-rose-600 dark:text-rose-400"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Entfernen
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Schliessen
            </button>
            <button type="button" className="btn-primary" onClick={() => void save()}>
              Speichern
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <MemberSearchSelect
              label="Wer spricht?"
              value={talk.memberId || null}
              onChange={(member) => void changeSpeaker(member ? { member } : null)}
              freeText={talk.memberId ? '' : talk.memberName}
              onFreeText={(name) => void changeSpeaker(name.trim() ? { name } : null)}
              suggestions={suggestions}
              meta={(member) =>
                member.lastTalkDate ? `zuletzt ${formatDate(member.lastTalkDate)}` : 'noch nie'
              }
              compact
            />
            <p className="hint">
              Ohne Namen bleibt der Punkt als Platzhalter im Programm stehen – mit Art, Dauer und
              Thema.
            </p>

            {/* Die Absage gehört zur Person: Sie geht, der Platz bleibt – und
                gleich hier lässt sich die nächste eintragen. */}
            {!placeholder && (
              <button
                type="button"
                className="btn-secondary btn-sm mt-2"
                onClick={() => setDeclining(true)}
              >
                <UserX className="size-3.5" aria-hidden />
                Absage
              </button>
            )}

            {(talk.declines ?? []).length > 0 && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <p className="font-medium">Für diesen Platz abgesagt</p>
                <ul className="mt-1 space-y-0.5">
                  {(talk.declines ?? []).map((entry, index) => (
                    <li key={`${entry.memberName}-${index}`} className="flex items-center gap-1.5">
                      <UserX className="size-3 shrink-0 text-slate-400" aria-hidden />
                      {entry.memberName}
                      <span className="text-slate-400">· {formatDate(entry.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <span className="label">Status</span>
            <div className="flex flex-wrap gap-2">
              {(['planned', 'asked', 'confirmed'] as TalkStatus[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void changeStatus(value)}
                  className={talk.status === value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                >
                  {TALK_STATUS_LABELS[value]}
                </button>
              ))}
            </div>
            <p className="hint">
              {talk.memberId
                ? 'Eine Zusage gilt als gehalten und setzt das Datum der letzten Ansprache beim Mitglied. Springt jemand ein, wird der Eintrag unter «Leitung» geändert – dann stimmt die Statistik wieder.'
                : 'Dieser Eintrag ist keinem Mitglied zugeordnet – er bleibt in der Mitgliederstatistik unberücksichtigt.'}
            </p>
          </div>

          <div>
            <span className="label">Art</span>
            <div className="flex flex-wrap gap-2">
              {(['talk', 'testimony'] as TalkKind[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  aria-pressed={kind === value}
                  className={kind === value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                >
                  {TALK_KIND_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="edit-topic">
              Thema
            </label>
            <input
              id="edit-topic"
              className="input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="edit-notes">
              Notiz
            </label>
            <textarea
              id="edit-notes"
              className="input min-h-20 resize-y"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          const date = toDate(talk.date) ?? new Date()
          const sunday = sundayAt(date)
          void removeTalkEntry(date, talk.id, sunday.talks, sunday.planned, settings.talksPerSunday)
            .then((outcome) => {
              toast.saved('Eintrag entfernt – der Platz ist wieder offen.', outcome)
              onClose()
            })
            .catch((error: unknown) => {
              console.error(error)
              toast.error('Eintrag konnte nicht entfernt werden.')
            })
        }}
        title="Eintrag entfernen?"
        message={
          placeholder
            ? 'Art, Thema und Notiz werden gelöscht. Der Platz bleibt offen – in der Liste lässt er sich danach streichen.'
            : 'Der ganze Eintrag wird gelöscht, der Platz bleibt offen. Hat jemand abgesagt, ist «Absage» der bessere Weg: Dann bleiben Art und Thema stehen, und die Absage ist vermerkt.'
        }
        confirmLabel="Entfernen"
        danger
      />

      {declining && <DeclineDialog talk={talk} onClose={() => setDeclining(false)} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Absage                                                              */
/* ------------------------------------------------------------------ */

/** Wie lange jemand nach einer Absage nicht vorgeschlagen wird – in Monaten. */
const DECLINE_PAUSES = [
  { months: 0, label: 'Weiter vorschlagen' },
  { months: 3, label: '3 Monate nicht' },
  { months: 6, label: '6 Monate nicht' },
] as const

/**
 * Jemand hat abgesagt.
 *
 * Der Name geht, der Platz bleibt – mit Art, Thema und Dauer. Die Absage wird
 * am Platz vermerkt (siehe `declineTalk`). Wer gerade abgesagt hat, will
 * meist nicht nächste Woche wieder gefragt werden: Auf Wunsch fällt die
 * Person deshalb eine Weile aus den Vorschlägen – über denselben Vermerk wie
 * «Nicht anfragen», also jederzeit unter «Vorschläge» wieder aufzuheben.
 */
function DeclineDialog({ talk, onClose }: { talk: Talk; onClose: () => void }) {
  const toast = useToast()
  const { membersById } = useData()
  const member = talk.memberId ? (membersById.get(talk.memberId) ?? null) : null
  const availability = member ? talkAvailability(member) : null
  /* Schon «auf Weiteres» ausgenommen – daran ändert eine Absage nichts. */
  const heldIndefinitely = availability !== null && !availability.available && !availability.until
  const [months, setMonths] = useState<number>(3)
  const [saving, setSaving] = useState(false)

  const name = talkSpeakerLabel(talk)
  const firstName = member?.firstName ?? name
  const until = availability ? holdAfterDecline(availability, months) : null

  const submit = async () => {
    setSaving(true)
    try {
      const outcome = await declineTalk(talk.id)
      if (member && availability && until) {
        await setTalkAvailability(member.id, false, until)
      }
      toast.saved(
        until
          ? `Absage eingetragen – der Platz ist wieder offen. ${firstName} wird bis ${formatDate(until)} nicht vorgeschlagen.`
          : 'Absage eingetragen – der Platz ist wieder offen.',
        outcome ?? undefined,
      )
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Absage konnte nicht eingetragen werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Absage von ${name}`}
      description={formatDateLong(talk.date)}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            data-autofocus
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? 'Wird gespeichert …' : 'Absage eintragen'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Der Name wird entfernt. Der Platz bleibt mit Art, Thema und Dauer stehen und gilt wieder
          als offen – die Absage wird daran vermerkt.
        </p>

        {/* Ohne Mitglied gibt es niemanden, der aus den Vorschlägen fallen könnte. */}
        {member &&
          (heldIndefinitely ? (
            <p className="hint">
              {firstName} ist schon auf Weiteres von den Vorschlägen ausgenommen.
            </p>
          ) : (
            <div>
              <span className="label">Danach vorschlagen?</span>
              <div className="flex flex-wrap gap-2">
                {DECLINE_PAUSES.map((option) => (
                  <button
                    key={option.months}
                    type="button"
                    aria-pressed={months === option.months}
                    onClick={() => setMonths(option.months)}
                    className={
                      months === option.months ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="hint">
                {months === 0
                  ? `${firstName} bleibt in den Vorschlägen.`
                  : until
                    ? `${firstName} steht bis ${formatDate(until)} nicht in den Vorschlägen – unter «Vorschläge» jederzeit wieder aufzuheben.`
                    : `${firstName} ist ohnehin schon länger von den Vorschlägen ausgenommen.`}
              </p>
            </div>
          ))}
      </div>
    </Modal>
  )
}
