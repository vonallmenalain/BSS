import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CalendarCog,
  Check,
  Database,
  Mic,
  Music,
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
import { downloadCsv, membersToCsv, parseFile } from '@/services/import'
import {
  clearHymns,
  guessHymnColumns,
  importHymns,
  parseHymnSheet,
  type HymnRow,
} from '@/services/hymns'
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AppSettings, type Role } from '@/lib/types'

export function Settings() {
  const { profile } = useAuth()
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

        {/* ---------- Liederliste ---------- */}
        <HymnListSection />

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

        {/* ---------- Daten ---------- */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-slate-400" aria-hidden />
            Daten
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/import" className="btn-secondary">
              <Upload className="size-4" aria-hidden />
              Mitglieder importieren
            </Link>
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
            {members.length} Mitglieder erfasst. Die Daten liegen in deinem Firebase-Projekt – eine
            regelmässige Sicherung ist trotzdem sinnvoll.
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
/* Liederliste                                                         */
/* ------------------------------------------------------------------ */

/**
 * Import der Liederliste aus Excel oder CSV.
 *
 * Zweck: Beim Erfassen der Musik soll die Liednummer genügen – den Titel
 * ergänzt die App. Erwartet wird eine Spalte mit der Nummer und eine mit dem
 * Titel; welche das sind, erkennt der Import selbst und zeigt es zur Kontrolle.
 */
function HymnListSection() {
  const { hymns } = useData()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<HymnRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const sheet = await parseFile(file)
      const rows = parseHymnSheet(sheet, guessHymnColumns(sheet))
      if (rows.length === 0) {
        toast.error('In der Datei wurden keine Lieder gefunden (Nummer und Titel nötig).')
        return
      }
      setFileName(file.name)
      setPreview(rows)
    } catch (error) {
      console.error(error)
      toast.error('Die Datei konnte nicht gelesen werden. Unterstützt: .xlsx und .csv')
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const count = await importHymns(preview)
      toast.success(`${count} Lieder übernommen.`)
      setPreview(null)
      setFileName('')
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error && error.message ? error.message : 'Der Import ist fehlgeschlagen.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Music className="size-4 text-slate-400" aria-hidden />
        Liederliste
      </h2>
      <p className="hint mb-4">
        {hymns.length > 0
          ? `${hymns.length} Lieder hinterlegt – beim Erfassen der Musik genügt die Nummer.`
          : 'Lade eine Excel- oder CSV-Datei mit Liednummer und Titel hoch. Danach genügt beim Erfassen der Musik die Nummer.'}
      </p>

      {preview ? (
        <>
          <p className="text-sm">
            <strong>{fileName}</strong> · {preview.length} Lieder erkannt
          </p>
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            {preview.slice(0, 40).map((row) => (
              <li key={row.number} className="flex gap-3">
                <span className="tabular w-10 shrink-0 text-slate-500">{row.number}</span>
                <span className="truncate">{row.title}</span>
              </li>
            ))}
            {preview.length > 40 && (
              <li className="pt-1 text-xs text-slate-400">… und {preview.length - 40} weitere</li>
            )}
          </ul>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPreview(null)}
              disabled={busy}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void run()}
              disabled={busy}
            >
              {busy ? 'Wird übernommen …' : `${preview.length} Lieder übernehmen`}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            <Upload className="size-4" aria-hidden />
            {hymns.length > 0 ? 'Liste aktualisieren' : 'Liederliste hochladen'}
          </button>
          {hymns.length > 0 && (
            <button
              type="button"
              className="btn-ghost text-rose-600 dark:text-rose-400"
              onClick={() => setConfirmClear(true)}
              disabled={busy}
            >
              <Trash2 className="size-4" aria-hidden />
              Liste leeren
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
              event.target.value = ''
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          void clearHymns()
            .then((count) => toast.success(`${count} Lieder entfernt.`))
            .catch((error: unknown) =>
              toast.error(
                error instanceof Error && error.message
                  ? error.message
                  : 'Die Liste konnte nicht geleert werden.',
              ),
            )
        }}
        title="Liederliste leeren?"
        message="Bereits erfasste Programme behalten ihre Liedtitel – nur die Nachschlageliste wird gelöscht."
        confirmLabel="Leeren"
        danger
      />
    </section>
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
