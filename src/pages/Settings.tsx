import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Award,
  Brush,
  Building2,
  CalendarCog,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DatabaseBackup,
  Download,
  GraduationCap,
  HeartHandshake,
  History,
  Loader2,
  Mic,
  Music,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useAutosave, saveStateLabel } from '@/hooks/useAutosave'
import { MemberCombobox, PageHeader } from '@/components/ui/Pickers'
import { ConfirmDialog } from '@/components/ui/Modal'
import { UserAvatar } from '@/components/ui/Avatar'
import { WEEKDAYS } from '@/lib/dates'
import { resyncCollectionStores } from '@/lib/collectionStore'
import { backupTotal } from '@/lib/backup'
import { BACKUP_COLLECTIONS, createBackup, downloadBackup } from '@/services/backup'
import { saveSettings } from '@/services/settings'
import { deleteUserProfile, setUserActive, setUserRole, updateUserProfile } from '@/services/users'
import { formatRelative } from '@/lib/dates'
import { cn } from '@/lib/utils'
import {
  ACCESS_LEVELS,
  AP_ONLY_ROLES,
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  type AccessLevel,
  type AppSettings,
  type AppUser,
  type Role,
} from '@/lib/types'

/**
 * Alles, was sich von aussen übernehmen lässt – der einzige Weg dorthin.
 *
 * Die Reihenfolge ist die des Einrichtens: Zuerst die Mitglieder, denn
 * Berufungen und Betreuung ordnen ihre Einträge erfassten Personen zu.
 * Danach, was jeweils zu seiner Zeit anfällt.
 */
const IMPORTS = [
  {
    to: '/import',
    label: 'Mitglieder',
    description: 'Mitgliederverzeichnis aus dem LCR – Grundlage für alles Übrige',
    icon: ClipboardList,
  },
  {
    to: '/import/berufungen',
    label: 'Berufungen',
    description: 'Organisationen, Berufungen ausserhalb der Einheit und die Berufungshistorie',
    icon: Award,
  },
  {
    to: '/import/betreuung',
    label: 'Betreuung',
    description: 'Betreuungspartner und Betreuungsaufträge',
    icon: HeartHandshake,
  },
  {
    to: '/import/alleinstehende',
    label: 'Alleinstehende',
    description: 'Die Listen JAE und AE – Grundlage für den Filter nach Organisation',
    icon: Users,
  },
  {
    to: '/import/putzplan',
    label: 'Putzplan',
    description: 'Die Excel-Tabelle der Gemeinde als Wochenplan',
    icon: Brush,
  },
  {
    to: '/import/aktivitaeten',
    label: 'Aktivitäten AP',
    description: 'Der bisherige Jahresplan der Priestertumskollegien als Kalender',
    icon: CalendarDays,
  },
  {
    to: '/import/ap-themen',
    label: 'Themen AP-Klasse',
    description: 'Die Lektionen eines Monats aus «Für eine starke Jugend» – jeden Monat neu',
    icon: GraduationCap,
  },
  {
    to: '/import/sitzungen',
    label: 'Sitzungen',
    description: 'Die bisherigen Protokolle als Sitzungsgeschichte und offene Pendenzen',
    icon: NotebookPen,
  },
  {
    to: '/import/verlauf',
    label: 'Verlauf',
    description: 'Frühere Ansprachen und Gebete – einmalig beim Einrichten',
    icon: History,
  },
  {
    to: '/import/lieder',
    label: 'Liederlisten',
    description: 'Damit beim Erfassen der Musik die Liednummer genügt',
    icon: Music,
  },
]

