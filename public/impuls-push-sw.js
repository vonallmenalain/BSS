/*
 * Der kleine Dienst hinter der Montags-Erinnerung des Bereichs «Impuls».
 *
 * Ein eigener Service Worker mit eigenem Geltungsbereich («/impuls-push/»),
 * damit er dem Service Worker der PWA nicht in die Quere kommt – der eine
 * macht die App offlinefähig, dieser hier zeigt einzig die Nachricht an,
 * die Cloud Messaging am Montagmorgen zustellt. Bewusst ohne
 * Firebase-Bibliothek: Ein Push-Ereignis und eine Benachrichtigung brauchen
 * keine Abhängigkeit, die brechen könnte.
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
    self.registration.showNotification(notification.title || 'Impuls', {
      body: notification.body || 'Die neue Woche ist bereit.',
      icon: notification.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Derselbe Anker je Woche: Zwei Zustellungen ergeben eine Nachricht.
      tag: notification.tag || 'impuls',
      data: { url: data.url || '/impuls' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/impuls'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Ein offenes Fenster der App in den Vordergrund holen – sonst eines
      // öffnen. Navigiert wird nicht: Das Fenster gehört dem Service Worker
      // der PWA, und «Impuls» ist von überall einen Fingertipp entfernt.
      const open = windows.find((client) => 'focus' in client)
      if (open) return open.focus()
      return self.clients.openWindow(url)
    }),
  )
})
