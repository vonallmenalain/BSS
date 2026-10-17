/**
 * Rendert eine Episode als MP4 (oder Standbilder zur Kontrolle).
 *
 *   npm run render -- 2026-10-25-treu-zu-allen-zeiten
 *   npm run render -- 2026-10-25-treu-zu-allen-zeiten --scale 0.5     (schnelle Vorschau, 540×960)
 *   npm run still  -- 2026-10-25-treu-zu-allen-zeiten --frames 30,400,900
 *
 * Umgebungsvariablen: REMOTION_BROWSER_EXECUTABLE (eigener Chromium), RENDER_CONCURRENCY.
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadDotEnv } from "./lib/env";

const ROOT = path.resolve(import.meta.dirname, "..");
loadDotEnv(ROOT);
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const still = args.includes("--still");
const scale = Number(flag("scale") ?? "1");

if (!id) {
  console.error("Episode-ID fehlt, z.B. npm run render -- 2026-10-25-treu-zu-allen-zeiten");
  process.exit(1);
}

const main = async () => {
  const t0 = Date.now();
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts"), publicDir: path.join(ROOT, "public") });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const composition = await selectComposition({ serveUrl, id, inputProps: {}, browserExecutable });
  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`▶ ${id}: ${composition.durationInFrames} Frames (${(composition.durationInFrames / composition.fps).toFixed(1)} s)`);

  if (still) {
    const frames = (flag("frames") ?? "30").split(",").map(Number);
    for (const frame of frames) {
      const output = path.join(outDir, `${id}-f${frame}.png`);
      await renderStill({ serveUrl, composition, frame, output, browserExecutable, scale, inputProps: composition.props });
      console.log(`  ✓ ${path.relative(ROOT, output)}`);
    }
    return;
  }

  const output = path.join(outDir, `${id}${scale !== 1 ? `-x${scale}` : ""}.mp4`);
  const concurrency = Number(process.env.RENDER_CONCURRENCY) || Math.max(1, Math.min(8, os.cpus().length));
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: 18,
    pixelFormat: "yuv420p",
    audioBitrate: "192k",
    imageFormat: "jpeg",
    jpegQuality: 92,
    scale,
    concurrency,
    browserExecutable,
    outputLocation: output,
    inputProps: composition.props,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) {
        last = p;
        process.stdout.write(`\r  ${"█".repeat(p)}${"░".repeat(20 - p)} ${Math.round(progress * 100)}%`);
      }
    },
  });
  console.log(`\n■ ${path.relative(ROOT, output)} in ${((Date.now() - t0) / 1000).toFixed(0)} s (Concurrency ${concurrency})`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
