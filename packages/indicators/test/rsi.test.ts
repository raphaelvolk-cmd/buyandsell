import { describe, expect, it } from "vitest";
import { computeRsi } from "../src/rsi.js";

describe("computeRsi", () => {
  it("returns null when input shorter than period + 1", () => {
    expect(computeRsi([1, 2, 3, 4, 5], 14)).toBe(null);
  });

  it("returns 100 when there are no losses", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(computeRsi(closes, 14)).toBe(100);
  });

  it("matches the classic Wilder reference sequence", () => {
    // Reference RSI(14) test sequence — same exact algorithm as analyze.py
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64,
      46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57,
      43.42, 42.66, 43.13,
    ];
    const value = computeRsi(closes, 14);
    expect(value).not.toBeNull();
    // Wilder reference for this dataset is ~37.77 (analyze.py rounds to 2 dp)
    expect(value as number).toBeGreaterThan(37);
    expect(value as number).toBeLessThan(38);
  });
});