export function Settings() {
  const { profile, isAdmin } = useAuth()
  const { settings, users } = useData()
  const toast = useToast()

  const [form, setForm] = useState<AppSettings>(settings)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')

  /*
   * Einstellungen aus Firestore übernehmen, sobald sie geladen sind – aber
   * nur, solange hier niemand tippt: Nach jedem Speichern kommt der eigene
   * Schnappschuss zurück, und übernähme er das Formular bedingungslos, wären
   * die Tastendrücke der letzten Sekunde weg. Weicht das Formular vom zuletzt
   * übernommenen Stand ab, behält es die Eingabe; geschrieben wird sie vom
   * Autosave ohnehin.
   */
  const adopted = useRef(settings)
  useEffect(() => {
    setForm((current) =>
      JSON.stringify(current) === JSON.stringify(adopted.current) ? settings : current,
    )
    adopted.current = settings
  }, [settings])
  useEffect(() => setDisplayName(profile?.displayName ?? ''), [profile?.displayName])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  /*
   * Auch hier gilt: kein Speichern-Knopf.
   *
   * Eine Einstellung wird angetippt und die Seite verlassen – wer dazwischen
   * noch einen Knopf treffen muss, hat irgendwann eine Zahl geändert, die
   * nirgends ankam. Geschrieben wird deshalb kurz nach der letzten Änderung
   * und spätestens beim Verlassen der Seite.
   *
   * `savable` vergleicht mit dem Stand aus Firestore: Sonst schriebe schon
   * das erste Eintreffen der Einstellungen sie unverändert wieder zurück –
   * der Zustand hier folgt ja dem Schnappschuss.
   */
  const autosave = useAutosave(
    form,
    async (value) => {
      await saveSettings(value)
    },
    { savable: (value) => JSON.stringify(value) !== JSON.stringify(settings) },
  )

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

  /*
   * Mit «#benutzer» in der Adresse gleich zu den Registrierungen scrollen.
   * Der Router lässt den Anker links liegen – er kennt nur Pfade.
   */
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

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
                // Ein geleertes Feld fällt auf den letzten gültigen Wert
                // zurück – ohne Beginn liesse sich keine Ansprache eintragen.
                onBlur={() => {
                  if (!form.sacramentTime) update('sacramentTime', settings.sacramentTime)
                }}
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
                // Leer oder 0 hiesse: kein einziger Programmplatz an keinem
                // Sonntag. Zurück auf den letzten gültigen Wert.
                onBlur={() => {
                  if (!form.talksPerSunday || form.talksPerSunday < 1)
                    update('talksPerSunday', settings.talksPerSunday)
                }}
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

        <p className="text-right text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {saveStateLabel(autosave.state)}
        </p>

        {/* ---------- Benutzer ----------
            Das Sprungziel der Übersicht: Wer dort auf «neue Registrierung»
            tippt, landet hier – und nicht am Anfang einer langen Seite. */}
        <section id="benutzer" className="card scroll-mt-20 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-slate-400" aria-hidden />
            Benutzer und Rollen
          </h2>
          <p className="hint mb-4">
            Bischof, 1. und 2. Ratgeber sowie die Sekretäre haben dieselben Berechtigungen und sehen
            alles. Die Rolle hält fest, wer welche Aufgabe hat – etwa wer die Abendmahlsversammlung
            leitet. Daneben gibt es zwei Zugänge, die <strong>ausschliesslich</strong> «Aktivitäten
            AP’s» zeigen – einen mit und einen ohne Schreibrecht. Wer{' '}
            <strong>«Wartet auf Freigabe»</strong> ist, sieht nichts.
          </p>
          <p className="hint mb-4">
            Neben der Rolle steht, <strong>wer im Mitgliederverzeichnis</strong> zu diesem Konto
            gehört. Ein Konto ist eine Anmeldung, ein Mitglied ein Eintrag der Gemeinde – erst diese
            Verknüpfung sagt der App, dass beides dieselbe Person ist.
          </p>
          {!isAdmin && (
            <p className="hint mb-4">
              Freischalten, Rollen ändern und Konten entfernen kann nur das Administrator-Konto.
            </p>
          )}

          {isAdmin ? (
            <PendingUsers users={pendingUsers} />
          ) : (
            pendingUsers.length > 0 && (
              <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {pendingUsers.length === 1
                  ? 'Eine neue Registrierung wartet auf Freigabe'
                  : `${pendingUsers.length} neue Registrierungen warten auf Freigabe`}{' '}
                ({pendingUsers.map((user) => user.displayName || user.email).join(', ')}) –
                freischalten kann sie nur das Administrator-Konto.
              </p>
            )
          )}

          <ul className="divide-list">
            {users
              .filter((user) => user.role !== 'pending')
              .map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === profile?.id}
                  canManage={isAdmin}
                />
              ))}
          </ul>
        </section>

        {/* ---------- Import ----------
            Zugeklappt, weil Importe zum Einrichten gehören und nicht zum
            Alltag: Wer die Einstellungen öffnet, sucht in aller Regel etwas
            anderes. Die ganze Liste erscheint erst auf Wunsch. */}
        <ImportSection />

        {/* Die Sicherung steht bewusst gleich unter den Importen: Ein Import
            ist der Handgriff, nach dem man sie am ehesten bräuchte. Sie
            gehört allein dem Administrator-Konto: Die Datei enthält den
            ganzen Bestand samt Personendaten, und wer sie herunterlädt,
            trägt sie ausser Haus. */}
        {isAdmin && <BackupSection />}

        <SyncSection />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Daten neu laden                                                     */
