import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db, COLLECTIONS } from '@/lib/firebase'
import { peekDoc } from '@/lib/collectionStore'
import { describeChange, fieldLabels } from '@/lib/accessLog'
import type { ChangeOp } from '@/lib/types'

/**
 * Das Protokoll darüber, wer wann welche Änderung vorgenommen hat.
 *
 * ## Wo es ansetzt
 *
 * An genau einer Stelle: `lib/db`. Alle Dienste in `src/services` schreiben
 * über die Firestore-Funktionen aus jenem Modul statt direkt über
 * `firebase/firestore`, und jede davon meldet den Vorgang hierher. Der Weg
 * ist bewusst so gewählt: Eine Protokollzeile, die man in jedem Dienst von
 * Hand mitschreiben muss, fehlt über kurz oder lang in der Hälfte davon –
 * und ausgerechnet dort, wo neu programmiert wurde.
 *
 * ## Was es zusammenfasst
 *
 * Ein Handgriff in der App ist selten ein einzelner Schreibvorgang: Eine
 * Traktandenliste umzusortieren schreibt jede verschobene Zeile, ein
 * Mitgliederimport schreibt Hunderte Datensätze. Einzeln festgehalten wäre
 * das Protokoll unlesbar und teuer.
 *
 * Deshalb sammelt dieses Modul, was in derselben Sammlung und auf dieselbe
 * Weise geschieht, und schreibt daraus **eine** Zeile: «312 Mitglieder
 * geändert» statt 312-mal dasselbe. Was einzeln bleibt, bleibt einzeln – mit
 * Titel und den Feldern, die sich geändert haben.
 *
 * ## Was es nicht ist
 *
 * Eine Beweissicherung. Geschrieben wird aus dem Browser, der die Änderung
 * vornimmt – wer die Firestore-Schnittstelle direkt bedient, kommt hier nicht
 * vor. Für die Frage «wer hat woran gearbeitet?» genügt das; für die Frage
 * «kann mir das jemand verheimlichen?» nicht. Das steht so auch auf der Seite,
 * die es anzeigt.
 */

/* ------------------------------------------------------------------ */
/* Wer gerade schreibt                                                 */
/* ------------------------------------------------------------------ */

export interface LogIdentity {
  uid: string
  email: string
  displayName: string
}

let identity: LogIdentity | null = null
let sessionId: string | null = null

/**
 * Hinterlegt, wer gerade angemeldet ist – mit dem Namen aus dem Profil.
 *
 * Gesetzt von `hooks/useAccessLog`, gelöscht beim Abmelden. Der Name ist der
 * Grund, weshalb es diesen Weg überhaupt gibt: Er steht im Firestore-Profil
 * und nicht im Anmeldetoken, und im Protokoll soll «Anna Muster» stehen und
 * nicht ihre Adresse.
 */
export function setLogIdentity(next: LogIdentity | null): void {
  if (!next) flushChanges()
  identity = next
}

/** Verbindet die Änderungen mit dem Besuch, in dem sie entstanden sind. */
export function setLogSession(id: string | null): void {
  sessionId = id
}

/**
 * Wem eine Änderung zugeschrieben wird.
 *
 * Zuerst die hinterlegte Angabe, ersatzweise die Anmeldung selbst. Der Ersatz
 * ist kein Beiwerk: Die Angabe wird in einem Effekt gesetzt, und React führt
 * Effekte von innen nach aussen aus – was ein Kind beim Aufbau der Ansicht
 * schreibt, geschieht also **vor** ihr. Ohne den Rückfall fehlten
 * ausgerechnet die Änderungen, die die App beim Start selbst vornimmt (die
 * Monatspendenzen etwa), und niemand käme darauf, weshalb.
 *
 * Die Anmeldung reicht dafür aus: UID und E-Mail stehen im Token, und die
 * Zugriffsregeln prüfen ohnehin genau diese beiden.
 */
function author(): LogIdentity | null {
  if (identity) return identity

  const user = auth.currentUser
  if (!user?.email) return null
  return { uid: user.uid, email: user.email, displayName: user.displayName || user.email }
}

/* ------------------------------------------------------------------ */
/* Sammeln und zusammenfassen                                          */
/* ------------------------------------------------------------------ */

/**
 * Wie lange gewartet wird, bevor eine Gruppe geschrieben wird.
 *
 * Lang genug, dass ein Handgriff mit mehreren Schreibvorgängen – eine
 * verschobene Liste, ein abgeschlossenes Traktandum samt Folgependenz –
 * vollständig darin Platz hat. Kurz genug, dass die nächste, inhaltlich
 * andere Änderung nicht mehr hineinrutscht.
 */
const QUIET_MS = 1500

/** Spätestens dann wird geschrieben, auch wenn laufend Neues dazukommt. */
const MAX_WAIT_MS = 8000

/** So viele Titel nennt eine zusammengefasste Zeile beim Namen. */
const NAMED = 2

/**
 * So viele geänderte Felder werden aufgezählt.
 *
 * Ein `setDoc()` ohne Optionen schreibt den ganzen Datensatz; ohne Grenze
 * stünden darunter dreissig Feldnamen, und die Zeile sagte weniger als ohne
 * sie. Die ersten paar beantworten die Frage «woran genau?»; wer mehr
 * braucht, schaut den Datensatz selbst an.
 */
