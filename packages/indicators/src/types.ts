export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Fundamentals {
  pe_trailing?: number;
  pe_forward?: number;
  ps_ratio?: number;
  revenue_growth?: number;
  earnings_growth?: number;
  debt_to_equity?: number;
  dividend_yield?: number;
  profit_margins?: number;
  market_cap?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  beta?: number;
  return_on_equity?: number;
  current_price?: number;
  week52_position?: number;
}

export type MacdCrossover = "bullish" | "bearish" | "none";
export type MaCross = "golden_cross" | "death_cross" | "insufficient_data";
export type SignalLabel =
  | "STRONG BUY"
  | "BUY"
  | "HOLD"
  | "SELL"
  | "STRONG SELL";

export interface Pivots {
  pivot: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
}

export interface FibLevels {
  swing_high: number;
  swing_low: number;
  level_236: number;
  level_382: number;
  level_500: number;
  level_618: number;
  level_786: number;
  next_support: number | null;
  next_resistance: number | null;
}

export interface TechnicalIndicators {
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  macd_crossover: MacdCrossover;
  bb_middle: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  bb_position: number | null;
  sma50: number | null;
  sma200: number | null;
  ma_cross: MaCross;
  atr: number | null;
  atr_pct: number | null;
  volume_ratio: number | null;
  sparkline: number[];
  pivots: Pivots | null;
  fibonacci: FibLevels | null;
  stop_loss: number | null;
  error?: string;
}

export interface TechnicalScoreDetails {
  rsi?: number;
  macd?: number;
  bollinger?: number;
  ma_cross?: number;
  volume?: number;
}

export interface FundamentalScoreDetails {
  pe?: number;
  revenue_growth?: number;
  debt?: number;
  margins?: number;
  week52?: number;
}

export interface Scores {
  technical: number;
  technical_details: TechnicalScoreDetails;
  fundamental: number;
  fundamental_details: FundamentalScoreDetails;
  sentiment: number;
  total: number;
  signal: SignalLabel;
}

export interface RuleSignal {
  type: "BUY" | "SELL";
  strength: "STRONG" | "MODERATE";
  reasons: string[];
}
