import { describe, expect, it } from "vitest";
import { computeTechnical } from "../src/technical.js";
import type { OHLCV } from "../src/types.js";

function makeHistory(count: number, basePrice = 100, vol = 1_000_000): OHLCV[] {
  const out: OHLCV[] = [];
  let p = basePrice;
  for (let i = 0; i < count; i++) {
    // Deterministic sine-wave-ish pattern to exercise indicators
    const drift = Math.sin(i / 5) * 5 + i * 0.1;
    const close = +(basePrice + drift).toFixed(2);
    const high = +(close + 1.5).toFixed(2);
    const low = +(close - 1.5).toFixed(2);
    out.push({
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      open: p,
      high,
      low,
      close,
      volume: vol + i * 1000,
    });
    p = close;
  }
  return out;
}

describe("computeTechnical", () => {
  it("flags insufficient_data when history < 20", () => {
    const r = computeTechnical(makeHistory(10));
    expect(r.error).toBe("insufficient_data");
  });

  it("produces a full indicator set with 200+ history", () => {
    const r = computeTechnical(makeHistory(220));
    expect(r.rsi).not.toBeNull();
    expect(r.macd).not.toBeNull();
    expect(r.bb_position).not.toBeNull();
    expect(r.sma50).not.toBeNull();
    expect(r.sma200).not.toBeNull();
    expect(r.atr).not.toBeNull();
    expect(r.fibonacci).not.toBeNull();
    expect(r.stop_loss).not.toBeNull();
    expect(r.sparkline.length).toBe(30);
    expect(["golden_cross", "death_cross"]).toContain(r.ma_cross);
  });
});
