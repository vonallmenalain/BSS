/**
 * Erzeugt die PWA-Icons aus einer SVG-Vorlage.
 *
 * Die erzeugten PNGs liegen unter `public/icons/` und sind eingecheckt –
 * das Script muss nur laufen, wenn sich das Logo ändert:
 *
 *   npx --yes sharp-cli@latest --version   # nur zur Prüfung
 *   node scripts/generate-icons.mjs
 *
 * `sharp` ist bewusst KEINE Abhängigkeit des Projekts, damit der
 * Netlify-Build schlank bleibt. Das Script installiert es bei Bedarf
 * über npx in einen temporären Ordner.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')

const BRAND = '#1e3a5f'

/** Standard-Icon: Logo füllt die Fläche. */
const icon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BRAND}"/>
  <text x="256" y="342" font-family="Helvetica, Arial, sans-serif" font-size="224"
        font-weight="700" fill="#ffffff" text-anchor="middle">BS</text>
</svg>`

/**
 * Maskable-Icon: Android schneidet bis zu 20 % am Rand weg, deshalb sitzt
 * das Logo hier kleiner in der Mitte («safe zone»).
 */
const maskable = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>
  <text x="256" y="322" font-family="Helvetica, Arial, sans-serif" font-size="170"
        font-weight="700" fill="#ffffff" text-anchor="middle">BS</text>
</svg>`

const targets = [
  { name: 'icon-192.png', size: 192, svg: icon },
  { name: 'icon-512.png', size: 512, svg: icon },
  { name: 'icon-maskable-512.png', size: 512, svg: maskable },
  { name: 'apple-touch-icon.png', size: 180, svg: icon },
]

const { default: sharp } = await import('sharp')

await mkdir(outDir, { recursive: true })

for (const target of targets) {
  const buffer = await sharp(Buffer.from(target.svg(target.size)))
    .resize(target.size, target.size)
    .png({ compressionLevel: 9 })
    .toBuffer()

  const path =
    target.name === 'apple-touch-icon.png'
      ? join(root, 'public', target.name)
      : join(outDir, target.name)

  await writeFile(path, buffer)
  console.log(`✓ ${target.name} (${target.size}×${target.size})`)
}

console.log('\nIcons erzeugt. Bitte einchecken.')
