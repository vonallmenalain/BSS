import type { Timestamp } from 'firebase/firestore'

/* ------------------------------------------------------------------ */
/* Basis                                                               */
/* ------------------------------------------------------------------ */

/** Firestore-Zeitstempel, der beim Schreiben auch `serverTimestamp()` sein darf. */
export type TS = Timestamp

export interface WithId {
  id: string
}

/* ------------------------------------------------------------------ */
/* Benutzer & Rollen                                                   */
/* ------------------------------------------------------------------ */

/**
 * Rollen der App. `pending` erhält jeder neu registrierte Account, bis ihn
 * jemand aus der Bischofschaft freischaltet – so kann sich niemand selbst
 * Zugriff auf Personendaten verschaffen.
 *
 * Innerhalb der Bischofschaft beschreibt die Rolle die **Aufgabe**, nicht den
 * Umfang der Rechte: Bischof, beide Ratgeber und die Sekretäre arbeiten am
 * selben Datenbestand und sehen alles. Sie steuert damit vor allem, wer im
 * Programm der Abendmahlsversammlung als leitend erscheint.
 *
 * Daneben stehen die beiden AP-Rollen. Sie sind die Ausnahme von diesem
 * Grundsatz: Der Aktivitätenplan der Priestertumskollegien wird mit den
 * Beratern und der Jugendführung geteilt, und die haben in der Gemeinde
 * keine Aufgabe, die Einblick in Personendaten rechtfertigt. Sie sehen
 * deshalb **nur** den AP-Kalender – die einen mit, die anderen ohne
 * Schreibrecht.
 */
export type Role =
  | 'bishop'
  | 'counselor1'
  | 'counselor2'
  | 'executive_secretary'
  | 'secretary'
  /** Sammelrolle aus früheren Versionen – bleibt lesbar, wird nicht mehr vergeben. */
  | 'counselor'
  /** Nur der AP-Kalender, mit Schreibrecht */
  | 'ap_editor'
  /** Nur der AP-Kalender, ausschliesslich lesend */
  | 'ap_viewer'
  | 'pending'

export const ROLE_LABELS: Record<Role, string> = {
  bishop: 'Bischof',
  counselor1: '1. Ratgeber',
  counselor2: '2. Ratgeber',
  executive_secretary: 'Exekutivsekretär',
  secretary: 'Sekretär',
  counselor: 'Ratgeber',
  ap_editor: 'AP-Kalender · bearbeiten',
  ap_viewer: 'AP-Kalender · nur ansehen',
  pending: 'Wartet auf Freigabe',
}

/** Rollen, die in der Benutzerverwaltung zur Auswahl stehen (in dieser Reihenfolge). */
export const ASSIGNABLE_ROLES: Role[] = [
  'bishop',
  'counselor1',
  'counselor2',
  'executive_secretary',
  'secretary',
]

/**
 * Rollen mit vollem Zugriff auf alle Daten.
 *
 * Bewusst identisch mit «freigeschaltet»: In einer Bischofschaft arbeiten
 * alle am selben Bestand, deshalb gibt es keine Abstufung mehr. Einzig
 * `pending` sieht nichts. Dieselbe Liste steht in `firestore.rules` –
 * beide müssen zusammen geändert werden.
 */
export const FULL_ACCESS_ROLES: Role[] = [
  'bishop',
  'counselor1',
  'counselor2',
  'executive_secretary',
  'secretary',
  'counselor',
]

/** Rollen der Bischofschaft im engeren Sinn – leiten die Abendmahlsversammlung. */
export const BISHOPRIC_ROLES: Role[] = ['bishop', 'counselor1', 'counselor2', 'counselor']

/** Rollen, die ausser dem AP-Kalender nichts sehen. */
export const AP_ONLY_ROLES: Role[] = ['ap_editor', 'ap_viewer']

/** Wer den AP-Kalender überhaupt zu sehen bekommt – Vollzugriff eingeschlossen. */
export const AP_ACCESS_ROLES: Role[] = [...FULL_ACCESS_ROLES, ...AP_ONLY_ROLES]

/** Wer im AP-Kalender auch schreiben darf. Steht ebenso in `firestore.rules`. */
export const AP_WRITE_ROLES: Role[] = [...FULL_ACCESS_ROLES, 'ap_editor']

/**
 * Was beim Freischalten zur Wahl steht.
 *
 * Die Rolle beantwortet zwei verschiedene Fragen zugleich – «welche Aufgabe?»
 * und «wie viel darf diese Person sehen?». Beim Freischalten zählt nur die
 * zweite; welche Aufgabe jemand in der Bischofschaft hat, lässt sich danach
 * jederzeit umstellen, ohne dass sich am Zugriff etwas ändert.
 */
export type AccessLevel = 'full' | 'ap_write' | 'ap_read'

export const ACCESS_LEVELS: { value: AccessLevel; role: Role; label: string; hint: string }[] = [
  {
    value: 'full',
    role: 'secretary',
    label: 'Vollzugriff',
    hint: 'Sieht und bearbeitet alles – für die Bischofschaft und die Sekretäre.',
  },
  {
    value: 'ap_write',
    role: 'ap_editor',
    label: 'Nur AP-Kalender · bearbeiten',
    hint: 'Sieht ausschliesslich «Aktivitäten AP’s» und darf Einträge ändern.',
  },
  {
    value: 'ap_read',
    role: 'ap_viewer',
    label: 'Nur AP-Kalender · ansehen',
    hint: 'Sieht ausschliesslich «Aktivitäten AP’s», ohne etwas ändern zu können.',
  },
]

