import { describe, expect, it } from "vitest";
import {
  combineScores,
  getSignalLabel,
  scoreFundamental,
  scoreSentiment,
  scoreTechnical,
} from "../src/scoring.js";
import type { TechnicalIndicators } from "../src/types.js";

const baseTech: TechnicalIndicators = {
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

describe("scoreTechnical", () => {
  it("scores oversold RSI + bullish MACD + low BB as bullish", () => {
    const tech: TechnicalIndicators = {
      ...baseTech,
      rsi: 28,
      macd_crossover: "bullish",
      bb_position: 0.08,
      ma_cross: "golden_cross",
      volume_ratio: 2.5,
    };
    const r = scoreTechnical(tech);
    expect(r.details.rsi).toBe(4);
    expect(r.details.macd).toBe(5);
    expect(r.details.bollinger).toBe(5);
    expect(r.details.ma_cross).toBe(5);
    expect(r.details.volume).toBe(4);
    expect(r.score).toBeCloseTo(4.6, 2);
  });

  it("returns neutral 3.0 when only default-scored indicators are present", () => {
    // baseTech has no rsi/bb/volume → macd defaults to 3 (hist=0), ma_cross defaults to 3 → avg 3
    const r = scoreTechnical(baseTech);
    expect(r.score).toBe(3.0);
  });
});

describe("scoreSentiment", () => {
  it("maps Fear&Greed buckets correctly", () => {
    expect(scoreSentiment(15)).toBe(5);
    expect(scoreSentiment(30)).toBe(4);
    expect(scoreSentiment(50)).toBe(3);
    expect(scoreSentiment(70)).toBe(2);
    expect(scoreSentiment(85)).toBe(1);
    expect(scoreSentiment(null)).toBe(3);
  });
});

describe("getSignalLabel", () => {
  it("buckets total score to labels", () => {
    expect(getSignalLabel(4.5)).toBe("STRONG BUY");
    expect(getSignalLabel(3.7)).toBe("BUY");
    expect(getSignalLabel(3.0)).toBe("HOLD");
    expect(getSignalLabel(2.2)).toBe("SELL");
    expect(getSignalLabel(1.5)).toBe("STRONG SELL");
  });
});

describe("combineScores", () => {
  it("applies default 10% sentiment weight", () => {
    // 0.45 tech + 0.45 fund + 0.10 sentiment
    const r = combineScores(4.0, 4.0, 5.0, 0.1);
    expect(r.total).toBeCloseTo(0.45 * 4 + 0.45 * 4 + 0.1 * 5, 2);
    expect(r.signal).toBe("STRONG BUY");
  });
});

describe("scoreFundamental", () => {
  it("scores low PE + high growth + low debt as bullish", () => {
    const r = scoreFundamental({
      pe_forward: 10,
      revenue_growth: 0.35,
      debt_to_equity: 20,
      profit_margins: 0.30,
    });
    expect(r.details.pe).toBe(5);
    expect(r.details.revenue_growth).toBe(5);
    expect(r.details.debt).toBe(5);
    expect(r.details.margins).toBe(5);
    expect(r.score).toBe(5);
  });

  it("computes week52_position when bounds + current price are present", () => {
    const fund = {
      fifty_two_week_high: 200,
      fifty_two_week_low: 100,
    };
    scoreFundamental(fund, 110);
    expect(fund).toHaveProperty("week52_position", 0.1);
  });
});
