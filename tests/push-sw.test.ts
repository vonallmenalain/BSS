import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

/*
 * Der Service Worker der Benachrichtigungen (`public/push-sw.js`), in einer
 * nachgebauten Umgebung: Was geschieht beim Antippen, je nachdem, welche
 * Fenster der App offen sind?
 */

const SOURCE = readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8')

interface FakeWindow {
  url: string
  focused: boolean
  messages: unknown[]
  focus(): Promise<void>
  postMessage(message: unknown): void
}

function fakeWindow(url: string): FakeWindow {
  return {
    url,
    focused: false,
    messages: [],
    async focus() {
      this.focused = true
    },
    postMessage(message: unknown) {
      this.messages.push(message)
    },
  }
}

async function tap(url: string, windows: FakeWindow[]) {
  const handlers = new Map<string, (event: unknown) => void>()
  const opened: string[] = []
  const self = {
    location: { origin: 'https://bss.alae.app' },
    addEventListener: (type: string, handler: (event: unknown) => void) =>
      handlers.set(type, handler),
    skipWaiting: () => undefined,
    clients: {
      matchAll: async () => windows,
      openWindow: async (target: string) => {
        opened.push(target)
      },
      claim: async () => undefined,
    },
    registration: { showNotification: async () => undefined },
  }
  vm.runInNewContext(SOURCE, { self, URL })

  let done: Promise<unknown> = Promise.resolve()
  handlers.get('notificationclick')!({
    notification: { close: () => undefined, data: { url } },
    waitUntil: (promise: Promise<unknown>) => {
      done = promise
    },
  })
  await done
  return opened
}

test('steht ein Fenster schon auf der Seite, kommt es bloss nach vorn', async () => {
  const ap = fakeWindow('https://bss.alae.app/ap')
  const plan = fakeWindow('https://bss.alae.app/putzplan?source=pwa')
  const opened = await tap('/putzplan', [ap, plan])
  assert.equal(plan.focused, true)
  assert.deepEqual(plan.messages, [])
  assert.equal(ap.focused, false)
  assert.deepEqual(opened, [])
})

test('sonst wird ein offenes Fenster auf die Seite gebracht – über die App', async () => {
  const ap = fakeWindow('https://bss.alae.app/ap')
  const opened = await tap('/putzplan', [ap])
  assert.equal(ap.focused, true)
  // Aus der nachgebauten Umgebung kommt ein Objekt mit fremdem Prototyp –
  // verglichen wird der Inhalt.
  assert.deepEqual(JSON.parse(JSON.stringify(ap.messages)), [
    { type: 'bss-navigate', url: '/putzplan' },
  ])
  assert.deepEqual(opened, [])
})

test('ohne offenes Fenster öffnet sich eines', async () => {
  assert.deepEqual(await tap('/putzplan', []), ['/putzplan'])
})
