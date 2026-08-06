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
  executive_secretary: 'Finanzsekretär',
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
 * Das Administrator-Konto – verwaltet als Einziges Benutzer und Rollen.
 *
 * Erkannt wird es an der Anmelde-E-Mail (dem Token), nicht am frei
 * beschreibbaren Profil. Dieselbe Adresse steht in `firestore.rules` –
 * beide müssen zusammen geändert werden.
 */
export const ADMIN_EMAIL = 'alain.sc2@gmail.com'

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

/**
 * Wie der Aktivitätenplan dargestellt wird.
 *
 * Eine Ansichtseinstellung und keine Sache der Daten – aber eine, die am
 * Konto hängt und nicht am Gerät: Wer den Plan als Kacheln mag, mag ihn am
 * Telefon genauso wie am Laptop. Zusätzlich liegt sie im Browser, damit sie
 * ohne Netz und vor dem ersten Schnappschuss schon stimmt.
 */
export interface ApView {
  mode: 'list' | 'cards'
  density: 'compact' | 'normal' | 'wide'
  /** Welcher Zeitraum – kommend, vergangen oder der ganze Plan */
  scope: 'upcoming' | 'past' | 'all'
}

export const DEFAULT_AP_VIEW: ApView = {
  mode: 'list',
  density: 'normal',
  scope: 'upcoming',
}

export const AP_VIEW_MODE_LABELS: Record<ApView['mode'], string> = {
  list: 'Liste',
  cards: 'Kacheln',
}

export const AP_DENSITY_LABELS: Record<ApView['density'], string> = {
  compact: 'Kompakt',
  normal: 'Normal',
  wide: 'Weit',
}

export const AP_SCOPE_LABELS: Record<ApView['scope'], string> = {
  upcoming: 'Kommend',
  past: 'Vergangen',
  all: 'Ganzer Plan',
}

/* ------------------------------------------------------------------ */
/* Übersichtsseite                                                     */
/* ------------------------------------------------------------------ */

/**
 * Die Kacheln der Übersicht.
 *
 * Was jemanden am Morgen zuerst interessiert, ist von Person zu Person
 * verschieden: Der Sekretär schaut auf die Traktanden der nächsten Sitzung,
 * der Ratgeber auf die Aktivitäten der Jungen Männer. Deshalb lässt sich jede
 * Kachel ein- und ausblenden, verschieben und – wo es etwas zu zählen gibt –
 * in ihrer Länge einstellen.
 */
export type DashboardTileId = 'meeting' | 'stats' | 'talks' | 'ap' | 'birthdays' | 'pendenzen'

export const DASHBOARD_TILE_LABELS: Record<DashboardTileId, string> = {
  meeting: 'Nächste Sitzung',
  stats: 'Zahlen',
  talks: 'Ansprachen',
  ap: 'Aktivitäten AP’s',
  birthdays: 'Geburtstage',
  pendenzen: 'Meine Pendenzen',
}

/**
 * Wo eine Kachel steht.
 *
 * Drei Plätze, mehr braucht es nicht: die breite Hauptspalte, die schmale
 * Spalte daneben und die ganze Breite darunter. Ein frei bewegliches Raster
 * wäre auf dem Telefon ohnehin wieder eine einzige Spalte.
 */
export type DashboardArea = 'main' | 'side' | 'full'

export const DASHBOARD_AREA_LABELS: Record<DashboardArea, string> = {
  main: 'Haupt',
  side: 'Seite',
  full: 'Breit',
}

export interface DashboardTile {
  id: DashboardTileId
  area: DashboardArea
  visible: boolean
}

export interface DashboardView {
  /**
   * Begrüssung und Gemeindename über den Kacheln.
   *
   * Sie sagen nichts, was man nicht wüsste – wer die App am Telefon
   * aufschlägt, will die erste Kachel sehen und nicht «Guten Abend». Wer sie
   * mag, behält sie; abgewählt gewinnt die Übersicht zwei Zeilen.
   */
  greeting: boolean
  /** Alle Kacheln in der gewählten Reihenfolge */
  tiles: DashboardTile[]
  /** Wie viele Traktanden und Pendenzen die Sitzungskachel zeigt */
  meetingItems: number
  /** Wie viele eigene Pendenzen */
  myItems: number
  /** Wie viele Sonntage die Ansprachenkachel zeigt */
  talkSundays: number
  /** Wie viele AP-Termine – einer bis vier */
  apActivities: number
}

export const DEFAULT_DASHBOARD_VIEW: DashboardView = {
  greeting: true,
  tiles: [
    { id: 'meeting', area: 'main', visible: true },
    { id: 'stats', area: 'side', visible: true },
    { id: 'talks', area: 'side', visible: true },
    { id: 'ap', area: 'side', visible: true },
    { id: 'birthdays', area: 'side', visible: true },
    { id: 'pendenzen', area: 'full', visible: true },
  ],
  meetingItems: 4,
  myItems: 5,
  talkSundays: 4,
  apActivities: 2,
}

