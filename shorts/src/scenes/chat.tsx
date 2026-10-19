import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { useLook } from "../looks";
import { Sfx, beat, voiceFrame } from "../lib/sfx";
import { FPS, type TimelineScene } from "../lib/timing";
import type { Scene } from "../schema";
import { theme } from "../theme";

/*
 * Handy-Look: Helamans Brief an Moroni (Alma 56–58) als Chat. Nachrichten kommen genau dann,
 * wenn die Stimme sie liest; vorher tippt «Helaman …». Das Handy steht in jeder Szene an
 * derselben Stelle, darum wirkt die Überblendung wie ein durchgehender Bildschirm.
 *
 * Gruppenchat: Nachrichten mit `from` tragen den Namen (jede Person ihre Farbe) und ein kleines
 * Profilbild; `side: "out"` ist die eigene Nachricht rechts – sie wird vorher im Eingabefeld getippt.
 */

type ChatSceneT = Extract<Scene, { type: "chat" }>;
type Msg = ChatSceneT["messages"][number];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* Namensfarben im Gruppenchat – dunkel genug für die helle Blase */
const SENDER_COLORS = ["#C2185B", "#1565C0", "#B26A00", "#2E7D32", "#6A1B9A", "#00838F"];

/** Absender in der Reihenfolge ihres ersten Auftritts → stabile Farbe je Name. */
const senderColors = (messages: Msg[]) => {
  const out = new Map<string, string>();
  for (const m of messages) if (m.from && !out.has(m.from)) out.set(m.from, SENDER_COLORS[out.size % SENDER_COLORS.length]);
  return out;
};

/** Gruppenbild: drei überlappende Köpfe in den Farben der Absender. */
const GroupAvatar: React.FC<{ size: number; colors: string[] }> = ({ size, colors }) => {
  const c = colors.length ? colors : SENDER_COLORS.slice(0, 3);
  const r = size * 0.27;
  const spots = [
    [size * 0.3, size * 0.4],
    [size * 0.7, size * 0.4],
    [size * 0.5, size * 0.66],
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={size / 2} fill="#E9E4D8" />
      {spots.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r + 3} fill="#E9E4D8" />
          <circle cx={x} cy={y} r={r} fill={c[i % c.length]} />
          <circle cx={x} cy={y - r * 0.22} r={r * 0.36} fill="rgba(255,255,255,0.85)" />
          <path d={`M ${x - r * 0.62} ${y + r * 0.62} Q ${x} ${y + r * 0.05} ${x + r * 0.62} ${y + r * 0.62}`} fill="rgba(255,255,255,0.85)" />
        </g>
      ))}
    </svg>
  );
};

const PX = 150;
const PY = 250;
const PW = 780;
const PH = 950;
const BEZEL = 16;
const TYPING_SEC = 0.85;
/** Eigene Nachricht: so lange wird sie im Eingabefeld getippt */
const DRAFT_SEC = 1.7;
const typingSec = (m: Msg) => (m.side === "out" ? DRAFT_SEC : TYPING_SEC);

const StatusBar: React.FC<{ time: string; light?: boolean }> = ({ time, light = true }) => {
  const c = light ? "#FFFFFF" : "#10131F";
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 46px", fontFamily: theme.font.body, fontWeight: 700, fontSize: 28, color: c }}>
      <span>{time}</span>
      <span style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        {[10, 15, 20, 25].map((h) => (
          <span key={h} style={{ width: 7, height: h, borderRadius: 2, background: c }} />
        ))}
        <span style={{ marginLeft: 14, width: 46, height: 22, borderRadius: 6, border: `3px solid ${c}`, padding: 2, display: "inline-flex" }}>
          <span style={{ width: "34%", background: "#F87171", borderRadius: 2 }} />
        </span>
      </span>
    </div>
  );
};

