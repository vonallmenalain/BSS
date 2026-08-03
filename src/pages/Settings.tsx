import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CalendarCog,
  Check,
  Mic,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader } from '@/components/ui/Pickers'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { WEEKDAYS } from '@/lib/dates'
import { saveSettings } from '@/services/settings'
import { deleteUserProfile, setUserActive, setUserRole, updateUserProfile } from '@/services/users'
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AppSettings, type Role } from '@/lib/types'

export function Settings() {
  const { profile } = useAuth()
  const { settings, users } = useData()
  const toast = useToast()

  const [form, setForm] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')

  // Einstellungen aus Firestore übernehmen, sobald sie geladen sind.
  useEffect(() => setForm(settings), [settings])
  useEffect(() => setDisplayName(profile?.displayName ?? ''), [profile?.displayName])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const outcome = await saveSettings(form)
      toast.saved('Einstellungen gespeichert.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = async () => {
    if (!profile || !displayName.trim()) return
    try {
      const outcome = await updateUserProfile(profile.id, { displayName: displayName.trim() })
      toast.saved('Profil aktualisiert.', outcome)
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
    }
  }

  /**
   * Die eigene Rolle korrigieren.
   *
   * Wer beim Einrichten versehentlich als Bischof angelegt wurde, soll sich
   * selbst als 1. Ratgeber eintragen können. Weil alle freigeschalteten Rollen
   * dieselben Rechte haben, ist damit keine Rechteausweitung verbunden.
   */
  const changeOwnRole = async (role: Role) => {
    if (!profile || role === profile.role) return
    try {
      const outcome = await setUserRole(profile.id, role)
      toast.saved(`Deine Rolle: ${ROLE_LABELS[role]}`, outcome)
    } catch (error) {
      console.error(error)
      toast.error('Rolle konnte nicht geändert werden.')
    }
  }

  const pendingUsers = users.filter((user) => user.role === 'pending')

  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Gemeinde, Sitzungsrhythmus und Zugriffe" />

      <div className="space-y-4">
        {/* ---------- Eigenes Profil ---------- */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <UserCog className="size-4 text-slate-400" aria-hidden />
            Mein Profil
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor="s-name">
                Anzeigename
              </label>
              <input
                id="s-name"
                className="input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="min-w-44">
              <label className="label" htmlFor="s-role">
                Meine Rolle
              </label>
              <select
                id="s-role"
                className="input"
                value={profile?.role ?? 'secretary'}
                onChange={(event) => void changeOwnRole(event.target.value as Role)}
              >
                {/* Die alte Sammelrolle bleibt wählbar, solange sie gesetzt ist. */}
                {profile?.role === 'counselor' && (
                  <option value="counselor">{ROLE_LABELS.counselor}</option>
                )}
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void saveProfile()}
              disabled={!displayName.trim() || displayName === profile?.displayName}
            >
              Namen speichern
            </button>
          </div>
          <p className="hint">
            Angemeldet als {profile?.email}. Die Rolle wirkt sofort und beschreibt deine Aufgabe –
            am Zugriff ändert sie nichts, alle Rollen sehen dasselbe.
          </p>
        </section>

        {/* ---------- Gemeinde ---------- */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-slate-400" aria-hidden />
            Gemeinde
          </h2>
          <div>
            <label className="label" htmlFor="s-ward">
              Name der Gemeinde
            </label>
            <input
              id="s-ward"
              className="input max-w-sm"
              value={form.wardName}
              onChange={(event) => update('wardName', event.target.value)}
            />
          </div>
        </section>

        {/* ---------- Sitzungen ---------- */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <CalendarCog className="size-4 text-slate-400" aria-hidden />
            Sitzungsrhythmus
          </h2>
          <p className="hint mb-4">
            Diese Werte schlägt die App beim Planen der nächsten Sitzung vor.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="s-weekday">
                Wochentag
              </label>
              <select
                id="s-weekday"
                className="input"
                value={form.meetingWeekday}
                onChange={(event) => update('meetingWeekday', Number(event.target.value))}
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-time">
                Uhrzeit
              </label>
              <input
                id="s-time"
                type="time"
                className="input"
                value={form.meetingTime}
                onChange={(event) => update('meetingTime', event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="s-title">
                Standardtitel
              </label>
              <input
                id="s-title"
                className="input"
                value={form.meetingTitle}
                onChange={(event) => update('meetingTitle', event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="s-location">
                Ort
              </label>
              <input
                id="s-location"
                className="input"
                value={form.meetingLocation}
                onChange={(event) => update('meetingLocation', event.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---------- Abendmahlsversammlung ---------- */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Mic className="size-4 text-slate-400" aria-hidden />
            Abendmahlsversammlung
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="s-sacrament">
                Wochentag der Versammlung
              </label>
              <select
                id="s-sacrament"
                className="input"
                value={form.sacramentWeekday}
                onChange={(event) => update('sacramentWeekday', Number(event.target.value))}
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-sacrament-time">
                Beginn
              </label>
              <input
                id="s-sacrament-time"
                type="time"
                className="input"
                value={form.sacramentTime}
                onChange={(event) => update('sacramentTime', event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="s-count">
                Ansprachen pro Versammlung
              </label>
              <input
                id="s-count"
                type="number"
                min={1}
                max={6}
                className="input"
                value={form.talksPerSunday}
                onChange={(event) => update('talksPerSunday', Number(event.target.value))}
              />
              <p className="hint">
                Standardwert. Für einen einzelnen Sonntag lassen sich unter «Ansprachen» zusätzliche
                Plätze oder ein Zeugnis einfügen.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="s-gap">
                Ansprache: «lange nicht dran» ab (Monate)
              </label>
              <input
                id="s-gap"
                type="number"
                min={1}
                max={120}
                className="input"
                value={form.talkGapMonths}
                onChange={(event) => update('talkGapMonths', Number(event.target.value))}
              />
              <p className="hint">Steuert die Vorschlagsliste.</p>
            </div>
            <div>
              <label className="label" htmlFor="s-min-age">
                Ansprachen: erst ab Alter
              </label>
              <input
                id="s-min-age"
                type="number"
                min={0}
                max={30}
                className="input"
                value={form.talkMinAge}
                onChange={(event) => update('talkMinAge', Number(event.target.value))}
              />
              <p className="hint">
                Hält die Kinder aus der Vorschlagsliste – sie stünden sonst zuoberst, weil sie noch
                nie gesprochen haben. Wer kein Geburtsdatum hat, bleibt in der Liste.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="s-prayer-gap">
                Gebet: «lange nicht dran» ab (Monate)
              </label>
              <input
                id="s-prayer-gap"
                type="number"
                min={1}
                max={120}
                className="input"
                value={form.prayerGapMonths}
                onChange={(event) => update('prayerGapMonths', Number(event.target.value))}
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={saving}
          >
            <Check className="size-4" aria-hidden />
            {saving ? 'Wird gespeichert …' : 'Einstellungen speichern'}
          </button>
        </div>

        {/* ---------- Benutzer ---------- */}
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-slate-400" aria-hidden />
            Benutzer und Rollen
          </h2>
          <p className="hint mb-4">
            Bischof, 1. und 2. Ratgeber sowie die Sekretäre haben dieselben Berechtigungen und sehen
            alles. Die Rolle hält fest, wer welche Aufgabe hat – etwa wer die Abendmahlsversammlung
            leitet. Nur <strong>«Wartet auf Freigabe»</strong> hat keinen Zugriff.
          </p>

          {pendingUsers.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                {pendingUsers.length} Konto{pendingUsers.length === 1 ? '' : 'en'} wartet
                {pendingUsers.length === 1 ? '' : 'n'} auf Freigabe
              </p>
            </div>
          )}

          <ul className="divide-list">
            {users.map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === profile?.id} />
            ))}
          </ul>
        </section>

        {/* ---------- Import ---------- */}
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Upload className="size-4 text-slate-400" aria-hidden />
            Import
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/import" className="btn-secondary">
              <Upload className="size-4" aria-hidden />
              Zu den Importen
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

function UserRow({
  user,
  isSelf,
}: {
  user: { id: string; displayName: string; email: string; role: Role; active: boolean }
  isSelf: boolean
}) {
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const changeRole = async (role: Role) => {
    try {
      const outcome = await setUserRole(user.id, role)
      toast.saved(`${user.displayName}: ${ROLE_LABELS[role]}`, outcome)
    } catch (error) {
      console.error(error)
      toast.error('Rolle konnte nicht geändert werden.')
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar name={user.displayName} id={user.id} size="md" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user.displayName}
          {isSelf && <span className="ml-1.5 text-xs text-slate-400">(du)</span>}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
      </div>

      <select
        className="input w-auto py-1.5 text-sm"
        value={user.role}
        onChange={(event) => void changeRole(event.target.value as Role)}
        aria-label={`Rolle von ${user.displayName}`}
      >
        {/* Die alte Sammelrolle nur zeigen, solange sie noch gesetzt ist. */}
        {user.role === 'counselor' && <option value="counselor">{ROLE_LABELS.counselor}</option>}
        {ASSIGNABLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
        {/* Sich selbst den Zugang zu entziehen wäre eine Sackgasse – deshalb
            steht «Wartet auf Freigabe» nur für andere Konten zur Wahl. */}
        {!isSelf && <option value="pending">{ROLE_LABELS.pending}</option>}
      </select>

      {!isSelf && (
        <>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => void setUserActive(user.id, !user.active)}
          >
            {user.active ? 'Deaktivieren' : 'Aktivieren'}
          </button>
          <button
            type="button"
            className="btn-ghost p-1.5 text-rose-600 dark:text-rose-400"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Profil von ${user.displayName} entfernen`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteUserProfile(user.id).then((outcome) =>
            toast.saved('Profil entfernt.', outcome),
          )
        }}
        title="Profil entfernen?"
        message={
          <>
            Das Profil von {user.displayName} wird gelöscht und der Zugriff endet sofort. Das
            Anmeldekonto selbst bleibt in Firebase Authentication bestehen – dort kannst du es bei
            Bedarf ganz löschen.
          </>
        }
        confirmLabel="Entfernen"
        danger
      />
    </li>
  )
}
