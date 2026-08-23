import { doc, serverTimestamp, updateDoc, deleteDoc } from '@/lib/db'
// Am Protokoll vorbei – warum, steht bei `saveApView`.
import { updateDoc as fbUpdateDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { getInitials } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import {
  ASSISTANT_AREAS,
  type ApView,
  type AppUser,
  type AssistantArea,
  type Role,
} from '@/lib/types'

/**
 * Schaltet ein wartendes Konto frei bzw. ändert die Rolle.
 *
 * Das darf ausschliesslich das Administrator-Konto (`ADMIN_EMAIL`):
 * Andernfalls genügte ein einzelnes kompromittiertes Konto, um alle übrigen
 * zu übernehmen. Durchgesetzt wird das in `firestore.rules`.
 */
export async function setUserRole(userId: string, role: Role): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.users, userId), {
      role,
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Welche Bereiche der Abendmahlsversammlung ein Assistenzkonto sieht – und
 * welche davon es auch ändern darf.
 *
 * Beide Listen gehen zusammen weg: Sie beantworten je Sparte dieselbe Frage
 * («was darf diese Person hier?»), und getrennt geschrieben stünde zwischen
 * den beiden Vorgängen ein Stand da, den niemand gewollt hat.
 *
 * Wie Rolle und Aktivstatus Teil des Zugriffs – und deshalb allein Sache des
 * Administrator-Kontos; `firestore.rules` sperrt beide Felder gegen die
 * eigene Hand.
 */
export async function setUserAssistantAreas(
  userId: string,
  areas: AssistantArea[],
  write: AssistantArea[],
): Promise<SaveOutcome> {
  return commit(updateDoc(doc(db, COLLECTIONS.users, userId), assistantFields(areas, write)))
}

/**
 * Die beiden Listen, wie sie am Konto stehen sollen.
 *
 * Geschrieben wird in der Reihenfolge von `ASSISTANT_AREAS`, damit in der
 * Datenbank nicht steht, in welcher Reihenfolge jemand geklickt hat, und
 * damit nichts hineingerät, was es gar nicht gibt. Das Schreibrecht wird
 * zusätzlich auf die offenen Bereiche zurückgeschnitten: Ein Bereich, der
 * niemandem offensteht, darf auch nicht beschreibbar zurückbleiben – sonst
 * erwachte das Recht wieder, sobald der Haken erneut gesetzt wird.
 *
 * `assistantWrite` wird **immer** geschrieben, auch als leere Liste: Das
 * fehlende Feld bedeutet «alles beschreibbar» (siehe `assistantWriteOf`),
 * und genau das wäre das Gegenteil dessen, was «nur lesen» sagen will.
 */
function assistantFields(areas: AssistantArea[], write: AssistantArea[]) {
  const open = ASSISTANT_AREAS.filter((area) => areas.includes(area))
  return {
    assistantAreas: open,
    assistantWrite: open.filter((area) => write.includes(area)),
    updatedAt: serverTimestamp(),
  }
}

/**
 * Rolle, Bereiche und Schreibrechte in einem Zug – beim Freischalten einer
 * Assistenz.
 *
 * Zwei Schreibvorgänge nacheinander liessen für einen Augenblick eine
 * Assistenz ohne Bereich zurück; sie sähe die App und in ihr nichts. Und
 * bräche der zweite ab, bliebe genau dieser Zustand stehen.
 */
export async function setUserRoleWithAreas(
  userId: string,
  role: Role,
  areas: AssistantArea[],
  write: AssistantArea[],
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.users, userId), {
      role,
      ...assistantFields(areas, write),
    }),
  )
}

/** Deaktiviert ein Konto, ohne es zu löschen (Historie bleibt lesbar). */
export async function setUserActive(userId: string, active: boolean): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.users, userId), {
      active,
      updatedAt: serverTimestamp(),
    }),
  )
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<Pick<AppUser, 'displayName' | 'memberId' | 'color'>>,
): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.users, userId), {
      ...patch,
      ...(patch.displayName ? { initials: getInitials(patch.displayName) } : {}),
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Schaltet den Bereich «Anti Doom» für ein Konto frei bzw. wieder zu.
 *
 * Wie Rolle und Aktivstatus: Das darf ausschliesslich das
 * Administrator-Konto, und `firestore.rules` setzt es durch – die
 * Selbst-Update-Regel sperrt das Feld. Das Administrator-Konto selbst
 * sieht den Bereich auch ohne Schalter.
 */
export async function setUserImpulse(userId: string, impulse: boolean): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.users, userId), {
      impulse,
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Merkt sich, wie jemand den Aktivitätenplan sieht.
 *
 * Am Konto und nicht am Gerät: Wer den Plan als Kacheln mag, mag ihn am
 * Telefon genauso wie am Laptop. Im Browser liegt derselbe Stand noch
 * einmal (siehe `hooks/useApView`) – er gilt sofort und auch ohne Netz,
 * während dieser hier über alle Geräte hinweg gilt.
 *
 * Auch Konten ohne Vollzugriff dürfen das: Die Zugriffsregeln erlauben
 * jedem, sein eigenes Profil zu ändern, solange Rolle und Aktivstatus
 * unangetastet bleiben.
 *
 * Als einziger Schreibvorgang dieser Datei geht er unmittelbar an Firestore
 * und nicht über `lib/db` – er kommt also **nicht** ins Zugriffsprotokoll.
 * Das ist Absicht: Wer im Aktivitätenplan zwischen Liste, Kacheln und
 * Kalender hin- und herschaltet, ändert nichts am Bestand der Gemeinde,
 * sondern nur, was er selbst sieht. Im Protokoll stünde davon eine Zeile je
 * Klick – und begrübe darunter die Änderungen, wegen derer man es aufschlägt.
 */
export async function saveApView(userId: string, view: ApView): Promise<SaveOutcome> {
  return commit(
    fbUpdateDoc(doc(db, COLLECTIONS.users, userId), {
      apView: view,
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * Entfernt das Profil aus Firestore. Das Anmeldekonto selbst bleibt bestehen –
 * dafür braucht es die Firebase-Konsole oder das Admin-SDK.
 */
export async function deleteUserProfile(userId: string): Promise<SaveOutcome> {
  const outcome = await commit(deleteDoc(doc(db, COLLECTIONS.users, userId)))
  forgetDoc(COLLECTIONS.users, userId)
  return outcome
}
