import { useEffect, useState } from 'react'
import {
  Apple,
  Ban,
  Calendar,
  Check,
  Copy,
  Globe,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCalendarFeeds } from '@/hooks/useFirestore'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Feedback'
import { formatRelative } from '@/lib/dates'
import {
  apFeedUrl,
  apFeedWebcalUrl,
  createCalendarFeed,
  deleteCalendarFeed,
  updateCalendarFeed,
} from '@/services/calendarFeeds'
import {
  AP_ACTIVITY_KIND_LABELS,
  AP_FEED_KINDS,
  type ApActivityKind,
  type CalendarFeed,
} from '@/lib/types'

/**
 * Den Aktivitätenplan als Kalender abonnieren.
 *
 * Ein Abo ist etwas anderes als ein Export, und der Unterschied ist der
 * Grund, weshalb es diesen Dialog gibt: Google und Apple holen sich die
 * Termine unter dem Link immer wieder selbst. Wer hier etwas ändert, ändert
 * es damit auch im Kalender jeder Person, die den Link eingerichtet hat –
 * ohne dass jemand etwas exportiert, verschickt oder einliest.
 *
 * **Zuoberst steht der Link für alle** – `/api/ap.ics`, ohne Token. Seit der
 * Plan unter `/ap` jedem offensteht, ist er die Antwort auf die Frage, mit
 * der man diesen Dialog überhaupt öffnet: «Wie bekomme ich das in meinen
 * Kalender?» Ein Token schützte hier nichts mehr; es machte den Link bloss
 * lang und seine Weitergabe zu einem Vorgang.
 *
 * Die **vergebenen Links** stehen darunter und bleiben – nicht als Schutz,
 * sondern für das, was sie zusätzlich können: nur bestimmte Arten zeigen,
 * und festhalten, wann ein Kalenderprogramm zuletzt vorbeikam. Jeder lässt
 * sich einzeln widerrufen, ohne allen anderen den Kalender wegzunehmen.
 *
 * Der Dialog hat deshalb drei Gesichter. **Ohne Konto** bleiben der
 * öffentliche Link und die Anleitung – mehr braucht es nicht, und die Liste
 * der vergebenen Links geben die Zugriffsregeln ohnehin nicht heraus.
 * **Mit Konto, ohne Schreibrecht** kommen die gültigen Links dazu, zum
 * Kopieren; widerrufene fehlen dort ganz: Sie erzählen der Verwaltung etwas,
 * dem Kopierenden bieten sie nur die Gelegenheit, den falschen zu erwischen.
 * **Mit Schreibrecht** wird daraus eine Verwaltung: anlegen, widerrufen,
 * löschen, und zu jedem Link, wann er zuletzt abgerufen wurde.
 *
 * Wann ein Kalenderprogramm den Link holt, bestimmt es selbst – Google meist
 * alle paar Stunden. Der Dialog sagt das nicht mehr dazu: Es steht nur der
 * Wortlaut hier und im README, damit die Frage beantwortet ist, wenn sie
 * einmal aufkommt. Wer den Link einrichtet, will ihn einrichten und nicht
 * erst einen Abschnitt lesen; und «zuletzt abgerufen» in der Liste
 * beantwortet dieselbe Frage später ohnehin genauer.
 */
