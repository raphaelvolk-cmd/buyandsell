// Smoke test: live-fetch Yahoo OHLCV + CNN Fear & Greed for a single ticker.
// Run with: node --experimental-strip-types scripts/smoke-datasources.ts
import { fetchYahooFull } from "../packages/datasources/src/yahoo.ts";
import { fetchFearGreed } from "../packages/datasources/src/cnn-fear-greed.ts";
import { computeTechnical } from "../packages/indicators/src/technical.ts";
import { buildScores, shouldEvaluate } from "../packages/indicators/src/index.ts";

const symbol = process.argv[2] ?? "AAPL";

async function main() {
  console.log(`Smoke test for ${symbol} …`);

  const fg = await fetchFearGreed();
  if (fg.ok && fg.data) {
    console.log(`CNN Fear & Greed: ${fg.data.value} (${fg.data.label})`);
  } else {
    console.log(`CNN Fear & Greed FAILED: ${fg.error}`);
  }

  const quote = await fetchYahooFull(symbol);
  if (!quote.ok || !quote.data) {
    console.log(`Yahoo fetch FAILED: ${quote.error}`);
    process.exit(1);
  }
  const d = quote.data;
  console.log(`Yahoo ${symbol}: ${d.current_price} ${d.currency} (${d.history.length} bars)`);

  const tech = computeTechnical(d.history);
  if (tech.error) {
    console.log(`Indicators FAILED: ${tech.error}`);
    process.exit(1);
  }
  console.log(
    `Indicators: RSI=${tech.rsi} MACD-cross=${tech.macd_crossover} BB-pos=${tech.bb_position} MA=${tech.ma_cross} ATR=${tech.atr}`,
  );

  const fgValue = fg.ok && fg.data ? fg.data.value : 50;
  const scores = buildScores(tech, d.fundamentals, fgValue, d.current_price, 0.1);
  console.log(
    `Scores: tech=${scores.technical} fund=${scores.fundamental} sent=${scores.sentiment} total=${scores.total} → ${scores.signal}`,
  );

  const pref = shouldEvaluate({ tech, scores, inPortfolio: false });
  console.log(`Prefilter: pass=${pref.passes} reasons=[${pref.reasons.join(", ")}]`);

  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