export interface AppUser extends WithId {
  /** entspricht der Firebase-Auth-UID */
  email: string
  displayName: string
  role: Role
  /** Kürzel für Avatare und kompakte Listen, z. B. «AB» */
  initials?: string
  /** optionale Verknüpfung zum Mitgliederdatensatz */
  memberId?: string | null
  /** Farbe für Zuweisungs-Chips (Tailwind-Token-Name, siehe constants.ts) */
  color?: string
  active: boolean
  lastLoginAt?: TS | null
  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Sitzungen                                                           */
/* ------------------------------------------------------------------ */

export type MeetingStatus = 'planned' | 'running' | 'closed'

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  planned: 'Geplant',
  running: 'Läuft',
  closed: 'Abgeschlossen',
}

export interface Meeting extends WithId {
  /** Datum und Startzeit der Sitzung */
  date: TS
  title: string
  location?: string
  status: MeetingStatus
  /** UIDs der anwesenden Personen */
  attendees: string[]
  /**
   * Wer betet, wer den geistigen Gedanken hält.
   *
   * Gespeichert wird der ausgeschriebene Name und kein Verweis: Ein Protokoll
   * von vor zwei Jahren soll auch dann lesbar bleiben, wenn die Person längst
   * kein Konto mehr hat. Aus früheren Fassungen steht hier gelegentlich ein
   * freier Text – der bleibt stehen, wie er ist.
   */
  openingPrayer?: string
  closingPrayer?: string
  spiritualThought?: string
  /** Zeitpunkt, an dem die Sitzung gestartet bzw. abgeschlossen wurde */
  startedAt?: TS | null
  closedAt?: TS | null
  /**
   * Woher der Eintrag stammt, wenn er nicht in der App entstanden ist.
   *
   * Gesetzt wird das nur beim einmaligen Übernehmen der bisherigen
   * Protokolle (`minutes`). Es macht den Import wiederholbar: Ein zweiter
   * Anlauf nach einer Korrektur räumt genau das weg, was er selbst
   * angelegt hat, und lässt alles Erfasste stehen.
   */
  importedFrom?: string | null
  createdAt?: TS
  updatedAt?: TS
  createdBy?: string
}

/* ------------------------------------------------------------------ */
/* Traktanden / Pendenzen                                              */
/* ------------------------------------------------------------------ */

/**
 * Traktandum und Pendenz sind derselbe Datensatz – aber nicht dasselbe Wort.
 *
 * Was neu auf die Liste kommt, ist ein **Traktandum**. Übersteht es eine
 * Sitzung, ohne erledigt zu werden, wird es zur **Pendenz** und bleibt es
 * auch: In der nächsten Sitzung steht es unter den Pendenzen und nicht unter
 * den neuen Traktanden. Der Weg führt nur in diese eine Richtung – ein
 * Traktandum, das einmal liegengeblieben ist, wird nicht wieder neu.
 */
export type ItemKind = 'traktandum' | 'pendenz'

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  traktandum: 'Traktandum',
  pendenz: 'Pendenz',
}

/** Mehrzahl – für Überschriften und Zählungen. */
export const ITEM_KIND_PLURAL: Record<ItemKind, string> = {
  traktandum: 'Traktanden',
  pendenz: 'Pendenzen',
}

/**
 * Drei Zustände, mehr nicht.
 *
 * `new` ist alles, was vor dem Start der Sitzung erfasst wurde; mit dem Start
 * wird daraus `pending`. `pending` heisst schlicht «noch nicht abgehakt» –
 * gleich, ob es sich um ein Traktandum oder eine Pendenz handelt. `done` ist
 * das Ende.
 *
 * Frühere Fassungen kannten zusätzlich «Offen», «In Arbeit»,
 * «Zurückgestellt» und «Verworfen». Vier Abstufungen für dieselbe Aussage
 * halfen niemandem: Am Sitzungstisch zählt einzig, ob ein Punkt erledigt ist.
 * Alte Werte lesen sich deshalb als `pending` bzw. `done` (siehe
 * `toItemStatus`).
 */
export type ItemStatus = 'new' | 'pending' | 'done'

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  new: 'Neu',
  pending: 'Pendent',
  done: 'Erledigt',
}

/** Status, die als «noch zu tun» gelten und in der nächsten Sitzung auftauchen. */
export const OPEN_STATUSES: ItemStatus[] = ['new', 'pending']

/**
 * Dasselbe für Firestore-Abfragen – einschliesslich der Werte früherer
 * Fassungen.
 *
 * Eine `in`-Abfrage vergleicht, was in der Datenbank steht, und dort stehen
 * noch Jahre an «open», «in_progress» und «deferred». Ohne sie verschwänden
 * genau die Pendenzen aus der Liste, um die es geht. Zurückgeführt wird erst
 * beim Lesen, nicht durch eine Wanderung über den ganzen Bestand.
 */
export const OPEN_STATUS_QUERY: string[] = [...OPEN_STATUSES, 'open', 'in_progress', 'deferred']

/** Was beim Start der Sitzung von «Neu» auf «Pendent» wechselt. */
export const NEW_STATUS_QUERY: string[] = ['new', 'open', 'in_progress', 'deferred']

/** Was in Firestore steht, auf die drei Zustände zurückführen. */
export function toItemStatus(value: unknown): ItemStatus {
  if (value === 'new') return 'new'
  // «Verworfen» kannte nur, wer den Punkt nicht mehr sehen wollte – er ist
  // vom Tisch, und das heisst hier erledigt.
  if (value === 'done' || value === 'cancelled') return 'done'
  return 'pending'
}

/**
 * Traktandum oder Pendenz.
 *
 * Steht das Feld noch nicht am Datensatz (alles, was vor dieser Unterscheidung
 * erfasst wurde), wird es aus der Vorgeschichte abgeleitet: Wer schon einmal
 * in einer anderen Sitzung stand, ist eine Pendenz.
 */
export function toItemKind(item: {
  kind?: unknown
  meetingId?: string | null
  firstMeetingId?: string | null
}): ItemKind {
  if (item.kind === 'pendenz') return 'pendenz'
  if (item.kind === 'traktandum') return 'traktandum'
  const first = item.firstMeetingId ?? null
  return first !== null && first !== (item.meetingId ?? null) ? 'pendenz' : 'traktandum'
}

