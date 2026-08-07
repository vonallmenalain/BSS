import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CalendarCog,
  CalendarOff,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Printer,
  Repeat,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { usePrayers, useTalks } from '@/hooks/useFirestore'
import { useSundayAnnouncements } from '@/hooks/useAnnouncements'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { MemberPicker } from '@/components/ui/Pickers'
import { BusinessFields } from '@/components/sacrament/BusinessFields'
import { HymnField } from '@/components/sacrament/HymnField'
import { LeaderField } from '@/components/sacrament/LeaderField'
import { MemberSearchSelect } from '@/components/sacrament/MemberSearchSelect'
import { ConflictNotice, SectionHeader, useSacrament } from '@/components/sacrament/SacramentLayout'
import {
  SundayProgramBadge,
  SundayProgramDialog,
  sundayProgramNote,
} from '@/components/sacrament/SundayProgram'
import {
  ResponsibleButton,
  SundayResponsibleDialog,
} from '@/components/sacrament/SundayResponsible'
import { useAutoDraft } from '@/components/sacrament/useDraft'
import { formatDate, formatDateLong, toDate, toDateInput } from '@/lib/dates'
import { isSeriesEntry } from '@/lib/series'
import { cn } from '@/lib/utils'
import { formatHymn } from '@/services/hymns'
import { lastPrayerByMember, rankPrayerCandidates, setPrayer } from '@/services/prayers'
import {
  createTalk,
  deleteTalk,
  rankTalkCandidates,
  setTalkSpeaker,
  speakerFields,
  updateTalk,
  type TalkSpeaker,
} from '@/services/talks'
import {
  addTalkSlot,
  buildProgram,
  emptySacramentMeeting,
  moveInList,
  newAnnouncement,
  businessLabel,
  isBusinessEmpty,
  newBusinessEntry,
  newMusicalNumber,
  removeTalkSlot,
  replaceInList,
  plannedTalksFor,
  saveProgramOrder,
  saveSacramentMeeting,
  sundayProgram,
  talksForDate,
  type ProgramEntry,
} from '@/services/sacrament'
import {
  BUSINESS_TYPE_LABELS,
  HYMN_SLOT_LABELS,
  isTalkPlaceholder,
  PRAYER_SLOT_LABELS,
  TALK_KIND_LABELS,
  type AnnouncementEntry,
  type BusinessEntry,
  type HymnChoice,
  type HymnSlot,
  type Member,
  type MusicalNumber,
  type PrayerSlot,
  type SacramentMeeting,
  type TalkKind,
} from '@/lib/types'

/**
 * Die Felder des Sonntagsprogramms, die auf dieser Seite laufend
 * geschrieben werden.
 *
 * Was an diesem Sonntag überhaupt stattfindet, steht bewusst nicht darin:
 * Das legt der Dialog «Programm des Sonntags» fest und schreibt es sofort –
 * dieselbe Angabe wird auch unter «Ansprachen» gesetzt, und zwei Wege in
 * denselben Entwurf gäben ein Wettrennen.
 */
interface MeetingDraft {
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
  content: ReactNode
}

/* ------------------------------------------------------------------ */
/* Ansicht                                                             */
/* ------------------------------------------------------------------ */

/**
 * Wie luftig der Ablauf gesetzt wird.
 *
 * Am Pult wird vom Bildschirm gelesen, oft im Halbdunkel und mit Abstand –
 * je nach Gerät und Augen braucht das mehr oder weniger Grösse. Deshalb
 * eine Wahl statt einer festen Grösse. Die Klassen stehen ausgeschrieben da,
 * sonst fände Tailwind sie beim Übersetzen nicht.
 */
type ViewSize = 'kompakt' | 'mittel' | 'weit'

interface ViewStyle {
  label: string
  /** Innenabstand des Blattes */
  pad: string
  /** Grundschrift – alle Zeilen darin erben sie */
  text: string
  /** Abstand zwischen zwei Programmpunkten */
  steps: string
  /** Überschrift des Vollbilds – die Versammlung selbst */
  heading: string
  /** Titel eines Punktes */
  title: string
  /** Nummer vor dem Titel */
  badge: string
  /** Abstand zwischen Nummer und Text */
  gap: string
  /** Einzug auf die Höhe des Titels – für die Knöpfe unter dem Ablauf */
  indent: string
  /** Abstand unter dem Titel */
  body: string
  /** Abstand zwischen zwei Zeilen eines Punktes */
  rows: string
}

