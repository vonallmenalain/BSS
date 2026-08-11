import {
  collection,
  doc,
  getCountFromServer,
  getDocFromCache,
  getDocsFromCache,
  onSnapshot,
  query,
  Timestamp,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Sammlungen, die nur einmal geladen und danach nachgeführt werden.
 *
 * ## Warum
 *
 * Firestore rechnet jede Zeile ab, die über die Leitung geht. Ein
 * `onSnapshot()` auf eine ganze Sammlung ist deshalb teurer, als es aussieht:
 * Wer die Ansicht wechselt, meldet den alten Horcher ab und den neuen an – und
 * war die Verbindung länger als eine halbe Stunde unterbrochen (jeder neue
 * Aufruf der App), liest der neue Horcher **alles** noch einmal. Bei einem
 * Dutzend Sammlungen und ein paar tausend Datensätzen sind das schnell
 * Zehntausende Lesevorgänge am Tag – für Daten, die sich seit gestern nicht
 * bewegt haben.
 *
 * ## Wie
 *
 * Drei Schritte, je Sammlung genau einmal pro Sitzung:
 *
 *  1. **Aus dem Zwischenspeicher füllen.** Firestore legt ohnehin eine
 *     vollständige Kopie in IndexedDB ab (`persistentLocalCache`).
 *     `getDocsFromCache()` liest daraus – kostenlos und ohne Netz. Die Ansicht
 *     steht damit sofort, auch beim ersten Aufruf am Morgen.
 *  2. **Nur das Neue nachladen.** Statt der ganzen Sammlung wird ab dem
 *     höchsten bekannten `updatedAt` abonniert. Der Server schickt, was sich
 *     seither geändert hat – meist nichts, sonst eine Handvoll Datensätze.
 *     Der Horcher bleibt offen: Was ein anderes Gerät jetzt ändert, ist
 *     ebenfalls «neuer» und kommt über denselben Weg herein. Die App bleibt
 *     also so aktuell wie vorher.
 *  3. **Einmal nachzählen.** Eine Zählabfrage kostet einen einzigen
 *     Lesevorgang je tausend Datensätze und verrät, ob etwas gelöscht wurde –
 *     das sähe die Teilabfrage sonst nicht. Stimmt die Zahl nicht, wird die
 *     Sammlung einmal vollständig gelesen.
 *
 * Dazu kommt ein Sicherheitsnetz: Ist der Wasserstand älter als eine Woche,
 * wird ohnehin einmal vollständig abgeglichen. Damit fällt selbst der Fall
 * «einer gelöscht, einer angelegt» (gleiche Anzahl, anderer Inhalt) spätestens
 * nach sieben Tagen auf.
 *
 * ## Was das für die Oberfläche bedeutet
 *
 * Jede Sammlung wird **einmal** abonniert, nicht einmal je Ansicht. Die Hooks
 * in `hooks/useFirestore` filtern und sortieren im Client. Ein Wechsel
 * zwischen «Pendent» und «Erledigt» oder das Öffnen einer Sitzung kostet
 * damit gar nichts mehr, und die Listen stehen ohne Ladebalken da.
 */

/* ------------------------------------------------------------------ */
/* Wasserstand                                                         */
/* ------------------------------------------------------------------ */

/**
 * Bis wohin eine Sammlung bereits gelesen wurde.
 *
 * `count` ist die Anzahl Datensätze beim letzten Abgleich – daran erkennt der
 * Start, ob der Browser den Zwischenspeicher inzwischen geleert hat.
 * `syncedAt` ist die lokale Uhrzeit des letzten **vollständigen** Lesens und
 * steuert nur, wann wieder einmal vollständig gelesen wird. Sie darf deshalb
 * nicht mitwandern, wenn bloss Änderungen nachgeladen wurden – sonst käme der
 * Sicherheitsabgleich nie zustande.
 */
interface Watermark {
  seconds: number
  nanoseconds: number
  count: number
  syncedAt: number
}

const WATERMARK_PREFIX = 'bss:sync:'

/**
 * Version des Verfahrens.
 *
 * Ändert sich, wie der Wasserstand gebildet wird, sind die alten Werte nichts
 * mehr wert – eine neue Nummer verwirft sie und liest einmal vollständig.
 */
const WATERMARK_VERSION = 1

/** Nach dieser Zeit wird eine Sammlung wieder vollständig abgeglichen. */
const FULL_RESYNC_AFTER_MS = 7 * 24 * 60 * 60 * 1000

function watermarkKey(name: string): string {
  return `${WATERMARK_PREFIX}${WATERMARK_VERSION}:${name}`
}

function readWatermark(name: string): Watermark | null {
  try {
    const raw = localStorage.getItem(watermarkKey(name))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Watermark>
    if (typeof parsed.seconds !== 'number' || typeof parsed.nanoseconds !== 'number') return null
    return {
      seconds: parsed.seconds,
      nanoseconds: parsed.nanoseconds,
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      syncedAt: typeof parsed.syncedAt === 'number' ? parsed.syncedAt : 0,
    }
  } catch {
    return null
  }
}

function writeWatermark(name: string, mark: Watermark): void {
  try {
    localStorage.setItem(watermarkKey(name), JSON.stringify(mark))
  } catch {
    // Privater Modus oder voller Speicher: Dann wird beim nächsten Start
    // eben einmal vollständig gelesen. Kein Grund, die App anzuhalten.
  }
}

/**
 * Alle Wasserstände verwerfen – beim nächsten Start wird jede Sammlung
 * vollständig gelesen. Der Notausgang unter «Einstellungen».
 */
export function clearSyncWatermarks(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(WATERMARK_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Siehe oben.
  }
}

/* ------------------------------------------------------------------ */
/* Der Speicher je Sammlung                                            */
/* ------------------------------------------------------------------ */

/**
 * Zeitstempel, die noch beim Server liegen, mit der lokalen Uhr schätzen.
 *
 * `serverTimestamp()` steht erst fest, wenn der Server bestätigt hat; bis
 * dahin liefert Firestore für dieses Feld standardmässig `null`. Für die
 * Oberfläche heisst das: Kaum ist eine Änderung gespeichert, hat der Eintrag
 * für einen Augenblick **kein** Bearbeitungsdatum mehr – die Zeile «zuletzt
 * bearbeitet» verschwindet, die nach diesem Datum sortierte Liste wirft ihn
 * an eine ganz andere Stelle, und wenn die Bestätigung eintrifft, springt
 * alles ein zweites Mal. Wer gerade tippt, sieht das als Ruckeln der ganzen
 * Seite.
 *
 * Geschätzt wird stattdessen die lokale Uhrzeit – also genau das, was
 * gemeint ist: eben jetzt bearbeitet. Der Wasserstand bleibt davon
 * unberührt; er wächst ausschliesslich aus bestätigten Schnappschüssen
 * (siehe `remember()`).
 */
const ESTIMATED = { serverTimestamps: 'estimate' } as const

export interface StoreState<T> {
  data: T[]
  loading: boolean
  error: Error | null
}

/** Gemeinsamer Wert für abgeschaltete Abfragen – muss stabil sein. */
const IDLE: StoreState<never> = { data: [], loading: false, error: null }

interface Store {
  name: string
  docs: Map<string, DocumentData>
  state: StoreState<unknown>
  listeners: Set<() => void>
  unsubscribe: (() => void) | null
  started: boolean
  /** Höchstes bestätigtes `updatedAt` – der Wasserstand für den nächsten Start. */
  high: Timestamp | null
  /** Läuft gerade eine Teilabfrage (statt der vollständigen)? */
  partial: boolean
  /** Wurde die Anzahl nach dem ersten Serverstand schon geprüft? */
  counted: boolean
  /** Wann zuletzt vollständig gelesen wurde – lokale Uhrzeit */
  fullSyncAt: number
  /** Ist mindestens ein Schnappschuss angekommen? */
  primed: boolean
}

const stores = new Map<string, Store>()

function getStore(name: string): Store {
  const existing = stores.get(name)
  if (existing) return existing
  const store: Store = {
    name,
    docs: new Map(),
    state: { data: [], loading: true, error: null },
    listeners: new Set(),
    unsubscribe: null,
    started: false,
    high: null,
    partial: false,
    counted: false,
    fullSyncAt: 0,
    primed: false,
  }
  stores.set(name, store)
  return store
}

/** Neuen Stand veröffentlichen. Das Feld `data` wird dabei neu gebaut. */
function publish(store: Store, patch: Partial<StoreState<unknown>> = {}): void {
  store.state = {
    data: [...store.docs.values()],
    loading: patch.loading ?? store.state.loading,
    error: patch.error !== undefined ? patch.error : store.state.error,
  }
  store.listeners.forEach((listener) => listener())
}

/** Nur die Meldung erneuern, ohne das teure Neubauen der Liste. */
function publishFlags(store: Store, patch: Partial<StoreState<unknown>>): void {
  store.state = { ...store.state, ...patch }
  store.listeners.forEach((listener) => listener())
}

function remember(store: Store, id: string, data: DocumentData, confirmed: boolean): void {
  store.docs.set(id, { id, ...data })
  /*
   * Der Wasserstand wächst ausschliesslich aus bestätigten Schnappschüssen
   * des Horchers.
   *
   * Zwei Gründe. Erstens trägt eine noch nicht übertragene eigene Änderung
   * `updatedAt: null`; ein geschätzter Wert liesse den Stand vorauseilen.
   * Zweitens – und wichtiger – ist ein Schnappschuss in sich stimmig: Er
   * enthält alles, was zum Zeitpunkt seines Lesens galt. Der
   * Zwischenspeicher ist das nicht. Dort kann eine eigene, bestätigte
   * Änderung von gestern Abend liegen, während die Änderung eines anderen
   * Geräts von gestern Nachmittag fehlt – sie kam nie an, weil die App
   * geschlossen war. Wüchse der Stand daraus, fiele genau diese Änderung
   * beim nächsten Start durch das Raster.
   */
  if (!confirmed) return
  const updatedAt = data.updatedAt
  if (!(updatedAt instanceof Timestamp)) return
  if (!store.high || updatedAt.toMillis() > store.high.toMillis()) store.high = updatedAt
}

/* ------------------------------------------------------------------ */
/* Starten und nachführen                                              */
/* ------------------------------------------------------------------ */

async function start(store: Store): Promise<void> {
  const ref = collection(db, store.name)
  let mark = readWatermark(store.name)

  /* 1. Aus dem Zwischenspeicher füllen – kostenlos und sofort. */
  try {
    const cached = await getDocsFromCache(ref)
    cached.forEach((snapshot) => remember(store, snapshot.id, snapshot.data(ESTIMATED), false))
    // Weniger Datensätze als beim letzten Mal heisst: Der Browser hat den
    // Zwischenspeicher geleert (oder es ist ein anderes Gerät). Dann taugt
    // der Wasserstand nicht – es fehlte, was zwischendurch geschrieben wurde.
    if (mark && cached.size < mark.count) mark = null
    if (mark && Date.now() - mark.syncedAt > FULL_RESYNC_AFTER_MS) mark = null
    if (store.docs.size > 0) publish(store, { loading: false })
  } catch {
    // Ohne Zwischenspeicher (privater Modus, erster Aufruf) bleibt nur der
    // vollständige Weg.
    mark = null
  }

  if (!store.started) return

  /* 2. Nur das Neue abonnieren. */
  store.partial = mark !== null
  if (mark) {
    store.high = new Timestamp(mark.seconds, mark.nanoseconds)
    store.fullSyncAt = mark.syncedAt
  } else {
    // Vollständig gelesen wird höchstens einmal je Gerät – danach lebt die
    // Sammlung aus dem Zwischenspeicher weiter.
    store.docs.clear()
    store.high = null
    store.fullSyncAt = Date.now()
  }

  const target = mark
    ? query(ref, where('updatedAt', '>', new Timestamp(mark.seconds, mark.nanoseconds)))
    : query(ref)

  store.unsubscribe = onSnapshot(
    target,
    /*
     * `includeMetadataChanges` ist hier nicht Beiwerk, sondern nötig.
     *
     * Ohne die Angabe meldet sich Firestore nur, wenn sich ein Dokument
     * ändert. Hat sich seit dem letzten Mal nichts getan – der Normalfall –,
     * käme also **kein** Schnappschuss vom Server, und der Wasserstand liesse
     * sich nie fortschreiben: Beim nächsten Start würde wieder alles gelesen.
     * Mit der Angabe kommt der Wechsel «aus dem Zwischenspeicher» →
     * «vom Server bestätigt» als eigenes Ereignis, und genau daran hängt der
     * Wasserstand. Für die Ansicht ändert das nichts: `docChanges()` liefert
     * weiterhin nur echte Änderungen.
     */
    { includeMetadataChanges: true },
    (snapshot) => apply(store, snapshot),
    (error) => {
      console.error(`[sync] ${store.name}:`, error)
      // Der Zwischenspeicher steht weiterhin – lieber etwas Älteres zeigen
      // als eine leere Seite. Die Meldung sagt, dass es nicht aktuell ist.
      publishFlags(store, { loading: false, error })
    },
  )
}

function apply(store: Store, snapshot: QuerySnapshot): void {
  const confirmed = !snapshot.metadata.fromCache
  let changed = false

  snapshot.docChanges().forEach((change) => {
    if (change.type === 'removed') {
      /*
       * «Entfernt» heisst bei der Teilabfrage nicht «gelöscht» – deshalb wird
       * hier nichts sofort weggeworfen (siehe `forgetIfGone`).
       */
      void forgetIfGone(store, change.doc.id)
      return
    }
    remember(
      store,
      change.doc.id,
      change.doc.data(ESTIMATED),
      !change.doc.metadata.hasPendingWrites,
    )
    changed = true
  })

  if (changed || !store.primed || store.state.loading) {
    store.primed = true
    publish(store, { loading: false, error: null })
  }

  if (!confirmed) return

  if (store.high) {
    writeWatermark(store.name, {
      seconds: store.high.seconds,
      nanoseconds: store.high.nanoseconds,
      count: store.docs.size,
      syncedAt: store.fullSyncAt,
    })
  }

  /* 3. Einmal nachzählen – das findet, was gelöscht wurde. */
  if (!store.counted) {
    store.counted = true
    void reconcile(store)
  }
}

/**
 * Ein Datensatz ist aus der Teilabfrage gefallen – ist er wirklich weg?
 *
 * ## Warum die Frage überhaupt gestellt werden muss
 *
 * Die Teilabfrage lautet «alles, was neuer ist als …». `serverTimestamp()`
 * steht im Moment des Schreibens aber noch nicht fest: Bis der Server
 * bestätigt, trägt der Datensatz lokal **kein** `updatedAt` – und was keines
 * hat, erfüllt die Bedingung nicht. Firestore meldet ihn deshalb als
 * «entfernt», und zwei Zehntelsekunden später, mit der Bestätigung, wieder
 * als «neu».
 *
 * Für die Oberfläche war das **das** «dauernde Neuladen»: Wer eine Zeile
 * schrieb oder eine Zuständigkeit setzte, sah den ganzen Eintrag beim
 * Speichern aus der Liste fallen und sich neu aufbauen – mitsamt Animation,
 * verlorenem Cursor und, bei einer aufgeklappten Berufungsrunde, einer für
 * einen Augenblick leeren Seite.
 *
 * ## Warum `hasPendingWrites` dafür nicht taugt
 *
 * Naheliegend wäre, den eigenen Schreibvorgang am Datensatz abzulesen. Er
 * steht dort aber nicht: Die Meldung «entfernt» beschreibt die Abfrage nach
 * der Änderung, und darin kommt der Datensatz nicht mehr vor – `metadata`
 * meldet folglich `hasPendingWrites: false`, genau wie beim wirklich
 * gelöschten. Am Emulator nachgemessen; beide Fälle sind daran nicht zu
 * unterscheiden.
 *
 * ## Woran es sich unterscheiden lässt
 *
 * Am Zwischenspeicher. Er kennt den eigenen, noch nicht bestätigten Stand –
 * ein Datensatz mit ausstehendem Schreibvorgang steht dort weiterhin, ein
 * gelöschter nicht. Die Auskunft kostet nichts (kein Lesevorgang beim
 * Server) und gilt auch ohne Netz.
 *
 * Steht er noch da, wird gleich der Stand von dort übernommen: Ohne Netz
 * bleibt der Datensatz sonst bis zum nächsten Start auf dem Stand von vor
 * der Änderung – die eigene Eingabe wäre in jeder anderen Ansicht nicht zu
 * sehen. Der Wasserstand rührt sich dabei nicht (`confirmed: false`).
 */
async function forgetIfGone(store: Store, id: string): Promise<void> {
  const known = store.docs.get(id)
  if (!known) return

  let mine: DocumentData | null = null
  try {
    const cached = await getDocFromCache(doc(db, store.name, id))
    if (cached.exists()) mine = cached.data(ESTIMATED)
  } catch (error) {
    /*
     * «unavailable» heisst: Der Zwischenspeicher kennt ihn nicht – dann ist
     * er wirklich weg. Jede andere Störung lässt den Eintrag stehen: Einer zu
     * viel fällt beim nächsten Abgleich auf, einer zu wenig nicht.
     */
    if ((error as { code?: string }).code !== 'unavailable') return
  }

  // Ist der Datensatz inzwischen bestätigt zurückgekommen, gilt dieser Stand –
  // die Auskunft von eben ist dann überholt.
  if (!store.started || store.docs.get(id) !== known) return

  if (mine) {
    remember(store, id, mine, false)
    publish(store)
    return
  }

  store.docs.delete(id)
  publish(store)
}

/**
 * Prüft, ob die Anzahl beim Server mit der eigenen übereinstimmt.
 *
 * Eine Teilabfrage sieht nur, was sich geändert hat – ein gelöschter
 * Datensatz taucht darin nicht auf. Die Zählabfrage schliesst diese Lücke und
 * kostet einen einzigen Lesevorgang je tausend Datensätze.
 */
async function reconcile(store: Store): Promise<void> {
  if (!store.partial || !store.started) return
  try {
    const result = await getCountFromServer(collection(db, store.name))
    if (!store.started) return
    if (result.data().count === store.docs.size) return
    console.info(`[sync] ${store.name}: Bestand weicht ab – wird einmal vollständig gelesen.`)
    resync(store)
  } catch {
    // Ohne Netz lässt sich nichts abgleichen; beim nächsten Start wieder.
  }
}

/*
 * Den Zählabgleich gelegentlich wiederholen.
 *
 * Er lief bisher genau einmal je Sitzung – wer die App als installierte PWA
 * tagelang offen hält, sah fremde Löschungen deshalb erst beim nächsten
 * Kaltstart. Jetzt wird beim Zurückkehren zur App (frühestens nach einer
 * Stunde) noch einmal gezählt: ein Lesevorgang je Sammlung, und gelöschte
 * Einträge verschwinden auch aus lange laufenden Sitzungen.
 */
const RECONCILE_AGAIN_AFTER_MS = 60 * 60 * 1000
let lastReconcileAt = Date.now()

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastReconcileAt < RECONCILE_AGAIN_AFTER_MS) return
    lastReconcileAt = Date.now()
    stores.forEach((store) => {
      if (store.started && store.partial) void reconcile(store)
    })
  })
}

