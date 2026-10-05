/**
 * Erzeugt die PWA-Icons aus SVG-Vorlagen – je Zugang ein eigener Satz
 * (welcher wann gilt, steht in `src/lib/appIdentity.ts`):
 *
 *  - `bs`        Vollzugriff: «BS» in Gemeindeblau – die App der Bischofschaft
 *  - `ap`        AP-Rollen (nur AP-Kalender oder nur Anti Doom): das Wappen
 *  - `kalender`  der öffentliche AP-Kalender ohne Anmeldung
 *  - `putzplan`  der öffentliche Putzplan ohne Anmeldung
 *  - `teilen`    das Bild in der Vorschau geteilter «Anti Doom»-Links
 *                (`src/lib/sharePreview.ts`): das Wappen vollflächig, ohne
 *                runde Ecken – die setzt der Messenger selbst
 *
 * Die erzeugten PNGs liegen unter `public/icons/` (das Apple-Icon der
 * Bischofschaft unter `public/`) und sind eingecheckt – das Script muss nur
 * laufen, wenn sich ein Symbol ändert:
 *
 *   node scripts/generate-icons.mjs                # alle Sätze
 *   node scripts/generate-icons.mjs ap kalender    # nur diese
 *
 * `sharp` ist bewusst KEINE Abhängigkeit des Projekts, damit der
 * Netlify-Build schlank bleibt. Es muss für den Lauf auffindbar sein, etwa
 * in einem `node_modules` oberhalb des Projekts.
 *
 * Die Zeichen von Kalender, Putzplan und Wappen stammen aus Lucide (ISC),
 * denselben Symbolen wie in der App.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')

const BRAND = '#1e3a5f'
const FONT = 'font-family="Helvetica, Arial, sans-serif" font-weight="700"'

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/** Zeichen aus Lucide – 24×24, als Linien. */
const LUCIDE = {
  calendar:
    '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/>' +
    '<path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>',
  broom:
    '<path d="m16 22-1-4"/><path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1"/>' +
    '<path d="M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z"/><path d="m8 22 1-4"/>',
  shield:
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
}

/** Ein Lucide-Zeichen auf der 512er-Fläche – `size` Pixel gross, ab (`x`, `y`). */
const glyph = (paths, { x, y, size, stroke }) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${stroke}" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`

/**
 * Die drei Formen eines Symbols:
 *
 *  - `any`       abgerundet, wie es die meisten Startbildschirme zeigen;
 *  - `maskable`  vollflächig – Android schneidet bis zu 20 % am Rand weg,
 *                deshalb sitzt das Zeichen kleiner in der Mitte («safe zone»);
 *  - `apple`     vollflächig in voller Grösse: iOS rundet selbst ab und füllt
 *                durchsichtige Ecken sonst schwarz.
 */
const shape = (form, { background, defs = '', body }) => {
  const inner =
    form === 'maskable'
      ? `<g transform="translate(256 256) scale(0.8) translate(-256 -256)">${body}</g>`
      : body
  const rect =
    form === 'any'
      ? `<rect width="512" height="512" rx="112" fill="${background}"/>`
      : `<rect width="512" height="512" fill="${background}"/>`
  return (size) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">` +
    `<defs>${defs}</defs>${rect}${inner}</svg>`
}

/* ------------------------------------------------------------------ */
/* Die Sätze                                                           */
/* ------------------------------------------------------------------ */

/** Vollzugriff – «BS» in Gemeindeblau. Unverändert seit dem ersten Tag. */
const BS = {
  any: (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BRAND}"/>
  <text x="256" y="342" ${FONT} font-size="224" fill="#ffffff" text-anchor="middle">BS</text>
</svg>`,
  maskable: (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>
  <text x="256" y="322" ${FONT} font-size="170" fill="#ffffff" text-anchor="middle">BS</text>
</svg>`,
}

/**
 * AP-Rollen – das Wappen: ein Schild in Smaragd mit goldenem Rand auf
 * dunklem Grund, darin «AP». Dieselbe Sprache wie das Wochen-Wappen in
 * Anti Doom.
 */
