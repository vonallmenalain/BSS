import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Wartebereich für Konten, die noch keine Rolle haben.
 * Ohne Freigabe kommt niemand an Personendaten – das ist bewusst so.
 *
 * Hier steht nur, was die wartende Person angeht. Eine Anleitung zum
 * Freischalten stand einmal darunter – sie richtete sich an jemand anderen
 * und stand am falschen Bildschirm. Die Bischofschaft sieht die neue
 * Registrierung von sich aus auf der Übersicht.
 */
export function PendingApproval() {
  const { profile, firebaseUser, signOut } = useAuth()
  const name = profile?.displayName ?? firebaseUser?.displayName ?? ''
  const inactive = profile && !profile.active
  /*
   * Eine Assistenz ohne einen einzigen Bereich.
   *
   * Sie ist freigeschaltet und sieht trotzdem nichts – das ist gewollt (so
   * entzieht man den Zugang, ohne die Rolle zu ändern), aber es sähe wie ein
   * Fehler aus, stünde hier «wartet auf eine Rolle». Sie hat eine.
   */
  const withoutArea = profile?.role === 'assistant' && profile.active

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-100 dark:bg-amber-950">
          <Clock className="size-6 text-amber-600 dark:text-amber-300" aria-hidden />
        </div>

        <h1 className="text-lg font-semibold">
          {inactive
            ? 'Zugang deaktiviert'
            : withoutArea
              ? 'Kein Bereich freigeschaltet'
              : 'Freigabe ausstehend'}
        </h1>

        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {inactive ? (
            <>Dein Zugang wurde deaktiviert. Bitte wende dich an den Bischof.</>
          ) : withoutArea ? (
            <>
              Hallo {name}, dein Konto ist als Assistenz der Abendmahlsversammlung eingerichtet – es
              steht aber zurzeit kein Bereich offen. Die Bischofschaft schaltet Ansprachen, Musik
              und Gebet einzeln frei.
            </>
          ) : (
            <>
              Hallo {name}, dein Konto wurde erstellt. Ein Mitglied der Bischofschaft muss dir noch
              eine Rolle zuweisen, bevor du die Daten sehen kannst.
            </>
          )}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" aria-hidden />
            Neu prüfen
          </button>
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            <LogOut className="size-4" aria-hidden />
            Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}
