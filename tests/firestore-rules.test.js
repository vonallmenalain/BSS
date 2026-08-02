/**
 * Prüft die Zugriffsregeln aus `firestore.rules` gegen den Firestore-Emulator.
 *
 * Diese Tests sind die Absicherung dafür, dass Personendaten nicht an die
 * falschen Augen geraten. Sie laufen bei jeder Änderung an den Regeln in der
 * CI – und erst wenn sie grün sind, werden die Regeln ausgerollt.
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
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'

/** Statusse, die als «noch offen» gelten – wie in src/lib/types.ts. */
const OPEN = ['open', 'in_progress', 'deferred']

const BISHOP = 'uid-bischof'
const COUNSELOR = 'uid-ratgeber'
const SECRETARY = 'uid-sekretaer'
const PENDING = 'uid-wartend'

let testEnv

/** Legt einen Datenbestand an, ohne dass die Regeln greifen. */
async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await setDoc(doc(db, 'users', BISHOP), {
      email: 'bischof@example.ch',
      displayName: 'Bischof',
      role: 'bishop',
      active: true,
    })
    await setDoc(doc(db, 'users', COUNSELOR), {
      email: 'ratgeber@example.ch',
      displayName: 'Ratgeber',
      role: 'counselor',
      active: true,
    })
    await setDoc(doc(db, 'users', SECRETARY), {
      email: 'sekretaer@example.ch',
      displayName: 'Sekretär',
      role: 'secretary',
      active: true,
    })
    await setDoc(doc(db, 'users', PENDING), {
      email: 'wartend@example.ch',
      displayName: 'Wartend',
      role: 'pending',
      active: true,
    })

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
const asCounselor = () => testEnv.authenticatedContext(COUNSELOR).firestore()
const asSecretary = () => testEnv.authenticatedContext(SECRETARY).firestore()
const asPending = () => testEnv.authenticatedContext(PENDING).firestore()
const asAnonymous = () => testEnv.unauthenticatedContext().firestore()

/* ------------------------------------------------------------------ */

describe('Grundlegender Zugang', () => {
  it('weist nicht angemeldete Zugriffe ab', async () => {
    await assertFails(getDocs(collection(asAnonymous(), 'members')))
    await assertFails(getDocs(collection(asAnonymous(), 'agendaItems')))
  })

  it('gibt einem Konto mit der Rolle «pending» keine Daten', async () => {
    await assertFails(getDocs(collection(asPending(), 'members')))
    await assertFails(getDoc(doc(asPending(), 'agendaItems', 'offen')))
  })

  it('lässt ein wartendes Konto trotzdem sein eigenes Profil lesen', async () => {
    // Nötig, damit die App überhaupt merken kann, dass sie warten muss.
    await assertSucceeds(getDoc(doc(asPending(), 'users', PENDING)))
  })

  it('lässt freigeschaltete Konten Mitglieder lesen', async () => {
    await assertSucceeds(getDocs(collection(asBishop(), 'members')))
    await assertSucceeds(getDocs(collection(asSecretary(), 'members')))
  })
})

