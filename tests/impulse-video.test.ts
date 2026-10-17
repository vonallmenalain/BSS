import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  impulseEmbedHello,
  impulseEmbedMessage,
  impulseEmbedOrigin,
  impulseEmbedReport,
  impulseEmbedUrl,
  impulseVideoSource,
} from '../src/lib/impulseVideo.ts'

/*
 * Aus einem Link wird ein Video – auch aus dem Link auf einen
 * YouTube-Short, wie ihn der Knopf «Teilen» in der YouTube-App hergibt.
 * Ein Short läuft in Schleife wie auf YouTube; ein gewöhnliches Video
 * nicht.
 */

test('impulseVideoSource: ein Short in jeder Schreibweise', () => {
  const expected = { art: 'youtube', id: 'AbCdEfGhIjK', start: 0, short: true }
  assert.deepEqual(impulseVideoSource('https://www.youtube.com/shorts/AbCdEfGhIjK'), expected)
  assert.deepEqual(
    impulseVideoSource('https://youtube.com/shorts/AbCdEfGhIjK?si=t5PVc5ndmwtA-KLf'),
    expected,
  )
  assert.deepEqual(impulseVideoSource('https://m.youtube.com/shorts/AbCdEfGhIjK'), expected)
})

test('impulseVideoSource: ein gewöhnliches YouTube-Video ist kein Short', () => {
  assert.deepEqual(impulseVideoSource('https://www.youtube.com/watch?v=AbCdEfGhIjK&t=90'), {
    art: 'youtube',
    id: 'AbCdEfGhIjK',
    start: 90,
    short: false,
  })
  assert.equal(
    (impulseVideoSource('https://youtu.be/AbCdEfGhIjK') as { short: boolean }).short,
    false,
  )
})

test('impulseEmbedUrl: der Short läuft in Schleife – das gewöhnliche Video nicht', () => {
  const shortUrl = new URL(
    impulseEmbedUrl(impulseVideoSource('https://www.youtube.com/shorts/AbCdEfGhIjK')!)!,
  )
  assert.equal(shortUrl.hostname, 'www.youtube-nocookie.com')
  assert.equal(shortUrl.pathname, '/embed/AbCdEfGhIjK')
  assert.equal(shortUrl.searchParams.get('loop'), '1')
  // YouTube wiederholt nur eine Wiedergabeliste – mit dem Short als einziger Nummer.
  assert.equal(shortUrl.searchParams.get('playlist'), 'AbCdEfGhIjK')
  assert.equal(shortUrl.searchParams.get('autoplay'), '1')

  const videoUrl = new URL(
    impulseEmbedUrl(impulseVideoSource('https://www.youtube.com/watch?v=AbCdEfGhIjK')!)!,
  )
  assert.equal(videoUrl.searchParams.get('loop'), null)
  assert.equal(videoUrl.searchParams.get('playlist'), null)
})

/* ------------------------------------------------------------------ */
/* Die Fremdkarte fernsteuern                                          */
/* ------------------------------------------------------------------ */

/*
 * Über dem eingebetteten Video liegt eine Wischfläche – sonst behielte
 * der fremde Rahmen jede Berührung, und der Daumen käme nicht zur
 * nächsten Karte. Anhalten, Weiterlaufen und Ton sagt die Karte der
 * Fremdkarte darum per Nachricht, in deren eigener Sprache.
 */

const youtube = impulseVideoSource('https://www.youtube.com/shorts/AbCdEfGhIjK')!
const vimeo = impulseVideoSource('https://vimeo.com/123456789')!
const file = impulseVideoSource('https://media.ldscdn.org/video.mp4')!

test('impulseEmbedUrl: YouTube hört auf Nachrichten – und antwortet nur der App', () => {
  const url = new URL(impulseEmbedUrl(youtube, 'https://bischofschaft.netlify.app')!)
  assert.equal(url.searchParams.get('enablejsapi'), '1')
  assert.equal(url.searchParams.get('origin'), 'https://bischofschaft.netlify.app')
  // Ohne bekannte Seite bleibt der Ursprung weg, statt falsch dazustehen.
  assert.equal(new URL(impulseEmbedUrl(youtube)!).searchParams.get('origin'), null)
})

