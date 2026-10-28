import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { applySharePreview, sharePreviewPages } from './src/lib/sharePreview.ts'
import { prNumberFrom, type AppVersion } from './src/lib/appVersion.ts'

/**
 * Eigene Seiten für geteilte Links: Neben `index.html` legt der Build für
 * «Anti Doom» Kopien mit eigenem Titel, eigener Beschreibung und dem
 * AP-Wappen als Bild ab – Messenger lesen die Vorschau aus dem HTML, ohne
 * die App zu starten (siehe `src/lib/sharePreview.ts`). Gebaut wird aus
 * dem fertigen `index.html`, mit denselben Skripten und Stilen.
 */
function sharePreviews(): Plugin {
  return {
    name: 'bss:share-previews',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') {
        this.error('Link-Vorschau: index.html fehlt im Build.')
      }
      const html =
        typeof index.source === 'string' ? index.source : new TextDecoder().decode(index.source)
      for (const page of sharePreviewPages()) {
        this.emitFile({ type: 'asset', fileName: page.file, source: applySharePreview(html, page) })
      }
    },
  }
}

/** Eine Zeile aus Git – oder nichts, wo es kein Git gibt. */
function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Welche Fassung dieser Build ist (siehe `src/lib/appVersion.ts`).
 *
 * Netlify nennt den Commit (`COMMIT_REF`) und in der Vorschau eines Pull
 * Requests dessen Nummer (`REVIEW_ID`). Auf `main` steht die Nummer in der
 * Betreffzeile des Squash-Merges – Netlify baut aus einem Git-Klon, die
 * Zeile ist also da.
 */
function buildVersion(): AppVersion {
  const env = process.env
  const commit = env.COMMIT_REF || git('rev-parse', 'HEAD')
  const preview = env.CONTEXT === 'deploy-preview'
  const pr = preview ? Number(env.REVIEW_ID) || null : prNumberFrom(git('log', '-1', '--format=%s'))
  const builtAt = new Date().toISOString()
  return {
    id: `${commit?.slice(0, 12) ?? 'lokal'}-${builtAt}`,
    pr,
    preview,
    commit: commit?.slice(0, 7) ?? null,
    builtAt,
  }
}

/**
 * Schreibt die Fassung in den Code und daneben nach `/version.json`.
 *
 * Die App vergleicht beides, um eine neue Fassung zu erkennen – auch dann,
 * wenn der Service Worker selbst hängen sollte (siehe `lib/appUpdate`).
 * Die Datei kommt nicht in den Precache: `globPatterns` kennt kein `json`.
 */
function appVersion(): Plugin {
  const version = buildVersion()
  return {
    name: 'bss:app-version',
    config: () => ({ define: { __APP_VERSION__: JSON.stringify(version) } }),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify(version)}\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    sharePreviews(),
    appVersion(),
    /*
     * Neue Fassungen kommen von selbst – ohne Hinweis, ohne Knopf.
     *
     * Bis anhin wartete eine neue Fassung, bis jemand «Aktualisieren»
     * antippte, und bis dahin lieferte der Service Worker die alte aus dem
     * Cache – auch nach mehrmaligem Neuladen. Wer sich in dieser Lage neu
     * registrierte, bekam das Konto der alten Fassung. Jetzt gilt:
     *
     *  - `autoUpdate`: Ein neuer Service Worker übernimmt sofort
     *    (`skipWaiting`, `clientsClaim`).
     *  - Seitenaufrufe gehen immer zuerst ans Netz (`NetworkOnly` unten);
     *    nur ohne Verbindung springt die gespeicherte `index.html` ein. Wer
     *    die App öffnet oder neu lädt, bekommt damit die neueste Fassung.
     *  - Die App vergleicht ausserdem ihre Fassung mit `/version.json` und
     *    lädt still neu, sobald es eine neuere gibt (`src/lib/appUpdate.ts`).
     */
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Bischofschaft',
        short_name: 'Bischofschaft',
        description:
          'Sitzungen, Traktanden, Pendenzen, Ansprachen und Berufungen der Bischofschaft verwalten.',
        lang: 'de-CH',
        dir: 'ltr',
        theme_color: '#1e3a5f',
        background_color: '#f8fafc',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        /*
         * Beide Lagen erlaubt.
         *
         * Die App war auf Hochformat festgenagelt – am Pult ist das falsch:
         * Wer die Leitung im Vollbild liest, dreht das Telefon quer und hat
         * doppelt so viel Zeile. Dasselbe gilt für Pendenzen und Notizen auf
         * dem Tablet. Die Wahl liegt jetzt beim Gerät, wie bei jeder anderen
         * App auch.
         *
         * Hinweis: Android liest das Manifest beim Einrichten. Eine bereits
         * installierte PWA übernimmt die Änderung erst mit der nächsten
         * Aktualisierung des Startsymbols – oder sofort, wenn man sie neu zum
         * Startbildschirm hinzufügt.
         */
        orientation: 'any',
        scope: '/',
        start_url: '/?source=pwa',
        categories: ['productivity', 'business'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Nächste Sitzung',
            short_name: 'Sitzung',
            description: 'Direkt in die nächste Sitzung springen',
            url: '/sitzungen?shortcut=next',
          },
          {
            name: 'Pendenzen',
            short_name: 'Pendenzen',
            description: 'Offene Pendenzen anzeigen',
            url: '/pendenzen',
          },
          {
            name: 'Ansprachen',
            short_name: 'Ansprachen',
            description: 'Ansprachen planen',
            url: '/ansprachen',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Der Service Worker der Benachrichtigungen gehört nicht in
        // den Precache: Der Browser holt SW-Skripte ohnehin am Cache vorbei,
        // und Netlify liefert ihn bewusst mit «max-age=0» aus. Ebenso die
        // Seiten und das Bild für geteilte Links – sie sind für Messenger
        // da; die App selbst startet offline aus `index.html`.
        globIgnores: ['**/push-sw.js', 'anti-doom.html', 'anti-doom/**', 'icons/ap-share-*.png'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        /*
         * Kein App-Shell aus dem Cache: Seitenaufrufe regelt die Route
         * unten. `directoryIndex: null` hält auch die Startseite «/» aus dem
         * Precache – sonst bediente er sie mit der gespeicherten
         * `index.html`, bevor die Route unten zum Zug käme.
         */
        navigateFallback: null,
        directoryIndex: null,
        runtimeCaching: [
          /*
           * Seitenaufrufe immer vom Server – mit der gespeicherten
           * `index.html` nur als Rückfall ohne Verbindung.
           *
           * Zwischengespeichert wird dabei nichts: Eine gespeicherte Seite
           * verwiese nach dem nächsten Update auf Dateien, die es nicht mehr
           * gibt. Die `index.html` im Precache passt immer zu den Dateien
           * daneben.
           *
           * Ausgenommen wie bisher: `/__/…` (Anmeldung über Firebase) und
           * Adressen mit Dateiendung. Die Funktion landet als Text im Service
           * Worker – sie darf nichts von ausserhalb verwenden.
           */
          {
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' &&
              !url.pathname.startsWith('/__') &&
              !/\/[^/?]+\.[^/]+$/.test(url.pathname),
            handler: 'NetworkOnly',
            options: { precacheFallback: { fallbackURL: 'index.html' } },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Grosse, selten wechselnde Abhängigkeiten in eigene Dateien legen –
        // so bleibt der Browser-Cache über App-Updates hinweg nützlich.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          if (id.includes('read-excel-file') || id.includes('papaparse')) return 'import'
          if (/[\\/]node_modules[\\/](react|react-dom|react-router)/.test(id)) return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
