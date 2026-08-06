import { doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { forgetDoc } from '@/lib/collectionStore'
import { getInitials } from '@/lib/utils'
import { commit, type SaveOutcome } from '@/lib/sync'
import type { ApView, AppUser, Role } from '@/lib/types'

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
 */
export async function saveApView(userId: string, view: ApView): Promise<SaveOutcome> {
  return commit(
    updateDoc(doc(db, COLLECTIONS.users, userId), {
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
