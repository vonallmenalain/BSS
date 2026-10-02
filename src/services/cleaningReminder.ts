import {
  parseCleaningReminder,
  validPushToken,
  type CleaningReminderSchedule,
} from '@/lib/cleaningReminder'
import {
  CLEANING_REMINDER_KEY,
  deviceToken,
  pushEnabled,
  pushSupported,
  releaseDeviceToken,
} from '@/services/push'

/*
 * Die Putzplan-Erinnerung dieses Geräts – an- und abmelden, ohne Konto.
 *
 * Anders als die übrigen Benachrichtigungen geht die Anmeldung nicht an
 * Firestore, sondern an die Netlify-Function `putzplan-erinnerung`: Ohne
 * Konto gäbe es nichts, wogegen die Zugriffsregeln prüfen könnten (siehe
 * dort). Dieselbe Function nimmt auch die Abmeldung entgegen – sie braucht
 * dafür die Adresse des Geräts, und die liegt nur hier.
 *
 * Was eingestellt ist, merkt sich das Gerät selbst (`CLEANING_REMINDER_KEY`):
 * Gruppe, Tag, Uhrzeit und die Adresse, unter der es angemeldet ist. Ein
 * Konto, das sich das merken könnte, gibt es ja nicht.
 */

const ENDPOINT = '/.netlify/functions/putzplan-erinnerung'

export interface StoredCleaningReminder extends CleaningReminderSchedule {
  /** Die Adresse, unter der das Gerät angemeldet ist. */
  token: string
}

/* ------------------------------------------------------------------ */
/* Was das Gerät sich merkt                                            */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>()
let snapshot: { raw: string | null; value: StoredCleaningReminder | null } | null = null

function readRaw(): string | null {
  try {
    return localStorage.getItem(CLEANING_REMINDER_KEY)
  } catch {
    return null
  }
}

/** Die Erinnerung dieses Geräts – oder `null`, wenn keine eingeschaltet ist. */
export function storedCleaningReminder(): StoredCleaningReminder | null {
  const raw = readRaw()
  if (snapshot && snapshot.raw === raw) return snapshot.value

  let value: StoredCleaningReminder | null = null
  try {
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
    const schedule = parseCleaningReminder(parsed)
    if (schedule && validPushToken(parsed?.token)) value = { ...schedule, token: parsed.token }
  } catch {
    value = null
  }
  // Dasselbe Objekt, solange sich nichts ändert – `useSyncExternalStore`
  // verlangt das, sonst zeichnete es bei jedem Lesen neu.
  snapshot = { raw, value }
  return value
}

function remember(value: StoredCleaningReminder | null) {
  try {
    if (value) localStorage.setItem(CLEANING_REMINDER_KEY, JSON.stringify(value))
    else localStorage.removeItem(CLEANING_REMINDER_KEY)
  } catch {
    // Privates Fenster oder voller Speicher: Die Erinnerung gilt trotzdem –
    // nur zeigt die Seite sie beim nächsten Besuch nicht mehr an.
  }
  listeners.forEach((listener) => listener())
}

/** Meldet jede Änderung – für `useCleaningReminder`. */
export function subscribeCleaningReminder(listener: () => void): () => void {
  listeners.add(listener)
  // Ein zweiter Tab, der die Erinnerung ändert, meldet sich hierüber.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/* ------------------------------------------------------------------ */
/* An- und abmelden                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ein Fehler mit einem Satz, den man so anzeigen kann – vom Server oder
 * wegen der Verbindung. Alles andere ist ein Fehler, den die Seite mit
 * einem allgemeinen Satz beantwortet.
 */
export class CleaningReminderError extends Error {}

async function post(body: Record<string, unknown>): Promise<void> {
  if (!navigator.onLine) {
    throw new CleaningReminderError(
      'Dafür braucht es eine Internetverbindung. Versuche es erneut, sobald du wieder online bist.',
    )
  }

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new CleaningReminderError(
      'Der Server ist gerade nicht erreichbar. Bitte später noch einmal.',
    )
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: unknown }
    throw new CleaningReminderError(
      typeof data.error === 'string' && data.error
        ? data.error
        : 'Die Erinnerung liess sich gerade nicht speichern.',
    )
  }
}

/**
 * Einschalten oder ändern.
 *
 * Fragt beim ersten Mal nach der Erlaubnis. `denied` heisst, der Browser
 * hat sie verweigert – weiter geht es dann nur über seine Einstellungen.
 */
export async function saveCleaningReminder(
  schedule: CleaningReminderSchedule,
): Promise<'saved' | 'denied'> {
  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const token = await deviceToken()
  const previous = storedCleaningReminder()
  await post({
    action: 'save',
    token,
    ...schedule,
    previousToken: previous && previous.token !== token ? previous.token : undefined,
  })
  remember({ ...schedule, token })
  return 'saved'
}

/**
 * Ausschalten. Die Adresse geht nur dann an den Browser zurück, wenn auch
 * das Konto auf diesem Gerät keine Benachrichtigungen mehr bekommt.
 */
export async function removeCleaningReminder(): Promise<void> {
  const stored = storedCleaningReminder()
  // Erst abmelden, dann vergessen: Scheitert die Abmeldung, bleibt der
  // Knopf zum Ausschalten da – sonst kämen Erinnerungen, die niemand mehr
  // abstellen kann.
  if (stored) await post({ action: 'delete', token: stored.token })
  remember(null)
  if (!pushEnabled()) await releaseDeviceToken()
}

/**
 * Beim Öffnen des Putzplans nachsehen, ob die Anmeldung noch stimmt.
 *
 * Browser vergeben ihre Adresse ab und zu neu; dann meldet sich das Gerät
 * unter der neuen an und räumt die alte weg. Hat jemand die Erlaubnis in
 * den Browser-Einstellungen entzogen, kommt ohnehin nichts mehr an – dann
 * wird abgemeldet, statt eine Erinnerung anzuzeigen, die keine ist.
 */
export async function refreshCleaningReminder(): Promise<void> {
  const stored = storedCleaningReminder()
  if (!stored || !(await pushSupported())) return

  if (Notification.permission === 'denied') {
    await post({ action: 'delete', token: stored.token }).catch(() => undefined)
    remember(null)
    return
  }
  if (Notification.permission !== 'granted') return

  const token = await deviceToken()
  if (token === stored.token) return
  await post({
    action: 'save',
    token,
    group: stored.group,
    day: stored.day,
    time: stored.time,
    previousToken: stored.token,
  })
  remember({ ...stored, token })
}