export type Priority = 'low' | 'normal' | 'high'

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Tief',
  normal: 'Normal',
  high: 'Hoch',
}

export interface HistoryEntry {
  id: string
  /** z. B. «Status auf Erledigt gesetzt» */
  action: string
  authorId: string
  authorName: string
  createdAt: string
}

export interface AgendaItem extends WithId {
  title: string
  description?: string

  /** Sitzung, in der das Traktandum behandelt wird (null = Sammelkorb / später) */
  meetingId: string | null
  /** Position innerhalb der Sitzung – bestimmt die Reihenfolge im Sitzungsmodus */
  order: number

  /**
   * Traktandum oder Pendenz. Fehlt das Feld (Altbestand), leitet
   * `toItemKind()` es aus `firstMeetingId` ab.
   */
  kind: ItemKind
  status: ItemStatus
  priority: Priority

  /** UIDs der zuständigen Personen (Mehrfachzuweisung möglich) */
  assignees: string[]
  /**
   * Mitglieder, die im Text mit «@» eingesetzt wurden.
   *
   * Kein Feld im Formular mehr, sondern die Spur der Erwähnung: Sie hält
   * fest, wer gemeint ist, und macht den Namen im Text anklickbar. Ohne sie
   * stünde dort blosser Text, und der Weg zur Person wäre wieder die Suche.
   */
  memberRefs: string[]

  /** Termin, bis wann die Pendenz erledigt sein soll */
  dueDate: TS | null

  /*
   * Eine eigene Notizliste je Traktandum gab es einmal; sie ist weggefallen.
   * Was besprochen wurde, gehört in die Beschreibung – zwei Textfelder
   * nebeneinander beantworten dieselbe Frage zweimal, und in der Sitzung
   * schreibt niemand zweimal. Alte Einträge bleiben in Firestore stehen,
   * gelesen wird das Feld nicht mehr.
   */
  history: HistoryEntry[]

  /** Wie oft wurde dieses Traktandum schon vertagt? Macht Dauerbrenner sichtbar. */
  deferCount: number
  /** Sitzung, in der es ursprünglich zum ersten Mal traktandiert war */
  firstMeetingId?: string | null

  /** Aus einem einmaligen Import übernommen – siehe `Meeting.importedFrom` */
  importedFrom?: string | null

  createdAt?: TS
  updatedAt?: TS
  createdBy?: string
  completedAt?: TS | null
  completedBy?: string | null
}

/* ------------------------------------------------------------------ */
/* Mitglieder                                                          */
/* ------------------------------------------------------------------ */

export type Gender = 'm' | 'f' | 'unknown'

export const GENDER_LABELS: Record<Gender, string> = {
  m: 'Männlich',
  f: 'Weiblich',
  unknown: 'Unbekannt',
}

/**
 * Zwei Zustände, mehr nicht.
 *
 * Frühere Fassungen kannten «weniger aktiv» und «weggezogen». Beides klang
 * genauer, half aber niemandem: Für jede Frage, die die App stellt – wer
 * kommt für eine Ansprache in Frage, wer für ein Gebet –, zählt nur, ob
 * jemand da ist. Alte Werte lesen sich deshalb als «inaktiv».
 */
export type MemberStatus = 'active' | 'inactive'

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
}

/** Was in Firestore steht, auf die zwei Zustände zurückführen. */
export function toMemberStatus(value: unknown): MemberStatus {
  return value === 'active' ? 'active' : 'inactive'
}

export interface Member extends WithId {
  lastName: string
  firstName: string
  /** «Nachname, Vorname» – kleingeschrieben, für Sortierung und Suche */
  searchName?: string

  gender: Gender
  birthDate: TS | null

  email?: string
  phone?: string
  mobile?: string
  street?: string
  zip?: string
  city?: string

  status: MemberStatus
  /** Darf für Ansprachen angefragt werden? */
  availableForTalks: boolean

  /** Freie Notiz, z. B. Kontaktperson, Besonderheiten, Betreuungshinweise */
  notes?: string
  /**
   * Betreuung (aus dem LCR importierbar):
   * `ministeringPartnerIds` sind die Personen, mit denen zusammen betreut
   * wird, `ministeringAssignedIds` die Personen, die betreut werden.
   */
  ministeringPartnerIds?: string[]
  ministeringAssignedIds?: string[]

  /** Denormalisiert aus der Ansprachen-Sammlung – ermöglicht Sortierung ohne Join */
  lastTalkDate: TS | null
  talkCount: number

  /** Frei vergebbare Schlagworte (z. B. «Neubekehrt», «Rückkehrer») */
  tags: string[]

  /**
   * Stabile ID aus der importierten Datei (z. B. Mitgliedsnummer aus LCR).
   * Sie erlaubt es, beim Re-Import bestehende Datensätze zu aktualisieren,
   * statt Duplikate anzulegen.
   */
  externalId?: string | null
  /** Zeitpunkt des letzten Imports, der diesen Datensatz berührt hat */
  importedAt?: TS | null

  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Ansprachen                                                          */
/* ------------------------------------------------------------------ */

export type TalkStatus = 'planned' | 'asked' | 'confirmed' | 'declined' | 'held' | 'cancelled'

export const TALK_STATUS_LABELS: Record<TalkStatus, string> = {
  planned: 'Vorgesehen',
  asked: 'Angefragt',
  confirmed: 'Zugesagt',
  declined: 'Abgesagt',
  held: 'Gehalten',
  cancelled: 'Gestrichen',
}

/** Status, bei denen der Platz im Programm noch belegt ist. */
export const ACTIVE_TALK_STATUSES: TalkStatus[] = ['planned', 'asked', 'confirmed']

/**
 * Ein Programmpunkt kann eine reguläre Ansprache oder ein Zeugnis sein.
 * Beides wird gleich verwaltet – nur die Beschriftung im Ablauf ändert sich.
 */
export type TalkKind = 'talk' | 'testimony'

export const TALK_KIND_LABELS: Record<TalkKind, string> = {
  talk: 'Ansprache',
  testimony: 'Zeugnis',
}

export interface Talk extends WithId {
  /**
   * Das Mitglied, das spricht – **leer**, wenn der Name von Hand erfasst wurde.
   *
   * Nicht jeder Programmpunkt gehört zu jemandem aus der Mitgliederliste: ein
   * besuchender Hoher Rat, die Missionare, «Zeugnisse der neuen Ältesten».
   * Solche Einträge belegen ihren Platz wie jeder andere, zählen aber nicht in
   * die Auswertung «wer war lange nicht dran» – es gibt niemanden, bei dem sie
   * zu vermerken wären.
   */
  memberId: string
  /**
   * Denormalisiert, damit Listen ohne zusätzliche Abfrage darstellbar sind.
   * Ohne Mitglied steht hier der von Hand erfasste Text.
   */
  memberName: string

