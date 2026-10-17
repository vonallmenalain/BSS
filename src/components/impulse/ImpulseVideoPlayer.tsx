import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ExternalLink, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  impulseEmbedBox,
  impulseEmbedHello,
  impulseEmbedMessage,
  impulseEmbedOrigin,
  impulseEmbedRateMessage,
  impulseEmbedReport,
  impulseEmbedSeekMessage,
  impulseEmbedUrl,
  impulseScrubTime,
  impulseSoundBlocked,
  impulseVideoClock,
  impulseVideoHost,
  impulseVideoThumbnail,
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
 * - **Tippen blendet ein und aus, Wischen wischt** – wie bei Reels und
 *   Shorts. Eine eingebettete Fremdkarte (YouTube, Vimeo) behielte jede
 *   Berührung für sich, und der Daumen käme nicht zur nächsten Karte.
 *   Darum gehört die ganze Fläche der App, und sie bringt ihre eigenen
 *   Knöpfe mit (`EmbeddedVideo`): Ein Tipp irgendwo blendet Titel, Text,
 *   Zeit und Ton ein und wieder aus, der Knopf in der Mitte hält an. Ein
 *   Wisch nach oben oder unten rollt den Feed, ein Wisch zur Seite spult.
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
   * Beim eingebetteten Video blendet es ein Tipp ein und wieder aus;
   * vorher steht das Video allein da.
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
  /* Kommt das Bild nicht (etwa das von YouTube), bleibt der ruhige Grund –
     nicht das Zeichen für ein fehlendes Bild. */
  const [failed, setFailed] = useState<string | null>(null)
  return poster && failed !== poster ? (
    <img src={poster} alt="" onError={() => setFailed(poster)} className="size-full object-cover" />
  ) : (
    <div className="size-full bg-gradient-to-b from-slate-800 to-slate-950" />
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
  /* Ohne eigenes Bild das Vorschaubild von YouTube – dasselbe vor dem
     Einbetten wie auf dem Vorhang, damit nichts umspringt. */
  const picture = poster ?? impulseVideoThumbnail(source)

  return (
    <div className="absolute inset-0 bg-black">
      {embedded ? (
        <EmbedFrame source={source} poster={picture} title={title} info={info} />
      ) : (
        <div className="absolute inset-0">
          <Poster poster={picture} />
        </div>
      )}
    </div>
  )
}

