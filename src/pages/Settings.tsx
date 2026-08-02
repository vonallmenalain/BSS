import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CalendarCog,
  Check,
  Database,
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
import { downloadCsv, membersToCsv } from '@/services/import'
import { ROLE_LABELS, type AppSettings, type Role } from '@/lib/types'

export function Settings() {
  const { profile, isLeadership } = useAuth()
  const { settings, users, members } = useData()
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
      await saveSettings(form)
      toast.success('Einstellungen gespeichert.')
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
      await updateUserProfile(profile.id, { displayName: displayName.trim() })
      toast.success('Profil aktualisiert.')
    } catch (error) {
      console.error(error)
      toast.error('Speichern fehlgeschlagen.')
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void saveProfile()}
              disabled={!displayName.trim() || displayName === profile?.displayName}
            >
              Speichern
            </button>
          </div>
          <p className="hint">
            Angemeldet als {profile?.email} · Rolle: {profile ? ROLE_LABELS[profile.role] : '–'}
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
              disabled={!isLeadership}
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
                disabled={!isLeadership}
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
                disabled={!isLeadership}
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
                disabled={!isLeadership}
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
                disabled={!isLeadership}
              />
            </div>
          </div>
        </section>

        {/* ---------- Ansprachen ---------- */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Mic className="size-4 text-slate-400" aria-hidden />
            Ansprachen
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="s-sacrament">
                Wochentag der Versammlung
              </label>
              <select
                id="s-sacrament"
                className="input"
                value={form.sacramentWeekday}
                onChange={(event) => update('sacramentWeekday', Number(event.target.value))}
                disabled={!isLeadership}
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
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
                disabled={!isLeadership}
              />
            </div>
            <div>
              <label className="label" htmlFor="s-gap">
                «Lange nicht dran» ab (Monate)
              </label>
              <input
                id="s-gap"
                type="number"
                min={1}
                max={120}
                className="input"
                value={form.talkGapMonths}
                onChange={(event) => update('talkGapMonths', Number(event.target.value))}
                disabled={!isLeadership}
              />
              <p className="hint">Steuert die Vorschlagsliste.</p>
            </div>
          </div>
        </section>

        {isLeadership && (
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
              <Check className="size-4" aria-hidden />
              {saving ? 'Wird gespeichert …' : 'Einstellungen speichern'}
            </button>
          </div>
        )}

        {/* ---------- Benutzer ---------- */}
        {isLeadership && (
          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-slate-400" aria-hidden />
              Benutzer und Rollen
            </h2>
            <p className="hint mb-4">
              <strong>Bischof</strong> und <strong>Ratgeber</strong> sehen alles, auch vertrauliche
              Traktanden. <strong>Sekretäre</strong> arbeiten mit, sehen aber keine vertraulichen
              Einträge.
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
        )}

        {/* ---------- Daten ---------- */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-slate-400" aria-hidden />
            Daten
          </h2>
          <div className="flex flex-wrap gap-2">
            {isLeadership && (
              <Link to="/import" className="btn-secondary">
                <Upload className="size-4" aria-hidden />
                Mitglieder importieren
              </Link>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                downloadCsv(
                  membersToCsv(members),
                  `mitglieder-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
            >
              Mitgliederliste als CSV sichern
            </button>
          </div>
          <p className="hint mt-3">
            {members.length} Mitglieder erfasst. Die Daten liegen in deinem Firebase-Projekt –
            eine regelmässige Sicherung ist trotzdem sinnvoll.
          </p>
        </section>

        <p className="pb-4 text-center text-xs text-slate-400">
          Bischofschaft · PWA · Daten in Firebase (Firestore + Authentication)
        </p>
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
      await setUserRole(user.id, role)
      toast.success(`${user.displayName}: ${ROLE_LABELS[role]}`)
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
        // Die eigene Rolle nicht herabstufen können – sonst sperrt man sich aus.
        disabled={isSelf}
        aria-label={`Rolle von ${user.displayName}`}
      >
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
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
          void deleteUserProfile(user.id).then(() => toast.success('Profil entfernt.'))
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