const VIEWS: Record<ViewSize, ViewStyle> = {
  kompakt: {
    label: 'Kompakt',
    pad: 'p-5',
    text: 'text-sm',
    steps: 'space-y-4',
    heading: 'text-lg sm:text-xl',
    title: 'text-base',
    badge: 'size-6 text-xs',
    gap: 'gap-3',
    indent: 'pl-9',
    body: 'mt-1',
    rows: 'space-y-1',
  },
  mittel: {
    label: 'Mittel',
    pad: 'p-6',
    text: 'text-base',
    steps: 'space-y-7',
    heading: 'text-xl sm:text-2xl',
    title: 'text-xl',
    badge: 'size-7 text-sm',
    gap: 'gap-3.5',
    indent: 'pl-11',
    body: 'mt-1.5',
    rows: 'space-y-1.5',
  },
  weit: {
    label: 'Weit',
    pad: 'p-8',
    text: 'text-lg',
    steps: 'space-y-10',
    heading: 'text-xl sm:text-3xl',
    title: 'text-2xl',
    badge: 'size-8 text-base',
    gap: 'gap-4',
    indent: 'pl-12',
    body: 'mt-2',
    rows: 'space-y-2',
  },
}

/**
 * Wie hoch eine A4-Seite innerhalb ihrer Ränder ist – in CSS-Pixeln, mit
 * denen der Browser rechnet (96 pro Zoll). Der Rand steht in `index.css`
 * bei `@page`; ändert er sich dort, gehört er hier nachgeführt.
 */
const A4_CONTENT_HEIGHT = ((297 - 2 * 14) / 25.4) * 96

/**
 * Wie stark das Blatt kleiner gesetzt werden muss, damit es auf eine Seite
 * passt.
 *
 * An einem vollen Sonntag – vier Bekanntmachungen, drei Berufungen, dazu
 * Notizen – wird der Ablauf länger als eine Seite. Zwei Seiten sind am Pult
 * das eine Blatt zu viel: Wer mitten in der Versammlung umblättert, verliert
 * die Zeile. Also rückt der Satz enger zusammen, und zwar nur so weit wie
 * nötig; ein gewöhnlicher Sonntag wird gar nicht angetastet.
 *
 * Nach unten ist bei drei Vierteln Schluss. Was man nicht mehr vorlesen
 * kann, ist auf einer Seite nicht gewonnen – dann lieber zwei.
 */
function fitToPage(height: number): number {
  if (height <= A4_CONTENT_HEIGHT) return 1
  return Math.max(0.75, A4_CONTENT_HEIGHT / height)
}

/**
 * Das Mass fürs Papier.
 *
 * Gedruckt wird nicht in der Grösse, die gerade am Bildschirm eingestellt
 * ist: Am Bildschirm entscheidet der Abstand zum Gerät, auf dem Blatt
 * entscheidet, dass der ganze Ablauf auf eine A4-Seite passt. «Weit» wären
 * zwei Seiten, und wer am Pult umblättern muss, verliert die Zeile.
 *
 * Enger als «Kompakt» ist es trotzdem nicht: Papier liest sich näher als ein
 * Bildschirm, und was ausgedruckt wird, wird vorgelesen.
 */
const PRINT_VIEW: ViewStyle = {
  label: 'Druck',
  // Den Rand setzt die Seite (`@page` in `index.css`), nicht das Blatt.
  pad: 'p-0',
  text: 'text-sm',
  steps: 'space-y-4',
  heading: 'text-xl',
  title: 'text-base',
  badge: 'size-6 text-xs',
  gap: 'gap-3',
  indent: 'pl-9',
  body: 'mt-1',
  rows: 'space-y-1',
}