/**
 * Die Fremdkarte selbst – bedient mit den Knöpfen der App, nicht mit
 * denen des Anbieters.
 *
 * Ein Rahmen einer fremden Seite behält jede Berührung für sich: Wer
 * darauf wischt, rollt nicht den Feed, sondern höchstens das Video. Und
 * der Browser entscheidet schon beim Aufsetzen des Fingers, wem die
 * Berührung gehört – dem Rahmen oder der App. Tippen bei YouTube und
 * Wischen in der App geht darum nicht zugleich. Also gehört die ganze
 * Fläche der App (`touch-pan-y`), und die Karte bringt alles selbst mit,
 * was es braucht – YouTube zeigt seine Knöpfe gar nicht erst
 * (`controls=0`, siehe `impulseEmbedUrl`). Was zu tun ist, sagt sie der
 * Fremdkarte per Nachricht (`impulseEmbedMessage`):
 *
 * - **Ein Tipp blendet ein und aus** – überall im Bild, das ganze Video
 *   lang, so oft man will. Von unten auf einem dunklen Schleier: Titel,
 *   Text und Quelle der Karte samt Amen und Merken (`info`), die Zeit, der
 *   Ton und die Leiste; in der Mitte der Knopf zum Anhalten. Ein Tipp hält
 *   nie an und blendet nie von selbst wieder aus.
 * - **Nur der Knopf in der Mitte hält an** und lässt weiterlaufen. Steht
 *   das Video, bleibt er auch bei ausgeblendeten Angaben stehen – man
 *   sieht, warum sich nichts bewegt.
 * - **Nach oben und unten wischen** rollt den Feed zur nächsten oder
 *   vorigen Karte – überall im Bild, wie bei Reels und Shorts.
 * - **Zur Seite wischen spult** – nach rechts vor, nach links zurück; die
 *   ganze Breite ist die ganze Länge, wie bei der Leiste. Die Fläche lässt
 *   nur das senkrechte Rollen dem Browser, das seitliche bekommt sie
 *   selbst. Am Rechner spulen die Pfeiltasten links und rechts um fünf
 *   Sekunden.
 * - **Der Ton** sitzt bei den Angaben unten rechts. Läuft das Video
 *   stumm, bleibt dort auch ohne Tipp ein kleiner Knopf stehen – sonst
 *   fände niemand den Ton.
 *
 * **Nur das Video.** Was YouTube trotz allem an den Rand seines Rahmens
 * zeichnet – Titel, Kanal, beim Anhalten weitere Videos –, liegt
 * ausserhalb der Karte und wird abgeschnitten (`impulseEmbedBox`); ein
 * Short füllt dabei den ganzen Bildschirm.
 *
 * **Kein Knopf von YouTube beim Start.** Am Telefon legt YouTube beim
 * Anlaufen trotz `controls=0` seinen Knopf zum Anhalten mitten ins Bild
 * und nimmt ihn erst nach ein paar Sekunden weg. Darum läuft das Video
 * zuerst verdeckt an – **gebremst und stumm**: Ein Vorhang mit dem
 * Vorschaubild liegt darüber, und darunter läuft das Video mit einem
 * Viertel seines Tempos (`WARM_UP_RATE`), bis der Knopf sicher weg ist
 * (`WARM_UP_MS` ab der ersten Bewegung; nach einem Nachladen zwischendurch
 * noch einmal `WARM_UP_AFTER_BUFFER_MS`). Dann bekommt es sein Tempo und
 * seinen Ton zurück, und der Vorhang geht auf: Das Video steht erst bei
 * etwa einer Sekunde – fast der Anfang –, und YouTube hat nichts mehr
 * darüber. Weder springt die Karte dabei zurück noch hält sie an: Beides
 * holte den Knopf wieder hervor (so der Versuch davor). Wer vorher schon
 * eingreift – anhält, den Ton bedient, spult –, bekommt das Video sofort.
 *
 * **Nach dem Weiterlaufen** zeigt YouTube seinen Knopf wieder. Darum
 * bleibt der eigene Knopf in der Mitte ein paar Sekunden stehen
 * (`COVER_MS`) – genau über dem von YouTube, undurchsichtig genug, und
 * grösser. Dasselbe nach dem Spulen. Und **am Ende** fällt der Vorhang,
 * statt der Vorschläge des Anbieters: Das Vorschaubild steht da, die
 * Angaben der Karte und der Startknopf; ein Tipp spielt es noch einmal.
 * Keine Schleife – die fiele bei YouTube nur mit dessen Knöpfen aus.
 *
 * **Der Ton.** Stumm darf ein Video überall von selbst anlaufen, laut
 * nicht. Darum startet es stumm, und die Karte schaltet den Ton nach dem
 * Anlaufen ein – ausser am iPhone und iPad, wo der Browser das ohne
 * Berührung nie zulässt (`impulseSoundBlocked`): Dort bleibt es stumm,
 * und unten rechts steht «Ton an». Bleibt das Video stehen, sobald der
 * Ton kommt, lässt auch dieser Browser ihn nicht zu – dann wieder stumm,
 * aber laufend. Kommt das Video gar nicht erst in Gang, steht der
 * Startknopf auf dem Vorhang.
 *
 * Meldet die Fremdkarte gar nichts (etwa weil der Anbieter seine
 * Schnittstelle ändert), geht der Vorhang nach ein paar Sekunden trotzdem
 * auf; der Knopf in der Mitte wechselt zwischen Anhalten und
 * Weiterlaufen, der Ton zwischen an und aus – nur das verdeckte Anlaufen,
 * die Zeit, die Leiste und das Spulen entfallen.
 */