describe('Vertrauliche Traktanden', () => {
  it('lässt die Leitung vertrauliche Traktanden lesen', async () => {
    await assertSucceeds(getDoc(doc(asBishop(), 'agendaItems', 'vertraulich')))
    await assertSucceeds(getDoc(doc(asCounselor(), 'agendaItems', 'vertraulich')))
  })

  it('verwehrt Sekretären den gezielten Zugriff', async () => {
    await assertFails(getDoc(doc(asSecretary(), 'agendaItems', 'vertraulich')))
  })

  it('weist ungefilterte Abfragen von Sekretären ab', async () => {
    // Der entscheidende Fall: Ohne diesen Schutz liefert eine Abfrage über alle
    // offenen Traktanden auch die vertraulichen mit aus.
    await assertFails(
      getDocs(query(collection(asSecretary(), 'agendaItems'), where('status', 'in', OPEN))),
    )
  })

  it('lässt Sekretäre mit Vertraulichkeitsfilter abfragen', async () => {
    const snapshot = await assertSucceeds(
      getDocs(
        query(
          collection(asSecretary(), 'agendaItems'),
          where('status', 'in', OPEN),
          where('confidential', '==', false),
        ),
      ),
    )
    if (snapshot.size !== 1 || snapshot.docs[0].id !== 'offen') {
      throw new Error(
        `Erwartet: nur «offen». Erhalten: ${snapshot.docs.map((d) => d.id).join(', ') || 'nichts'}`,
      )
    }
  })

  it('lässt die Leitung ohne Filter alles sehen', async () => {
    const snapshot = await assertSucceeds(
      getDocs(query(collection(asBishop(), 'agendaItems'), where('status', 'in', OPEN))),
    )
    if (snapshot.size !== 2) {
      throw new Error(`Erwartet: 2 Traktanden. Erhalten: ${snapshot.size}`)
    }
  })

  it('hindert Sekretäre daran, ein vertrauliches Traktandum anzulegen', async () => {
    await assertFails(
      setDoc(doc(asSecretary(), 'agendaItems', 'neu'), {
        title: 'Versuch',
        confidential: true,
        status: 'open',
        meetingId: null,
        order: 1,
      }),
    )
  })

  it('hindert Sekretäre daran, ein Traktandum nachträglich als vertraulich zu markieren', async () => {
    await assertFails(updateDoc(doc(asSecretary(), 'agendaItems', 'offen'), { confidential: true }))
  })

  it('erlaubt Sekretären das Bearbeiten offener Traktanden', async () => {
    await assertSucceeds(
      updateDoc(doc(asSecretary(), 'agendaItems', 'offen'), { title: 'Budget angepasst' }),
    )
  })
})

describe('Rollen und Rechteausweitung', () => {
  it('hindert einen Sekretär daran, sich selbst zu befördern', async () => {
    await assertFails(updateDoc(doc(asSecretary(), 'users', SECRETARY), { role: 'bishop' }))
  })

  it('hindert einen Sekretär daran, fremde Rollen zu ändern', async () => {
    await assertFails(updateDoc(doc(asSecretary(), 'users', PENDING), { role: 'secretary' }))
  })

  it('hindert ein wartendes Konto daran, sich selbst freizuschalten', async () => {
    await assertFails(updateDoc(doc(asPending(), 'users', PENDING), { role: 'bishop' }))
  })

  it('lässt die Leitung Rollen vergeben', async () => {
    await assertSucceeds(updateDoc(doc(asBishop(), 'users', PENDING), { role: 'secretary' }))
    // Zustand für die übrigen Tests zurücksetzen
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', PENDING), { role: 'pending' })
    })
  })

  it('erlaubt das Ändern des eigenen Anzeigenamens', async () => {
    await assertSucceeds(
      updateDoc(doc(asSecretary(), 'users', SECRETARY), { displayName: 'Neuer Name' }),
    )
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

describe('Einstellungen', () => {
  it('lässt alle Freigeschalteten die Einstellungen lesen', async () => {
    await assertSucceeds(getDoc(doc(asSecretary(), 'settings', 'app')))
  })

  it('lässt nur die Leitung Einstellungen ändern', async () => {
    await assertFails(setDoc(doc(asSecretary(), 'settings', 'app'), { wardName: 'Test' }))
    await assertSucceeds(setDoc(doc(asBishop(), 'settings', 'app'), { wardName: 'Gemeinde' }))
  })
})

describe('Mitglieder', () => {
  it('lässt Sekretäre Mitglieder bearbeiten', async () => {
    await assertSucceeds(updateDoc(doc(asSecretary(), 'members', 'mitglied-1'), { city: 'Bern' }))
  })

  it('lässt nur die Leitung Mitglieder löschen', async () => {
    const { deleteDoc } = await import('firebase/firestore')
    await assertFails(deleteDoc(doc(asSecretary(), 'members', 'mitglied-1')))
  })
})
