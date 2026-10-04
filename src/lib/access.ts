import {
  ADMIN_EMAIL,
  AP_ACCESS_ROLES,
  AP_WRITE_ROLES,
  ASSISTANT_AREA_PATHS,
  assistantAreasOf,
  assistantWriteOf,
  FULL_ACCESS_ROLES,
  IMPULSE_ONLY_ROLE,
  ROLE_LABELS,
  type AppUser,
  type AssistantArea,
  type Role,
} from './types.ts'

/**
 * Was ein Konto sehen und tun darf – berechnet aus Profil und Anmelde-E-Mail.
 *
 * Eine reine Funktion, damit dieselbe Rechnung an zwei Stellen gilt: im
 * `AuthContext`, der die App danach ausrichtet, und schon beim Laden des
 * Profils, wo sie entscheidet, ob ein Stand aus dem Gerätespeicher reicht
 * oder auf den Server gewartet wird. Die Zugriffsregeln in `firestore.rules`
 * setzen dieselben Grenzen durch; hier geht es nur darum, was die App zeigt.
 */
export interface Access {
  role: Role | null
  /** Profil vorhanden, aktiv und mit einer Rolle. */
  active: boolean
  isAdmin: boolean
  /** Vollzugriff – Bischof, Ratgeber, Sekretäre. */
  isApproved: boolean
  canViewAp: boolean
  canEditAp: boolean
  /** Assistenz mit mindestens einem Bereich. */
  isAssistant: boolean
  assistantAreas: AssistantArea[]
  assistantWriteAreas: AssistantArea[]
  canViewImpulse: boolean
  canEditImpulse: boolean
  /** Wo dieses Konto zu Hause ist. */
  homePath: string
  /** Sieht überhaupt etwas – sonst steht der Wartebereich da. */
  hasAccess: boolean
  /**
   * Die Rolle ist dieser Fassung der App unbekannt.
   *
   * Das heisst fast immer: Die Rolle ist neuer als die App auf dem Gerät –
   * vergeben mit einer neueren Fassung, während hier noch die alte läuft.
   * Der Wartebereich holt dann die neue Fassung, statt «wartet auf eine
   * Rolle» zu behaupten.
   */
  unknownRole: boolean
}

export function accessOf(profile: AppUser | null, email: string | null | undefined): Access {
  const role = profile?.role ?? null
  const active = Boolean(profile && profile.active && role)
  const isAdmin = email?.toLowerCase() === ADMIN_EMAIL
  const isApproved = active && Boolean(role && FULL_ACCESS_ROLES.includes(role))
  const canViewAp = active && Boolean(role && AP_ACCESS_ROLES.includes(role))

  /*
   * Die Bereiche der Assistenz.
   *
   * `assistantAreasOf` prüft Rolle und Aktivstatus gleich mit – ein Feld
   * aus einer früheren Fassung öffnet damit nichts, solange die Rolle
   * nicht dazu passt.
   */
  const assistantAreas = assistantAreasOf(profile)
  const assistantWriteAreas = assistantWriteOf(profile)
  const isAssistant = assistantAreas.length > 0

  // Ein wartendes Konto bleibt draussen, selbst wenn ein Feld gesetzt sein
  // sollte – freigeschaltet wird zuerst, der Schalter kommt danach. Die
  // Rolle «Nur Anti Doom» bringt den Bereich von sich aus mit; bei allen
  // anderen hängt er am Schalter des Kontos. Die Redaktion sieht den
  // Bereich immer: Wer ihn pflegt, muss ihn lesen können.
  const canViewImpulse =
    isAdmin ||
    (active &&
      role !== 'pending' &&
      (role === IMPULSE_ONLY_ROLE || profile?.impulse === true || profile?.impulseEditor === true))
  const canEditImpulse =
    isAdmin || (active && role !== 'pending' && profile?.impulseEditor === true)

  /*
   * Der Ort, an dem dieses Konto zu Hause ist.
   *
   * Die Reihenfolge ist die des Zugriffs: Wer alles sieht, beginnt auf der
   * Übersicht; wer nur Bereiche der Abendmahlsversammlung hat, im ersten
   * davon; wer nur den Kalender hat, dort. Bleibt nichts übrig, führt der
   * Weg auf die Startseite – dort steht dann der Wartebereich.
   */
  const homePath = isApproved
    ? '/'
    : isAssistant
      ? ASSISTANT_AREA_PATHS[assistantAreas[0]]
      : canViewAp
        ? '/ap'
        : canViewImpulse
          ? '/anti-doom'
          : '/'

  return {
    role,
    active,
    isAdmin,
    isApproved,
    canViewAp,
    canEditAp: active && Boolean(role && AP_WRITE_ROLES.includes(role)),
    isAssistant,
    assistantAreas,
    assistantWriteAreas,
    canViewImpulse,
    canEditImpulse,
    homePath,
    hasAccess: isApproved || canViewAp || canViewImpulse || isAssistant,
    unknownRole: role !== null && !Object.hasOwn(ROLE_LABELS, role),
  }
}