  /** Datum der Abendmahlsversammlung */
  date: TS
  /** Fehlt das Feld (Altbestand), gilt «Ansprache». */
  kind?: TalkKind
  topic?: string
  /** Geplante Redezeit in Minuten */
  durationMinutes?: number
  /** Position im Programm (1 = erste Ansprache) */
  slot: number

  status: TalkStatus
  /** Wer hat angefragt? */
  askedById?: string | null
  askedAt?: TS | null
  notes?: string

  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Berufungen                                                          */
/* ------------------------------------------------------------------ */

export type CallingStatus =
  'proposed' | 'approved' | 'extended' | 'sustained' | 'set_apart' | 'released' | 'declined'

export const CALLING_STATUS_LABELS: Record<CallingStatus, string> = {
  proposed: 'Vorgeschlagen',
  approved: 'Genehmigt',
  extended: 'Berufung ausgesprochen',
  sustained: 'Bestätigt',
  set_apart: 'Eingesetzt',
  released: 'Entlassen',
  declined: 'Abgelehnt',
}

/** Status einer laufenden bzw. in Bearbeitung stehenden Berufung. */
export const ACTIVE_CALLING_STATUSES: CallingStatus[] = [
  'proposed',
  'approved',
  'extended',
  'sustained',
  'set_apart',
]

export type Organization =
  | 'bishopric'
  | 'elders_quorum'
  | 'relief_society'
  | 'young_women'
  | 'young_men'
  | 'primary'
  | 'sunday_school'
  | 'music'
  | 'temple_family_history'
  | 'missionary'
  | 'welfare'
  | 'ward'
  | 'other'

export const ORGANIZATION_LABELS: Record<Organization, string> = {
  bishopric: 'Bischofschaft',
  elders_quorum: 'Ältestenkollegium',
  relief_society: 'Frauenhilfsvereinigung',
  young_women: 'Junge Damen',
  young_men: 'Junge Männer',
  primary: 'PV (Primarvereinigung)',
  sunday_school: 'Sonntagsschule',
  music: 'Musik',
  temple_family_history: 'Tempel & Familienforschung',
  missionary: 'Missionsarbeit',
  welfare: 'Wohlfahrt und Eigenständigkeit',
  ward: 'Gemeinde (allgemein)',
  other: 'Übrige',
}

export interface Calling extends WithId {
  memberId: string
  memberName: string

  position: string
  organization: Organization
  status: CallingStatus

  /** Wichtige Meilensteine im Berufungsprozess */
  proposedDate: TS | null
  extendedDate: TS | null
  sustainedDate: TS | null
  setApartDate: TS | null
  releasedDate: TS | null

  /** Wer spricht die Berufung aus / setzt ein? */
  responsibleId?: string | null
  notes?: string