/**
 * Gemerkte Einstellung und Vorgabe zusammenführen.
 *
 * Im Browser steht, was zuletzt gewählt wurde – womöglich aus einer Fassung,
 * die eine Kachel noch nicht kannte. Fehlende kommen deshalb hinten dazu,
 * Unbekanntes fällt weg; die selbst gewählte Reihenfolge bleibt erhalten.
 */
export function normalizeDashboardView(stored: DashboardView): DashboardView {
  const known = new Set(Object.keys(DASHBOARD_TILE_LABELS) as DashboardTileId[])
  const seen = new Set<DashboardTileId>()
  const tiles: DashboardTile[] = []

  for (const tile of stored?.tiles ?? []) {
    if (!known.has(tile?.id) || seen.has(tile.id)) continue
    seen.add(tile.id)
    tiles.push({
      id: tile.id,
      area: tile.area in DASHBOARD_AREA_LABELS ? tile.area : 'main',
      visible: tile.visible !== false,
    })
  }
  for (const tile of DEFAULT_DASHBOARD_VIEW.tiles) {
    if (!seen.has(tile.id)) tiles.push({ ...tile })
  }

  const count = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback

  return {
    // Aus einer Fassung ohne diese Einstellung kommt `undefined` – dann gilt
    // die Vorgabe und nicht «ausgeblendet».
    greeting: stored?.greeting !== false,
    tiles,
    meetingItems: count(stored?.meetingItems, DEFAULT_DASHBOARD_VIEW.meetingItems),
    myItems: count(stored?.myItems, DEFAULT_DASHBOARD_VIEW.myItems),
    talkSundays: count(stored?.talkSundays, DEFAULT_DASHBOARD_VIEW.talkSundays),
    apActivities: count(stored?.apActivities, DEFAULT_DASHBOARD_VIEW.apActivities),
  }
}

/* ------------------------------------------------------------------ */
/* Sitzungsliste                                                       */
/* ------------------------------------------------------------------ */

/**
 * Wie die Liste der Sitzungen aussieht.
 *
 * «Nur Sitzung» ist die Terminliste: Titel, Datum, Ort – ein Klick führt
 * hinein. «Kompakt» stellt darunter gleich, worum es geht, und erspart das
 * Öffnen: die Traktanden und, wenn gewünscht, die Pendenzen. Je Gruppe lässt
 * sich sagen, ob die Titel genügen oder der ganze Eintrag zu lesen sein soll.
 */
export type MeetingListMode = 'plain' | 'compact'

export const MEETING_LIST_MODE_LABELS: Record<MeetingListMode, string> = {
  plain: 'Nur Sitzung',
  compact: 'Kompakt',
}

export type MeetingDetailLevel = 'titles' | 'full'

export const MEETING_DETAIL_LABELS: Record<MeetingDetailLevel, string> = {
  titles: 'Nur Titel',
  full: 'Komplett',
}

export type MeetingScope = 'upcoming' | 'past' | 'all'

export const MEETING_SCOPE_LABELS: Record<MeetingScope, string> = {
  upcoming: 'Anstehend',
  past: 'Vergangen',
  all: 'Alle',
}

export interface MeetingsView {
  scope: MeetingScope
  mode: MeetingListMode
  /** Pendenzen mitzeigen – nur in der kompakten Ansicht von Belang */
  showPendenzen: boolean
  agendaDetail: MeetingDetailLevel
  pendenzenDetail: MeetingDetailLevel
}

export const DEFAULT_MEETINGS_VIEW: MeetingsView = {
  scope: 'upcoming',
  mode: 'plain',
  showPendenzen: true,
  agendaDetail: 'titles',
  pendenzenDetail: 'titles',
}