export function ApFeedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, canEditAp, canViewAp } = useAuth()
  const toast = useToast()
  /* Ohne Konto bleibt der Hook still: Er hängt selbst an `canViewAp` und
     fragt die Sammlung gar nicht erst ab (siehe `hooks/useFirestore`). */
  const { data: all, loading } = useCalendarFeeds()

  /*
   * Wer nur zusieht, sieht nur die Links, die auch funktionieren.
   *
   * Ein widerrufener Link steht in der Verwaltung bewusst weiter da – er
   * erzählt, dass es ihn gab. Wer bloss einen Kalender einrichten will, hätte
   * davon nichts als die Gelegenheit, den falschen zu kopieren.
   */
  const feeds = canEditAp ? all : all.filter((feed) => feed.active)

  const [label, setLabel] = useState('')
  const [kinds, setKinds] = useState<ApActivityKind[]>([])
  const [busy, setBusy] = useState(false)
  /* Der eben angelegte Link – er steht hervorgehoben da, bis der Dialog
     schliesst. Genau ihn sucht man in dem Moment. */
  const [fresh, setFresh] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLabel('')
      setKinds([])
      setFresh(null)
    }
  }, [open])

  const toggle = (kind: ApActivityKind) =>
    setKinds((current) =>
      current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind],
    )

  const create = async () => {
    setBusy(true)
    try {
      /*
       * Alles gewählt heisst «keine Einschränkung» und wird als leere Liste
       * gespeichert – nicht als Aufzählung aller vier Arten. So bleibt ein
       * Abo vollständig, auch wenn der Plan später eine Art dazubekommt.
       */
      const all = kinds.length === 0 || kinds.length === AP_FEED_KINDS.length
      const { token } = await createCalendarFeed(
        { label, kinds: all ? [] : kinds },
        profile?.id ?? null,
      )
      setFresh(token)
      setLabel('')
      setKinds([])
      toast.success('Der Link ist bereit – jetzt kopieren und weitergeben.')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Der Link konnte nicht angelegt werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Kalender abonnieren"
      description={
        canEditAp
          ? 'Den Aktivitätenplan in Google Calendar, Apple Kalender oder Outlook einbinden'
          : 'Den Link kopieren und im eigenen Kalender einrichten'
      }
      size="lg"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Schliessen
        </button>
      }
    >
      <div className="space-y-6">
        {fresh && <FreshLink token={fresh} />}

        {/* ---------- Der Link für alle ---------- */}
        <PublicLink />

        {/* ---------- Neuen Link anlegen ---------- */}
        {canEditAp && (
          <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="text-sm font-semibold">Neuen Link anlegen</h3>

            <div>
              <label className="label" htmlFor="feed-label">
                Wer bekommt den Link?
              </label>
              <input
                id="feed-label"
                className="input"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Berater, Jugendführung, Bruder Müller …"
                maxLength={80}
              />
              <p className="hint">
                Besser nach der Person oder der Gruppe benennen als nach dem Inhalt: Nur so lässt
                sich später einer widerrufen, ohne allen anderen den Kalender wegzunehmen.
              </p>
            </div>

            <fieldset>
              <legend className="label">Was im Kalender erscheint</legend>
              <div className="flex flex-wrap gap-2">
                {AP_FEED_KINDS.map((kind) => {
                  const active = kinds.length === 0 || kinds.includes(kind)
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => toggle(kind)}
                      aria-pressed={active}
                      className={
                        active
                          ? 'chip border border-brand-600 bg-brand-600 text-white'
                          : 'chip border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                      }
                    >
                      {active && <Check className="size-3.5" aria-hidden />}
                      {AP_ACTIVITY_KIND_LABELS[kind]}
                    </button>
                  )
                })}
              </div>
              <p className="hint">
                Ohne Auswahl steht alles im Kalender. «Fällt aus» erklärt im Plan eine Lücke – im
                eigenen Terminkalender will man sie vielleicht nicht sehen.
              </p>
            </fieldset>

            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => void create()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Link anlegen
            </button>
          </section>
        )}

        {/* ---------- Bestehende Links ----------
            Nur mit Konto: Ohne Anmeldung geben die Zugriffsregeln die Liste
            nicht heraus – und wer bloss abonnieren will, hat oben bereits,
            was er braucht. Eine leere Überschrift wäre dort ein Versprechen
            ohne Inhalt. */}
        {canViewAp && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">
              {canEditAp ? 'Vergebene Links' : 'Verfügbare Links'}
            </h3>

            {loading && feeds.length === 0 ? (
              <p className="hint">Wird geladen …</p>
            ) : feeds.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={Link2}
                  title="Noch kein eigener Link vergeben"
                  description={
                    canEditAp
                      ? 'Für den ganzen Plan genügt der Link oben. Ein eigener lohnt sich, wenn er nur bestimmte Arten zeigen soll oder widerrufbar sein muss.'
                      : 'Für den ganzen Plan genügt der Link oben. Eigene Links vergibt die Bischofschaft – sie stünden hier.'
                  }
                />
              </div>
            ) : (
              <ul className="space-y-3">
                {feeds.map((feed) => (
                  <FeedRow key={feed.id} feed={feed} canManage={canEditAp} />
                ))}
              </ul>
            )}
          </section>
        )}

        <Instructions />
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/**
 * Der Link für alle – ohne Token, ohne Anmeldung.
 *
 * Er steht zuoberst und in jedem der drei Gesichter des Dialogs, denn er ist
 * die Antwort auf die Frage, mit der man ihn öffnet. Dass er kein Geheimnis
 * trägt, ist keine Nachlässigkeit, sondern der Stand der Dinge: Der Plan
 * selbst steht unter `/ap` jedem offen, ein Token schützte hier also nichts
 * mehr – es machte den Link bloss lang und seine Weitergabe zu einem Vorgang.
 *
 * «Link», und darunter nichts. Ein Feld mit einer Adresse und zwei Knöpfen
 * zum Kopieren erklärt sich; was damit zu tun ist, steht als Anleitung weiter
 * unten im selben Dialog. Ein Absatz dazwischen sagte dasselbe ein zweites
 * Mal – und stünde ausgerechnet zwischen dem Link und dem Weg zu seiner
 * Einrichtung.
 */
