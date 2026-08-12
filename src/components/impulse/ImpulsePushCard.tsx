import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  disableImpulsePush,
  enableImpulsePush,
  impulsePushConfigured,
  impulsePushEnabled,
  impulsePushSupported,
} from '@/services/impulsePush'

/**
 * Die Montags-Erinnerung – der eine Schalter, den das Konzept versprochen
 * hat: abschaltbar, still und ohne Inhalt keine Nachricht. Der Schalter
 * gilt je Gerät; wer sie auf dem Telefon mag und am Laptop nicht, bekommt
 * genau das.
 *
 * Drei Zustände jenseits von an/aus, alle angeschrieben statt verschwiegen:
 * Ohne hinterlegten VAPID-Schlüssel erscheint die Karte nur der Redaktion
 * (mit dem Hinweis, was fehlt); ein Browser ohne Web-Push – das iPhone im
 * Safari-Tab – bekommt den Weg gesagt («zuerst installieren»); und eine
 * verweigerte Erlaubnis erklärt, dass nur die Browser-Einstellungen sie
 * zurückbringen.
 */
export function ImpulsePushCard() {
  const { profile, canEditImpulse } = useAuth()
  const toast = useToast()
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(impulsePushEnabled)
  const [denied, setDenied] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'denied',
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void impulsePushSupported().then((value) => {
      if (active) setSupported(value)
    })
    return () => {
      active = false
    }
  }, [])

  const configured = impulsePushConfigured()
  if (!configured && !canEditImpulse) return null
  if (supported === null) return null

  const toggle = async () => {
    if (!profile || busy) return
    setBusy(true)
    try {
      if (enabled) {
        await disableImpulsePush()
        setEnabled(false)
        toast.success('Erinnerung ausgeschaltet.')
      } else {
        const outcome = await enableImpulsePush({ uid: profile.id })
        if (outcome === 'denied') {
          setDenied(true)
        } else {
          setEnabled(true)
          setDenied(false)
          toast.success('Erinnerung eingeschaltet – bis Montag.')
        }
      }
    } catch (error) {
      console.error(error)
      toast.error('Das konnte nicht eingerichtet werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <p className="hint flex items-center gap-1.5 font-medium">
        <Bell className="size-4" aria-hidden />
        Montags-Erinnerung
      </p>

      {!configured ? (
        <p className="hint mt-2">
          Der öffentliche VAPID-Schlüssel fehlt noch: <code>VITE_FIREBASE_VAPID_KEY</code> bei
          Netlify hinterlegen und neu ausrollen – dann erscheint hier der Schalter.
        </p>
      ) : !supported ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Dieser Browser kann keine Mitteilungen empfangen. Auf dem iPhone geht es, sobald die
          App installiert ist: Teilen-Symbol → «Zum Home-Bildschirm», dann hier einschalten.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
            {enabled
              ? 'Dieses Gerät bekommt montags eine kurze Nachricht, sobald die neue Woche bereit ist. Ohne Inhalt bleibt es still.'
              : 'Eine kurze Nachricht am Montagmorgen, wenn die neue Woche bereit ist – nur auf diesem Gerät, jederzeit abschaltbar.'}
          </p>
          <button
            type="button"
            className={enabled ? 'btn-secondary' : 'btn-primary'}
            onClick={() => void toggle()}
            disabled={busy}
          >
            {enabled ? (
              <>
                <BellOff className="size-4" aria-hidden />
                Ausschalten
              </>
            ) : (
              <>
                <Bell className="size-4" aria-hidden />
                Einschalten
              </>
            )}
          </button>
        </div>
      )}

      {denied && configured && supported && (
        <p className="hint mt-2">
          Der Browser hat Mitteilungen für diese App verweigert – das lässt sich nur in den
          Browser-Einstellungen (Website-Berechtigungen) wieder erlauben.
        </p>
      )}
    </section>
  )
}
