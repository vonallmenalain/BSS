import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Building2,
  CalendarCog,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DatabaseBackup,
  Download,
  Loader2,
  Mic,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useToast } from '@/contexts/ToastContext'
import { useAutosave, saveStateLabel } from '@/hooks/useAutosave'
import { ApNamesField } from '@/components/ap/ApNamesField'
import { MemberCombobox, PageHeader } from '@/components/ui/Pickers'
import { ConfirmDialog } from '@/components/ui/Modal'
import { UserAvatar } from '@/components/ui/Avatar'
import { WEEKDAYS } from '@/lib/dates'
import { resyncCollectionStores } from '@/lib/collectionStore'
import { backupTotal } from '@/lib/backup'
import { BACKUP_COLLECTIONS, createBackup, downloadBackup } from '@/services/backup'
import { saveSettings } from '@/services/settings'
import {
  deleteUserProfile,
  setUserActive,
  setUserAssistantAreas,
  setUserImpulseAccess,
  setUserRole,
  setUserRoleWithAreas,
  updateUserProfile,
} from '@/services/users'
import { formatRelative } from '@/lib/dates'
import {
  canAssignRole,
  canManageUser,
  impulseAssignable,
  impulseLevelOf,
  roleManagementOf,
  type ImpulseLevel,
  type RoleManagement,
} from '@/lib/access'
import {
  ADMIN_IMPORTS,
  ADMIN_IMPORT_LABEL,
  EVERYDAY_IMPORTS,
  type ImportEntry,
} from '@/lib/imports'
import { cn } from '@/lib/utils'
import {
  ACCESS_LEVELS,
  ADMIN_EMAIL,
  AP_ACCESS_ROLES,
  AP_ONLY_ROLES,
  IMPULSE_ONLY_ROLE,
  AREA_ACCESS_LABELS,
  AREA_ACCESS_ORDER,
  ASSIGNABLE_ROLES,
  ASSISTANT_AREA_LABELS,
  FULL_ACCESS_ROLES,
  ASSISTANT_AREAS,
  assistantAccessOf,
  assistantAccessSummary,
  assistantListsFrom,
  ROLE_LABELS,
  roleRank,
  type AccessLevel,
  type AppSettings,
  type AppUser,
  type AreaAccess,
  type AssistantArea,
  type Role,
} from '@/lib/types'

