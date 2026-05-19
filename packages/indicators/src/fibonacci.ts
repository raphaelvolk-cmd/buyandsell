import { round } from "./math.js";
import type { FibLevels } from "./types.js";

export function computeFibonacci(
  highs: number[],
  lows: number[],
  closes: number[],
  lookback = 60,
): FibLevels | null {
  if (closes.length < lookback) return null;
  const hSlice = highs.slice(-lookback);
  const lSlice = lows.slice(-lookback);
  const swingHigh = Math.max(...hSlice);
  const swingLow = Math.min(...lSlice);
  const range = swingHigh - swingLow;
  if (range <= 0) return null;

  const level236 = round(swingHigh - range * 0.236, 2);
  const level382 = round(swingHigh - range * 0.382, 2);
  const level500 = round(swingHigh - range * 0.5, 2);
  const level618 = round(swingHigh - range * 0.618, 2);
  const level786 = round(swingHigh - range * 0.786, 2);

  const current = closes[closes.length - 1] as number;
  const allLevels = [
    round(swingLow, 2),
    level786,
    level618,
    level500,
    level382,
    level236,
    round(swingHigh, 2),
  ].sort((a, b) => a - b);

  let nextSupport: number | null = null;
  let nextResistance: number | null = null;
  for (const lvl of allLevels) {
    if (lvl < current) nextSupport = lvl;
    if (lvl > current && nextResistance === null) nextResistance = lvl;
  }

  return {
    swing_high: round(swingHigh, 2),
    swing_low: round(swingLow, 2),
    level_236: level236,
    level_382: level382,
    level_500: level500,
    level_618: level618,
    level_786: level786,
    next_support: nextSupport,
    next_resistance: nextResistance,
  };
}

export function computeStopLoss(
  currentPrice: number,
  atr: number | null,
  fib: FibLevels | null,
  atrMultiplier = 2,
): number | null {
  const candidates: number[] = [];
  if (atr !== null) candidates.push(round(currentPrice - atrMultiplier * atr, 2));
  if (fib?.next_support !== null && fib?.next_support !== undefined) {
    const fibBuffer = atr !== null ? 0.5 * atr : 0;
    candidates.push(round(fib.next_support - fibBuffer, 2));
  }
  candidates.push(round(currentPrice * 0.95, 2));
  if (candidates.length === 0) return null;
  // Conservative = lowest (most distance below entry)
  return Math.min(...candidates);
}
