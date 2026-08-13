import type { ImpulseSectionKey } from './impulseSections.ts'

/*
 * Die stille Statistik des Bereichs «Anti Doom» – Zeit und Besuche, gezählt
 * **auf diesem Gerät** (localStorage), nicht in Firestore.
 *
 * Mit Bedacht lokal: Das Fortschrittsdokument können alle im Bereich
 * lesen (die Gruppenleiste lebt davon), und «wie lange war wer in der
 * App» wäre genau die öffentlich vergleichbare Zahl, die das Konzept
 * ausschliesst (Leitgedanke 4 und 7). Hier bleibt sie, wo sie hingehört:
 * bei der Person. Der Preis ist ehrlich angeschrieben – ein neues Gerät
 * beginnt bei null.
 */

export interface ImpulseUsage {
  /** Sekunden im Bereich, sichtbare Zeit – kein Hintergrund-Tab zählt mit. */
  seconds: number
  /** Wie oft welcher Bereich geöffnet wurde – `uebersicht` ist das Dashboard. */
  opens: Partial<Record<ImpulseSectionKey | 'uebersicht', number>>
  /** Erster gezählter Tag («2026-08-12») – der Anfang der Zählung. */
  since: string
}

const EMPTY: ImpulseUsage = { seconds: 0, opens: {}, since: '' }

/* Pro Konto ein Schlüssel – ein geteiltes Familientablet mischt sonst. */
const storageKey = (uid: string) => `bss.impuls.usage.${uid}`

/** Lesen – kaputte oder fehlende Einträge werden still zu null. */
export function readImpulseUsage(uid: string): ImpulseUsage {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    if (!raw) return { ...EMPTY, opens: {} }
    const parsed = JSON.parse(raw) as Partial<ImpulseUsage>
    return {
      seconds: typeof parsed.seconds === 'number' && parsed.seconds >= 0 ? parsed.seconds : 0,
      opens: parsed.opens && typeof parsed.opens === 'object' ? parsed.opens : {},
      since: typeof parsed.since === 'string' ? parsed.since : '',
    }
  } catch {
    return { ...EMPTY, opens: {} }
  }
}

function write(uid: string, usage: ImpulseUsage) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(usage))
  } catch {
    /* Voller oder verbotener Speicher (privater Modus) – dann eben nicht. */
  }
}

function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Ein Bereich wurde geöffnet – ein Strich auf der Liste. */
export function recordImpulseOpen(uid: string, section: ImpulseSectionKey | 'uebersicht') {
  if (!uid) return
  const usage = readImpulseUsage(uid)
  usage.opens[section] = (usage.opens[section] ?? 0) + 1
  if (!usage.since) usage.since = today()
  write(uid, usage)
}

/**
 * Die Uhr des Bereichs: alle fünf Sekunden ein Tick, gezählt wird nur,
 * was sichtbar ist – ein Tab im Hintergrund sammelt keine Minuten. Der
 * Rückgabewert räumt auf; die Seite ruft ihn beim Verlassen.
 */
export function trackImpulseTime(uid: string): () => void {
  if (!uid) return () => {}
  const TICK = 5
  const timer = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    const usage = readImpulseUsage(uid)
    usage.seconds += TICK
    if (!usage.since) usage.since = today()
    write(uid, usage)
  }, TICK * 1000)
  return () => window.clearInterval(timer)
}

/** «1 Std. 24 Min.», «12 Min.» – und unter einer Minute ehrlich klein. */
export function formatImpulseDuration(seconds: number): string {
  if (seconds < 60) return 'unter 1 Min.'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`
}
