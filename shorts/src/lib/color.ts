import { SKY_STOPS } from "../theme";

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const mix = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

export const skyAt = (s: number) => {
  const v = Math.max(0, Math.min(1, s));
  let i = 0;
  while (i < SKY_STOPS.length - 2 && v > SKY_STOPS[i + 1].at) i++;
  const a = SKY_STOPS[i];
  const b = SKY_STOPS[i + 1];
  const t = (v - a.at) / (b.at - a.at);
  return { top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), horizon: mix(a.horizon, b.horizon, t) };
};