const Phone: React.FC<{ children: React.ReactNode; wallpaper: string }> = ({ children, wallpaper }) => (
  <div
    style={{
      position: "absolute",
      left: PX,
      top: PY,
      width: PW,
      height: PH,
      borderRadius: 78,
      background: "#04060C",
      padding: BEZEL,
      boxShadow: "0 40px 120px rgba(0,0,0,0.55), inset 0 0 0 3px rgba(255,255,255,0.08)",
    }}
  >
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 62, overflow: "hidden", background: wallpaper }}>
      {children}
      {/* Kamera-Insel */}
      <div style={{ position: "absolute", top: 16, left: "50%", marginLeft: -70, width: 140, height: 38, borderRadius: 19, background: "#04060C" }} />
    </div>
  </div>
);

/* ---------------- Sperrbildschirm mit Benachrichtigung ---------------- */

const LockScreen: React.FC<{ s: ChatSceneT; frame: number }> = ({ s, frame }) => {
  const look = useLook();
  const lock = s.lock ?? { time: "06:12", date: "", title: s.contact, preview: "", app: "Brief" };
  const group = s.messages.some((m) => m.from) || lock.app === "Gruppe";
  const notifAt = 8;
  const n = spring({ frame: frame - notifAt, fps: FPS, config: { damping: 13, stiffness: 150 } });
  const shake = frame > notifAt && frame < notifAt + 14 ? Math.sin((frame - notifAt) * 2.2) * 6 * (1 - (frame - notifAt) / 14) : 0;
  return (
    <Phone wallpaper="linear-gradient(170deg, #2A1B5E 0%, #6B2E6E 46%, #E0785C 100%)">
      <StatusBar time={lock.time} />
      <Sfx frame={notifAt} name="ding" volume={0.45} />
      <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center", fontFamily: theme.font.body, fontWeight: 700, fontSize: 32, color: "rgba(255,255,255,0.85)" }}>
        {lock.date}
      </div>
      <div style={{ position: "absolute", top: 160, width: "100%", textAlign: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 190, letterSpacing: "-0.04em", color: "#FFFFFF", lineHeight: 1 }}>
        {lock.time}
      </div>
      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          top: 430,
          padding: "26px 30px",
          borderRadius: 38,
          background: "rgba(255,255,255,0.88)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.3)",
          transform: `translateY(${interpolate(n, [0, 1], [-520, 0]) + shake}px) scale(${interpolate(n, [0, 1], [0.9, 1])})`,
          opacity: n,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {group ? (
            <GroupAvatar size={58} colors={[]} />
          ) : (
            <div style={{ width: 58, height: 58, borderRadius: 16, background: `linear-gradient(135deg, ${look.accent}, #E39B3A)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 32, color: "#3A2208" }}>
              {s.contact.slice(0, 1)}
            </div>
          )}
          <div style={{ flex: 1, fontFamily: theme.font.body, fontWeight: 700, fontSize: 26, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(16,19,31,0.55)" }}>{lock.app}</div>
          <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: 26, color: "rgba(16,19,31,0.5)" }}>jetzt</div>
        </div>
        <div style={{ marginTop: 16, fontFamily: theme.font.body, fontWeight: 800, fontSize: 38, color: "#10131F" }}>{lock.title}</div>
        <div style={{ marginTop: 6, fontFamily: theme.font.body, fontWeight: 500, fontSize: 34, lineHeight: 1.25, color: "#10131F" }}>{lock.preview}</div>
      </div>
      <div style={{ position: "absolute", bottom: 70, width: "100%", textAlign: "center", fontFamily: theme.font.body, fontWeight: 600, fontSize: 26, color: "rgba(255,255,255,0.8)", opacity: 0.6 + 0.4 * Math.sin(frame / 8) }}>
        Zum Öffnen nach oben wischen
      </div>
      <div style={{ position: "absolute", bottom: 26, left: "50%", marginLeft: -110, width: 220, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.85)" }} />
    </Phone>
  );
};

/* ---------------- Chatverlauf ---------------- */

const Bubble: React.FC<{ m: Msg; age: number; frame: number; color?: string; group?: boolean }> = ({ m, age, frame, color, group }) => {
  if (m.kind === "divider" && group) {
    // Im Gruppenchat ist die Systemzeile die Pointe («… hat die Gruppe verlassen»)
    const pop = spring({ frame: age, fps: FPS, config: { damping: 9, stiffness: 160 } });
    return (
      <div style={{ alignSelf: "center", marginTop: 10, padding: "14px 30px", borderRadius: 999, background: "rgba(255,211,110,0.18)", border: "2px solid rgba(255,211,110,0.55)", fontFamily: theme.font.body, fontWeight: 800, fontSize: 30, color: "#FFE3A3", transform: `scale(${interpolate(pop, [0, 1], [1.25, 1])})` }}>
        {m.text}
      </div>
    );
  }
  if (m.kind === "divider") {
    return (
      <div style={{ alignSelf: "center", padding: "10px 24px", borderRadius: 999, background: "rgba(255,255,255,0.14)", fontFamily: theme.font.body, fontWeight: 700, fontSize: 25, color: "rgba(255,255,255,0.85)" }}>
        {m.text}
      </div>
    );
  }
  if (m.kind === "sticker") {
    const bounce = spring({ frame: age, fps: FPS, config: { damping: 7, stiffness: 160 } });
    return (
      <div style={{ alignSelf: "flex-start", fontSize: 150, lineHeight: 1, transform: `scale(${interpolate(bounce, [0, 1], [0.2, 1])}) rotate(${Math.sin(frame / 9) * 6}deg)`, transformOrigin: "30% 80%" }}>
        {m.text}
      </div>
    );
  }
  const out = m.side === "out";
  const bubble = (
    <div
      style={{
        alignSelf: out ? "flex-end" : "flex-start",
        maxWidth: m.from ? 560 : 600,
        padding: m.kind === "plan" ? "14px 14px 20px" : m.from ? "16px 28px 18px" : "22px 28px 18px",
        borderRadius: out ? "34px 34px 10px 34px" : "34px 34px 34px 10px",
        background: out ? "#D6F5C9" : "#F4F1EA",
        color: "#10131F",
        boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
      }}
    >
      {m.from ? (
        <div style={{ marginBottom: 4, fontFamily: theme.font.body, fontWeight: 800, fontSize: 27, color: color ?? SENDER_COLORS[0] }}>{m.from}</div>
      ) : null}
      {m.kind === "plan" ? <PlanSketch age={age} /> : null}
      <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: 38, lineHeight: 1.24, padding: m.kind === "plan" ? "14px 14px 0" : 0 }}>{m.text}</div>
      {m.meta ? (
        <div style={{ marginTop: 6, textAlign: "right", fontFamily: theme.font.body, fontWeight: 600, fontSize: 22, color: "#6B7280" }}>{m.meta}</div>
      ) : null}
      {out ? (
        <div style={{ marginTop: 4, textAlign: "right", fontFamily: theme.font.body, fontWeight: 700, fontSize: 22, color: "#3B82F6" }}>✓✓</div>
      ) : null}
    </div>
  );
  if (!m.from || out) return bubble;
  // Gruppenchat: kleines Profilbild neben der Blase
  return (
    <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "flex-end", gap: 14 }}>
      <div style={{ width: 58, height: 58, borderRadius: 29, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 28, color: "#FFFFFF", flexShrink: 0 }}>
        {m.from.slice(0, 1)}
      </div>
      {bubble}
    </div>
  );
};

const Typing: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ alignSelf: "flex-start", padding: "24px 30px", borderRadius: "34px 34px 34px 10px", background: "#F4F1EA", display: "flex", gap: 12 }}>
    {[0, 1, 2].map((k) => (
      <div key={k} style={{ width: 18, height: 18, borderRadius: 9, background: "#8B90A0", transform: `translateY(${-8 * Math.max(0, Math.sin(frame / 3.2 - k * 0.9))}px)` }} />
    ))}
  </div>
);

/** Skizze der List von Manti (Alma 58:16–22): Gid und Teomner verstecken sich, das Heer lockt, die Stadt fällt. */
const PlanSketch: React.FC<{ age: number }> = ({ age }) => {
  const p = (from: number, to: number) => interpolate(age / FPS, [from, to], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const ink = "#3B2A1A";
  return (
    <svg width={560} height={330} viewBox="0 0 560 330" style={{ display: "block", borderRadius: 24 }}>
      <rect width={560} height={330} fill="#EAD7AE" />
      <rect width={560} height={330} fill="url(#planStain)" opacity={0.4} />
      <defs>
        <radialGradient id="planStain" cx="0.3" cy="0.4" r="0.8">
          <stop offset="0%" stopColor="#FFF3D6" />
          <stop offset="100%" stopColor="#C9A86C" />
        </radialGradient>
      </defs>
      {/* Wildnis links */}
      {Array.from({ length: 14 }, (_, i) => {
        const x = 30 + (i % 4) * 34 + (i % 2) * 10;
        const y = 50 + Math.floor(i / 4) * 66;
        return <path key={i} d={`M ${x} ${y + 22} L ${x + 12} ${y} L ${x + 24} ${y + 22} Z`} fill="#6E7F45" opacity={0.75} />;
      })}
      {/* Manti */}
      <g transform="translate(450 165)">
        <rect x={-34} y={-28} width={68} height={56} fill="#B9A27A" stroke={ink} strokeWidth={3} />
        {[-28, -12, 4, 20].map((x) => (
          <rect key={x} x={x} y={-38} width={9} height={10} fill={ink} />
        ))}
        <text y={56} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={30} fill={ink}>Manti</text>
      </g>
      {/* Gid oben, Teomner unten – versteckt */}
      <g opacity={p(0.2, 0.6)}>
        <circle cx={250} cy={60} r={20} fill="#3C7A3A" />
        <text x={250} y={30} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={26} fill={ink}>Gid</text>
        <circle cx={250} cy={272} r={20} fill="#3C7A3A" />
        <text x={250} y={318} textAnchor="middle" fontFamily="Caveat" fontWeight={700} fontSize={26} fill={ink}>Teomner</text>
      </g>
      {/* Helamans Lager und Rückzug */}
      <circle cx={300} cy={165} r={24} fill="#2B5BA8" />
      <path d="M 410 165 L 330 165" stroke="#B5302A" strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p(0.6, 1.2)} markerEnd="url(#arrRed)" fill="none" />
      <path d="M 276 165 C 220 160, 170 150, 120 140" stroke="#2B5BA8" strokeWidth={7} strokeLinecap="round" strokeDasharray="14 12" fill="none" opacity={p(1.0, 1.4)} />
      <path d="M 250 82 C 330 100, 380 130, 420 150" stroke="#3C7A3A" strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p(1.5, 2.2)} fill="none" />
      <path d="M 250 250 C 330 230, 380 200, 420 180" stroke="#3C7A3A" strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p(1.5, 2.2)} fill="none" />
      <defs>
        <marker id="arrRed" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="#B5302A" />
        </marker>
      </defs>
    </svg>
  );
};

const Thread: React.FC<{ ts: TimelineScene; s: ChatSceneT; frame: number }> = ({ ts, s, frame }) => {
  const look = useLook();
  const t = (frame - ts.audioOffsetFrames) / FPS;
  const timed = s.messages.map((m) => ({ m, at: m.at ? beat(ts, m.at, -1) : -Infinity }));
  const visible = timed.filter((x) => t >= x.at);
  const upcoming = timed.find((x) => Number.isFinite(x.at) && t < x.at && t >= x.at - typingSec(x.m) && x.m.kind !== "divider");
  // Eigene Nachrichten werden im Eingabefeld getippt, nicht als «schreibt …» angezeigt
  const next = upcoming && upcoming.m.side !== "out" ? upcoming : undefined;
  const drafting = upcoming && upcoming.m.side === "out" ? upcoming : undefined;
  const colors = senderColors(s.messages);
  const group = colors.size > 0;
  return (
    <Phone wallpaper={`linear-gradient(180deg, #0F1626 0%, #131C33 100%)`}>
      <StatusBar time={s.lock?.time ?? "06:13"} />
      {/* Kopf */}
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, height: 120, display: "flex", alignItems: "center", gap: 20, padding: "0 30px", borderBottom: "2px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
        <span style={{ fontFamily: theme.font.body, fontWeight: 500, fontSize: 64, color: look.accent, marginTop: -8 }}>‹</span>
        {group ? (
          <GroupAvatar size={78} colors={[...colors.values()]} />
        ) : (
          <div style={{ width: 78, height: 78, borderRadius: 39, background: `linear-gradient(135deg, ${look.accent}, #E39B3A)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 40, color: "#3A2208" }}>
            {s.contact.slice(0, 1)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: 38, color: "#FFFFFF" }}>{s.contact}</div>
          <div style={{ fontFamily: theme.font.body, fontWeight: 600, fontSize: 24, color: next ? look.accent2 : "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {next ? (next.m.from ? `${next.m.from} schreibt …` : "schreibt …") : (s.contactSub ?? "")}
          </div>
        </div>
      </div>
      {/* Verlauf: unten bündig, ältere Nachrichten wandern nach oben aus dem Bild */}
      <div style={{ position: "absolute", top: 190, left: 0, right: 0, bottom: 118, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 16, padding: "20px 26px", overflow: "hidden" }}>
        {visible.map(({ m, at }, i) => {
          const age = Number.isFinite(at) ? frame - voiceFrame(ts, at) : 999;
          const sp = Number.isFinite(at) ? spring({ frame: age, fps: FPS, config: { damping: 15, stiffness: 190, mass: 0.7 } }) : 1;
          return (
            <div key={i} style={{ maxHeight: interpolate(sp, [0, 1], [0, 520]), overflow: sp < 1 ? "hidden" : "visible", display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", opacity: sp, transform: `scale(${interpolate(sp, [0, 1], [0.7, 1])}) translateY(${interpolate(sp, [0, 1], [30, 0])}px)`, transformOrigin: m.side === "out" ? "100% 100%" : "0% 100%" }}>
                <Bubble m={m} age={age} frame={frame} color={m.from ? colors.get(m.from) : undefined} group={group} />
              </div>
            </div>
          );
        })}
        {next ? (
          next.m.from ? (
            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "flex-end", gap: 14 }}>
              <div style={{ width: 58, height: 58, borderRadius: 29, background: colors.get(next.m.from), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font.body, fontWeight: 800, fontSize: 28, color: "#FFFFFF" }}>
                {next.m.from.slice(0, 1)}
              </div>
              <Typing frame={frame} />
            </div>
          ) : (
            <Typing frame={frame} />
          )
        ) : null}
      </div>
      {timed.map(({ m, at }, i) =>
        Number.isFinite(at) ? (
          <React.Fragment key={i}>
            <Sfx frame={voiceFrame(ts, at)} name={m.kind === "sticker" ? "chime" : "pop"} volume={m.kind === "sticker" ? 0.3 : 0.45} />
            {m.kind !== "divider" ? <Sfx frame={voiceFrame(ts, at - typingSec(m))} name="type" volume={0.18} /> : null}
          </React.Fragment>
        ) : null,
      )}
      {/* Eingabezeile */}
      <div style={{ position: "absolute", bottom: 26, left: 24, right: 24, height: 76, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, height: 76, borderRadius: 38, background: drafting ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", padding: "0 30px", fontFamily: theme.font.body, fontWeight: drafting ? 600 : 500, fontSize: 30, color: drafting ? "#FFFFFF" : "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden" }}>
          {drafting ? (
            <span style={{ display: "inline-flex", justifyContent: "flex-end", overflow: "hidden", maxWidth: "100%" }}>
              <span style={{ whiteSpace: "nowrap" }}>
                {drafting.m.text.slice(0, Math.ceil(drafting.m.text.length * interpolate(t, [drafting.at - DRAFT_SEC, drafting.at - 0.15], [0, 1], clamp)))}
              </span>
              <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: look.accent2 }}>|</span>
            </span>
          ) : (
            "Nachricht"
          )}
        </div>
        <div style={{ width: 76, height: 76, borderRadius: 38, background: look.accent2, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={36} height={36} viewBox="0 0 24 24">
            <path d="M3 11 L21 3 L13 21 L11 13 Z" fill="#0B1A10" />
          </svg>
        </div>
      </div>
    </Phone>
  );
};

export const ChatScene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as ChatSceneT;
  const frame = useCurrentFrame();
  return <AbsoluteFill>{s.mode === "lock" ? <LockScreen s={s} frame={frame} /> : <Thread ts={ts} s={s} frame={frame} />}</AbsoluteFill>;
};