/* ------------------------------------------------------------------ */

/**
 * Der Notausgang für den Datenabgleich.
 *
 * Die App liest jede Sammlung einmal vollständig und danach nur noch, was
 * dazugekommen ist (siehe `lib/collectionStore`). Das ist der Grund, weshalb
 * sie sofort dasteht und kaum Leseoperationen verbraucht – und der Grund,
 * weshalb es diesen Knopf braucht: Sollte einmal etwas fehlen, das ein
 * anderes Gerät geschrieben hat, holt er alles frisch. Im Alltag wird er
 * nicht gebraucht.
 */
function SyncSection() {
  const toast = useToast()

  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <RefreshCw className="size-4 text-slate-400" aria-hidden />
        Daten neu laden
      </h2>
      <p className="hint mb-4">
        Die App hält die Daten von selbst aktuell und lädt nur nach, was sich geändert hat. Falls
        doch einmal etwas fehlt, holt dieser Knopf den ganzen Bestand neu vom Server.
      </p>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          resyncCollectionStores()
          toast.success('Der Bestand wird neu gelesen.')
        }}
      >
        <RefreshCw className="size-4" aria-hidden />
        Alles neu laden
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Importe                                                             */
/* ------------------------------------------------------------------ */

/**
 * Die Liste der Importe – zugeklappt, bis jemand sie braucht.
 *
 * Ein Import ist der seltenste Handgriff der App: einmal beim Einrichten,
 * danach höchstens zweimal im Jahr. Acht Einträge dafür dauerhaft offen zu
 * lassen, macht die Einstellungen länger, als sie sein müssen.
 */
