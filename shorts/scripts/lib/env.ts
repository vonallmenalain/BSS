import fs from "node:fs";
import path from "node:path";

/** Kleiner .env-Loader ohne Abhängigkeit; bereits gesetzte Umgebungsvariablen haben Vorrang. */
export const loadDotEnv = (root: string) => {
  const p = path.join(root, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || m[2] === "") continue;
    const val = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
};
