import { theme } from "../../theme";
import type { Look } from "../../looks";

/** Farmhaus 1829 bei Kerzenlicht: Oliver Cowdery, ein Gebet in der Nacht, das niemand kennt (LuB 6:22–23) */
export const look: Look = {
  id: "candle",
  accent: "#FFC872",
  accent2: "#8FB8FF",
  text: "#FFF5E6",
  dim: "rgba(255,245,230,0.62)",
  display: theme.font.display,
  label: '"Caveat"',
  glow: "0 0 26px rgba(255,200,114,0.35), 0 10px 40px rgba(0,0,0,0.7)",
};
