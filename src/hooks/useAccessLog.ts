import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  flushChanges,
  setLogIdentity,
  setLogSession,
  startSession,
  touchSession,
} from '@/lib/audit'
import { parseDevice } from '@/lib/accessLog'
import { uid } from '@/lib/utils'

/**
 * Hält fest, wer die App gerade benutzt.
 *
 * ## Was ein «Zugriff» ist
 *
 * Nicht jeder Seitenaufruf – sonst zählte ein Nachmittag mit der App
 * vierzigmal, und die Zahl in der Übersicht sagte nichts mehr. Ein Zugriff ist
 * ein **Besuch**: von der ersten Regung bis zur letzten, mit Pausen dazwischen.
 * Wer eine halbe Stunde nichts tut und dann weitermacht, war zweimal da; wer
 * zwischendurch die Ansicht wechselt oder das Telefon weglegt und wieder
 * aufnimmt, war einmal da.
 *
 * Ein Besuch überlebt deshalb das Neuladen der Seite und den Wechsel zwischen
 * App und Startbildschirm: Seine Kennung steht im Browser (`localStorage`)
 * und nicht im Speicher der laufenden Seite.
 *
 * ## Was er kostet
 *
 * Einen Schreibvorgang beim Beginn und danach höchstens einen alle fünf
 * Minuten – und den nur, wenn seither überhaupt etwas geschehen ist. Eine
 * App, die auf dem Küchentisch offen liegt, schreibt nichts. Ein voller
 * Arbeitstag in der App kommt so auf ein gutes Dutzend Schreibvorgänge; das
 * ist der Preis dafür, dass in der Übersicht «zuletzt: vor 20 Minuten» steht
 * statt «zuletzt: heute Morgen, als er die App geöffnet hat».
 */

/** Nach dieser Ruhe gilt das Nächste als neuer Besuch. */
const GAP_MS = 30 * 60 * 1000

/** So oft wird ein laufender Besuch höchstens fortgeschrieben. */
const TOUCH_MS = 5 * 60 * 1000

/** Wie oft nachgesehen wird, ob etwas zu schreiben ist. */
const TICK_MS = 60 * 1000

const STORAGE_KEY = 'bss:zugriff'

interface Visit {
  id: string
  uid: string
  /** Wann zuletzt etwas geschehen ist – lokale Uhrzeit */
  seen: number
  /** Wann zuletzt geschrieben wurde */
  wrote: number
  views: number
}

function readVisit(): Visit | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Visit>
    if (typeof parsed.id !== 'string' || typeof parsed.uid !== 'string') return null
    return {
      id: parsed.id,
      uid: parsed.uid,
      seen: typeof parsed.seen === 'number' ? parsed.seen : 0,
      wrote: typeof parsed.wrote === 'number' ? parsed.wrote : 0,
      views: typeof parsed.views === 'number' ? parsed.views : 1,
    }
  } catch {
    return null
  }
}

function writeVisit(visit: Visit | null): void {
  try {
    if (visit) localStorage.setItem(STORAGE_KEY, JSON.stringify(visit))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Privater Modus oder voller Speicher: Dann beginnt eben jeder Aufruf
    // einen neuen Besuch. Kein Grund, irgendetwas anzuhalten.
  }
}

/** Womit jemand unterwegs ist – so viel, wie ohne Nachfrage zu haben ist. */
function device(): Record<string, unknown> {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as { standalone?: boolean }).standalone === true

  return {
    device: parseDevice(navigator.userAgent),
    standalone,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
  }
}

/**
 * Von wo aus zugegriffen wird.
 *
 * Beantwortet die Netlify-Function unter `/api/standort`; beim Entwickeln gibt
 * es sie nicht, und dann bleibt der Ort eben leer. Die Antwort gilt für den
 * ganzen Besuch und wird deshalb nur einmal geholt.
 */
async function place(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch('/api/standort', { cache: 'no-store' })
    if (!response.ok) return null
    const body = (await response.json()) as Record<string, unknown>
    if (typeof body.countryCode !== 'string') return null
    return {
      city: String(body.city ?? ''),
      region: String(body.region ?? ''),
      country: String(body.country ?? ''),
      countryCode: body.countryCode,
      ip: String(body.ip ?? ''),
    }
  } catch {
    return null
  }
}

