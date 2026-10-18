import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, type CalculateMetadataFunction, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Grain, Particles } from "./components/Atmosphere";
import { ArcadeBg, ChatBg, JournalBg, MapBg, NoirBg, ShowBg, TrackBg } from "./components/Backgrounds";
import { BrandBar, RefLabel } from "./components/BrandBar";
import { Captions } from "./components/Captions";
import { Sky } from "./components/Sky";
import { fontsReady } from "./lib/fonts";
import { FPS, type Timeline, type TimelineScene, TRANSITION_FRAMES, buildTimeline, findCue } from "./lib/timing";
import { LookProvider } from "./looks";
import { ChatScene } from "./scenes/chat";
import { BlocksScene, BuzzerScene, JournalScene, JumperScene, LedgerScene, LineupScene, TreasureScene } from "./scenes/extra";
import { HeroScene } from "./scenes/game";
import { MapScene } from "./scenes/map";
import { RelayScene } from "./scenes/relay";
import { TeaserScene } from "./scenes/teaser";
import {
  BigNumberScene,
  CtaScene,
  DotFieldScene,
  IllustrationScene,
  KineticScene,
  QuoteScene,
} from "./scenes/scenes";
import { type Episode, episodeSchema, manifestSchema } from "./schema";

export type ShortProps = {
  episode: unknown;
  /** wird von calculateMetadata gesetzt */
  timeline?: Timeline;
};

/**
 * Liest das Manifest der Vertonung und berechnet daraus die exakte Videolänge.
 * Fehlt es (TTS noch nicht gelaufen) oder ist es veraltet, wird geschätzt – Studio bleibt benutzbar.
 */
export const calculateShortMetadata: CalculateMetadataFunction<ShortProps> = async ({ props, abortSignal }) => {
  const episode = episodeSchema.parse(props.episode);
  let manifest = null;
  try {
    const res = await fetch(staticFile(`episodes/${episode.id}/manifest.json`), { signal: abortSignal, cache: "no-store" });
    if (res.ok) {
      const parsed = manifestSchema.safeParse(await res.json());
      if (parsed.success && parsed.data.episodeId === episode.id) manifest = parsed.data;
    }
  } catch {
    /* kein Manifest → Schätzung */
  }
  const timeline = buildTimeline(episode, manifest);
  if (timeline.estimated) console.warn(`[${episode.id}] Teile ohne passende Vertonung – Timing geschätzt. npm run tts ausführen.`);
  await fontsReady;
  return { durationInFrames: timeline.totalFrames, fps: FPS, props: { ...props, episode, timeline } };
};

/** Welche Wörter NICHT unten untertitelt werden, weil sie gross im Bild stehen. */
const hiddenWords = (ts: TimelineScene): Set<number> => {
  const s = ts.scene;
  const all = () => new Set(ts.words.map((w) => w.index));
  if (!s.captions) return all();
  switch (s.type) {
    case "quote":
    case "kinetic":
    case "cta":
      return all();
    case "bigNumber":
      return new Set(ts.words.slice(0, s.captionSkipWords).map((w) => w.index));
    case "dotField": {
      const c = s.titleAt ? findCue(ts.words, s.titleAt) : null;
      return new Set(c ? ts.words.slice(c.first).map((w) => w.index) : []);
    }
    case "chat": {
      // Was in einer Blase steht, wird nicht noch einmal untertitelt
      const out = new Set<number>();
      for (const m of s.messages) {
        const c = m.text ? findCue(ts.words, m.text) : null;
        if (c) for (let k = c.first; k <= c.last; k++) out.add(ts.words[k].index);
      }
      return out;
    }
    case "buzzer": {
      // Die Aussage steht gross auf der Leinwand
      const c = findCue(ts.words, s.statement);
      const out = new Set<number>();
      if (c) for (let k = c.first; k <= c.last; k++) out.add(ts.words[k].index);
      return out;
    }
    case "relay": {
      const c = s.line ? findCue(ts.words, s.line) : null;
      const out = new Set<number>();
      if (c) for (let k = c.first; k <= c.last; k++) out.add(ts.words[k].index);
      return out;
    }
    default:
      return new Set();
  }
};