function PublicLink() {
  return (
    <section className="border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30 space-y-2 rounded-xl border p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Globe className="size-4" aria-hidden />
        Link
      </h3>
      <LinkRow token={null} />
    </section>
  )
}

/** Der eben angelegte Link – gross, weil man genau ihn gerade sucht. */
function FreshLink({ token }: { token: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        Der Link ist bereit
      </p>
      <LinkRow token={token} />
      <p className="text-xs text-emerald-800 dark:text-emerald-200">
        Er lässt sich hier jederzeit wieder kopieren – merken musst du ihn dir nicht.
      </p>
    </div>
  )
}

/**
 * Die Adresse mit den beiden Knöpfen zum Kopieren.
 *
 * Zwei Schreibweisen derselben Adresse, und beide werden gebraucht: «https»
 * ist die, die man in Google Calendar einfügt. «webcal» öffnet am Mac und am
 * iPhone unmittelbar den Kalender – mit «https» lüde der Browser dort
 * stattdessen eine Datei herunter, und die wäre eine einmalige Kopie statt
 * eines Abos.
 */
function LinkRow({ token }: { token: string | null }) {
  const toast = useToast()
  const url = apFeedUrl(token)

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${what} kopiert.`)
    } catch {
      // Ohne HTTPS und in manchen eingebetteten Browsern gibt es keine
      // Zwischenablage. Dann bleibt der Text im Feld – markieren geht immer.
      toast.info('Kopieren nicht möglich – bitte den Text im Feld von Hand markieren.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="input min-w-0 flex-1 font-mono text-xs" readOnly value={url} />
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => void copy(url, 'Link')}
        title="Für Google Calendar und Outlook"
      >
        <Copy className="size-3.5" aria-hidden />
        Kopieren
      </button>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => void copy(apFeedWebcalUrl(token), 'webcal-Link')}
        title="Öffnet am Mac und am iPhone direkt den Kalender"
      >
        <Apple className="size-3.5" aria-hidden />
        webcal
      </button>
    </div>
  )
}

/**
 * Ein Link in der Liste.
 *
 * `canManage` entscheidet, ob daneben die Knöpfe zum Widerrufen und Löschen
 * stehen. Ohne sie bleibt die Zeile, was ein Nur-Ansicht-Konto braucht: die
 * Beschriftung, was der Link zeigt, und die Adresse zum Kopieren.
 */
function FeedRow({ feed, canManage }: { feed: CalendarFeed; canManage: boolean }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(message)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!window.confirm(`«${feed.label}» endgültig löschen? Der Link hört sofort auf zu wirken.`)) {
      return
    }
    void run(() => deleteCalendarFeed(feed.id), 'Link gelöscht.')
  }

  const kinds = feed.kinds ?? []

  return (
    <li className="card space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {feed.label}
            {!feed.active && (
              <span className="badge ml-2 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                widerrufen
              </span>
            )}
          </p>
          <p className="hint">
            {kinds.length > 0
              ? `Nur ${kinds.map((kind) => AP_ACTIVITY_KIND_LABELS[kind]).join(', ')}`
              : 'Der ganze Plan'}
            {/*
             * Der letzte Abruf ist die einzige verlässliche Antwort auf
             * «warum sehe ich den Kalender nicht?»: Steht hier nichts, hat
             * das Kalenderprogramm den Link nie geholt – dann liegt es am
             * Abo und nicht an den Terminen.
             *
             * Für ein Nur-Ansicht-Konto ist das keine Auskunft, sondern eine
             * Verwirrung: Der Wert gilt dem Link, nicht dem eigenen Kalender,
             * und stünde auf «vor 2 Stunden», während der eigene noch leer
             * ist. Deshalb nur in der Verwaltung.
             */}
            {canManage &&
              ` · ${
                feed.lastFetchedAt
                  ? `zuletzt abgerufen ${formatRelative(feed.lastFetchedAt)}`
                  : 'noch nie abgerufen'
              }`}
          </p>
        </div>

        {canManage && (
          <div className="flex shrink-0 gap-1">
            {feed.active ? (
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => updateCalendarFeed(feed.id, { active: false }),
                    'Link widerrufen. Der Kalender bleibt bei den Empfängern stehen, füllt sich aber nicht mehr.',
                  )
                }
              >
                <Ban className="size-3.5" aria-hidden />
                Widerrufen
              </button>
            ) : (
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => updateCalendarFeed(feed.id, { active: true }),
                    'Link wieder gültig.',
                  )
                }
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Wieder gültig
              </button>
            )}
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={remove}>
              <Trash2 className="size-3.5 text-rose-600" aria-hidden />
              <span className="sr-only">Löschen</span>
            </button>
          </div>
        )}
      </div>

      {feed.active && <LinkRow token={feed.token} />}
    </li>
  )
}

/** Was mit dem Link zu tun ist – einmal für Google, einmal für Apple. */
function Instructions() {
  return (
    <section className="space-y-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
      <h3 className="text-sm font-semibold">So wird der Link eingerichtet</h3>

      <div>
        <p className="flex items-center gap-2 font-medium">
          <Calendar className="size-4" aria-hidden />
          Google Calendar
        </p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-600 dark:text-slate-300">
          <li>
            Am Rechner <span className="font-mono text-xs">calendar.google.com</span> öffnen – über
            die App am Telefon geht es nicht.
          </li>
          <li>Links bei «Weitere Kalender» auf das Plus, dann «Per URL».</li>
          <li>Den Link einfügen und «Kalender hinzufügen».</li>
        </ol>
        <p className="hint">
          Danach steht er auch in der Google-Kalender-App auf dem Telefon – dort allenfalls unter
          «Einstellungen» noch einschalten.
        </p>
      </div>

      <div>
        <p className="flex items-center gap-2 font-medium">
          <Apple className="size-4" aria-hidden />
          Apple Kalender
        </p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-600 dark:text-slate-300">
          <li>
            Am einfachsten den webcal-Link auf dem Gerät öffnen – der Kalender fragt von selbst.
          </li>
          <li>
            Sonst am Mac: «Ablage › Neues Kalenderabonnement». Am iPhone: «Einstellungen › Apps ›
            Kalender › Accounts › Account hinzufügen › Andere › Kalenderabo hinzufügen».
          </li>
          <li>
            Am Mac danach beim Kalender unter «Aktualisieren» ein kurzes Intervall wählen – das geht
            dort, anders als bei Google.
          </li>
        </ol>
      </div>

      <p className="hint">
        Ein Abo ist immer nur zum Lesen. Wer im eigenen Kalender etwas an einem dieser Termine
        ändert, ändert nichts am Plan – und beim nächsten Abgleich ist die Änderung wieder weg.
      </p>
    </section>
  )
}
