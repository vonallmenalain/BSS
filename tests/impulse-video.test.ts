import assert from 'node:assert/strict'
import { test } from 'node:test'

import { impulseEmbedUrl, impulseVideoSource } from '../src/lib/impulseVideo.ts'

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
