/**
 * Die eine Scroll-Sperre der App – gezählt statt gemerkt.
 *
 * Vollbild-Räume, der Feed, das Bild-Vollbild und jeder Dialog wollen
 * dasselbe: Hinter ihnen soll die Seite nicht mitrollen. Früher merkte
 * sich dafür jede Stelle den vorherigen Inline-Stil des `<body>` und
 * stellte ihn beim Schliessen zurück. Das zerbrach, sobald sich zwei
 * Sperren überlappten und in der «falschen» Reihenfolge lösten – etwa
 * wenn ein Dialog samt seinem Unterdialog im selben Zug verschwindet
 * (React räumt Eltern vor Kindern ab) oder die Zurück-Geste den Feed
 * mitsamt offenem Bild schliesst. Dann blieb `overflow: hidden` stehen,
 * und die Seite liess sich bis zum Neuladen nicht mehr rollen – auf dem
 * Handy fiel das zuerst auf, weil dort fast jede Seite rollt.
 *
 * Ein Zähler kennt keine Reihenfolge: Jede Sperre zählt hoch, ihr Lösen
 * zählt herunter, und erst bei null wird die Seite wieder freigegeben.
 * Gesperrt werden `<html>` und `<body>` gemeinsam – iOS Safari hört auf
 * das eine zuverlässiger als auf das andere.
 */

let locks = 0

function apply(locked: boolean) {
  const value = locked ? 'hidden' : ''
  document.documentElement.style.overflow = value
  document.body.style.overflow = value
}

/**
 * Die Seite hinter einem Vollbild oder Dialog anhalten.
 *
 * Gibt das Lösen als Funktion zurück – gedacht als Effekt-Aufräumer:
 * `useEffect(() => lockScroll(), [])`. Doppeltes Lösen derselben Sperre
 * ist folgenlos.
 */
export function lockScroll(): () => void {
  locks += 1
  if (locks === 1) apply(true)

  let released = false
  return () => {
    if (released) return
    released = true
    locks -= 1
    if (locks === 0) apply(false)
  }
}
