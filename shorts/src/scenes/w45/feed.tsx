import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene, type Word } from "../../lib/timing";
import { normalize, type Scene as SceneDef } from "../../schema";
import { theme } from "../../theme";

/*
 * Kurzvideo-Feed spät in der Nacht: ein Handy mit endlosen, ausgedachten Clips – Katze,
 * Life-Hack, Fail, Ranking –, oben die Uhr, die über die Szene weiterläuft, und der Akku, der
 * sinkt. Erst «nur noch ein Video», dann wischt es immer schneller, dann ist es halb eins.
 * Danach ist der Bildschirm leer – und zuletzt geht er aus: Eine Leuchte zeigt auf einem
 * dunklen Pfad den nächsten Schritt (Psalm 119:105). Die Uhrzeit steht nur im Bild.
 */

type FeedSceneT = Extract<SceneDef, { type: "feed" }>;
type P = { ts: TimelineScene; s: FeedSceneT; t: number; frame: number };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BODY = theme.font.body;

/** Das Handy – immer an derselben Stelle, damit die Überblendung zwischen den Szenen ruhig bleibt */
const PHONE = { x: 256, y: 236, w: 568, h: 968, r: 74 };
const SCREEN = { x: PHONE.x + 16, y: PHONE.y + 16, w: PHONE.w - 32, h: PHONE.h - 32, r: 60 };

const useT = (ts: TimelineScene) => (useCurrentFrame() - ts.audioOffsetFrames) / FPS;

/** Alle Stellen, an denen eine Phrase gesprochen wird – «Und noch eins» kommt zweimal */
const allCues = (words: Word[], phrase: string): number[] => {
  const target = normalize(phrase).split(" ").filter(Boolean);
  const out: number[] = [];
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((w, j) => words[i + j].key === w)) out.push(words[i].start);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Die Clips                                                           */
/* ------------------------------------------------------------------ */

type Clip = { from: string; to: string; emoji: string; big?: string; title: string; user: string; likes: string; comments: string; tiers?: boolean };

const CLIPS: Record<string, Clip> = {
  katze: { from: "#FFB13C", to: "#FF4F6D", emoji: "🐈", big: "WART’S AB", title: "Katze vs. Gurke 😹", user: "@miau.daily", likes: "1,2 Mio.", comments: "8312" },
  kreise: { from: "#38B6FF", to: "#7C5CFF", emoji: "🌀", title: "So satisfying …", user: "@calm.loops", likes: "640 k", comments: "2104" },
  pov: { from: "#7C3AED", to: "#DB2777", emoji: "😩", big: "POV:", title: "Montag, 6:45 Uhr", user: "@relatable", likes: "310 k", comments: "4877" },
  tanz: { from: "#10B981", to: "#0EA5E9", emoji: "🕺", big: "TREND", title: "Alle machen das gerade", user: "@moves", likes: "2,4 Mio.", comments: "19 k" },
  trick: { from: "#FACC15", to: "#F97316", emoji: "💡", big: "LIFE-HACK #47", title: "Du machst es seit Jahren falsch", user: "@hackz", likes: "880 k", comments: "6021" },
  fail: { from: "#EF4444", to: "#7F1D1D", emoji: "🛹", big: "FAIL", title: "Ging gar nicht gut 💀", user: "@fails.4k", likes: "1,9 Mio.", comments: "12 k" },
  ranking: { from: "#1E293B", to: "#334155", emoji: "🍕", big: "RANKING", title: "Pizza-Belag, ehrlich bewertet", user: "@tierlist", likes: "455 k", comments: "33 k", tiers: true },
  game: { from: "#2563EB", to: "#1E1B4B", emoji: "🎮", big: "LEVEL 99", title: "Unmöglich? Nicht für ihn", user: "@speedrun", likes: "720 k", comments: "5560" },
};

