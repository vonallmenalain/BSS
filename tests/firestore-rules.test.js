/**
 * Prüft die Zugriffsregeln aus `firestore.rules` gegen den Firestore-Emulator.
 *
 * Diese Tests sind die Absicherung dafür, dass Personendaten nicht an die
 * falschen Augen geraten. Sie laufen bei jeder Änderung an den Regeln in der
 * CI – und erst wenn sie grün sind, werden die Regeln ausgerollt.
 *
 * Die entscheidende Trennlinie verläuft zwischen `pending` und allen übrigen
 * Rollen: Wer freigeschaltet ist, sieht und darf alles. Wer wartet, sieht nichts.
 *
 * Ausführen:  npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

/** Statusse, die als «noch offen» gelten – wie in src/lib/types.ts. */
const OPEN = ['open', 'in_progress', 'deferred']

const BISHOP = 'uid-bischof'
const COUNSELOR1 = 'uid-ratgeber-1'
const COUNSELOR2 = 'uid-ratgeber-2'
const LEGACY_COUNSELOR = 'uid-ratgeber-alt'
const SECRETARY = 'uid-sekretaer'
const PENDING = 'uid-wartend'

let testEnv

/** Legt einen Datenbestand an, ohne dass die Regeln greifen. */
async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    const users = [
      [BISHOP, 'bishop', 'Bischof'],
      [COUNSELOR1, 'counselor1', '1. Ratgeber'],
      [COUNSELOR2, 'counselor2', '2. Ratgeber'],
      [LEGACY_COUNSELOR, 'counselor', 'Ratgeber (alte Rolle)'],
      [SECRETARY, 'secretary', 'Sekretär'],
      [PENDING, 'pending', 'Wartend'],
    ]
    for (const [uid, role, displayName] of users) {
      await setDoc(doc(db, 'users', uid), {
        email: `${uid}@example.ch`,
        displayName,
        role,
        active: true,
      })
    }

    const baseItem = {
      meetingId: null,
      status: 'open',
      order: 100,
      priority: 'normal',
      category: 'general',
      assignees: [],
      memberRefs: [],
      dueDate: null,
      deferCount: 0,
      notes: [],
      history: [],
    }

    await setDoc(doc(db, 'agendaItems', 'offen'), {
      ...baseItem,
      title: 'Jugendlager Budget',
      confidential: false,
    })
    await setDoc(doc(db, 'agendaItems', 'vertraulich'), {
      ...baseItem,
      title: 'Seelsorgerisches Anliegen',
      confidential: true,
    })

    await setDoc(doc(db, 'members', 'mitglied-1'), {
      firstName: 'Peter',
      lastName: 'Meier',
      status: 'active',
    })

    await setDoc(doc(db, 'sacramentMeetings', '2026-08-09'), {
      kind: 'regular',
      announcements: [],
      business: [],
      musicalNumbers: [],
      hymns: {},
      programOrder: [],
    })
    await setDoc(doc(db, 'prayers', '2026-08-09_opening'), {
      slot: 'opening',
      memberId: 'mitglied-1',
      memberName: 'Peter Meier',
    })
    await setDoc(doc(db, 'hymns', '2'), { number: 2, title: 'Der Geist aus den Höhen' })

    await setDoc(doc(db, 'notes', 'notiz-1'), {
      title: 'Gemeindeausflug',
      body: 'Termin mit der JD absprechen.',
    })
  })
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'bss-rules-test',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
  await testEnv.clearFirestore()
  await seed()
})

after(async () => {
  await testEnv?.cleanup()
})

const asBishop = () => testEnv.authenticatedContext(BISHOP).firestore()
const asCounselor1 = () => testEnv.authenticatedContext(COUNSELOR1).firestore()
const asCounselor2 = () => testEnv.authenticatedContext(COUNSELOR2).firestore()
const asLegacyCounselor = () => testEnv.authenticatedContext(LEGACY_COUNSELOR).firestore()
const asSecretary = () => testEnv.authenticatedContext(SECRETARY).firestore()
const asPending = () => testEnv.authenticatedContext(PENDING).firestore()
const asAnonymous = () => testEnv.unauthenticatedContext().firestore()