export function useAccessLog(): void {
  const { firebaseUser, profile } = useAuth()
  const { pathname } = useLocation()

  /** Der laufende Besuch – im Speicher, damit die Ereignisse ihn erreichen. */
  const visit = useRef<Visit | null>(null)
  /** Seit dem letzten Schreiben ist etwas geschehen. */
  const dirty = useRef(false)
  /**
   * «Etwas ist geschehen» – aufgesetzt vom Effekt darunter.
   *
   * Über eine Referenz, weil zwei Effekte sie brauchen: dieser hier für
   * Tastendruck und Berührung, der zweite für den Ansichtswechsel. Letzterer
   * läuft bei jedem Blättern durch die App, und der Rest soll dabei stehen
   * bleiben – dieselbe Funktion in beiden hiesse, alle Ereignisse und den
   * Zeitgeber laufend ab- und wieder anzumelden.
   */
  const mark = useRef<(view: boolean) => void>(() => {})

  const uidOf = firebaseUser?.uid ?? null
  const email = firebaseUser?.email ?? ''
  const name = profile?.displayName || firebaseUser?.displayName || email || 'Unbenannt'

  useEffect(() => {
    if (!uidOf || !email) {
      setLogIdentity(null)
      setLogSession(null)
      visit.current = null
      // Sonst hinge hier die Funktion des zuletzt angemeldeten Kontos, und
      // der nächste Ansichtswechsel legte einen Besuch auf dessen Namen an –
      // den die Zugriffsregeln zu Recht abwiesen.
      mark.current = () => {}
      return
    }

    const who = { uid: uidOf, email, displayName: name }
    setLogIdentity(who)

    /*
     * Einen Besuch aufnehmen oder fortsetzen.
     *
     * Fortgesetzt wird nur, was zum selben Konto gehört und nicht zu lange
     * her ist. Ein Kontowechsel auf demselben Gerät beginnt immer neu – sonst
     * schriebe sich die eine Person in den Besuch der anderen hinein, und die
     * Zugriffsregeln wiesen es zu Recht ab.
     */
    const resume = () => {
      const stored = readVisit()
      const now = Date.now()

      if (stored && stored.uid === uidOf && now - stored.seen < GAP_MS) {
        visit.current = stored
        setLogSession(stored.id)
        return
      }

      const fresh: Visit = { id: uid(), uid: uidOf, seen: now, wrote: now, views: 1 }
      visit.current = fresh
      writeVisit(fresh)
      setLogSession(fresh.id)

      void startSession(fresh.id, who, device())
        .then(async () => {
          const found = await place()
          // Nur, wenn es derselbe Besuch noch ist: Die Auskunft kann eine
          // Sekunde brauchen, und in der Zeit kann sich jemand abgemeldet haben.
          if (found && visit.current?.id === fresh.id) await touchSession(fresh.id, found)
        })
        .catch((error) => console.warn('[protokoll] Zugriff nicht festgehalten:', error))
    }

    resume()

    /** Etwas ist geschehen – merken und bei Bedarf einen neuen Besuch beginnen. */
    mark.current = (view: boolean) => {
      const now = Date.now()
      const current = visit.current
      if (!current || now - current.seen > GAP_MS) {
        resume()
        return
      }
      current.seen = now
      if (view) current.views += 1
      dirty.current = true
      writeVisit(current)
    }

    /** Den laufenden Besuch fortschreiben – höchstens alle paar Minuten. */
    const touch = (force: boolean) => {
      const current = visit.current
      if (!current || !dirty.current) return
      if (!force && Date.now() - current.wrote < TOUCH_MS) return

      current.wrote = Date.now()
      dirty.current = false
      writeVisit(current)
      void touchSession(current.id, { views: current.views }).catch((error) =>
        console.warn('[protokoll] Zugriff nicht fortgeschrieben:', error),
      )
    }

    const onActivity = () => mark.current(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible') mark.current(false)
      else {
        // Beim Weglegen alles schreiben, was noch aussteht: Ob die Seite
        // danach zurückkommt, weiss niemand – auf dem Telefon oft nicht.
        touch(true)
        flushChanges()
      }
    }
    const onLeave = () => {
      touch(true)
      flushChanges()
    }

    const timer = window.setInterval(() => touch(false), TICK_MS)
    window.addEventListener('pointerdown', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', onLeave)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onLeave)
      touch(true)
      mark.current = () => {}
    }
  }, [uidOf, email, name])

  /*
   * Ein Ansichtswechsel zählt als Regung und als geöffnete Ansicht.
   *
   * Der erste zählt nicht mit: Ihn hat der Besuch selbst schon mitgebracht.
   */
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    mark.current(true)
  }, [pathname])
}
