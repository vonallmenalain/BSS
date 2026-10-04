import assert from 'node:assert/strict'
import { test } from 'node:test'

import { accessOf, notificationAreas } from '../src/lib/access.ts'
import { ADMIN_EMAIL, ASSISTANT_AREA_PATHS, ROLE_LABELS } from '../src/lib/types.ts'
import type { AppUser, Role } from '../src/lib/types.ts'

/*
 * Was ein Konto sieht – die Rechnung hinter `AuthContext`.
 *
 * Sie entscheidet, wohin die App ein Konto führt und ob der Wartebereich
 * erscheint. Dieselben Grenzen setzen die Zugriffsregeln durch
 * (`tests/firestore-rules.test.js`); hier steht, was die Oberfläche daraus macht.
 */

const user = (role: Role | string, patch: Partial<AppUser> = {}): AppUser =>
  ({
    id: 'konto',
    displayName: 'Konto',
    email: 'konto@example.ch',
    role,
    active: true,
    ...patch,
  }) as AppUser

test('«Nur Anti Doom»: der Bereich ohne Haken – und sonst nichts', () => {
  const access = accessOf(user('impulse_only'), 'levin@example.ch')
  assert.equal(access.canViewImpulse, true)
  assert.equal(access.hasAccess, true)
  assert.equal(access.homePath, '/anti-doom')
  assert.equal(access.isApproved, false)
  assert.equal(access.canViewAp, false)
  assert.equal(access.isAssistant, false)
  // Redigieren bleibt am eigenen Schalter.
  assert.equal(access.canEditImpulse, false)
  assert.equal(accessOf(user('impulse_only', { impulseEditor: true }), null).canEditImpulse, true)
  assert.equal(access.unknownRole, false)
})

test('deaktiviert oder wartend heisst draussen – auch mit gesetztem Haken', () => {
  assert.equal(accessOf(user('impulse_only', { active: false }), null).hasAccess, false)
  const waiting = accessOf(user('pending', { impulse: true }), null)
  assert.equal(waiting.canViewImpulse, false)
  assert.equal(waiting.hasAccess, false)
  assert.equal(waiting.homePath, '/')
})

test('Vollzugriff beginnt auf der Übersicht, «Anti Doom» nur mit Haken', () => {
  const secretary = accessOf(user('secretary'), null)
  assert.equal(secretary.isApproved, true)
  assert.equal(secretary.canViewAp, true)
  assert.equal(secretary.homePath, '/')
  assert.equal(secretary.canViewImpulse, false)
  assert.equal(accessOf(user('secretary', { impulse: true }), null).canViewImpulse, true)
})

test('AP-Zugang mit Haken: Kalender und «Anti Doom», zu Hause im Kalender', () => {
  const ap = accessOf(user('ap_viewer', { impulse: true }), null)
  assert.equal(ap.canViewAp, true)
  assert.equal(ap.canEditAp, false)
  assert.equal(ap.canViewImpulse, true)
  assert.equal(ap.homePath, '/ap')
  assert.equal(accessOf(user('ap_editor'), null).canEditAp, true)
})

test('Assistenz: zu Hause im ersten Bereich – ohne Bereich draussen', () => {
  const music = accessOf(user('assistant', { assistantAreas: ['music'] }), null)
  assert.equal(music.isAssistant, true)
  assert.equal(music.homePath, ASSISTANT_AREA_PATHS.music)
  assert.equal(accessOf(user('assistant', { assistantAreas: [] }), null).hasAccess, false)
})

test('das Administrator-Konto sieht «Anti Doom» immer – erkannt an der E-Mail', () => {
  const admin = accessOf(user('bishop'), ADMIN_EMAIL.toUpperCase())
  assert.equal(admin.isAdmin, true)
  assert.equal(admin.canViewImpulse, true)
  assert.equal(admin.canEditImpulse, true)
  assert.equal(accessOf(user('bishop'), 'jemand@example.ch').isAdmin, false)
})

test('eine Rolle, die diese Fassung nicht kennt, ist eine neuere – kein Zugang, aber kein «wartet»', () => {
  const newer = accessOf(user('jugendleitung'), null)
  assert.equal(newer.unknownRole, true)
  assert.equal(newer.hasAccess, false)
  // Jede bekannte Rolle ist bekannt, und ohne Profil gibt es nichts zu kennen.
  for (const role of Object.keys(ROLE_LABELS)) {
    assert.equal(accessOf(user(role), null).unknownRole, false, role)
  }
  const none = accessOf(null, null)
  assert.equal(none.unknownRole, false)
  assert.equal(none.hasAccess, false)
})

/* ------------------------------------------------------------------ */
/* Benachrichtigungen: jede Rolle genau ihre Bereiche                  */
/* ------------------------------------------------------------------ */

const areasOf = (profile: AppUser | null, email: string | null = null) =>
  notificationAreas(accessOf(profile, email))

test('Benachrichtigungen: «Nur Anti Doom» sieht allein «Anti Doom» – keinen Putzplan', () => {
  assert.deepEqual(areasOf(user('impulse_only')), {
    device: true,
    impulse: true,
    ap: false,
    meetings: false,
    cleaning: false,
    any: true,
  })
})

test('Benachrichtigungen: ein AP-Zugang sieht die Termine – keinen Putzplan', () => {
  for (const role of ['ap_editor', 'ap_viewer'] as const) {
    const areas = areasOf(user(role))
    assert.equal(areas.ap, true, role)
    assert.equal(areas.cleaning, false, role)
    assert.equal(areas.meetings, false, role)
    assert.equal(areas.impulse, false, role)
  }
  // Mit Haken kommt «Anti Doom» dazu – der Putzplan bleibt draussen.
  const withImpulse = areasOf(user('ap_viewer', { impulse: true }))
  assert.equal(withImpulse.impulse, true)
  assert.equal(withImpulse.cleaning, false)
})

test('Benachrichtigungen: der Putzplan gehört dem Vollzugriff', () => {
  assert.deepEqual(areasOf(user('secretary')), {
    device: true,
    impulse: false,
    ap: true,
    meetings: true,
    cleaning: true,
    any: true,
  })
})

test('Benachrichtigungen: Assistenz ohne «Anti Doom» und wartende Konten haben nichts', () => {
  assert.equal(areasOf(user('assistant', { assistantAreas: ['music'] })).any, false)
  assert.equal(areasOf(user('assistant', { assistantAreas: ['music'] })).cleaning, false)
  assert.equal(areasOf(user('pending')).any, false)
  assert.equal(areasOf(null).any, false)
})
