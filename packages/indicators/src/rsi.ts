import { round } from "./math.js";

export function computeRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const deltas: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    deltas.push((closes[i] as number) - (closes[i - 1] as number));
  }
  const gains = deltas.map((d) => Math.max(d, 0));
  const losses = deltas.map((d) => Math.max(-d, 0));

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + (gains[i] as number)) / period;
    avgLoss = (avgLoss * (period - 1) + (losses[i] as number)) / period;
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  return round(100 - 100 / (1 + rs), 2);
}
