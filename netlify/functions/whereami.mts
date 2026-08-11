import { Buffer } from 'node:buffer'

/**
 * Sagt dem Browser, von wo aus er gerade zugreift.
 *
 * Erreichbar unter `/api/standort` (siehe `netlify.toml`) und einzig für das
 * Zugriffsprotokoll gedacht: Die App hält fest, wer wann da war, und dazu
 * gehört die Frage, von wo. Beantworten kann sie der Browser nicht – er kennt
 * seine eigene IP-Adresse nicht, und nach dem Standort zu fragen hiesse, jedem
 * Konto bei jedem Start einen Systemdialog vorzusetzen.
 *
 * Netlify weiss es ohnehin: Jede Anfrage geht über sein Netz, und es legt das
 * Ergebnis seiner IP-Zuordnung in zwei Kopfzeilen ab. Diese Function liest sie
 * aus und gibt sie an den Aufrufer zurück – an ihn und an niemanden sonst.
 *
 * ## Was das für eine Auskunft ist
 *
 * Eine ungefähre. Sie zeigt, wo der Anschluss registriert ist, über den
 * jemand ins Netz geht – bei einem Mobilfunknetz kann das die halbe Schweiz
 * daneben liegen, bei einem VPN das falsche Land. Sie taugt für «war das
 * derselbe Ort wie sonst?» und nicht für mehr. Genau so steht es auch auf der
 * Seite, die sie anzeigt.
 *
 * ## Warum sie niemanden anmeldet
 *
 * Weil sie nichts herausgibt, was der Aufrufer nicht schon über sich selbst
 * wüsste: seine eigene Adresse und die Stadt dazu. Eine Anmeldung zu prüfen
 * hiesse, ein Token entgegenzunehmen und zu überprüfen – Aufwand für einen
 * Schutz, der nichts schützt. Gespeichert wird hier nichts; wer die Angabe ins
 * Protokoll schreibt, ist die App und nicht diese Stelle.
 *
 * Ohne Netlify – beim Entwickeln mit `npm run dev` – gibt es diese Adresse
 * nicht. Der Abruf scheitert dann still, und im Protokoll steht bei «Ort»
 * nichts. Die Zeitzone des Geräts trägt die App selbst bei.
 */

interface NetlifyGeo {
  city?: string
  country?: { code?: string; name?: string }
  subdivision?: { code?: string; name?: string }
  timezone?: string
}

/**
 * Die Kopfzeile `x-nf-geo` ist Base64 über JSON.
 *
 * Fehlt sie oder ist sie unbrauchbar, gibt es eben keine Ortsangabe – das ist
 * kein Fehler, sondern der Normalfall bei einer Adresse, die Netlify nicht
 * zuordnen kann.
 */
function readGeo(header: string | null): NetlifyGeo {
  if (!header) return {}
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as NetlifyGeo
  } catch {
    return {}
  }
}

export default async function handler(request: Request): Promise<Response> {
  const geo = readGeo(request.headers.get('x-nf-geo'))

  const body = {
    city: geo.city ?? '',
    region: geo.subdivision?.name ?? '',
    country: geo.country?.name ?? '',
    countryCode: geo.country?.code ?? '',
    timezone: geo.timezone ?? '',
    ip: request.headers.get('x-nf-client-connection-ip') ?? '',
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Die Antwort gilt für genau diesen Abruf – nichts davon darf ein
      // Zwischenspeicher der nächsten Person ausliefern.
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}
