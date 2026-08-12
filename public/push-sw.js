/*
 * Der kleine Dienst hinter den Benachrichtigungen.
 *
 * Ein eigener Service Worker mit eigenem Geltungsbereich («/push/»), damit
 * er dem Service Worker der PWA nicht in die Quere kommt – der eine macht
 * die App offlinefähig, dieser hier zeigt einzig die Nachricht an, die
 * Cloud Messaging zustellt. Bewusst ohne Firebase-Bibliothek: Ein
 * Push-Ereignis und eine Benachrichtigung brauchen keine Abhängigkeit, die
 * brechen könnte.
 *
 * Was in der Nachricht steht, entscheidet der Versand
 * (`netlify/functions/benachrichtigungen.mts`); hier wird nichts getextet,
 * nur angezeigt und beim Antippen die richtige Seite geöffnet.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const notification = payload.notification || {}
  const data = payload.data || {}

  event.waitUntil(
    self.registration.showNotification(notification.title || 'Bischofschaft', {
      body: notification.body || '',
      icon: notification.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Derselbe Anker je Anlass: Zwei Zustellungen ergeben eine Nachricht.
      tag: notification.tag || 'bss',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Ein offenes Fenster der App in den Vordergrund holen – sonst eines
      // öffnen. Navigiert wird nicht: Das Fenster gehört dem Service Worker
      // der PWA, und jeder Bereich ist von überall einen Fingertipp entfernt.
      const open = windows.find((client) => 'focus' in client)
      if (open) return open.focus()
      return self.clients.openWindow(url)
    }),
  )
})