export interface AppUser extends WithId {
  /** entspricht der Firebase-Auth-UID */
  email: string
  displayName: string
  role: Role
  /** Kürzel für Avatare und kompakte Listen, z. B. «AB» */
  initials?: string
  /** optionale Verknüpfung zum Mitgliederdatensatz */
  memberId?: string | null
  /** Gemerkte Darstellung des Aktivitätenplans – gilt auf jedem Gerät */
  apView?: ApView
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

/**
 * Das Gegenstück für die Abfrage des Erledigten – einschliesslich
 * «Verworfen» aus früheren Fassungen, das beim Lesen als erledigt gilt.
 */
export const DONE_STATUS_QUERY: string[] = ['done', 'cancelled']

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

/*
 * Eine Priorität gab es einmal – tief, normal, hoch. Sie ist weggefallen:
 * Am Sitzungstisch entscheidet die Reihenfolge der Liste, was zuerst
 * drankommt, und die lässt sich von Hand festlegen. Zwei Angaben für
 * dieselbe Frage widersprachen sich regelmässig. Alte Werte bleiben in
 * Firestore stehen, gelesen werden sie nicht mehr.
 */

export interface HistoryEntry {
  id: string
  /** z. B. «Status auf Erledigt gesetzt» */
  action: string
  authorId: string
  authorName: string
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Variables Layout                                                    */
/* ------------------------------------------------------------------ */

/**
 * Was in einem Feld des variablen Layouts steht.
 *
 * Der Normalfall ist `text` – ein gewöhnliches Feld, in das man schreibt,
 * mit «@» auch Mitgliedernamen. Die übrigen Arten nehmen dem Feld die
 * Freiheit und geben ihm dafür Bedeutung: Wer eine Spalte «Wer» auf
 * `assignees` stellt, klickt die Zuständigen an, statt Namen zu tippen –
 * und die App weiss danach, wer gemeint ist.
 */
export type LayoutFieldKind = 'text' | 'assignees' | 'members' | 'status' | 'date'

export const LAYOUT_FIELD_LABELS: Record<LayoutFieldKind, string> = {
  text: 'Freitext',
  assignees: 'Bischofschaft',
  members: 'Mitglieder',
  status: 'Pendent / Erledigt',
  date: 'Termin',
}

/** Ein Satz zu jeder Feldart – steht im Fenster «Feld anpassen». */
export const LAYOUT_FIELD_HINTS: Record<LayoutFieldKind, string> = {
  text: 'Schreiben, was gerade nötig ist. «@» setzt einen Mitgliedernamen ein.',
  assignees: 'Zuständigkeit: Personen aus der Bischofschaft anklicken.',
  members: 'Nur Namen aus dem Mitgliederverzeichnis.',
  status: 'Ein Feld mit zwei Zuständen.',
  date: 'Ein Datum aus dem Kalender.',
}

/**
 * Ein Feld im Raster.
 *
 * `col`/`row` sind die linke obere Ecke (0-basiert), `colSpan`/`rowSpan`
 * sagen, über wie viele Rasterzellen sich das Feld erstreckt. Damit lässt
 * sich neben drei schmalen Zeilen ein einziges hohes Feld stellen, ohne
 * dass das Raster selbst etwas davon wissen muss.
 */
export interface LayoutField {
  id: string
  col: number
  row: number
  colSpan: number
  rowSpan: number
  kind: LayoutFieldKind
  /** Überschrift über dem Feld – fehlt sie, steht dort nichts */
  label?: string
  /** Bei `text`: der geschriebene Inhalt */
  text?: string
  /** Bei `assignees` die UIDs, bei `members` die Mitglieder-IDs */
  ids?: string[]
  /** Bei `status` */
  done?: boolean
  /** Bei `date` – als «2026-08-04» */
  date?: string
}

/**
 * Das selbst gebaute Raster eines Traktandums.
 *
 * Fehlt es, hat der Eintrag das gewohnte Layout: Titel und Beschreibung.
 * Steht es da, tritt es an die Stelle der Beschreibung – beide Stände
 * bleiben gespeichert, das Umschalten wirft also nichts weg.
 */
export interface ItemLayout {
  /** 1 bis 4 */
  columns: number
  rows: number
  fields: LayoutField[]
}

/* ------------------------------------------------------------------ */
/* Berufungsänderungen                                                 */
/* ------------------------------------------------------------------ */

/**
 * Wie dringend eine Zeile ist.
 *
 * Drei Stufen, mehr braucht eine Ideenliste nicht: Was jetzt ansteht, was
 * demnächst kommt und was liegen darf. Gezeigt wird das als Farbe der Zeile
 * – und weil eine Farbe für sich genommen nichts sagt, steht der Name
 * überall daneben, wo sie gesetzt oder gefiltert wird.
 */
export type CallingUrgency = 'high' | 'medium' | 'low'

/** Von dringend nach gelassen – die Reihenfolge der Kreise. */
export const CALLING_URGENCY_ORDER: CallingUrgency[] = ['high', 'medium', 'low']

export const CALLING_URGENCY_LABELS: Record<CallingUrgency, string> = {
  high: 'Dringend',
  medium: 'Mitteldringend',
  low: 'Nicht so dringend',
}

/** Was beide Tabellen an jeder Zeile führen. */
export interface CallingRowBase {
  id: string
  /** Farbe der Zeile. Fehlt sie, ist noch nichts eingeschätzt. */
  urgency?: CallingUrgency
  /**
   * Wer sich um diese Zeile kümmert – UIDs aus der Bischofschaft.
   *
   * Der Grund, weshalb eine einzelne Zeile eine Zuständigkeit trägt und
   * nicht bloss das Traktandum: Eine Berufungsrunde geht zwanzig Namen
   * durch, und die verteilt man untereinander.
   */
  assignees: string[]
  /**
   * Diese Zeile ist abgeschlossen.
   *
   * Erledigt wird in einer Runde zeilenweise – die eine Berufung steht,
   * während die nächste noch offen ist. Eine erledigte Zeile verschwindet
   * aus der Tabelle; «Erledigte anzeigen» ganz unten holt sie zurück. Der
   * ganze Eintrag ist damit erst fertig, wenn keine Zeile mehr offen ist.
   */
  done?: boolean
}

/** «Neue Berufungen»: Wer eine neue Aufgabe bekommen soll. */
export interface CallingMemberRow extends CallingRowBase {
  /** Um wen es geht – mehrere, wenn ein Ehepaar zusammen besprochen wird */
  memberIds: string[]
  /** Heutige Berufung und was daran ansteht – Freitext, mehrzeilig */
  calling: string
  /** Was in Frage käme – Freitext, mehrzeilig */
  ideas: string
}

/** «Offene Berufungen»: Welche Aufgabe niemanden hat. */
export interface CallingOpenRow extends CallingRowBase {
  /** Welche Berufung offen ist – Freitext */
  calling: string
  /** Wer in Frage käme – Freitext, «@» setzt Namen ein */
  candidates: string
  /** Weiteres Vorgehen – Freitext, mehrzeilig */
  next: string
}

/**
 * Die beiden Tabellen hinter dem Haken «Berufungsänderung».
 *
 * Eine Ideenliste und sonst nichts: Was hier steht, ändert an keiner
 * Berufung und an keinem Mitgliederdatensatz etwas. Wer welche Berufung
 * hat, sagt allein das LCR und der Import von dort – diese Tabellen sind
 * das Blatt, auf dem die Bischofschaft vorher denkt.
 *
 * Sie treten wie das variable Layout an die Stelle der Beschreibung;
 * beides zugleich gibt es nicht.
 */
export interface CallingChanges {
  members: CallingMemberRow[]
  open: CallingOpenRow[]
}

export interface AgendaItem extends WithId {
  title: string
  description?: string

