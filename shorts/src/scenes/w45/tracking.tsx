import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import { useLook } from "../../looks";
import { Sfx, beat, beats, voiceFrame } from "../../lib/sfx";
import { FPS, type TimelineScene, findCue } from "../../lib/timing";
import type { Scene as SceneDef } from "../../schema";
import { theme } from "../../theme";

/*
 * Sendungsverfolgung: Moronis Platten als Sendung durch die Zeit (Mormon 8:34–35, Moroni 10).
 * Eine App-Karte steht über allen Szenen an derselben Stelle – oben die Nummer und die drei
 * Schritte «Aufgegeben · Unterwegs · Zugestellt», darunter je Etappe ein anderes Feld:
 * die Sendung, der Absender, das Versteck im Hügel, die Nachricht auf der Platte, die
 * Zeitleiste bis heute und zuletzt «Zugestellt». Alles erscheint, wenn die Stimme es sagt.
 */

type TrackingSceneT = Extract<SceneDef, { type: "tracking" }>;
type P = { ts: TimelineScene; s: TrackingSceneT; t: number; frame: number };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BODY = theme.font.body;
const GOLD = "#F3C65B";
const GOLD_DEEP = "#9C6A1E";
const OK = "#3DDC97";
const RED = "#FF5A5F";

/** Die Karte der App – immer an derselben Stelle, damit die Überblendung ruhig bleibt */
const CARD = { x: 84, y: 258, w: 912, h: 920 };
const BODY_Y = CARD.y + 236;

const useT = (ts: TimelineScene) => (useCurrentFrame() - ts.audioOffsetFrames) / FPS;
const pop = (frame: number, at: number, ts: TimelineScene, stiffness = 180) =>
  spring({ frame: frame - voiceFrame(ts, at), fps: FPS, config: { damping: 13, stiffness } });

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