export function Settings() {
  const { profile, isAdmin, isApproved, role } = useAuth()
  /* Wer hier Rollen vergibt: das Administrator-Konto alles, die
     Bischofschaft die Zugänge ohne Vollzugriff (siehe `roleManagementOf`). */
  const management = roleManagementOf({ isAdmin, isApproved, role })
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
   * Die Liste folgt der Rolle und nicht dem Alphabet: zuerst die
   * Bischofschaft mit Vollzugriff, dann die beiden AP-Zugänge – bearbeiten
   * vor ansehen. So steht beieinander, was dieselben Rechte hat.
   *
   * `users` kommt bereits nach Namen sortiert (siehe `DataContext`), und
   * weil `sort` gleichrangige Einträge in ihrer Reihenfolge belässt, bleibt
   * es innerhalb einer Rolle alphabetisch. Sortiert wird die Kopie aus dem
   * Filter, nicht die Liste des Kontexts.
   */
  const teamUsers = users
    .filter((user) => user.role !== 'pending')
    .sort((a, b) => roleRank(a.role) - roleRank(b.role))

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
          {/* Was wer verwalten darf, steht in einem Satz da – der Rest steht
              aufgeklappt bereit: Wer die Liste öffnet, will meist ein Konto
              ändern und nicht vier Absätze lesen. */}
          <p className="hint mb-2">
            {management === 'all'
              ? 'Als Administrator vergibst und änderst du jeden Zugang.'
              : management === 'limited'
                ? 'Als Bischofschaft änderst du alle Zugänge ohne Vollzugriff – auch den neuer Konten. Vollzugriff, Deaktivieren und Entfernen bleiben dem Administrator-Konto.'
                : 'Zugänge vergeben das Administrator-Konto und – ohne Vollzugriff – Bischof und Ratgeber.'}
          </p>
          <details className="mb-4 rounded-lg border border-slate-200 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <summary className="cursor-pointer px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
              Was die Zugänge bedeuten
            </summary>
            <dl className="space-y-2 border-t border-slate-200 px-3 py-3 dark:border-slate-700">
              <AccessTerm term="Vollzugriff">
                Bischof, Ratgeber und Sekretäre sehen und bearbeiten alles. Die Rolle hält nur die
                Aufgabe fest – etwa wer die Abendmahlsversammlung leitet.
              </AccessTerm>
              <AccessTerm term="Assistenz">
                Sieht allein die gewählten Bereiche der Abendmahlsversammlung – Ansprachen, Musik,
                Gebet –, je Bereich nur lesend oder bearbeitend.
              </AccessTerm>
              <AccessTerm term="AP-Kalender">
                Sieht allein «Aktivitäten AP’s» – bearbeitend oder nur ansehend.
              </AccessTerm>
              <AccessTerm term="Nur Anti Doom">
                Sieht allein den Bereich «Anti Doom» – für die AP’s selbst.
              </AccessTerm>
              <AccessTerm term="Anti Doom zusätzlich">
                Bei Vollzugriff und AP-Kalender zuschaltbar: «Mitmachen» zum Ansehen und Mitmachen,
                «+ Redaktion» dazu zum Pflegen und Moderieren der Inhalte. Das Administrator-Konto
                sieht und pflegt den Bereich immer.
              </AccessTerm>
              <AccessTerm term="Mitglied">
                Wer im Mitgliederverzeichnis zu diesem Konto gehört. Erst diese Verknüpfung sagt der
                App, dass Anmeldung und Eintrag der Gemeinde dieselbe Person sind.
              </AccessTerm>
              <AccessTerm term="Im AP-Plan als">
                Die Namen, unter denen jemand im Aktivitätenplan steht – etwa «Carden» oder «JM».
                Damit lässt sich die Erinnerung auf die eigenen Termine beschränken.
              </AccessTerm>
              <AccessTerm term="Neues Konto">
                Sieht ohne Freigabe den AP-Kalender (nur lesen) und Anti Doom. Auf der Übersicht
                steht es als Hinweis, bis ihn jemand aus der Bischofschaft wegklickt; mehr Zugriff
                gibt es hier.
              </AccessTerm>
              <AccessTerm term="Wartet auf Freigabe">
                Sieht nichts – so legen ältere Fassungen der App ein neues Konto an.
              </AccessTerm>
            </dl>
          </details>

          {management !== 'none' ? (
            <PendingUsers users={pendingUsers} management={management} />
          ) : (
            pendingUsers.length > 0 && (
              <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {pendingUsers.length === 1
                  ? 'Eine neue Registrierung wartet auf Freigabe'
                  : `${pendingUsers.length} neue Registrierungen warten auf Freigabe`}{' '}
                ({pendingUsers.map((user) => user.displayName || user.email).join(', ')}) –
                freischalten können sie das Administrator-Konto sowie Bischof und Ratgeber.
              </p>
            )
          )}

          {/* Nach Zugang gegliedert: Die Frage, mit der man die Liste
              aufschlägt, ist «wer sieht was?» – die Überschriften
              beantworten sie, bevor man eine Zeile liest. */}
          <div className="space-y-5">
            {ACCESS_GROUPS.map((group) => {
              const members = teamUsers.filter((user) => accessGroupOf(user.role) === group.key)
              if (members.length === 0) return null
              return (
                <div key={group.key}>
                  <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {group.title}{' '}
                    <span className="tabular font-normal text-slate-400">{members.length}</span>
                  </h3>
                  <ul className="divide-list">
                    {members.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isSelf={user.id === profile?.id}
                        management={management}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
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

        {/* Zuunterst und allein für den Administrator: Das Protokoll gehört
            zum Verwalten der App und nicht zur Arbeit damit. */}
        {isAdmin && <AccessLogSection />}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Zugriffsprotokoll                                                   */
/* ------------------------------------------------------------------ */

/**
 * Der Einstieg zum Protokoll – nur im Administrator-Konto.
 *
 * Als eigener Abschnitt und nicht als Zeile in der Benutzerverwaltung
 * darüber: Dort wird Zugriff **vergeben**, hier steht, was daraus geworden
 * ist. Beides gehört zusammen, aber nicht ineinander – und die Liste der
 * Konten wäre der falsche Ort für eine Seite, die es einmal im Quartal zu
 * öffnen lohnt.
 *
 * Die Sperre ist das nicht: Die Seite selbst prüft es noch einmal (siehe
 * `App`), und die Zugriffsregeln geben einem anderen Konto ohnehin keine
 * einzige Zeile heraus.
 */
function AccessLogSection() {
  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <ClipboardList className="size-4 text-slate-400" aria-hidden />
        Zugriffe
      </h2>
      <p className="hint mb-4">
        Wer war wann in der App, von wo aus – und wer hat was geändert. Sichtbar allein in diesem
        Konto.
      </p>
      <Link to="/zugriffe" className="btn-secondary">
        <ClipboardList className="size-4" aria-hidden />
        Protokoll öffnen
      </Link>
    </section>
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
 * danach höchstens zweimal im Jahr. Die ganze Liste dafür dauerhaft offen
 * zu lassen, macht die Einstellungen länger, als sie sein müssen.
 *
 * Die Admin-Importe stehen in einem eigenen Block darunter und erscheinen
 * allein im Administrator-Konto (siehe `lib/imports`): Sie haben den
 * Bestand beim Einrichten einmal gefüllt und werden seither nicht mehr
 * gebraucht.
 */
function ImportSection() {
  const { isAdmin } = useAuth()
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
        <>
          <ul className="divide-list mt-2">
            {EVERYDAY_IMPORTS.map((entry) => (
              <ImportLink key={entry.to} entry={entry} />
            ))}
          </ul>

          {isAdmin && (
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-slate-400" aria-hidden />
                {ADMIN_IMPORT_LABEL}
              </h3>
              <p className="hint mt-1">
                Einmalig beim Einrichten der App gebraucht und seither nicht mehr. Sie stehen allein
                im Administrator-Konto – im Alltag der Bischofschaft wären es Handgriffe, die
                niemand mehr tut.
              </p>
              <ul className="divide-list mt-2">
                {ADMIN_IMPORTS.map((entry) => (
                  <ImportLink key={entry.to} entry={entry} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ImportLink({ entry }: { entry: ImportEntry }) {
  return (
    <li>
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
/* Assistenz: welche Bereiche                                          */
/* ------------------------------------------------------------------ */

/**
 * Die drei Bereiche mit ihrem Zugriff – beim Freischalten und in der
 * Kontozeile.
 *
 * Ein und dieselbe Reihe an beiden Orten: Was beim Freischalten gewählt
 * wird, lässt sich später an derselben Stelle wieder umstellen, und die
 * Reihenfolge bleibt dieselbe (siehe `ASSISTANT_AREAS`).
 *
 * Je Bereich eine Auswahl aus dreien statt eines Hakens: «Musik bearbeiten,
 * Ansprachen nur lesen» ist der Fall, für den es diese Rolle gibt – wer die
 * Lieder aussucht, muss sehen, worüber gesprochen wird, ohne daran zu
 * rühren. Mit zwei Haken je Bereich stünden hier sechs Kästchen, von denen
 * zwei einander widersprechen könnten.
 */
function AssistantAreaAccess({
  name,
  access,
  onChange,
}: {
  /** Hält die Felder zweier Konten auseinander. */
  name: string
  access: Record<AssistantArea, AreaAccess>
  onChange: (next: Record<AssistantArea, AreaAccess>) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
      {ASSISTANT_AREAS.map((area) => (
        <label key={area} className="flex items-center gap-1.5 text-sm">
          {/* Auf dem Telefon untereinander und bündig, daneben in einer Zeile. */}
          <span className="w-24 shrink-0 text-slate-600 sm:w-auto dark:text-slate-300">
            {ASSISTANT_AREA_LABELS[area]}
          </span>
          <select
            className="input min-w-0 flex-1 py-1 text-sm sm:w-auto sm:flex-none"
            name={`${name}-${area}`}
            value={access[area]}
            onChange={(event) => onChange({ ...access, [area]: event.target.value as AreaAccess })}
            aria-label={`Zugriff auf ${ASSISTANT_AREA_LABELS[area]}`}
          >
            {AREA_ACCESS_ORDER.map((value) => (
              <option key={value} value={value}>
                {AREA_ACCESS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
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
function PendingUsers({
  users,
  management,
}: {
  users: AppUser[]
  /** Die Bischofschaft (`limited`) vergibt alles ausser dem Vollzugriff. */
  management: RoleManagement
}) {
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
          <PendingUserCard key={user.id} user={user} management={management} />
        ))}
      </ul>
    </div>
  )
}

function PendingUserCard({ user, management }: { user: AppUser; management: RoleManagement }) {
  const toast = useToast()
  const admin = management === 'all'
  /* Das Administrator-Konto beginnt beim Vollzugriff, wie bisher. Die
     Bischofschaft kann ihn nicht vergeben – sie beginnt ohne Vorauswahl und
     entscheidet bewusst, statt einen Zugang zu bestätigen, den jemand
     anderes vorgeschlagen hat. */
  const [level, setLevel] = useState<AccessLevel | null>(admin ? 'full' : null)
  const [role, setRole] = useState<Role>('secretary')
  /* Zu Beginn steht jeder Bereich offen, und zwar zum Bearbeiten: Wer eine
     Assistenz freischaltet, meint meistens die ganze Vorbereitung – und
     wegnehmen ist leichter, als drei Felder zu suchen. */
  const [access, setAccess] = useState<Record<AssistantArea, AreaAccess>>({
    talks: 'write',
    music: 'write',
    prayers: 'write',
  })
  const [busy, setBusy] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)

  const lists = assistantListsFrom(access)

  const approve = async () => {
    if (!level) return
    const target =
      level === 'full'
        ? role
        : (ACCESS_LEVELS.find((option) => option.value === level)?.role ?? 'ap_viewer')
    if (!canAssignRole(management, target)) return
    setBusy(true)
    try {
      /* Bei der Assistenz gehören Rolle, Bereiche und Schreibrechte zusammen –
         ohne einen einzigen Bereich sähe sie die App und in ihr nichts. */
      const outcome =
        target === 'assistant'
          ? await setUserRoleWithAreas(user.id, target, lists.areas, lists.write)
          : await setUserRole(user.id, target)
      toast.saved(
        target === 'assistant'
          ? `${user.displayName} freigeschaltet: Assistenz für ${assistantAccessSummary(access)}`
          : `${user.displayName} freigeschaltet: ${ROLE_LABELS[target]}`,
        outcome,
      )
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
        {ACCESS_LEVELS.map((option) => {
          /* Den Vollzugriff vergibt allein das Administrator-Konto – die
             Bischofschaft sieht ihn ausgegraut, damit klar ist, dass es ihn
             gibt und wer ihn vergibt. */
          const allowed = canAssignRole(management, option.role)
          return (
            <label
              key={option.value}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border p-2.5 transition',
                !allowed
                  ? 'cursor-not-allowed border-slate-200 opacity-50 dark:border-slate-700'
                  : level === option.value
                    ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950 cursor-pointer'
                    : 'cursor-pointer border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
              )}
            >
              <input
                type="radio"
                name={`access-${user.id}`}
                className="mt-0.5 size-4"
                checked={level === option.value}
                disabled={!allowed}
                onChange={() => setLevel(option.value)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="hint block">
                  {allowed ? option.hint : 'Vergibt nur das Administrator-Konto.'}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {level === 'assistant' && (
        <div className="mt-3">
          <span className="label">Welche Bereiche – und wie viel darin?</span>
          <AssistantAreaAccess name={`bereiche-${user.id}`} access={access} onChange={setAccess} />
          <p className="hint">
            «Nur lesen» zeigt den Bereich vollständig, aber ohne Knöpfe zum Ändern. Ohne einen
            einzigen Bereich kommt das Konto nicht in die App – der Zugang ist dann entzogen, ohne
            dass sich die Rolle ändert.
          </p>
        </div>
      )}

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
        {/* Ablehnen löscht das Profil – das bleibt wie das Entfernen eines
            Kontos dem Administrator-Konto vorbehalten. */}
        {admin && (
          <button
            type="button"
            className="btn-ghost text-rose-600 dark:text-rose-400"
            onClick={() => setConfirmReject(true)}
            disabled={busy}
          >
            Ablehnen
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() => void approve()}
          disabled={busy || !level || (level === 'assistant' && lists.areas.length === 0)}
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
            Firebase Authentication bestehen – meldet sich die Person erneut an, bekommt sie den
            Standardzugang eines neuen Kontos (AP-Kalender lesen und Anti Doom).
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
      placeholder="Mitglied suchen …"
      className="w-full"
    />
  )
}

/**
 * Die Gruppen der Benutzerliste – nach dem, was ein Konto sieht.
 *
 * Eine Rolle, die diese Fassung nicht kennt, kommt unter «Weitere»: Sie
 * stammt meist aus einer neueren Fassung und soll nicht verschwinden.
 */
type AccessGroup = 'full' | 'assistant' | 'ap' | 'impulse' | 'other'

const ACCESS_GROUPS: { key: AccessGroup; title: string }[] = [
  { key: 'full', title: 'Vollzugriff' },
  { key: 'assistant', title: 'Assistenz · Abendmahlsversammlung' },
  { key: 'ap', title: 'Nur AP-Kalender' },
  { key: 'impulse', title: 'Nur Anti Doom' },
  { key: 'other', title: 'Weitere' },
]

function accessGroupOf(role: Role): AccessGroup {
  if (FULL_ACCESS_ROLES.includes(role)) return 'full'
  if (role === 'assistant') return 'assistant'
  if (AP_ONLY_ROLES.includes(role)) return 'ap'
  if (role === IMPULSE_ONLY_ROLE) return 'impulse'
  return 'other'
}

/** Ein Begriff im Kasten «Was die Zugänge bedeuten». */
function AccessTerm({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-slate-700 dark:text-slate-200">{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * Der Name eines Kontos in der Kopfzeile – für das Administrator-Konto mit
 * einem Stift daneben, der ihn zum Bearbeiten öffnet.
 *
 * Den Namen tippt bei der Registrierung jede Person selbst ein, und nicht
 * immer so, wie er in der App stehen soll – «Lauener Ammo» statt «Ammon
 * Lauener». Bisher liess er sich nur von der Person selbst ändern (unter
 * «Profil»). Gespeichert wird wie bei den Namen im AP-Plan beim Verlassen
 * des Felds oder mit Enter; Escape bricht ab, ein leeres Feld lässt den
 * bisherigen Namen stehen. Das Kürzel für den Avatar zieht
 * `updateUserProfile` mit.
 *
 * Wo der Name anderswo festgehalten ist – etwa der Vorname in «Anti Doom» –,
 * schreibt ihn die Person mit ihrem nächsten Schritt dort neu.
 */
function UserName({ user, editable }: { user: AppUser; editable: boolean }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(user.displayName)
  /* Escape soll nicht über das Verlassen des Felds doch noch speichern. */
  const cancelled = useRef(false)

  const start = () => {
    cancelled.current = false
    setDraft(user.displayName)
    setEditing(true)
  }

  const save = async () => {
    setEditing(false)
    if (cancelled.current) return
    const next = draft.trim().replace(/\s+/g, ' ')
    if (!next || next === user.displayName) return
    try {
      const outcome = await updateUserProfile(user.id, { displayName: next })
      toast.saved(`${user.displayName} heisst jetzt ${next}.`, outcome)
    } catch (error) {
      console.error(error)
      toast.error('Der Name konnte nicht gespeichert werden.')
    }
  }

  if (editing) {
    return (
      <input
        className="input w-full max-w-xs py-1 text-sm font-medium"
        value={draft}
        autoFocus
        autoComplete="off"
        aria-label={`Name von ${user.displayName}`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            cancelled.current = true
            event.currentTarget.blur()
          } else if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
    )
  }

  return (
    <>
      {user.displayName}
      {editable && (
        <button
          type="button"
          className="btn-ghost rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          onClick={start}
          aria-label={`Name von ${user.displayName} ändern`}
          title="Name ändern"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      )}
    </>
  )
}

/** Ein beschriftetes Feld unter einem Konto – die Beschriftung über dem Feld. */
function UserField({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </div>
  )
}

function UserRow({
  user,
  isSelf,
  management,
}: {
  user: AppUser
  isSelf: boolean
  /**
   * Wer hier verwaltet: das Administrator-Konto alles, die Bischofschaft
   * nur Konten ohne Vollzugriff – und davon nur Rolle, Bereiche und
   * «Anti Doom» (siehe `canManageUser`).
   */
  management: RoleManagement
}) {
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const admin = management === 'all'
  /* Rolle, Bereiche der Assistenz und «Anti Doom» dieses Kontos. */
  const canManage = canManageUser(management, user, isSelf)

  const changeRole = async (role: Role) => {
    try {
      const outcome = await setUserRole(user.id, role)
      toast.saved(`${user.displayName}: ${ROLE_LABELS[role]}`, outcome)
    } catch (error) {
      console.error(error)
      toast.error('Rolle konnte nicht geändert werden.')
    }
  }

  const changeAccess = async (next: Record<AssistantArea, AreaAccess>) => {
    const lists = assistantListsFrom(next)
    try {
      const outcome = await setUserAssistantAreas(user.id, lists.areas, lists.write)
      toast.saved(
        lists.areas.length === 0
          ? `${user.displayName} sieht keinen Bereich mehr – der Zugang ist entzogen.`
          : `${user.displayName}: ${assistantAccessSummary(next)}`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Die Bereiche konnten nicht geändert werden.')
    }
  }

  const changeImpulse = async (level: ImpulseLevel) => {
    try {
      const outcome = await setUserImpulseAccess(user.id, level)
      toast.saved(
        level === 'edit'
          ? `${user.displayName} sieht «Anti Doom» und gehört zur Redaktion.`
          : level === 'view'
            ? `${user.displayName} sieht «Anti Doom» – ohne Redaktion.`
            : `${user.displayName} sieht «Anti Doom» nicht mehr.`,
        outcome,
      )
    } catch (error) {
      console.error(error)
      toast.error('Der Anti-Doom-Zugang konnte nicht geändert werden.')
    }
  }

  const apOnly = AP_ONLY_ROLES.includes(user.role)
  const impulseOnly = user.role === IMPULSE_ONLY_ROLE
  /* Was das Konto in «Anti Doom» darf – nur bei Rollen, bei denen die
     Zugriffsregeln den Bereich überhaupt kennen. */
  const impulseLevel: ImpulseLevel = impulseAssignable(user.role) ? impulseLevelOf(user) : 'none'
  const isAssistant = user.role === 'assistant'
  /* Ein deaktiviertes Konto behält seine Bereiche in der Anzeige: Wer es
     wieder aktiviert, soll dieselbe Einteilung vorfinden. */
  const access = assistantAccessOf({ ...user, active: true })
  const summary = assistantAccessSummary(access)
  /*
   * Das Administrator-Konto sieht und pflegt «Anti Doom» immer – eine
   * Auswahl, die nichts bewirkt, würde nur in die Irre führen. Sie fehlt
   * deshalb an dieser Zeile.
   */
  const isAdminAccount = user.email.toLowerCase() === ADMIN_EMAIL

  /* Was dieses Konto sieht, in Worten – für alle, die es nicht ändern
     können. Wer es ändern kann, liest dasselbe an den Feldern ab. */
  const readOnlySummary = [
    ROLE_LABELS[user.role] ?? user.role,
    isAssistant && (summary === '' ? 'kein Bereich freigeschaltet' : summary),
    impulseOnly && impulseLevel === 'edit' && '+ Redaktion',
    !impulseOnly && impulseLevel === 'view' && 'mit Anti Doom',
    !impulseOnly && impulseLevel === 'edit' && !isAdminAccount && 'mit Anti Doom + Redaktion',
  ]
    .filter(Boolean)
    .join(' · ')

  const showImpulse = canManage && !isAdminAccount && impulseAssignable(user.role)
  const showMember = !apOnly && !impulseOnly && (admin || isSelf)
  const showApNames = AP_ACCESS_ROLES.includes(user.role) && (admin || isSelf)
  const hasFields = canManage || showMember || showApNames

  return (
    <li className="py-4">
      {/* Kopf: Name und E-Mail ganz – nichts wird abgeschnitten, lieber
          bricht die Zeile um. Die Handgriffe am Konto stehen rechts daneben. */}
      <div className="flex items-start gap-3">
        <UserAvatar userId={user.id} name={user.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium break-words">
            {/* Den Namen ändert das Administrator-Konto (siehe `UserName`). */}
            <UserName user={user} editable={admin} />
            {isSelf && <span className="text-xs font-normal text-slate-400">(du)</span>}
            {isAdminAccount && (
              <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Administrator
              </span>
            )}
            {!user.active && (
              <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                deaktiviert
              </span>
            )}
            {/* Bis der Hinweis auf der Übersicht weggeklickt ist. */}
            {user.newAccount === true && (
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200">
                neu
              </span>
            )}
          </p>
          <p className="text-xs break-all text-slate-500 dark:text-slate-400">{user.email}</p>
          {!canManage && (
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{readOnlySummary}</p>
          )}
        </div>

        {/* Deaktivieren und Entfernen bleiben dem Administrator-Konto – auch
            bei Konten, deren Rolle die Bischofschaft ändern darf. */}
        {admin && !isSelf && (
          <div className="flex shrink-0 items-center gap-1">
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
          </div>
        )}
      </div>

      {/* Die Felder in einem Raster unter dem Namen, jedes mit seiner
          Beschriftung: Auf dem Telefon stehen sie untereinander und in voller
          Breite, am Bildschirm nebeneinander. */}
      {hasFields && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:ps-11 lg:grid-cols-[minmax(0,15rem)_minmax(0,13.5rem)_minmax(0,1fr)_minmax(0,1fr)]">
          {/* Eine einzige Auswahl für Aufgabe und Zugriff: Bei Vollzugriff
              sind das dieselbe Frage, und die übrigen Zugänge kennen keine
              Aufgabe. Ohne Verwaltungsrecht steht der Zugang nur oben in
              Worten – die Zugriffsregeln setzen das durch. */}
          {canManage && (
            <UserField label="Zugang">
              <select
                className="input w-full py-1.5 text-sm"
                value={user.role}
                onChange={(event) => void changeRole(event.target.value as Role)}
                aria-label={`Zugang von ${user.displayName}`}
              >
                {/* Die Bischofschaft sieht den Vollzugriff ausgegraut: Es gibt
                    ihn, aber vergeben kann ihn nur das Administrator-Konto. */}
                <optgroup label={admin ? 'Vollzugriff' : 'Vollzugriff · nur Administrator'}>
                  {/* Die alte Sammelrolle nur zeigen, solange sie noch gesetzt ist. */}
                  {user.role === 'counselor' && (
                    <option value="counselor">{ROLE_LABELS.counselor}</option>
                  )}
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role} disabled={!canAssignRole(management, role)}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </optgroup>
                {/* Sich selbst auf einen Ausschnitt zu beschränken oder den
                    Zugang ganz zu entziehen wäre eine Sackgasse – beides steht
                    nur für andere Konten zur Wahl. */}
                {!isSelf && (
                  <optgroup label="Nur Abendmahlsversammlung">
                    <option value="assistant">{ROLE_LABELS.assistant}</option>
                  </optgroup>
                )}
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
                  <optgroup label="Nur Anti Doom">
                    <option value={IMPULSE_ONLY_ROLE}>{ROLE_LABELS[IMPULSE_ONLY_ROLE]}</option>
                  </optgroup>
                )}
                {!isSelf && (
                  <optgroup label="Kein Zugriff">
                    <option value="pending">{ROLE_LABELS.pending}</option>
                  </optgroup>
                )}
              </select>
            </UserField>
          )}

          {/* Welche Bereiche eine Assistenz sieht – und in welchen sie auch
              arbeitet –, steht am Konto und nicht an der Rolle. */}
          {canManage && isAssistant && (
            <UserField label="Bereiche" className="sm:col-span-2 lg:col-span-3">
              <AssistantAreaAccess
                name={`bereiche-${user.id}`}
                access={access}
                onChange={(next) => void changeAccess(next)}
              />
              {summary === '' && (
                <p className="hint">
                  Ohne Bereich sieht das Konto nichts – der Zugang ist entzogen.
                </p>
              )}
            </UserField>
          )}

          {/* «Anti Doom» hängt am Konto und nicht an der Rolle. Das Feld
              stellt immer dieselbe Frage – was darf dieses Konto dort? –, mit
              denselben Worten: «Mitmachen» oder «+ Redaktion». Bei «Nur Anti
              Doom» gehört der Bereich zur Rolle; dort fehlt deshalb «Nein».
              Bei der Assistenz und bei wartenden Konten fehlt das Feld: Die
              Zugriffsregeln kennen den Bereich für sie nicht. */}
          {showImpulse && (
            <UserField label={impulseOnly ? 'Anti Doom' : 'Anti Doom zusätzlich'}>
              <select
                className="input w-full py-1.5 text-sm"
                value={impulseLevel}
                onChange={(event) => void changeImpulse(event.target.value as ImpulseLevel)}
                aria-label={`Anti Doom von ${user.displayName}`}
              >
                {!impulseOnly && <option value="none">Nein</option>}
                <option value="view">Mitmachen</option>
                <option value="edit">Mitmachen + Redaktion</option>
              </select>
            </UserField>
          )}

          {/* Ein AP-Zugang erreicht das Mitgliederverzeichnis gar nicht – für
              ihn gäbe es nichts, was die Verknüpfung beantworten könnte. Die
              eigene Verknüpfung darf jede Person selbst setzen; fremde nur
              das Administrator-Konto. */}
          {showMember && (
            <UserField label="Mitglied">
              <MemberLinkField user={user} />
            </UserField>
          )}

          {/* Wie die Person im Aktivitätenplan heisst – für die Erinnerung
              «nur wo ich eingetragen bin» (siehe `lib/apInvolvement`). */}
          {showApNames && (
            <UserField label="Im AP-Plan als">
              <ApNamesField
                user={user}
                label={`Namen von ${user.displayName} im Aktivitätenplan`}
                placeholder="z. B. Carden, JM"
                className="w-full"
              />
            </UserField>
          )}
        </div>
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
            Bedarf ganz löschen. Meldet sich die Person vorher erneut an, bekommt sie den
            Standardzugang eines neuen Kontos; wer gar nichts mehr sehen soll, wird besser
            deaktiviert.
          </>
        }
        confirmLabel="Entfernen"
        danger
      />
    </li>
  )
}