const Heart: React.FC<{ fill: string }> = ({ fill }) => (
  <svg width={64} height={58} viewBox="0 0 64 58">
    <path d="M 32 54 C 10 38 2 28 2 17 C 2 8 9 2 17 2 C 24 2 29 6 32 11 C 35 6 40 2 47 2 C 55 2 62 8 62 17 C 62 28 54 38 32 54 Z" fill={fill} />
  </svg>
);
const Bubble: React.FC = () => (
  <svg width={62} height={58} viewBox="0 0 62 58">
    <path d="M 31 4 C 15 4 4 14 4 27 C 4 34 7 40 13 44 L 10 55 L 23 49 C 25 49 28 50 31 50 C 47 50 58 40 58 27 C 58 14 47 4 31 4 Z" fill="#FFFFFF" />
  </svg>
);
const Share: React.FC = () => (
  <svg width={60} height={54} viewBox="0 0 60 54">
    <path d="M 34 4 L 58 26 L 34 48 L 34 35 C 18 35 9 40 2 50 C 5 32 15 20 34 18 Z" fill="#FFFFFF" />
  </svg>
);

/** Ein Clip im Bildschirm (Breite und Höhe des Bildschirms) */
const ClipView: React.FC<{ clip: Clip; frame: number; liked: boolean }> = ({ clip, frame, liked }) => {
  const bob = Math.sin(frame / 7) * 14;
  const spin = clip.emoji === "🌀" ? frame * 4 : Math.sin(frame / 9) * 8;
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${clip.from} 0%, ${clip.to} 100%)`, overflow: "hidden" }}>
      {/* Muster */}
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: random(`cx${clip.title}${i}`) * SCREEN.w - 90, top: random(`cy${clip.title}${i}`) * SCREEN.h - 90, width: 180, height: 180, borderRadius: 90, background: "rgba(255,255,255,0.09)" }} />
      ))}
      {clip.big ? (
        <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center", fontFamily: theme.font.display, fontSize: clip.big.length > 8 ? 78 : 112, color: "#FFFFFF", textShadow: "0 6px 0 rgba(0,0,0,0.25)", transform: `rotate(-3deg)` }}>{clip.big}</div>
      ) : null}
      {clip.tiers ? (
        <div style={{ position: "absolute", top: 300, left: 40, right: 110, display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            ["S", "#FF6B6B", "🍕 🧀"],
            ["A", "#FFB347", "🍄 🌽"],
            ["B", "#FFE066", "🫑"],
            ["F", "#9CA3AF", "🍍 ?"],
          ].map(([tier, color, items]) => (
            <div key={tier} style={{ display: "flex", height: 92, borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
              <div style={{ width: 92, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font.display, fontSize: 56, color: "#1E293B" }}>{tier}</div>
              <div style={{ display: "flex", alignItems: "center", paddingLeft: 20, fontSize: 54 }}>{items}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: "absolute", top: 330 + bob, width: "100%", textAlign: "center", fontSize: 250, transform: `rotate(${spin}deg)` }}>{clip.emoji}</div>
      )}
      {/* Spalte rechts */}
      <div style={{ position: "absolute", right: 22, bottom: 190, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, fontFamily: BODY, fontWeight: 800, fontSize: 22, color: "#FFFFFF", textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center" }}>
          <Heart fill={liked ? "#FF3D71" : "#FFFFFF"} />
          <div>{clip.likes}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <Bubble />
          <div>{clip.comments}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <Share />
          <div>Teilen</div>
        </div>
      </div>
      {/* Text unten */}
      <div style={{ position: "absolute", left: 30, right: 120, bottom: 70, fontFamily: BODY, color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}>
        <div style={{ fontWeight: 800, fontSize: 30 }}>{clip.user}</div>
        <div style={{ fontWeight: 600, fontSize: 28, marginTop: 6 }}>{clip.title}</div>
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: `${((frame * 2.2) % 100).toFixed(1)}%`, background: "rgba(255,255,255,0.85)" }} />
    </div>
  );
};

/** Uhr und Akku oben im Bildschirm */
const StatusBar: React.FC<{ clock: string; battery: number; dark?: boolean }> = ({ clock, battery, dark }) => {
  const low = battery <= 15;
  const color = dark ? "rgba(255,255,255,0.75)" : "#FFFFFF";
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: 22, height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: BODY, fontWeight: 800, fontSize: 30, color, textShadow: "0 1px 4px rgba(0,0,0,0.45)" }}>
      <span>{clock}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 10, color: low ? "#FF5A5F" : color }}>
        {Math.round(battery)} %
        <span style={{ position: "relative", width: 50, height: 24, borderRadius: 6, border: `3px solid ${low ? "#FF5A5F" : color}` }}>
          <span style={{ position: "absolute", left: 2, top: 2, bottom: 2, width: `${Math.max(4, (battery / 100) * 40)}px`, borderRadius: 3, background: low ? "#FF5A5F" : color }} />
          <span style={{ position: "absolute", right: -8, top: 5, width: 4, height: 10, borderRadius: 2, background: low ? "#FF5A5F" : color }} />
        </span>
      </span>
    </div>
  );
};

/** «22:58» → Minuten; nach Mitternacht zählt weiter (00:31 = 24:31) */
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const clockAt = (range: [string, string] | undefined, k: number) => {
  if (!range) return "22:58";
  const a = minutes(range[0]);
  let b = minutes(range[1]);
  if (b < a) b += 24 * 60;
  const m = Math.round(a + (b - a) * k) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Das Handy samt Rahmen; der Inhalt liegt im Bildschirm */
const Phone: React.FC<{ children: React.ReactNode; glow: string; lit?: number; x?: number; y?: number; scale?: number }> = ({ children, glow, lit = 1, x = 0, y = 0, scale = 1 }) => (
  <div style={{ position: "absolute", inset: 0, transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: "540px 720px" }}>
    <div style={{ position: "absolute", left: PHONE.x - 120, top: PHONE.y - 100, width: PHONE.w + 240, height: PHONE.h + 200, borderRadius: 200, background: `radial-gradient(ellipse at center, ${glow} 0%, rgba(0,0,0,0) 68%)`, opacity: 0.55 * lit }} />
    <div style={{ position: "absolute", left: PHONE.x, top: PHONE.y, width: PHONE.w, height: PHONE.h, borderRadius: PHONE.r, background: "linear-gradient(145deg, #2B2B36 0%, #0F0F16 100%)", boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 0 0 3px #3A3A48" }} />
    <div style={{ position: "absolute", left: SCREEN.x, top: SCREEN.y, width: SCREEN.w, height: SCREEN.h, borderRadius: SCREEN.r, overflow: "hidden", background: "#000" }}>{children}</div>
    <div style={{ position: "absolute", left: 540 - 70, top: SCREEN.y + 16, width: 140, height: 38, borderRadius: 19, background: "#000" }} />
  </div>
);

/** Der Feed: Clips, die bei jedem Wisch nach oben weggleiten */
const Feed: React.FC<{ seq: string[]; swipes: number[]; t: number; frame: number; dim?: number }> = ({ seq, swipes, t, frame, dim = 0 }) => {
  const dur = 0.26;
  const pos = swipes.reduce((acc, at) => acc + Easing.inOut(Easing.cubic)(Math.max(0, Math.min(1, (t - at) / dur))), 0);
  const n = Math.floor(pos);
  const k = pos - n;
  const clip = (i: number) => CLIPS[seq[i % seq.length]];
  return (
    <>
      <div style={{ position: "absolute", left: 0, width: SCREEN.w, height: SCREEN.h, top: -k * SCREEN.h }}>
        <ClipView clip={clip(n)} frame={frame} liked={false} />
      </div>
      {k > 0.001 ? (
        <div style={{ position: "absolute", left: 0, width: SCREEN.w, height: SCREEN.h, top: (1 - k) * SCREEN.h }}>
          <ClipView clip={clip(n + 1)} frame={frame} liked={false} />
        </div>
      ) : null}
      {dim > 0 ? <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dim }} /> : null}
    </>
  );
};

/** Der Daumen, der nach oben wischt */
const Thumb: React.FC<{ swipes: number[]; t: number }> = ({ swipes, t }) => {
  const last = [...swipes].reverse().find((at) => t >= at - 0.18 && t < at + 0.32);
  if (last === undefined) return null;
  const k = interpolate(t, [last - 0.18, last + 0.32], [0, 1], clamp);
  const y = interpolate(k, [0, 1], [1060, 640], { easing: Easing.inOut(Easing.cubic) });
  const o = interpolate(k, [0, 0.15, 0.8, 1], [0, 0.9, 0.9, 0]);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }} opacity={o}>
      <ellipse cx={640} cy={y} rx={56} ry={72} fill="#F3C9A5" stroke="#C99A78" strokeWidth={4} />
      <ellipse cx={640} cy={y - 34} rx={34} ry={26} fill="#FCE3CF" opacity={0.8} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

const Scroll: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const dur = ts.durationInFrames / FPS;
  const k = interpolate(frame / FPS, [0, dur], [0, 1], clamp);
  const isHook = s.cues.some((c) => normalize(c) === normalize("Nur noch ein Video"));
  let seq: string[];
  let swipes: number[];
  if (isHook) {
    seq = ["katze", "kreise"];
    swipes = [beat(ts, "Nur noch ein Video", ts.speechEndSec) + 0.55];
  } else {
    seq = ["kreise", "pov", "tanz", "trick", "fail", "ranking", "game", "katze", "pov", "kreise", "tanz", "game", "trick", "katze"];
    const more = allCues(ts.words, "Und noch eins");
    const named = ["Ein Trick", "ein Fail", "ein Ranking"].map((c) => beat(ts, c, NaN)).filter((x) => Number.isFinite(x));
    const base = [...more, ...named].map((x) => x - 0.12);
    const end = dur - ts.audioOffsetFrames / FPS;
    const fast: number[] = [];
    for (let x = (named.at(-1) ?? ts.speechEndSec) + 0.75; x < end - 0.3; x += 0.34) fast.push(x);
    swipes = [...base, ...fast];
  }
  const battery = s.battery ? interpolate(k, [0, 1], s.battery) : 40;
  return (
    <AbsoluteFill>
      <Phone glow={look.accent2}>
        <Feed seq={seq} swipes={swipes} t={t} frame={frame} />
        <StatusBar clock={clockAt(s.clock, k)} battery={battery} />
      </Phone>
      <Thumb swipes={swipes} t={t} />
      {swipes.map((at, i) => (
        <Sfx key={i} frame={voiceFrame(ts, at)} name="swipe" volume={0.22} />
      ))}
    </AbsoluteFill>
  );
};

const Late: React.FC<P> = ({ ts, s, t, frame }) => {
  const [late, low] = beats(ts, s.cues, 2);
  const clock = s.clock?.[1] ?? "00:31";
  const big = spring({ frame: frame - voiceFrame(ts, late), fps: FPS, config: { damping: 9, stiffness: 160 } });
  const shake = t > late && t < late + 0.5 ? Math.sin(frame * 3) * 10 * (1 - (t - late) / 0.5) : 0;
  const alert = spring({ frame: frame - voiceFrame(ts, low), fps: FPS, config: { damping: 13, stiffness: 200 } });
  const battery = s.battery?.[0] ?? 9;
  const swipes = [0.1, 0.7, 1.2].map((x) => x - ts.audioOffsetFrames / FPS);
  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      <Phone glow="#FF3D71" lit={0.8}>
        <Feed seq={["fail", "game", "katze", "ranking"]} swipes={swipes} t={t} frame={frame} dim={interpolate(t, [late, late + 0.6], [0, 0.45], clamp)} />
        <StatusBar clock={clock} battery={battery} />
        {t >= low - 0.05 ? (
          <div style={{ position: "absolute", left: 34, right: 34, top: 360, padding: "34px 30px", borderRadius: 34, background: "rgba(28,28,34,0.94)", border: "2px solid rgba(255,255,255,0.12)", textAlign: "center", opacity: alert, transform: `scale(${interpolate(alert, [0, 1], [0.8, 1])})` }}>
            <svg width={120} height={60} viewBox="0 0 120 60">
              <rect x={4} y={6} width={100} height={48} rx={10} fill="none" stroke="#FF5A5F" strokeWidth={6} />
              <rect x={108} y={20} width={8} height={20} rx={3} fill="#FF5A5F" />
              <rect x={12} y={14} width={10} height={32} rx={3} fill="#FF5A5F" />
            </svg>
            <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 38, color: "#FFFFFF", marginTop: 12 }}>Akku fast leer</div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>Noch {battery} %</div>
          </div>
        ) : null}
      </Phone>
      {t >= late - 0.05 ? (
        <div style={{ position: "absolute", top: 300, width: "100%", textAlign: "center", fontFamily: theme.font.display, fontSize: 300, lineHeight: 1, color: "#FFFFFF", textShadow: "0 0 50px rgba(255,61,113,0.75), 0 14px 40px rgba(0,0,0,0.6)", opacity: Math.min(1, big * 1.4) * interpolate(t, [low - 0.3, low], [1, 0], clamp), transform: `scale(${interpolate(big, [0, 1], [1.8, 1])})` }}>
          {clock}
        </div>
      ) : null}
      <Sfx frame={voiceFrame(ts, late)} name="glitch" volume={0.4} />
      <Sfx frame={voiceFrame(ts, late) + 2} name="drum" volume={0.45} />
      <Sfx frame={voiceFrame(ts, low)} name="blip" volume={0.4} />
    </AbsoluteFill>
  );
};

/** Leer: Was bleibt? Die Clips verblassen – ein Fragezeichen */
const Blank: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [morning, eben] = beats(ts, s.cues, 2);
  const ghosts = ["katze", "trick", "fail", "ranking", "pov", "tanz"];
  const q = spring({ frame: frame - voiceFrame(ts, eben), fps: FPS, config: { damping: 8, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <Phone glow="#3B3B55" lit={0.35}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #14141C 0%, #0B0B10 100%)" }} />
        {ghosts.map((key, i) => {
          const clip = CLIPS[key];
          const appear = interpolate(frame, [i * 3, i * 3 + 10], [0, 1], clamp);
          const fade = interpolate(t, [morning - 0.2 + i * 0.18, morning + 0.6 + i * 0.18], [1, 0], clamp);
          const col = i % 2;
          const row = Math.floor(i / 2);
          return (
            <div key={key} style={{ position: "absolute", left: 50 + col * 230, top: 130 + row * 260 - (1 - fade) * 60, width: 200, height: 230, borderRadius: 20, background: `linear-gradient(160deg, ${clip.from}, ${clip.to})`, opacity: 0.55 * appear * fade, filter: `blur(${(1 - fade) * 8}px)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 90 }}>
              {clip.emoji}
            </div>
          );
        })}
        {t >= eben - 0.05 ? (
          <div style={{ position: "absolute", top: 260, width: "100%", textAlign: "center", fontFamily: theme.font.display, fontSize: 380, color: look.accent, opacity: Math.min(1, q * 1.5), transform: `scale(${interpolate(q, [0, 1], [0.4, 1])})`, textShadow: `0 0 40px ${look.accent}` }}>
            ?
          </div>
        ) : null}
      </Phone>
      <Sfx frame={voiceFrame(ts, morning)} name="whoosh" volume={0.3} />
      <Sfx frame={voiceFrame(ts, eben)} name="question" volume={0.45} />
    </AbsoluteFill>
  );
};

