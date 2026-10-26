import React, { useMemo } from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { DotField } from "../components/DotField";
import { useLook } from "../looks";
import { Sfx, type SfxName } from "../lib/sfx";
import { StageText } from "../components/StageText";
import { FPS, HEIGHT, type TimelineScene, WIDTH, cueTime, findCue } from "../lib/timing";
import { HorizonMotif } from "../motifs/Horizon";
import { SwordsMotif } from "../motifs/Swords";
import type { Scene } from "../schema";
import { theme } from "../theme";

type P = { ts: TimelineScene };
type SceneOf<T extends Scene["type"]> = Extract<Scene, { type: T }>;

/** Zeit relativ zum Stimmeinsatz der Szene (Sekunden, kann negativ sein). */
const useVoiceT = (ts: TimelineScene) => (useCurrentFrame() - ts.audioOffsetFrames) / FPS;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ---------------- bigNumber ---------------- */

export const BigNumberScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as SceneOf<"bigNumber">;
  const t = useVoiceT(ts);
  const firstEnd = ts.words[Math.max(0, s.captionSkipWords - 1)]?.end ?? 1.4;
  const p = interpolate(t, [-0.2, firstEnd], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const n = Math.round(s.number * p);
  const dots = Math.min(s.number, 2000);
  const dimAt = cueTime(ts.words, "Und keiner", firstEnd + 1.5);
  const dim = interpolate(t, [dimAt - 0.1, dimAt + 0.8], [1, 0.38], clamp);
  const breathe = 1 + 0.015 * Math.sin(t * 1.4);

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <DotField count={dots} lit={dots * p} x={100} y={290} w={880} h={860} opacity={0.6 * dim} seed="hook" />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 470,
          width: "100%",
          textAlign: "center",
          transform: `scale(${breathe})`,
        }}
      >
        <div
          style={{
            fontFamily: theme.font.display,
            fontSize: 340,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            background: `linear-gradient(180deg, #FFE7B0 0%, ${theme.gold} 45%, ${theme.goldDeep} 100%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 10px 50px rgba(246,200,106,0.35))",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {n}
        </div>
        {s.label ? (
          <div
            style={{
              marginTop: 18,
              fontFamily: theme.font.body,
              fontWeight: 800,
              fontSize: 46,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: theme.ivory,
              opacity: interpolate(t, [0.3, 0.9], [0, 0.9], clamp),
            }}
          >
            {s.label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- illustration ---------------- */

export const IllustrationScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as SceneOf<"illustration">;
  const frame = useCurrentFrame();
  const t = useVoiceT(ts);
  const durSec = ts.durationInFrames / FPS;

  if (s.image) {
    // Ken-Burns: langsamer Zoom + leichter Schwenk; unten abgedunkelt für Untertitel
    const z = interpolate(frame, [0, ts.durationInFrames], [1.12, 1.0]);
    const pan = interpolate(frame, [0, ts.durationInFrames], [-24, 24]);
    return (
      <AbsoluteFill>
        <Img
          src={staticFile(s.image)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z}) translateX(${pan}px)` }}
        />
        <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)" }} />
      </AbsoluteFill>
    );
  }
  if (s.motif === "swords") return <SwordsMotif t={t} words={ts.words} cue={s.cue} phase={s.phase} />;
  if (s.motif === "horizon") return <HorizonMotif t={t} words={ts.words} duration={durSec} cue={s.cue} />;
  return null;
};

/* ---------------- quote ---------------- */

