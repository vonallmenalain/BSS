/**
 * Welche Fassung der App läuft – und welche auf dem Server liegt.
 *
 * Der Build schreibt dieselbe Auskunft an zwei Stellen: in den Code
 * (`__APP_VERSION__`, siehe `vite.config.ts`) und daneben in die Datei
 * `/version.json`. Die App vergleicht beides: Liefert der Server eine andere
 * Fassung als die, die gerade läuft, holt sie die neue (siehe
 * `lib/appUpdate`). Die Datei steht bewusst nicht im Cache des Service
 * Workers – sie soll immer vom Server kommen, nie aus einem Speicher, der
 * selbst veraltet sein kann.
 *
 * Gezeigt wird die Fassung dem Administrator-Konto im Menü oben rechts: als
 * Nummer des Pull Requests, mit dem sie auf `main` kam («#190»). So lässt
 * sich auf einen Blick sehen, ob ein Gerät die neueste Fassung zeigt.
 */
export interface AppVersion {
  /** Eindeutig je Build – daran erkennt die App, dass es eine andere Fassung gibt. */
  id: string
  /** Nummer des Pull Requests – auf `main` aus dem Merge, in der Vorschau aus Netlify. */
  pr: number | null
  /** Eine Vorschau eines offenen Pull Requests, nicht die veröffentlichte App. */
  preview: boolean
  /** Kurzform des Commits, aus dem gebaut wurde. */
  commit: string | null
  /** Zeitpunkt des Builds (ISO). */
  builtAt: string
}

/** Von `vite.config.ts` eingesetzt; fehlt beim Ausführen der Tests. */
declare const __APP_VERSION__: AppVersion | undefined

const UNBUILT: AppVersion = {
  id: 'entwicklung',
  pr: null,
  preview: false,
  commit: null,
  builtAt: '',
}

/** Die Fassung, die gerade läuft. */
export const APP_VERSION: AppVersion =
  typeof __APP_VERSION__ === 'undefined' ? UNBUILT : __APP_VERSION__

/**
 * Die Nummer des Pull Requests aus der Betreffzeile des Commits.
 *
 * GitHub hängt sie beim Squash-Merge an: «Anti Doom: … (#190)». Gilt nur am
 * Ende der Zeile – eine Nummer mitten im Text ist ein Verweis, nicht die
 * Herkunft.
 */
export function prNumberFrom(subject: string | null | undefined): number | null {
  const match = /\(#(\d+)\)\s*$/.exec(subject ?? '')
  return match ? Number(match[1]) : null
}

/** Die kurze Bezeichnung: «#190», «Vorschau #191», sonst der Commit. */
export function versionLabel(version: AppVersion): string {
  if (version.pr !== null) return version.preview ? `Vorschau #${version.pr}` : `#${version.pr}`
  if (version.commit) return version.commit
  return version.id === UNBUILT.id ? 'Entwicklung' : version.id
}

/** Ist das eine gültige Auskunft aus `/version.json`? */
export function isAppVersion(value: unknown): value is AppVersion {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<AppVersion>
  return typeof candidate.id === 'string' && candidate.id.length > 0
}
