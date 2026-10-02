import { Apple, Calendar } from 'lucide-react'

/**
 * Was mit einem Kalender-Link zu tun ist – einmal für Google, einmal für
 * Apple. Gebraucht vom Aktivitätenplan (`ApFeedDialog`) und vom Putzplan
 * (`CleaningCalendarDialog`): Ein Abo richtet sich überall gleich ein.
 */
export function CalendarInstructions() {
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
