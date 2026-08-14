import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Play, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { impulseEmbedUrl, impulseVideoHost, type ImpulseVideoSource } from '@/lib/impulseVideo'

/**
 * Das Video einer Video-Karte – die ganze Fläche, ohne Rahmen.
 *
 * Es liegt im Feed dort, wo bei anderen Karten das Bild liegt: hinter
 * dem Text, über den ganzen Bildschirm. Und es verhält sich, wie man es
 * von einem Feed erwartet:
 *
 * - **Es startet, wenn die Karte im Bild ist** (`active`), und hält an,
 *   sobald man weiterwischt. Eine eingebettete Fremdkarte (YouTube,
 *   Vimeo) wird dafür gar nicht erst geladen, solange sie nicht dran
 *   ist – das spart Daten und hält den Feed leise.
 * - **Stumm.** Nicht aus Zurückhaltung, sondern weil Browser ein Video
 *   nur ohne Ton von selbst starten lassen. Der Knopf «Ton an» steht
 *   gross genug da, um ihn nicht zu suchen.
 * - **Vollbild** ist der Normalfall, nicht ein Knopf: Die Karte selbst
 *   ist der Bildschirm. Wer die Bedienung des Anbieters braucht (spulen,
 *   Untertitel), findet sie in der eingebetteten Karte; die Videodatei
 *   bringt beim Antippen die eigene Leiste mit.
 *
 * Was sich nicht einbetten lässt – eine Videoseite der Kirche etwa,
 * deren Server das verbietet –, wird zur ruhigen Karte mit einem Knopf,
 * der das Video draussen öffnet. Lieber ein ehrlicher Weg hinaus als ein
 * schwarzes Rechteck.
 */
export function ImpulseVideoPlayer({
  source,
  poster,
  title,
  active,
}: {
  source: ImpulseVideoSource
  /** Das Vorschaubild – steht, solange das Video nicht läuft. */
  poster?: string | null
  title: string
  /** Ist die Karte im Bild? Nur dann läuft etwas. */
  active: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [muted, setMuted] = useState(true)
  /*
   * Die Fremdkarte (YouTube, Vimeo) hängt am Auftritt: Sie kommt, wenn
   * die Karte im Bild steht, und verschwindet mit ihr – das ist die eine
   * verlässliche Art, ein fremdes Video zum Schweigen zu bringen. Die
   * kurze Verzögerung ist Absicht: Wer mit dem Daumen durch die Woche
   * fliegt, soll nicht fünf Videos anstossen, die er gar nicht sieht.
   */
  const [embedded, setEmbedded] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setEmbedded(active), active ? 180 : 0)
    return () => window.clearTimeout(timer)
  }, [active])

  /* Die eigene Videodatei: läuft mit der Karte, hält mit ihr an – und
     beginnt beim Wiederkommen von vorn, wie eine Karte, die man neu
     aufschlägt. */
  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    if (active) {
      const promise = element.play()
      // Ein abgelehntes Abspielen ist kein Fehler, nur eine Regel des Browsers.
      if (promise) promise.catch(() => {})
    } else {
      element.pause()
      element.currentTime = 0
    }
  }, [active])

  /* YouTube und Vimeo hören auf Zurufe durch das Fenster – so lässt sich
     der Ton dazuschalten, ohne fremde Skripte zu laden. */
  const tellEmbed = (command: 'mute' | 'unMute') => {
    const frame = frameRef.current
    if (!frame?.contentWindow) return
    if (source.art === 'youtube') {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args: [] }),
        'https://www.youtube-nocookie.com',
      )
    } else if (source.art === 'vimeo') {
      frame.contentWindow.postMessage(
        JSON.stringify({ method: 'setVolume', value: command === 'mute' ? 0 : 1 }),
        'https://player.vimeo.com',
      )
    }
  }

  const toggleSound = () => {
    const next = !muted
    setMuted(next)
    const element = videoRef.current
    if (element) {
      element.muted = next
      if (!next) {
        const promise = element.play()
        if (promise) promise.catch(() => {})
      }
    }
    tellEmbed(next ? 'mute' : 'unMute')
  }

  /* Nicht einbettbar: ein Vorschaubild (oder ein ruhiger Grund) und der
     Weg hinaus – ohne Versprechen, das die Karte nicht halten kann. */
  if (source.art === 'seite') {
    return (
      <div className="absolute inset-0">
        {poster ? (
          <img src={poster} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-b from-slate-800 to-slate-950" />
        )}
        <div className="absolute inset-0 grid place-items-center bg-slate-950/45">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 text-white transition active:scale-95"
          >
            <span className="grid size-16 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
              <Play className="size-7 fill-current" aria-hidden />
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              Video öffnen
              <ExternalLink className="size-3.5" aria-hidden />
            </span>
            <span className="text-xs opacity-80">auf {impulseVideoHost(source)}</span>
          </a>
        </div>
      </div>
    )
  }

  const embedUrl = impulseEmbedUrl(source)

  return (
    <div className="absolute inset-0 bg-black">
      {source.art === 'datei' ? (
        <video
          ref={videoRef}
          src={source.url}
          poster={poster ?? undefined}
          className="size-full object-cover"
          playsInline
          muted={muted}
          loop
          preload="metadata"
          controls={!muted}
          aria-label={title}
        />
      ) : (
        embedded &&
        embedUrl && (
          <iframe
            ref={frameRef}
            src={embedUrl}
            title={title}
            className="size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            /* Die Fremdkarte bekommt so wenig wie möglich mit: kein
               Zugriff auf die App, nur ihr eigenes Fenster. */
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )
      )}

      {/* Solange nichts läuft, steht das Vorschaubild – sonst blitzt beim
          Einbetten kurz Schwarz auf. */}
      {source.art !== 'datei' && !embedded && (
        <div className="absolute inset-0">
          {poster ? (
            <img src={poster} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-gradient-to-b from-slate-800 to-slate-950" />
          )}
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm">
              <Play className="size-7 fill-current" aria-hidden />
            </span>
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={toggleSound}
        className="absolute end-3 bottom-3 z-20 flex items-center gap-1.5 rounded-full bg-slate-950/55 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-slate-950/70 active:scale-95"
        aria-pressed={!muted}
      >
        {muted ? (
          <>
            <VolumeX className="size-4" aria-hidden />
            Ton an
          </>
        ) : (
          <>
            <Volume2 className="size-4" aria-hidden />
            Ton aus
          </>
        )}
      </button>
    </div>
  )
}

/** Der stille Hinweis auf der Karte: Hier läuft ein Video. */
export function ImpulseVideoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-slate-950/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm',
        className,
      )}
    >
      <Play className="size-3 fill-current" aria-hidden />
      Video
    </span>
  )
}
