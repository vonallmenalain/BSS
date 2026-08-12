import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import type { NotificationSettings } from '@/lib/types'

/**
 * Die eigenen Benachrichtigungs-Einstellungen – und nur die eigenen.
 *
 * Als einziger Hook der App hängt dieser direkt an einem Dokument statt am
 * Sammlungs-Speicher (`lib/collectionStore`). Das hat einen Grund: Die
 * Zugriffsregel gibt jedem genau sein eigenes Dokument frei, und ein Abo
 * auf die Sammlung – das der Speicher aufbauen würde – scheiterte
 * zwangsläufig an der Regel. Ein Dokument ist ausserdem alles, was hier
 * je gebraucht wird.
 */
export function useNotificationSettings() {
  const { profile } = useAuth()
  const uid = profile?.id

  /*
   * Die UID steht im Zustand neben den Daten, und das aus zwei Gründen:
   * Der Effekt kommt ohne einen einzigen `setState` in seinem Rumpf aus
   * (alles Setzen geschieht im Rückruf des Abos), und nach einem
   * Kontowechsel gelten die Daten des alten Kontos sofort als veraltet
   * statt für einen Wimpernschlag als die eigenen.
   */
  const [state, setState] = useState<{ uid: string | null; settings: NotificationSettings | null }>(
    { uid: null, settings: null },
  )

  useEffect(() => {
    if (!uid) return

    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.notificationSettings, uid),
      (snapshot) => {
        setState({
          uid,
          settings: snapshot.exists()
            ? ({ id: snapshot.id, ...snapshot.data() } as NotificationSettings)
            : null,
        })
      },
      (error) => {
        console.warn('[benachrichtigungen] Einstellungen nicht lesbar:', error)
        setState({ uid, settings: null })
      },
    )
    return unsubscribe
  }, [uid])

  const current = state.uid === uid
  return { settings: current ? state.settings : null, loading: Boolean(uid) && !current }
}
