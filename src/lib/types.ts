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
 * Die Rolle beschreibt die **Aufgabe** in der Bischofschaft, nicht den
 * Umfang der Rechte: Bischof, beide Ratgeber und die Sekretäre arbeiten am
 * selben Datenbestand und sehen alles. Sie steuert damit vor allem, wer im
 * Programm der Abendmahlsversammlung als leitend erscheint.
 */
export type Role =
  | 'bishop'
  | 'counselor1'
  | 'counselor2'
  | 'executive_secretary'
  | 'secretary'
  /** Sammelrolle aus früheren Versionen – bleibt lesbar, wird nicht mehr vergeben. */
  | 'counselor'
  | 'pending'

export const ROLE_LABELS: Record<Role, string> = {
  bishop: 'Bischof',
  counselor1: '1. Ratgeber',
  counselor2: '2. Ratgeber',
  executive_secretary: 'Exekutivsekretär',
  secretary: 'Sekretär',
  counselor: 'Ratgeber',
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
  /** Wer spricht das Anfangsgebet? (UID oder Freitext) */
  openingPrayer?: string
  closingPrayer?: string
  /** Geistiger Gedanke / Schriftstelle zum Einstieg */
  spiritualThought?: string
  /** Allgemeine Sitzungsnotizen (Protokoll-Kopf) */
  notes?: string
  /** Zeitpunkt, an dem die Sitzung gestartet bzw. abgeschlossen wurde */
  startedAt?: TS | null
  closedAt?: TS | null
  createdAt?: TS
  updatedAt?: TS
  createdBy?: string
}

/* ------------------------------------------------------------------ */
/* Traktanden / Pendenzen                                              */
/* ------------------------------------------------------------------ */

/**
 * Traktandum und Pendenz sind bewusst **dasselbe** Objekt.
 * Ein Traktandum, das in der Sitzung nicht abgeschlossen wird, bleibt offen
 * und erscheint automatisch wieder – dann nennen wir es Pendenz.
 */
export type ItemStatus = 'open' | 'in_progress' | 'done' | 'deferred' | 'cancelled'

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
  deferred: 'Zurückgestellt',
  cancelled: 'Verworfen',
}

/** Status, die als «noch zu tun» gelten und in der nächsten Sitzung auftauchen. */
export const OPEN_STATUSES: ItemStatus[] = ['open', 'in_progress', 'deferred']

export type Priority = 'low' | 'normal' | 'high'

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Tief',
  normal: 'Normal',
  high: 'Hoch',
}

export type ItemCategory =
  | 'general'
  | 'member_care'
  | 'calling'
  | 'talk'
  | 'youth'
  | 'welfare'
  | 'temple'
  | 'finance'
  | 'admin'
  | 'events'

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  general: 'Allgemein',
  member_care: 'Mitgliederbetreuung',
  calling: 'Berufungen',
  talk: 'Ansprachen',
  youth: 'Jugend',
  welfare: 'Wohlfahrt',
  temple: 'Tempel & Familienforschung',
  finance: 'Finanzen',
  admin: 'Administration',
  events: 'Anlässe',
}

export interface ItemNote {
  id: string
  text: string
  authorId: string
  authorName: string
  createdAt: string // ISO-String, da innerhalb eines Arrays kein serverTimestamp() möglich ist
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

  status: ItemStatus
  priority: Priority
  category: ItemCategory

  /** UIDs der zuständigen Personen (Mehrfachzuweisung möglich) */
  assignees: string[]
  /** betroffene Gemeindemitglieder (memberIds) */
  memberRefs: string[]

  /** Termin, bis wann die Pendenz erledigt sein soll */
  dueDate: TS | null

  notes: ItemNote[]
  history: HistoryEntry[]

  /** Nur für Bischof und Ratgeber sichtbar (seelsorgerische Themen) */
  confidential: boolean

  /** Wie oft wurde dieses Traktandum schon vertagt? Macht Dauerbrenner sichtbar. */
  deferCount: number
  /** Sitzung, in der es ursprünglich zum ersten Mal traktandiert war */
  firstMeetingId?: string | null

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

export type SacramentKind = 'regular' | 'fast_testimony' | 'special'

export const SACRAMENT_KIND_LABELS: Record<SacramentKind, string> = {
  regular: 'Abendmahlsversammlung',
  fast_testimony: 'Fast- und Zeugnisversammlung',
  special: 'Besondere Versammlung',
}

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
  kind: SacramentKind
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
