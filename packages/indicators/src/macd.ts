import { ema, round } from "./math.js";
import type { MacdCrossover } from "./types.js";

export interface MacdResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
  crossover: MacdCrossover;
}

export function computeMacd(closes: number[]): MacdResult {
  if (closes.length < 26) {
    return { macd: null, signal: null, histogram: null, crossover: "none" };
  }
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const e12 = ema12[i];
    const e26 = ema26[i];
    macdLine.push(e12 !== null && e26 !== null ? (e12 as number) - (e26 as number) : null);
  }

  const validMacd: number[] = macdLine.filter((x): x is number => x !== null);
  if (validMacd.length < 9) {
    return { macd: null, signal: null, histogram: null, crossover: "none" };
  }

  const signalArr = ema(validMacd, 9);
  const sLen = signalArr.length;
  const last = validMacd[validMacd.length - 1] as number;
  const prevMacd = validMacd[validMacd.length - 2];

  if (sLen < 2 || signalArr[sLen - 1] === null || signalArr[sLen - 2] === null) {
    return { macd: round(last, 4), signal: null, histogram: null, crossover: "none" };
  }

  const sigCurr = signalArr[sLen - 1] as number;
  const sigPrev = signalArr[sLen - 2] as number;
  const histCurr = last - sigCurr;
  const histPrev = (prevMacd ?? last) - sigPrev;

  let crossover: MacdCrossover = "none";
  if (histPrev < 0 && histCurr >= 0) crossover = "bullish";
  else if (histPrev > 0 && histCurr <= 0) crossover = "bearish";

  return {
    macd: round(last, 4),
    signal: round(sigCurr, 4),
    histogram: round(histCurr, 4),
    crossover,
  };
}
