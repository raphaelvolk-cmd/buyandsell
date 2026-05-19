import { describe, expect, it } from "vitest";
import { ema, sma, stdev } from "../src/math.js";

describe("sma", () => {
  it("fills nulls until window is full", () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBe(null);
    expect(out[1]).toBe(null);
    expect(out[2]).toBe(2);
    expect(out[3]).toBe(3);
    expect(out[4]).toBe(4);
  });
});

describe("ema", () => {
  it("returns all nulls when data is shorter than period", () => {
    expect(ema([1, 2], 5)).toEqual([null, null]);
  });

  it("seeds with SMA and then applies EMA recursion", () => {
    const out = ema([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    expect(out[0]).toBe(null);
    expect(out[1]).toBe(null);
    expect(out[2]).toBe(2); // (1+2+3)/3
    // EMA k = 2/(3+1) = 0.5; next: 4*0.5 + 2*0.5 = 3
    expect(out[3]).toBeCloseTo(3, 6);
    expect(out[4]).toBeCloseTo(4, 6);
  });
});

describe("stdev", () => {
  it("matches population std (matches analyze.py)", () => {
    const out = stdev([2, 4, 4, 4, 5, 5, 7, 9], 8);
    expect(out[7]).toBeCloseTo(2, 6);
  });
});