function ImportSection() {
  const [open, setOpen] = useState(false)

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="-m-1 flex w-full items-center gap-2 rounded-lg p-1 text-left"
        >
          <Upload className="size-4 shrink-0 text-slate-400" aria-hidden />
          <span className="flex-1">Importe</span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-slate-400 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </h2>

      {open && (
        <ul className="divide-list mt-2">
          {IMPORTS.map((entry) => (
            <li key={entry.to}>
              <Link
                to={entry.to}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <entry.icon className="size-4 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{entry.label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {entry.description}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Sicherung                                                           */
/* ------------------------------------------------------------------ */

/**
 * Alles auf einmal mitnehmen – für den Fall, dass etwas schiefgeht.
 *
 * Firestore kennt keinen Papierkorb, und die App kennt mehrere Wege, viel auf
 * einmal zu löschen: Ein Mitgliederimport entfernt auf Wunsch alle, die in
 * der Quelle fehlen, der AP-Import ersetzt den ganzen Jahresplan. Deshalb
 * steht der Knopf gleich unter den Importen.
 *
 * Er ersetzt die Sicherung im Firebase-Projekt nicht: Point-in-time-Recovery
 * hält dort sieben Tage lang jeden Stand vor, ohne dass jemand daran gedacht
 * haben muss. Diese Datei ist die Kopie daneben – lesbar ohne Konsole, und
 * sie darf älter werden als sieben Tage.
 *
 * Sichtbar ist der Abschnitt allein für das Administrator-Konto (siehe
 * `Settings`): Die Datei nimmt den ganzen Bestand samt Adressen und Notizen
 * mit aus der App heraus. Was dabei zu beachten ist, steht im README unter
 * «Sicherung» – nicht auf dem Knopf, denn wer ihn sieht, weiss es bereits.
 */
function BackupSection() {
  const { firebaseUser } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)

  const download = async () => {
    setBusy(true)
    setDone(0)
    try {
      const backup = await createBackup(firebaseUser?.email ?? 'unbekannt', (count) =>
        setDone(count),
      )
      const filename = downloadBackup(backup)
      const total = backupTotal(backup.counts).toLocaleString('de-CH')
      /*
       * Ohne Verbindung liest Firestore aus der lokalen Kopie. Die Sicherung
       * ist dann vollständig, aber womöglich nicht der neueste Stand – das
       * wird gesagt, statt einen Erfolg zu behaupten, der so nicht stimmt.
       */
      if (backup.source === 'cache') {
        toast.warning(
          `${total} Datensätze aus der lokalen Kopie: ${filename}. Ohne Verbindung fehlt womöglich das Neueste – bitte online wiederholen.`,
        )
      } else {
        toast.success(`${total} Datensätze gesichert: ${filename}`)
      }
    } catch (error) {
      console.error(error)
      toast.error('Die Sicherung konnte nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <DatabaseBackup className="size-4 text-slate-400" aria-hidden />
        Sicherung
      </h2>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => void download()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
        {busy
          ? `Sicherung läuft … (${done} von ${BACKUP_COLLECTIONS.length})`
          : 'Alle Daten als JSON herunterladen'}
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Neue Registrierungen                                                */
/* ------------------------------------------------------------------ */

/**
 * Wer sich registriert hat und noch auf die Freigabe wartet.
 *
 * Bewusst als eigener Kasten über der Liste und nicht als weiterer Eintrag
 * darin: Ein wartendes Konto ist kein Zustand, den man verwaltet, sondern
 * eine offene Frage – und die Antwort ist ein Klick. Zur Wahl steht
 * deshalb nicht die Rolle, sondern der Zugriff; welche Aufgabe jemand in
 * der Bischofschaft hat, lässt sich danach jederzeit umstellen.
 */
function PendingUsers({ users }: { users: AppUser[] }) {
  if (users.length === 0) return null

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
        <UserPlus className="size-4" aria-hidden />
        {users.length} neue {users.length === 1 ? 'Registrierung' : 'Registrierungen'}
      </h3>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
        Diese Konten haben sich angemeldet und sehen noch nichts. Wähle, worauf sie Zugriff
        bekommen.
      </p>

      <ul className="mt-3 space-y-3">
        {users.map((user) => (
          <PendingUserCard key={user.id} user={user} />
        ))}
      </ul>
    </div>
  )
}

function PendingUserCard({ user }: { user: AppUser }) {
  const toast = useToast()
  const [level, setLevel] = useState<AccessLevel>('full')
  const [role, setRole] = useState<Role>('secretary')
  const [busy, setBusy] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)

  const approve = async () => {
    const target =
      level === 'full'
        ? role
        : (ACCESS_LEVELS.find((option) => option.value === level)?.role ?? 'ap_viewer')
    setBusy(true)
    try {
      const outcome = await setUserRole(user.id, target)
      toast.saved(`${user.displayName} freigeschaltet: ${ROLE_LABELS[target]}`, outcome)
    } catch (error) {
      console.error(error)
      toast.error('Freigabe fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="card p-3">
      <div className="flex items-center gap-3">
        <UserAvatar userId={user.id} name={user.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.displayName}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {user.email}
            {user.createdAt && ` · registriert ${formatRelative(user.createdAt)}`}
          </p>
        </div>
      </div>

      <fieldset className="mt-3 space-y-1.5">
        <legend className="sr-only">Zugriff für {user.displayName}</legend>
        {ACCESS_LEVELS.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition',
              level === option.value
                ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
            )}
          >
            <input
              type="radio"
              name={`access-${user.id}`}
              className="mt-0.5 size-4"
              checked={level === option.value}
              onChange={() => setLevel(option.value)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="hint block">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {level === 'full' && (
        <div className="mt-3">
          <label className="label" htmlFor={`role-${user.id}`}>
            Aufgabe in der Bischofschaft
          </label>
          <select
            id={`role-${user.id}`}
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {ASSIGNABLE_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn-ghost text-rose-600 dark:text-rose-400"
          onClick={() => setConfirmReject(true)}
          disabled={busy}
        >
          Ablehnen
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void approve()}
          disabled={busy}
        >
          <Check className="size-4" aria-hidden />
          Freischalten
        </button>
      </div>

      <ConfirmDialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={() => {
          void deleteUserProfile(user.id).then((outcome) =>
            toast.saved('Registrierung abgelehnt.', outcome),
          )
        }}
        title="Registrierung ablehnen?"
        message={
          <>
            Das Profil von {user.displayName} wird gelöscht. Das Anmeldekonto selbst bleibt in
            Firebase Authentication bestehen – meldet sich die Person erneut an, erscheint sie
            wieder als neue Registrierung.
          </>
        }
        confirmLabel="Ablehnen"
        danger
      />
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Bestehende Konten                                                   */
/* ------------------------------------------------------------------ */

/**
 * Wer im Mitgliederverzeichnis zu diesem Konto gehört.
 *
 * Konto und Mitglied sind zwei verschiedene Dinge: Das eine meldet sich an,
 * das andere steht im Verzeichnis der Gemeinde und wird aus dem LCR
 * eingelesen. Meist ist es dieselbe Person – aber die App weiss das nicht,
 * solange es niemand hier festhält. Erst danach lässt sich sagen, dass ein
 * «@Alain» im Traktandum den angemeldeten Alain meint.
 *
 * Gespeichert wird sofort, ohne Speichern-Knopf – wie überall in den
 * Einstellungen.
 */
function MemberLinkField({ user }: { user: AppUser }) {
  const toast = useToast()
  const { users, members, membersById } = useData()

  const linked = user.memberId ? (membersById.get(user.memberId) ?? null) : null

  /*
   * Steht ein Verweis da, zu dem kein Mitglied (mehr) gehört, wird das
   * angeschrieben statt verschwiegen: Ein leeres Suchfeld sähe aus wie «nicht
   * verknüpft», während in der Datenbank etwas anderes steht. Solange das
   * Verzeichnis noch lädt, ist gar nichts zu sagen.
   */
  const orphan = user.memberId && !linked && members.length > 0 ? 'Unbekanntes Mitglied' : ''

  const save = async (memberId: string | null) => {
    /*
     * Ein Mitglied, ein Konto: Denselben Mitgliedersatz zweimal zu vergeben
     * hiesse, dass ein Name auf zwei Konten zeigt – «meine Pendenz» wäre dann
     * die Pendenz von zweien.
     */
    const taken = memberId
      ? users.find((other) => other.id !== user.id && other.memberId === memberId)
      : undefined
    if (taken) {
      toast.error(`Dieses Mitglied ist bereits mit ${taken.displayName} verknüpft.`)
      return
    }

    try {
      const outcome = await updateUserProfile(user.id, { memberId })
      const member = memberId ? membersById.get(memberId) : null
      toast.saved(
        member
          ? `${user.displayName} ist ${member.firstName} ${member.lastName}.`
          : `Verknüpfung von ${user.displayName} aufgehoben.`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Verknüpfung konnte nicht gespeichert werden.')
    }
  }

  return (
    <MemberCombobox
      memberId={user.memberId}
      name={orphan}
      onChange={(next) => void save(next.memberId)}
      label={`Mitglied von ${user.displayName}`}
      placeholder="Mit Mitglied verknüpfen …"
      className="w-full sm:w-60"
    />
  )
}

function UserRow({
  user,
  isSelf,
  canManage,
}: {
  user: AppUser
  isSelf: boolean
  /** Nur das Administrator-Konto verwaltet Rollen, Status und Konten. */
  canManage: boolean
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

  const apOnly = AP_ONLY_ROLES.includes(user.role)

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <UserAvatar userId={user.id} name={user.displayName} size="md" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user.displayName}
          {isSelf && <span className="ml-1.5 text-xs text-slate-400">(du)</span>}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {user.email}
          {apOnly && ' · sieht nur den AP-Kalender'}
        </p>
      </div>

      {/* Eine einzige Auswahl für Aufgabe und Zugriff: Bei Vollzugriff sind
          das dieselbe Frage, und die beiden AP-Zugänge kennen keine Aufgabe.
          Ohne Verwaltungsrecht steht die Rolle nur da – ändern kann sie das
          Administrator-Konto, und die Zugriffsregeln setzen das durch. */}
      {canManage ? (
        <select
          className="input w-auto py-1.5 text-sm"
          value={user.role}
          onChange={(event) => void changeRole(event.target.value as Role)}
          aria-label={`Zugriff von ${user.displayName}`}
        >
          <optgroup label="Vollzugriff">
            {/* Die alte Sammelrolle nur zeigen, solange sie noch gesetzt ist. */}
            {user.role === 'counselor' && (
              <option value="counselor">{ROLE_LABELS.counselor}</option>
            )}
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </optgroup>
          {/* Sich selbst auf den AP-Kalender zu beschränken oder den Zugang ganz
              zu entziehen wäre eine Sackgasse – beides steht nur für andere
              Konten zur Wahl. */}
          {!isSelf && (
            <optgroup label="Nur Aktivitäten AP’s">
              {AP_ONLY_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </optgroup>
          )}
          {!isSelf && (
            <optgroup label="Kein Zugriff">
              <option value="pending">{ROLE_LABELS.pending}</option>
            </optgroup>
          )}
        </select>
      ) : (
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {ROLE_LABELS[user.role]}
          {!user.active && ' · deaktiviert'}
        </span>
      )}

      {/* Ein AP-Zugang erreicht das Mitgliederverzeichnis gar nicht – für ihn
          gäbe es nichts, was die Verknüpfung beantworten könnte. Die eigene
          Verknüpfung darf jede Person selbst setzen; fremde nur der Admin. */}
      {!apOnly && (canManage || isSelf) && <MemberLinkField user={user} />}

      {canManage && !isSelf && (
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