  /**
   * Berufung ausserhalb der eigenen Einheit (Pfahl, Seminar, Institut).
   * Sie zählt für «hat eine Berufung», erscheint aber nicht im
   * Organisationsplan der Gemeinde.
   */
  outOfUnit?: boolean
  /** Im LCR als «Benutzerdefinierte Berufung» angelegt */
  custom?: boolean
  /**
   * Aus der Berufungshistorie übernommen – ein abgeschlossener Abschnitt.
   *
   * Das Kennzeichen hält den LCR-Abgleich von diesen Einträgen fern. Ohne
   * es träfe er beim nächsten Import unter Umständen den alten statt den
   * laufenden Datensatz, weckte ihn wieder auf und überschriebe damit ein
   * Stück Vergangenheit. Wer eine Aufgabe erneut erhält, bekommt einen
   * neuen Eintrag – der frühere bleibt, wie er war.
   */
  history?: boolean
  /** Untergruppe innerhalb der Organisation, z. B. «Lehrkräfte» */
  group?: string
  /**
   * Stelle in der Liste des LCR – Präsident, Ratgeber, dann die übrigen.
   *
   * Fehlt das Feld (von Hand erfasst oder aus einem älteren Import), wird
   * die Berufung hinten einsortiert und dort nach Bezeichnung geordnet.
   */
  order?: number

  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Einstellungen                                                       */
/* ------------------------------------------------------------------ */

export interface AppSettings {
  wardName: string
  /** Standard-Wochentag der Sitzung: 0 = Sonntag … 6 = Samstag */
  meetingWeekday: number
  /** Standard-Startzeit «HH:mm» */
  meetingTime: string
  meetingLocation: string
  meetingTitle: string
  /** Wochentag der Abendmahlsversammlung (für die Ansprachenplanung) */
  sacramentWeekday: number
  /** Startzeit der Abendmahlsversammlung «HH:mm» */
  sacramentTime: string
  /**
   * Anzahl Ansprachen pro Abendmahlsversammlung – der Normalfall.
   * Für einen einzelnen Sonntag lässt sich der Wert übersteuern
   * (siehe `SacramentMeeting.talkSlots`).
   */
  talksPerSunday: number
  /** Ab wie vielen Monaten ohne Ansprache gilt jemand als «lange nicht dran»? */
  talkGapMonths: number
  /**
   * Ab welchem Alter kommt jemand für eine Ansprache in Frage?
   *
   * Die Mitgliederliste enthält die ganze Gemeinde, Kinder eingeschlossen.
   * Ohne diese Grenze stünden sie in der Vorschlagsliste zuoberst – sie
   * haben ja noch nie gesprochen.
   */
  talkMinAge: number
  /** Ab wie vielen Monaten ohne Gebet gilt jemand als «lange nicht dran»? */
  prayerGapMonths: number
  /**
   * Personen ohne Konto, die eine Abendmahlsversammlung präsidieren oder
   * leiten können.
   *
   * Präsidieren tut nicht immer die Bischofschaft: Ist Besuch aus der
   * Pfahlführung da, präsidiert er. Solcher Besuch kommt wieder – deshalb
   * steht die Liste in den Einstellungen und nicht am einzelnen Sonntag; ein
   * Name wird einmal erfasst und ist danach an jedem Sonntag wählbar.
   */
  extraLeaders: string[]
  updatedAt?: TS
}

export const DEFAULT_SETTINGS: AppSettings = {
  wardName: 'Gemeinde',
  meetingWeekday: 3, // Mittwoch
  meetingTime: '19:30',
  meetingLocation: 'Bischofsbüro',
  meetingTitle: 'Bischofschaftssitzung',
  sacramentWeekday: 0, // Sonntag
  sacramentTime: '10:00',
  talksPerSunday: 3,
  talkGapMonths: 18,
  talkMinAge: 12,
  prayerGapMonths: 6,
  extraLeaders: [],
}

/* ------------------------------------------------------------------ */
/* Abendmahlsversammlung                                               */
/* ------------------------------------------------------------------ */

/**
 * Was an einem Sonntag stattfindet.
 *
 * Nicht jeder Sonntag ist eine gewöhnliche Abendmahlsversammlung, und die
 * Abweichungen haben Folgen für die Planung: An einer Zeugnisversammlung
 * werden keine Ansprachen vergeben, an einer Konferenz findet in der
 * Gemeinde überhaupt nichts statt – dann braucht es auch keine Leitung.
 */
export type SacramentKind =
  | 'regular'
  | 'fast_testimony'
  /** Darbietung der Kinder in der Abendmahlsversammlung (DKA) */
  | 'primary_program'
  /** Sonntag der Jungen Alleinstehenden Erwachsenen */
  | 'ysa'
  | 'special'
  | 'stake_conference'
  | 'general_conference'

export interface SacramentKindInfo {
  value: SacramentKind
  label: string
  /** Findet in der Gemeinde eine Versammlung statt? */
  meets: boolean
  /** Werden für diesen Sonntag Ansprachen eingeplant? */
  plansTalks: boolean
  /** Ein Satz, der die Folgen benennt – er steht in der Auswahl darunter. */
  hint: string
}

/**
 * Die Arten in der Reihenfolge, in der sie zur Wahl stehen: zuerst die
 * Sonntage mit Versammlung, danach die beiden ohne.
 */
export const SACRAMENT_KINDS: SacramentKindInfo[] = [
  {
    value: 'regular',
    label: 'Abendmahlsversammlung',
    meets: true,
    plansTalks: true,
    hint: 'Der Normalfall: Leitung und Ansprachen wie gewohnt.',
  },
  {
    value: 'fast_testimony',
    label: 'Fast- und Zeugnisversammlung',
    meets: true,
    plansTalks: false,
    hint: 'Es braucht eine Leitung, aber keine Ansprachen.',
  },
  {
    value: 'primary_program',
    label: 'Darbietung der Kinder (DKA)',
    meets: true,
    plansTalks: false,
    hint: 'Die Kinder gestalten die Versammlung – Leitung ja, Ansprachen nein.',
  },
  {
    value: 'ysa',
    label: 'JAE-Sonntag',
    meets: true,
    plansTalks: false,
    hint: 'Es braucht eine Leitung, aber keine Ansprachen aus der Gemeinde.',
  },
  {
    value: 'special',
    label: 'Besondere Versammlung',
    meets: true,
    plansTalks: true,
    hint: 'Alles Übrige – was daran anders ist, sagen die beiden Haken.',
  },
  {
    value: 'stake_conference',
    label: 'Pfahlkonferenz',
    meets: false,
    plansTalks: false,
    hint: 'Keine Versammlung in der Gemeinde – keine Leitung, keine Ansprachen.',
  },
  {
    value: 'general_conference',
    label: 'Generalkonferenz',
    meets: false,
    plansTalks: false,
    hint: 'Keine Versammlung in der Gemeinde – keine Leitung, keine Ansprachen.',
  },
]

export const SACRAMENT_KIND_INFO = Object.fromEntries(
  SACRAMENT_KINDS.map((entry) => [entry.value, entry]),
) as Record<SacramentKind, SacramentKindInfo>

export const SACRAMENT_KIND_LABELS = Object.fromEntries(
  SACRAMENT_KINDS.map((entry) => [entry.value, entry.label]),
) as Record<SacramentKind, string>

/** Die vier festen Liedplätze einer Abendmahlsversammlung. */
export type HymnSlot = 'opening' | 'sacrament' | 'intermediate' | 'closing'

export const HYMN_SLOTS: HymnSlot[] = ['opening', 'sacrament', 'intermediate', 'closing']

export const HYMN_SLOT_LABELS: Record<HymnSlot, string> = {
  opening: 'Anfangslied',
  sacrament: 'Abendmahlslied',
  intermediate: 'Zwischenlied',
  closing: 'Schlusslied',
}

/** Das Zwischenlied ist optional – die übrigen drei gehören zu jeder Versammlung. */
export const OPTIONAL_HYMN_SLOTS: HymnSlot[] = ['intermediate']

export interface HymnChoice {
  /** Liednummer; `null`, solange nichts festgelegt ist */
  number: number | null
  /**
   * Wie das Lied angeschrieben wird: «6», «18a», «PV 6».
   *
   * Fehlt das Feld, gilt die Nummer aus dem Gesangbuch – so bleiben
   * Programme aus der Zeit vor dem PV-Liederbuch unverändert lesbar.
   */
  code?: string
  /**
   * Titel des Liedes. Wird aus der importierten Liederliste ergänzt und
   * mitgespeichert, damit ein altes Programm auch dann lesbar bleibt,
   * wenn die Liste später ersetzt wird.
   */
  title: string
}

export interface MusicalNumber {
  id: string
  /** Titel des Vortrags */
  title: string
  /** Mitglieder, die vortragen */
  memberIds: string[]
  /** Freitext für Gäste, Gruppen oder Instrumente */
  performers?: string
  notes?: string
}

export interface AnnouncementEntry {
  id: string
  text: string
  /** Zusatz für die Person am Pult: Wortlaut, Datum, Ort … */
  details?: string
  /**
   * Die Serie, aus der dieser Eintrag stammt.
   *
   * Nur gesetzt, wenn eine wiederkehrende Bekanntmachung für diesen Sonntag
   * von Hand angepasst wurde: Dann steht sie ab jetzt als eigener Eintrag im
   * Programm und folgt der Serie nicht mehr. Errechnete Einträge tragen das
   * Feld ebenfalls, werden aber gar nicht erst gespeichert.
   */
  seriesId?: string | null
}

/* ------------------------------------------------------------------ */
/* Wiederkehrende Bekanntmachungen                                     */
/* ------------------------------------------------------------------ */

/**
 * Wie oft eine Serie fällig ist.
 *
 * `weekly` meint jede Abendmahlsversammlung, `monthly` bestimmte Sonntage
 * im Monat – «jeden 3. Sonntag» ist der Fall, für den es diese Serien gibt.
 */
export type SeriesRhythm = 'weekly' | 'monthly'

export const SERIES_RHYTHM_LABELS: Record<SeriesRhythm, string> = {
  weekly: 'Jeden Sonntag',
  monthly: 'Bestimmte Sonntage im Monat',
}

/** Auswahl für «welcher Sonntag im Monat» – `-1` ist der letzte. */
export const SERIES_WEEK_LABELS: [number, string][] = [
  [1, '1. Sonntag'],
  [2, '2. Sonntag'],
  [3, '3. Sonntag'],
  [4, '4. Sonntag'],
  [5, '5. Sonntag'],
  [-1, 'Letzter Sonntag'],
]

/**
 * Woher der Text einer Serie kommt.
 *
 * `manual` ist der Normalfall: Was erfasst wurde, wird vorgelesen.
 * `cleaning` füllt die Platzhalter aus dem Putzplan – das dankende und
 * ankündigende «wer putzt diese Woche» ändert sich schliesslich jede Woche,
 * die Serie selbst aber nie.
 */
export type SeriesSource = 'manual' | 'cleaning'

/**
 * Eine wiederkehrende Bekanntmachung.
 *
 * Sie wird **nicht** in die einzelnen Sonntage hineingeschrieben, sondern
 * bei jedem Aufruf dazugerechnet. Das ist der ganze Unterschied zur
 * gewöhnlichen Bekanntmachung, und er entscheidet über alles Weitere: Wer
 * den Wortlaut ändert, ändert ihn für jeden künftigen Sonntag; wer die
 * Serie beendet, räumt keine Vergangenheit weg; und ein Sonntag, den
 * niemand je geöffnet hat, hat die Bekanntmachung trotzdem.
 *
 * Ausnahmen sind zwei Listen: `skipDates` streicht einzelne Sonntage, und
 * `endDate` beendet die Serie. Beides entsteht beim Löschen – die Wahl
 * zwischen «nur dieser Sonntag» und «dieser und alle künftigen».
 */
export interface AnnouncementSeries extends WithId {
  text: string
  details?: string
  rhythm: SeriesRhythm
  /** Bei `monthly`: welche Sonntage im Monat (1–5, `-1` = letzter) */
  weeks: number[]
  /** Ab wann die Serie gilt, «yyyy-MM-dd» */
  startDate: string
  /** Bis wann – `null` heisst offen */
  endDate?: string | null
  /** Einzeln gestrichene Sonntage, «yyyy-MM-dd» */
  skipDates: string[]
  /** Fehlt das Feld (Altbestand), gilt «manual». */
  source?: SeriesSource
  createdById?: string | null
  createdAt?: TS
  updatedAt?: TS
}

export type BusinessType =
  'sustaining' | 'release' | 'ordination' | 'confirmation' | 'baby_blessing' | 'welcome' | 'other'

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  sustaining: 'Bestätigung',
  release: 'Entlassung',
  ordination: 'Ordinierung (Aaronisches Priestertum)',
  confirmation: 'Konfirmierung',
  baby_blessing: 'Namensgebung und Segnung',
  welcome: 'Begrüssung neuer Mitglieder',
  other: 'Übriges',
}

export interface BusinessEntry {
  id: string
  type: BusinessType
  /** z. B. «Peter Meier – Lehrer in der Sonntagsschule» */
  text: string
  memberIds: string[]
  /** Verknüpfte Berufung, falls aus dem Bereich «Berufungen» übernommen */
  callingId?: string | null
}

/**
 * Programm einer einzelnen Abendmahlsversammlung.
 *
 * Es gibt genau ein Dokument pro Sonntag; die Dokument-ID ist das Datum
 * («2026-08-09»). Damit kann jeder Bereich – Bekanntmachungen, Musik,
 * Gebet – unabhängig schreiben, ohne dass Dubletten entstehen.
 *
 * Ansprachen und Zeugnisse liegen bewusst **nicht** hier, sondern in der
 * Sammlung `talks`: Sie haben einen eigenen Lebenszyklus (angefragt,
 * zugesagt, gehalten) und treiben die Auswertung «wer war lange nicht dran».
 */
export interface SacramentMeeting extends WithId {
  date: TS
  /**
   * Was an diesem Sonntag stattfindet.
   *
   * Fehlt die Angabe oder steht sie auf `null`, entscheidet die Regel:
   * am ersten Sonntag im Monat die Fast- und Zeugnisversammlung, im April
   * und im Oktober an diesem Tag die Generalkonferenz, sonst die
   * gewöhnliche Abendmahlsversammlung (siehe `lib/sunday`). So ist ein von
   * Hand festgelegter Sonntag jederzeit wieder auf «automatisch»
   * zurückzustellen.
   */
  kind?: SacramentKind | null
  /**
   * Ausnahmen zur Art – `null` bzw. fehlend folgt der Art.
   *
   * Damit lässt sich ein Einzelfall abbilden, für den es keine eigene Art
   * braucht: eine Pfahlkonferenz, die ausnahmsweise in der Gemeinde
   * stattfindet, oder eine besondere Versammlung ohne Ansprachen.
   */
  meets?: boolean | null
  plansTalks?: boolean | null
  /** Wer präsidiert bzw. leitet (UID aus `users`) */
  presidingId?: string | null
  conductingId?: string | null
  /**
   * Dasselbe für Personen ohne Konto – Pfahlpräsidentschaft, Hoher Rat, ein
   * Ratgeber, der die App nicht benutzt.
   *
   * Gespeichert wird der ausgeschriebene Name und kein Verweis: Ein Programm
   * von vor zwei Jahren soll auch dann lesbar bleiben, wenn die Person längst
   * aus der Auswahl genommen wurde – wie beim Liedtitel.
   */
  presidingName?: string | null
  conductingName?: string | null
  /** Besuchende Führungsverantwortliche, die offiziell begrüsst werden */
  visitors?: string
  /** Abweichende Anzahl Ansprachen nur für diesen Sonntag */
  talkSlots?: number | null

