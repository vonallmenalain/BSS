import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ExternalLink, Play, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  impulseEmbedBox,
  impulseEmbedHello,
  impulseEmbedMessage,
  impulseEmbedOrigin,
  impulseEmbedReport,
  impulseEmbedSeekMessage,
  impulseEmbedUrl,
  impulseScrubTime,
  impulseSoundBlocked,
  impulseVideoClock,
  impulseVideoHost,
  type ImpulseEmbedBox,
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
 *   unten rollt den Feed, ein Wisch zur Seite spult. Das Video steht im
 *   Vollbild allein da; der erste Tipp holt Titel, Text, Zeit und Ton
 *   hervor, der zweite hält an.
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
  info,
}: {
  source: ImpulseVideoSource
  /** Das Vorschaubild – steht, solange das Video nicht läuft. */
  poster?: string | null
  title: string
  /** Ist die Karte im Bild? Nur dann läuft etwas. */
  active: boolean
  /**
   * Was über das Video gehört – Titel, Text, Quelle, Amen und Merken.
   * Beim eingebetteten Video holt es erst ein Tipp hervor; vorher steht
   * das Video allein da.
   */
  info?: ReactNode
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
    return (
      <EmbeddedVideo source={source} poster={poster} title={title} active={active} info={info} />
    )
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
 * anstossen, die er gar nicht sieht. Bis dahin steht das Vorschaubild
 * (oder ein ruhiger Grund) – ohne Startknopf: Das Video startet ja von
 * selbst.
 */
function EmbeddedVideo({
  source,
  poster,
  title,
  active,
  info,
}: {
  source: ImpulseVideoSource
  poster?: string | null
  title: string
  active: boolean
  info?: ReactNode
}) {
  const [embedded, setEmbedded] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setEmbedded(active), active ? 180 : 0)
    return () => window.clearTimeout(timer)
  }, [active])

  return (
    <div className="absolute inset-0 bg-black">
      {embedded ? (
        <EmbedFrame source={source} poster={poster} title={title} info={info} />
      ) : (
        <div className="absolute inset-0">
          <Poster poster={poster} />
        </div>
      )}
    </div>
  )
}

/**
 * Die Fremdkarte selbst – im Vollbild, ohne die Oberfläche des Anbieters,
 * unter einer Wischfläche und gesteuert von der App.
 *
 * **Nur das Video.** YouTube legt Titel, Kanal, das Zeichen «Shorts» und
 * seinen Startknopf über das Video. Den Startknopf braucht es nicht, wenn
 * das Video sofort läuft: Wo der Browser lautes Abspielen nie erlaubt (am
 * iPhone, `impulseSoundBlocked`), startet es darum gleich stumm. Seine
 * Bedienleiste zeigt YouTube gar nicht erst (`controls=0`), und Titel
 * und Kanal stehen am Rand seines Rahmens – den legt die Karte so, dass
 * dieser Rand ausserhalb liegt und abgeschnitten wird (`impulseEmbedBox`).
 * Ein Short füllt dabei den ganzen Bildschirm. Bis das Video läuft, deckt
 * ein Vorhang den Rahmen zu.
 *
 * **Der erste Tipp zeigt, der zweite hält an.** Während das Video läuft,
 * steht nichts darüber. Ein Tipp holt alles hervor, was dazugehört – von
 * unten auf einem dunklen Schleier: Titel, Text und Quelle der Karte samt
 * Amen und Merken (`info`), die Zeit, die Leiste und den Ton. Nach ein paar
 * Sekunden verschwindet es wieder. Ein Tipp, solange es zu sehen ist, hält
 * das Video an; dann bleibt alles stehen, mit dem Startzeichen in der
 * Mitte, und der nächste Tipp lässt es weiterlaufen.
 *
 * Ein Rahmen einer fremden Seite behält jede Berührung für sich: Wer
 * darauf wischt, rollt nicht den Feed, sondern höchstens das Video. Die
 * Wischfläche darüber gehört zur App, und die Karte sagt der Fremdkarte
 * per Nachricht, was sie tun soll (`impulseEmbedMessage`):
 *
 * - **Nach oben und unten** rollt der Feed wie auf jeder anderen Karte.
 * - **Ein Wisch zur Seite spult** – nach rechts vor, nach links zurück;
 *   die ganze Breite ist die ganze Länge, wie bei der Leiste. Die Fläche
 *   lässt nur das senkrechte Rollen dem Browser (`touch-pan-y`), das
 *   seitliche bekommt sie selbst. Am Rechner spulen die Pfeiltasten links
 *   und rechts um fünf Sekunden.
 * - **Der Ton** sitzt bei den Angaben unten rechts. Läuft das Video stumm,
 *   bleibt dort auch ohne Tipp ein kleiner Knopf stehen – sonst fände
 *   niemand den Ton.
 * - **Mit Ton, wo es geht.** Lehnt der Browser das laute Abspielen trotzdem
 *   ab, meldet die Fremdkarte, dass sie steht. Dann startet die Karte das
 *   Video stumm – lieber ein leises Video als ein stehendes Bild. Hat die
 *   Person schon selbst eingegriffen, startet die Karte nichts mehr von
 *   sich aus.
 *
 * Meldet die Fremdkarte gar nichts (etwa weil der Anbieter seine
 * Schnittstelle ändert), läuft es weiter wie ohne Meldungen: Der Vorhang
 * geht nach ein paar Sekunden trotzdem auf, der Tipp wechselt zwischen
 * Anhalten und Weiterlaufen, der Ton zwischen an und aus – nur der stumme
 * Neustart, die Leiste und das Spulen entfallen.
 */
