import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ExternalLink, Play, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  impulseEmbedHello,
  impulseEmbedMessage,
  impulseEmbedOrigin,
  impulseEmbedReport,
  impulseEmbedSeekMessage,
  impulseEmbedUrl,
  impulseScrubTime,
  impulseVideoClock,
  impulseVideoHost,
  type ImpulseEmbedCommand,
  type ImpulseVideoSource,
} from '@/lib/impulseVideo'

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
 * - **Mit Ton.** Ein Video ohne Ton ist ein halbes Video; es läuft von
 *   Anfang an laut. Nur wenn der Browser das ablehnt, springt es stumm
 *   an – lieber ein leises Video als ein stehendes Bild. Bei der
 *   Videodatei bedient den Ton ihre eigene Leiste, bei der Fremdkarte
 *   der Knopf unten rechts.
 * - **Vollbild** ist der Normalfall, nicht ein Knopf: Die Karte selbst
 *   ist der Bildschirm. Die Videodatei bringt ihre eigene Leiste mit.
 * - **Wischen geht auch auf dem Video** – wie bei Reels und Shorts. Eine
 *   eingebettete Fremdkarte (YouTube, Vimeo) behielte jede Berührung für
 *   sich, und der Daumen käme nicht zur nächsten Karte. Darum liegt über
 *   ihr eine Wischfläche (`EmbeddedVideo`): Ein Wisch nach oben oder
 *   unten rollt den Feed, ein Wisch zur Seite spult, ein Tipp hält das
 *   Video an oder lässt es weiterlaufen, und der Knopf unten rechts
 *   schaltet den Ton.
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

  /* Die eigene Videodatei: läuft mit der Karte, hält mit ihr an – und
     beginnt beim Wiederkommen von vorn, wie eine Karte, die man neu
     aufschlägt. */
  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    if (!active) {
      element.pause()
      element.currentTime = 0
      return
    }
    /* Zuerst mit Ton. Ein abgelehntes Abspielen ist kein Fehler, nur
       eine Regel des Browsers – dann eben stumm, aber laufend. Den Ton
       holt sich über die Leiste des Videos zurück, wer ihn will. */
    element.muted = false
    const promise = element.play()
    if (promise) {
      promise.catch(() => {
        element.muted = true
        const quiet = element.play()
        if (quiet) quiet.catch(() => {})
      })
    }
  }, [active])

  /* Nicht einbettbar: ein Vorschaubild (oder ein ruhiger Grund) und der
     Weg hinaus – ohne Versprechen, das die Karte nicht halten kann. */
  if (source.art === 'seite') {
    return (
      <div className="absolute inset-0">
        <Poster poster={poster} />
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

  if (source.art !== 'datei') {
    return <EmbeddedVideo source={source} poster={poster} title={title} active={active} />
  }

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        src={source.url}
        poster={poster ?? undefined}
        className="size-full object-cover"
        playsInline
        loop
        preload="metadata"
        /* Die Leiste des Videos ist zugleich der Tonknopf. */
        controls
        aria-label={title}
      />
    </div>
  )
}

/** Das Vorschaubild – oder ein ruhiger Grund, wenn es keines gibt. */
function Poster({ poster }: { poster?: string | null }) {
  return poster ? (
    <img src={poster} alt="" className="size-full object-cover" />
  ) : (
    <div className="size-full bg-gradient-to-b from-slate-800 to-slate-950" />
  )
}

/** Der runde Startknopf in der Mitte – nur ein Zeichen, der Tipp gehört der Fläche. */
function PlaySign() {
  return (
    <span className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="grid size-16 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm">
        <Play className="size-7 fill-current" aria-hidden />
      </span>
    </span>
  )
}

/**
 * Die eingebettete Fremdkarte (YouTube, Vimeo).
 *
 * Sie hängt am Auftritt: Sie kommt, wenn die Karte im Bild steht, und
 * verschwindet mit ihr – das ist die eine verlässliche Art, ein fremdes
 * Video zum Schweigen zu bringen. Die kurze Verzögerung ist Absicht:
 * Wer mit dem Daumen durch die Woche fliegt, soll nicht fünf Videos
 * anstossen, die er gar nicht sieht. Solange nichts läuft, steht das
 * Vorschaubild – sonst blitzt beim Einbetten kurz Schwarz auf.
 */