/** Die Sammlung von vorne lesen – nach einer Abweichung oder von Hand. */
function resync(store: Store): void {
  store.unsubscribe?.()
  store.unsubscribe = null
  store.counted = true
  try {
    localStorage.removeItem(watermarkKey(store.name))
  } catch {
    /* egal */
  }
  store.partial = false
  store.primed = false
  store.docs.clear()
  store.high = null
  store.fullSyncAt = Date.now()
  store.unsubscribe = onSnapshot(
    query(collection(db, store.name)),
    { includeMetadataChanges: true },
    (snapshot) => apply(store, snapshot),
    (error) => {
      console.error(`[sync] ${store.name}:`, error)
      publishFlags(store, { loading: false, error })
    },
  )
}

/* ------------------------------------------------------------------ */
/* Zugriff                                                             */
/* ------------------------------------------------------------------ */

function subscribe(name: string, listener: () => void): () => void {
  const store = getStore(name)
  store.listeners.add(listener)

  if (!store.started) {
    store.started = true
    void start(store)
  }

  return () => {
    store.listeners.delete(listener)
    /*
     * Der Horcher bleibt bewusst offen, auch wenn gerade niemand hinsieht.
     * Genau das ist der Gewinn: Wer zwischen Sitzungen, Pendenzen und
     * Mitgliedern hin- und herwechselt, meldete sonst dauernd ab und wieder
     * an – und jede Anmeldung nach einer Pause liest von vorne. Offen
     * gehalten kostet er nichts, solange sich nichts ändert.
     */
  }
}