export const QuoteScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as SceneOf<"quote">;
  const frame = useCurrentFrame();
  const t = useVoiceT(ts);
  const cue = useMemo(() => findCue(ts.words, s.quote), [ts.words, s.quote]);
  const tokens = s.quote.split(/\s+/).filter(Boolean);
  const qStart = cue ? ts.words[cue.first].start : 0.2;
  const lead = useMemo(
    () => new Set(ts.words.filter((w) => !cue || w.index < cue.first).map((w) => w.index)),
    [ts.words, cue],
  );

  const blockIn = interpolate(t, [qStart - 0.5, qStart], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const fontSize = s.quote.length <= 60 ? 96 : s.quote.length <= 100 ? 82 : 70;
  const glow = 0.16 + 0.05 * Math.sin(frame / 20);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 32% at 50% 40%, rgba(246,200,106,${glow * blockIn}) 0%, rgba(246,200,106,0) 100%)`,
        }}
      />
      {cue && cue.first > 0 ? <StageText words={ts.words} include={lead} audioOffsetFrames={ts.audioOffsetFrames} exitAt={qStart} y={720} /> : null}

      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 380,
          height: 760,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: blockIn,
          transform: `translateY(${interpolate(blockIn, [0, 1], [30, 0])}px)`,
        }}
      >
        {/* Ornament statt grossem Anführungszeichen (das „-Glyph sitzt tief und kollidiert mit der ersten Zeile) */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 44, opacity: 0.8 }}>
          <span style={{ width: 90, height: 2, background: `linear-gradient(90deg, transparent, ${theme.gold})` }} />
          <span style={{ width: 14, height: 14, background: theme.gold, transform: "rotate(45deg)" }} />
          <span style={{ width: 90, height: 2, background: `linear-gradient(270deg, transparent, ${theme.gold})` }} />
        </div>
        <div
          style={{
            fontFamily: theme.font.scripture,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize,
            lineHeight: 1.2,
            textAlign: "center",
            textShadow: "0 6px 30px rgba(0,0,0,0.5)",
          }}
        >
          {tokens.map((tok, i) => {
            const w = cue && cue.last - cue.first + 1 === tokens.length ? ts.words[cue.first + i] : null;
            // Fallback ohne Wortzuordnung: gleichmässig über die Szene verteilen
            const ws = w ? w.start : qStart + (i / tokens.length) * Math.max(1, ts.speechEndSec - qStart);
            const we = w ? w.end : ws + 0.3;
            const o = interpolate(t, [ws - 0.06, ws + 0.22], [0.16, 1], clamp);
            const active = t >= ws && t < we + 0.1;
            return (
              <span key={i} style={{ color: active ? theme.gold : theme.ivory, opacity: o }}>
                {i === 0 ? "„" : ""}
                {tok}
                {i === tokens.length - 1 ? "“" : ""}
                {i < tokens.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
        {s.ref ? (
          <div
            style={{
              marginTop: 46,
              display: "flex",
              alignItems: "center",
              gap: 22,
              fontFamily: theme.font.body,
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: theme.gold,
            }}
          >
            <span style={{ width: 70, height: 2, background: theme.gold, opacity: 0.6 }} />
            {s.ref}
            <span style={{ width: 70, height: 2, background: theme.gold, opacity: 0.6 }} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- dotField ---------------- */

export const DotFieldScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as SceneOf<"dotField">;
  const frame = useCurrentFrame();
  const t = useVoiceT(ts);
  const completeAt = cueTime(ts.words, s.completeAt, ts.speechEndSec * 0.5);
  const titleAt = cueTime(ts.words, s.titleAt, ts.speechEndSec);
  const p = interpolate(t, [0.1, completeAt], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const pulse = spring({ frame: frame - ts.audioOffsetFrames - Math.round(completeAt * FPS), fps: FPS, config: { damping: 9, stiffness: 120 } });
  const pulseDecay = interpolate(t, [completeAt, completeAt + 1.2], [1, 0], clamp);
  const titleIn = spring({ frame: frame - ts.audioOffsetFrames - Math.round((titleAt - 0.1) * FPS), fps: FPS, config: { damping: 18, stiffness: 120 } });
  const fieldFade = interpolate(titleIn, [0, 1], [1, 0.22]);
  const n = Math.round(s.count * p);
  // Titel auf zwei Zeilen: ab 3 Wörtern nach dem zweiten Wort umbrechen, sonst nach dem ersten
  const titleWords = (s.title ?? "").split(" ").filter(Boolean);
  const cut = titleWords.length >= 3 ? 2 : 1;
  const l1 = titleWords.slice(0, cut).join(" ");
  const l2 = titleWords.slice(cut).join(" ");

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${WIDTH / 2} 680) scale(${interpolate(titleIn, [0, 1], [1, 0.94])}) translate(${-WIDTH / 2} -680)`}>
          <DotField count={s.count} lit={n} x={100} y={280} w={880} h={800} pulse={pulse * pulseDecay} opacity={fieldFade} seed="count" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          top: 1100,
          width: "100%",
          textAlign: "center",
          fontFamily: theme.font.body,
          fontWeight: 800,
          fontSize: 54,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.04em",
          color: p >= 1 ? theme.gold : theme.ivory,
          opacity: interpolate(t, [0, 0.4], [0, 1], clamp) * (1 - titleIn),
        }}
      >
        {n} / {s.count}
      </div>
      {s.title ? (
        <div
          style={{
            position: "absolute",
            top: 470,
            width: "100%",
            textAlign: "center",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [60, 0])}px)`,
          }}
        >
          <div style={{ fontFamily: theme.font.display, fontSize: 178, lineHeight: 0.98, color: theme.ivory, textTransform: "uppercase", textShadow: "0 10px 50px rgba(0,0,0,0.5)" }}>
            {l1}
          </div>
          <div
            style={{
              fontFamily: theme.font.display,
              fontSize: 178,
              lineHeight: 0.98,
              textTransform: "uppercase",
              background: `linear-gradient(180deg, #FFE7B0 0%, ${theme.gold} 50%, ${theme.goldDeep} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 10px 40px rgba(246,200,106,0.3))",
            }}
          >
            {l2}
          </div>
          {s.ref ? (
            <div style={{ marginTop: 34, fontFamily: theme.font.body, fontWeight: 700, fontSize: 34, letterSpacing: "0.26em", color: theme.gold, textTransform: "uppercase" }}>
              {s.ref.split("·")[0].trim()}
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ---------------- kinetic ---------------- */

export const KineticScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as SceneOf<"kinetic">;
  const frame = useCurrentFrame();
  const look = useLook();
  const t = useVoiceT(ts);
  const { cues, lead } = useMemo(() => {
    const c = s.lines.map((l) => findCue(ts.words, l));
    const inLines = new Set(c.flatMap((x) => (x ? Array.from({ length: x.last - x.first + 1 }, (_, k) => x.first + k) : [])));
    return { cues: c, lead: new Set(ts.words.filter((w) => !inLines.has(w.index)).map((w) => w.index)) };
  }, [s.lines, ts.words]);
  const firstLineAt = cues[0] ? ts.words[cues[0].first].start : ts.speechEndSec;
  const current = cues.reduce((acc, c, i) => (c && t >= ts.words[c.first].start ? i : acc), -1);
  /* Jeder Look hat seinen eigenen Auftritt: Pixel-Ton, Trommel, Plopp, Wusch */
  const sfx: Partial<Record<string, SfxName>> = {
    arcade: "blip",
    map: "drum",
    chat: "pop",
    track: "whoosh",
    stone: "drum",
    ember: "whoosh",
    space: "blip",
    palace: "chime",
    dream: "whoosh",
    desert: "whoosh",
    temple: "drum",
    post: "ding",
    feed: "swipe",
    kitchen: "pop",
    dusk: "chime",
    forest: "whoosh",
  };
  const lineSfx = sfx[look.id];
  // Jede Zeile so gross, dass sie auf eine Zeile passt (Anton in Versalien ≈ 0.47 × Schriftgrösse pro Zeichen)
  const sizeOf = (line: string) => Math.round(Math.max(72, Math.min(look.id === "dawn" ? 136 : 150, 940 / (0.47 * line.length))));

  return (
    <AbsoluteFill>
      <StageText words={ts.words} include={lead} audioOffsetFrames={ts.audioOffsetFrames} exitAt={firstLineAt} y={700} fontSize={80} />
      <div style={{ position: "absolute", top: 430, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        {s.lines.map((line, i) => {
          const c = cues[i];
          const at = c ? ts.words[c.first].start : firstLineAt + i * 0.8;
          const startFrame = ts.audioOffsetFrames + Math.round((at - 0.06) * FPS);
          const sp = spring({ frame: frame - startFrame, fps: FPS, config: { damping: 14, stiffness: 210, mass: 0.7 } });
          const isCur = i === current;
          let transform = `scale(${interpolate(sp, [0, 1], [1.35, 1])}) rotate(${interpolate(sp, [0, 1], [-3, 0])}deg)`;
          let shadow = look.glow;
          if (look.id === "arcade") {
            // RGB-Versatz beim Auftritt, wie ein Glitch auf dem Bildschirm
            const dx = (1 - sp) * 16 + (isCur ? 2.5 * Math.sin(frame / 2) : 0);
            shadow = `${dx}px 0 0 #FF4FD8, ${-dx}px 0 0 #5CF3FF, ${look.glow}`;
            transform = `scale(${interpolate(sp, [0, 1], [1.12, 1])}) skewX(${(1 - sp) * -12}deg)`;
          } else if (look.id === "map") {
            // Wie ein Stempel aufs Pergament
            transform = `scale(${interpolate(sp, [0, 1], [1.7, 1])}) rotate(${(i % 2 ? 1.5 : -1.5) * sp}deg)`;
          }
          return (
            <React.Fragment key={i}>
              {lineSfx ? <Sfx frame={startFrame} name={lineSfx} volume={look.id === "map" ? 0.45 : 0.35} /> : null}
              <div
                style={{
                  fontFamily: look.display,
                  fontSize: sizeOf(line),
                  lineHeight: 1.02,
                  textAlign: "center",
                  textTransform: "uppercase",
                  color: isCur ? look.accent : look.text,
                  opacity: sp * (isCur ? 1 : 0.7),
                  transform,
                  textShadow: shadow,
                }}
              >
                {line}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- cta ---------------- */

export const CtaScene: React.FC<P> = ({ ts }) => {
  const s = ts.scene as SceneOf<"cta">;
  const frame = useCurrentFrame();
  const t = useVoiceT(ts);
  const tokens = s.question.split(/\s+/);
  const cue = findCue(ts.words, s.question);
  const cardAt = ts.speechEndSec + 0.25;
  const card = spring({ frame: frame - ts.audioOffsetFrames - Math.round(cardAt * FPS), fps: FPS, config: { damping: 18, stiffness: 110 } });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 360, left: 80, right: 80, textAlign: "center" }}>
        <div style={{ fontFamily: theme.font.display, fontSize: 118, lineHeight: 1.04, textTransform: "uppercase" }}>
          {tokens.map((tok, i) => {
            const w = cue ? ts.words[cue.first + i] : null;
            const ws = w ? w.start : i * 0.2;
            const o = interpolate(t, [ws - 0.05, ws + 0.18], [0.18, 1], clamp);
            return (
              <span key={i} style={{ color: theme.ivory, opacity: o, textShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
                {tok}
                {i < tokens.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      </div>
      {s.challenge ? (
        <div
          style={{
            position: "absolute",
            left: 90,
            right: 90,
            top: 940,
            padding: "44px 48px",
            borderRadius: 34,
            border: `2px solid rgba(246,200,106,0.7)`,
            background: "rgba(7,10,24,0.55)",
            backdropFilter: "blur(6px)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
            opacity: card,
            transform: `translateY(${interpolate(card, [0, 1], [120, 0])}px)`,
          }}
        >
          <div style={{ fontFamily: theme.font.body, fontWeight: 800, fontSize: 30, letterSpacing: "0.24em", textTransform: "uppercase", color: theme.gold }}>
            {s.challenge.label}
          </div>
          <div style={{ marginTop: 18, fontFamily: theme.font.body, fontWeight: 700, fontSize: 56, lineHeight: 1.2, color: theme.ivory }}>
            {s.challenge.text}
          </div>
        </div>
      ) : null}
      {s.footer ? (
        <div
          style={{
            position: "absolute",
            top: 1400,
            width: "100%",
            textAlign: "center",
            fontFamily: theme.font.body,
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: "0.06em",
            color: theme.ivoryDim,
            opacity: interpolate(card, [0, 1], [0, 1]),
          }}
        >
          {s.footer}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