/* ------------------------------------------------------------------ */

describe('Grundlegender Zugang', () => {
  it('weist nicht angemeldete Zugriffe ab', async () => {
    await assertFails(getDocs(collection(asAnonymous(), 'members')))
    await assertFails(getDocs(collection(asAnonymous(), 'agendaItems')))
    await assertFails(getDocs(collection(asAnonymous(), 'sacramentMeetings')))
  })

  it('gibt einem Konto mit der Rolle «pending» keine Daten', async () => {
    await assertFails(getDocs(collection(asPending(), 'members')))
    await assertFails(getDoc(doc(asPending(), 'agendaItems', 'offen')))
    await assertFails(getDoc(doc(asPending(), 'sacramentMeetings', '2026-08-09')))
    await assertFails(getDocs(collection(asPending(), 'prayers')))
    await assertFails(getDocs(collection(asPending(), 'hymns')))
  })

  it('lässt ein wartendes Konto trotzdem sein eigenes Profil lesen', async () => {
    // Nötig, damit die App überhaupt merken kann, dass sie warten muss.
    await assertSucceeds(getDoc(doc(asPending(), 'users', PENDING)))
  })

  it('lässt jede freigeschaltete Rolle Mitglieder lesen', async () => {
    for (const as of [asBishop, asCounselor1, asCounselor2, asLegacyCounselor, asSecretary]) {
      await assertSucceeds(getDocs(collection(as(), 'members')))
    }
  })
})

describe('Alle Rollen sehen denselben Bestand', () => {
  it('lässt auch Sekretäre vertrauliche Traktanden lesen', async () => {
    await assertSucceeds(getDoc(doc(asSecretary(), 'agendaItems', 'vertraulich')))
    await assertSucceeds(getDoc(doc(asCounselor2(), 'agendaItems', 'vertraulich')))
  })

  it('lässt ungefilterte Abfragen für jede Rolle zu', async () => {
    for (const as of [asBishop, asCounselor1, asSecretary]) {
      const snapshot = await assertSucceeds(
        getDocs(query(collection(as(), 'agendaItems'), where('status', 'in', OPEN))),
      )
      if (snapshot.size !== 2) {
        throw new Error(`Erwartet: 2 Traktanden. Erhalten: ${snapshot.size}`)
      }
    }
  })

  it('lässt Sekretäre vertrauliche Traktanden anlegen und bearbeiten', async () => {
    await assertSucceeds(
      setDoc(doc(asSecretary(), 'agendaItems', 'neu'), {
        title: 'Neuer Eintrag',
        confidential: true,
        status: 'open',
        meetingId: null,
        order: 1,
      }),
    )
    await assertSucceeds(
      updateDoc(doc(asSecretary(), 'agendaItems', 'offen'), { title: 'Budget angepasst' }),
    )
  })

  it('lässt jede Rolle Einstellungen ändern', async () => {
    await assertSucceeds(setDoc(doc(asSecretary(), 'settings', 'app'), { wardName: 'Gemeinde' }))
    await assertSucceeds(setDoc(doc(asBishop(), 'settings', 'app'), { wardName: 'Gemeinde' }))
  })

  it('verwehrt wartenden Konten das Schreiben', async () => {
    await assertFails(setDoc(doc(asPending(), 'settings', 'app'), { wardName: 'Test' }))
    await assertFails(updateDoc(doc(asPending(), 'members', 'mitglied-1'), { city: 'Bern' }))
  })

  it('lässt jede Rolle Notizen lesen und schreiben – und wartende Konten nicht', async () => {
    // Notizen gehören der ganzen Bischofschaft; es gibt keine private Notiz.
    await assertSucceeds(getDoc(doc(asSecretary(), 'notes', 'notiz-1')))
    await assertSucceeds(updateDoc(doc(asCounselor2(), 'notes', 'notiz-1'), { body: 'Erledigt.' }))
    await assertFails(getDocs(collection(asPending(), 'notes')))
    await assertFails(setDoc(doc(asPending(), 'notes', 'notiz-2'), { title: 'Versuch', body: '' }))
    await assertFails(getDocs(collection(asAnonymous(), 'notes')))
  })

  it('lässt Sekretäre Mitglieder bearbeiten und löschen', async () => {
    await assertSucceeds(updateDoc(doc(asSecretary(), 'members', 'mitglied-1'), { city: 'Bern' }))
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'members', 'mitglied-weg'), { lastName: 'Test' })
    })
    await assertSucceeds(deleteDoc(doc(asSecretary(), 'members', 'mitglied-weg')))
  })
})