/**
 * Meldet einen im Client gelöschten Datensatz.
 *
 * Die Teilabfrage sieht ihn nicht: Wer nicht in der Änderungsmenge stand,
 * verlässt sie auch nicht. Ohne diesen Wink bliebe der eben gelöschte Eintrag
 * bis zum nächsten Abgleich in der Liste stehen.
 */
export function forgetDoc(name: string, id: string): void {
  const store = stores.get(name)
  if (!store || !store.docs.has(id)) return
  store.docs.delete(id)
  publish(store)
}

/**
 * Nachsehen, was von einem Datensatz bereits geladen ist.
 *
 * Für das Zugriffsprotokoll: Eine Änderung schreibt nur, was sich ändert –
 * der Titel steht meist nicht dabei. Der geladene Bestand kennt ihn, und ihn
 * hier nachzuschlagen kostet weder einen Lesevorgang noch eine Netzrunde.
 * Kennt der Speicher den Datensatz nicht (weil die Sammlung in dieser Sitzung
 * gar nicht gebraucht wurde), bleibt die Zeile eben ohne Titel.
 */
export function peekDoc(name: string, id: string): Record<string, unknown> | null {
  return (stores.get(name)?.docs.get(id) as Record<string, unknown> | undefined) ?? null
}

/**
 * Alles vergessen und die Horcher abmelden – beim Abmelden.
 *
 * Ohne das liefen die Abfragen des abgemeldeten Kontos weiter und schlügen
 * mit «keine Berechtigung» fehl; ausserdem stünden die Daten der einen Person
 * noch da, wenn sich die nächste anmeldet.
 */