function EmbeddedVideo({
  source,
  poster,
  title,
  active,
}: {
  source: ImpulseVideoSource
  poster?: string | null
  title: string
  active: boolean
}) {
  const [embedded, setEmbedded] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setEmbedded(active), active ? 180 : 0)
    return () => window.clearTimeout(timer)
  }, [active])

  return (
    <div className="absolute inset-0 bg-black">
      {embedded ? (
        <EmbedFrame source={source} title={title} />
      ) : (
        <div className="absolute inset-0">
          <Poster poster={poster} />
          <PlaySign />
        </div>
      )}
    </div>
  )
}

/**
 * Die Fremdkarte selbst – unter einer Wischfläche, gesteuert von der App.
 *
 * Ein Rahmen einer fremden Seite behält jede Berührung für sich: Wer
 * darauf wischt, rollt nicht den Feed, sondern höchstens das Video. Die
 * Wischfläche darüber gehört zur App – auf ihr rollt der Feed wie auf
 * jeder anderen Karte, Reels und Shorts machen es genauso. Die Knöpfe
 * des Anbieters liegen dafür unter ihr; die Karte bringt die nötigen
 * selbst mit und sagt sie der Fremdkarte per Nachricht
 * (`impulseEmbedMessage`):
 *
 * - **Ein Tipp** hält das Video an oder lässt es weiterlaufen. Steht es,
 *   zeigt die Mitte das Startzeichen.
 * - **Ein Wisch zur Seite spult** – nach rechts vor, nach links zurück;
 *   die ganze Breite ist die ganze Länge, wie bei der Leiste ganz unten.
 *   Nach oben und unten bleibt der Wisch dem Feed: Die Fläche lässt nur
 *   das senkrechte Rollen dem Browser (`touch-pan-y`), das seitliche
 *   bekommt sie selbst. Am Rechner spulen die Pfeiltasten links und
 *   rechts um fünf Sekunden.
 * - **Der Ton** sitzt unten rechts.
 * - **Mit Ton, wo es geht.** Lehnt der Browser das laute Abspielen ab
 *   (am iPhone ohne vorherige Berührung im Video immer), meldet die
 *   Fremdkarte, dass sie steht. Dann startet die Karte das Video stumm –
 *   lieber ein leises Video als ein stehendes Bild – und der Knopf
 *   unten rechts heisst «Ton an». Hat die Person schon selbst
 *   eingegriffen, startet die Karte nichts mehr von sich aus.
 *
 * Meldet die Fremdkarte gar nichts (etwa weil der Anbieter seine
 * Schnittstelle ändert), läuft es weiter wie ohne Meldungen: Der Tipp
 * wechselt zwischen Anhalten und Weiterlaufen, der Ton zwischen an und
 * aus – nur der stumme Neustart unterbleibt.
 */