  /** Sitzung, in der das Traktandum behandelt wird (null = Sammelkorb / später) */
  meetingId: string | null
  /** Position innerhalb der Sitzung – bestimmt die Reihenfolge im Sitzungsmodus */
  order: number
  /**
   * Platz in der **Pendenzenliste**, wenn dort von Hand sortiert wurde.
   *
   * Nicht dasselbe wie `order`: Das ist der Platz in einer einzelnen Sitzung
   * und bestimmt, in welcher Folge sie durchgeht. Die Pendenzenliste steht
   * quer dazu – sie sammelt über alle Sitzungen hinweg –, und beides in
   * dasselbe Feld zu schreiben hiesse, mit jedem Zug in der einen Ansicht die
   * andere umzustellen.
   *
   * Fehlt das Feld, wurde der Eintrag noch nie einsortiert; er steht dann
   * zuoberst (siehe `pages/Pendenzen`).
   */
  pendenzOrder?: number

  /**
   * Traktandum oder Pendenz. Fehlt das Feld (Altbestand), leitet
   * `toItemKind()` es aus `firstMeetingId` ab.
   */
  kind: ItemKind
  status: ItemStatus

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

  /*
   * Ein Fälligkeitsdatum («Erledigen bis») gab es einmal. Es ist
   * weggefallen: Eine Pendenz gehört in eine Sitzung, und die Sitzung hat
   * bereits ein Datum. Ein zweites daneben wurde gesetzt, lief ab und
   * färbte danach die halbe Liste rot, ohne dass sich daraus etwas ergab.
   * Alte Werte bleiben in Firestore stehen, gelesen werden sie nicht mehr.
   */

  /**
   * Selbst gebautes Raster statt der Beschreibung.
   *
   * Nicht jedes Traktandum ist ein Absatz Text. Manches ist eine kleine
   * Tabelle – Aufgabe, wer, bis wann –, und die von Hand in einen Fliesstext
   * zu schreiben, macht sie unbrauchbar. Fehlt das Feld, bleibt alles beim
   * Alten: Titel und Beschreibung.
   */
  layout?: ItemLayout | null

