import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

/** Die Adresse der Vorschau – der Putzplan mit `?vorschau`. */
export const PUTZPLAN_PREVIEW = '/putzplan?vorschau'

/**
 * Die Vorschau des öffentlichen Putzplans.
 *
 * Mit Vollzugriff ist `/putzplan` die Seite zum Bearbeiten. Wie der Plan für
 * alle anderen aussieht – wer den QR-Code am Anschlagbrett scannt –, sähe man
 * sonst nur abgemeldet oder auf einem zweiten Gerät. Mit `?vorschau` zeigt
 * dieselbe Adresse die öffentliche Ansicht, und zwar samt der Hülle, die
 * jemand ohne Konto sieht: ohne Seitenleiste, hell, «Putzplan» im Kopf
 * (`components/Layout`). Wo dort «Anmelden» steht, steht hier «Vorschau
 * verlassen».
 *
 * Eine Adresse statt eines Schalters: Der Zurück-Knopf des Browsers verlässt
 * die Vorschau, wie man es erwartet, und Neuladen bleibt darin. Wirksam ist
 * sie nur mit Vollzugriff – ohne Konto ist `/putzplan?vorschau` schlicht der
 * öffentliche Putzplan, und einen Weg «zurück zur Bearbeitung» gibt es dort
 * nicht.
 */
export function usePutzplanPreview() {
  const { isApproved } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const active =
    isApproved &&
    location.pathname.startsWith('/putzplan') &&
    new URLSearchParams(location.search).has('vorschau')

  const enter = () => navigate(PUTZPLAN_PREVIEW, { state: { fromEditor: true } })

  /*
   * Zurück, wenn die Vorschau aus der Bearbeitung geöffnet wurde – dann
   * steht die Bearbeitung im Verlauf direkt davor. Sonst (ein Lesezeichen,
   * ein Link aus einer Nachricht) an ihre Stelle, damit «Zurück» nicht aus
   * der App hinausführt.
   */
  const leave = () => {
    if ((location.state as { fromEditor?: boolean } | null)?.fromEditor) navigate(-1)
    else navigate('/putzplan', { replace: true })
  }

  return { active, enter, leave }
}