/**
 * Leitung: der ganze Ablauf auf einer Seite – und alles davon hier änderbar.
 *
 * Der Aufbau folgt dem Handbuch (Abschnitt 29.2.1), bewusst gekürzt auf das,
 * was am Pult gebraucht wird: Vorspiel, Willkommensgruss und Nachspiel stehen
 * nicht im Programm, sie ergeben sich von selbst.
 *
 * Zwei Ansichten, ein Inhalt: Wer «Bearbeiten» drückt, sieht Felder und
 * Knöpfe; sonst steht da nur der Ablauf, wie er in der Versammlung gebraucht
 * wird. In dieser Ansicht steht kein erklärender Satz und kein leerer Punkt –
 * was nicht vorgesehen ist, erscheint gar nicht erst.
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

  // Gelesen wird häufiger als geplant: Wer die Seite öffnet, sieht den
  // Ablauf, wie er in der Versammlung gebraucht wird. Bearbeitet wird erst
  // auf Knopfdruck. Beide Wahlen bleiben erhalten, damit man sie nicht jedes
  // Mal neu treffen muss.
  const [editing, setEditing] = useLocalStorage<boolean>('bss:leitung:bearbeiten', false)
  const [size, setSize] = useLocalStorage<ViewSize>('bss:leitung:ansicht', 'mittel')

  /*
   * Drucken: dasselbe Blatt, nur auf Papier.
   *
   * Der Knopf ist kein zweiter Ablauf, sondern derselbe – gesetzt im
   * Druckmass und ohne alles, was um ihn herum auf dem Bildschirm steht.
   * Der Zustand hält bloss den Augenblick fest, in dem der Browser die
   * Seite setzt; unmittelbar danach steht wieder die gewählte Grösse da.
   *
   * Solange er gilt, steht das Blatt auch am Bildschirm in der Breite einer
   * A4-Seite. Das ist kein Selbstzweck: Nur so bricht der Text gleich um wie
   * nachher auf dem Papier, und nur so lässt sich vorher messen, ob alles
   * auf eine Seite passt (siehe `fitToPage`).
   */
  const [printing, setPrinting] = useState(false)
  const sheet = useRef<HTMLElement>(null)
  const view = printing ? PRINT_VIEW : (VIEWS[size] ?? VIEWS.mittel)

  /*
   * Vollbild: das Blatt allein auf dem Bildschirm.
   *
   * Am Pult stört alles, was nicht der Ablauf ist – Kopfzeile, Navigation,
   * die Sonntagswahl. Ein Knopf oben rechts im Blatt lässt sie
   * verschwinden; derselbe Knopf holt sie zurück, ebenso die
   * Escape-Taste.
   *
   * Zusätzlich wird, wo der Browser es zulässt, sein echtes Vollbild
   * angefordert: Auf dem Tablet verschwindet damit auch die Adresszeile.
   * Wo das nicht geht – auf dem iPhone etwa –, genügt die Überlagerung.
   * Deshalb steuert der eigene Zustand die Ansicht, nicht der des Browsers.
   */
  const [fullscreen, setFullscreen] = useState(false)

  /* Der Dialog «Programm des Sonntags» – derselbe wie unter «Ansprachen». */
  const [programOpen, setProgramOpen] = useState(false)
  const [responsibleOpen, setResponsibleOpen] = useState(false)

  useEffect(() => {
    if (!fullscreen) return

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    // Verlässt jemand das Browser-Vollbild auf anderem Weg, geht auch die
    // Überlagerung weg – sonst bliebe ein Blatt zurück, das den Rest der
    // App verdeckt, ohne dass klar wäre, warum.
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [fullscreen])

  /*
   * Solange die Leitung offen ist, gilt fürs Papier: das Blatt und sonst
   * nichts. Die Klasse am `<body>` sagt das dem Stylesheet – so kommt aus
   * «Drucken» und aus Strg+P dieselbe Seite, und die übrigen Ansichten
   * drucken weiterhin, was sie immer gedruckt haben.
   */
  useEffect(() => {
    document.body.classList.add('sheet-page')
    return () => document.body.classList.remove('sheet-page')
  }, [])

  useEffect(() => {
    if (!printing) return

    const el = sheet.current
    if (el) el.style.setProperty('--sheet-zoom', String(fitToPage(el.scrollHeight)))

    // `print()` hält in den meisten Browsern an, bis der Dialog geschlossen
    // ist – dort genügt die Zeile danach. Wo er sofort zurückkehrt, holt
    // `afterprint` die gewählte Grösse zurück auf den Bildschirm.
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    window.print()
    done()

    return () => {
      el?.style.removeProperty('--sheet-zoom')
      window.removeEventListener('afterprint', done)
    }
  }, [printing])

  const dateKey = toDateInput(date)
  const sundayTalks = useMemo(() => talksForDate(talks, date), [talks, date])

  /* ---------------- Entwurf, der sich selbst speichert --------------- */

  const server = useMemo<MeetingDraft>(
    () => ({
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

  /*
   * Wiederkehrende Bekanntmachungen gehören genauso ins Blatt am Pult wie
   * die erfassten – hier stehen sie nur zum Vorlesen. Geändert werden sie
   * unter «Bekanntmachungen», wo auch die Serie selbst zu Hause ist.
   */
  const sunday = useSundayAnnouncements(dateKey, current.announcements)

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

  /*
   * Was an diesem Sonntag stattfindet – und was daraus folgt.
   *
   * An einer Zeugnisversammlung oder an der Darbietung der Kinder werden
   * keine Ansprachen vergeben; dann stehen im Ablauf auch keine offenen
   * Plätze. Bereits vergebene bleiben stehen: Sie zu verstecken hiesse,
   * eine Zusage zu verlieren.
   */
  const sundayKind = useMemo(() => sundayProgram(date, meeting), [date, meeting])
  const planned = plannedTalksFor(date, meeting, settings.talksPerSunday)

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

  const assignTalk = (slot: number, speaker: TalkSpeaker) => {
    void guard(
      () =>
        createTalk({
          ...speakerFields(speaker),
          date: talkDate,
          slot,
          kind: 'talk',
          status: 'planned',
          askedById: profile?.id ?? null,
        }),
      'Ansprache konnte nicht eingetragen werden.',
    )
  }

  /**
   * Wer spricht – oder noch niemand.
   *
   * Ohne Person bleibt der Punkt als Platzhalter stehen: Art, Dauer und
   * Thema sind erfasst, nur der Name fehlt. Früher verschwand er hier ganz;
   * damit war eine Absage ein Griff, kostete aber alles andere gleich mit.
   * Weg ist er über «Programmpunkt entfernen» darunter.
   */
  const changeSpeaker = (talkId: string, speaker: TalkSpeaker | null) => {
    void guard(() => setTalkSpeaker(talkId, speaker), 'Ansprache konnte nicht geändert werden.')
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

  /*
   * Punkte, zu denen an diesem Sonntag nichts ansteht.
   *
   * Sie stehen nur beim Bearbeiten da – sonst wäre am Pult eine Überschrift
   * anzusagen, unter der nichts folgt. Wer etwas einträgt, holt sie damit
   * zurück in den Ablauf. Eine angefangene, aber leer gebliebene Zeile zählt
   * nicht mit: Sie gehört ins Formular, nicht in die Ansage.
   */
  const announced = sunday.entries.filter((entry) => entry.text.trim())
  const business = current.business.filter((entry) => !isBusinessEmpty(entry))

  const empty = new Set(
    [
      announced.length === 0 ? 'bekanntmachungen' : '',
      business.length === 0 ? 'angelegenheiten' : '',
    ].filter(Boolean),
  )

  const before: StepDef[] = [
    {
      key: 'vorsitz',
      title: 'Begrüssung der Besucher und Vorsitz',
      content: editing ? (
        <div className="no-print space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
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

          {/* Mehrzeilig: Begrüsst wird selten nur einer – Pfahlpräsidentschaft,
              Hoher Rat, Besuch aus einer anderen Gemeinde stehen am Pult
              untereinander und nicht in einer durchlaufenden Zeile. */}
          <Field label="Begrüssungen" htmlFor="lead-visitors">
            <textarea
              id="lead-visitors"
              className="input min-h-20 resize-y"
              value={current.visitors}
              onChange={(event) => change({ visitors: event.target.value })}
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
          {current.visitors.trim() && <p className="whitespace-pre-line">{current.visitors}</p>}
        </>
      ),
    },
    {
      key: 'bekanntmachungen',
      title: 'Bekanntmachungen',
      content: editing ? (
        <AnnouncementEditor
          entries={current.announcements}
          recurring={sunday.entries.filter(isSeriesEntry)}
          onChange={(next) => change({ announcements: next })}
        />
      ) : (
        <ol className={view.rows}>
          {announced.map((entry) => (
            <li key={entry.id}>
              <span className="font-medium whitespace-pre-line">{entry.text}</span>
              {entry.details?.trim() && (
                <span className="block text-[0.85em] whitespace-pre-line text-slate-500 dark:text-slate-400">
                  {entry.details}
                </span>
              )}
            </li>
          ))}
        </ol>
      ),
    },
    {
      key: 'anfang',
      title: 'Anfangslied und Anfangsgebet',
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
          <Line label={HYMN_SLOT_LABELS.opening} value={formatHymn(current.hymns.opening)} />
          <Line
            label={PRAYER_SLOT_LABELS.opening}
            value={prayerBySlot.get('opening')?.memberName ?? '–'}
          />
        </>
      ),
    },
    {
      key: 'angelegenheiten',
      title: 'Angelegenheiten der Gemeinde',
      content: editing ? (
        <BusinessEditor
          entries={current.business}
          onChange={(next) => change({ business: next })}
        />
      ) : (
        <BusinessList entries={business} rows={view.rows} />
      ),
    },
    {
      key: 'sakrament',
      title: 'Abendmahlslied und Abendmahl',
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
        <Line label={HYMN_SLOT_LABELS.sacrament} value={formatHymn(current.hymns.sacrament)} />
      ),
    },
  ].filter((step) => editing || !empty.has(step.key))

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
      content: (
        <>
          {!editing && <ProgramView entry={entry} performers={performers} />}

          {editing && (
            <div className="no-print space-y-2">
              {talk ? (
                <>
                  <MemberSearchSelect
                    value={talk.memberId || null}
                    onChange={(member) => changeSpeaker(talk.id, member ? { member } : null)}
                    freeText={talk.memberId ? '' : talk.memberName}
                    onFreeText={(name) => changeSpeaker(talk.id, name.trim() ? { name } : null)}
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
                  {/* Solange niemand dasteht, lässt sich der Punkt ganz
                      wegnehmen – mit einem Namen wäre das ein Fehlgriff. */}
                  {isTalkPlaceholder(talk) && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                      onClick={() =>
                        void guard(
                          () => deleteTalk(talk.id),
                          'Programmpunkt konnte nicht entfernt werden.',
                        )
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Programmpunkt entfernen
                    </button>
                  )}
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
                  onRemove={() => {
                    const before = current.musicalNumbers
                    change({
                      musicalNumbers: before.filter((n) => n.id !== number.id),
                    })
                    toast.undo('Musikeinlage entfernt.', () => change({ musicalNumbers: before }))
                  }}
                />
              ) : (
                <>
                  <MemberSearchSelect
                    value={null}
                    onChange={(member) => member && assignTalk(entry.slot ?? 1, { member })}
                    onFreeText={(name) => assignTalk(entry.slot ?? 1, { name })}
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
          <Line label={HYMN_SLOT_LABELS.closing} value={formatHymn(current.hymns.closing)} />
          <Line
            label={PRAYER_SLOT_LABELS.closing}
            value={prayerBySlot.get('closing')?.memberName ?? '–'}
          />
        </>
      ),
    },
  ]

  const steps = [...before, ...middle, ...after]
  // Nach dem letzten Programmpunkt stehen die Knöpfe zum Ergänzen.
  const toolsAfter = before.length + middle.length

  const toggleFullscreen = () => {
    const next = !fullscreen
    setFullscreen(next)

    if (next) {
      // Im Vollbild wird gelesen, nicht geschrieben: Was noch aussteht,
      // gehört vorher geschrieben.
      if (editing) {
        void draft.flush()
        setEditing(false)
      }
      void document.documentElement.requestFullscreen?.().catch(() => {})
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
  }

  const printSheet = () => {
    // Gedruckt wird der Ablauf, nicht das Formular: Beim Bearbeiten stünden
    // Eingabefelder auf dem Blatt, und was noch aussteht, gehört vorher
    // geschrieben.
    if (editing) {
      void draft.flush()
      setEditing(false)
    }
    setPrinting(true)
  }

  /* An einem Sonntag ohne Versammlung gibt es keinen Ablauf zu leiten. Das
     Blatt bliebe leer und liesse offen, ob es nur noch niemand erfasst hat –
     deshalb steht an seiner Stelle der Grund. */
  if (!sundayKind.meets) {
    return (
      <>
        <SectionHeader
          title="Ablauf"
          actions={
            <>
              <ResponsibleButton meeting={meeting} onClick={() => setResponsibleOpen(true)} />
              <button type="button" className="btn-secondary" onClick={() => setProgramOpen(true)}>
                <CalendarCog className="size-4" aria-hidden />
                Programm
              </button>
            </>
          }
        />

        <div className="card p-6 text-center">
          <CalendarOff className="mx-auto size-8 text-slate-300 dark:text-slate-600" aria-hidden />
          <h3 className="mt-3 text-base font-semibold">{sundayKind.label}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            An diesem Sonntag findet in der Gemeinde keine Versammlung statt – es braucht keine
            Leitung und keine Ansprachen.
            {sundayKind.automatic && ' Diese Angabe stammt aus dem Kalender und ist änderbar.'}
          </p>
          <button type="button" className="btn-secondary mt-4" onClick={() => setProgramOpen(true)}>
            <CalendarCog className="size-4" aria-hidden />
            Programm ändern
          </button>
        </div>

        <SundayProgramDialog
          open={programOpen}
          date={date}
          meeting={meeting}
          onClose={() => setProgramOpen(false)}
        />
        <SundayResponsibleDialog
          open={responsibleOpen}
          date={date}
          meeting={meeting}
          onClose={() => setResponsibleOpen(false)}
        />
      </>
    )
  }

  return (
    <>
      <SectionHeader
        title="Ablauf"
        className="no-print-sheet"
        actions={
          <>
            <ResponsibleButton meeting={meeting} onClick={() => setResponsibleOpen(true)} />
            <button type="button" className="btn-secondary" onClick={() => setProgramOpen(true)}>
              <CalendarCog className="size-4" aria-hidden />
              <span className="hidden sm:inline">Programm</span>
            </button>
            <button
              type="button"
              className={editing ? 'btn-primary' : 'btn-secondary'}
              onClick={() => {
                // Beim Verlassen nicht auf die Tippause warten: Was noch
                // aussteht, gehört sofort geschrieben.
                if (editing) void draft.flush()
                setEditing(!editing)
              }}
              aria-pressed={editing}
            >
              <Pencil className="size-4" aria-hidden />
              {editing ? 'Fertig' : 'Bearbeiten'}
            </button>
            {/* Am Pult liegt ein Blatt neben dem Gerät – für den Fall, dass
                der Akku leer ist, und für alle, die lieber Papier lesen. */}
            <button
              type="button"
              className="btn-secondary"
              onClick={printSheet}
              title="Den Ablauf auf einer A4-Seite drucken"
            >
              <Printer className="size-4" aria-hidden />
              <span className="hidden sm:inline">Drucken</span>
            </button>
            <select
              className="input w-auto py-1.5 text-sm"
              value={size}
              onChange={(event) => setSize(event.target.value as ViewSize)}
              aria-label="Grösse der Ansicht"
            >
              {(Object.keys(VIEWS) as ViewSize[]).map((value) => (
                <option key={value} value={value}>
                  {VIEWS[value].label}
                </option>
              ))}
            </select>
          </>
        }
      />

      {/* Ist der Sonntag keine gewöhnliche Abendmahlsversammlung, steht das
          über dem Blatt – am Pult wie beim Planen die erste Auskunft. */}
      {(sundayKind.kind !== 'regular' || sundayKind.adjusted) && (
        <div className="no-print mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <SundayProgramBadge program={sundayKind} />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {sundayProgramNote(sundayKind)}
          </span>
        </div>
      )}

      {draft.conflict && <ConflictNotice onDiscard={draft.reset} />}

      <article
        ref={sheet}
        className={cn(
          // `print-sheet` ist das Blatt selbst: Auf Papier fallen damit
          // Rahmen, Schatten und Innenabstand weg – den Rand setzt die
          // Seite (siehe `index.css`).
          'print-sheet',
          // Der Zeilenabstand fürs Papier ist enger: Ein Blatt wird näher
          // gelesen als ein Bildschirm am Pult. Beim Drucken gilt er schon
          // am Bildschirm, damit die Messung stimmt.
          printing ? 'w-[182mm] leading-[1.4]' : 'leading-relaxed',
          view.pad,
          view.text,
          // Platz für den Knopf oben rechts, damit er nichts überdeckt –
          // auf dem Papier steht dort kein Knopf.
          !printing && 'pr-14',
          // Entweder Blatt oder Vollbild – die Klassen für Position, Rahmen
          // und Ecken stehen bewusst in zwei Zweigen statt übereinander:
          // Zwei Utilities für dieselbe Eigenschaft entscheidet sonst die
          // Reihenfolge im Stylesheet, nicht die im Aufruf.
          //
          // Im Vollbild kommt oben und unten Luft dazu: Ohne Kopfzeile
          // beginnt der Bildschirmrand sonst unmittelbar am ersten Punkt,
          // und das liest sich am Pult eng.
          //
          // Quer gedreht wird daraus wieder wenig: Dort ist Höhe knapp, und
          // die Aussparung der Kamera liegt seitlich – deshalb `px-safe`.
          fullscreen
            ? 'pt-safe-14 pb-safe-10 px-safe fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-slate-950'
            : 'card relative',
        )}
      >
        {/* Vollbild – oben rechts im Blatt, wo er nichts verdeckt. Im
            Vollbild steht die Grössenwahl daneben: Wer am Pult liest, will
            sie dort verstellen können und nicht in der Kopfzeile, die
            gerade weg ist. */}
        <div className="no-print absolute top-3 right-3 z-10 flex items-center gap-2">
          {fullscreen && (
            <select
              className="input w-auto bg-white/90 py-1 text-sm dark:bg-slate-900/90"
              value={size}
              onChange={(event) => setSize(event.target.value as ViewSize)}
              aria-label="Grösse der Ansicht"
            >
              {(Object.keys(VIEWS) as ViewSize[]).map((value) => (
                <option key={value} value={value}>
                  {VIEWS[value].label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={toggleFullscreen}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? 'Vollbild beenden' : 'Vollbild'}
            title={fullscreen ? 'Vollbild beenden (Esc)' : 'Vollbild'}
          >
            {fullscreen ? (
              <Minimize2 className="size-5" aria-hidden />
            ) : (
              <Maximize2 className="size-5" aria-hidden />
            )}
          </button>
        </div>

        {/* Im Vollbild ist der Seitenkopf weg – und damit auch die Angabe,
            welche Versammlung an welchem Tag hier eigentlich abläuft. Am
            Pult ist beides die erste Zeile, die man sagt, also steht es
            hier oben.
            Auf Papier steht der Seitenkopf ebenso wenig da (`no-print-sheet`),
            deshalb erscheint dieser hier auch im Druck – dann als einzige
            Überschrift des Blattes. */}
        <header
          className={cn(
            'mx-auto mb-7 w-full max-w-3xl border-b border-slate-200 pb-4 dark:border-slate-800',
            !fullscreen && !printing && 'hidden print:block',
          )}
        >
          {/* «Abendmahlsversammlung» ist ein Wort und passt auf dem Handy
              nicht in eine Zeile – dann lieber getrennt als über den Rand
              hinaus. */}
          <h2
            className={cn(
              'font-semibold tracking-tight text-balance hyphens-auto break-words',
              view.heading,
            )}
          >
            {sundayKind.label}
          </h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{formatDateLong(date)}</p>
        </header>

        {/* Die Nummerierung ergibt sich aus der Liste: Ein zusätzlicher
            Programmpunkt verschiebt alles Folgende automatisch. */}
        <ol className={cn(view.steps, fullscreen && 'mx-auto w-full max-w-3xl')}>
          {steps.map((step, index) => (
            <Fragment key={step.key}>
              <Step number={index + 1} title={step.title} view={view}>
                {step.content}
              </Step>
              {editing && index + 1 === toolsAfter && (
                <li className={cn('no-print flex flex-wrap gap-2', view.indent)}>
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

        {/* Notizen stehen nur da, wenn welche erfasst sind – am Pult zählt,
            was gesagt wird, nicht die Überschrift darüber. */}
        {(editing || current.notes.trim()) && (
          <section
            className={cn(
              'mt-6 border-t border-slate-200 pt-5 dark:border-slate-800',
              fullscreen && 'mx-auto w-full max-w-3xl',
            )}
          >
            <h3 className={cn('font-semibold', view.title)}>Notizen</h3>
            {editing ? (
              <textarea
                className={cn('input no-print min-h-20 resize-y', view.body)}
                value={current.notes}
                onChange={(event) => change({ notes: event.target.value })}
                aria-label="Notizen zur Versammlung"
              />
            ) : (
              <p className={cn('whitespace-pre-wrap', view.body)}>{current.notes}</p>
            )}
          </section>
        )}
      </article>

      {draft.saving && (
        <p className="no-print mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          Wird gespeichert …
        </p>
      )}

      <SundayProgramDialog
        open={programOpen}
        date={date}
        meeting={meeting}
        onClose={() => setProgramOpen(false)}
      />
      <SundayResponsibleDialog
        open={responsibleOpen}
        date={date}
        meeting={meeting}
        onClose={() => setResponsibleOpen(false)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bausteine des Ablaufs                                               */
/* ------------------------------------------------------------------ */

function Step({
  number,
  title,
  view,
  children,
}: {
  number: number
  title: string
  view: ViewStyle
  children: ReactNode
}) {
  return (
    <li className={cn('flex', view.gap)}>
      <span
        className={cn(
          'tabular mt-0.5 grid shrink-0 place-items-center rounded-full bg-slate-100 font-semibold dark:bg-slate-800',
          view.badge,
        )}
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className={cn('font-semibold', view.title)}>{title}</h3>
        <div className={cn(view.body, view.rows)}>{children}</div>
      </div>
    </li>
  )
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

/**
 * Eine Zeile «Angabe: Wert».
 *
 * Fehlt der Wert, steht «noch offen» da – in Orange, damit es beim
 * Durchgehen vor der Versammlung auffällt. Geändert wird es dort, wo es
 * hingehört: über «Bearbeiten».
 */
function Line({ label, value }: { label: string; value: string }) {
  const missing = value === '–'
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-slate-500 dark:text-slate-400">{label}:</span>
      <span className={cn('font-medium', missing && 'text-amber-600 dark:text-amber-400')}>
        {missing ? 'noch offen' : value}
      </span>
    </p>
  )
}

function ProgramView({ entry, performers }: { entry: ProgramEntry; performers: string }) {
  return (
    <>
      <p className={cn('font-medium', !entry.title && 'text-amber-600 dark:text-amber-400')}>
        {entry.title || 'noch offen'}
      </p>
      {entry.detail && (
        <p className="text-[0.85em] text-slate-500 dark:text-slate-400">{entry.detail}</p>
      )}
      {performers && (
        <p className="text-[0.85em] text-slate-500 dark:text-slate-400">{performers}</p>
      )}
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

function BusinessList({ entries, rows }: { entries: BusinessEntry[]; rows: string }) {
  return (
    <ul className={rows}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="badge bg-slate-100 text-[0.8em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {BUSINESS_TYPE_LABELS[entry.type]}
          </span>{' '}
          <span className="font-medium">{businessLabel(entry)}</span>
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
  recurring,
  onChange,
}: {
  entries: AnnouncementEntry[]
  /** Errechnete Serien-Einträge – hier nur sichtbar, bearbeitet werden sie unter «Bekanntmachungen» */
  recurring: AnnouncementEntry[]
  onChange: (next: AnnouncementEntry[]) => void
}) {
  const toast = useToast()

  // Löschen ohne Rückfrage, aber mit Reue: «Rückgängig» stellt den Stand von
  // unmittelbar vor dem Löschen wieder her.
  const remove = (entry: AnnouncementEntry) => {
    const before = entries
    onChange(before.filter((e) => e.id !== entry.id))
    toast.undo('Bekanntmachung entfernt.', () => onChange(before))
  }

  return (
    <div className="no-print space-y-2">
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {/* Ein Feld, mehrzeilig – wie unter «Bekanntmachungen». */}
            <textarea
              className="input min-h-16 resize-y"
              value={entry.text}
              onChange={(event) =>
                onChange(replaceInList(entries, { ...entry, text: event.target.value }))
              }
              placeholder="Bekanntmachung"
              aria-label={`Bekanntmachung ${index + 1}`}
            />
          </div>
          <ListButtons
            index={index}
            length={entries.length}
            onMove={(delta) => onChange(moveInList(entries, index, delta))}
            onRemove={() => remove(entry)}
          />
        </div>
      ))}

      {recurring.map((entry) => (
        <div
          key={entry.id}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
        >
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Repeat className="size-3.5" aria-hidden />
            Wiederkehrend – zu ändern unter «Bekanntmachungen»
          </p>
          <p className="mt-0.5 whitespace-pre-line">{entry.text}</p>
          {entry.details?.trim() && (
            <p className="text-xs whitespace-pre-line text-slate-500 dark:text-slate-400">
              {entry.details}
            </p>
          )}
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
  const toast = useToast()

  // Löschen ohne Rückfrage, aber mit Reue: «Rückgängig» stellt den Stand von
  // unmittelbar vor dem Löschen wieder her.
  const remove = (entry: BusinessEntry) => {
    const before = entries
    onChange(before.filter((e) => e.id !== entry.id))
    toast.undo('Eintrag entfernt.', () => onChange(before))
  }

  return (
    <div className="no-print space-y-2">
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-start gap-2">
          <BusinessFields
            entry={entry}
            index={index}
            onChange={(next) => onChange(replaceInList(entries, next))}
          />
          <ListButtons
            index={index}
            length={entries.length}
            onMove={(delta) => onChange(moveInList(entries, index, delta))}
            onRemove={() => remove(entry)}
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
        placeholder="Weitere Mitwirkende"
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