  /**
   * Zwei Tabellen statt der Beschreibung: «Berufungsänderung».
   *
   * Die eine Runde, die jede Bischofschaft regelmässig dreht – wer eine
   * Aufgabe braucht, welche Aufgabe jemanden braucht –, hat eine feste
   * Gestalt und wäre als selbst gebautes Raster jedes Mal neu zu stellen.
   * Sie steht deshalb als eigene Form da (siehe `lib/callingChanges`).
   * Fehlt das Feld, bleibt alles beim Alten.
   */
  callingChanges?: CallingChanges | null

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
  /**
   * Stand des Datensatzes – jede Änderung setzt ihn, auch das Umsortieren.
   *
   * Daran erkennt der Abgleich beim Start, was seit dem letzten Mal neu ist
   * (siehe `lib/collectionStore`). Für die Frage «wann wurde daran zuletzt
   * gearbeitet?» ist `editedAt` zuständig.
   */
  updatedAt?: TS
  /**
   * Wann zuletzt am Inhalt gearbeitet wurde.
   *
   * Fehlt bei allem, was vor dieser Unterscheidung erfasst wurde – dann gilt
   * `updatedAt`. Siehe `lastEditedAt()`.
   */
  editedAt?: TS
  createdBy?: string
  completedAt?: TS | null
  completedBy?: string | null
}

/**
 * Wann zuletzt am Eintrag gearbeitet wurde.
 *
 * `editedAt` steht erst an dem, was seit der Trennung von «Stand» und
 * «bearbeitet» geschrieben wurde; alles Ältere fällt auf `updatedAt` zurück.
 */
export function lastEditedAt(item: { editedAt?: TS; updatedAt?: TS }): TS | undefined {
  return item.editedAt ?? item.updatedAt
}

/* ------------------------------------------------------------------ */
/* Pendenzenliste                                                      */
/* ------------------------------------------------------------------ */

/**
 * Wonach die Pendenzenliste sortiert – und damit zugleich gruppiert – wird.
 *
 * Die beiden Datumsfelder ordnen von selbst und geben der Liste ihre
 * Zwischentitel. `manual` ist das Gegenstück: die Reihenfolge, die jemand von
 * Hand gelegt hat. Sie steht an den Einträgen (`AgendaItem.pendenzOrder`) und
 * gilt deshalb für alle – wie die Reihenfolge einer Traktandenliste auch.
 */
export type PendenzenSort = 'created' | 'updated' | 'manual'

export const PENDENZEN_SORT_LABELS: Record<PendenzenSort, string> = {
  created: 'Erfassungsdatum',
  updated: 'Bearbeitungsdatum',
  manual: 'Manuelle Sortierung',
}

export interface PendenzenSortState {
  field: PendenzenSort
  dir: SortDirection
}

/** Offen: das zuletzt Erfasste zuoberst. */
export const DEFAULT_PENDENZEN_SORT: PendenzenSortState = { field: 'created', dir: 'desc' }

/** Erledigt: das zuletzt Abgehakte zuoberst – der Weg zurück nach einem Versehen. */
export const DEFAULT_PENDENZEN_DONE_SORT: PendenzenSortState = { field: 'updated', dir: 'desc' }

/**
 * Was in den Einstellungen steht, auf eine gültige Sortierung zurückführen.
 *
 * Sie kommt aus Firestore und damit womöglich aus einer anderen Fassung der
 * App. Ein unbekanntes Feld darf die Liste nicht leer lassen, sondern fällt
 * auf die Vorgabe zurück.
 */
export function normalizePendenzenSort(
  stored: unknown,
  fallback: PendenzenSortState = DEFAULT_PENDENZEN_SORT,
): PendenzenSortState {
  const value = (stored ?? {}) as Partial<PendenzenSortState>
  return {
    field: value.field && value.field in PENDENZEN_SORT_LABELS ? value.field : fallback.field,
    dir: value.dir === 'asc' || value.dir === 'desc' ? value.dir : fallback.dir,
  }
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

  /**
   * Darf für Ansprachen angefragt werden?
   *
   * Eine Entscheidung, nicht zwei: Wie lange sie gilt, sagt `talkHoldUntil`.
   * Ausgewertet wird beides zusammen in `lib/availability` – dort steht auch,
   * warum aus den früheren zwei Haken einer geworden ist.
   */
  availableForTalks: boolean
  /** Bis wann «nicht anfragen» gilt – fehlt es, gilt der Vermerk auf Weiteres. */
  talkHoldUntil?: TS | null
  /** Wann diese Entscheidung zuletzt getroffen wurde */
  talkAvailabilityChangedAt?: TS | null
  /** Altbestand: der frühere zweite Haken «vorerst nicht anfragen» */
  talkHold?: boolean

  /**
   * Darf um ein Gebet gebeten werden?
   *
   * Dasselbe Paar wie bei den Ansprachen. Beim Zuteilen der Gebete geht es
   * meist um den nächsten Sonntag und nicht um eine Grundsatzfrage – «Heute
   * nicht» setzt deshalb ein Datum ein paar Wochen voraus, und danach steht
   * die Person von selbst wieder in der Liste.
   */
  availableForPrayers?: boolean
  /** Bis wann «nicht anfragen» gilt – fehlt es, gilt der Vermerk auf Weiteres. */
  prayerHoldUntil?: TS | null
  /** Wann diese Entscheidung zuletzt getroffen wurde */
  prayerAvailabilityChangedAt?: TS | null

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
/* Mitgliederliste                                                     */
/* ------------------------------------------------------------------ */

/** Auf- oder absteigend – überall dieselbe Angabe. */
export type SortDirection = 'asc' | 'desc'

/**
 * Wonach die Mitgliederliste sortiert wird.
 *
 * «Zuletzt gesprochen» und «zuletzt gebetet» sind die beiden Fragen, die vor
 * jedem Sonntag stehen; sie stehen deshalb gleichberechtigt neben dem Namen.
 */
export type MemberSort = 'name' | 'firstName' | 'age' | 'lastTalk' | 'lastPrayer'

export const MEMBER_SORT_LABELS: Record<MemberSort, string> = {
  name: 'Nachname',
  firstName: 'Vorname',
  age: 'Alter',
  lastTalk: 'Ansprache zuletzt',
  lastPrayer: 'Gebet zuletzt',
}

export const MEMBER_STATUS_SCOPE_LABELS: Record<MemberStatus | 'all', string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  all: 'Alle',
}

export const GENDER_SCOPE_LABELS: Record<Gender | 'all', string> = {
  all: 'Alle',
  m: 'Männer',
  f: 'Frauen',
  unknown: 'Ohne Angabe',
}

/**
 * Was die Mitgliederliste zeigt und in welcher Reihenfolge.
 *
 * Alles davon steht hinter «Ansicht» oben rechts – so wie auf jeder anderen
 * Seite auch. Über der Liste bleibt damit die Suche, und sonst nichts.
 */
export interface MembersView {
  status: MemberStatus | 'all'
  gender: Gender | 'all'
  /** Untere Altersgrenze in Jahren, `null` = keine */
  minAge: number | null
  /** Obere Altersgrenze in Jahren, `null` = keine */
  maxAge: number | null
  sort: MemberSort
  direction: SortDirection
}

export const DEFAULT_MEMBERS_VIEW: MembersView = {
  status: 'active',
  gender: 'all',
  minAge: null,
  maxAge: null,
  sort: 'name',
  direction: 'asc',
}

/* ------------------------------------------------------------------ */
/* Ansprachen                                                          */
/* ------------------------------------------------------------------ */

/**
 * Drei Schritte, mehr nicht: vorgesehen, angefragt, zugesagt.
 *
 * Ein vierter Schritt «gehalten» wäre ein Klick, den nach der Versammlung
 * niemand macht – und ohne ihn stimmte die Auswertung «wer war lange nicht
 * dran» nicht mehr. Deshalb zählt eine Zusage: Wer zugesagt hat und dessen
 * Eintrag im Programm stehen bleibt, hat gesprochen. Wird jemand kurzfristig
 * ersetzt, wird der Eintrag unter «Leitung» geändert oder gelöscht – und
 * damit stimmt auch die Statistik wieder.
 *
 * «Abgesagt» und «Gestrichen» sind aus demselben Grund weggefallen: Eine
 * Absage heisst, dass der Platz wieder frei ist, und das sagt man am
 * deutlichsten, indem man den Eintrag entfernt.
 */
export type TalkStatus = 'planned' | 'asked' | 'confirmed'

export const TALK_STATUS_LABELS: Record<TalkStatus, string> = {
  planned: 'Vorgesehen',
  asked: 'Angefragt',
  confirmed: 'Zugesagt',
}

/** Status, bei denen der Platz im Programm belegt ist – alle drei. */
export const ACTIVE_TALK_STATUSES: TalkStatus[] = ['planned', 'asked', 'confirmed']

/**
 * Was als gesprochen zählt – für Firestore-Abfragen, einschliesslich des
 * Wertes früherer Fassungen.
 *
 * In der Datenbank stehen Jahre an übernommenem Verlauf mit «held». Er wird
 * beim Lesen als «zugesagt» geführt (siehe `toTalkStatus`); Abfragen müssen
 * ihn aber beim Namen nennen, sonst fehlte die halbe Vergangenheit.
 */
export const HELD_STATUS_QUERY: string[] = ['confirmed', 'held']

/**
 * Was in Firestore steht, auf die drei Schritte zurückführen.
 *
 * «Gehalten» wird zur Zusage – die Ansprache hat stattgefunden, und mehr
 * sagt der Status nicht mehr aus. Für «Abgesagt» und «Gestrichen» gibt es
 * keine Entsprechung: Diese Einträge werden beim Lesen übergangen (siehe
 * `hooks/useFirestore`), denn sie beschreiben eine Ansprache, die nicht
 * gehalten wurde.
 */
export function toTalkStatus(value: unknown): TalkStatus {
  if (value === 'asked') return 'asked'
  if (value === 'confirmed' || value === 'held') return 'confirmed'
  return 'planned'
}

/** Einträge früherer Fassungen, die keine Ansprache mehr bezeichnen. */
export function isWithdrawnTalk(value: unknown): boolean {
  return value === 'declined' || value === 'cancelled'
}

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

/**
 * Ein Programmpunkt ohne Namen – ein Platzhalter.
 *
 * Manchmal steht die Art des Punktes vor der Person fest: An diesem Sonntag
 * soll ein Zeugnis stehen, wer es gibt, ist noch offen. Ein solcher Eintrag
 * belegt seinen Platz im Ablauf und trägt schon Art, Dauer und Thema; der
 * Name wird nachgetragen. Bis dahin gilt der Platz als offen – sonst
 * verschwände er aus «_n_ offen» und niemand käme mehr darauf zurück.
 */
export function isTalkPlaceholder(talk: Pick<Talk, 'memberId' | 'memberName'>): boolean {
  return !talk.memberId && !talk.memberName?.trim()
}

/** Was an einem Platzhalter steht, solange niemand eingetragen ist. */
export const TALK_PLACEHOLDER_LABEL = 'Noch offen'

/** Der Name einer Ansprache – oder «Noch offen», wenn keiner dasteht. */
export function talkSpeakerLabel(talk: Pick<Talk, 'memberId' | 'memberName'>): string {
  return talk.memberName?.trim() || TALK_PLACEHOLDER_LABEL
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
/* Berufungsliste                                                      */
/* ------------------------------------------------------------------ */

/**
 * Was die Liste zeigt.
 *
 * `without` fällt aus der Reihe: Dort stehen keine Berufungen, sondern die
 * Personen, zu denen keine gehört – die Frage vor jeder neuen Berufung.
 */
export type CallingScope = 'active' | 'without' | 'released' | 'all'

export const CALLING_SCOPE_LABELS: Record<CallingScope, string> = {
  active: 'Aktuell',
  without: 'Ohne Berufung',
  released: 'Entlassen',
  all: 'Alle',
}

/** Ob die ganze Gemeinde zählt oder nur, wer aktiv ist. */
export type CallingAudience = 'all' | 'active'

export const CALLING_AUDIENCE_LABELS: Record<CallingAudience, string> = {
  all: 'Alle Mitglieder',
  active: 'Nur Aktive',
}

/**
 * Wonach die Berufungen geordnet sind.
 *
 * «Organisation» ist die Vorgabe und die einzige Ordnung, die den
 * Organisationsplan nachbildet: Sparte für Sparte, darin Präsident, Ratgeber,
 * dann die übrigen – so wie das LCR es ausgibt. Jede andere Wahl macht aus den
 * Sparten eine einzige Liste; anders liesse sich «alle nach Alter» nicht
 * beantworten.
 */
export type CallingSort = 'organization' | 'name' | 'position' | 'age' | 'sustained'

export const CALLING_SORT_LABELS: Record<CallingSort, string> = {
  organization: 'Organisation',
  name: 'Name',
  position: 'Bezeichnung',
  age: 'Alter',
  sustained: 'Bestätigung',
}

export interface CallingsView {
  scope: CallingScope
  audience: CallingAudience
  gender: Gender | 'all'
  minAge: number | null
  maxAge: number | null
  sort: CallingSort
  direction: SortDirection
}

export const DEFAULT_CALLINGS_VIEW: CallingsView = {
  scope: 'active',
  audience: 'all',
  gender: 'all',
  minAge: null,
  maxAge: null,
  sort: 'organization',
  direction: 'asc',
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
  /**
   * Eigene Gründe für die Wahl «Was findet statt?».
   *
   * Die sieben eingebauten Arten decken den Jahreslauf ab, aber nicht jeden
   * Sonderfall: eine Taufversammlung, ein Besuch der Missionspräsidentschaft,
   * ein Gemeindetag. Solche Anlässe kommen wieder – deshalb steht der Grund
   * in den Einstellungen und nicht am einzelnen Sonntag; einmal erfasst, ist
   * er an jedem Sonntag wählbar. Genau wie bei `extraLeaders`.
   */
  customSundayKinds: CustomSundayKind[]
  /**
   * Wie die Pendenzenliste sortiert ist – für alle gleich.
   *
   * Eine Ansichtseinstellung, die ausnahmsweise nicht zum Gerät gehört: Die
   * Bischofschaft geht die Pendenzen gemeinsam durch, und «der dritte Punkt»
   * ist nur dann eine Angabe, wenn er bei allen der dritte ist. Wer die
   * Sortierung ändert, ändert sie deshalb für alle – so wie die Reihenfolge
   * einer Traktandenliste auch für alle gilt.
   */
  pendenzenSort: PendenzenSortState
  /** Dasselbe für das Archiv «Erledigt» – dort ohne die gelegte Reihenfolge. */
  pendenzenDoneSort: PendenzenSortState
  updatedAt?: TS
}

/**
 * Ein selbst erfasster Grund, was an einem Sonntag stattfindet.
 *
 * Mehr als die eingebauten Arten braucht es nicht: eine Bezeichnung und die
 * beiden Fragen, die alles Weitere entscheiden – findet eine Versammlung
 * statt, werden Ansprachen eingeplant.
 */
export interface CustomSundayKind {
  /** Steht als `kind` am Sonntag – deshalb nicht die Bezeichnung selbst */
  id: string
  label: string
  meets: boolean
  plansTalks: boolean
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
  customSundayKinds: [],
  pendenzenSort: DEFAULT_PENDENZEN_SORT,
  pendenzenDoneSort: DEFAULT_PENDENZEN_DONE_SORT,
}

/**
 * Aus irgendetwas gültige Einstellungen machen.
 *
 * Ein geleertes Zeitfeld speicherte einmal `''`, ein geleertes Zahlenfeld
 * `0` – und beides legte anderswo das Eintragen lahm: `10:00` wurde zu
 * «Invalid Date», null Ansprachen-Plätze zeigten lauter leere Sonntage.
 * Deshalb wird an beiden Enden geradegezogen: beim Speichern
 * (`services/settings`) und beim Lesen (`DataContext`) – so heilt sich auch
 * ein bereits verunglückter Datensatz von selbst.
 */
export function normalizeSettings(input: Partial<AppSettings> | null | undefined): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(input ?? {}) }

