import { round } from "./math.js";

export function computeAtr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number | null {
  if (closes.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i] as number;
    const l = lows[i] as number;
    const prevClose = closes[i - 1] as number;
    const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
    trs.push(tr);
  }
  if (trs.length < period) return null;
  const slice = trs.slice(-period);
  const atr = slice.reduce((a, b) => a + b, 0) / period;
  return round(atr, 2);
}
