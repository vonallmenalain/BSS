/*
 * Welche App sich aufs Telefon legt – je nach Zugang.
 *
 * Dieselbe Seite wird von sehr verschiedenen Leuten installiert: von der
 * Bischofschaft, von den AP's, die nur ihren Kalender oder «Anti Doom»
 * sehen, und von Leuten ohne Konto, die den Putzplan oder den
 * AP-Kalender am Anschlagbrett gescannt haben. Jede Gruppe bekommt ihr
 * eigenes Symbol und ihren eigenen Namen auf dem Startbildschirm:
 *
 * - **Vollzugriff** (und die Assistenz): «Bischofschaft» mit «BS» – wie
 *   bisher, das Manifest der App aus `vite.config.ts`.
 * - **AP-Rollen** (nur AP-Kalender oder nur Anti Doom): «AP» mit dem
 *   Wappen – `public/ap-app.webmanifest`.
 * - **Ohne Konto** (oder solange die Freigabe aussteht) auf einem
 *   Anschlagbrett: «AP-Kalender» bzw. «Putzplan», je mit ihrem Zeichen –
 *   als eigene kleine App, die dort beginnt (`public/ap-kalender.webmanifest`,
 *   `public/putzplan.webmanifest`).
 *
 * Umgeschaltet wird, was der Browser beim Installieren liest: der Link aufs
 * Manifest, und fürs iPhone, das das Manifest dafür nicht nimmt, Symbol
 * (`apple-touch-icon`) und Name (`apple-mobile-web-app-title`). Eine schon
 * installierte App behält, womit sie installiert wurde.
 *
 * Die Symbole erzeugt `scripts/generate-icons.mjs`.
 */

export type AppIdentityKey = 'bischofschaft' | 'ap' | 'kalender' | 'putzplan'

export interface AppIdentity {
  /** Das Manifest – `null` heisst: das der App (`manifest.webmanifest`, aus vite.config). */
  manifest: string | null
  /** Der Name unter dem Symbol auf dem iPhone. */
  title: string
  /** Das Symbol fürs iPhone. */
  appleTouchIcon: string
}

export const APP_IDENTITIES: Record<AppIdentityKey, AppIdentity> = {
  bischofschaft: {
    manifest: null,
    title: 'Bischofschaft',
    appleTouchIcon: '/icons/icon-192.png',
  },
  ap: {
    manifest: '/ap-app.webmanifest',
    title: 'AP',
    appleTouchIcon: '/icons/ap-apple-touch-icon.png',
  },
  kalender: {
    manifest: '/ap-kalender.webmanifest',
    title: 'AP-Kalender',
    appleTouchIcon: '/icons/kalender-apple-touch-icon.png',
  },
  putzplan: {
    manifest: '/putzplan.webmanifest',
    title: 'Putzplan',
    appleTouchIcon: '/icons/putzplan-apple-touch-icon.png',
  },
}

/** Liegt die Adresse auf diesem Anschlagbrett – «/ap» oder «/ap/…», aber nicht «/apfel»? */
function onBoard(pathname: string, board: string): boolean {
  return pathname === board || pathname.startsWith(`${board}/`)
}

/**
 * Welche App zu diesem Zugang gehört.
 *
 * Der Zugang entscheidet vor der Adresse: Wer zur Bischofschaft gehört,
 * installiert auch vom Putzplan aus die App der Bischofschaft, und ein AP
 * die App der AP's. Nur wer kein Konto hat – oder noch auf die Freigabe
 * wartet und darum bloss die Anschlagbretter sieht –, bekommt das
 * Anschlagbrett, auf dem er gerade steht. Die Vorschau des öffentlichen
 * Putzplans (`?vorschau`) zeigt, was jemand ohne Konto installieren würde.
 */
export function appIdentityFor(access: {
  isApproved: boolean
  isAssistant: boolean
  canViewAp: boolean
  canViewImpulse: boolean
  pathname: string
  /** Die Vorschau des öffentlichen Putzplans läuft. */
  putzplanPreview?: boolean
}): AppIdentityKey {
  if (access.putzplanPreview) return 'putzplan'
  if (access.isApproved || access.isAssistant) return 'bischofschaft'
  if (access.canViewAp || access.canViewImpulse) return 'ap'
  if (onBoard(access.pathname, '/putzplan')) return 'putzplan'
  if (onBoard(access.pathname, '/ap')) return 'kalender'
  return 'bischofschaft'
}

/** Das Manifest, mit dem die Seite geladen wurde – das der App. Einmal gemerkt. */
let appManifest: string | null | undefined

/** Einen `<link>` im Kopf der Seite auf `href` setzen – oder entfernen. */
function setLink(rel: string, href: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!href) {
    link?.remove()
    return
  }
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  // Nur bei einem Wechsel: Ein neuer Wert lässt den Browser neu laden.
  if (link.getAttribute('href') !== href) link.setAttribute('href', href)
}

/** Die App, die sich jetzt installieren würde, im Kopf der Seite eintragen. */
export function applyAppIdentity(key: AppIdentityKey): void {
  if (typeof document === 'undefined') return
  if (appManifest === undefined) {
    appManifest =
      document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute('href') ??
      null
  }
  const identity = APP_IDENTITIES[key]
  setLink('manifest', identity.manifest ?? appManifest)
  setLink('apple-touch-icon', identity.appleTouchIcon)
  const title = document.head.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]',
  )
  if (title && title.content !== identity.title) title.content = identity.title
}
