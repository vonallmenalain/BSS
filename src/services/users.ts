import { doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { getInitials } from '@/lib/utils'
import type { AppUser, Role } from '@/lib/types'

/**
 * Schaltet ein wartendes Konto frei bzw. ändert die Rolle – auch die eigene.
 *
 * Freigeschaltete Konten dürfen das, wartende nicht: Andernfalls könnte sich
 * jedes neu registrierte Konto selbst Zugriff auf Personendaten geben.
 * Durchgesetzt wird das in `firestore.rules`.
 */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.users, userId), {
    role,
    updatedAt: serverTimestamp(),
  })
}

/** Deaktiviert ein Konto, ohne es zu löschen (Historie bleibt lesbar). */
export async function setUserActive(userId: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.users, userId), {
    active,
    updatedAt: serverTimestamp(),
  })
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<Pick<AppUser, 'displayName' | 'memberId' | 'color'>>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.users, userId), {
    ...patch,
    ...(patch.displayName ? { initials: getInitials(patch.displayName) } : {}),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Entfernt das Profil aus Firestore. Das Anmeldekonto selbst bleibt bestehen –
 * dafür braucht es die Firebase-Konsole oder das Admin-SDK.
 */
export async function deleteUserProfile(userId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.users, userId))
}