  const time = (value: string, fallback: string) =>
    /^\d{1,2}:\d{2}$/.test(value) ? value : fallback
  const count = (value: number, fallback: number, min: number, max: number) =>
    Number.isFinite(value) && value >= min ? Math.min(max, Math.round(value)) : fallback

  return {
    ...merged,
    meetingTime: time(merged.meetingTime, DEFAULT_SETTINGS.meetingTime),
    sacramentTime: time(merged.sacramentTime, DEFAULT_SETTINGS.sacramentTime),
    talksPerSunday: count(merged.talksPerSunday, DEFAULT_SETTINGS.talksPerSunday, 1, 6),
    talkGapMonths: count(merged.talkGapMonths, DEFAULT_SETTINGS.talkGapMonths, 1, 120),
    talkMinAge: count(merged.talkMinAge, DEFAULT_SETTINGS.talkMinAge, 0, 30),
    prayerGapMonths: count(merged.prayerGapMonths, DEFAULT_SETTINGS.prayerGapMonths, 1, 120),
  }
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
  /**
   * Altbestand: der frühere Zusatz «Einzelheiten für die Person am Pult».
   *
   * Es gibt ihn nicht mehr zu erfassen – der Wortlaut steht seither in
   * einem einzigen mehrzeiligen Feld, und zwei Felder verlangten eine
   * Einteilung, die niemand vornehmen wollte. Angezeigt wird er weiter,
   * damit an bestehenden Sonntagen nichts stillschweigend verschwindet.
   */
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
  /** Altbestand – siehe `AnnouncementEntry.details`. */
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

/**
 * Eine Angelegenheit: Art, Person, Aufgabe – drei Angaben, mehr nicht.
 *
 * Die Person kommt aus dem Mitgliederverzeichnis; ihr Name wird
 * mitgeschrieben, damit ein Programm von vor zwei Jahren auch dann lesbar
 * bleibt, wenn der Datensatz später nicht mehr da ist. Wie beim Liedtitel
 * und beim Namen der leitenden Person.
 *
 * Die Aufgabe ist Freitext und **ändert an keiner Berufung etwas**. Wer
 * welche Berufung hat, sagt allein das LCR; hier steht nur, was am Sonntag
 * vorgelesen wird.
 */
export interface BusinessEntry {
  id: string
  type: BusinessType
  /** Das betroffene Mitglied – `null` bei Einträgen früherer Fassungen */
  memberId?: string | null
  /** Denormalisiert, damit die Zeile ohne Verzeichnis lesbar bleibt */
  memberName?: string
  /** Funktion bzw. Berufung: «Lehrer in der Sonntagsschule» */
  position?: string
  /**
   * Freitext früherer Fassungen: «Peter Meier – Lehrer in der
   * Sonntagsschule». Wird nicht mehr geschrieben, aber weiterhin angezeigt –
   * sonst verschwänden vergangene Sonntage aus dem Programm.
   */
  text?: string
  /** Mehrfachauswahl früherer Fassungen */
  memberIds?: string[]
  /** Verweis auf eine Berufung aus früheren Fassungen */
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
  kind?: SacramentKind | string | null
  /**
   * Die Bezeichnung eines selbst erfassten Grundes, mitgeschrieben.
   *
   * Wie beim Liedtitel und beim Namen der leitenden Person: Ein Programm von
   * vor zwei Jahren soll auch dann lesbar bleiben, wenn der Grund längst aus
   * den Einstellungen genommen wurde.
   */
  kindLabel?: string | null
  /**
   * Ausnahmen zur Art – `null` bzw. fehlend folgt der Art.
   *
   * Damit lässt sich ein Einzelfall abbilden, für den es keine eigene Art
   * braucht: eine Pfahlkonferenz, die ausnahmsweise in der Gemeinde
   * stattfindet, oder eine besondere Versammlung ohne Ansprachen.
   */
  meets?: boolean | null
  plansTalks?: boolean | null
  /**
   * Wer aus der Bischofschaft für diesen Sonntag zuständig ist (UID aus
   * `users`).
   *
   * Eine Angabe für die Planung und nicht fürs Pult: Sie sagt, wer sich um
   * diesen Sonntag kümmert – Ansprachen anfragen, Gebete verteilen, den
   * Ablauf vorbereiten. Üblicherweise wird sie für einen ganzen Monat
   * gesetzt; deshalb schreibt der Dialog sie auf Wunsch gleich auf alle
   * Sonntage des Monats. Anders als beim Vorsitz steht hier eine UID und
   * kein ausgeschriebener Name: Zuständig ist immer jemand mit Konto.
   */
  responsibleId?: string | null
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

/** Für schmale Knöpfe, wo der Zusammenhang die Bedeutung schon hergibt. */
export const PRAYER_SLOT_SHORT: Record<PrayerSlot, string> = {
  opening: 'Anfang',
  closing: 'Schluss',
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
  /** Stand des Datensatzes – siehe `AgendaItem.updatedAt` */
  updatedAt?: TS
  /** Wann zuletzt am Text gearbeitet wurde – siehe `lastEditedAt()` */
  editedAt?: TS
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
  /** Zuständig AP – wer die Aktivität organisiert, «Carden» oder «JM» */
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