const AP_ART = {
  background: 'url(#grund)',
  defs:
    '<linearGradient id="grund" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#020617"/></linearGradient>' +
    '<linearGradient id="schild" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#047857"/></linearGradient>',
  body:
    `<path d="${LUCIDE.shield}" transform="translate(64 52) scale(16)" fill="url(#schild)" ` +
    'stroke="#fbbf24" stroke-width="0.9" stroke-linejoin="round"/>' +
    `<text x="256" y="318" ${FONT} font-size="150" fill="#ffffff" text-anchor="middle">AP</text>`,
}

/** Öffentlich – hell, das Zeichen des Anschlagbretts in Gemeindeblau. */
const board = (paths) => ({
  background: '#ffffff',
  body: glyph(paths, { x: 106, y: 106, size: 300, stroke: BRAND }),
})

const SETS = {
  bs: [
    { file: 'icons/icon-192.png', size: 192, svg: BS.any },
    { file: 'icons/icon-512.png', size: 512, svg: BS.any },
    { file: 'icons/icon-maskable-512.png', size: 512, svg: BS.maskable },
    { file: 'apple-touch-icon.png', size: 180, svg: BS.any },
  ],
  ap: [
    { file: 'icons/ap-192.png', size: 192, svg: shape('any', AP_ART) },
    { file: 'icons/ap-512.png', size: 512, svg: shape('any', AP_ART) },
    { file: 'icons/ap-maskable-512.png', size: 512, svg: shape('maskable', AP_ART) },
    { file: 'icons/ap-apple-touch-icon.png', size: 180, svg: shape('apple', AP_ART) },
  ],
  kalender: [
    { file: 'icons/kalender-192.png', size: 192, svg: shape('any', board(LUCIDE.calendar)) },
    { file: 'icons/kalender-512.png', size: 512, svg: shape('any', board(LUCIDE.calendar)) },
    {
      file: 'icons/kalender-maskable-512.png',
      size: 512,
      svg: shape('maskable', board(LUCIDE.calendar)),
    },
    {
      file: 'icons/kalender-apple-touch-icon.png',
      size: 180,
      svg: shape('apple', board(LUCIDE.calendar)),
    },
  ],
  teilen: [{ file: 'icons/ap-share-512.png', size: 512, svg: shape('apple', AP_ART) }],
  putzplan: [
    { file: 'icons/putzplan-192.png', size: 192, svg: shape('any', board(LUCIDE.broom)) },
    { file: 'icons/putzplan-512.png', size: 512, svg: shape('any', board(LUCIDE.broom)) },
    {
      file: 'icons/putzplan-maskable-512.png',
      size: 512,
      svg: shape('maskable', board(LUCIDE.broom)),
    },
    {
      file: 'icons/putzplan-apple-touch-icon.png',
      size: 180,
      svg: shape('apple', board(LUCIDE.broom)),
    },
  ],
}

/* ------------------------------------------------------------------ */
/* Zeichnen                                                            */
/* ------------------------------------------------------------------ */

const wanted = process.argv.slice(2)
const unknown = wanted.filter((name) => !(name in SETS))
if (unknown.length > 0) {
  console.error(`Unbekannt: ${unknown.join(', ')} – es gibt ${Object.keys(SETS).join(', ')}.`)
  process.exit(1)
}

const { default: sharp } = await import('sharp')

await mkdir(outDir, { recursive: true })

for (const name of wanted.length > 0 ? wanted : Object.keys(SETS)) {
  for (const target of SETS[name]) {
    const buffer = await sharp(Buffer.from(target.svg(target.size)))
      .resize(target.size, target.size)
      .png({ compressionLevel: 9 })
      .toBuffer()
    await writeFile(join(root, 'public', target.file), buffer)
    console.log(`✓ ${target.file} (${target.size}×${target.size})`)
  }
}

console.log('\nIcons erzeugt. Bitte einchecken.')