const MAX_FIELDS = 8

interface Group {
  collectionId: string
  op: ChangeOp
  docId: string
  labels: string[]
  fields: Set<string>
  count: number
}

const groups = new Map<string, Group>()
let quietTimer: number | null = null
let deadline = 0

/**
 * Hält eine Änderung fest.
 *
 * Wird aus `lib/db` gerufen und nirgends sonst. Schlägt der Schreibvorgang
 * anschliessend fehl, steht hier trotzdem eine Zeile – das ist gewollt: Ein
 * Versuch, der an den Zugriffsregeln scheitert, ist eher mehr als weniger
 * interessant.
 */
export function noteChange(
  collectionId: string,
  docId: string,
  op: ChangeOp,
  data: DocumentData | null,
): void {
  if (!author()) return
  /*
   * Das Protokoll protokolliert sich nicht selbst. Es schreibt zwar ohnehin
   * an `lib/db` vorbei, aber die Regel gehört hierher: Sonst hinge an der
   * ersten Zeile eine zweite und daran eine dritte.
   */
  if (collectionId === COLLECTIONS.accessLog) return

  const key = `${collectionId}|${op}`
  const group = groups.get(key)
  const label = describeChange(collectionId, docId, data, peekDoc)
  const fields = op === 'update' ? fieldLabels(collectionId, data) : []

  if (group) {
    group.count += 1
    if (label && group.labels.length < NAMED && !group.labels.includes(label)) {
      group.labels.push(label)
    }
    fields.forEach((field) => group.fields.add(field))
  } else {
    groups.set(key, {
      collectionId,
      op,
      docId,
      labels: label ? [label] : [],
      fields: new Set(fields),
      count: 1,
    })
  }

  schedule()
}

function schedule(): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (!deadline) deadline = now + MAX_WAIT_MS
  if (quietTimer !== null) window.clearTimeout(quietTimer)
  quietTimer = window.setTimeout(flushChanges, Math.max(0, Math.min(QUIET_MS, deadline - now)))
}

/** Schreibt, was sich angesammelt hat – jetzt und nicht später. */
export function flushChanges(): void {
  if (typeof window !== 'undefined' && quietTimer !== null) {
    window.clearTimeout(quietTimer)
    quietTimer = null
  }
  deadline = 0

  const pending = [...groups.values()]
  groups.clear()
  if (pending.length === 0) return

  const who = author()
  if (!who) return

  for (const group of pending) void write(group, who)
}

/**
 * Aus einer Gruppe wird eine Zeile.
 *
 * Eine einzelne Änderung behält ihren Titel und die Felder. Mehrere werden
 * gezählt und mit den ersten Namen versehen – «Anna Muster, Beat Meier und
 * 310 weitere» sagt genug, um zu erkennen, was da lief, ohne 312 Zeilen dafür
 * zu brauchen.
 */
async function write(group: Group, who: LogIdentity): Promise<void> {
  const single = group.count === 1
  const rest = group.count - group.labels.length

  const label = single
    ? group.labels[0] || ''
    : group.labels.length === 0
      ? ''
      : rest > 0
        ? `${group.labels.join(', ')} und ${rest} weitere`
        : group.labels.join(', ')

  try {
    await addDoc(collection(db, COLLECTIONS.accessLog), {
      kind: 'change',
      uid: who.uid,
      email: who.email,
      displayName: who.displayName,
      at: serverTimestamp(),
      sessionId,
      collectionId: group.collectionId,
      op: group.op,
      docId: single ? group.docId : '',
      label,
      // Bei mehreren zusammengefassten Änderungen sagt eine Feldliste nichts
      // mehr: Sie wäre die Vereinigung aus allem, was irgendwo anders ist.
      fields: single ? [...group.fields].slice(0, MAX_FIELDS) : [],
      count: group.count,
    })
  } catch (error) {
    // Ein Protokoll darf nie der Grund sein, weshalb eine Änderung scheitert.
    console.warn('[protokoll] Änderung nicht festgehalten:', error)
  }
}

/*
 * Beim Verlassen der Seite schreiben, was noch wartet.
 *
 * `pagehide` ist das Ereignis, das auch auf dem iPhone zuverlässig kommt –
 * `beforeunload` bleibt dort aus, wenn die App aus dem Speicher fällt.
 * Firestore nimmt den Schreibvorgang in die Warteschlange und überträgt ihn
 * beim nächsten Start; die letzte Änderung vor dem Schliessen geht also nicht
 * verloren, auch wenn sie später ankommt.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flushChanges())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushChanges()
  })
}

/* ------------------------------------------------------------------ */
/* Besuche                                                             */
/* ------------------------------------------------------------------ */

/** Legt den Eintrag für einen Besuch an. */
export async function startSession(
  id: string,
  who: LogIdentity,
  details: Record<string, unknown>,
): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.accessLog, id), {
    kind: 'session',
    uid: who.uid,
    email: who.email,
    displayName: who.displayName,
    at: serverTimestamp(),
    endedAt: serverTimestamp(),
    views: 1,
    ...details,
  })
}

/** Schreibt einen laufenden Besuch fort – zuletzt gesehen, Ansichten, Ort. */
export async function touchSession(id: string, patch: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.accessLog, id), { endedAt: serverTimestamp(), ...patch })
}