function EmbedFrame({ source, title }: { source: ImpulseVideoSource; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  /* Läuft es? `null`, solange die Fremdkarte nichts gemeldet hat. */
  const [playing, setPlaying] = useState<boolean | null>(null)
  const [muted, setMuted] = useState(false)
  /* Dasselbe für die Handgriffe und Zeitgeber, die den neuesten Stand
     brauchen, ohne neu aufgesetzt zu werden. */
  const playingRef = useRef<boolean | null>(null)
  const mutedRef = useRef(false)
  /* Wo das Video steht und wie lang es ist – die Leiste ganz unten. */
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const durationRef = useRef(0)
  /* Der letzte gemeldete Stand: Dazwischen rückt die Leiste von selbst
     weiter, die Fremdkarte meldet nicht jeden Augenblick. */
  const clock = useRef({ time: 0, at: 0 })
  const heard = useRef(false)
  /* Der Daumen beim Spulen – siehe «Spulen» weiter unten. */
  const scrub = useRef<{
    pointer: number
    x: number
    y: number
    from: number
    width: number
    to: number
    active: boolean
    sentAt: number
  } | null>(null)
  const [scrubTo, setScrubTo] = useState<number | null>(null)
  /* Nach dem Spulen mit der Maus folgt ein Klick – der hält nicht an. */
  const scrubbed = useRef(false)
  const touched = useRef(false)
  const sourceRef = useRef(source)
  useEffect(() => {
    sourceRef.current = source
  })

  const showPlaying = (value: boolean) => {
    playingRef.current = value
    setPlaying(value)
  }
  const showMuted = (value: boolean) => {
    mutedRef.current = value
    setMuted(value)
  }
  const showTime = (value: number) => {
    clock.current = { time: value, at: performance.now() }
    setTime(value)
  }
  /* Wo das Video jetzt steht: die letzte Meldung, weitergezählt, solange es läuft. */
  const currentTime = () =>
    clock.current.time + (playingRef.current ? (performance.now() - clock.current.at) / 1000 : 0)

  const send = (command: ImpulseEmbedCommand) => {
    const message = impulseEmbedMessage(sourceRef.current, command)
    const origin = impulseEmbedOrigin(sourceRef.current)
    if (message && origin) frameRef.current?.contentWindow?.postMessage(message, origin)
  }
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })

  /* Steht das Video kurz nach seiner ersten Meldung noch, hat der
     Browser den Ton abgelehnt: dann stumm, aber laufend. Gezählt ab der
     ersten Meldung, nicht ab dem Einbetten – auf langsamem Netz lädt die
     Fremdkarte länger, als die Geduld reichte. */
  const quietTimer = useRef<number | undefined>(undefined)
  const startQuietly = () => {
    if (touched.current || playingRef.current !== false) return
    sendRef.current('mute')
    sendRef.current('play')
    showMuted(true)
  }

  /* Die Meldungen der Fremdkarte – nur ihre eigenen, von ihrem Ursprung. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return
      if (event.origin !== impulseEmbedOrigin(sourceRef.current)) return
      const report = impulseEmbedReport(sourceRef.current, event.data)
      if (!report) return
      if (!heard.current) quietTimer.current = window.setTimeout(() => startQuietly(), 1500)
      heard.current = true
      if (report.playing !== undefined) showPlaying(report.playing)
      if (report.muted !== undefined) showMuted(report.muted)
      if (report.duration !== undefined) {
        durationRef.current = report.duration
        setDuration(report.duration)
      }
      /* Während des Spulens gilt der Daumen, nicht die Meldung. */
      if (report.time !== undefined && !scrub.current?.active) showTime(report.time)
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(quietTimer.current)
    }
    // Einmal aufgesetzt: Was es braucht, liest es aus Refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Anmelden, sobald die Fremdkarte geladen hat – und nachfassen, bis sie
     antwortet: Ihr Skript hört nicht unbedingt schon beim Laden zu. */
  const helloTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearInterval(helloTimer.current), [])
  const onLoad = () => {
    const hello = () => {
      const origin = impulseEmbedOrigin(sourceRef.current)
      const target = frameRef.current?.contentWindow
      if (!origin || !target) return
      for (const message of impulseEmbedHello(sourceRef.current))
        target.postMessage(message, origin)
    }
    hello()
    let tries = 0
    window.clearInterval(helloTimer.current)
    helloTimer.current = window.setInterval(() => {
      tries += 1
      if (heard.current || tries > 10) window.clearInterval(helloTimer.current)
      else hello()
    }, 400)
  }

  /* Ein Tipp: anhalten oder weiter. Ohne Meldungen zählt der eigene
     Stand; mit Meldungen sagt die Fremdkarte, was daraus geworden ist –
     ein abgelehntes Abspielen soll nicht als laufend dastehen. */
  const toggle = () => {
    if (scrubbed.current) {
      scrubbed.current = false
      return
    }
    touched.current = true
    const next = !(playingRef.current ?? true)
    send(next ? 'play' : 'pause')
    if (!heard.current || !next) showPlaying(next)
  }

  /* Zwischen zwei Meldungen rückt die Leiste von selbst weiter. */
  useEffect(() => {
    if (!playing || !(duration > 0)) return
    const timer = window.setInterval(() => {
      if (scrub.current?.active) return
      const { time: base, at } = clock.current
      setTime(Math.min(duration, base + (performance.now() - at) / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [playing, duration])

  /* ---------------- Spulen ---------------- */

  const seek = (seconds: number, done: boolean) => {
    const message = impulseEmbedSeekMessage(sourceRef.current, seconds, done)
    const origin = impulseEmbedOrigin(sourceRef.current)
    if (message && origin) frameRef.current?.contentWindow?.postMessage(message, origin)
    if (done) showTime(seconds)
  }

  /*
   * Ein Daumen auf der Fläche: Geht er zur Seite, spult er; geht er nach
   * oben oder unten, rollt der Browser den Feed und meldet das Ende
   * dieses Daumens (`pointercancel`). Erst ab ein paar Pixeln zur Seite
   * wird gespult – ein Tipp, der ein wenig verrutscht, bleibt ein Tipp.
   * Unterwegs zeigt YouTube die Stelle alle paar Augenblicke an, beim
   * Loslassen lädt es von dort weiter.
   */

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    scrubbed.current = false
    if (!(durationRef.current > 0)) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    scrub.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      from: currentTime(),
      width: event.currentTarget.clientWidth,
      to: 0,
      active: false,
      sentAt: 0,
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = scrub.current
    if (!current || current.pointer !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.active) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return
      current.active = true
      touched.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    current.to = impulseScrubTime(current.from, dx, current.width, durationRef.current)
    setScrubTo(current.to)
    const now = performance.now()
    if (now - current.sentAt > 200) {
      current.sentAt = now
      seek(current.to, false)
    }
  }

  const endScrub = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = scrub.current
    if (!current || current.pointer !== event.pointerId) return
    scrub.current = null
    if (!current.active) return
    scrubbed.current = true
    seek(current.to, true)
    setScrubTo(null)
  }

  /* Am Rechner: die Pfeiltasten links und rechts, fünf Sekunden je Druck. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (!(durationRef.current > 0)) return
    event.preventDefault()
    touched.current = true
    const step = event.key === 'ArrowRight' ? 5 : -5
    seek(Math.min(durationRef.current, Math.max(0, currentTime() + step)), true)
  }

  /* Der Ton – und wer ihn einschaltet, will das Video auch laufen sehen. */
  const toggleSound = () => {
    touched.current = true
    const next = !mutedRef.current
    send(next ? 'mute' : 'unmute')
    if (!next && playingRef.current === false) send('play')
    showMuted(next)
  }

  const embedUrl = impulseEmbedUrl(source, window.location.origin)
  if (!embedUrl) return null

  return (
    <>
      <iframe
        ref={frameRef}
        src={embedUrl}
        title={title}
        onLoad={onLoad}
        /* Bedient wird über die Wischfläche – in den Rahmen führt kein Weg. */
        tabIndex={-1}
        className="pointer-events-none size-full"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        /* Die Fremdkarte bekommt so wenig wie möglich mit: kein
           Zugriff auf die App, nur ihr eigenes Fenster. */
        referrerPolicy="strict-origin-when-cross-origin"
      />
      {/* Die Wischfläche: Auf ihr rollt der Feed nach oben und unten, zur
          Seite spult sie, ein Tipp hält an. */}
      <button
        type="button"
        onClick={toggle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={onKeyDown}
        aria-label={playing === false ? 'Video abspielen' : 'Video anhalten'}
        className="absolute inset-0 cursor-pointer touch-pan-y focus-visible:-outline-offset-4"
      >
        {playing === false && scrubTo === null && <PlaySign />}
        {scrubTo !== null && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="tabular rounded-full bg-slate-950/60 px-4 py-2 text-lg font-semibold text-white backdrop-blur-sm">
              {impulseVideoClock(scrubTo)}
              <span className="font-normal opacity-70"> / {impulseVideoClock(duration)}</span>
            </span>
          </span>
        )}
      </button>
      {/* Die Leiste ganz unten: wie weit das Video ist – beim Spulen kräftiger. */}
      {duration > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-safe" aria-hidden>
          <div
            className={cn(
              'bg-white/25 transition-[height] duration-150',
              scrubTo !== null ? 'h-1.5' : 'h-[3px]',
            )}
          >
            <div
              className="h-full bg-white"
              style={{ width: `${(Math.min(scrubTo ?? time, duration) / duration) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute right-0 bottom-0 pb-safe">
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? 'Ton einschalten' : 'Ton ausschalten'}
          className={cn(
            'pointer-events-auto m-3 mb-8 flex h-10 items-center gap-1.5 rounded-full bg-slate-950/55 text-white backdrop-blur-sm transition active:scale-95',
            muted ? 'px-3.5 text-sm font-medium' : 'w-10 justify-center',
          )}
        >
          {muted ? (
            <>
              <VolumeX className="size-4" aria-hidden />
              Ton an
            </>
          ) : (
            <Volume2 className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </>
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