  hymns: Partial<Record<HymnSlot, HymnChoice>>
  musicalNumbers: MusicalNumber[]
  announcements: AnnouncementEntry[]
  business: BusinessEntry[]

  /**
   * Reihenfolge im Teil «Botschaften und Musik».
   * Einträge sind Schlüssel wie «talk:abc123», «music:xyz» oder
   * «hymn:intermediate». Was fehlt, wird hinten angehängt – so überlebt die
   * Reihenfolge das Löschen und Hinzufügen einzelner Punkte.
   */
  programOrder: string[]

  notes?: string
  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Gebete                                                              */
/* ------------------------------------------------------------------ */

export type PrayerSlot = 'opening' | 'closing'

export const PRAYER_SLOTS: PrayerSlot[] = ['opening', 'closing']

export const PRAYER_SLOT_LABELS: Record<PrayerSlot, string> = {
  opening: 'Anfangsgebet',
  closing: 'Schlussgebet',
}

/**
 * Wer spricht wann ein Gebet.
 *
 * Eigene Sammlung statt eines Feldes in `SacramentMeeting`, weil daraus die
 * Frage «wann hat diese Person zuletzt gebetet?» beantwortet wird – genau wie
 * bei den Ansprachen. Die Dokument-ID ist «2026-08-09_opening», damit pro
 * Sonntag und Platz höchstens ein Eintrag entsteht.
 */
export interface Prayer extends WithId {
  date: TS
  slot: PrayerSlot
  memberId: string
  /** Denormalisiert, damit die Liste ohne Join lesbar bleibt */
  memberName: string
  notes?: string
  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Gesangbuch                                                          */
/* ------------------------------------------------------------------ */

/**
 * Die Bücher, aus denen in der Gemeinde gesungen wird.
 *
 * Zwei davon zählen je ab 1: Nr. 6 ist im Gesangbuch «Israel, der Herr ruft
 * alle», im Liederbuch für Kinder «Gebet eines Kindes». Ohne Unterscheidung
 * überschriebe ein Import den anderen – deshalb tragen die PV-Lieder ein
 * Kürzel.
 *
 * Das «Gesangbuch für zuhause und für die Kirche» braucht keines: Seine
 * Nummern beginnen bei 1001 und stossen mit keinem der beiden zusammen. Die
 * Kirche zählt dort bewusst so weiter, damit sich die Lieder ohne Zusatz
 * ansagen lassen.
 */
export type HymnBook = 'hymns' | 'children' | 'home_church'

export const HYMN_BOOK_LABELS: Record<HymnBook, string> = {
  hymns: 'Gesangbuch',
  children: 'Liederbuch für Kinder (PV)',
  home_church: 'Für zuhause und für die Kirche',
}

/** Kürzel vor der Nummer – nur wo die Nummern sonst zusammenstiessen. */
export const HYMN_BOOK_PREFIX: Record<HymnBook, string> = {
  hymns: '',
  children: 'PV',
  home_church: '',
}

/** Ab hier zählt das Gesangbuch für zuhause und für die Kirche. */
export const HOME_CHURCH_FROM = 1000

/**
 * Ein Lied aus einem der beiden Bücher. Die Dokument-ID ist der Code
 * («6», «pv-18a»), damit sich die Liste beliebig oft neu importieren
 * lässt, ohne Dubletten anzulegen. Erfasst wird nur der Code – den Titel
 * ergänzt die App.
 */
export interface Hymn extends WithId {
  /** Zahl im Buch – sie sortiert die Liste. «18a» und «18b» teilen sie sich. */
  number: number
  /**
   * Wie das Lied angeschrieben und gesucht wird: «6», «18a», «PV 6».
   * Fehlt das Feld (Altbestand), gilt die Nummer als Code.
   */
  code?: string
  /** Fehlt das Feld (Altbestand), gilt das Gesangbuch. */
  book?: HymnBook
  title: string
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Putzplan                                                            */
/* ------------------------------------------------------------------ */

/**
 * Eine Woche im Putzplan der Gemeinde.
 *
 * Der Plan wird zweimal im Jahr als Tabelle erstellt und hier eingelesen.
 * Die Dokument-ID ist der erste Tag der Woche («2026-06-29»); damit lässt
 * sich derselbe Plan beliebig oft einlesen, ohne Dubletten anzulegen, und
 * eine korrigierte Fassung ersetzt schlicht die alte.
 *
 * Die Woche läuft von Montag bis Samstag – der Sonntag dazwischen ist der
 * Tag, an dem in der Abendmahlsversammlung gedankt und angekündigt wird.
 */
export interface CleaningWeek extends WithId {
  /** Erster Tag der Woche, «yyyy-MM-dd» – zugleich die Dokument-ID */
  startDate: string
  /** Letzter Tag der Woche, «yyyy-MM-dd» */
  endDate: string
  /** «Gruppe 2» */
  group: string
  /** «Bader Roger & Sylvie» */
  team: string
  /** Bemerkung aus der Tabelle, z. B. «Generalkonf.» */
  note?: string
  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Notizen                                                             */
/* ------------------------------------------------------------------ */

/**
 * Eine Notiz der Bischofschaft.
 *
 * Bewusst schmal: Titel, Text, wer zuletzt geschrieben hat. Keine Farben,
 * kein Anheften, keine Checklisten – und keine private Notiz. In einer
 * Bischofschaft arbeiten alle am selben Bestand, wie bei allem Übrigen in
 * dieser App; was niemand sonst sehen soll, gehört nicht in diese Datenbank.
 */
export interface Note extends WithId {
  title: string
  body: string
  /**
   * Platz in der selbst gewählten Reihenfolge – kleiner heisst weiter oben.
   *
   * Fehlt die Angabe, wurde die Notiz noch nie von Hand einsortiert; sie steht
   * dann zuoberst, genau wie in der Ansicht «Zuletzt bearbeitet». Beim
   * Umsortieren bekommen alle Notizen ihre Position, damit die Reihenfolge auch
   * dann stehen bleibt, wenn jemand eine davon bearbeitet.
   */
  order?: number
  /** Wer sie angelegt bzw. zuletzt geändert hat (UID aus `users`) */
  createdById?: string | null
  updatedById?: string | null
  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Aktivitäten AP                                                      */
/* ------------------------------------------------------------------ */

/**
 * Was für ein Termin im Aktivitätenplan steht.
 *
 * Der Plan hat einen festen Takt: Mittwochabend die Aktivität, am 2. und
 * 4. Sonntag die Klasse, am 3. Mittwoch die FHV – und damit keine
 * Aktivität. Alles Übrige – Lager, Tempelbesuche, Pfahlanlässe, ein
 * Samstag – ist besonders. Genau diese vier Fälle unterscheidet die Art,
 * und mehr braucht es nicht: Sie färbt die Kachel und sagt auf einen
 * Blick, ob an einem Abend etwas stattfindet.
 */
export type ApActivityKind = 'activity' | 'class' | 'special' | 'cancelled'

export const AP_ACTIVITY_KIND_LABELS: Record<ApActivityKind, string> = {
  activity: 'Aktivität',
  class: 'AP-Klasse',
  special: 'Besonderer Anlass',
  cancelled: 'Fällt aus',
}

/**
 * Ein Eintrag im Aktivitätenplan der Priestertumskollegien.
 *
 * Die Felder sind die Spalten des bisherigen Excel-Plans, und sie bleiben
 * bewusst Freitext: Wer eine Aktivität leitet und wer aus der
 * Bischofschaft dabei ist, steht dort als Vorname – «Carden», «Josh,
 * Alain». Ein Verweis auf die Mitgliederliste wäre genauer, aber die
 * Personen, die diesen Plan pflegen, sehen die Mitgliederliste gar nicht.
 *
 * Das Datum ist «yyyy-MM-dd» und kein Zeitstempel: Ein Eintrag gehört zu
 * einem Tag, nicht zu einem Zeitpunkt, und als Text lässt er sich sortieren,
 * vergleichen und abfragen, ohne über Zeitzonen nachzudenken. Mehrtägige
 * Anlässe – ein Lager, ein Wochenende – tragen zusätzlich `endDate`.
 */
export interface ApActivity extends WithId {
  /** Erster Tag, «2026-01-07» – zugleich das Sortierfeld */
  date: string
  /** Letzter Tag bei mehrtägigen Anlässen, sonst `null` */
  endDate?: string | null
  /** «19:30» – leer, wenn die übliche Zeit gilt */
  time?: string
  kind: ApActivityKind
  /** «Bouldern», «Kleine Entscheidungen – grosse Konsequenzen» */
  title: string
  /** Treffpunkt, «Gemeindehaus» */
  location?: string
  /** Leitung / Organisation, «Carden» oder «JM» */
  leader?: string
  /** Teilnahme Bischofschaft */
  bishopric?: string
  /** Teilnahme Berater */
  advisor?: string
  /** Bemerkung / sonstiges Programm */
  note?: string
  createdAt?: TS
  updatedAt?: TS
  createdById?: string | null
  updatedById?: string | null
}

/**
 * Welches Kollegium einen Monat führt.
 *
 * Im Excel-Plan steht das als Zwischenüberschrift über jedem Monat
 * («JANUAR – LEITUNG LEHRER»). Ein eigenes Dokument je Monat, ID ist
 * «2026-01»: Damit lässt sich der Plan beliebig oft einlesen, ohne
 * Dubletten anzulegen, und die Angabe hängt nicht an einem einzelnen
 * Termin, der gelöscht werden könnte.
 */
export interface ApMonth extends WithId {
  /** «2026-01» – zugleich die Dokument-ID */
  month: string
  /** «Leitung Lehrer» */
  leadership: string
  updatedAt?: TS
}
