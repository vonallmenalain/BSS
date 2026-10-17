import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  EMBED_CHROME_BAND,
  impulseEmbedBox,
  impulseEmbedHello,
  impulseEmbedMessage,
  impulseEmbedOrigin,
  impulseEmbedReport,
  impulseEmbedSeekMessage,
  impulseEmbedUrl,
  impulseScrubTime,
  impulseSoundBlocked,
  impulseVideoClock,
  impulseVideoSource,
} from '../src/lib/impulseVideo.ts'

/*
 * Aus einem Link wird ein Video – auch aus dem Link auf einen
 * YouTube-Short, wie ihn der Knopf «Teilen» in der YouTube-App hergibt.
 * Ein Short läuft in Schleife wie auf YouTube; ein gewöhnliches Video
 * nicht. Die Schleife dreht die Karte selbst (sie meldet sich mit
 * `ended`), nicht YouTube.
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

test('impulseEmbedUrl: der Short startet von selbst – ohne Wiedergabeliste von YouTube', () => {
  const shortUrl = new URL(
    impulseEmbedUrl(impulseVideoSource('https://www.youtube.com/shorts/AbCdEfGhIjK')!)!,
  )
  assert.equal(shortUrl.hostname, 'www.youtube-nocookie.com')
  assert.equal(shortUrl.pathname, '/embed/AbCdEfGhIjK')
  assert.equal(shortUrl.searchParams.get('autoplay'), '1')
  // Eine Wiedergabeliste brächte die Knöpfe «zurück» und «weiter» übers Bild.
  assert.equal(shortUrl.searchParams.get('loop'), null)
  assert.equal(shortUrl.searchParams.get('playlist'), null)
})

/* ------------------------------------------------------------------ */
/* Die Fremdkarte fernsteuern                                          */
/* ------------------------------------------------------------------ */

/*
 * Über dem eingebetteten Video liegt die Fläche der App – sonst behielte
 * der fremde Rahmen jede Berührung, und der Daumen käme nicht zur
 * nächsten Karte. Anhalten, Weiterlaufen, Spulen und Ton sagt die Karte
 * der Fremdkarte darum per Nachricht, in deren eigener Sprache.
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

test('impulseEmbedUrl: nur das Video – ohne Knöpfe und Hinweise des Anbieters', () => {
  const url = new URL(impulseEmbedUrl(youtube)!)
  assert.equal(url.searchParams.get('controls'), '0')
  assert.equal(url.searchParams.get('iv_load_policy'), '3')
  assert.equal(url.searchParams.get('fs'), '0')
  assert.equal(url.searchParams.get('disablekb'), '1')
})

test('impulseEmbedUrl: mit Ton, wo es geht – stumm, wo der Browser ihn ohnehin ablehnt', () => {
  assert.equal(new URL(impulseEmbedUrl(youtube)!).searchParams.get('mute'), '0')
  assert.equal(
    new URL(impulseEmbedUrl(youtube, undefined, { muted: true })!).searchParams.get('mute'),
    '1',
  )
  assert.equal(new URL(impulseEmbedUrl(vimeo)!).searchParams.get('muted'), '0')
  assert.equal(
    new URL(impulseEmbedUrl(vimeo, undefined, { muted: true })!).searchParams.get('muted'),
    '1',
  )
})

test('impulseSoundBlocked: iPhone und iPad lassen nie von selbst Ton anlaufen', () => {
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
  const ipad =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
  const android =
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
  assert.equal(impulseSoundBlocked(iphone, 5), true)
  // Das iPad meldet sich wie ein Mac – nur mit Berührung.
  assert.equal(impulseSoundBlocked(ipad, 5), true)
  assert.equal(impulseSoundBlocked(ipad, 0), false)
  assert.equal(impulseSoundBlocked(android, 5), false)
})

/** Gleich bis auf Rundung – Pixel in Bruchteilen. */
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} statt ${expected}`)

test('impulseEmbedBox: ein Short füllt das Telefon – Titel und Kanal liegen ausserhalb', () => {
  // 390 × 844: Der Short (9:16) wird so gross, dass er die Höhe füllt …
  const phone = impulseEmbedBox(390, 844, 9 / 16)
  near(phone.width, 844 * (9 / 16))
  near(phone.left, (390 - 844 * (9 / 16)) / 2)
  // … und der Rahmen ragt oben und unten um den Saum hinaus.
  near(phone.height, 844 + 2 * EMBED_CHROME_BAND)
  near(phone.top, -EMBED_CHROME_BAND)
})

test('impulseEmbedBox: ganz im Bild, wo Füllen zu viel abschnitte', () => {
  // Ein Short am Rechner: daneben schwarz, nichts abgeschnitten.
  const desktop = impulseEmbedBox(1280, 800, 9 / 16)
  near(desktop.width, 450)
  near(desktop.left, (1280 - 450) / 2)
  near(desktop.top, -EMBED_CHROME_BAND)
  // Ein Querformat hochkant: volle Breite, darüber und darunter schwarz.
  const landscape = impulseEmbedBox(390, 844, 16 / 9)
  near(landscape.width, 390)
  near(landscape.left, 0)
  near(landscape.height, 844 + 2 * EMBED_CHROME_BAND)
  // Ohne Fläche (noch nicht gemessen) bleibt alles, wie es ist.
  assert.deepEqual(impulseEmbedBox(0, 0, 9 / 16), { width: 0, height: 0, left: 0, top: 0 })
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
  // Läuft – das Bild bewegt sich.
  assert.deepEqual(report({ event: 'onStateChange', info: 1 }), { playing: true, running: true })
  // Soll laufen, lädt aber noch: Noch steht das Vorschaubild mit dem Startknopf da.
  assert.deepEqual(report({ event: 'onStateChange', info: 3 }), { playing: true, running: false })
  // Angehalten, noch nicht gestartet (der Browser hat den Ton abgelehnt), bereit.
  for (const state of [2, -1, 5]) {
    assert.deepEqual(report({ event: 'onStateChange', info: state }), {
      playing: false,
      running: false,
    })
  }
  // Zu Ende – ein Short fängt dann von vorn an.
  assert.deepEqual(report({ event: 'onStateChange', info: 0 }), {
    playing: false,
    running: false,
    ended: true,
  })
  assert.deepEqual(report({ event: 'infoDelivery', info: { playerState: 0, currentTime: 58.4 } }), {
    playing: false,
    running: false,
    ended: true,
    time: 58.4,
  })
  assert.deepEqual(
    report({ event: 'infoDelivery', info: { playerState: -1, muted: false, volume: 100 } }),
    { playing: false, running: false, muted: false },
  )
  assert.deepEqual(report({ event: 'infoDelivery', info: { muted: true } }), { muted: true })
  assert.deepEqual(report({ event: 'initialDelivery', info: { playerState: 1 } }), {
    playing: true,
    running: true,
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
  assert.deepEqual(impulseEmbedReport(vimeo, { event: 'pause' }), {
    playing: false,
    running: false,
  })
  assert.deepEqual(impulseEmbedReport(vimeo, { event: 'ended' }), {
    playing: false,
    running: false,
    ended: true,
  })
  // Rückt die Zeit vor, bewegt sich das Bild.
  assert.deepEqual(
    impulseEmbedReport(vimeo, { event: 'timeupdate', data: { seconds: 12.5, duration: 90 } }),
    { time: 12.5, running: true, duration: 90 },
  )
  assert.deepEqual(
    impulseEmbedReport(vimeo, { event: 'timeupdate', data: { seconds: 0, duration: 90 } }),
    { time: 0, duration: 90 },
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
