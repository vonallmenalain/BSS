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
  /* Pixel-Schrift für den Game-Look, Handschrift für Notizen auf der Karte */
  { family: "Press Start 2P", file: "press-start-2p-latin-400-normal.woff2", weight: "400" },
  { family: "Caveat", file: "caveat-latin-700-normal.woff2", weight: "700" },
  /* Schreibmaschine für Akten, Monospace fürs Raumfahrt-HUD, römische Kapitalen für Palast und Stein */
  { family: "Courier Prime", file: "courier-prime-latin-400-normal.woff2", weight: "400" },
  { family: "Courier Prime", file: "courier-prime-latin-700-normal.woff2", weight: "700" },
  { family: "Space Mono", file: "space-mono-latin-400-normal.woff2", weight: "400" },
  { family: "Space Mono", file: "space-mono-latin-700-normal.woff2", weight: "700" },
  { family: "Cinzel", file: "cinzel-latin-400-normal.woff2", weight: "400" },
  { family: "Cinzel", file: "cinzel-latin-700-normal.woff2", weight: "700" },
];

export const fontsReady = Promise.all(
  fonts.map((f) =>
    loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, style: f.style ?? "normal" }),
  ),
);
