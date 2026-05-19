import { round } from "./math.js";
import type {
  Fundamentals,
  FundamentalScoreDetails,
  RuleSignal,
  Scores,
  SignalLabel,
  TechnicalIndicators,
  TechnicalScoreDetails,
} from "./types.js";

export function scoreTechnical(
  tech: TechnicalIndicators,
): { score: number; details: TechnicalScoreDetails } {
  const scores: TechnicalScoreDetails = {};

  if (tech.rsi !== null) {
    if (tech.rsi < 25) scores.rsi = 5;
    else if (tech.rsi < 35) scores.rsi = 4;
    else if (tech.rsi < 55) scores.rsi = 3;
    else if (tech.rsi < 70) scores.rsi = 2;
    else scores.rsi = 1;
  }

  const hist = tech.macd_histogram ?? 0;
  if (tech.macd_crossover === "bullish") scores.macd = 5;
  else if (tech.macd_crossover === "bearish") scores.macd = 1;
  else if (hist > 0) scores.macd = 4;
  else if (hist < 0) scores.macd = 2;
  else scores.macd = 3;

  if (tech.bb_position !== null) {
    if (tech.bb_position < 0.1) scores.bollinger = 5;
    else if (tech.bb_position < 0.3) scores.bollinger = 4;
    else if (tech.bb_position < 0.7) scores.bollinger = 3;
    else if (tech.bb_position < 0.9) scores.bollinger = 2;
    else scores.bollinger = 1;
  }

  if (tech.ma_cross === "golden_cross") scores.ma_cross = 5;
  else if (tech.ma_cross === "death_cross") scores.ma_cross = 1;
  else scores.ma_cross = 3;

  if (tech.volume_ratio !== null) {
    if (tech.volume_ratio > 2.0) scores.volume = 4;
    else if (tech.volume_ratio > 1.2) scores.volume = 4;
    else if (tech.volume_ratio > 0.8) scores.volume = 3;
    else scores.volume = 2;
  }

  const values = Object.values(scores);
  const score =
    values.length === 0
      ? 3.0
      : round(values.reduce((a, b) => a + b, 0) / values.length, 2);
  return { score, details: scores };
}

export function scoreFundamental(
  fund: Fundamentals | undefined,
  currentPrice?: number,
): { score: number; details: FundamentalScoreDetails } {
  const scores: FundamentalScoreDetails = {};
  if (!fund) return { score: 3.0, details: scores };

  const pe = fund.pe_forward ?? fund.pe_trailing;
  if (pe !== undefined && pe > 0) {
    if (pe < 12) scores.pe = 5;
    else if (pe < 18) scores.pe = 4;
    else if (pe < 25) scores.pe = 3;
    else if (pe < 40) scores.pe = 2;
    else scores.pe = 1;
  }

  const rg = fund.revenue_growth;
  if (rg !== undefined) {
    if (rg > 0.3) scores.revenue_growth = 5;
    else if (rg > 0.15) scores.revenue_growth = 4;
    else if (rg > 0.05) scores.revenue_growth = 3;
    else if (rg > 0) scores.revenue_growth = 2;
    else scores.revenue_growth = 1;
  }

  const de = fund.debt_to_equity;
  if (de !== undefined && de >= 0) {
    if (de < 30) scores.debt = 5;
    else if (de < 60) scores.debt = 4;
    else if (de < 100) scores.debt = 3;
    else if (de < 200) scores.debt = 2;
    else scores.debt = 1;
  }

  const pm = fund.profit_margins;
  if (pm !== undefined) {
    if (pm > 0.25) scores.margins = 5;
    else if (pm > 0.15) scores.margins = 4;
    else if (pm > 0.05) scores.margins = 3;
    else if (pm > 0) scores.margins = 2;
    else scores.margins = 1;
  }

  const w52h = fund.fifty_two_week_high;
  const w52l = fund.fifty_two_week_low;
  const cp = currentPrice ?? fund.current_price;
  if (w52h !== undefined && w52l !== undefined && cp !== undefined && w52h - w52l > 0) {
    const pos = (cp - w52l) / (w52h - w52l);
    if (pos < 0.2) scores.week52 = 5;
    else if (pos < 0.4) scores.week52 = 4;
    else if (pos < 0.6) scores.week52 = 3;
    else if (pos < 0.8) scores.week52 = 2;
    else scores.week52 = 1;
    fund.week52_position = round(pos, 2);
  }

  const values = Object.values(scores);
  const score =
    values.length === 0
      ? 3.0
      : round(values.reduce((a, b) => a + b, 0) / values.length, 2);
  return { score, details: scores };
}