function EmbedFrame({
  source,
  poster,
  title,
  info,
}: {
  source: ImpulseVideoSource
  poster?: string | null
  title: string
  info?: ReactNode
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  /* Lässt der Browser keinen Ton zu, startet das Video gleich stumm. */
  const [quietStart] = useState(() =>
    impulseSoundBlocked(navigator.userAgent, navigator.maxTouchPoints ?? 0),
  )
  /* Läuft es? `null`, solange die Fremdkarte nichts gemeldet hat. */
  const [playing, setPlaying] = useState<boolean | null>(null)
  const [muted, setMuted] = useState(quietStart)
  /* Läuft es schon einmal? Bis dahin deckt der Vorhang den Rahmen zu. */
  const [started, setStarted] = useState(false)
  /* Stehen Titel, Zeit und Ton über dem Video? */
  const [shown, setShown] = useState(false)
  /* Dasselbe für die Handgriffe und Zeitgeber, die den neuesten Stand
     brauchen, ohne neu aufgesetzt zu werden. */
  const playingRef = useRef<boolean | null>(null)
  const mutedRef = useRef(quietStart)
  /* Wo das Video steht und wie lang es ist – die Leiste. */
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

  /* Der Rahmen, so gelegt, dass von der Fremdkarte nur das Video bleibt. */
  const [box, setBox] = useState<ImpulseEmbedBox | null>(null)
  const aspect = source.art === 'youtube' && source.short ? 9 / 16 : 16 / 9
  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    const measure = () => setBox(impulseEmbedBox(element.clientWidth, element.clientHeight, aspect))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [aspect])

  const showPlaying = (value: boolean) => {
    playingRef.current = value
    setPlaying(value)
    if (value) setStarted(true)
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

  /* Die Angaben über dem Video: stehen bleiben (angehalten, beim Spulen)
     oder nach ein paar Sekunden wieder verschwinden. */
  const hideTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])
  const keepShown = () => {
    window.clearTimeout(hideTimer.current)
    setShown(true)
  }
  const showForAWhile = () => {
    keepShown()
    hideTimer.current = window.setTimeout(() => {
      if (playingRef.current === false || scrub.current?.active) return
      setShown(false)
    }, 3500)
  }

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
     antwortet: Ihr Skript hört nicht unbedingt schon beim Laden zu. Meldet
     sie sich gar nicht, geht der Vorhang trotzdem auf. */
  const helloTimer = useRef<number | undefined>(undefined)
  const curtainTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearInterval(helloTimer.current)
      window.clearTimeout(curtainTimer.current)
    },
    [],
  )
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
    window.clearTimeout(curtainTimer.current)
    curtainTimer.current = window.setTimeout(() => setStarted(true), 3000)
  }

  /* Ein Tipp: Zuerst zeigt er, was dazugehört; steht das schon da (oder
     steht das Video), hält er an oder lässt weiterlaufen. Ohne Meldungen
     zählt der eigene Stand; mit Meldungen sagt die Fremdkarte, was daraus
     geworden ist – ein abgelehntes Abspielen soll nicht als laufend
     dastehen. */
  const toggle = () => {
    if (scrubbed.current) {
      scrubbed.current = false
      return
    }
    if (!shown && playingRef.current !== false) {
      showForAWhile()
      return
    }
    touched.current = true
    const next = !(playingRef.current ?? true)
    send(next ? 'play' : 'pause')
    if (!heard.current || !next) showPlaying(next)
    if (next) showForAWhile()
    else keepShown()
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
      keepShown()
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
    if (playingRef.current === false) keepShown()
    else showForAWhile()
  }

  /* Am Rechner: die Pfeiltasten links und rechts, fünf Sekunden je Druck. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (!(durationRef.current > 0)) return
    event.preventDefault()
    touched.current = true
    const step = event.key === 'ArrowRight' ? 5 : -5
    seek(Math.min(durationRef.current, Math.max(0, currentTime() + step)), true)
    showForAWhile()
  }

  /* Der Ton – und wer ihn einschaltet, will das Video auch laufen sehen. */
  const toggleSound = () => {
    touched.current = true
    const next = !mutedRef.current
    send(next ? 'mute' : 'unmute')
    if (!next && playingRef.current === false) send('play')
    showMuted(next)
    if (shown) showForAWhile()
  }

  const embedUrl = impulseEmbedUrl(source, window.location.origin, { muted: quietStart })
  if (!embedUrl) return null

  const visible = shown || scrubTo !== null
  const progress = duration > 0 ? (Math.min(scrubTo ?? time, duration) / duration) * 100 : 0
  const soundLabel = muted ? 'Ton einschalten' : 'Ton ausschalten'

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden bg-black">
      <iframe
        ref={frameRef}
        src={embedUrl}
        title={title}
        onLoad={onLoad}
        /* Bedient wird über die Wischfläche – in den Rahmen führt kein Weg. */
        tabIndex={-1}
        className="pointer-events-none absolute border-0"
        style={
          box
            ? { left: box.left, top: box.top, width: box.width, height: box.height }
            : { inset: 0, width: '100%', height: '100%' }
        }
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        /* Die Fremdkarte bekommt so wenig wie möglich mit: kein
           Zugriff auf die App, nur ihr eigenes Fenster. */
        referrerPolicy="strict-origin-when-cross-origin"
      />

      {/* Der Vorhang: deckt den Rahmen zu, bis das Video läuft – sonst
          stünden kurz Titel, Kanal und Startknopf des Anbieters da. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-300',
          started ? 'opacity-0' : 'opacity-100',
        )}
      >
        <Poster poster={poster} />
      </div>

      {/* Die Wischfläche: Auf ihr rollt der Feed nach oben und unten, zur
          Seite spult sie, ein Tipp zeigt die Angaben oder hält an. */}
      <button
        type="button"
        onClick={toggle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={onKeyDown}
        aria-label={
          playing === false
            ? 'Video abspielen'
            : shown
              ? 'Video anhalten'
              : 'Angaben zum Video zeigen'
        }
        className="absolute inset-0 cursor-pointer touch-pan-y focus-visible:-outline-offset-4"
      >
        {playing === false && started && scrubTo === null && <PlaySign />}
        {scrubTo !== null && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="tabular rounded-full bg-slate-950/60 px-4 py-2 text-lg font-semibold text-white backdrop-blur-sm">
              {impulseVideoClock(scrubTo)}
              <span className="font-normal opacity-70"> / {impulseVideoClock(duration)}</span>
            </span>
          </span>
        )}
      </button>

      {/* Ohne Tipp steht nichts über dem Video – ausser dem Ton, wenn er
          fehlt: sonst fände ihn niemand. */}
      {!visible && muted && (
        <div className="pointer-events-none absolute right-0 bottom-0 pb-safe">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundLabel}
            className="pointer-events-auto m-3 mb-8 grid size-9 place-items-center rounded-full bg-slate-950/45 text-white backdrop-blur-sm transition active:scale-95"
          >
            <VolumeX className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Die Angaben: von unten auf einem dunklen Schleier – Titel, Text,
          Quelle, Amen und Merken, dann Zeit, Ton und die Leiste. Der
          Schleier selbst lässt Berührungen durch (ein Tipp darauf ist ein
          Tipp aufs Video), nur Links und Knöpfe nehmen sie an. Hell auf
          dunkel, auch im hellen Modus (`dark`). */}
      <div
        className={cn(
          'dark pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-28 pb-safe text-white transition-[opacity,visibility] duration-200',
          visible ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        {info && (
          <div className="mx-auto w-full max-w-xl px-4 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_h2]:text-xl">
            {info}
          </div>
        )}
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-3 pb-2">
          {duration > 0 && (
            <span className="tabular text-xs font-medium text-white/85">
              {impulseVideoClock(scrubTo ?? time)} / {impulseVideoClock(duration)}
            </span>
          )}
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundLabel}
            className={cn(
              'pointer-events-auto ms-auto flex h-10 items-center gap-1.5 rounded-full bg-white/15 text-white backdrop-blur-sm transition active:scale-95',
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
        {duration > 0 && (
          <div
            aria-hidden
            className={cn(
              'bg-white/25 transition-[height] duration-150',
              scrubTo !== null ? 'h-1.5' : 'h-1',
            )}
          >
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
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
