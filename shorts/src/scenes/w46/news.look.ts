import { theme } from "../../theme";
import type { Look } from "../../looks";

/** Nachrichtensender: drei Städte, drei Arten, eine Botschaft aufzunehmen (Apostelgeschichte 17) */
export const look: Look = {
  id: "news",
  accent: "#FF3B3B",
  accent2: "#3FA9FF",
  text: "#FFFFFF",
  dim: "rgba(255,255,255,0.62)",
  display: theme.font.display,
  label: theme.font.body,
  glow: "0 0 22px rgba(255,59,59,0.3), 0 10px 40px rgba(0,0,0,0.6)",
};
