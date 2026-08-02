import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
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
        orientation: 'portrait-primary',
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
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        // Firestore/Auth niemals aus dem Service-Worker-Cache bedienen –
        // das Firebase-SDK bringt eine eigene Offline-Persistenz (IndexedDB) mit.
        navigateFallbackDenylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
        runtimeCaching: [
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
