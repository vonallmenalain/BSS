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
 *
 * Die dritte Ausnahme ist die **Assistenz**. Die Vorbereitung der
 * Abendmahlsversammlung ist Arbeit, die sich abgeben lässt: Ansprachen
 * anfragen, die Lieder aussuchen, die Gebete verteilen. Wer das übernimmt,
 * braucht dafür dieselbe Ansicht wie die Bischofschaft – und sonst nichts.
 * Welche der drei Bereiche offenstehen, steht am Konto (`assistantAreas`)
 * und nicht an der Rolle: Der eine sucht nur die Lieder aus, die andere
 * macht alles ausser der Musik.
 */
export type Role =
  | 'bishop'
  | 'counselor1'
  | 'counselor2'
  | 'executive_secretary'
  | 'secretary'
  /** Sammelrolle aus früheren Versionen – bleibt lesbar, wird nicht mehr vergeben. */
  | 'counselor'
  /** Einzelne Bereiche der Abendmahlsversammlung – siehe `assistantAreas` */
  | 'assistant'
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
  assistant: 'Assistent',
  ap_editor: 'AP-Kalender · bearbeiten',
  ap_viewer: 'AP-Kalender · nur ansehen',
  pending: 'Wartet auf Freigabe',
}

/* ------------------------------------------------------------------ */
/* Assistenz: welche Bereiche offenstehen                              */
/* ------------------------------------------------------------------ */

/**
 * Die Bereiche der Abendmahlsversammlung, die einer Assistenz einzeln
 * offenstehen.
 *
 * Genau diese drei und keine weiteren: Es sind die Zulieferer des Sonntags –
 * Arbeit, die man abgeben kann, ohne den Einblick abzugeben, den «Leitung»,
 * «Bekanntmachungen» und «Angelegenheiten» mit sich brächten. Dort steht,
 * wer entlassen und wer berufen wird, und das ist nicht die Sache dessen,
 * der die Lieder aussucht.
 *
 * Dieselben Bezeichner stehen in `firestore.rules` – beide müssen zusammen
 * geändert werden.
 */
export type AssistantArea = 'talks' | 'music' | 'prayers'

export const ASSISTANT_AREAS: AssistantArea[] = ['talks', 'music', 'prayers']

export const ASSISTANT_AREA_LABELS: Record<AssistantArea, string> = {
  talks: 'Ansprachen',
  music: 'Musik',
  prayers: 'Gebet',
}

/** Wohin der Bereich führt – dieselben Adressen wie im Menü. */
export const ASSISTANT_AREA_PATHS: Record<AssistantArea, string> = {
  talks: '/abendmahl/ansprachen',
  music: '/abendmahl/musik',
  prayers: '/abendmahl/gebet',
}

/**
 * Die Bereiche eines Kontos – in fester Reihenfolge und ohne Unfug.
 *
 * Gelesen wird aus einem frei beschreibbaren Feld: Was dort steht, kann aus
 * einer früheren Fassung stammen oder von Hand hineingeraten sein. Deshalb
 * wird gefiltert statt vertraut, und die Reihenfolge kommt aus
 * `ASSISTANT_AREAS` – so stehen die Bereiche überall gleich, gleich in
 * welcher Reihenfolge sie angeklickt wurden.
 *
 * Ohne die Rolle `assistant` ist die Antwort leer, auch wenn das Feld etwas
 * enthält: Ein Vollzugriff sieht ohnehin alles, und ein wartendes Konto darf
 * nicht dadurch hereinkommen, dass jemand einmal einen Haken gesetzt hat.
 */
export function assistantAreasOf(
  user: Pick<AppUser, 'role' | 'active' | 'assistantAreas'> | null | undefined,
): AssistantArea[] {
  if (!user || user.role !== 'assistant' || user.active !== true) return []
  const stored = user.assistantAreas
  if (!Array.isArray(stored)) return []
  return ASSISTANT_AREAS.filter((area) => stored.includes(area))
}

/**
 * Was ein Bereich einem Konto erlaubt.
 *
 * Drei Zustände und nicht zwei: Ein Bereich kann zu sein, offenstehen oder
 * offenstehen **und** beschreibbar sein. Die Trennung von Sehen und Ändern
 * ist der Grund, weshalb es diese Rolle überhaupt gibt – wer die Lieder
 * aussucht, soll die Ansprachen sehen können, ohne sie umzustellen.
 */
export type AreaAccess = 'none' | 'read' | 'write'

export const AREA_ACCESS_LABELS: Record<AreaAccess, string> = {
  none: 'Kein Zugriff',
  read: 'Nur lesen',
  write: 'Bearbeiten',
}

/**
 * Welche Bereiche dieses Konto auch **ändern** darf.
 *
 * Immer eine Teilmenge von `assistantAreasOf`: Was nicht offensteht, lässt
 * sich auch nicht beschreiben – sonst hinge an einem vergessenen Eintrag ein
 * Schreibrecht auf etwas, das gar nicht zu sehen ist.
 *
 * Fehlt das Feld ganz, gilt jeder offene Bereich als beschreibbar. Das ist
 * der Altbestand: Bis es die Unterscheidung gab, durfte eine Assistenz in
 * ihren Bereichen arbeiten – ein fehlendes Feld darf ihr das nicht über
 * Nacht wegnehmen. Eine leere Liste heisst dagegen ausdrücklich «nur
 * lesen», und zwar überall.
 *
 * Dieselbe Unterscheidung steht in `firestore.rules` (`assistantWrites`) –
 * beide müssen zusammen geändert werden.
 */
export function assistantWriteOf(
  user: Pick<AppUser, 'role' | 'active' | 'assistantAreas' | 'assistantWrite'> | null | undefined,
): AssistantArea[] {
  const areas = assistantAreasOf(user)
  const stored = user?.assistantWrite
  if (!Array.isArray(stored)) return areas
  return areas.filter((area) => stored.includes(area))
}

/** In welcher Reihenfolge die drei Zustände zur Wahl stehen. */
export const AREA_ACCESS_ORDER: AreaAccess[] = ['none', 'read', 'write']

/** Was jeder der drei Bereiche diesem Konto erlaubt – für die Benutzerverwaltung. */
export function assistantAccessOf(
  user: Pick<AppUser, 'role' | 'active' | 'assistantAreas' | 'assistantWrite'> | null | undefined,
): Record<AssistantArea, AreaAccess> {
  const areas = assistantAreasOf(user)
  const write = assistantWriteOf(user)
  return {
    talks: !areas.includes('talks') ? 'none' : write.includes('talks') ? 'write' : 'read',
    music: !areas.includes('music') ? 'none' : write.includes('music') ? 'write' : 'read',
    prayers: !areas.includes('prayers') ? 'none' : write.includes('prayers') ? 'write' : 'read',
  }
}

/**
 * Die Bereiche eines Kontos als Satz – «Musik (bearbeiten), Gebet (nur lesen)».
 *
 * Steht an zwei Stellen: in der Kontozeile der Benutzerverwaltung und in der
 * Meldung nach dem Freischalten. Beide sagen dasselbe, also sagt es eine
 * Stelle. Leer bleibt der Satz, wenn kein Bereich offensteht – dann ist der
 * Zugang entzogen, und das steht dort ausgeschrieben.
 */
export function assistantAccessSummary(access: Record<AssistantArea, AreaAccess>): string {
  return ASSISTANT_AREAS.filter((area) => access[area] !== 'none')
    .map(
      (area) =>
        `${ASSISTANT_AREA_LABELS[area]} (${access[area] === 'write' ? 'bearbeiten' : 'nur lesen'})`,
    )
    .join(', ')
}

/**
 * Aus der Wahl je Bereich die beiden Listen, wie sie am Konto stehen.
 *
 * Die Oberfläche fragt je Bereich nach einem der drei Zustände; gespeichert
 * werden zwei Listen. Diese Umrechnung steht hier und nicht in der Ansicht,
 * damit sie beim Freischalten und beim späteren Ändern dieselbe ist.
 */
