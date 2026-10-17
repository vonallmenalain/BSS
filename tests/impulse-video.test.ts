import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  impulseEmbedHello,
  impulseEmbedMessage,
  impulseEmbedOrigin,
  impulseEmbedReport,
  impulseEmbedSeekMessage,
  impulseEmbedUrl,
  impulseScrubTime,
  impulseVideoClock,
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
    ['play', 'pause', 'ended', 'timeupdate'],
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
  // Wo es steht und wie lang es ist – für die Leiste und das Spulen.
  assert.deepEqual(report({ event: 'infoDelivery', info: { currentTime: 3.2 } }), { time: 3.2 })
  assert.deepEqual(report({ event: 'infoDelivery', info: { currentTime: 0, duration: 58.4 } }), {
    time: 0,
    duration: 58.4,
  })
  // Eine Länge von null ist noch keine – das Video hat sie noch nicht gemeldet.
  assert.equal(report({ event: 'infoDelivery', info: { duration: 0 } }), null)
  assert.equal(report({ event: 'infoDelivery', info: { currentTime: -1 } }), null)
  // Was nichts über den Stand sagt, ist keine Meldung.
  assert.equal(report({ event: 'infoDelivery', info: { videoLoadedFraction: 0.4 } }), null)
  assert.equal(report({ event: 'onReady', info: null }), null)
  assert.equal(impulseEmbedReport(youtube, 'kein JSON'), null)
  assert.equal(impulseEmbedReport(youtube, null), null)
})

test('impulseEmbedReport: was Vimeo über sich meldet – als Text oder als Objekt', () => {
  assert.deepEqual(impulseEmbedReport(vimeo, JSON.stringify({ event: 'play' })), { playing: true })
  assert.deepEqual(impulseEmbedReport(vimeo, { event: 'pause' }), { playing: false })
  assert.deepEqual(impulseEmbedReport(vimeo, { event: 'ended' }), { playing: false })
  assert.deepEqual(
    impulseEmbedReport(vimeo, { event: 'timeupdate', data: { seconds: 12.5, duration: 90 } }),
    { time: 12.5, duration: 90 },
  )
  assert.equal(impulseEmbedReport(vimeo, { event: 'ready' }), null)
  assert.equal(impulseEmbedReport(file, { event: 'play' }), null)
})

/* ------------------------------------------------------------------ */
/* Spulen                                                              */
/* ------------------------------------------------------------------ */

test('impulseEmbedSeekMessage: unterwegs nur das Bild, beim Loslassen weiterladen', () => {
  assert.deepEqual(JSON.parse(impulseEmbedSeekMessage(youtube, 42.5, false)!), {
    event: 'command',
    func: 'seekTo',
    args: [42.5, false],
    id: 1,
    channel: 'widget',
  })
  assert.deepEqual(JSON.parse(impulseEmbedSeekMessage(youtube, 42.5, true)!).args, [42.5, true])
  // Vor den Anfang spult niemand.
  assert.deepEqual(JSON.parse(impulseEmbedSeekMessage(youtube, -3, true)!).args, [0, true])
  assert.deepEqual(JSON.parse(impulseEmbedSeekMessage(vimeo, 10, true)!), {
    method: 'setCurrentTime',
    value: 10,
  })
  assert.equal(impulseEmbedSeekMessage(file, 10, true), null)
})

test('impulseScrubTime: die ganze Breite ist die ganze Länge – vom Stand beim Aufsetzen aus', () => {
  // Ein Short von 60 Sekunden auf einem Telefon von 390 Pixeln Breite.
  assert.equal(impulseScrubTime(20, 0, 390, 60), 20)
  assert.equal(impulseScrubTime(20, 195, 390, 60), 50)
  assert.equal(impulseScrubTime(20, -65, 390, 60), 10)
  // Nicht über den Anfang und nicht über das Ende hinaus.
  assert.equal(impulseScrubTime(20, -390, 390, 60), 0)
  assert.equal(impulseScrubTime(20, 390, 390, 60), 60)
  // Ohne Länge (noch keine Meldung) oder ohne Breite bleibt es, wo es ist.
  assert.equal(impulseScrubTime(20, 100, 390, 0), 20)
  assert.equal(impulseScrubTime(20, 100, 0, 60), 20)
})

test('impulseVideoClock: Minuten und Sekunden, wie man sie liest', () => {
  assert.equal(impulseVideoClock(0), '0:00')
  assert.equal(impulseVideoClock(7.9), '0:07')
  assert.equal(impulseVideoClock(65), '1:05')
  assert.equal(impulseVideoClock(750), '12:30')
  assert.equal(impulseVideoClock(-2), '0:00')
})
