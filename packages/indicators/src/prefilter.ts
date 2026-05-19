import type { Scores, TechnicalIndicators } from "./types.js";

export interface PrefilterInput {
  tech: TechnicalIndicators;
  scores: Scores;
  inPortfolio: boolean;
}

export interface PrefilterDecision {
  passes: boolean;
  reasons: string[];
}

/**
 * Rule-based prefilter to decide whether a ticker is worth sending to Claude.
 * Portfolio tickers always pass — we need hold/sell/add advice for them.
 */
export function shouldEvaluate(input: PrefilterInput): PrefilterDecision {
  const reasons: string[] = [];
  const { tech, scores, inPortfolio } = input;

  if (inPortfolio) {
    reasons.push("portfolio_holding");
    return { passes: true, reasons };
  }

  if (scores.technical >= 3.0) reasons.push(`tech_score>=3 (${scores.technical})`);
  if (tech.rsi !== null && tech.rsi < 35) reasons.push(`rsi<35 (${tech.rsi})`);
  if (tech.rsi !== null && tech.rsi > 65) reasons.push(`rsi>65 (${tech.rsi})`);
  if (tech.macd_crossover === "bullish") reasons.push("macd_bullish_crossover");
  if (tech.macd_crossover === "bearish") reasons.push("macd_bearish_crossover");
  if (tech.bb_position !== null && tech.bb_position < 0.2)
    reasons.push(`bb_low (${tech.bb_position})`);
  if (tech.bb_position !== null && tech.bb_position > 0.8)
    reasons.push(`bb_high (${tech.bb_position})`);
  if (tech.volume_ratio !== null && tech.volume_ratio > 2.0)
    reasons.push(`volume_spike (${tech.volume_ratio})`);

  return { passes: reasons.length > 0, reasons };
}