export function assistantListsFrom(access: Record<AssistantArea, AreaAccess>): {
  areas: AssistantArea[]
  write: AssistantArea[]
} {
  return {
    areas: ASSISTANT_AREAS.filter((area) => access[area] !== 'none'),
    write: ASSISTANT_AREAS.filter((area) => access[area] === 'write'),
  }
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
 * Die Reihenfolge der Konten in der Benutzerverwaltung.
 *
 * Nach Namen sortiert stünde ein AP-Zugang mitten in der Bischofschaft,
 * obwohl beide grundverschiedene Dinge zu sehen bekommen. Nach der Rolle
 * sortiert beantwortet die Liste die Frage, mit der man sie aufschlägt –
 * «wer sieht was?»: zuerst die Bischofschaft mit Vollzugriff, dann wer den
 * AP-Kalender bearbeiten darf, zuletzt wer ihn nur ansieht.
 */
export const ROLE_ORDER: Role[] = [
  'bishop',
  'counselor1',
  'counselor2',
  // Die alte Sammelrolle steht bei den Ratgebern, wo sie hingehört.
  'counselor',
  'executive_secretary',
  'secretary',
  // Die Assistenz steht zwischen Vollzugriff und AP-Zugang: Sie sieht mehr
  // als der Kalender und weniger als die Bischofschaft.
  'assistant',
  'ap_editor',
  'ap_viewer',
  'pending',
]

/**
 * Rang einer Rolle für die Sortierung.
 *
 * Eine Rolle, die es hier nicht mehr gibt, kommt ans Ende und nicht an den
 * Anfang: `indexOf` gäbe dafür -1 zurück, und ein alter Datensatz führte
 * dann die Liste an.
 */
export function roleRank(role: Role): number {
  const index = ROLE_ORDER.indexOf(role)
  return index === -1 ? ROLE_ORDER.length : index
}

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
export type AccessLevel = 'full' | 'assistant' | 'ap_write' | 'ap_read'

export const ACCESS_LEVELS: { value: AccessLevel; role: Role; label: string; hint: string }[] = [
  {
    value: 'full',
    role: 'secretary',
    label: 'Vollzugriff',
    hint: 'Sieht und bearbeitet alles – für die Bischofschaft und die Sekretäre.',
  },
  {
    value: 'assistant',
    role: 'assistant',
    label: 'Assistenz · Abendmahlsversammlung',
    hint: 'Sieht ausschliesslich die Bereiche, die danach gewählt werden – Ansprachen, Musik, Gebet –, je Bereich nur lesend oder auch bearbeitend.',
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
  /**
   * Liste und Kacheln lesen den Plan der Reihe nach; die beiden
   * Kalenderansichten legen ihn auf ein Raster aus Wochentagen – dort sieht
   * man auch die Abende, an denen nichts ansteht.
   */
  mode: 'list' | 'cards' | 'week' | 'month'
  density: 'compact' | 'normal' | 'wide'
  /** Welcher Zeitraum – kommend, vergangen oder der ganze Plan */
  scope: 'upcoming' | 'past' | 'all'
  /**
   * Welche Arten der Plan zeigt – leer heisst «alle».
   *
   * Wer einschränkt, sucht etwas Bestimmtes: alle Klassen des Halbjahrs
   * etwa. Ausgefallene Abende gehören dann nicht dazu – sie erklären eine
   * Lücke im vollständigen Plan, in einer Auswahl erklären sie nichts.
   * Deshalb stehen sie gar nicht erst zur Wahl und fallen mit der ersten
   * Einschränkung weg (siehe `apVisibleActivities`).
   */
  kinds?: ApActivityKind[]
  /**
   * Die grosse Karte «Als Nächstes» über dem Plan.
   *
   * Wer den Plan überarbeitet, statt ihn zu lesen, kennt den nächsten Termin
   * längst – dann nimmt die Karte nur die oberste Bildschirmhöhe weg. Fehlt
   * die Angabe, steht sie da: So sah der Plan immer aus, und das ist die
   * Antwort auf die häufigere Frage.
   */
  showNext?: boolean
}

export const DEFAULT_AP_VIEW: ApView = {
  mode: 'list',
  density: 'normal',
  scope: 'upcoming',
  kinds: [],
  showNext: true,
}

export const AP_VIEW_MODE_LABELS: Record<ApView['mode'], string> = {
  list: 'Liste',
  cards: 'Kacheln',
  week: 'Kalender Woche',
  month: 'Kalender Monat',
}

/** Ist eine der beiden Kalenderansichten gewählt? */
export function isApCalendarMode(mode: ApView['mode']): mode is 'week' | 'month' {
  return mode === 'week' || mode === 'month'
}

/** Die Arten, die sich einzeln an- und abwählen lassen – ohne «Fällt aus». */
export const AP_FILTER_KINDS: ApActivityKind[] = ['activity', 'class', 'special']

/**
 * Die Arten, die ein Kalender-Abo zeigen kann – hier **mit** «Fällt aus».
 *
 * Anders als in der Ansicht: Dort erklärt ein ausgefallener Abend eine Lücke
 * im Plan und gehört deshalb immer dazu. Ein Kalender ist kein Plan, sondern
 * ein Terminkalender – wer den seinen nicht mit abgesagten Abenden füllen
 * will, soll sie abwählen können.
 */
export const AP_FEED_KINDS: ApActivityKind[] = ['activity', 'class', 'special', 'cancelled']

/**
 * Der Plan, auf die gewählten Arten eingeschränkt.
 *
 * Ohne Auswahl steht alles da, ausgefallene Abende eingeschlossen. Sobald
 * eingeschränkt wird, zählt nur noch, was ausdrücklich gewählt ist – und
 * «Fällt aus» ist nicht wählbar (siehe `ApView.kinds`).
 */
export function apVisibleActivities<T extends { kind: ApActivityKind }>(
  activities: T[],
  kinds: ApActivityKind[] | undefined,
): T[] {
  if (!kinds || kinds.length === 0) return activities
  return activities.filter((activity) => kinds.includes(activity.kind))
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
  /**
   * Ein Suchfeld über der Liste.
   *
   * Ausgeblendet, solange es nicht gebraucht wird: Gesucht wird selten, und
   * ein Feld, das immer dasteht, nimmt der Liste die oberste Zeile. Wer es
   * einblendet, durchsucht damit die angezeigten Sitzungen samt ihren
   * Traktanden und Pendenzen.
   */
  search?: boolean
}

export const DEFAULT_MEETINGS_VIEW: MeetingsView = {
  scope: 'upcoming',
  mode: 'plain',
  showPendenzen: true,
  agendaDetail: 'titles',
  pendenzenDetail: 'titles',
  search: false,
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
  /**
   * Welche Bereiche der Abendmahlsversammlung diesem Konto offenstehen.
   *
   * Gilt allein für die Rolle `assistant`; bei jeder anderen steht das Feld
   * still (siehe `assistantAreasOf`). Es gehört zum Zugriff und ist deshalb
   * wie `role` und `active` gegen die eigene Hand verriegelt – setzen kann es
   * allein das Administrator-Konto (siehe `firestore.rules`).
   *
   * Eine leere Liste heisst «nichts» und nicht «alles»: Wer alle Haken
   * entfernt, hat den Zugang entzogen, ohne die Rolle zu ändern.
   */
  assistantAreas?: AssistantArea[]
  /**
   * Welche dieser Bereiche das Konto auch **ändern** darf.
   *
   * Immer eine Teilmenge von `assistantAreas` (siehe `assistantWriteOf`):
   * Wer die Musik bearbeiten darf, sieht sie zwangsläufig auch. Damit lässt
   * sich je Sparte einzeln festlegen, ob jemand mitarbeitet oder bloss
   * nachschaut – die eine sucht die Lieder aus und liest bei den Ansprachen
   * nur mit.
   *
   * Fehlt das Feld, sind alle offenen Bereiche beschreibbar: So war es,
   * bevor es die Unterscheidung gab, und ein Konto verliert nichts dadurch,
   * dass die App dazugelernt hat. Eine leere Liste heisst «nur lesen».
   *
   * Gehört zum Zugriff und ist deshalb wie `role`, `active` und
   * `assistantAreas` gegen die eigene Hand verriegelt – setzen kann es
   * allein das Administrator-Konto (siehe `firestore.rules`).
   */
  assistantWrite?: AssistantArea[]
  /** Gemerkte Darstellung des Aktivitätenplans – gilt auf jedem Gerät */
  apView?: ApView
  /**
   * Darf den Bereich «Anti Doom» sehen – den geistigen Bereich für die AP’s
   * (siehe docs/KONZEPT-IMPULS.md).
   *
   * Ein Schalter am Konto und keine Rolle: Der Zugang ist unabhängig davon,
   * ob jemand nur den AP-Kalender liest oder Vollzugriff hat, und er wird
   * pro Konto vergeben. Setzen kann ihn allein das Administrator-Konto –
   * die Selbst-Update-Regel in `firestore.rules` sperrt das Feld wie `role`
   * und `active`, sonst schaltete sich jedes Konto den Bereich selbst frei.
   * Das Administrator-Konto sieht den Bereich immer, auch ohne Schalter.
   */
  impulse?: boolean
  /**
   * Darf im Bereich «Anti Doom» Inhalte pflegen und moderieren.
   *
   * Noch ohne Wirkung – die Redaktion ist vorerst das Administrator-Konto.
   * Das Feld ist trotzdem von Anfang an in den Regeln verriegelt, damit
   * die Redaktion später nur noch Oberfläche braucht und keine
   * Regeländerung.
   */
  impulseEditor?: boolean
  /** Farbe für Zuweisungs-Chips (Tailwind-Token-Name, siehe constants.ts) */
  color?: string
  active: boolean
  lastLoginAt?: TS | null
  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Zugriffsprotokoll                                                   */
/* ------------------------------------------------------------------ */

/**
 * Das Protokoll darüber, wer die App benutzt – und was dabei geschieht.
 *
 * Beides steht in **einer** Sammlung (`accessLog`), unterschieden durch
 * `kind`. Der Grund ist die Ansicht: Aufgeklappt zeigt sie einen einzigen
 * Zeitstrahl je Konto, in dem ein Besuch und die Änderungen daraus
 * beieinanderstehen – «um 20:14 gekommen, um 20:16 die Traktandenliste
 * umgestellt». Zwei Sammlungen wären zwei Abfragen und zwei Regelblöcke für
 * dieselbe Frage.
 *
 * Lesen darf das Protokoll ausschliesslich das Administrator-Konto; schreiben
 * darf jedes angemeldete Konto, aber nur Einträge über sich selbst. Beides
 * steht in `firestore.rules` und wird dort durchgesetzt, nicht hier.
 *
 * Es ist ein Protokoll und keine Beweissicherung: Geschrieben wird aus dem
 * Browser heraus, also von genau dem Gerät, über das es Auskunft gibt. Wer
 * die App mit abgeschaltetem JavaScript oder direkt über die
 * Firestore-Schnittstelle benutzte, käme darin nicht vor. Für die Frage, wer
 * die App wie oft benutzt und wer woran gearbeitet hat, reicht das; für den
 * Nachweis gegenüber jemandem, der sie zu umgehen versucht, nicht.
 */
export type LogKind = 'session' | 'change'

/** Ein Besuch oder eine Änderung – die gemeinsamen Felder. */
interface LogEntryBase extends WithId {
  kind: LogKind
  /** Firebase-Auth-UID; bleibt lesbar, auch wenn das Profil später verschwindet. */
  uid: string
  /*
   * Name und Adresse werden **mitgeschrieben** statt nachgeschlagen.
   *
   * Ein gelöschtes Konto liesse sich sonst nicht mehr benennen – und
   * ausgerechnet dessen Spur will man im Zweifel lesen können.
   */
  email: string
  displayName: string
  /** Beginn des Besuchs bzw. Zeitpunkt der Änderung */
  at: TS
}

/** Ein Besuch: von der ersten bis zur letzten Regung in derselben Sitzung. */
export interface SessionEntry extends LogEntryBase {
  kind: 'session'
  /** Zuletzt gesehen – wächst, solange die Sitzung läuft. */
  endedAt?: TS | null
  /** Wie viele Ansichten in diesem Besuch geöffnet wurden */
  views: number
  /** «iPhone · Safari» – aus der Browserkennung gelesen */
  device?: string
  /** Als App installiert (statt im Browser-Tab)? */
  standalone?: boolean
  /** Ortsangabe aus dem Netz des Zugriffs, sofern verfügbar */
  city?: string
  region?: string
  country?: string
  countryCode?: string
  /** Zeitzone des Geräts – die Ortsangabe, die immer da ist */
  timezone?: string
  ip?: string
}

export type ChangeOp = 'create' | 'update' | 'delete'

export const CHANGE_OP_LABELS: Record<ChangeOp, string> = {
  create: 'angelegt',
  update: 'geändert',
  delete: 'gelöscht',
}

/** Eine Änderung am Datenbestand. */
export interface ChangeEntry extends LogEntryBase {
  kind: 'change'
  /** Zu welchem Besuch sie gehört – verbindet Zeitstrahl und Zeile. */
  sessionId?: string | null
  /** Name der Firestore-Sammlung, z. B. «agendaItems» */
  collectionId: string
  op: ChangeOp
  docId?: string
  /** Woran gearbeitet wurde, in Worten: «Budget 2027» */
  label?: string
  /** Welche Felder sich geändert haben, bereits übersetzt */
  fields?: string[]
  /**
   * Wie viele Datensätze zusammengefasst sind.
   *
   * Ein Import schreibt Hunderte Datensätze in wenigen Sekunden. Jeden davon
   * einzeln festzuhalten machte das Protokoll unlesbar und teuer; sie werden
   * deshalb zu einer Zeile zusammengezogen (siehe `lib/audit`). Fehlt das
   * Feld oder steht 1 darin, ist es eine einzelne Änderung.
   */
  count?: number
}

export type LogEntry = SessionEntry | ChangeEntry

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

  /**
   * Formatierung zu Titel und Beschreibung – als JSON **neben** dem Text
   * (siehe `lib/richtext`), wie die Erwähnungen neben dem Text stehen.
   *
   * Der Text bleibt das führende Feld: Suche, Protokoll und Export lesen
   * ihn unverändert. Passt das Formatfeld nicht mehr zum Text – etwa weil
   * eine ältere Fassung nur den Text geschrieben hat –, wird es beim
   * Anzeigen stillschweigend übergangen. `null` heisst: nichts formatiert.
   */
  titleRich?: string | null
  descriptionRich?: string | null

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
  /**
   * Wer zuletzt am Inhalt gearbeitet hat – das Gegenstück zu `editedAt`.
   *
   * Fehlt an allem, was vor dieser Angabe geschrieben wurde: Nachträglich
   * lässt sich nicht ermitteln, wer damals getippt hat, und ein geratener
   * Name wäre schlimmer als keiner. Alte Einträge nennen deshalb nur den, der
   * sie erfasst hat.
   */
  editedBy?: string
  completedAt?: TS | null
  completedBy?: string | null

  /* ---------------- Monatsverantwortung ---------------- */

  /**
   * Aus welcher Monatspendenz dieser Eintrag entstanden ist.
   *
   * Gesetzt heisst: Der Eintrag gehört nicht jemandem persönlich, sondern
   * dem Monat – und damit der Person, die ihn führt. Er steht in keiner
   * Sitzung, wird beim Planen nicht mitgenommen und im Protokoll nicht
   * gedruckt (siehe `lib/monthlyDuties`).
   */
  dutyId?: string | null
  /** Für welchen Monat er gilt – «2026-08». */
  dutyMonth?: string | null
  /**
   * Wer den Monat führte, als der Eintrag zuletzt zugewiesen wurde.
   *
   * Nicht dasselbe wie `assignees`: Wechselt die Leitung mitten im Monat,
   * tritt die neue Person an die Stelle der alten – wer von Hand
   * dazugeschrieben wurde, bleibt stehen. Ohne dieses Feld wäre nicht zu
   * unterscheiden, welcher der Zuständigen der Monatsleitung entstammt.
   */
  dutyLeaderId?: string | null
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
/* Monatsverantwortung                                                 */
/* ------------------------------------------------------------------ */

/**
 * Eine Aufgabe, die zur Leitung des Monats gehört.
 *
 * Die Bischofschaft teilt die Monate unter sich auf – einer nimmt den
 * August, der nächste den September –, und mit dem Monat kommt immer
 * dasselbe Häufchen Arbeit: Ansprachen anfragen, Gebete verteilen, den
 * Ablauf beisammenhalten. Das ist keine Pendenz, die einmal anfällt und
 * dann erledigt ist, sondern eine, die jeden Monat wiederkehrt – nur eben
 * bei einer anderen Person.
 *
 * Deshalb steht hier die **Vorlage** und nicht die Aufgabe selbst. Aus ihr
 * entsteht Monat für Monat eine gewöhnliche Pendenz, zugewiesen an den, der
 * den Monat führt (siehe `lib/monthlyDuties` und `services/monthlyDuties`).
 * Wer den Wortlaut ändert, ändert ihn für die kommenden Monate; die
 * Pendenzen, die schon dastehen, bleiben, wie sie sind – dort ist womöglich
 * bereits etwas dazugeschrieben worden.
 *
 * Das Gegenstück zur wiederkehrenden Bekanntmachung (`AnnouncementSeries`),
 * mit einem Unterschied: Eine Bekanntmachung wird bei jedem Aufruf
 * dazugerechnet, eine Pendenz dagegen wirklich angelegt. Sie wird
 * abgehakt, bearbeitet und trägt einen Verlauf – das alles braucht einen
 * Datensatz, an dem es stehen kann.
 */
export interface MonthlyDuty extends WithId {
  title: string
  description?: string
  /** Ab welchem Monat sie anfällt, «2026-08». */
  startMonth: string
  /**
   * Bis und mit welchem Monat – `null` heisst: läuft weiter.
   *
   * Beendet wird eine Aufgabe und nicht gelöscht: Die Pendenzen der
   * vergangenen Monate bleiben stehen, samt allem, was in ihnen notiert
   * wurde. Gelöscht wird nur, was von Anfang an ein Versehen war.
   */
  endMonth?: string | null
  createdAt?: TS
  updatedAt?: TS
  createdBy?: string
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
 * Die Organisationen der Gemeinde, nach denen die Mitgliederliste gefiltert
 * werden kann.
 *
 * Nicht zu verwechseln mit `Organization`: Das sind die Organisationen, in
 * denen jemand **berufen** ist – Bischofschaft, Sonntagsschule, Musik. Hier
 * geht es um die Gruppe, zu der jemand **gehört**, und die ergibt sich aus
 * Alter und Familienstand. Wer beides zusammenlegte, könnte die
 * PV-Leiterin nicht mehr von den Kindern unterscheiden.
 *
 * Wie die Grenzen verlaufen, steht in `lib/organizations`.
 */
export type MemberOrganization = 'pv' | 'jdap' | 'jae' | 'ae'

export const MEMBER_ORGANIZATION_LABELS: Record<MemberOrganization, string> = {
  pv: 'PV',
  jdap: 'JD / AP',
  jae: 'JAE',
  ae: 'AE',
}

/** Die ausgeschriebene Form – für Erklärungen und Tooltips. */
export const MEMBER_ORGANIZATION_NAMES: Record<MemberOrganization, string> = {
  pv: 'Primarvereinigung',
  jdap: 'Junge Damen und Aaronisches Priestertum',
  jae: 'Junge Alleinstehende Erwachsene',
  ae: 'Alleinstehende Erwachsene',
}

/**
 * Die Schlagwörter, unter denen JAE und AE am Mitglied stehen.
 *
 * Sie liegen in `tags` und nicht in einem eigenen Feld: Es ist genau das,
 * wofür `tags` da ist – eine Zugehörigkeit, die sich weder aus dem
 * Geburtsdatum noch aus dem Verzeichnis ergibt. Gesetzt werden sie beim
 * Import der beiden LCR-Listen (siehe `services/importSingles`), im Profil
 * lassen sie sich mit einem Griff nachziehen.
 *
 * Der Wert ist zugleich die Beschriftung – er steht so im Profil.
 */
export const MEMBER_ORGANIZATION_TAGS = {
  jae: 'JAE',
  ae: 'AE',
} as const

/** Welche der beiden Listen importiert wird. */
export type SinglesKind = keyof typeof MEMBER_ORGANIZATION_TAGS

/**
 * Was die Mitgliederliste zeigt und in welcher Reihenfolge.
 *
 * Alles davon steht hinter «Ansicht» oben rechts – so wie auf jeder anderen
 * Seite auch. Über der Liste bleibt damit die Suche, und sonst nichts.
 */
export interface MembersView {
  status: MemberStatus | 'all'
  gender: Gender | 'all'
  /**
   * Nach welchen Organisationen eingeschränkt wird – leer heisst «alle».
   *
   * Eine Mehrfachauswahl, weil «alle JAE und AE» eine gewöhnliche Frage ist
   * und «alle, die zugleich JAE und AE sind» keine. Sie steht neben den
   * übrigen Einschränkungen und wirkt mit ihnen zusammen: JAE **und** Frauen
   * **und** 18 bis 25 ist die Liste, nach der man am Sitzungstisch fragt.
   */
  organizations: MemberOrganization[]
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
  organizations: [],
  minAge: null,
  maxAge: null,
  sort: 'name',
  direction: 'asc',
}

/**
 * Was «Filter zurücksetzen» wiederherstellt.
 *
 * Nicht die Vorgabe der Ansicht: Die zeigt nur die aktiven Mitglieder, und
 * wer alle Einschränkungen wegnimmt, will alle sehen. Die Sortierung bleibt
 * unangetastet – sie schränkt nichts ein, sondern ordnet nur, und wer nach
 * dem Alter sortiert arbeitet, soll das nach dem Zurücksetzen weiterhin tun.
 */
export const MEMBERS_FILTER_RESET = {
  status: 'all',
  gender: 'all',
  organizations: [],
  minAge: null,
  maxAge: null,
} satisfies Partial<MembersView>

/** Schränkt diese Ansicht überhaupt etwas ein? */
export function hasMemberFilters(view: MembersView): boolean {
  return (
    view.status !== MEMBERS_FILTER_RESET.status ||
    view.gender !== MEMBERS_FILTER_RESET.gender ||
    view.organizations.length > 0 ||
    view.minAge !== null ||
    view.maxAge !== null
  )
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
 * Auf welche Sparte die Liste eingeschränkt ist – «nur die PV».
 *
 * «Ausserhalb der Einheit» steht neben den Organisationen und nicht darin.
 * Auch diese Berufungen tragen eine Organisation, gehören aber nicht zum
 * Organisationsplan der Gemeinde: Der Sonntagsschulpräsident des Pfahls ist
 * nicht der Sonntagsschulpräsident der Gemeinde.
 */
export type CallingOrganizationScope = 'all' | Organization | 'out_of_unit'

/** Die Reihenfolge zählt: Sie ist die des Auswahlfelds. */
export const CALLING_ORGANIZATION_SCOPE_LABELS: Record<CallingOrganizationScope, string> = {
  all: 'Alle Organisationen',
  ...ORGANIZATION_LABELS,
  out_of_unit: 'Ausserhalb der Einheit',
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
  organization: CallingOrganizationScope
  gender: Gender | 'all'
  minAge: number | null
  maxAge: number | null
  sort: CallingSort
  direction: SortDirection
}

export const DEFAULT_CALLINGS_VIEW: CallingsView = {
  scope: 'active',
  audience: 'all',
  organization: 'all',
  gender: 'all',
  minAge: null,
  maxAge: null,
  sort: 'organization',
  direction: 'asc',
}

/**
 * Weicht die Ansicht überhaupt von der Vorgabe ab?
 *
 * Gefragt wird über alle Felder statt über eine Aufzählung von Hand: Was
 * später dazukommt, ist damit von selbst mitgezählt – und ein Knopf «Alle
 * Filter entfernen», der eine Einschränkung übersieht, wäre schlimmer als
 * keiner. Alle Felder der Ansicht sind einfache Werte; ein Vergleich mit
 * `!==` genügt.
 */
export function hasCallingFilters(view: CallingsView): boolean {
  return (Object.keys(DEFAULT_CALLINGS_VIEW) as (keyof CallingsView)[]).some(
    (key) => view[key] !== DEFAULT_CALLINGS_VIEW[key],
  )
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
   * Eigene Gründe für die Wahl «Was findet statt?».
   *
   * Die sieben eingebauten Arten decken den Jahreslauf ab, aber nicht jeden
   * Sonderfall: eine Taufversammlung, ein Besuch der Missionspräsidentschaft,
   * ein Gemeindetag. Solche Anlässe kommen wieder – deshalb steht der Grund
   * in den Einstellungen und nicht am einzelnen Sonntag; einmal erfasst, ist
   * er an jedem Sonntag wählbar.
   *
   * Wer eine Versammlung präsidiert oder leitet, steht bewusst **nicht** so
   * in den Einstellungen: Dort kommt ausser der Bischofschaft niemand
   * regelmässig vor (siehe `LeaderField`).
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
  /**
   * Wann die beiden Listen der Alleinstehenden zuletzt importiert wurden.
   *
   * Nicht bloss fürs Protokoll: Daran hängt, wer zwischen zwei Importen als
   * JAE gilt. Die Liste des LCR ist die Wahrheit über den Familienstand, aber
   * sie altert – wer nach dem Import achtzehn wird, steht noch nicht darauf
   * und fiele bis zum nächsten Mal aus jeder Gruppe heraus. Mit diesem Datum
   * lässt sich genau das schliessen, ohne etwas zu raten und ohne etwas zu
   * schreiben (siehe `lib/organizations`).
   */
  singlesImportedAt?: Partial<Record<SinglesKind, TS | null>>
  /**
   * Das Monatsthema der Abendmahlsversammlung – je Monat («2026-09») ein Satz.
   *
   * Es gehört dem Monat und nicht dem einzelnen Sonntag: Die Bischofschaft
   * legt ein Thema fest, und die vier oder fünf Sonntage darunter tragen es
   * alle. Am Sonntag gespeichert müsste es viermal eingetragen und viermal
   * geändert werden, und beim ersten vergessenen stünde eine falsche Angabe.
   *
   * Es steht in den Einstellungen und nicht in einer eigenen Sammlung: Es ist
   * eine Zeile Text je Monat, die überall gebraucht wird, wo ein Sonntag
   * dasteht – und die Einstellungen liegen ohnehin auf jedem Gerät. Damit
   * bekommt es zugleich die Rechte, die es braucht: Lesen darf sie jeder,
   * der die App benutzt, ändern nur der Vollzugriff. Die Assistenz sieht das
   * Thema deshalb, ohne dass es dafür eine eigene Regel bräuchte.
   *
   * Ein leerer Wert bedeutet «kein Thema» und wird beim Speichern entfernt,
   * damit die Einstellungen nicht mit leeren Monaten volllaufen.
   */
  sacramentThemes?: Record<string, string>
  updatedAt?: TS
}

/**
 * Das Thema, das an einem bestimmten Sonntag gilt.
 *
 * Gefragt wird mit einem Datum und geantwortet aus dem Monat dazu – die
 * Umrechnung steht in `lib/monthlyDuties` (`monthKey`), damit «welcher
 * Monat?» in der ganzen App dieselbe Antwort hat. Leer heisst: für diesen
 * Monat ist nichts festgelegt.
 */
export function sacramentThemeFor(
  themes: Record<string, string> | undefined,
  monthKey: string,
): string {
  return themes?.[monthKey]?.trim() ?? ''
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
  customSundayKinds: [],
  pendenzenSort: DEFAULT_PENDENZEN_SORT,
  pendenzenDoneSort: DEFAULT_PENDENZEN_DONE_SORT,
  sacramentThemes: {},
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
    /*
     * Monatsthemen: nur echte Monate mit echtem Text.
     *
     * Ein geleertes Feld schriebe sonst `''` in die Einstellungen, und die
     * Anzeige müsste an jeder Stelle prüfen, ob das Thema eines ist. Hier
     * fällt es weg – der Monat steht dann wieder ohne Thema da.
     */
    sacramentThemes: Object.fromEntries(
      Object.entries(merged.sacramentThemes ?? {})
        .map(([month, theme]) => [month, typeof theme === 'string' ? theme.trim() : ''] as const)
        .filter(([month, theme]) => /^\d{4}-\d{2}$/.test(month) && theme !== ''),
    ),
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
  /**
   * Begrüssungen zu Beginn der Versammlung – eine pro Zeile.
   *
   * Meist besuchende Führungsverantwortliche, aber nicht nur: auch der
   * Besuch aus einer anderen Gemeinde oder die heimgekehrte Missionarin
   * gehören begrüsst. Zeilenumbrüche bleiben erhalten (siehe `Conducting`).
   */
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

  /**
   * Reihenfolge der Bekanntmachungen an diesem Sonntag.
   *
   * Einträge sind Schlüssel: die ID des erfassten Eintrags oder
   * «serie:abc123» für eine wiederkehrende Bekanntmachung (siehe
   * `announcementKey` in `lib/series`). Nur so lassen sich die beiden
   * Arten miteinander ordnen – die Serien stehen ja nicht in
   * `announcements`, sie werden bei jedem Aufruf dazugerechnet.
   *
   * Was fehlt, steht hinten: Ein neu erfasster Eintrag und eine neu
   * fällige Serie kommen unten dazu, und ein Sonntag, an dem niemand
   * umgestellt hat, bleibt bei der gewohnten Folge – erfasste zuerst,
   * Serien danach.
   */
  announcementOrder?: string[]

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
   * Formatierung zu Titel und Text – als JSON neben dem Text, `null` heisst
   * unformatiert. Siehe `AgendaItem.titleRich` und `lib/richtext`.
   */
  titleRich?: string | null
  bodyRich?: string | null
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
 * Wann die AP-Klasse ist – und ab wann sie anders ist.
 *
 * Die einzige Art im Plan mit einer festen Stunde. Der Mittwochabend
 * beginnt mal um 19:00 und mal um 19:30, ein Lager hat gar keine Zeit –
 * die Klasse aber liegt am Sonntag zwischen den Versammlungen und dauert
 * genau eine Lektion. Das steht deshalb hier und nicht an jedem einzelnen
 * Termin: Eine neu angelegte Klasse bringt die Zeit mit, und eine, die
 * ohne Zeitangabe im Plan steht, wird trotzdem an ihrer Stunde gezeigt
 * (siehe `apStartTime`).
 *
 * **Ab September 2026 ändert sich der Takt**: Die Klasse ist nicht mehr am
 * 2. und 4., sondern an **jedem** Sonntag – und dafür kürzer, von 11:35
 * bis 12:00. Das alte Mass bleibt trotzdem stehen: Ein Plan reicht Jahre
 * zurück, und eine Klasse vom März 2026 war von 11 bis 12. Welche Stunde
 * gilt, entscheidet deshalb das Datum und nicht der heutige Tag.
 *
 * Wer eine Klasse ausnahmsweise verschiebt, trägt die Zeit am Termin ein –
 * die gilt dann vor der üblichen, und die übliche Dauer hängt sich daran.
 */
export const AP_CLASS_WEEKLY_FROM = '2026-09-01'

/** Bis August 2026: am 2. und 4. Sonntag, von 11 bis 12 Uhr. */
export const AP_CLASS_TIME = '11:00'
export const AP_CLASS_DURATION_MINUTES = 60

/** Ab September 2026: jeden Sonntag, von 11:35 bis 12:00. */
export const AP_CLASS_TIME_WEEKLY = '11:35'
export const AP_CLASS_DURATION_MINUTES_WEEKLY = 25

/** Wie lange eine Klasse an diesem Tag üblicherweise dauert. */
export function apClassDuration(date: string): number {
  return date >= AP_CLASS_WEEKLY_FROM ? AP_CLASS_DURATION_MINUTES_WEEKLY : AP_CLASS_DURATION_MINUTES
}

/**
 * Die übliche Stunde der Klasse an einem bestimmten Tag – «11:35» bis «12:00».
 *
 * Eine Stelle für beide Zeiten: Wer eine Klasse anlegt, den Plan erzeugt
 * oder die Themen einliest, fragt hier nach und muss den Stichtag nicht
 * kennen.
 */
export function apClassHours(date: string): { start: string; end: string } {
  const start = date >= AP_CLASS_WEEKLY_FROM ? AP_CLASS_TIME_WEEKLY : AP_CLASS_TIME
  return { start, end: apTimePlus(start, apClassDuration(date)) }
}

/**
 * Wann ein Termin beginnt – die erfasste Zeit oder die übliche.
 *
 * Das Zeitfeld ist bewusst meistens leer: Es steht dort nur, was von der
 * üblichen Zeit abweicht. Für die Klasse ist die übliche Zeit bekannt, für
 * alles Übrige nicht – ein Mittwochabend ohne Zeitangabe bekommt deshalb
 * keine erfundene Stunde, sondern bleibt ohne.
 */
export function apStartTime(activity: Pick<ApActivity, 'date' | 'kind' | 'time'>): string {
  const own = (activity.time ?? '').trim()
  if (own) return own
  return activity.kind === 'class' ? apClassHours(activity.date).start : ''
}

/**
 * Wann ein Termin endet – das erfasste Ende oder das übliche.
 *
 * Das Ende ist die Angabe, die dem Plan früher fehlte: Ein Kalender braucht
 * sie, sonst muss er die Länge raten. Erfasst wird sie am Termin, von Hand
 * und für jede Art – nur die Klasse bringt sie mit, weil sie ihre Lektion
 * dauert, ganz gleich wann sie beginnt.
 *
 * Bleibt sie leer, ist das keine Lücke, sondern eine Auskunft: Der Plan
 * weiss nicht, wie lange dieser Abend geht.
 */
export function apEndTime(
  activity: Pick<ApActivity, 'date' | 'kind' | 'time' | 'endTime'>,
): string {
  const own = (activity.endTime ?? '').trim()
  if (own) return own
  if (activity.kind !== 'class') return ''
  return apTimePlus(apStartTime(activity), apClassDuration(activity.date))
}

/**
 * Eine Uhrzeit um Minuten weiterstellen – «11:00» plus 60 wird «12:00».
 *
 * Gerechnet wird in Minuten seit Mitternacht und nicht mit einem `Date`: Es
 * geht um zwei Uhrzeiten am selben Tag, und die kennen weder Datum noch
 * Zeitzone. Was sich nicht als Zeit lesen lässt, bleibt, wie es ist – und
 * über Mitternacht hinaus wird nicht gerechnet: Eine Klasse, die um 23:30
 * begänne, ist keine Angabe, die man geradebiegt.
 */
export function apTimePlus(time: string, minutes: number): string {
  const match = /^\s*(\d{1,2})[:.](\d{2})/.exec(time)
  if (!match) return ''

  const total = Number(match[1]) * 60 + Number(match[2]) + minutes
  if (total >= 24 * 60) return ''

  const hour = Math.floor(total / 60)
  const minute = total % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * Die Zeit eines Termins als Text: «11:00 – 12:00», «19:30» oder gar nichts.
 *
 * Ein Termin ohne Ende zeigt nur seinen Beginn. Ein Strich ins Leere – «19:30
 * –» – sähe aus, als fehlte etwas beim Anzeigen; es fehlt aber im Plan.
 */
export function apTimeLabel(
  activity: Pick<ApActivity, 'date' | 'kind' | 'time' | 'endTime'>,
): string {
  const start = apStartTime(activity)
  if (!start) return ''

  const end = apEndTime(activity)
  return end ? `${start} – ${end}` : start
}

/* ------------------------------------------------------------------ */
/* Kommt, läuft, war                                                   */
/* ------------------------------------------------------------------ */

/**
 * Das Tagesende als Uhrzeit, mit der sich vergleichen lässt.
 *
 * «24:00» steht auf keiner Uhr, sortiert sich aber hinter jede Zeit des
 * Tages – und genau das wird dort gebraucht, wo der Plan keine Zeit kennt:
 * Ein Termin ohne erfasstes Ende ist am Ende seines Tages vorbei, keine
 * Minute früher.
 */
const AP_END_OF_DAY = '24:00'

/** Der letzte Tag eines Termins – mehrtägige Anlässe tragen `endDate`. */
export function apLastDay(activity: Pick<ApActivity, 'date' | 'endDate'>): string {
  return activity.endDate || activity.date
}

/** Alles, was es braucht, um einen Termin in die Zeit einzuordnen. */
type ApWhen = Pick<ApActivity, 'date' | 'endDate' | 'kind' | 'time' | 'endTime'>

/**
 * Wann ein Termin beginnt – als vergleichbarer Zeitpunkt «2026-07-12T11:00».
 *
 * Tag und Uhrzeit stehen am Termin getrennt und beide als Text. Zusammen
 * ergeben sie einen Zeitpunkt, der sich mit `<` und `>=` vergleichen lässt,
 * ohne `Date` und ohne Zeitzone – so rechnet der Plan überall.
 *
 * Ohne erfasste Zeit steht dort das Tagesende, und das ist kein Kniff,
 * sondern die ehrliche Auskunft: Der Plan weiss nicht, wann dieser Abend
 * losgeht, und behauptet deshalb den ganzen Tag über nicht, er laufe
 * bereits. Bei einem mehrtägigen Anlass trifft dieselbe Regel das Richtige –
 * ab dem zweiten Tag läuft er, ganz gleich, wann er am ersten begonnen hat.
 */
export function apStartsAt(activity: ApWhen): string {
  return `${activity.date}T${apStartTime(activity) || AP_END_OF_DAY}`
}

/**
 * Wann ein Termin vorbei ist – «2026-07-12T12:00».
 *
 * Die Uhrzeit gehört zum letzten Tag: Das Lager geht von Freitag bis Sonntag
 * 14:00. Ist kein Ende erfasst, gilt der Termin bis Mitternacht – der Plan
 * weiss nicht, wie lange der Abend geht, und schneidet ihn nicht ab.
 */
export function apEndsAt(activity: ApWhen): string {
  return `${apLastDay(activity)}T${apEndTime(activity) || AP_END_OF_DAY}`
}

/**
 * Wo ein Termin gegenüber «jetzt» steht.
 *
 * Die Frage entscheidet mehr als eine Beschriftung: Was vorbei ist, gehört
 * nicht mehr unter «Als Nächstes», nicht mehr in den Zeitraum «Kommend» und
 * auf der Übersicht nicht mehr in die Kachel. Gerechnet wird deshalb auf die
 * Minute genau und nicht auf den Tag: Die AP-Klasse ist um 12 Uhr zu Ende,
 * und um 15:50 als «läuft» dazustehen, wäre sichtbar falsch.
 */
export type ApActivityPhase = 'upcoming' | 'running' | 'past'

export function apActivityPhase(activity: ApWhen, now: string): ApActivityPhase {
  if (now >= apEndsAt(activity)) return 'past'
  if (now >= apStartsAt(activity)) return 'running'
  return 'upcoming'
}

/**
 * «Jetzt» in derselben Schreibweise wie ein Termin – «2026-08-09T15:50».
 *
 * Von Hand zusammengesetzt und nicht über `lib/dates` geholt: `lib/types`
 * kommt ohne das Firebase-SDK aus, und daran hängt die Netlify-Function, die
 * den Kalender ausliefert (siehe `lib/apIcs`).
 */
export function apMoment(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `${day}T${pad(now.getHours())}:${pad(now.getMinutes())}`
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
  /** Beginn, «19:30» – leer, wenn die übliche Zeit gilt */
  time?: string
  /**
   * Ende, «21:00» – leer, wenn der Plan es nicht weiss.
   *
   * Bei einem mehrtägigen Anlass die Uhrzeit am letzten Tag: Ein Lager geht
   * von Freitag 18:00 bis Sonntag 14:00.
   */
  endTime?: string
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

/* ------------------------------------------------------------------ */
/* Kalender-Abos                                                       */
/* ------------------------------------------------------------------ */

/**
 * Ein Link, unter dem der Aktivitätenplan als Kalender abrufbar ist.
 *
 * Damit lässt sich der Plan in Google Calendar, Apple Kalender oder Outlook
 * abonnieren: Die Programme holen die Datei von sich aus immer wieder und
 * zeigen so den Stand aus der App, ohne dass jemand etwas exportiert.
 *
 * **Für den ganzen Plan braucht es das hier nicht mehr.** Seit die Seite
 * unter `/ap` jedem offensteht, gibt die Function den Plan auch ohne Token
 * heraus – `/api/ap.ics`, der Link für den Aushang. Ein Token schützte
 * daran nichts mehr, was nicht ohnehin offenstünde.
 *
 * Ein Datensatz hier ist deshalb kein Schutz, sondern ein **Zuschnitt**: Er
 * zeigt wahlweise nur bestimmte Arten (`kinds`) – der Kalender einer
 * Beraterin muss die ausgefallenen Abende nicht enthalten –, und an ihm
 * steht, wann ein Kalenderprogramm zuletzt vorbeikam (`lastFetchedAt`). Das
 * beantwortet die einzige Frage, die bei einem Abo aufkommt: «Holt Google
 * den Link überhaupt?»
 *
 * Das Token bleibt lang und zufällig, und der Link lässt sich weiterhin
 * einzeln widerrufen. Beides kostet nichts und bleibt richtig, sollte der
 * Plan je wieder hinter die Anmeldung wandern: Google und Apple können sich
 * nirgends anmelden – sie rufen eine URL ab, sonst nichts, und was sie
 * dürfen, muss deshalb in der Adresse stecken.
 *
 * Deshalb benennt ein Link, **wer** ihn bekommen hat, und nicht, was er
 * zeigt: Ein Link «Nur Aktivitäten», den sich acht Leute teilen, lässt sich
 * nicht widerrufen, ohne allen achten den Kalender zu nehmen. Was er zeigt,
 * sagt `kinds`.
 */
export interface CalendarFeed extends WithId {
  /**
   * Das Geheimnis in der URL.
   *
   * Steht im Klartext in der Datenbank, und das ist die Voraussetzung dafür,
   * dass sich ein Link später noch einmal kopieren lässt – genau das braucht
   * man ein halbes Jahr danach, beim neuen Telefon. Als Hashwert wäre er nach
   * dem Anlegen ein für alle Mal weg.
   *
   * Lesen darf ihn jeder, der den Plan sieht; anlegen und widerrufen nur, wer
   * den Plan auch pflegen darf (siehe `firestore.rules`).
   */
  token: string
  /** Wofür der Link gedacht ist – «Berater», «Jugendführung», «Familie Müller» */
  label: string
  /**
   * Welche Arten der Kalender zeigt. Leer oder fehlend heisst: alle.
   *
   * Dieselbe Auswahl wie in der Ansicht der Seite. Wer die ausgefallenen
   * Abende nicht im Kalender haben will, nimmt sie hier heraus.
   */
  kinds?: ApActivityKind[]
  /** Ein widerrufener Link bleibt stehen, liefert aber nichts mehr aus. */
  active: boolean
  createdAt?: TS
  createdById?: string | null
  /**
   * Wann der Link zuletzt abgerufen wurde.
   *
   * Die einzige verlässliche Antwort auf «warum sehe ich den Kalender
   * nicht?»: Steht hier nichts, hat Google den Link nie geholt – dann liegt
   * es am Abo und nicht an den Terminen.
   */
  lastFetchedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Anti Doom                                                           */
/* ------------------------------------------------------------------ */

/*
 * Der Bereich «Anti Doom» – der geistige Bereich für die AP's
 * (docs/KONZEPT-IMPULS.md).
 *
 * Die tragende Einheit ist die ISO-Woche («2026-W34», Montag bis Sonntag):
 * Veröffentlicht wird am Montag, aufgelöst am Sonntag. Ein Inhalt gehört zu
 * genau einer Woche – oder zu keiner: Dann liegt er im Fragenpool und
 * wartet darauf, geplant zu werden. Die Wochenrechnung steht in
 * `lib/impulse`.
 */

/**
 * Was ein Inhalt ist.
 *
 * Alle Arten sind wochenweise geplant. Die **Feed-Karten** des Vollbilds
 * sind das Wochenthema, die Quizfrage, das Bilderrätsel, die Frage der
 * Woche, der Feed und die Teilen-Aufgabe. Das **Wochenziel** und
 * die **Tages-Challenge** sind Aufgaben neben dem Feed – das eine für die
 * ganze Woche, das andere Tag für Tag abhakbar. Abgehakt wird per
 * Selbstauskunft, und der Stand liegt am eigenen Fortschrittsdokument
 * (`ImpulseProgress`), nicht am Inhalt.
 */
export type ImpulseKind =
  | 'impuls'
  | 'quiz'
  | 'bilderraetsel'
  | 'video'
  | 'wochenziel'
  | 'tageschallenge'
  | 'frage'
  | 'feed'
  | 'teilen'

export const IMPULSE_KIND_LABELS: Record<ImpulseKind, string> = {
  impuls: 'Wochenthema',
  quiz: 'Quizfrage',
  bilderraetsel: 'Bilderrätsel',
  video: 'Video',
  wochenziel: 'Wochenziel',
  tageschallenge: 'Tages-Challenge',
  frage: 'Frage der Woche',
  feed: 'Feed-Karte',
  teilen: 'Teilen-Aufgabe',
}

/**
 * Wie eine Quizfrage beantwortet wird.
 *
 * `choice` deckt die meisten Formen aus dem Konzept ab – Multiple Choice,
 * Wahr/Falsch, «Wer hat's gesagt?», Emoji-Rätsel, Reihenfolge als Auswahl –,
 * denn sie unterscheiden sich im Inhalt, nicht in der Mechanik. `text` ist
 * die Suchfrage: Die Antwort steht in der verlinkten Quelle und wird frei
 * eingetippt.
 */
export type ImpulseQuizForm = 'choice' | 'text'

export const IMPULSE_QUIZ_FORM_LABELS: Record<ImpulseQuizForm, string> = {
  choice: 'Auswahl',
  text: 'Freie Antwort (Suchfrage)',
}

export interface ImpulseQuiz {
  form: ImpulseQuizForm
  /** Bei `choice`: die Antworten in der angezeigten Reihenfolge (2–6). */
  options: string[]
  /** Bei `choice`: welche Antwort stimmt – Index in `options`. */
  answerIndex: number
  /** Bei `text`: die Lösung, wie sie in der Auflösung stehen soll. */
  answerText: string
  /** Der Lernmoment: zwei, drei Sätze, warum die Antwort stimmt. */
  explanation: string
}

/**
 * Woher ein Inhalt stammt.
 *
 * Immer offizielles Material der Kirche, immer mit Quellenangabe – kurze
 * Auszüge in der App, der Rest hinter dem Link. Die Quelle ist deshalb
 * Voraussetzung dafür, dass ein Inhalt «bereit» werden darf (siehe
 * `readyProblems` in `lib/impulse`).
 */
export interface ImpulseSource {
  /** «Alma 32:21», «Generalkonferenz Okt. 2025, Präsident …» */
  label: string
  /** Tiefer Link auf churchofjesuschrist.org bzw. in die Evangeliumsbibliothek */
  url: string
}

/**
 * Das Bild einer Karte.
 *
 * Jede Kartenart darf eines tragen – beim Bilderrätsel ist es das Rätsel
 * selbst, sonst das Bild zum Thema; im Vollbild-Feed füllt es die erste
 * Seite der Karte. Wie die Quellen kommt es aus dem offiziellen Material:
 * ein Link in die Mediathek der Kirche (churchofjesuschrist.org/media),
 * kein hochgeladenes Foto – die App speichert nur die Adresse und lädt
 * das Bild von dort.
 */
export interface ImpulseImage {
  url: string
  /** Was zu sehen ist – für Vorlesende und wenn das Bild nicht lädt. */
  alt?: string
  /**
   * Nur diesen Ausschnitt zeigen – fehlt er, gilt das ganze Bild.
   *
   * Die Redaktion zieht ihn im Zuschneidefenster neben dem Bild-Link
   * (`ImpulseImageCropper`); gerechnet wird damit in `lib/impulseCrop`.
   */
  crop?: ImpulseImageCrop | null
}

/**
 * Der Ausschnitt eines Bildes – vier Masse in Prozent des Originals,
 * dazu sein Seitenverhältnis.
 *
 * Prozent, weil die Karte das Bild nicht erst vermessen soll; das
 * Seitenverhältnis (Breite ÷ Höhe des Ausschnitts, in echten Bildpunkten),
 * weil Prozent allein nicht sagen, wie hoch der Ausschnitt neben seiner
 * Breite steht. Es wird beim Zuschneiden festgehalten, wo das Bild
 * ohnehin offen liegt.
 */
export interface ImpulseImageCrop {
  /** Die linke obere Ecke des Ausschnitts, 0–100. */
  x: number
  y: number
  /** Breite und Höhe des Ausschnitts, 0–100. */
  width: number
  height: number
  ratio: number
}

/**
 * `draft` sieht nur die Redaktion. `ready` erscheint bei den AP's, sobald
 * die Woche des Inhalts beginnt – veröffentlicht wird also nicht von Hand
 * am Montagmorgen, sondern durch den Kalender: Die Redaktion plant Wochen
 * im Voraus, die App schaltet um.
 */
export type ImpulseStatus = 'draft' | 'ready'

export const IMPULSE_STATUS_LABELS: Record<ImpulseStatus, string> = {
  draft: 'Entwurf',
  ready: 'Bereit',
}

export interface ImpulseItem extends WithId {
  /**
   * Die Woche, zu der der Inhalt gehört – «2026-W34».
   *
   * `null` heisst: noch keiner Woche zugeteilt. Das ist der Fragenpool –
   * Ideen entstehen, wann immer sie einfallen, und werden später geplant.
   */
  week: string | null
  kind: ImpulseKind
  status: ImpulseStatus
  /** Überschrift; bei der Quizfrage die Frage, bei der Feed-Karte ihr Text. */
  title: string
  /** Wochenthema: die Hinführung, zwei, drei Sätze. Sonst optionale Ergänzung. */
  body?: string
  /**
   * Die Vertiefung – erscheint im Vollbild-Feed beim Wisch nach links.
   *
   * Freitext mit weiterführenden Gedanken, Quellen und Links (Adressen
   * werden beim Anzeigen anklickbar, siehe `lib/links`). Nur Karten mit
   * Vertiefung zeigen den Wisch-Hinweis; ohne bleibt die Karte, wie sie ist.
   */
  deepening?: string | null
  /**
   * Eigener Titel der Vertiefungsseite – leer heisst: Über der
   * Vertiefung steht der Titel der Hauptkarte (der Normalfall).
   */
  deepeningTitle?: string | null
  /**
   * Eigene Quelle der Vertiefungsseite – ohne sie zeigt die Seite die
   * Quelle der Hauptkarte, wie eh und je.
   */
  deepeningSource?: ImpulseSource | null
  /**
   * Platz innerhalb der Art und Woche – für Arten mit mehreren Karten
   * (Feed, Quizfrage, Bilderrätsel).
   *
   * Der Feed ist redaktionell und endlich: Die Reihenfolge legt die
   * Redaktion, kein Algorithmus. Fehlt das Feld, kommt die Karte ans Ende.
   */
  order?: number
  quiz?: ImpulseQuiz | null
  /** Das Bild der Karte – jede Art darf eines tragen. */
  image?: ImpulseImage | null
  /**
   * Das Video einer Video-Karte – ein Link, kein Upload.
   *
   * Am besten läuft es in der App, wenn die Adresse direkt auf die
   * Videodatei zeigt (`…mp4`, der Download-Link aus der Mediathek der
   * Kirche) oder auf YouTube bzw. Vimeo. Alles andere bleibt eine Karte
   * mit Knopf, die das Video draussen öffnet (siehe `lib/impulseVideo`).
   */
  videoUrl?: string | null
  /**
   * Braucht die Video-Karte zwei Wische statt einem?
   *
   * Standard ist einer: Das Video hat den Bildschirm für sich, und der
   * nächste Wisch bringt schon die nächste Karte. Wo der Text dazu
   * gehört – eine Frage zum Schauen, ein Gedanke danach –, setzt die
   * Redaktion diesen Haken: Dann fährt er beim zweiten Wisch über das
   * Video, wie bei jeder Bildkarte. Gilt nur für Video-Karten; Bilder
   * tragen ihren Text immer auf der zweiten Seite.
   */
  videoTextPage?: boolean | null
  source?: ImpulseSource | null
  /**
   * «Eingereicht von Luca» – der Vorname, wenn der Inhalt aus der
   * Mitmach-Ecke stammt. Wer je eine Karte beigesteuert hat, liest die
   * anderen anders.
   */
  contributor?: string | null
  createdAt?: TS
  updatedAt?: TS
  createdBy?: string
}

/**
 * Eine Einreichung aus der Mitmach-Ecke.
 *
 * Die AP's liefern selbst – und zwar für jede Kartenart: ein Wochenthema, eine
 * Quizfrage, ein Bilderrätsel, ein Wochenziel, eine Tages-Challenge, eine
 * Frage der Woche, eine Feed-Karte oder eine Teilen-Aufgabe. Eingereicht
 * wird seit dem Formular-Umbau die **fixfertige Karte** – dieselben
 * Felder wie in der Redaktion (`ImpulseItemFields`), abgelegt unter
 * `card`. Veröffentlicht wird trotzdem nie direkt: Die Redaktion prüft,
 * übernimmt die Karte vorbefüllt ins Redaktionsformular und macht daraus
 * einen gewöhnlichen Inhalt («Eingereicht von …»). Es gibt bewusst
 * keinen Zustand «abgelehnt»: Was nicht passt, entfernt die Redaktion
 * still – eine angeschriebene Ablehnung entmutigte genau die, die sich
 * getraut haben (Leitgedanke 1).
 *
 * `gedanke` ist die Alt-Art aus der ersten Fassung der Mitmach-Ecke
 * («Schriftstelle oder Gedanke» – wurde zur Feed-Karte); Einreichungen
 * ohne `card` stammen aus der Freitext-Zeit und werden weiterhin
 * verstanden.
 */
export type ImpulseSubmissionKind = ImpulseKind | 'gedanke'

export const IMPULSE_SUBMISSION_KIND_LABELS: Record<ImpulseSubmissionKind, string> = {
  ...IMPULSE_KIND_LABELS,
  gedanke: 'Schriftstelle oder Gedanke',
}

export type ImpulseSubmissionStatus = 'open' | 'accepted'

/** Die Kartenfelder einer Einreichung – was neben Titel und Quelle noch dazugehört. */
export interface ImpulseSubmissionCard {
  body: string
  deepening: string
  /** Eigener Titel und eigene Quelle der Vertiefung – fehlen bei älteren Einreichungen. */
  deepeningTitle?: string
  deepeningSourceLabel?: string
  deepeningSourceUrl?: string
  imageUrl: string
  imageAlt: string
  /** Der gewählte Bildausschnitt – fehlt, wenn das ganze Bild gilt. */
  imageCrop?: ImpulseImageCrop | null
  /** Der Videolink – bei der Video-Karte. */
  videoUrl?: string
  /** Zwei Wische statt einem: der Text über dem Video. */
  videoTextPage?: boolean
  quiz: ImpulseQuiz | null
}

export interface ImpulseSubmission extends WithId {
  uid: string
  firstName: string
  kind: ImpulseSubmissionKind
  /** Der Titel bzw. die Frage der Karte – zugleich die Zeile in den Listen. */
  text: string
  sourceLabel?: string
  sourceUrl?: string
  /** Die restlichen Kartenfelder – fehlt bei alten Freitext-Einreichungen. */
  card?: ImpulseSubmissionCard
  /** `open` wartet auf die Redaktion; `accepted` ist übernommen. */
  status: ImpulseSubmissionStatus
  createdAt?: TS
  updatedAt?: TS
}

/**
 * Eine Antwort auf eine Quizfrage.
 *
 * Die Dokument-ID ist `{itemId}_{uid}` – eine Antwort pro Person und
 * Frage, erzwungen durch die ID selbst und geprüft in den Zugriffsregeln;
 * dieselbe Denkweise wie das Datum als Programm-ID. Der Vorname wird
 * mitgeschrieben statt nachgeschlagen: Die AP's können keine fremden
 * Profile lesen, und eine Antwort soll lesbar bleiben, auch wenn das
 * Konto später verschwindet.
 */
export interface ImpulseAnswer extends WithId {
  itemId: string
  uid: string
  firstName: string
  /** Bei `choice`: der gewählte Index. */
  choiceIndex?: number | null
  /** Bei `text`: die eingetippte Antwort. */
  text?: string
  /**
   * Richtig beantwortet? Bei der Suchfrage `null` – sie wird nicht
   * bewertet. Gewertet wird die Teilnahme: ein Versuch, keine Noten.
   */
  correct: boolean | null
  answeredAt?: TS
  updatedAt?: TS
}

/**
 * Ein Beitrag zur Frage der Woche.
 *
 * Die Dokument-ID ist `{itemId}_{uid}` – eine Antwort pro Person und
 * Frage, wie beim Quiz. Anders als dort darf die eigene nachgebessert
 * werden: Sie ist ein persönliches Wort, kein Versuch. Sichtbar werden die
 * Antworten der anderen erst nach der eigenen (Entscheid Nr. 3) – das
 * setzt die Ansicht durch; wer mit Entwicklerwerkzeugen vorbeischaut,
 * liest nur, was er nach einem ehrlichen Satz ohnehin sähe.
 *
 * `hidden` ist die Moderation: Ein ausgeblendeter Beitrag bleibt stehen,
 * erscheint aber nur noch der Redaktion. Amen und Melden liegen wie beim
 * Feed am eigenen Fortschrittsdokument, nicht am Beitrag.
 */
export interface ImpulseComment extends WithId {
  itemId: string
  uid: string
  firstName: string
  text: string
  /** Ausgeblendet durch die Redaktion – nur sie sieht und schaltet es. */
  hidden: boolean
  createdAt?: TS
  updatedAt?: TS
}

/** Der Stand einer Person in einer Woche – was sie selbst abgehakt hat. */
export interface ImpulseWeekProgress {
  /** Wochenziel geschafft – Selbstauskunft, umhakbar. */
  goal?: boolean
  /** Abgehakte Tage der Tages-Challenge, als «2026-08-11». */
  days?: string[]
  /** Den Feed der Woche bis zur Schlusskarte durchgetippt. */
  feed?: boolean
  /** Die Teilen-Aufgabe der Woche besprochen – Selbstauskunft, umhakbar. */
  share?: boolean
  /**
   * Im Vollbild-Feed angeschaute Karten der Woche, als Inhalts-IDs –
   * und die angeschauten Vertiefungen dazu. Daran hängt der Meilenstein
   * «Anti Doom Scroller»: alle Karten samt Vertiefungen gesehen. Über
   * Geräte hinweg gezählt, darum hier und nicht im localStorage.
   */
  cards?: string[]
  deepened?: string[]
}

/**
 * Der persönliche Fortschritt im Bereich «Anti Doom» – ein Dokument pro
 * Konto, die UID ist die Dokument-ID. Geschrieben wird es nur von der
 * Person selbst (siehe `firestore.rules`); der Vorname steht dabei, damit
 * die Gruppenleiste Namen zeigen kann, ohne fremde Profile zu lesen.
 *
 * Bewusst **ohne** gespeicherte Serie und Abzeichen: Beides wird beim
 * Lesen berechnet (`lib/impulse`). Ein gespeicherter Wert veraltete
 * stillschweigend – eine verpasste Woche bricht die Serie ja gerade dann,
 * wenn niemand etwas schreibt –, und bei der Grösse eines Kollegiums
 * kostet das Rechnen nichts.
 */
export interface ImpulseProgress extends WithId {
  uid: string
  firstName: string
  /** Der Stand je Woche, Schlüssel ist «2026-W34». */
  weeks?: Record<string, ImpulseWeekProgress>
  /**
   * «Amen» – die eine Reaktion des Feeds, als Liste von Inhalts-IDs.
   *
   * Am eigenen Dokument statt am Inhalt: Inhalte schreibt nur die
   * Redaktion, und die Karte zeigt daraus Vornamen statt Zählstände –
   * herzlicher als ein Like und ohne Wettbewerb.
   */
  amens?: string[]
  /** Gemerkte Karten – die eigene Favoritensammlung, als Inhalts-IDs. */
  favorites?: string[]
  /**
   * Gemeldete Beiträge – IDs aus `impulseComments`.
   *
   * Auch das Melden liegt am eigenen Dokument: Es braucht kein
   * Schreibrecht am fremden Beitrag, und die Redaktion sieht, wer etwas
   * gemeldet hat.
   */
  reports?: string[]
  /**
   * Die letzte Woche, deren Inhalt angeschaut wurde – «2026-W34».
   *
   * Daran hängt der stille Punkt am Navigationseintrag: Er steht, solange
   * die laufende Woche Inhalt hat und hier noch nicht vermerkt ist – und
   * verschwindet mit dem ersten Blick. Kein Zähler, keine Mahnung
   * (Leitgedanke 1), dieselbe Sprache wie der Update-Hinweis.
   */
  lastSeenWeek?: string
  createdAt?: TS
  updatedAt?: TS
}

/* ------------------------------------------------------------------ */
/* Benachrichtigungen                                                  */
/* ------------------------------------------------------------------ */

/**
 * Wie oft eine Erinnerung kommt.
 *
 * Mehr Takte gibt es bewusst nicht: Eine Erinnerung, die man selbst
 * bestellt hat, soll vorhersehbar sein – täglich oder wöchentlich, zur
 * gewählten Zeit. Alles Feinere wäre eine Einstellung, die man einmal
 * vornimmt und danach nicht mehr versteht.
 */
export type NotificationMode = 'daily' | 'weekly'

export interface NotificationSchedule {
  mode: NotificationMode
  /** 1 = Montag … 7 = Sonntag. Zählt nur bei `weekly`. */
  weekday: number
  /**
   * Uhrzeit «HH:MM» in **Schweizer Zeit**, in halben Stunden.
   *
   * Bewusst nicht in UTC: Wer «acht Uhr» einstellt, meint acht Uhr am
   * Frühstückstisch – im Sommer wie im Winter. Die Umrechnung macht der
   * Versand (siehe `lib/notifications`), die Zeitumstellung geht damit
   * spurlos vorbei.
   */
  time: string
}

/**
 * Für welche Termine des AP-Kalenders erinnert werden soll.
 *
 * «Besondere Anlässe» (Lager, Tempelbesuche) zählen zu den Aktivitäten –
 * sie sind welche, nur ausserhalb des üblichen Takts. Ausgefallene
 * Termine erinnern nie.
 */
export type ApNotifyScope = 'alle' | 'aktivitaeten' | 'klassen'

export const AP_NOTIFY_SCOPE_LABELS: Record<ApNotifyScope, string> = {
  alle: 'Aktivitäten und AP-Klassen',
  aktivitaeten: 'Nur Aktivitäten',
  klassen: 'Nur AP-Klassen',
}

/**
 * Was jemand benachrichtigt bekommen möchte – ein Dokument je Konto,
 * die UID ist die ID.
 *
 * Getrennt von den Geräte-Adressen (`pushTokens`), und das ist Absicht:
 * **Ob** ein Gerät Nachrichten empfängt, entscheidet das Gerät (die
 * Erlaubnis gilt je Browser); **was** und **wann** verschickt wird,
 * entscheidet die Person – einmal, für alle ihre Geräte.
 *
 * Die Felder ohne Schalter führt der Versand selbst (`…SentAt`,
 * `meetingsNotified`, `apNotified`); die Zugriffsregeln verriegeln sie
 * gegen den Client, damit sich niemand versehentlich eine Nachricht
 * doppelt holt.
 */
export interface NotificationSettings extends WithId {
  uid: string
  /** Das Wochenthema von «Anti Doom» – Takt und Zeit frei wählbar. */
  impuls: NotificationSchedule & { on: boolean }
  /**
   * Wenn jemand anderes ein Traktandum anlegt.
   *
   * Nur für Vollzugriff, gebündelt und mit Mindestabstand – fünf
   * Traktanden in fünf Minuten sind eine Nachricht, nicht fünf.
   */
  agenda: { on: boolean }
  /** Eine Stunde vor der Sitzung, mit Anzahl Traktanden und Pendenzen. */
  meeting: { on: boolean }
  /**
   * Erinnerung an Termine des AP-Kalenders.
   *
   * Der Vorlauf ist wählbar (1 bis 24 Stunden – 24 heisst «einen Tag
   * vorher»), ebenso, welche Termine erinnern: nur Aktivitäten, nur
   * AP-Klassen oder beides. Erinnert wird nur, was eine Uhrzeit hat –
   * die eigene am Termin oder die übliche der Klasse.
   */
  ap: { on: boolean; hoursBefore: number; scope: ApNotifyScope }
  /** Vom Versand geführt: wann zuletzt gesendet wurde. */
  impulsSentAt?: TS | null
  agendaSentAt?: TS | null
  /** Vom Versand geführt: Sitzungen, für die schon erinnert wurde. */
  meetingsNotified?: string[]
  /** Vom Versand geführt: AP-Termine, für die schon erinnert wurde. */
  apNotified?: string[]
  createdAt?: TS
  updatedAt?: TS
}