describe('Abendmahlsversammlung', () => {
  it('lässt jede freigeschaltete Rolle das Programm lesen und schreiben', async () => {
    await assertSucceeds(getDoc(doc(asSecretary(), 'sacramentMeetings', '2026-08-09')))
    await assertSucceeds(
      setDoc(
        doc(asCounselor1(), 'sacramentMeetings', '2026-08-16'),
        { kind: 'fast_testimony' },
        { merge: true },
      ),
    )
  })

  it('lässt Gebete und Lieder pflegen', async () => {
    await assertSucceeds(
      setDoc(
        doc(asSecretary(), 'prayers', '2026-08-09_closing'),
        { slot: 'closing', memberId: 'mitglied-1', memberName: 'Peter Meier' },
        { merge: true },
      ),
    )
    await assertSucceeds(
      setDoc(doc(asSecretary(), 'hymns', '3'), { number: 3, title: 'Kommt, Heilige' }),
    )
    await assertFails(setDoc(doc(asPending(), 'hymns', '4'), { number: 4, title: 'Versuch' }))
  })
})

describe('Rollen und Rechteausweitung', () => {
  it('hindert ein wartendes Konto daran, sich selbst freizuschalten', async () => {
    await assertFails(updateDoc(doc(asPending(), 'users', PENDING), { role: 'bishop' }))
    await assertFails(updateDoc(doc(asPending(), 'users', PENDING), { active: true, role: 'secretary' }))
  })

  it('lässt ein wartendes Konto den eigenen Namen ändern', async () => {
    await assertSucceeds(updateDoc(doc(asPending(), 'users', PENDING), { displayName: 'Wartend B' }))
  })

  it('erlaubt jeder freigeschalteten Person, ihre eigene Rolle zu setzen', async () => {
    // Genau dafür ist die Regel da: Wer als Bischof angelegt wurde, aber
    // 1. Ratgeber ist, korrigiert das selbst.
    await assertSucceeds(updateDoc(doc(asSecretary(), 'users', SECRETARY), { role: 'counselor2' }))
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', SECRETARY), { role: 'secretary' })
    })
  })

  it('lässt jede freigeschaltete Rolle wartende Konten freischalten', async () => {
    await assertSucceeds(updateDoc(doc(asSecretary(), 'users', PENDING), { role: 'secretary' }))
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', PENDING), { role: 'pending' })
    })
  })

  it('lässt ein neues Konto nur ein Profil mit der Rolle «pending» anlegen', async () => {
    const neu = testEnv.authenticatedContext('uid-neu').firestore()
    await assertFails(
      setDoc(doc(neu, 'users', 'uid-neu'), {
        email: 'neu@example.ch',
        displayName: 'Neu',
        role: 'bishop',
        active: true,
      }),
    )
    await assertSucceeds(
      setDoc(doc(neu, 'users', 'uid-neu'), {
        email: 'neu@example.ch',
        displayName: 'Neu',
        role: 'pending',
        active: true,
      }),
    )
  })

  it('lässt niemanden das Profil einer anderen Person anlegen', async () => {
    const fremd = testEnv.authenticatedContext('uid-fremd').firestore()
    await assertFails(
      setDoc(doc(fremd, 'users', 'uid-opfer'), {
        email: 'opfer@example.ch',
        displayName: 'Opfer',
        role: 'pending',
        active: true,
      }),
    )
  })
})