export function stopCollectionStores(): void {
  stores.forEach((store) => {
    store.unsubscribe?.()
    store.unsubscribe = null
    store.started = false
    store.counted = false
    store.partial = false
    store.primed = false
    store.high = null
    store.fullSyncAt = 0
    store.docs.clear()
    store.state = { data: [], loading: true, error: null }
    store.listeners.forEach((listener) => listener())
  })
}

/** Alle laufenden Sammlungen einmal vollständig neu lesen. */
export function resyncCollectionStores(): void {
  clearSyncWatermarks()
  stores.forEach((store) => {
    if (store.started) resync(store)
  })
}

/**
 * Einzelne Sammlungen vollständig neu lesen – nach einem Import.
 *
 * Ein Import ist der eine Vorgang, den der schrittweise Abgleich nicht
 * mitbekommt: Er löscht Datensätze, und das Protokollarchiv trägt bewusst das
 * Datum des Protokolls statt das des Imports (`services/importMinutes`).
 * Beides sieht eine Abfrage «was ist neuer als …» nicht. Ein Import ist dafür
 * selten und dauert ohnehin, weshalb hier einmal vollständig gelesen wird –
 * und die Liste danach stimmt, ohne dass jemand die App neu laden muss.
 */
export function resyncCollections(names: string[]): void {
  for (const name of names) {
    try {
      localStorage.removeItem(watermarkKey(name))
    } catch {
      /* egal */
    }
    const store = stores.get(name)
    if (store?.started) resync(store)
  }
}

/**
 * Eine ganze Sammlung als React-Zustand.
 *
 * `enabled` steht dort, wo die Sicherheitsregeln die Abfrage gar nicht
 * erlauben – Konten, die nur den AP-Kalender sehen, dürfen die
 * Mitgliederliste nicht einmal anfragen.
 */
export function collectionSnapshot<T>(name: string): StoreState<T> {
  return getStore(name).state as StoreState<T>
}

export function subscribeToCollection(name: string, listener: () => void): () => void {
  return subscribe(name, listener)
}

export const IDLE_STATE = IDLE as StoreState<never>
