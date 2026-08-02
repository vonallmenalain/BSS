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
 * der Bischof oder ein Ratgeber freischaltet – so kann sich niemand selbst
 * Zugriff auf Personendaten verschaffen.
 */
export type Role = 'bishop' | 'counselor' | 'secretary' | 'pending'

export const ROLE_LABELS: Record<Role, string> = {
  bishop: 'Bischof',
  counselor: 'Ratgeber',
  secretary: 'Sekretär',
  pending: 'Wartet auf Freigabe',
}

/** Rollen, die Sitzungen leiten und vertrauliche Traktanden sehen dürfen. */
export const LEADERSHIP_ROLES: Role[] = ['bishop', 'counselor']

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

export type MemberStatus = 'active' | 'less_active' | 'inactive' | 'moved'

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Aktiv',
  less_active: 'Weniger aktiv',
  inactive: 'Inaktiv',
  moved: 'Weggezogen',
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
  /** Verweis auf ein anderes Mitglied als Kontaktperson */
  contactPersonId?: string | null

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

export interface Talk extends WithId {
  memberId: string
  /** Denormalisiert, damit Listen ohne zusätzliche Abfrage darstellbar sind */
  memberName: string

  /** Datum der Abendmahlsversammlung */
  date: TS
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
  | 'proposed'
  | 'approved'
  | 'extended'
  | 'sustained'
  | 'set_apart'
  | 'released'
  | 'declined'

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
  /** Anzahl Ansprachen pro Abendmahlsversammlung */
  talksPerSunday: number
  /** Ab wie vielen Monaten ohne Ansprache gilt jemand als «lange nicht dran»? */
  talkGapMonths: number
  updatedAt?: TS
}

export const DEFAULT_SETTINGS: AppSettings = {
  wardName: 'Gemeinde',
  meetingWeekday: 3, // Mittwoch
  meetingTime: '19:30',
  meetingLocation: 'Bischofsbüro',
  meetingTitle: 'Bischofschaftssitzung',
  sacramentWeekday: 0, // Sonntag
  talksPerSunday: 3,
  talkGapMonths: 18,
}