test('impulseEmbedMessage: die Befehle der YouTube-Schnittstelle', () => {
  const func = (command: Parameters<typeof impulseEmbedMessage>[1]) =>
    JSON.parse(impulseEmbedMessage(youtube, command)!)
  assert.deepEqual(func('play'), {
    event: 'command',
    func: 'playVideo',
    args: [],
    id: 1,
    channel: 'widget',
  })
  assert.equal(func('pause').func, 'pauseVideo')
  assert.equal(func('mute').func, 'mute')
  assert.equal(func('unmute').func, 'unMute')
  assert.equal(impulseEmbedOrigin(youtube), 'https://www.youtube-nocookie.com')
})

test('impulseEmbedMessage: die Methoden von Vimeo – und nichts für die Videodatei', () => {
  assert.deepEqual(JSON.parse(impulseEmbedMessage(vimeo, 'play')!), { method: 'play' })
  assert.deepEqual(JSON.parse(impulseEmbedMessage(vimeo, 'pause')!), { method: 'pause' })
  assert.deepEqual(JSON.parse(impulseEmbedMessage(vimeo, 'mute')!), {
    method: 'setMuted',
    value: true,
  })
  assert.deepEqual(JSON.parse(impulseEmbedMessage(vimeo, 'unmute')!), {
    method: 'setMuted',
    value: false,
  })
  assert.equal(impulseEmbedOrigin(vimeo), 'https://player.vimeo.com')
  assert.equal(impulseEmbedMessage(file, 'play'), null)
  assert.equal(impulseEmbedOrigin(file), null)
  assert.deepEqual(impulseEmbedHello(file), [])
})

test('impulseEmbedHello: die Anmeldung, nach der die Fremdkarte ihren Stand meldet', () => {
  assert.deepEqual(
    impulseEmbedHello(youtube).map((message) => JSON.parse(message)),
    [{ event: 'listening', id: 1, channel: 'widget' }],
  )
  assert.deepEqual(
    impulseEmbedHello(vimeo).map((message) => JSON.parse(message).value),
    ['play', 'pause', 'ended'],
  )
})

test('impulseEmbedReport: was YouTube über sich meldet', () => {
  const report = (data: unknown) => impulseEmbedReport(youtube, JSON.stringify(data))
  // Läuft – auch während es nachlädt.
  assert.deepEqual(report({ event: 'onStateChange', info: 1 }), { playing: true })
  assert.deepEqual(report({ event: 'onStateChange', info: 3 }), { playing: true })
  // Angehalten, zu Ende, noch nicht gestartet (der Browser hat den Ton abgelehnt), bereit.
  for (const state of [2, 0, -1, 5]) {
    assert.deepEqual(report({ event: 'onStateChange', info: state }), { playing: false })
  }
  assert.deepEqual(
    report({ event: 'infoDelivery', info: { playerState: -1, muted: false, volume: 100 } }),
    { playing: false, muted: false },
  )
  assert.deepEqual(report({ event: 'infoDelivery', info: { muted: true } }), { muted: true })
  assert.deepEqual(report({ event: 'initialDelivery', info: { playerState: 1 } }), {
    playing: true,
  })
  // Was nichts über den Stand sagt, ist keine Meldung.
  assert.equal(report({ event: 'infoDelivery', info: { currentTime: 3.2 } }), null)
  assert.equal(report({ event: 'onReady', info: null }), null)
  assert.equal(impulseEmbedReport(youtube, 'kein JSON'), null)
  assert.equal(impulseEmbedReport(youtube, null), null)
})

test('impulseEmbedReport: was Vimeo über sich meldet – als Text oder als Objekt', () => {
  assert.deepEqual(impulseEmbedReport(vimeo, JSON.stringify({ event: 'play' })), { playing: true })
  assert.deepEqual(impulseEmbedReport(vimeo, { event: 'pause' }), { playing: false })
  assert.deepEqual(impulseEmbedReport(vimeo, { event: 'ended' }), { playing: false })
  assert.equal(impulseEmbedReport(vimeo, { event: 'ready' }), null)
  assert.equal(impulseEmbedReport(file, { event: 'play' }), null)
})
