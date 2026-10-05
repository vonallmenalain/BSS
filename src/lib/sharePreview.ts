/*
 * Was ein geteilter Link zeigt – in WhatsApp, Signal, Telegram, iMessage.
 *
 * Die Vorschau baut der Messenger selbst, und zwar ohne JavaScript: Er holt
 * das HTML, das der Server liefert, und liest daraus Titel, Beschreibung
 * und Bild (Open Graph, `og:*`). Die App ist eine Single-Page-App – für
 * jede Adresse liefert Netlify dasselbe `index.html`. So zeigte jeder Link
 * «Bischofschaft» mit dem blauen «BS», auch der auf «Anti Doom», den die
 * AP's bekommen.
 *
 * Darum legt der Build für «Anti Doom» eigene Seiten neben `index.html`
 * (`vite.config.ts`): dieselbe App, nur mit eigenem Titel, eigener
 * Beschreibung und dem AP-Wappen als Bild. Netlify liefert eine vorhandene
 * Datei vor dem Rückfall auf `index.html` – der steht in `netlify.toml`
 * nicht erzwungen –, `/anti-doom` also aus `anti-doom.html` und
 * `/anti-doom/quiz` aus `anti-doom/quiz.html`. Im Browser startet daraus
 * dieselbe App; was sie zeigt, hängt wie immer am Zugang.
 *
 * Messenger merken sich eine Vorschau eine Weile: Ein schon geteilter Link
 * zeigt das neue Bild erst später – sofort mit einem angehängten `?v=2`.
 */

/** Die Adresse der App – Messenger brauchen das Bild mit voller Adresse. */
export const SITE_URL = 'https://bss.alae.app'

export interface SharePreview {
  title: string
  /** Im Messenger meist nach gut zwanzig Zeichen abgeschnitten – das Wichtigste zuerst. */
  description: string
  /** Das Bild, quadratisch und vollflächig – die Ecken rundet der Messenger. */
  image: string
  imageAlt: string
  /** Kantenlänge des Bildes in Pixeln. */
  imageSize: number
  /** Das Symbol fürs iPhone – dasselbe wie für die App der AP's (`lib/appIdentity`). */
  appleTouchIcon: string
}

/** «Anti Doom» – mit dem Wappen der AP's statt dem «BS». */
export const ANTI_DOOM_PREVIEW: SharePreview = {
  title: 'Anti Doom',
  description:
    "Statt Doomscrolling: jede Woche ein Thema, Quiz, Challenges und dein eigenes Wappen – für die AP's.",
  image: '/icons/ap-share-512.png',
  imageAlt: "Das Wappen der AP's: ein grüner Schild mit goldenem Rand und «AP»",
  imageSize: 512,
  appleTouchIcon: '/icons/ap-apple-touch-icon.png',
}

/**
 * Die Unterseiten von «Anti Doom»: jeder Bereich (`IMPULSE_SECTION_ORDER`
 * in `lib/impulseSections` – ein Test hält beide gleich), die Redaktion
 * und die Einstellungen. Auch ein Link mitten in den Feed oder in einen
 * Raum zeigt so das Wappen.
 */
export const ANTI_DOOM_SUBPAGES = [
  'woche',
  'umfrage',
  'quiz',
  'puzzle',
  'bilderraetsel',
  'video',
  'frage',
  'feed',
  'teilen',
  'spiel',
  'ziel',
  'challenge',
  'fortschritt',
  'dabei',
  'gemerkt',
  'wochen',
  'mitmachen',
  'redaktion',
  'einstellungen',
] as const

/** Eine Seite, die der Build ablegt. */
export interface SharePreviewPage {
  /** Die Datei im Ausgabeordner – «anti-doom/quiz.html». */
  file: string
  /** Die Adresse, unter der Netlify sie liefert – «/anti-doom/quiz». */
  path: string
  preview: SharePreview
}

export function sharePreviewPages(): SharePreviewPage[] {
  return [
    { file: 'anti-doom.html', path: '/anti-doom', preview: ANTI_DOOM_PREVIEW },
    ...ANTI_DOOM_SUBPAGES.map((slug) => ({
      file: `anti-doom/${slug}.html`,
      path: `/anti-doom/${slug}`,
      preview: ANTI_DOOM_PREVIEW,
    })),
  ]
}

function escapeAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Genau eine Stelle ersetzen – fehlt sie, bricht der Build ab, statt still eine Seite ohne Vorschau abzulegen. */
function replaceOnce(html: string, pattern: RegExp, replacement: string, what: string): string {
  if (!pattern.test(html)) {
    throw new Error(`Link-Vorschau: ${what} fehlt in index.html.`)
  }
  return html.replace(pattern, () => replacement)
}

/**
 * Das `index.html` der App mit der Vorschau einer Seite: Titel,
 * Beschreibung und Symbol ersetzt, die `og:*`-Angaben dazu. Der Rest –
 * Skripte, Stile, das Manifest – bleibt, wie der Build ihn geschrieben
 * hat; das Manifest stellt die App ohnehin nach dem Zugang ein
 * (`lib/appIdentity`), und sie merkt sich dafür das ursprüngliche.
 */
export function applySharePreview(html: string, page: SharePreviewPage): string {
  const { preview } = page
  const title = escapeAttribute(preview.title)
  const description = escapeAttribute(preview.description)
  const openGraph = [
    ['og:type', 'website'],
    ['og:locale', 'de_CH'],
    ['og:title', preview.title],
    ['og:description', preview.description],
    ['og:url', `${SITE_URL}${page.path}`],
    ['og:image', `${SITE_URL}${preview.image}`],
    ['og:image:type', 'image/png'],
    ['og:image:width', String(preview.imageSize)],
    ['og:image:height', String(preview.imageSize)],
    ['og:image:alt', preview.imageAlt],
  ]
    .map(
      ([property, content]) =>
        `    <meta property="${property}" content="${escapeAttribute(content)}" />`,
    )
    .join('\n')

  let result = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'Der Titel')
  result = replaceOnce(
    result,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${description}" />`,
    'Die Beschreibung',
  )
  result = replaceOnce(
    result,
    /<link\s+rel="apple-touch-icon"\s+href="[^"]*"\s*\/?>/,
    `<link rel="apple-touch-icon" href="${escapeAttribute(preview.appleTouchIcon)}" />`,
    'Das Symbol fürs iPhone',
  )
  result = replaceOnce(result, /\s*<\/head>/, `\n${openGraph}\n  </head>`, 'Das Ende des Kopfs')
  /* Der Ladehinweis nennt den Bereich – fehlt er, ist das kein Grund für einen Abbruch. */
  return result.replace('Bischofschaft wird geladen …', `${title} wird geladen …`)
}
