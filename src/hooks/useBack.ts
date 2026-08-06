import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router-dom'

/**
 * Woher jemand kam – und wie «Zurück» wirklich dorthin zurückführt.
 *
 * ## Das Problem
 *
 * Bisher trug jeder Verweis selbst mit, wohin «Zurück» führen soll
 * (`state.from`). Wo das fehlte, landete man auf einer Voreinstellung –
 * bei einem Mitglied etwa in der Mitgliederliste, in der man nie war. Und
 * selbst wo es stand, half es nur halb: Der Weg zurück führte auf die
 * **Adresse** der vorigen Seite, nicht in ihren Zustand. Wer unter
 * «Ansprachen» im Reiter «Vorschläge» stand, kam zurück und sah wieder das
 * «Programm».
 *
 * ## Die Lösung
 *
 * Zwei Teile, die zusammengehören:
 *
 *  1. **Der echte Schritt zurück.** Kam man aus der App, geht «Zurück» einen
 *     Eintrag im Browserverlauf zurück (`navigate(-1)`) – wie die
 *     Zurück-Geste des Telefons. Damit steht die vorige Adresse wieder da,
 *     samt allem, was in ihr steht (`?ansicht=vorschlaege`, `?pendenz=…`).
 *  2. **Der Verlauf als Gedächtnis.** Damit der Knopf auch **beschriften**
 *     kann, wohin er führt, merkt sich `useTrackLocation()` beim
 *     Seitenwechsel, wo man war. Der Knopf liest daraus den Namen der
 *     vorigen Seite.
 *
 * Wer die App über einen geteilten Link betritt, hat keinen Verlauf – dann
 * gilt der mitgegebene Ursprung (`state.from`) und sonst der Rückfallwert
 * der Seite.
 *
 * Damit Punkt 1 trägt, muss jede Ansicht, die etwas umschaltet, das in ihrer
 * Adresse führen – sonst gibt es nichts, wohin man zurückkehren könnte. Genau
 * dafür steht der Reiter unter «Ansprachen» in `?ansicht=`.
 */

interface Entry {
  pathname: string
  search: string
  title: string
}

/**
 * Was an welcher Stelle des Verlaufs stand.
 *
 * Bewusst ausserhalb von React: Der Verlauf gehört zum Fenster, nicht zu
 * einer Komponente, und muss einen Wechsel der Seite überdauern.
 */
const trail = new Map<number, Entry>()

/** Die Stelle im Verlauf, die React Router mitführt. */
function historyIndex(): number {
  const state: unknown = window.history.state
  const idx =
    typeof state === 'object' && state !== null && 'idx' in state
      ? (state as { idx: unknown }).idx
      : null
  return typeof idx === 'number' ? idx : 0
}

/** Namen der Bereiche – daraus wird die Beschriftung des Zurück-Knopfes. */
const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Übersicht'],
  [/^\/sitzungen$/, 'Sitzungen'],
  [/^\/sitzungen\//, 'Sitzung'],
  [/^\/pendenzen/, 'Pendenzen'],
  [/^\/notizen/, 'Notizen'],
  [/^\/putzplan/, 'Putzplan'],
  [/^\/abendmahl\/leitung/, 'Leitung'],
  [/^\/abendmahl\/bekanntmachungen/, 'Bekanntmachungen'],
  [/^\/abendmahl\/angelegenheiten/, 'Angelegenheiten'],
  [/^\/abendmahl\/ansprachen/, 'Ansprachen'],
  [/^\/abendmahl\/musik/, 'Musik'],
  [/^\/abendmahl\/gebet/, 'Gebet'],
  [/^\/abendmahl/, 'Abendmahlsversammlung'],
  [/^\/mitglieder$/, 'Mitglieder'],
  [/^\/mitglieder\//, 'Mitglied'],
  [/^\/berufungen/, 'Berufungen'],
  [/^\/ap/, 'Aktivitäten AP’s'],
  [/^\/einstellungen/, 'Einstellungen'],
  [/^\/import/, 'Import'],
]

export function pageTitle(pathname: string): string {
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Zurück'
}

/**
 * Hält den Verlauf nach.
 *
 * Steht einmal im Rahmen der App (`components/Layout`) und läuft bei jedem
 * Seitenwechsel. Alles oberhalb der aktuellen Stelle wird verworfen: Wer
 * zurückgeht und dann anderswohin abbiegt, hat den alten Zweig verlassen.
 */
export function useTrackLocation(location: Location): void {
  useEffect(() => {
    const idx = historyIndex()
    for (const key of [...trail.keys()]) if (key > idx) trail.delete(key)
    trail.set(idx, {
      pathname: location.pathname,
      search: location.search,
      title: pageTitle(location.pathname),
    })
  }, [location.pathname, location.search])
}

export interface BackTarget {
  /** Beschriftung des Knopfes – wohin er führt */
  label: string
  /** Adresse für Mittelklick und «in neuem Tab öffnen» */
  to: string
  /** Der eigentliche Schritt zurück */
  go: () => void
}

/**
 * Der Zurück-Knopf einer Detailseite.
 *
 * `fallback` greift nur, wenn es weder einen Verlauf noch einen mitgegebenen
 * Ursprung gibt – beim Aufruf über ein Lesezeichen oder einen geteilten Link.
 */
export function useBack(fallback: { to: string; label: string }): BackTarget {
  const navigate = useNavigate()
  const location = useLocation()

  const origin = location.state as { from?: string; fromLabel?: string } | null
  const originFrom = origin?.from
  const previous = trail.get(historyIndex() - 1) ?? null

  const go = useCallback(() => {
    if (trail.get(historyIndex() - 1)) {
      navigate(-1)
      return
    }
    if (originFrom) {
      navigate(originFrom)
      return
    }
    navigate(fallback.to)
  }, [navigate, originFrom, fallback.to])

  if (previous) {
    return { label: previous.title, to: `${previous.pathname}${previous.search}`, go }
  }
  if (origin?.from) {
    return { label: origin.fromLabel ?? pageTitle(origin.from), to: origin.from, go }
  }
  return { label: fallback.label, to: fallback.to, go }
}

/**
 * Der Ursprung, den ein Verweis auf eine Detailseite mitgibt.
 *
 * Der Verlauf trägt den Weg zurück in aller Regel selbst; das hier ist der
 * Rückfall für den Fall, dass er fehlt – nach einem Neuladen der Seite etwa.
 */
export function originState(location: Location, label?: string) {
  return {
    from: `${location.pathname}${location.search}`,
    fromLabel: label ?? pageTitle(location.pathname),
  }
}
