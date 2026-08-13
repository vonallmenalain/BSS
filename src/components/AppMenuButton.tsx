import { Menu } from 'lucide-react'
import { useAppMenu } from '@/contexts/AppMenuContext'

/**
 * Der Menüknopf der «App in der App».
 *
 * Im Bereich «Impuls» blendet das Layout die ganze Hülle aus – Kopfzeile,
 * Seitennavigation, untere Leiste. Dieser Knopf ist ihr einziger Rest:
 * dezent oben links im Seitenkopf, und erst der Tipp darauf öffnet die
 * Navigations-Schublade mit allen Bereichen der App.
 */
export function AppMenuButton() {
  const openMenu = useAppMenu()
  return (
    <button
      type="button"
      className="btn-ghost -ms-2 shrink-0 rounded-full p-2"
      onClick={openMenu}
      aria-label="Menü öffnen"
    >
      <Menu className="size-5" aria-hidden />
    </button>
  )
}
