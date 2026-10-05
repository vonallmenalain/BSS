import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { APP_IDENTITIES, appIdentityFor } from '../src/lib/appIdentity.ts'

/*
 * Welche App sich aufs Telefon legt (src/lib/appIdentity.ts) – und ob es
 * die Manifeste und Symbole dazu wirklich gibt.
 */

const none = { isApproved: false, isAssistant: false, canViewAp: false, canViewImpulse: false }
const full = { ...none, isApproved: true }
const apViewer = { ...none, canViewAp: true }
const antiDoomOnly = { ...none, canViewImpulse: true }

test('Vollzugriff und Assistenz: die App der Bischofschaft – überall', () => {
  for (const pathname of ['/', '/sitzungen', '/putzplan', '/ap', '/anti-doom']) {
    assert.equal(appIdentityFor({ ...full, pathname }), 'bischofschaft', pathname)
  }
  assert.equal(
    appIdentityFor({ ...none, isAssistant: true, pathname: '/abendmahl' }),
    'bischofschaft',
  )
})

test("AP-Rollen: die App der AP's – auch auf den Anschlagbrettern", () => {
  for (const access of [apViewer, antiDoomOnly]) {
    for (const pathname of ['/ap', '/anti-doom', '/putzplan']) {
      assert.equal(appIdentityFor({ ...access, pathname }), 'ap', pathname)
    }
  }
})

test('Ohne Konto: das Anschlagbrett, auf dem man steht', () => {
  assert.equal(appIdentityFor({ ...none, pathname: '/putzplan' }), 'putzplan')
  assert.equal(appIdentityFor({ ...none, pathname: '/putzplan/gruppe/3' }), 'putzplan')
  assert.equal(appIdentityFor({ ...none, pathname: '/ap' }), 'kalender')
  assert.equal(appIdentityFor({ ...none, pathname: '/ap/2026-10' }), 'kalender')
  // Kein Anschlagbrett: die Anmeldung, und eine Adresse, die nur so anfängt.
  assert.equal(appIdentityFor({ ...none, pathname: '/anmelden' }), 'bischofschaft')
  assert.equal(appIdentityFor({ ...none, pathname: '/apfel' }), 'bischofschaft')
})

test('Die Vorschau des öffentlichen Putzplans zeigt, was ohne Konto installiert würde', () => {
  assert.equal(
    appIdentityFor({ ...full, pathname: '/putzplan', putzplanPreview: true }),
    'putzplan',
  )
})

const publicFile = (path: string) => new URL(`../public${path}`, import.meta.url)

test('Manifeste: eigene Kennung, eigener Name – und jedes Symbol gibt es', () => {
  const ids = new Set<string>()
  for (const [key, identity] of Object.entries(APP_IDENTITIES)) {
    assert.ok(existsSync(publicFile(identity.appleTouchIcon)), `${key}: ${identity.appleTouchIcon}`)
    if (!identity.manifest) continue
    const manifest = JSON.parse(readFileSync(publicFile(identity.manifest), 'utf8')) as {
      id: string
      name: string
      short_name: string
      start_url: string
      scope: string
      icons: { src: string; purpose: string }[]
    }
    assert.ok(!ids.has(manifest.id), `doppelte Kennung ${manifest.id}`)
    ids.add(manifest.id)
    assert.equal(manifest.short_name, identity.title, `${key}: Name wie auf dem iPhone`)
    assert.ok(manifest.start_url.startsWith(manifest.scope), `${key}: Start im eigenen Bereich`)
    assert.ok(
      manifest.icons.some((icon) => icon.purpose === 'maskable'),
      `${key}: maskable`,
    )
    for (const icon of manifest.icons) {
      assert.ok(existsSync(publicFile(icon.src)), `${key}: ${icon.src}`)
    }
  }
})