const SceneBody: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  switch (ts.scene.type) {
    case "bigNumber":
      return <BigNumberScene ts={ts} />;
    case "illustration":
      return <IllustrationScene ts={ts} />;
    case "quote":
      return <QuoteScene ts={ts} />;
    case "dotField":
      return <DotFieldScene ts={ts} />;
    case "kinetic":
      return <KineticScene ts={ts} />;
    case "cta":
      return <CtaScene ts={ts} />;
    case "hero":
      return <HeroScene ts={ts} />;
    case "chat":
      return <ChatScene ts={ts} />;
    case "map":
      return <MapScene ts={ts} />;
    case "relay":
      return <RelayScene ts={ts} />;
    case "teaser":
      return <TeaserScene ts={ts} />;
    case "lineup":
      return <LineupScene ts={ts} />;
    case "buzzer":
      return <BuzzerScene ts={ts} />;
    case "blocks":
      return <BlocksScene ts={ts} />;
    case "ledger":
      return <LedgerScene ts={ts} />;
    case "treasure":
      return <TreasureScene ts={ts} />;
    case "journal":
      return <JournalScene ts={ts} />;
    case "jumper":
      return <JumperScene ts={ts} />;
  }
};

/** Der durchgehende Hintergrund des Looks. */
const Backdrop: React.FC<{ look: Episode["look"]; s: number }> = ({ look, s }) => {
  switch (look) {
    case "arcade":
      return <ArcadeBg />;
    case "chat":
      return <ChatBg />;
    case "map":
      return <MapBg />;
    case "track":
      return <TrackBg />;
    case "noir":
      return <NoirBg />;
    case "show":
      return <ShowBg />;
    case "journal":
      return <JournalBg />;
    default:
      return (
        <>
          <Sky s={s} />
          <Particles s={s} />
        </>
      );
  }
};

const SceneShell: React.FC<{ ts: TimelineScene }> = ({ ts }) => {
  const hidden = useMemo(() => hiddenWords(ts), [ts]);
  return (
    <AbsoluteFill>
      <SceneBody ts={ts} />
      <RefLabel text={ts.scene.type === "quote" || ts.scene.type === "dotField" ? undefined : ts.scene.ref} />
      <Captions words={ts.words} hidden={hidden} audioOffsetFrames={ts.audioOffsetFrames} />
      {ts.audioSrc ? (
        <Sequence from={ts.audioOffsetFrames} layout="none">
          <Audio src={staticFile(ts.audioSrc)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

/** Himmelswert für den globalen Frame: innerhalb einer Szene weich zum Wert der nächsten. */
const skyFor = (frame: number, timeline: Timeline) => {
  const sc = timeline.scenes;
  let i = sc.findIndex((s) => frame >= s.from && frame < s.from + s.durationInFrames);
  if (i < 0) i = sc.length - 1;
  const cur = sc[i];
  const next = sc[i + 1] ?? cur;
  const p = (frame - cur.from) / cur.durationInFrames;
  const e = p * p * (3 - 2 * p);
  return cur.scene.sky + (next.scene.sky - cur.scene.sky) * e;
};

/** Musik leiser, während gesprochen wird (Ducking mit weichen Rampen). */
const musicVolume = (f: number, ep: Episode, timeline: Timeline) => {
  if (!ep.music) return 0;
  const ramp = 8;
  let duck = 0;
  for (const [a, b] of timeline.speech) {
    const d = f < a ? (a - f) / ramp : f > b ? (f - b) / ramp : 0;
    duck = Math.max(duck, 1 - Math.min(1, d));
  }
  const v = ep.music.volume + (ep.music.duckTo - ep.music.volume) * duck;
  const fadeIn = interpolate(f, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [timeline.totalFrames - 50, timeline.totalFrames - 1], [1, 0], { extrapolateLeft: "clamp" });
  return v * fadeIn * fadeOut;
};

export const Short: React.FC<ShortProps> = ({ episode: raw, timeline }) => {
  const frame = useCurrentFrame();
  const episode = useMemo(() => episodeSchema.parse(raw), [raw]);
  if (!timeline) return null;
  const s = skyFor(frame, timeline);

  return (
    <LookProvider look={episode.look}>
    <AbsoluteFill style={{ backgroundColor: "#05071A" }}>
      <Backdrop look={episode.look} s={s} />
      <TransitionSeries>
        {timeline.scenes.flatMap((ts, i) => {
          const items = [
            <TransitionSeries.Sequence key={ts.scene.id} durationInFrames={ts.durationInFrames}>
              <SceneShell ts={ts} />
            </TransitionSeries.Sequence>,
          ];
          if (i < timeline.scenes.length - 1) {
            items.push(
              <TransitionSeries.Transition
                key={`${ts.scene.id}-t`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          }
          return items;
        })}
      </TransitionSeries>
      <BrandBar name={episode.brand.name} label={episode.brand.label} />
      <Grain />
      {episode.music ? (
        <Audio src={staticFile(episode.music.src)} volume={(f) => musicVolume(f, episode, timeline)} loop />
      ) : null}
    </AbsoluteFill>
    </LookProvider>
  );
};
