import { useEffect, useState, type ReactNode } from 'react'
import { Bell, CalendarClock, ListChecks, Smartphone, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import { NOTIFY_TIMES, WEEKDAY_LABELS, scheduleLabel } from '@/lib/notifications'
import { saveNotificationSettings, withDefaults } from '@/services/notifications'
import { disablePush, enablePush, pushConfigured, pushDenied, pushEnabled, pushSupported } from '@/services/push'
import type { NotificationMode } from '@/lib/types'

/**
 * Alles über Benachrichtigungen an einem Ort – erreichbar über das
 * Benutzermenü oben rechts.
 *
 * Der Aufbau folgt der einen Frage, die sich sonst niemand beantworten
 * kann: «Warum kommt bei mir nichts an?» Deshalb steht das Gerät zuoberst
 * (die Erlaubnis gilt je Browser und ist die häufigste Ursache), und erst
 * darunter kommt, **was** verschickt werden soll. Was gerade nicht möglich
 * ist, wird angeschrieben statt versteckt: ein fehlender Schlüssel, ein
 * Browser ohne Web-Push, eine verweigerte Erlaubnis.
 */
export function NotificationsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, isApproved, canViewImpulse } = useAuth()
  const toast = useToast()
  const { settings, loading } = useNotificationSettings()

  const [supported, setSupported] = useState<boolean | null>(null)
  const [deviceOn, setDeviceOn] = useState(pushEnabled)
  const [denied, setDenied] = useState(pushDenied)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void pushSupported().then((value) => {
      if (active) setSupported(value)
    })
    return () => {
      active = false
    }
  }, [])

  const configured = pushConfigured()
  const current = withDefaults(settings)

  const save = async (patch: Parameters<typeof saveNotificationSettings>[1]) => {
    if (!profile) return
    try {
      await saveNotificationSettings(profile.id, patch)
    } catch (error) {
      console.error(error)
      toast.error('Die Einstellung konnte nicht gespeichert werden.')
    }
  }

  const toggleDevice = async () => {
    if (!profile || busy) return
    setBusy(true)
    try {
      if (deviceOn) {
        await disablePush()
        setDeviceOn(false)
        toast.success('Dieses Gerät bekommt keine Nachrichten mehr.')
      } else {
        const outcome = await enablePush({ uid: profile.id })
        if (outcome === 'denied') {
          setDenied(true)
        } else {
          setDeviceOn(true)
          setDenied(false)
          toast.success('Dieses Gerät ist angemeldet.')
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
    <Modal open={open} onClose={onClose} title="Benachrichtigungen" size="md">
      <div className="space-y-6">
        {/* --- Das Gerät ------------------------------------------- */}
        <section>
          <SectionTitle icon={<Smartphone className="size-4" aria-hidden />}>
            Dieses Gerät
          </SectionTitle>

          {!configured ? (
            <p className="hint">
              Es fehlt noch der öffentliche VAPID-Schlüssel:{' '}
              <code>VITE_FIREBASE_VAPID_KEY</code> bei Netlify hinterlegen und neu ausrollen.
            </p>
          ) : supported === false ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Dieser Browser kann keine Mitteilungen empfangen. Auf dem iPhone geht es, sobald die
              App installiert ist: Teilen-Symbol → «Zum Home-Bildschirm», dann hier anmelden.
            </p>
          ) : (
            <>
              <Row
                label={deviceOn ? 'Angemeldet' : 'Nicht angemeldet'}
                description={
                  deviceOn
                    ? 'Nachrichten kommen auf diesem Gerät an. Die Erlaubnis gilt je Browser – andere Geräte melden Sie dort einzeln an.'
                    : 'Ohne Anmeldung bleibt es hier still, auch wenn unten etwas eingeschaltet ist.'
                }
                control={
                  <button
                    type="button"
                    className={deviceOn ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                    onClick={() => void toggleDevice()}
                    disabled={busy || supported === null}
                  >
                    {deviceOn ? 'Abmelden' : 'Anmelden'}
                  </button>
                }
              />
              {denied && (
                <p className="hint">
                  Der Browser hat Mitteilungen für diese App verweigert – das lässt sich nur in
                  den Browser-Einstellungen (Website-Berechtigungen) wieder erlauben.
                </p>
              )}
            </>
          )}
        </section>

        {/* --- Impuls ---------------------------------------------- */}
        {canViewImpulse && (
          <section>
            <SectionTitle icon={<Sparkles className="size-4" aria-hidden />}>Impuls</SectionTitle>

            <Row
              label="Erinnerung an die neue Woche"
              description={
                current.impuls.on
                  ? `${scheduleLabel(current.impuls)} – aber nur, wenn es auch Inhalt gibt.`
                  : 'Eine kurze Nachricht, wenn Impuls, Quiz und Challenge bereitstehen.'
              }
              control={
                <Switch
                  checked={current.impuls.on}
                  disabled={loading}
                  label="Erinnerung an die neue Woche"
                  onChange={(on) => void save({ impuls: { ...current.impuls, on } })}
                />
              }
            />

            {current.impuls.on && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="impuls-takt">
                    Wie oft
                  </label>
                  <select
                    id="impuls-takt"
                    className="input"
                    value={current.impuls.mode}
                    onChange={(event) =>
                      void save({
                        impuls: { ...current.impuls, mode: event.target.value as NotificationMode },
                      })
                    }
                  >
                    <option value="weekly">Einmal pro Woche</option>
                    <option value="daily">Einmal pro Tag</option>
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="impuls-tag">
                    Wochentag
                  </label>
                  <select
                    id="impuls-tag"
                    className="input"
                    value={current.impuls.weekday}
                    disabled={current.impuls.mode === 'daily'}
                    onChange={(event) =>
                      void save({
                        impuls: { ...current.impuls, weekday: Number(event.target.value) },
                      })
                    }
                  >
                    {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="impuls-zeit">
                    Uhrzeit
                  </label>
                  <select
                    id="impuls-zeit"
                    className="input"
                    value={current.impuls.time}
                    onChange={(event) =>
                      void save({ impuls: { ...current.impuls, time: event.target.value } })
                    }
                  >
                    {NOTIFY_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {current.impuls.on && current.impuls.mode === 'daily' && (
              <p className="hint">Beim Tagestakt spielt der Wochentag keine Rolle.</p>
            )}
          </section>
        )}

        {/* --- Sitzungen ------------------------------------------- */}
        {isApproved && (
          <section>
            <SectionTitle icon={<CalendarClock className="size-4" aria-hidden />}>
              Sitzungen
            </SectionTitle>

            <Row
              icon={<ListChecks className="size-4 text-slate-400" aria-hidden />}
              label="Neues Traktandum"
              description="Wenn jemand anderes etwas traktandiert. Gesammelt und höchstens alle 30 Minuten – fünf Traktanden am Abend sind eine Nachricht, nicht fünf. Was Sie selbst anlegen, meldet sich nie."
              control={
                <Switch
                  checked={current.agenda.on}
                  disabled={loading}
                  label="Neues Traktandum"
                  onChange={(on) => void save({ agenda: { on } })}
                />
              }
            />

            <Row
              icon={<Bell className="size-4 text-slate-400" aria-hidden />}
              label="Eine Stunde vor der Sitzung"
              description="Mit Anzahl Traktanden und Pendenzen – rechtzeitig, um noch einen Blick hineinzuwerfen."
              control={
                <Switch
                  checked={current.meeting.on}
                  disabled={loading}
                  label="Eine Stunde vor der Sitzung"
                  onChange={(on) => void save({ meeting: { on } })}
                />
              }
            />
          </section>
        )}

        {configured && supported !== false && !deviceOn && (current.impuls.on || current.agenda.on || current.meeting.on) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Eingeschaltet ist etwas – dieses Gerät ist aber nicht angemeldet. Oben anmelden, sonst
            kommt hier nichts an.
          </p>
        )}
      </div>
    </Modal>
  )
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
      {icon}
      {children}
    </h3>
  )
}

function Row({
  icon,
  label,
  description,
  control,
}: {
  icon?: ReactNode
  label: string
  description: string
  control: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 border-t border-slate-100 py-3 first:border-t-0 first:pt-0 dark:border-slate-800">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {label}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  )
}

/** Ein Schalter, kein Haken – für etwas, das sofort gilt. */
function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[1.375rem]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
