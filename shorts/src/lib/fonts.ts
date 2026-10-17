import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * Schriften liegen lokal in /public/fonts (SIL OFL). Kein Netz beim Rendern nötig –
 * wichtig für Renders auf dem NAS oder hinter einer Firewall.
 * loadFont blockiert den Render, bis die Schrift geladen ist (kein Fallback-Font im Video).
 */
const fonts: Array<{ family: string; file: string; weight: string; style?: "normal" | "italic" }> = [
  { family: "Anton", file: "anton-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "inter-latin-500-normal.woff2", weight: "500" },
  { family: "Inter", file: "inter-latin-700-normal.woff2", weight: "700" },
  { family: "Inter", file: "inter-latin-800-normal.woff2", weight: "800" },
  { family: "Cormorant Garamond", file: "cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
  { family: "Cormorant Garamond", file: "cormorant-garamond-latin-600-italic.woff2", weight: "600", style: "italic" },
];

export const fontsReady = Promise.all(
  fonts.map((f) =>
    loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, style: f.style ?? "normal" }),
  ),
);
