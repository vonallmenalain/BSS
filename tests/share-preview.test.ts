import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { IMPULSE_SECTION_ORDER } from '../src/lib/impulseSections.ts'
import {
  ANTI_DOOM_PREVIEW,
  ANTI_DOOM_SUBPAGES,
  applySharePreview,
  SITE_URL,
  sharePreviewPages,
} from '../src/lib/sharePreview.ts'

/*
 * Die Vorschau geteilter Links (src/lib/sharePreview.ts): welche Seiten
 * der Build ablegt und was in ihrem Kopf steht.
 */

const INDEX = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('Seiten: «Anti Doom» und jeder seiner Bereiche – samt Redaktion und Einstellungen', () => {
  const pages = sharePreviewPages()
  assert.deepEqual(pages[0], {
    file: 'anti-doom.html',
    path: '/anti-doom',
    preview: ANTI_DOOM_PREVIEW,
  })
  // Kommt ein Bereich dazu, fehlte sonst seine Seite – und sein Link zeigte wieder «BS».
  assert.deepEqual(
    [...ANTI_DOOM_SUBPAGES].sort(),
    [...IMPULSE_SECTION_ORDER, 'redaktion', 'einstellungen'].sort(),
  )
  assert.ok(
    pages.some((page) => page.file === 'anti-doom/quiz.html' && page.path === '/anti-doom/quiz'),
  )
  assert.equal(new Set(pages.map((page) => page.file)).size, pages.length)
})

test('Kopf: Titel, Beschreibung, Symbol und Open Graph – das Bild mit voller Adresse', () => {
  const page = sharePreviewPages().find((entry) => entry.path === '/anti-doom/spiel')
  assert.ok(page)
  const html = applySharePreview(INDEX, page)
  assert.match(html, /<title>Anti Doom<\/title>/)
  assert.doesNotMatch(html, /<title>Bischofschaft<\/title>/)
  assert.match(html, /<meta name="description" content="Statt Doomscrolling: [^"]+" \/>/)
  assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/ap-apple-touch-icon.png" \/>/)
  assert.match(html, /<meta property="og:title" content="Anti Doom" \/>/)
  assert.match(html, new RegExp(`<meta property="og:url" content="${SITE_URL}/anti-doom/spiel" />`))
  assert.match(
    html,
    new RegExp(`<meta property="og:image" content="${SITE_URL}/icons/ap-share-512.png" />`),
  )
  assert.match(html, /Anti Doom wird geladen …/)
  // Die Angaben stehen im Kopf, und der Rest der Seite bleibt, wie er war.
  assert.ok(html.indexOf('og:image') < html.indexOf('</head>'))
  assert.ok(html.includes('<script type="module" src="/src/main.tsx"></script>'))
  assert.equal(html.match(/<title>/g)?.length, 1)
  assert.equal(html.match(/name="description"/g)?.length, 1)
})

test('Sonderzeichen in den Angaben werden maskiert', () => {
  const page = {
    file: 'x.html',
    path: '/x',
    preview: { ...ANTI_DOOM_PREVIEW, title: 'A & B', description: 'Sag "Hallo" <jetzt>' },
  }
  const html = applySharePreview(INDEX, page)
  assert.match(html, /<title>A &amp; B<\/title>/)
  assert.match(html, /content="Sag &quot;Hallo&quot; &lt;jetzt&gt;"/)
})

test('Fehlt im index.html, was ersetzt werden soll, bricht der Build ab', () => {
  const page = sharePreviewPages()[0]
  assert.throws(
    () => applySharePreview(INDEX.replace(/<title>[^<]*<\/title>/, ''), page),
    /Der Titel fehlt/,
  )
  assert.throws(
    () => applySharePreview(INDEX.replace(/<meta\s+name="description"[^>]*>/, ''), page),
    /Die Beschreibung fehlt/,
  )
})
