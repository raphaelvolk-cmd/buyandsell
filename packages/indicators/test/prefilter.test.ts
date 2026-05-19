import { describe, expect, it } from "vitest";
import { shouldEvaluate } from "../src/prefilter.js";
import type { Scores, TechnicalIndicators } from "../src/types.js";

const neutralTech: TechnicalIndicators = {
  rsi: 50,
  macd: 0,
  macd_signal: 0,
  macd_histogram: 0,
  macd_crossover: "none",
  bb_middle: 100,
  bb_upper: 110,
  bb_lower: 90,
  bb_position: 0.5,
  sma50: 100,
  sma200: 100,
  ma_cross: "golden_cross",
  atr: 2,
  atr_pct: 2,
  volume_ratio: 1.0,
  sparkline: [],
  pivots: null,
  fibonacci: null,
  stop_loss: 95,
};

const neutralScores: Scores = {
  technical: 2.5,
  technical_details: {},
  fundamental: 3,
  fundamental_details: {},
  sentiment: 3,
  total: 2.8,
  signal: "HOLD",
};

describe("shouldEvaluate", () => {
  it("portfolio holdings always pass with reason portfolio_holding", () => {
    const r = shouldEvaluate({ tech: neutralTech, scores: neutralScores, inPortfolio: true });
    expect(r.passes).toBe(true);
    expect(r.reasons).toContain("portfolio_holding");
  });

  it("neutral non-portfolio tickers are filtered out", () => {
    const r = shouldEvaluate({ tech: neutralTech, scores: neutralScores, inPortfolio: false });
    expect(r.passes).toBe(false);
  });

  it("oversold RSI passes", () => {
    const r = shouldEvaluate({
      tech: { ...neutralTech, rsi: 30 },
      scores: neutralScores,
      inPortfolio: false,
    });
    expect(r.passes).toBe(true);
    expect(r.reasons.some((s) => s.startsWith("rsi<35"))).toBe(true);
  });

  it("bullish MACD crossover passes", () => {
    const r = shouldEvaluate({
      tech: { ...neutralTech, macd_crossover: "bullish" },
      scores: neutralScores,
      inPortfolio: false,
    });
    expect(r.passes).toBe(true);
    expect(r.reasons).toContain("macd_bullish_crossover");
  });
});
