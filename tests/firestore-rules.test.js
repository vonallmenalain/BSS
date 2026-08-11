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

/** Status, die als «noch offen» gelten – wie in src/lib/types.ts. */
const OPEN = ['new', 'pending']

const BISHOP = 'uid-bischof'
const COUNSELOR1 = 'uid-ratgeber-1'
const COUNSELOR2 = 'uid-ratgeber-2'
const LEGACY_COUNSELOR = 'uid-ratgeber-alt'
const SECRETARY = 'uid-sekretaer'
const AP_EDITOR = 'uid-ap-schreibend'
const AP_VIEWER = 'uid-ap-lesend'
const PENDING = 'uid-wartend'

/** Die Anmelde-E-Mail des Administrator-Kontos – wie in firestore.rules. */
const ADMIN_EMAIL = 'alain.sc2@gmail.com'

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
      [AP_EDITOR, 'ap_editor', 'Berater (schreibend)'],
      [AP_VIEWER, 'ap_viewer', 'Berater (lesend)'],
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
      kind: 'traktandum',
      status: 'pending',
      order: 100,
      assignees: [],
      memberRefs: [],
      deferCount: 0,
      history: [],
    }

    await setDoc(doc(db, 'agendaItems', 'offen'), {
      ...baseItem,
      title: 'Jugendlager Budget',
    })
    await setDoc(doc(db, 'agendaItems', 'seelsorge'), {
      ...baseItem,
      kind: 'pendenz',
      title: 'Seelsorgerisches Anliegen',
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

    await setDoc(doc(db, 'announcementSeries', 'serie-1'), {
      text: 'Tempeltag der Gemeinde',
      rhythm: 'monthly',
      weeks: [3],
      startDate: '2026-01-01',
      endDate: null,
      skipDates: [],
      source: 'manual',
    })

    await setDoc(doc(db, 'monthlyDuties', 'monatspendenz-1'), {
      title: 'Ansprachen für den Monat anfragen',
      description: '',
      startMonth: '2026-01',
      endMonth: null,
    })

    await setDoc(doc(db, 'cleaningWeeks', '2026-06-29'), {
      startDate: '2026-06-29',
      endDate: '2026-07-04',
      group: 'Gruppe 2',
      team: 'Muster Hans & Anna',
      note: '',
    })

    await setDoc(doc(db, 'apActivities', 'aktivitaet-1'), {
      date: '2026-01-07',
      endDate: null,
      kind: 'activity',
      title: 'Bouldern',
      location: 'Gemeindehaus',
      leader: 'Carden',
      bishopric: '',
      advisor: '',
      note: '',
    })
    await setDoc(doc(db, 'apMonths', '2026-01'), {
      month: '2026-01',
      leadership: 'Leitung Lehrer',
    })

    await setDoc(doc(db, 'calendarFeeds', 'abo-berater'), {
      token: 'geheimes-token',
      label: 'Berater',
      kinds: [],
      active: true,
    })

    await setDoc(doc(db, 'settings', 'app'), { wardName: 'Burgdorf' })

    // Zugriffsprotokoll: ein Besuch und eine Änderung des Sekretärs.
    await setDoc(doc(db, 'accessLog', 'besuch-sekretaer'), {
      kind: 'session',
      uid: SECRETARY,
      email: `${SECRETARY}@example.ch`,
      displayName: 'Sekretär',
      at: new Date('2026-08-11T19:00:00Z'),
      endedAt: new Date('2026-08-11T19:30:00Z'),
      views: 3,
    })
    await setDoc(doc(db, 'accessLog', 'aenderung-sekretaer'), {
      kind: 'change',
      uid: SECRETARY,
      email: `${SECRETARY}@example.ch`,
      displayName: 'Sekretär',
      at: new Date('2026-08-11T19:05:00Z'),
      collectionId: 'agendaItems',
      op: 'update',
      label: 'Jugendlager Budget',
      fields: ['Titel'],
      count: 1,
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

// Der Bischof ist zugleich das Administrator-Konto: Sein Token trägt die
// Admin-E-Mail. Nur sie zählt für die Benutzerverwaltung – nicht die Rolle.
const asBishop = () => testEnv.authenticatedContext(BISHOP, { email: ADMIN_EMAIL }).firestore()
const asCounselor1 = () => testEnv.authenticatedContext(COUNSELOR1).firestore()
const asCounselor2 = () => testEnv.authenticatedContext(COUNSELOR2).firestore()
const asLegacyCounselor = () => testEnv.authenticatedContext(LEGACY_COUNSELOR).firestore()
const asSecretary = () => testEnv.authenticatedContext(SECRETARY).firestore()
const asApEditor = () => testEnv.authenticatedContext(AP_EDITOR).firestore()
const asApViewer = () => testEnv.authenticatedContext(AP_VIEWER).firestore()
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
  it('lässt auch Sekretäre seelsorgerische Traktanden lesen', async () => {
    await assertSucceeds(getDoc(doc(asSecretary(), 'agendaItems', 'seelsorge')))
    await assertSucceeds(getDoc(doc(asCounselor2(), 'agendaItems', 'seelsorge')))
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

  it('lässt Sekretäre Traktanden anlegen und bearbeiten', async () => {
    await assertSucceeds(
      setDoc(doc(asSecretary(), 'agendaItems', 'neu'), {
        title: 'Neuer Eintrag',
        kind: 'traktandum',
        status: 'new',
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

  it('lässt jede Rolle wiederkehrende Bekanntmachungen führen – und wartende Konten nicht', async () => {
    // Eine Serie gilt für viele Sonntage zugleich; sie gehört wie die
    // Programme selbst der ganzen Bischofschaft.
    await assertSucceeds(getDoc(doc(asSecretary(), 'announcementSeries', 'serie-1')))
    await assertSucceeds(
      updateDoc(doc(asCounselor2(), 'announcementSeries', 'serie-1'), {
        skipDates: ['2026-08-16'],
      }),
    )
    await assertFails(getDocs(collection(asPending(), 'announcementSeries')))
    await assertFails(setDoc(doc(asPending(), 'announcementSeries', 'serie-2'), { text: 'x' }))
    await assertFails(getDocs(collection(asAnonymous(), 'announcementSeries')))
  })

  it('lässt jede Rolle die Monatspendenzen führen – und wartende Konten nicht', async () => {
    // Die Vorlage gilt für jeden Monat und für jede Person, die einen
    // führt; sie gehört wie die Pendenzen selbst der ganzen Bischofschaft.
    await assertSucceeds(getDoc(doc(asSecretary(), 'monthlyDuties', 'monatspendenz-1')))
    await assertSucceeds(
      updateDoc(doc(asCounselor2(), 'monthlyDuties', 'monatspendenz-1'), { endMonth: '2026-09' }),
    )
    await assertFails(getDocs(collection(asPending(), 'monthlyDuties')))
    await assertFails(setDoc(doc(asPending(), 'monthlyDuties', 'versuch'), { title: 'x' }))
    await assertFails(getDocs(collection(asAnonymous(), 'monthlyDuties')))
  })

  it('lässt jede Rolle den Putzplan führen – und wartende Konten nicht', async () => {
    await assertSucceeds(getDoc(doc(asSecretary(), 'cleaningWeeks', '2026-06-29')))
    await assertSucceeds(
      updateDoc(doc(asBishop(), 'cleaningWeeks', '2026-06-29'), { note: 'Generalkonf.' }),
    )
    await assertFails(getDocs(collection(asPending(), 'cleaningWeeks')))
    await assertFails(setDoc(doc(asPending(), 'cleaningWeeks', '2026-07-06'), { team: 'Versuch' }))
    await assertFails(getDocs(collection(asAnonymous(), 'cleaningWeeks')))
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
    await assertFails(
      updateDoc(doc(asPending(), 'users', PENDING), { active: true, role: 'secretary' }),
    )
  })

  it('lässt ein wartendes Konto den eigenen Namen ändern', async () => {
    await assertSucceeds(
      updateDoc(doc(asPending(), 'users', PENDING), { displayName: 'Wartend B' }),
    )
  })

  it('lässt nur den Administrator Rollen ändern – auch die eigene nicht', async () => {
    // Benutzerverwaltung ist dem Administrator-Konto vorbehalten. Ein
    // freigeschaltetes Konto kann weder die eigene noch eine fremde Rolle
    // setzen – sonst genügte ein kompromittiertes Konto, um alle zu übernehmen.
    await assertFails(updateDoc(doc(asSecretary(), 'users', SECRETARY), { role: 'counselor2' }))
    await assertFails(updateDoc(doc(asSecretary(), 'users', PENDING), { role: 'secretary' }))
    await assertFails(updateDoc(doc(asCounselor1(), 'users', BISHOP), { active: false }))
  })

  it('lässt den Administrator freischalten, Rollen ändern und deaktivieren', async () => {
    await assertSucceeds(updateDoc(doc(asBishop(), 'users', PENDING), { role: 'secretary' }))
    await assertSucceeds(updateDoc(doc(asBishop(), 'users', SECRETARY), { active: false }))
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', PENDING), { role: 'pending' })
      await updateDoc(doc(context.firestore(), 'users', SECRETARY), { active: true })
    })
  })

  it('lässt nur den Administrator Profile löschen', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'uid-weg'), {
        email: 'weg@example.ch',
        displayName: 'Weg',
        role: 'pending',
        active: true,
      })
    })
    await assertFails(deleteDoc(doc(asSecretary(), 'users', 'uid-weg')))
    await assertFails(deleteDoc(doc(asPending(), 'users', PENDING)))
    await assertSucceeds(deleteDoc(doc(asBishop(), 'users', 'uid-weg')))
  })

  it('lässt Freigeschaltete das eigene Profil pflegen, ohne Rolle und Status', async () => {
    // Name, Mitglieder-Verknüpfung und Ansichts-Einstellungen bleiben
    // Selbstbedienung – nur Rolle und Aktivstatus sind tabu.
    await assertSucceeds(
      updateDoc(doc(asSecretary(), 'users', SECRETARY), { displayName: 'Sekretär B' }),
    )
    await assertFails(updateDoc(doc(asSecretary(), 'users', SECRETARY), { active: false }))
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

/* ------------------------------------------------------------------ */

/*
 * Der AP-Kalender ist der einzige Bereich, der über die Bischofschaft
 * hinaus geteilt wird. Die Regeln müssen deshalb zwei Dinge zugleich
 * leisten: den Kalender öffnen und alles andere zuhalten. Genau das prüfen
 * die folgenden Tests – und zwar in beide Richtungen, denn ein Zugang, der
 * versehentlich die Mitgliederliste mitbringt, wäre der teuerste Fehler in
 * dieser Datenbank.
 */
describe('Aktivitäten AP', () => {
  it('lässt beide AP-Rollen den Kalender lesen', async () => {
    for (const as of [asApEditor, asApViewer]) {
      await assertSucceeds(getDocs(collection(as(), 'apActivities')))
      await assertSucceeds(getDoc(doc(as(), 'apActivities', 'aktivitaet-1')))
      await assertSucceeds(getDocs(collection(as(), 'apMonths')))
    }
  })

  it('lässt die schreibende AP-Rolle Termine anlegen und ändern', async () => {
    await assertSucceeds(
      setDoc(doc(asApEditor(), 'apActivities', 'aktivitaet-2'), {
        date: '2026-01-14',
        endDate: null,
        kind: 'activity',
        title: 'Gamenight',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(asApEditor(), 'apActivities', 'aktivitaet-1'), { title: 'Klettern' }),
    )
    await assertSucceeds(
      setDoc(
        doc(asApEditor(), 'apMonths', '2026-02'),
        { month: '2026-02', leadership: 'Leitung Priester' },
        { merge: true },
      ),
    )
    await assertSucceeds(deleteDoc(doc(asApEditor(), 'apActivities', 'aktivitaet-2')))
  })

  it('verwehrt der lesenden AP-Rolle jedes Schreiben', async () => {
    await assertFails(
      updateDoc(doc(asApViewer(), 'apActivities', 'aktivitaet-1'), { title: 'Umbenannt' }),
    )
    await assertFails(
      setDoc(doc(asApViewer(), 'apActivities', 'neu'), { date: '2026-03-04', kind: 'activity' }),
    )
    await assertFails(deleteDoc(doc(asApViewer(), 'apActivities', 'aktivitaet-1')))
    await assertFails(
      setDoc(doc(asApViewer(), 'apMonths', '2026-03'), { month: '2026-03', leadership: 'Versuch' }),
    )
  })

  it('hält beide AP-Rollen von allem Übrigen fern', async () => {
    for (const as of [asApEditor, asApViewer]) {
      await assertFails(getDocs(collection(as(), 'members')))
      await assertFails(getDoc(doc(as(), 'members', 'mitglied-1')))
      await assertFails(getDoc(doc(as(), 'agendaItems', 'offen')))
      await assertFails(getDocs(collection(as(), 'talks')))
      await assertFails(getDoc(doc(as(), 'sacramentMeetings', '2026-08-09')))
      await assertFails(getDocs(collection(as(), 'prayers')))
      await assertFails(getDocs(collection(as(), 'callings')))
      await assertFails(getDocs(collection(as(), 'notes')))
      await assertFails(getDocs(collection(as(), 'cleaningWeeks')))
      await assertFails(getDocs(collection(as(), 'monthlyDuties')))
      await assertFails(getDocs(collection(as(), 'meetings')))
      // Die Benutzerliste bleibt zu – das eigene Profil bleibt lesbar.
      await assertFails(getDocs(collection(as(), 'users')))
      await assertFails(getDoc(doc(as(), 'users', BISHOP)))
    }
    await assertSucceeds(getDoc(doc(asApEditor(), 'users', AP_EDITOR)))
  })

  /*
   * Bei den Kalender-Abos verläuft die Grenze zwischen Lesen und Schreiben.
   *
   * Lesen darf beides, was den Plan sieht: Wer ihn ansehen darf, darf ihn
   * sich auch in den eigenen Kalender holen, und dafür braucht er den Link.
   * Vergeben, widerrufen und löschen bleibt dem Schreibrecht – ein Link
   * trägt die Berechtigung im Token, und wer bloss zusieht, soll keine neuen
   * ausstellen und keine bestehenden abschalten können.
   */
  describe('Kalender-Abos', () => {
    it('lässt die schreibende AP-Rolle Links lesen und vergeben', async () => {
      await assertSucceeds(getDocs(collection(asApEditor(), 'calendarFeeds')))
      await assertSucceeds(
        setDoc(doc(asApEditor(), 'calendarFeeds', 'abo-neu'), {
          token: 'noch-ein-token',
          label: 'Jugendführung',
          kinds: ['special'],
          active: true,
        }),
      )
      await assertSucceeds(
        updateDoc(doc(asApEditor(), 'calendarFeeds', 'abo-neu'), { active: false }),
      )
      await assertSucceeds(deleteDoc(doc(asApEditor(), 'calendarFeeds', 'abo-neu')))
    })

    it('lässt die nur lesende AP-Rolle bestehende Links lesen', async () => {
      // Damit sie sich einen kopieren und im eigenen Kalender einrichten kann.
      await assertSucceeds(getDocs(collection(asApViewer(), 'calendarFeeds')))
      await assertSucceeds(getDoc(doc(asApViewer(), 'calendarFeeds', 'abo-berater')))
    })

    it('lässt die nur lesende AP-Rolle keine Links ausstellen oder abschalten', async () => {
      await assertFails(
        setDoc(doc(asApViewer(), 'calendarFeeds', 'versuch'), {
          token: 'selbst-gemacht',
          label: 'Versuch',
          active: true,
        }),
      )
      await assertFails(
        updateDoc(doc(asApViewer(), 'calendarFeeds', 'abo-berater'), { active: false }),
      )
      // Auch nicht bloss umbenennen – Schreiben ist Schreiben.
      await assertFails(
        updateDoc(doc(asApViewer(), 'calendarFeeds', 'abo-berater'), { label: 'Meiner' }),
      )
      await assertFails(deleteDoc(doc(asApViewer(), 'calendarFeeds', 'abo-berater')))
    })

    it('lässt den Vollzugriff die Links ebenfalls führen', async () => {
      await assertSucceeds(getDocs(collection(asBishop(), 'calendarFeeds')))
      await assertSucceeds(
        updateDoc(doc(asSecretary(), 'calendarFeeds', 'abo-berater'), { label: 'Berater AP' }),
      )
    })

    it('gibt wartenden und angemeldeten Fremden gar nichts', async () => {
      await assertFails(getDocs(collection(asPending(), 'calendarFeeds')))
      await assertFails(getDoc(doc(asPending(), 'calendarFeeds', 'abo-berater')))
      await assertFails(getDocs(collection(asAnonymous(), 'calendarFeeds')))
      await assertFails(getDoc(doc(asAnonymous(), 'calendarFeeds', 'abo-berater')))
    })

    it('lässt Nichtangemeldete kein Token über eine Abfrage erraten', async () => {
      // Der Weg, den die Function geht – aber ohne Dienstkonto verschlossen.
      await assertFails(
        getDocs(
          query(collection(asAnonymous(), 'calendarFeeds'), where('token', '==', 'geheimes-token')),
        ),
      )
      await assertFails(
        getDocs(
          query(collection(asPending(), 'calendarFeeds'), where('token', '==', 'geheimes-token')),
        ),
      )
    })
  })

  it('lässt die AP-Rollen die Einstellungen lesen, aber nicht ändern', async () => {
    // Der Name der Gemeinde steht in der Kopfzeile der App.
    await assertSucceeds(getDoc(doc(asApViewer(), 'settings', 'app')))
    await assertFails(setDoc(doc(asApEditor(), 'settings', 'app'), { wardName: 'Anders' }))
  })

  it('gibt einem wartenden Konto auch den AP-Kalender nicht', async () => {
    await assertFails(getDocs(collection(asPending(), 'apActivities')))
    await assertFails(
      setDoc(doc(asPending(), 'apActivities', 'versuch'), { date: '2026-01-07', kind: 'activity' }),
    )
    await assertFails(getDocs(collection(asAnonymous(), 'apActivities')))
  })

  it('lässt den Vollzugriff den Kalender ebenfalls führen', async () => {
    await assertSucceeds(getDocs(collection(asBishop(), 'apActivities')))
    await assertSucceeds(
      updateDoc(doc(asSecretary(), 'apActivities', 'aktivitaet-1'), { title: 'Bouldern' }),
    )
  })

  it('hindert eine AP-Rolle daran, sich selbst mehr Rechte zu geben', async () => {
    await assertFails(updateDoc(doc(asApEditor(), 'users', AP_EDITOR), { role: 'bishop' }))
    await assertFails(updateDoc(doc(asApViewer(), 'users', AP_VIEWER), { role: 'ap_editor' }))
    // Auch nicht bei jemand anderem.
    await assertFails(updateDoc(doc(asApEditor(), 'users', PENDING), { role: 'secretary' }))
  })
})

/* ------------------------------------------------------------------ */

/*
 * Das Zugriffsprotokoll.
 *
 * Es hat als einzige Sammlung eine Regel, die es sonst nirgends gibt: Jedes
 * angemeldete Konto darf hineinschreiben – auch ein wartendes, denn dass
 * jemand sich anmeldet und nichts zu sehen bekommt, ist die interessanteste
 * Zeile darin. Lesen darf dafür nur der Administrator, und niemand darf einen
 * Eintrag auf einen fremden Namen legen oder einen bestehenden umschreiben.
 *
 * Die Konten hier tragen ihre E-Mail im Token: Die Regel vergleicht sie mit
 * der im Eintrag, damit sich niemand fremde Spuren ausdenken kann.
 */
describe('Zugriffsprotokoll', () => {
  const withEmail = (uid) =>
    testEnv.authenticatedContext(uid, { email: `${uid}@example.ch` }).firestore()

  const entry = (uid, extra = {}) => ({
    kind: 'session',
    uid,
    email: `${uid}@example.ch`,
    displayName: 'Wer auch immer',
    at: new Date('2026-08-12T08:00:00Z'),
    endedAt: new Date('2026-08-12T08:00:00Z'),
    views: 1,
    ...extra,
  })

  it('lässt allein den Administrator das Protokoll lesen', async () => {
    await assertSucceeds(getDocs(collection(asBishop(), 'accessLog')))
    await assertSucceeds(getDoc(doc(asBishop(), 'accessLog', 'besuch-sekretaer')))
  })

  it('gibt es niemandem sonst – auch nicht der übrigen Bischofschaft', async () => {
    for (const as of [asCounselor1, asCounselor2, asSecretary, asApEditor, asApViewer]) {
      await assertFails(getDocs(collection(as(), 'accessLog')))
      await assertFails(getDoc(doc(as(), 'accessLog', 'besuch-sekretaer')))
    }
    await assertFails(getDocs(collection(asPending(), 'accessLog')))
    await assertFails(getDocs(collection(asAnonymous(), 'accessLog')))
  })

  it('lässt jedes angemeldete Konto seinen eigenen Zugriff festhalten', async () => {
    await assertSucceeds(
      setDoc(doc(withEmail(SECRETARY), 'accessLog', 'neu-sekretaer'), entry(SECRETARY)),
    )
    // Auch ein wartendes Konto: Es sieht nichts, aber es war da.
    await assertSucceeds(
      setDoc(doc(withEmail(PENDING), 'accessLog', 'neu-wartend'), entry(PENDING)),
    )
  })

  it('lässt Nichtangemeldete gar nichts schreiben', async () => {
    await assertFails(
      setDoc(doc(asAnonymous(), 'accessLog', 'neu-anonym'), entry('irgendwer')),
    )
  })

  it('hindert jeden daran, einen Eintrag auf einen fremden Namen zu legen', async () => {
    // Fremde UID …
    await assertFails(
      setDoc(doc(withEmail(SECRETARY), 'accessLog', 'gefaelscht-1'), entry(BISHOP)),
    )
    // … und die eigene UID mit fremder Adresse.
    await assertFails(
      setDoc(
        doc(withEmail(SECRETARY), 'accessLog', 'gefaelscht-2'),
        entry(SECRETARY, { email: 'bischof@example.ch' }),
      ),
    )
  })

  it('lässt den eigenen laufenden Besuch fortschreiben', async () => {
    await assertSucceeds(
      updateDoc(doc(withEmail(SECRETARY), 'accessLog', 'besuch-sekretaer'), {
        endedAt: new Date('2026-08-11T19:45:00Z'),
        views: 8,
        city: 'Burgdorf',
      }),
    )
  })

  it('lässt niemanden den Besuch eines anderen anfassen', async () => {
    await assertFails(
      updateDoc(doc(withEmail(COUNSELOR1), 'accessLog', 'besuch-sekretaer'), { views: 99 }),
    )
  })

  it('lässt einen Besuch nicht auf ein anderes Konto oder einen anderen Beginn umschreiben', async () => {
    const ref = () => doc(withEmail(SECRETARY), 'accessLog', 'besuch-sekretaer')
    await assertFails(updateDoc(ref(), { uid: BISHOP }))
    await assertFails(updateDoc(ref(), { email: 'bischof@example.ch' }))
    await assertFails(updateDoc(ref(), { at: new Date('2020-01-01T00:00:00Z') }))
    // Auch nicht in eine Änderung verwandeln, um sie danach zu überschreiben.
    await assertFails(updateDoc(ref(), { kind: 'change' }))
  })

  it('lässt eine festgehaltene Änderung nicht nachträglich umschreiben', async () => {
    await assertFails(
      updateDoc(doc(withEmail(SECRETARY), 'accessLog', 'aenderung-sekretaer'), {
        label: 'Etwas ganz anderes',
      }),
    )
  })

  it('lässt allein den Administrator aufräumen', async () => {
    await assertFails(deleteDoc(doc(withEmail(SECRETARY), 'accessLog', 'aenderung-sekretaer')))
    await assertFails(deleteDoc(doc(withEmail(BISHOP), 'accessLog', 'aenderung-sekretaer')))
    await assertSucceeds(deleteDoc(doc(asBishop(), 'accessLog', 'aenderung-sekretaer')))
  })
})