export function scoreSentiment(fgValue: number | null | undefined): number {
  if (fgValue === null || fgValue === undefined) return 3.0;
  if (fgValue <= 20) return 5.0;
  if (fgValue <= 35) return 4.0;
  if (fgValue <= 55) return 3.0;
  if (fgValue <= 75) return 2.0;
  return 1.0;
}

export function getSignalLabel(score: number): SignalLabel {
  if (score >= 4.0) return "STRONG BUY";
  if (score >= 3.5) return "BUY";
  if (score >= 2.5) return "HOLD";
  if (score >= 2.0) return "SELL";
  return "STRONG SELL";
}

export function combineScores(
  technical: number,
  fundamental: number,
  sentiment: number,
  sentimentWeight = 0.1,
): { total: number; signal: SignalLabel } {
  const remaining = 1.0 - sentimentWeight;
  const tw = remaining / 2;
  const fw = remaining / 2;
  const total = round(technical * tw + fundamental * fw + sentiment * sentimentWeight, 2);
  return { total, signal: getSignalLabel(total) };
}

export function buildScores(
  tech: TechnicalIndicators,
  fund: Fundamentals | undefined,
  fearGreedValue: number | null | undefined,
  currentPrice: number,
  sentimentWeight = 0.1,
): Scores {
  const t = scoreTechnical(tech);
  const f = scoreFundamental(fund, currentPrice);
  const s = scoreSentiment(fearGreedValue);
  const c = combineScores(t.score, f.score, s, sentimentWeight);
  return {
    technical: t.score,
    technical_details: t.details,
    fundamental: f.score,
    fundamental_details: f.details,
    sentiment: s,
    total: c.total,
    signal: c.signal,
  };
}

export function computeRuleSignals(tech: TechnicalIndicators): RuleSignal[] {
  const signals: RuleSignal[] = [];

  let buyCond = 0;
  const buyReasons: string[] = [];
  if (tech.rsi !== null && tech.rsi < 35) {
    buyCond++;
    buyReasons.push(`RSI ueberverkauft (${tech.rsi})`);
  }
  if (tech.bb_position !== null && tech.bb_position < 0.2) {
    buyCond++;
    buyReasons.push("Kurs nahe unterem Bollinger Band");
  }
  if (tech.macd_crossover === "bullish") {
    buyCond++;
    buyReasons.push("MACD Bullish Crossover");
  }
  if (buyCond >= 2) {
    signals.push({
      type: "BUY",
      strength: buyCond === 3 ? "STRONG" : "MODERATE",
      reasons: buyReasons,
    });
  }

  let sellCond = 0;
  const sellReasons: string[] = [];
  if (tech.rsi !== null && tech.rsi > 65) {
    sellCond++;
    sellReasons.push(`RSI ueberkauft (${tech.rsi})`);
  }
  if (tech.bb_position !== null && tech.bb_position > 0.8) {
    sellCond++;
    sellReasons.push("Kurs nahe oberem Bollinger Band");
  }
  if (tech.macd_crossover === "bearish") {
    sellCond++;
    sellReasons.push("MACD Bearish Crossover");
  }
  if (sellCond >= 2) {
    signals.push({
      type: "SELL",
      strength: sellCond === 3 ? "STRONG" : "MODERATE",
      reasons: sellReasons,
    });
  }

  return signals;
}