/** Die drei Schritte der Sendung; `progress` 0 … 2 (1 = unterwegs, 2 = zugestellt) */
const Stepper: React.FC<{ progress: number; frame: number }> = ({ progress, frame }) => {
  const look = useLook();
  const steps = ["Aufgegeben", "Unterwegs", "Zugestellt"];
  const x0 = CARD.x + 110;
  const x1 = CARD.x + CARD.w - 110;
  const y = CARD.y + 150;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  return (
    <>
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: y - 3, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.12)" }} />
      <div style={{ position: "absolute", left: x0, width: ((x1 - x0) * Math.min(2, progress)) / 2, top: y - 3, height: 6, borderRadius: 3, background: progress >= 2 ? OK : look.accent, boxShadow: `0 0 14px ${progress >= 2 ? OK : look.accent}` }} />
      {steps.map((label, i) => {
        const x = x0 + ((x1 - x0) * i) / 2;
        // «Aufgegeben» ist immer erledigt, «Unterwegs» läuft, bis die Sendung zugestellt ist
        const done = i === 0 || progress >= 2;
        const current = i === 1 && progress >= 0.5 && progress < 2;
        const color = progress >= 2 ? OK : done || current ? look.accent : "rgba(255,255,255,0.28)";
        return (
          <React.Fragment key={label}>
            {current ? (
              <div style={{ position: "absolute", left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: 34, background: look.accent, opacity: 0.18 + 0.2 * pulse }} />
            ) : null}
            <div style={{ position: "absolute", left: x - 19, top: y - 19, width: 38, height: 38, borderRadius: 19, background: done || current ? color : "#132038", border: `4px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {done ? (
                <svg width={22} height={22} viewBox="0 0 22 22">
                  <path d="M 4 11 L 9 16 L 18 6" stroke="#0B1424" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </div>
            <div style={{ position: "absolute", left: x - 130, width: 260, top: y + 30, textAlign: "center", fontFamily: BODY, fontWeight: 700, fontSize: 27, color: done || current ? "#FFFFFF" : "rgba(255,255,255,0.4)" }}>{label}</div>
          </React.Fragment>
        );
      })}
    </>
  );
};

/** Die Karte samt Kopf: Nummer, Status und die drei Schritte */
const AppCard: React.FC<{ progress: number; status: string; statusColor: string; frame: number; children: React.ReactNode }> = ({ progress, status, statusColor, frame, children }) => {
  const enter = interpolate(frame, [0, 10], [0, 1], clamp);
  const blink = 0.55 + 0.45 * Math.sin(frame / 5);
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div
        style={{
          position: "absolute",
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          borderRadius: 44,
          background: "linear-gradient(180deg, rgba(18,30,52,0.94) 0%, rgba(11,20,36,0.96) 100%)",
          border: "2px solid rgba(255,255,255,0.09)",
          boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      />
      <div style={{ position: "absolute", left: CARD.x + 48, top: CARD.y + 38, display: "flex", alignItems: "center", gap: 18 }}>
        <Parcel size={54} />
        <div>
          <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 24, letterSpacing: "0.22em", color: "rgba(255,255,255,0.55)" }}>SENDUNG</div>
          <div style={{ fontFamily: '"Space Mono"', fontWeight: 700, fontSize: 34, color: "#FFFFFF", letterSpacing: "0.06em" }}>Nr. 0421-MRN</div>
        </div>
      </div>
      <div style={{ position: "absolute", right: 1080 - CARD.x - CARD.w + 44, top: CARD.y + 52, padding: "10px 22px", borderRadius: 30, background: "rgba(255,255,255,0.06)", border: `2px solid ${statusColor}`, display: "flex", alignItems: "center", gap: 12, fontFamily: BODY, fontWeight: 800, fontSize: 26, color: statusColor }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: statusColor, opacity: blink, boxShadow: `0 0 12px ${statusColor}` }} />
        {status}
      </div>
      <Stepper progress={progress} frame={frame} />
      <div style={{ position: "absolute", left: CARD.x + 40, right: 1080 - CARD.x - CARD.w + 40, top: CARD.y + 214, height: 2, background: "rgba(255,255,255,0.07)" }} />
      {children}
    </AbsoluteFill>
  );
};

/** Ein kleines Paket: Karton mit Klebeband */
const Parcel: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 60 60">
    <path d="M 30 6 L 54 18 L 54 44 L 30 56 L 6 44 L 6 18 Z" fill="#C98B4B" />
    <path d="M 30 6 L 54 18 L 30 30 L 6 18 Z" fill="#E2A866" />
    <path d="M 30 30 L 30 56" stroke="#9C6531" strokeWidth={2} />
    <path d="M 18 12 L 42 24 L 42 34" stroke="#FFE3A8" strokeWidth={6} fill="none" opacity={0.85} />
  </svg>
);

/** Ein Feld wie in einer App: kleines Etikett, grosser Wert */
const Field: React.FC<{ label: string; value: string; y: number; on: number; color?: string; big?: boolean }> = ({ label, value, y, on, color, big }) => (
  <div style={{ position: "absolute", left: CARD.x + 60, right: 1080 - CARD.x - CARD.w + 60, top: y, opacity: on, transform: `translateY(${interpolate(on, [0, 1], [24, 0])}px)` }}>
    <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 24, letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)" }}>{label}</div>
    <div style={{ fontFamily: big ? theme.font.display : BODY, fontWeight: big ? 400 : 800, fontSize: big ? 84 : 50, lineHeight: 1.05, color: color ?? "#FFFFFF", textTransform: big ? "uppercase" : "none" }}>{value}</div>
  </div>
);

/** Die Messingplatten – hier Goldplatten mit drei Ringen; `lines` 0 … 1 graviert die Zeilen ein */
const Plates: React.FC<{ x: number; y: number; w: number; lines: number; glow: number }> = ({ x, y, w, lines, glow }) => {
  const h = w * 0.72;
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <linearGradient id="trGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF1B8" />
          <stop offset="40%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
        <radialGradient id="trGlow">
          <stop offset="0%" stopColor="#FFE9A0" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FFE9A0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {glow > 0 ? <ellipse cx={w / 2} cy={h / 2} rx={w * 0.95} ry={h * 0.95} fill="url(#trGlow)" opacity={glow} /> : null}
      {/* Stapel: die unteren Platten schauen heraus */}
      {[3, 2, 1].map((k) => (
        <rect key={k} x={k * 4} y={k * 7} width={w} height={h} rx={8} fill={GOLD_DEEP} opacity={0.9} />
      ))}
      <rect x={0} y={0} width={w} height={h} rx={8} fill="url(#trGold)" stroke="#7A4E12" strokeWidth={3} />
      <rect x={w * 0.14} y={h * 0.08} width={w * 0.8} height={h * 0.84} rx={4} fill="none" stroke="#8A5C18" strokeWidth={2} opacity={0.6} />
      {[0.22, 0.5, 0.78].map((k, i) => (
        <g key={i}>
          <circle cx={w * 0.07} cy={h * k} r={w * 0.045} fill="none" stroke="#6E4410" strokeWidth={w * 0.022} />
        </g>
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const reveal = Math.max(0, Math.min(1, lines * 6 - i));
        const lw = w * (i === 5 ? 0.42 : 0.66);
        return <rect key={i} x={w * 0.2} y={h * 0.18 + i * h * 0.12} width={lw * reveal} height={h * 0.035} rx={2} fill="#7A4E12" opacity={0.75} />;
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Etappen                                                             */
/* ------------------------------------------------------------------ */

/** Die Sendung: unterwegs seit über 1600 Jahren, Empfänger: du */
const Sent: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [msg, sent, to] = beats(ts, s.cues, 3);
  const box = pop(frame, msg - 0.1, ts, 150);
  const sentOn = pop(frame, sent, ts);
  const toOn = pop(frame, to, ts, 220);
  const years = Math.round(1600 * interpolate(t, [sent, sent + 1.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const bob = Math.sin(frame / 14) * 8;
  return (
    <AppCard progress={interpolate(t, [sent, sent + 1.2], [0.5, 1], clamp)} status="unterwegs" statusColor={look.accent} frame={frame}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(540 ${BODY_Y + 168 + bob}) scale(${interpolate(box, [0, 1], [0.4, 1])})`} opacity={Math.min(1, box * 1.5)}>
          <ellipse cx={0} cy={170} rx={170} ry={26} fill="#000" opacity={0.35} />
          <path d="M 0 -150 L 200 -60 L 200 110 L 0 200 L -200 110 L -200 -60 Z" fill="#B9773A" />
          <path d="M 0 -150 L 200 -60 L 0 30 L -200 -60 Z" fill="#DDA061" />
          <path d="M 0 30 L 0 200" stroke="#8C5526" strokeWidth={4} />
          <path d="M -110 -105 L 90 -15 L 90 60" stroke="#FFE7B0" strokeWidth={30} fill="none" opacity={0.85} />
          {/* Etikett */}
          <g transform="translate(-150 40) skewY(24)">
            <rect x={0} y={0} width={120} height={80} rx={6} fill="#FFF8E8" />
            <rect x={12} y={14} width={70} height={8} rx={4} fill="#9AA4B5" />
            <rect x={12} y={32} width={92} height={8} rx={4} fill="#9AA4B5" />
            <rect x={12} y={50} width={52} height={8} rx={4} fill={look.accent} />
          </g>
        </g>
      </svg>
      <Field label="UNTERWEGS SEIT" value={`${years.toLocaleString("de-CH").replace(/’|'/g, " ")}+ Jahren`} y={BODY_Y + 392} on={sentOn} color={look.accent} />
      <Field label="EMPFÄNGER" value="du" y={BODY_Y + 516} on={toOn} big color="#FFFFFF" />
      {t >= to ? (
        <div style={{ position: "absolute", left: CARD.x + 40, right: 1080 - CARD.x - CARD.w + 40, top: BODY_Y + 500, height: 150, borderRadius: 24, border: `3px solid ${look.accent}`, boxShadow: `0 0 30px rgba(255,204,51,0.35)`, opacity: toOn }} />
      ) : null}
      <Sfx frame={voiceFrame(ts, msg - 0.1)} name="pop" volume={0.45} />
      <Sfx frame={voiceFrame(ts, sent)} name="tick" volume={0.35} />
      <Sfx frame={voiceFrame(ts, sent + 1.6)} name="blip" volume={0.25} />
      <Sfx frame={voiceFrame(ts, to)} name="ding" volume={0.5} keep />
    </AppCard>
  );
};

/** Ein Mensch als Silhouette mit Umhang – (x, y) = Füsse */
const Figure: React.FC<{ x: number; y: number; s?: number; fill: string; opacity?: number }> = ({ x, y, s = 1, fill, opacity = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
    <circle cx={0} cy={-92} r={15} fill={fill} />
    <path d="M -14 -76 Q 0 -82 14 -76 L 24 -6 Q 0 4 -24 -6 Z" fill={fill} />
    <rect x={-12} y={-8} width={8} height={8} fill={fill} />
    <rect x={4} y={-8} width={8} height={8} fill={fill} />
  </g>
);

/** Der Absender: Moroni, um 421, allein */
const Sender: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [who, when, alone] = beats(ts, s.cues, 3);
  const goneAt = beat(ts, "Sein Volk ist untergegangen", (when + alone) / 2);
  const whoOn = pop(frame, who, ts);
  const whenOn = pop(frame, when, ts);
  const aloneOn = pop(frame, alone, ts);
  // Das Volk: Figuren, die nach und nach verblassen – bis nur einer bleibt
  const crowd = Array.from({ length: 9 }, (_, i) => i);
  const pane = { x: CARD.x + 40, y: BODY_Y + 268, w: CARD.w - 80, h: 300 };
  const moon = interpolate(t, [alone - 0.3, alone + 0.8], [0, 1], clamp);
  return (
    <AppCard progress={1} status="unterwegs" statusColor={look.accent} frame={frame}>
      {/* Avatar */}
      <div style={{ position: "absolute", left: CARD.x + 60, top: BODY_Y + 40, width: 190, height: 190, borderRadius: 95, background: "radial-gradient(circle at 50% 35%, #2B3E63 0%, #142139 100%)", border: `4px solid ${look.accent}`, overflow: "hidden", opacity: whoOn }}>
        <svg width={190} height={190} viewBox="0 0 190 190">
          <Figure x={95} y={214} s={1.7} fill="#0A1222" />
        </svg>
      </div>
      <div style={{ position: "absolute", left: CARD.x + 290, top: BODY_Y + 46, opacity: whoOn, transform: `translateX(${interpolate(whoOn, [0, 1], [30, 0])}px)` }}>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 24, letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)" }}>ABSENDER</div>
        <div style={{ fontFamily: theme.font.display, fontSize: 96, lineHeight: 1.05, color: "#FFFFFF", textTransform: "uppercase" }}>Moroni</div>
      </div>
      <div style={{ position: "absolute", left: CARD.x + 290, top: BODY_Y + 186, display: "flex", gap: 16, opacity: whenOn, transform: `translateY(${interpolate(whenOn, [0, 1], [20, 0])}px)` }}>
        <span style={{ padding: "8px 20px", borderRadius: 24, background: "rgba(255,204,51,0.14)", color: look.accent, fontFamily: BODY, fontWeight: 800, fontSize: 32 }}>um 421 n. Chr.</span>
      </div>
      {/* Bild: das Volk verschwindet, einer bleibt */}
      <div style={{ position: "absolute", left: pane.x, top: pane.y, width: pane.w, height: pane.h, borderRadius: 28, overflow: "hidden", background: "linear-gradient(180deg, #0E1A36 0%, #23305A 60%, #3A3550 100%)" }}>
        <svg width={pane.w} height={pane.h}>
          {Array.from({ length: 26 }, (_, i) => (
            <circle key={i} cx={random(`st${i}`) * pane.w} cy={random(`su${i}`) * pane.h * 0.55} r={1.2 + random(`sv${i}`) * 1.6} fill="#FFFFFF" opacity={0.25 + 0.5 * random(`sw${i}`)} />
          ))}
          <circle cx={pane.w - 140} cy={86} r={46} fill="#FFF3CF" opacity={0.25 + 0.7 * moon} />
          <circle cx={pane.w - 140} cy={86} r={110} fill="#FFF3CF" opacity={0.08 * moon} />
          <path d={`M 0 ${pane.h} L 0 ${pane.h - 70} Q ${pane.w * 0.3} ${pane.h - 150} ${pane.w * 0.55} ${pane.h - 110} Q ${pane.w * 0.8} ${pane.h - 80} ${pane.w} ${pane.h - 120} L ${pane.w} ${pane.h} Z`} fill="#0A1120" />
          {crowd.map((i) => {
            const last = i === 4;
            const fade = last ? 1 : interpolate(t, [goneAt + i * 0.12, goneAt + 0.5 + i * 0.12], [1, 0.06], clamp);
            const x = 90 + i * ((pane.w - 180) / 8);
            const y = pane.h - 96 - Math.sin((x / pane.w) * Math.PI) * 26;
            return (
              <g key={i}>
                {last ? <Figure x={x + 2} y={y} s={1.12} fill="#FFF3CF" opacity={0.35 * moon} /> : null}
                <Figure x={x} y={y} s={last ? 1.05 : 0.85 + 0.15 * random(`fs${i}`)} fill={last ? "#05080F" : "#3A4C72"} opacity={fade} />
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ position: "absolute", left: pane.x, width: pane.w, top: pane.y + pane.h + 24, display: "flex", alignItems: "center", gap: 16, paddingLeft: 20, opacity: aloneOn, fontFamily: BODY, fontWeight: 800, fontSize: 40, color: "#FFFFFF" }}>
        <span style={{ width: 20, height: 20, borderRadius: 10, background: RED, boxShadow: `0 0 14px ${RED}` }} />
        Status: allein
      </div>
      <Sfx frame={voiceFrame(ts, who)} name="pop" volume={0.4} />
      <Sfx frame={voiceFrame(ts, when)} name="blip" volume={0.3} />
      <Sfx frame={voiceFrame(ts, goneAt)} name="whoosh" volume={0.25} />
      <Sfx frame={voiceFrame(ts, alone)} name="tick" volume={0.35} />
    </AppCard>
  );
};

/** Das Versteck: die letzten Worte, dann in die Erde – eine Stecknadel auf dem Hügel */
const Hidden: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const [words, bury] = beats(ts, s.cues, 2);
  const pane = { x: CARD.x + 40, y: BODY_Y + 24, w: CARD.w - 80, h: 560 };
  const ground = 236;
  const engrave = interpolate(t, [words - 0.1, bury - 0.2], [0.05, 1], clamp);
  const down = interpolate(t, [bury, bury + 1.0], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const lid = interpolate(t, [bury + 0.9, bury + 1.3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const pin = spring({ frame: frame - voiceFrame(ts, bury + 1.35), fps: FPS, config: { damping: 9, stiffness: 170 } });
  const pw = 206;
  const plateY = interpolate(down, [0, 1], [ground - 230, ground + 140]);
  return (
    <AppCard progress={1} status="unterwegs" statusColor={look.accent} frame={frame}>
      <div style={{ position: "absolute", left: pane.x, top: pane.y, width: pane.w, height: pane.h, borderRadius: 28, overflow: "hidden", background: "linear-gradient(180deg, #101C38 0%, #1C2A4E 40%, #2A2C45 47%)" }}>
        <svg width={pane.w} height={pane.h}>
          {/* Hügel im Schnitt */}
          <path d={`M 0 ${ground + 40} Q ${pane.w * 0.5} ${ground - 120} ${pane.w} ${ground + 40} L ${pane.w} ${pane.h} L 0 ${pane.h} Z`} fill="#4A3524" />
          <path d={`M 0 ${ground + 40} Q ${pane.w * 0.5} ${ground - 120} ${pane.w} ${ground + 40}`} stroke="#3D6B3A" strokeWidth={16} fill="none" />
          {[0, 1, 2, 3].map((k) => (
            <path key={k} d={`M 0 ${ground + 120 + k * 80} Q ${pane.w * 0.5} ${ground + 40 + k * 80} ${pane.w} ${ground + 120 + k * 80}`} stroke="#3A2918" strokeWidth={3} fill="none" opacity={0.6} />
          ))}
          {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={random(`pe${i}`) * pane.w} cy={ground + 60 + random(`pf${i}`) * (pane.h - ground - 80)} r={3 + random(`pg${i}`) * 6} fill="#5E4530" opacity={0.7} />
          ))}
          {/* Steinkiste */}
          <g transform={`translate(${pane.w / 2} ${ground + 130})`}>
            <rect x={-140} y={0} width={280} height={180} fill="#6F6A62" stroke="#3E3A35" strokeWidth={6} />
            <rect x={-120} y={14} width={240} height={152} fill="#2B2724" />
          </g>
          {/* Platten */}
          <g clipPath={down > 0.5 ? "url(#trBox)" : undefined}>
            <Plates x={pane.w / 2 - pw / 2} y={plateY} w={pw} lines={engrave} glow={1 - down} />
          </g>
          <defs>
            <clipPath id="trBox">
              <rect x={0} y={0} width={pane.w} height={ground + 130 + 166} />
            </clipPath>
          </defs>
          {/* Deckel */}
          <g transform={`translate(${pane.w / 2} ${ground + 130 - 22 * (1 - lid)}) rotate(${(1 - lid) * -14})`} opacity={lid}>
            <rect x={-152} y={-14} width={304} height={30} fill="#87817A" stroke="#3E3A35" strokeWidth={5} />
          </g>
          {/* Stecknadel */}
          {pin > 0.01 ? (
            <g transform={`translate(${pane.w / 2} ${ground - 82 - interpolate(pin, [0, 1], [160, 0])})`} opacity={Math.min(1, pin * 2)}>
              <ellipse cx={0} cy={0} rx={26} ry={8} fill="#000" opacity={0.35} />
              <path d="M 0 0 C -12 -30 -42 -50 -42 -84 A 42 42 0 1 1 42 -84 C 42 -50 12 -30 0 0 Z" fill={look.accent} />
              <circle cx={0} cy={-84} r={16} fill="#0B1424" />
            </g>
          ) : null}
        </svg>
      </div>
      <div style={{ position: "absolute", left: pane.x, width: pane.w, top: pane.y + pane.h + 22, textAlign: "center", fontFamily: BODY, fontWeight: 800, fontSize: 40, color: "#FFFFFF", opacity: pin }}>
        Versteckt in einem Hügel
      </div>
      <Sfx frame={voiceFrame(ts, words)} name="type" volume={0.35} />
      <Sfx frame={voiceFrame(ts, bury)} name="whoosh" volume={0.35} />
      <Sfx frame={voiceFrame(ts, bury + 1.0)} name="stamp" volume={0.45} keep />
      <Sfx frame={voiceFrame(ts, bury + 1.35)} name="pop" volume={0.4} />
    </AppCard>
  );
};

/** Die Nachricht: auf die Platte graviert, Zeile für Zeile */
const Message: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const lines = s.cues.length ? s.cues : ["Ich spreche zu euch", "Jesus Christus hat euch mir gezeigt", "ich weiss, was ihr tut"];
  const texts = ["Ich spreche zu euch, als wärt ihr da.", "Jesus Christus hat euch mir gezeigt,", "und ich weiss, was ihr tut."];
  const at = beats(ts, lines, 3);
  const open = spring({ frame: frame - 2, fps: FPS, config: { damping: 14, stiffness: 140 } });
  const plate = { x: CARD.x + 34, y: BODY_Y + 70, w: CARD.w - 68, h: 560 };
  return (
    <AppCard progress={1} status="Nachricht" statusColor={look.accent2} frame={frame}>
      <div style={{ position: "absolute", left: CARD.x + 60, top: BODY_Y + 10, fontFamily: BODY, fontWeight: 800, fontSize: 24, letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)", opacity: open }}>INHALT DER SENDUNG</div>
      <div
        style={{
          position: "absolute",
          left: plate.x,
          top: plate.y,
          width: plate.w,
          height: plate.h,
          borderRadius: 18,
          background: `linear-gradient(135deg, #FFF0B0 0%, ${GOLD} 38%, #D9A443 70%, ${GOLD_DEEP} 100%)`,
          border: "4px solid #7A4E12",
          boxShadow: "0 30px 60px rgba(0,0,0,0.45), inset 0 0 40px rgba(122,78,18,0.35)",
          opacity: open,
          transform: `scale(${interpolate(open, [0, 1], [0.8, 1])}) rotate(${interpolate(open, [0, 1], [-4, 0])}deg)`,
        }}
      >
        {[0.2, 0.5, 0.8].map((k) => (
          <div key={k} style={{ position: "absolute", left: 22, top: plate.h * k - 26, width: 52, height: 52, borderRadius: 26, border: "9px solid #6E4410", background: "rgba(30,20,8,0.45)" }} />
        ))}
        <div style={{ position: "absolute", left: 100, right: 40, top: 30, bottom: 30, border: "2px solid rgba(110,68,16,0.55)", borderRadius: 8 }} />
        <div style={{ position: "absolute", left: 130, right: 64, top: 70, display: "flex", flexDirection: "column", gap: 34 }}>
          {texts.map((text, i) => {
            const k = interpolate(t, [at[i] - 0.05, at[i] + 0.95], [0, 1], clamp);
            return (
              <div key={i} style={{ position: "relative" }}>
                <div
                  style={{
                    fontFamily: "Cinzel",
                    fontWeight: 700,
                    fontSize: 50,
                    lineHeight: 1.18,
                    color: "#5A3A0E",
                    textShadow: "0 1px 0 rgba(255,240,190,0.75), 0 -1px 0 rgba(70,40,5,0.45)",
                    clipPath: `inset(0 ${100 - k * 100}% 0 0)`,
                  }}
                >
                  {text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {at.map((a, i) => (
        <React.Fragment key={i}>
          <Sfx frame={voiceFrame(ts, a)} name="type" volume={0.3} />
          {i === 1 ? <Sfx frame={voiceFrame(ts, a + 0.2)} name="chime" volume={0.3} /> : null}
        </React.Fragment>
      ))}
    </AppCard>
  );
};

/** Unterwegs: die Zeitleiste von 421 bis heute */
const Transit: React.FC<P> = ({ ts, s, t, frame }) => {
  const look = useLook();
  const events = s.events;
  const ats = events.map((e, i) => (e.at ? beat(ts, e.at, ts.speechStartSec + i * 2) : ts.speechStartSec + i * 2));
  const top = BODY_Y + 50;
  const step = 160;
  const lineX = CARD.x + 120;
  const current = ats.reduce((acc, a, i) => (t >= a - 0.05 ? i : acc), -1);
  const lastAt = ats[ats.length - 1] ?? 0;
  // Der Punkt der Sendung gleitet zur jüngsten Zeile
  const prev = Math.max(0, current - 1);
  const k = current < 0 ? 0 : interpolate(t, [ats[current], ats[current] + 0.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const dotY = top + (current < 0 ? 0 : (current === 0 ? 0 : prev + (current - prev) * k) * step);
  const delivered = t >= lastAt - 0.05;
  return (
    <AppCard progress={interpolate(t, [lastAt - 0.1, lastAt + 0.6], [1.2, 2], clamp)} status={delivered ? "zugestellt" : "unterwegs"} statusColor={delivered ? OK : look.accent} frame={frame}>
      <div style={{ position: "absolute", left: lineX - 3, top: top, width: 6, height: step * (events.length - 1), background: "rgba(255,255,255,0.12)", borderRadius: 3 }} />
      <div style={{ position: "absolute", left: lineX - 3, top: top, width: 6, height: Math.max(0, dotY - top), background: look.accent, borderRadius: 3, boxShadow: `0 0 12px ${look.accent}` }} />
      {events.map((e, i) => {
        const on = spring({ frame: frame - voiceFrame(ts, ats[i]), fps: FPS, config: { damping: 14, stiffness: 190 } });
        const seen = t >= ats[i] - 0.05;
        const last = i === events.length - 1;
        const color = last ? OK : look.accent;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: lineX - 17, top: top + i * step - 17, width: 34, height: 34, borderRadius: 17, background: seen ? color : "#132038", border: `4px solid ${seen ? color : "rgba(255,255,255,0.25)"}` }} />
            <div style={{ position: "absolute", left: lineX + 56, right: 1080 - CARD.x - CARD.w + 50, top: top + i * step - 48, opacity: seen ? on : 0.18, transform: `translateX(${interpolate(seen ? on : 0, [0, 1], [40, 0])}px)` }}>
              <div style={{ fontFamily: theme.font.display, fontSize: 70, lineHeight: 1, color: seen ? (last ? OK : "#FFFFFF") : "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>{e.time}</div>
              <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 36, color: seen ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)" }}>{e.text}</div>
            </div>
            {seen && last ? (
              <svg width={90} height={90} style={{ position: "absolute", left: CARD.x + CARD.w - 150, top: top + i * step - 50 }}>
                <circle cx={45} cy={45} r={38} fill="none" stroke={OK} strokeWidth={7} opacity={on} />
                <path d="M 26 46 L 40 60 L 64 32" stroke={OK} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${on} 1`} />
              </svg>
            ) : null}
            <Sfx frame={voiceFrame(ts, ats[i])} name={last ? "ding" : "blip"} volume={last ? 0.5 : 0.3} />
          </React.Fragment>
        );
      })}
      {current >= 0 ? (
        <div style={{ position: "absolute", left: lineX - 30, top: dotY - 30, width: 60, height: 60, borderRadius: 30, border: `4px solid ${delivered ? OK : look.accent}`, opacity: 0.5 + 0.5 * Math.sin(frame / 4), boxShadow: `0 0 20px ${delivered ? OK : look.accent}` }} />
      ) : null}
    </AppCard>
  );
};

/** Zugestellt: grosser Haken, Empfänger du – und «Für dich geschrieben» in Handschrift */
const Delivered: React.FC<P> = ({ ts, s, t, frame }) => {
  const [seen, wrote] = beats(ts, s.cues, 2);
  const check = interpolate(frame, [4, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const seenOn = pop(frame, seen, ts);
  const write = interpolate(t, [wrote - 0.05, wrote + 1.1], [0, 1], clamp);
  const rays = interpolate(frame, [0, 30], [0, 1], clamp);
  return (
    <AppCard progress={2} status="zugestellt" statusColor={OK} frame={frame}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="trOk">
            <stop offset="0%" stopColor={OK} stopOpacity="0.45" />
            <stop offset="100%" stopColor={OK} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(540 ${BODY_Y + 150})`}>
          <circle r={220 * rays} fill="url(#trOk)" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={-4} y={-200} width={8} height={40} rx={4} fill={OK} opacity={0.5 * rays} transform={`rotate(${i * 30 + frame * 0.4})`} />
          ))}
          <circle r={118} fill="none" stroke={OK} strokeWidth={14} pathLength={1} strokeDasharray={`${check} 1`} transform="rotate(-90)" />
          <path d="M -54 4 L -14 44 L 60 -40" stroke={OK} strokeWidth={20} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${interpolate(frame, [14, 30], [0, 1], clamp)} 1`} />
        </g>
      </svg>
      <div style={{ position: "absolute", top: BODY_Y + 296, width: "100%", textAlign: "center", fontFamily: theme.font.display, fontSize: 100, color: OK, textTransform: "uppercase", letterSpacing: "0.03em", opacity: check }}>Zugestellt</div>
      <div style={{ position: "absolute", left: CARD.x + 120, right: 1080 - CARD.x - CARD.w + 120, top: BODY_Y + 430, padding: "14px 30px", borderRadius: 26, background: "rgba(61,220,151,0.1)", border: `3px solid ${OK}`, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: seenOn, transform: `scale(${interpolate(seenOn, [0, 1], [0.85, 1])})` }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 30, letterSpacing: "0.16em", color: "rgba(255,255,255,0.6)" }}>EMPFÄNGER</span>
        <span style={{ fontFamily: theme.font.display, fontSize: 80, color: "#FFFFFF", textTransform: "uppercase" }}>du</span>
      </div>
      <div style={{ position: "absolute", top: BODY_Y + 566, width: "100%", textAlign: "center", fontFamily: "Caveat", fontWeight: 700, fontSize: 88, color: "#FFF3CF", clipPath: `inset(0 ${100 - write * 100}% 0 0)`, textShadow: "0 6px 24px rgba(0,0,0,0.5)" }}>
        Für dich geschrieben.
      </div>
      <Sfx frame={4} name="ding" volume={0.45} keep />
      <Sfx frame={voiceFrame(ts, seen)} name="pop" volume={0.4} />
      <Sfx frame={voiceFrame(ts, wrote)} name="chime" volume={0.35} />
    </AppCard>
  );
};

export const Scene: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const s = ts.scene as TrackingSceneT;
  const frame = useCurrentFrame();
  const t = useT(ts);
  const p = { ts, s, t, frame };
  return (
    <AbsoluteFill>
      {s.stage === "sent" ? <Sent {...p} /> : null}
      {s.stage === "sender" ? <Sender {...p} /> : null}
      {s.stage === "hidden" ? <Hidden {...p} /> : null}
      {s.stage === "message" ? <Message {...p} /> : null}
      {s.stage === "transit" ? <Transit {...p} /> : null}
      {s.stage === "delivered" ? <Delivered {...p} /> : null}
    </AbsoluteFill>
  );
};

/** Die Nachricht steht graviert auf der Platte, «Für dich geschrieben» in Handschrift – nicht noch einmal untertiteln. */
export const hidden = (ts: TimelineScene): Set<number> => {
  const s = ts.scene as TrackingSceneT;
  const texts =
    s.stage === "message" ? ["Ich spreche zu euch, als wärt ihr da", "Jesus Christus hat euch mir gezeigt", "und ich weiss, was ihr tut"] : s.stage === "delivered" ? ["Und für dich geschrieben"] : [];
  const out = new Set<number>();
  for (const text of texts) {
    const c = findCue(ts.words, text);
    if (c) for (let k = c.first; k <= c.last; k++) out.add(ts.words[k].index);
  }
  return out;
};
