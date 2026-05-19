// Live integration tests against the public Yahoo Finance + CNN Fear & Greed endpoints.
// Skipped automatically when RUN_LIVE is not set, so CI stays deterministic.
import { describe, it, expect } from "vitest";
import { fetchYahooFull } from "../src/yahoo.js";
import { fetchFearGreed } from "../src/cnn-fear-greed.js";
import { computeTechnical, buildScores, shouldEvaluate } from "@bst/indicators";

const RUN_LIVE = process.env.RUN_LIVE === "1";
const maybe = RUN_LIVE ? it : it.skip;

describe("live datasource smoke", () => {
  maybe("fetches CNN Fear & Greed", async () => {
    const fg = await fetchFearGreed();
    expect(fg.ok).toBe(true);
    expect(fg.data?.value).toBeGreaterThanOrEqual(0);
    expect(fg.data?.value).toBeLessThanOrEqual(100);
    console.log(`CNN F&G: ${fg.data?.value} (${fg.data?.label})`);
  });

  maybe("fetches AAPL Yahoo OHLCV + fundamentals and computes indicators", async () => {
    const quote = await fetchYahooFull("AAPL", { range: "6mo" });
    expect(quote.ok).toBe(true);
    expect(quote.data?.history.length ?? 0).toBeGreaterThan(50);
    const d = quote.data!;
    console.log(`Yahoo AAPL: ${d.current_price} ${d.currency} (${d.history.length} bars)`);

    const tech = computeTechnical(d.history);
    expect(tech.error).toBeUndefined();
    expect(tech.rsi).not.toBeNull();
    console.log(`Indicators: RSI=${tech.rsi} MACD-cross=${tech.macd_crossover} BB-pos=${tech.bb_position}`);

    const scores = buildScores(tech, d.fundamentals, 50, d.current_price, 0.1);
    console.log(`Scores: tech=${scores.technical} fund=${scores.fundamental} total=${scores.total} → ${scores.signal}`);

    const pref = shouldEvaluate({ tech, scores, inPortfolio: false });
    console.log(`Prefilter: pass=${pref.passes} reasons=[${pref.reasons.join(", ")}]`);
  });
});
