import { computeAtr } from "./atr.js";
import { computeBollinger } from "./bollinger.js";
import { computeFibonacci, computeStopLoss } from "./fibonacci.js";
import { computeMacd } from "./macd.js";
import { computeRsi } from "./rsi.js";
import { round, sma } from "./math.js";
import type { MaCross, OHLCV, Pivots, TechnicalIndicators } from "./types.js";

export function computeTechnical(history: OHLCV[]): TechnicalIndicators {
  const empty: TechnicalIndicators = {
    rsi: null,
    macd: null,
    macd_signal: null,
    macd_histogram: null,
    macd_crossover: "none",
    bb_middle: null,
    bb_upper: null,
    bb_lower: null,
    bb_position: null,
    sma50: null,
    sma200: null,
    ma_cross: "insufficient_data",
    atr: null,
    atr_pct: null,
    volume_ratio: null,
    sparkline: [],
    pivots: null,
    fibonacci: null,
    stop_loss: null,
  };

  if (history.length < 20) {
    return { ...empty, error: "insufficient_data" };
  }

  const closes = history.map((h) => h.close);
  const highs = history.map((h) => h.high);
  const lows = history.map((h) => h.low);
  const volumes = history.map((h) => h.volume);
  const lastClose = closes[closes.length - 1] as number;

  const rsi = computeRsi(closes);
  const macd = computeMacd(closes);
  const bb = computeBollinger(closes);

  const sma50Arr = sma(closes, 50);
  const sma200Arr = sma(closes, 200);
  const sma50 = sma50Arr[sma50Arr.length - 1] ?? null;
  const sma200 = sma200Arr[sma200Arr.length - 1] ?? null;
  let maCross: MaCross = "insufficient_data";
  if (sma50 !== null && sma200 !== null) {
    maCross = sma50 > sma200 ? "golden_cross" : "death_cross";
  }

  const atr = computeAtr(highs, lows, closes);
  const atrPct =
    atr !== null && lastClose > 0 ? round((atr / lastClose) * 100, 2) : null;

  const volSma = sma(volumes, 20);
  const volSmaLast = volSma[volSma.length - 1] ?? null;
  const lastVolume = volumes[volumes.length - 1] ?? 0;
  const volumeRatio =
    volSmaLast !== null && volSmaLast > 0
      ? round(lastVolume / volSmaLast, 2)
      : null;

  const sparkline = closes.slice(-30).map((c) => round(c, 2));

  let pivots: Pivots | null = null;
  if (history.length >= 2) {
    const prev = history[history.length - 2] as OHLCV;
    const pp = (prev.high + prev.low + prev.close) / 3;
    pivots = {
      pivot: round(pp, 2),
      r1: round(2 * pp - prev.low, 2),
      r2: round(pp + (prev.high - prev.low), 2),
      s1: round(2 * pp - prev.high, 2),
      s2: round(pp - (prev.high - prev.low), 2),
    };
  }

  const fibonacci =
    history.length >= 60 ? computeFibonacci(highs, lows, closes, 60) : null;
  const stopLoss = computeStopLoss(lastClose, atr, fibonacci);

  return {
    rsi,
    macd: macd.macd,
    macd_signal: macd.signal,
    macd_histogram: macd.histogram,
    macd_crossover: macd.crossover,
    bb_middle: bb.middle,
    bb_upper: bb.upper,
    bb_lower: bb.lower,
    bb_position: bb.position,
    sma50: sma50 !== null ? round(sma50 as number, 2) : null,
    sma200: sma200 !== null ? round(sma200 as number, 2) : null,
    ma_cross: maCross,
    atr,
    atr_pct: atrPct,
    volume_ratio: volumeRatio,
    sparkline,
    pivots,
    fibonacci,
    stop_loss: stopLoss,
  };
}
