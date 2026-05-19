import { sma, stdev, round } from "./math.js";

export interface BollingerResult {
  middle: number | null;
  upper: number | null;
  lower: number | null;
  position: number | null;
}

export function computeBollinger(
  closes: number[],
  period = 20,
  numStd = 2,
): BollingerResult {
  if (closes.length < period) {
    return { middle: null, upper: null, lower: null, position: null };
  }
  const m = sma(closes, period);
  const s = stdev(closes, period);
  const mid = m[m.length - 1] ?? null;
  const sd = s[s.length - 1] ?? null;
  if (mid === null || sd === null) {
    return { middle: null, upper: null, lower: null, position: null };
  }
  const upper = round(mid + numStd * sd, 2);
  const lower = round(mid - numStd * sd, 2);
  const bbRange = upper - lower;
  const lastClose = closes[closes.length - 1] ?? 0;
  const position = bbRange > 0 ? round((lastClose - lower) / bbRange, 2) : 0.5;
  return {
    middle: round(mid, 2),
    upper,
    lower,
    position,
  };
}
