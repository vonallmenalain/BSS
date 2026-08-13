import { createContext, useContext } from 'react'

/**
 * Öffnet die Navigations-Schublade der App – von überall her.
 *
 * Gebraucht wird das im Bereich «Anti Doom»: Dort ist die ganze Hülle der App
 * ausgeblendet (Kopfzeile, Seitennavigation, untere Leiste – siehe
 * `Layout`), damit sich der Bereich wie eine eigene Vollbild-App anfühlt.
 * Die Seiten des Bereichs tragen stattdessen oben links einen dezenten
 * Menüknopf (`AppMenuButton`); was er öffnet, gehört aber der Hülle –
 * dieser Kontext reicht den Handgriff hinunter.
 */
export const AppMenuContext = createContext<() => void>(() => {})

/** Der Handgriff zum Öffnen der Navigations-Schublade. */
export function useAppMenu(): () => void {
  return useContext(AppMenuContext)
}