/** So lange läuft das Video verdeckt an, ab der ersten Bewegung – bis YouTube seinen Knopf sicher weggenommen hat. */
const WARM_UP_MS = 4500
/** Lädt es zwischendurch nach, zeigt YouTube den Knopf womöglich erneut: dann noch einmal so lange. */
const WARM_UP_AFTER_BUFFER_MS = 3500
/** So langsam läuft es dabei – damit beim Aufgehen des Vorhangs fast nichts verpasst ist. */
const WARM_UP_RATE = 0.25
/** So lange bleibt der eigene Knopf nach dem Weiterlaufen stehen – über dem von YouTube. */
const COVER_MS = 4500

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
  /* Lässt der Browser den Ton nie von selbst zu? Dann bleibt es stumm, bis
     die Person ihn einschaltet. */
  const [soundBlocked] = useState(() =>
    impulseSoundBlocked(navigator.userAgent, navigator.maxTouchPoints ?? 0),
  )
  /* Läuft es? `null`, solange die Fremdkarte nichts gemeldet hat. */
  const [playing, setPlaying] = useState<boolean | null>(null)
  /* Es startet stumm – den Ton gibt die Karte nach dem Anlaufen dazu. */
  const [muted, setMuted] = useState(true)
  /* Bewegt sich das Bild? Bis dahin deckt der Vorhang den Rahmen zu. */
  const [started, setStarted] = useState(false)
  /* Steht es, weil man angehalten hat (oder ein Video zu Ende ist) –
     oder weil es nicht in Gang kommt? Dann steht der Startknopf da. */
  const [paused, setPaused] = useState(false)
  const [stalled, setStalled] = useState(false)
  /* Stehen die Angaben über dem Video? Allein der Tipp entscheidet. */
  const [shown, setShown] = useState(false)
  /* Dasselbe für die Handgriffe und Zeitgeber, die den neuesten Stand
     brauchen, ohne neu aufgesetzt zu werden. */
  const playingRef = useRef<boolean | null>(null)
  const mutedRef = useRef(true)
  const startedRef = useRef(false)
  const pausedRef = useRef(false)
  const runningRef = useRef(false)
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
  /* Nach dem Spulen folgt ein Klick – der blendet nichts ein oder aus. */
  const scrubbed = useRef(false)
  /* Hat die Person selbst angehalten oder den Ton bedient? */
  const touched = useRef(false)
  /* Das verdeckte Anlaufen: noch nicht (`idle`), gerade (`warming`), vorbei
     (`done`). Gezählt ab der ersten Bewegung – und ab der letzten, wenn es
     zwischendurch nachlud. */
  const warm = useRef<'idle' | 'warming' | 'done'>('idle')
  const [warming, setWarming] = useState(false)
  const warmTimer = useRef<number | undefined>(undefined)
  const firstRunningAt = useRef(0)
  const lastRunningAt = useRef(0)
  /* Wie oft die Bremse schon verlangt wurde – nicht endlos, falls die
     Fremdkarte sie verweigert. */
  const rateTries = useRef(0)
  /* Meldungen über den Ton gleich nach dem Einschalten sind noch die alten. */
  const mutedQuietUntil = useRef(0)
  /* Steht der eigene Knopf gerade über dem von YouTube? */
  const [cover, setCover] = useState(false)
  const coverTimer = useRef<number | undefined>(undefined)
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
  }
  const showPaused = (value: boolean) => {
    pausedRef.current = value
    setPaused(value)
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

  /*
   * Der Vorhang geht auf, wenn das Video verdeckt angelaufen ist (siehe
   * `endWarmUp`) – später, nach einem Halt oder am Ende, sobald sich das
   * Bild wieder bewegt (`running`), einen Augenblick danach. Nie, solange
   * das Video bloss lädt: Solange zeigt YouTube sein Vorschaubild mit dem
   * grossen Startknopf. Am Ende fällt er wieder.
   */
  const curtainTimer = useRef<number | undefined>(undefined)
  const lift = (delay: number) => {
    if (startedRef.current || curtainTimer.current !== undefined) return
    curtainTimer.current = window.setTimeout(() => {
      curtainTimer.current = undefined
      startedRef.current = true
      setStarted(true)
    }, delay)
  }
  const lower = () => {
    window.clearTimeout(curtainTimer.current)
    curtainTimer.current = undefined
    startedRef.current = false
    setStarted(false)
  }

  /* Steht das Video ein paar Sekunden nach dem Laden noch immer, ohne
     dass jemand angehalten hat, kommt es nicht in Gang: Dann steht der
     Startknopf auf dem Vorhang. */
  const stallTimer = useRef<number | undefined>(undefined)
  const watchStall = () => {
    window.clearTimeout(stallTimer.current)
    stallTimer.current = window.setTimeout(() => {
      if (heard.current && !runningRef.current && !pausedRef.current) setStalled(true)
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

  const seek = (seconds: number, done: boolean) => {
    const message = impulseEmbedSeekMessage(sourceRef.current, seconds, done)
    const origin = impulseEmbedOrigin(sourceRef.current)
    if (message && origin) frameRef.current?.contentWindow?.postMessage(message, origin)
    if (done) showTime(seconds)
  }
  /* Bleibt das Video stehen, sobald der Ton kommt, lässt der Browser ihn
     nicht zu: dann wieder stumm, aber laufend. */
  const soundTimer = useRef<number | undefined>(undefined)
  const watchSound = () => {
    window.clearTimeout(soundTimer.current)
    soundTimer.current = window.setTimeout(() => {
      if (touched.current || pausedRef.current || playingRef.current !== false) return
      sendRef.current('mute')
      sendRef.current('play')
      showMuted(true)
    }, 1200)
  }

  /* Das Tempo – die Bremse fürs verdeckte Anlaufen, danach wieder eins. */
  const sendRate = (rate: number) => {
    const message = impulseEmbedRateMessage(sourceRef.current, rate)
    const origin = impulseEmbedOrigin(sourceRef.current)
    if (message && origin) frameRef.current?.contentWindow?.postMessage(message, origin)
  }
  /* Die Bremse verlangen – so früh wie möglich, und noch einmal, wenn die
     Fremdkarte ein anderes Tempo meldet; aber nicht endlos. */
  const slowDown = () => {
    if (warm.current === 'done' || rateTries.current >= 8) return
    rateTries.current += 1
    sendRate(WARM_UP_RATE)
  }

  /* Das Bild bewegt sich zum ersten Mal: Jetzt läuft die Zeit, bis
     YouTube seinen Knopf weggenommen hat. */
  const startWarmUp = (now: number) => {
    if (warm.current !== 'idle') return
    warm.current = 'warming'
    setWarming(true)
    firstRunningAt.current = now
    armWarmUp(now)
  }
  /* Die Zeit (neu) stellen: ab der ersten Bewegung – und ab der letzten,
     falls das Video zwischendurch nachlud. */
  const armWarmUp = (now: number) => {
    if (warm.current !== 'warming') return
    window.clearTimeout(warmTimer.current)
    const due = Math.max(
      firstRunningAt.current + WARM_UP_MS,
      lastRunningAt.current + WARM_UP_AFTER_BUFFER_MS,
    )
    warmTimer.current = window.setTimeout(() => endWarmUp(true), Math.max(0, due - now))
  }

  /* Vorbei mit dem verdeckten Anlaufen – nach der Zeit (`gently`: mit
     einem Augenblick für das neue Tempo) oder weil jemand eingreift. Das
     Tempo und der Ton kommen, der Vorhang geht auf – sobald sich das Bild
     bewegt. Hat die Person den Ton schon selbst bedient (`touched`),
     bleibt er, wie sie ihn gestellt hat. */
  const endWarmUp = (gently: boolean) => {
    if (warm.current === 'done') return
    window.clearTimeout(warmTimer.current)
    warm.current = 'done'
    setWarming(false)
    sendRate(1)
    if (!soundBlocked && !touched.current && mutedRef.current) {
      sendRef.current('unmute')
      showMuted(false)
      mutedQuietUntil.current = performance.now() + 800
      watchSound()
    }
    if (runningRef.current) lift(gently ? 300 : 0)
  }

  /* Der eigene Knopf bleibt nach dem Weiterlaufen ein paar Sekunden stehen
     – so lange zeigt YouTube darunter seinen. */
  const coverFor = () => {
    window.clearTimeout(coverTimer.current)
    setCover(true)
    coverTimer.current = window.setTimeout(() => setCover(false), COVER_MS)
  }

  /* Zu Ende: Der Vorhang fällt, statt der Vorschläge des Anbieters. Das
     Video wartet mit dem Startknopf – und den Angaben, damit man sieht,
     was es war. Einmal je Ende: Die Fremdkarte meldet es mehrfach, bis sie
     wieder läuft. */
  const endedRef = useRef(false)
  const finish = () => {
    if (endedRef.current) return
    endedRef.current = true
    lower()
    showPaused(true)
    setShown(true)
  }

  /* Die Meldungen der Fremdkarte – nur ihre eigenen, von ihrem Ursprung. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return
      if (event.origin !== impulseEmbedOrigin(sourceRef.current)) return
      const report = impulseEmbedReport(sourceRef.current, event.data)
      if (!report) return
      if (!heard.current) slowDown()
      heard.current = true
      if (report.playing !== undefined) showPlaying(report.playing)
      const now = performance.now()
      const wasRunning = runningRef.current
      if (report.running !== undefined) runningRef.current = report.running
      if (report.running) {
        endedRef.current = false
        setStalled(false)
        /* Erst die Bewegung zählt – nicht jede Meldung, dass es noch läuft. */
        if (!wasRunning) lastRunningAt.current = now
        if (warm.current === 'idle') startWarmUp(now)
        else if (warm.current === 'warming') {
          if (!wasRunning) armWarmUp(now)
        } else lift(250)
      }
      if (report.rate !== undefined && warm.current === 'warming' && report.rate !== WARM_UP_RATE) {
        slowDown()
      }
      if (report.muted !== undefined && now > mutedQuietUntil.current) {
        showMuted(report.muted)
      }
      if (report.duration !== undefined) {
        durationRef.current = report.duration
        setDuration(report.duration)
      }
      /* Während des Spulens gilt der Daumen, nicht die Meldung. */
      if (report.time !== undefined && !scrub.current?.active) showTime(report.time)
      if (report.ended) finish()
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(stallTimer.current)
      window.clearTimeout(soundTimer.current)
    }
    // Einmal aufgesetzt: Was es braucht, liest es aus Refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Anmelden, sobald die Fremdkarte geladen hat – und nachfassen, bis sie
     antwortet: Ihr Skript hört nicht unbedingt schon beim Laden zu. Meldet
     sie sich gar nicht, geht der Vorhang nach drei Sekunden trotzdem auf –
     dann weiss die Karte nicht, ob sich das Bild bewegt. */
  const helloTimer = useRef<number | undefined>(undefined)
  const silenceTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearInterval(helloTimer.current)
      window.clearTimeout(silenceTimer.current)
      window.clearTimeout(curtainTimer.current)
      window.clearTimeout(warmTimer.current)
      window.clearTimeout(coverTimer.current)
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
      /* Die Bremse so früh wie möglich: Das Video läuft zuerst verdeckt. */
      slowDown()
    }
    hello()
    let tries = 0
    window.clearInterval(helloTimer.current)
    helloTimer.current = window.setInterval(() => {
      tries += 1
      if (heard.current || tries > 10) window.clearInterval(helloTimer.current)
      else hello()
    }, 400)
    window.clearTimeout(silenceTimer.current)
    silenceTimer.current = window.setTimeout(() => {
      if (heard.current) return
      warm.current = 'done'
      setWarming(false)
      lift(0)
    }, 3000)
    watchStall()
  }

  /* Ein Tipp aufs Bild: einblenden oder ausblenden – sonst nichts. */
  const toggleInfo = () => {
    if (scrubbed.current) {
      scrubbed.current = false
      return
    }
    setShown((value) => !value)
  }

  /* Der Knopf in der Mitte: anhalten oder weiter. Ohne Meldungen zählt
     der eigene Stand; mit Meldungen sagt die Fremdkarte, was daraus
     geworden ist – ein abgelehntes Abspielen soll nicht als laufend
     dastehen. */
  const halted = paused || stalled || (started && playing === false)
  const togglePlay = () => {
    if (scrubbed.current) {
      scrubbed.current = false
      return
    }
    /* Erst das Anlaufen beenden (das schaltet den Ton ein), dann gilt die
       Person als eingegriffen. */
    endWarmUp(false)
    touched.current = true
    if (halted) {
      send('play')
      showPaused(false)
      setStalled(false)
      if (!heard.current) showPlaying(true)
      else watchStall()
      coverFor()
    } else {
      send('pause')
      showPaused(true)
      showPlaying(false)
    }
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

  /*
   * Ein Daumen auf dem Video: Geht er zur Seite, spult er; geht er nach
   * oben oder unten, rollt der Browser den Feed und meldet das Ende
   * dieses Daumens (`pointercancel`). Erst ab ein paar Pixeln zur Seite
   * wird gespult – ein Tipp, der ein wenig verrutscht, bleibt ein Tipp.
   * Unterwegs zeigt YouTube die Stelle alle paar Augenblicke an, beim
   * Loslassen lädt es von dort weiter.
   */

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    scrubbed.current = false
    if (!(durationRef.current > 0)) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    scrub.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      from: currentTime(),
      width: boxRef.current?.clientWidth ?? event.currentTarget.clientWidth,
      to: 0,
      active: false,
      sentAt: 0,
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = scrub.current
    if (!current || current.pointer !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.active) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return
      current.active = true
      endWarmUp(false)
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

  const endScrub = (event: ReactPointerEvent<HTMLElement>) => {
    const current = scrub.current
    if (!current || current.pointer !== event.pointerId) return
    scrub.current = null
    if (!current.active) return
    scrubbed.current = true
    seek(current.to, true)
    setScrubTo(null)
    coverFor()
  }

  const scrubHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endScrub,
    onPointerCancel: endScrub,
  }

  /* Am Rechner: die Pfeiltasten links und rechts, fünf Sekunden je Druck. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (!(durationRef.current > 0)) return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 5 : -5
    seek(Math.min(durationRef.current, Math.max(0, currentTime() + step)), true)
  }

  /* Der Ton – und wer ihn einschaltet, will das Video auch laufen sehen. */
  const toggleSound = () => {
    /* Erst als eingegriffen gelten, dann das Anlaufen beenden – sonst
       schaltete das den Ton ein, den der Tipp gerade ausschalten will. */
    touched.current = true
    endWarmUp(false)
    const next = !mutedRef.current
    send(next ? 'mute' : 'unmute')
    if (!next && playingRef.current === false && !pausedRef.current) send('play')
    showMuted(next)
  }

  const embedUrl = impulseEmbedUrl(source, window.location.origin)
  if (!embedUrl) return null

  const scrubbing = scrubTo !== null
  const visible = shown || scrubbing
  const progress = duration > 0 ? (Math.min(scrubTo ?? time, duration) / duration) * 100 : 0
  const soundLabel = muted ? 'Ton einschalten' : 'Ton ausschalten'

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden bg-black">
      <iframe
        ref={frameRef}
        src={embedUrl}
        title={title}
        onLoad={onLoad}
        /* Bedient wird über die Fläche der App – in den Rahmen führt kein Weg. */
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

      {/* Der Vorhang: deckt den Rahmen zu, bis das Video verdeckt angelaufen
          ist – sonst stünden Vorschaubild, Startknopf und Pausenknopf des
          Anbieters da. Solange es anläuft, rückt das Bild ganz leise näher:
          Es tut sich etwas. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-300',
          started ? 'opacity-0' : 'opacity-100',
        )}
      >
        <div
          className={cn(
            'size-full transition-transform duration-[6000ms] ease-out',
            warming ? 'scale-[1.06]' : 'scale-100',
          )}
        >
          <Poster poster={poster} />
        </div>
      </div>

      {/* Die Fläche über dem ganzen Video: Ein Tipp blendet ein und aus,
          nach oben und unten rollt der Feed, zur Seite spult sie. */}
      <button
        type="button"
        onClick={toggleInfo}
        {...scrubHandlers}
        onKeyDown={onKeyDown}
        aria-label={shown ? 'Angaben zum Video ausblenden' : 'Angaben zum Video zeigen'}
        aria-expanded={shown}
        className="absolute inset-0 cursor-pointer touch-pan-y focus-visible:-outline-offset-4"
      />

      {/* Wohin der Daumen spult. */}
      {scrubbing && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="tabular rounded-full bg-slate-950/60 px-4 py-2 text-lg font-semibold text-white backdrop-blur-sm">
            {impulseVideoClock(scrubTo)}
            <span className="font-normal opacity-70"> / {impulseVideoClock(duration)}</span>
          </span>
        </span>
      )}

      {/* Der Knopf in der Mitte: anhalten und weiter. Er steht mit den
          Angaben da, immer, wenn das Video steht, und ein paar Sekunden
          nach dem Weiterlaufen (`cover`). Wer auf ihm wischt,
          wischt wie auf dem Video; beim Spulen tritt er zurück, bleibt aber
          da – sonst verlöre der Daumen, der auf ihm aufsetzte, seinen Halt. */}
      {(shown || halted || cover) && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <button
            type="button"
            onClick={togglePlay}
            {...scrubHandlers}
            aria-label={halted ? 'Video abspielen' : 'Video anhalten'}
            className={cn(
              'pointer-events-auto grid size-[4.5rem] touch-pan-y place-items-center rounded-full bg-slate-950/85 text-white shadow-lg backdrop-blur-md transition active:scale-95',
              scrubbing && 'opacity-0',
            )}
          >
            {halted ? (
              <Play className="size-7 translate-x-0.5 fill-current" aria-hidden />
            ) : (
              <Pause className="size-7 fill-current" aria-hidden />
            )}
          </button>
        </span>
      )}

      {/* Ohne Tipp steht nichts über dem Video – ausser dem Ton, wenn er
          fehlt: sonst fände ihn niemand. Nicht, solange es verdeckt anläuft. */}
      {started && !visible && muted && (
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
          Tipp aufs Video, ein Wisch ein Wisch), nur Links und Knöpfe nehmen
          sie an. Hell auf dunkel, auch im hellen Modus (`dark`). */}
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
              scrubbing ? 'h-1.5' : 'h-1',
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