/** Ein Kopf im Profil, nach rechts schauend – (x, y) = Kinn */
const Profile: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const d =
    "M -30 -250 C -140 -250 -190 -170 -186 -80 C -184 -20 -160 20 -140 50 C -150 90 -190 120 -260 150 L -260 300 L 220 300 L 220 190 C 130 150 70 124 52 82 L 54 70 C 72 64 86 50 88 34 C 92 22 86 14 92 8 C 100 2 102 -6 96 -12 C 106 -20 108 -30 100 -38 C 114 -48 126 -58 120 -70 C 106 -92 94 -108 94 -138 C 94 -214 40 -250 -30 -250 Z";
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <linearGradient id="fdFace" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#05050A" />
          <stop offset="62%" stopColor="#0B1220" />
          <stop offset="100%" stopColor="#3C6E96" />
        </linearGradient>
      </defs>
      <path d={d} fill="url(#fdFace)" />
      <path d={d} fill="none" stroke="#8FD3FF" strokeWidth={3} opacity={0.35} />
    </g>
  );
};

/** Die Leuchte: erst das Handy im Gesicht, dann eine Lampe, die den nächsten Schritt zeigt */
const Lamp: React.FC<P> = ({ ts, s, t, frame }) => {
  const [face, way, step] = beats(ts, s.cues, 3);
  const phoneLight = interpolate(frame, [0, 10], [0, 1], clamp) * interpolate(t, [way - 0.25, way + 0.1], [1, 0], clamp);
  const lamp = interpolate(t, [way - 0.05, way + 0.7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const next = interpolate(t, [step - 0.1, step + 0.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const sway = Math.sin(frame / 22) * 4;
  // Der Pfad: Steine von vorn nach hinten, immer kleiner
  const stones = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = i / 6;
        return {
          x: 540 + Math.sin(i * 1.3) * 120 * (1 - d * 0.5),
          y: 1150 - 560 * (1 - (1 - d) ** 1.5),
          rx: 130 * (1 - d * 0.75),
          ry: 40 * (1 - d * 0.75),
        };
      }),
    [],
  );
  // Das Licht: zuerst um den ersten Stein, beim «nächsten Schritt» wandert es zum zweiten
  const lx = interpolate(next, [0, 1], [stones[0].x, stones[1].x]);
  const ly = interpolate(next, [0, 1], [stones[0].y - 10, stones[1].y - 10]);
  const lampX = 420 + interpolate(next, [0, 1], [0, 40]);
  const lampY = 600 + interpolate(next, [0, 1], [0, -60]);
  const pool = 260 * lamp;
  const print = interpolate(t, [step + 0.3, step + 0.7], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="fdHole">
            <stop offset="0%" stopColor="#000" />
            <stop offset="55%" stopColor="#000" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id="fdDark">
            <rect x={0} y={0} width={1080} height={1920} fill="#FFF" />
            {pool > 1 ? <ellipse cx={lx} cy={ly} rx={pool * 1.25} ry={pool * 0.75} fill="url(#fdHole)" /> : null}
            {pool > 1 ? <circle cx={lampX} cy={lampY + sway} r={pool * 0.6} fill="url(#fdHole)" /> : null}
          </mask>
          <radialGradient id="fdWarm">
            <stop offset="0%" stopColor="#FFE2A0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FFB347" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fdCone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE7B0" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFE7B0" stopOpacity="0.04" />
          </linearGradient>
          <radialGradient id="fdBlue">
            <stop offset="0%" stopColor="#8FD3FF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3EA8FF" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Boden und Pfad – nur zu sehen, wo die Lampe hinleuchtet */}
        <rect x={0} y={560} width={1080} height={700} fill="#14110C" />
        {stones.map((st, i) => (
          <g key={i}>
            <ellipse cx={st.x} cy={st.y + st.ry * 0.35} rx={st.rx} ry={st.ry} fill="#000" opacity={0.5} />
            <ellipse cx={st.x} cy={st.y} rx={st.rx} ry={st.ry} fill="#8A8172" />
            <ellipse cx={st.x - st.rx * 0.15} cy={st.y - st.ry * 0.25} rx={st.rx * 0.6} ry={st.ry * 0.45} fill="#A59C8C" opacity={0.7} />
          </g>
        ))}
        {/* Fussabdruck auf dem nächsten Stein */}
        {print > 0 ? (
          <g transform={`translate(${stones[1].x} ${stones[1].y - 4}) scale(1 0.42)`} opacity={print}>
            <ellipse cx={0} cy={6} rx={22} ry={40} fill="#FFE7B0" />
            {[-16, -6, 4, 13].map((dx, i) => (
              <circle key={i} cx={dx} cy={-44 + Math.abs(dx) * 0.4} r={i === 0 ? 8 : 6} fill="#FFE7B0" />
            ))}
          </g>
        ) : null}
        {/* Lichtkegel */}
        {lamp > 0 ? <path d={`M ${lampX - 26} ${lampY + 60 + sway} L ${lx - pool * 1.1} ${ly + 30} L ${lx + pool * 1.1} ${ly + 30} L ${lampX + 26} ${lampY + 60 + sway} Z`} fill="url(#fdCone)" opacity={lamp} /> : null}
        {lamp > 0 ? <ellipse cx={lx} cy={ly} rx={pool * 1.05} ry={pool * 0.45} fill="url(#fdWarm)" opacity={0.55 * lamp} /> : null}
        {/* Dunkelheit darüber */}
        <rect x={0} y={0} width={1080} height={1920} fill="#030306" opacity={0.95} mask="url(#fdDark)" />
        {/* Lampe */}
        {lamp > 0 ? (
          <g transform={`translate(${lampX} ${lampY + sway})`} opacity={lamp}>
            <circle r={150} fill="url(#fdWarm)" opacity={0.6} />
            <path d="M -18 -112 Q 0 -150 18 -112" stroke="#8A6A3A" strokeWidth={7} fill="none" />
            <line x1={0} y1={-150} x2={0} y2={-420} stroke="#3A2E20" strokeWidth={5} />
            <rect x={-32} y={-110} width={64} height={22} rx={6} fill="#B98A3E" />
            <path d="M -38 -88 L 38 -88 L 30 40 L -30 40 Z" fill="rgba(255,240,200,0.35)" stroke="#B98A3E" strokeWidth={6} />
            <path d="M 0 -40 C 14 -20 12 4 0 14 C -12 4 -14 -20 0 -40 Z" fill="#FFD36B" />
            <path d="M 0 -26 C 7 -14 6 0 0 6 C -6 0 -7 -14 0 -26 Z" fill="#FFF7D6" />
            <rect x={-40} y={40} width={80} height={22} rx={6} fill="#B98A3E" />
          </g>
        ) : null}
        {/* Erst: der Bildschirm im Gesicht */}
        {phoneLight > 0 ? (
          <g opacity={phoneLight}>
            <circle cx={640} cy={680} r={300} fill="url(#fdBlue)" />
            <Profile x={420} y={720} />
            <g transform="translate(700 660) rotate(-12)">
              <rect x={-60} y={-110} width={120} height={220} rx={20} fill="#1A1A24" />
              <rect x={-50} y={-100} width={100} height={200} rx={14} fill="#BFE6FF" />
            </g>
          </g>
        ) : null}
      </svg>
      {t >= step - 0.1 ? (
        <div style={{ position: "absolute", top: stones[1].y - 52, left: stones[1].x - stones[1].rx - 34 - 300, width: 300, textAlign: "right", fontFamily: BODY, fontWeight: 800, fontSize: 30, lineHeight: 1.25, letterSpacing: "0.24em", color: "#FFE7B0", opacity: next * 0.9 }}>
          DER NÄCHSTE
          <br />
          SCHRITT
        </div>
      ) : null}
      <Sfx frame={voiceFrame(ts, face)} name="blip" volume={0.25} />
      <Sfx frame={voiceFrame(ts, way)} name="chime" volume={0.4} />
      <Sfx frame={voiceFrame(ts, step)} name="ding" volume={0.35} />
    </AbsoluteFill>
  );
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as FeedSceneT;
  const frame = useCurrentFrame();
  const t = useT(ts);
  const p = { ts, s, t, frame };
  switch (s.stage) {
    case "scroll":
      return <Scroll {...p} />;
    case "late":
      return <Late {...p} />;
    case "blank":
      return <Blank {...p} />;
    case "lamp":
      return <Lamp {...p} />;
  }
};

/** Hier steht nichts Gesprochenes gross im Bild – alles wird untertitelt. */
export const hidden = (_ts: TimelineScene): Set<number> => new Set();
