import type { Fundamentals, Scores, TechnicalIndicators } from "@bst/indicators";
import type { NewsItem } from "@bst/datasources";

export type Signal =
  | "STRONG_BUY"
  | "BUY"
  | "HOLD"
  | "SELL"
  | "STRONG_SELL";

export type PortfolioAction = "BUY" | "HOLD" | "SELL" | "ADD";

export interface PortfolioContext {
  cost_basis: number;
  shares: number;
  currency: string;
}

export interface EvaluationInput {
  symbol: string;
  name?: string;
  exchange?: string;
  currency: string;
  current_price: number;
  indicators: TechnicalIndicators;
  fundamentals?: Fundamentals;
  scores: Scores;
  fear_greed: { value: number; label: string };
  news?: NewsItem[];
  portfolio?: PortfolioContext;
}

export interface EvaluationOutput {
  signal: Signal;
  conviction: number;
  thesis: string;
  risks: string[];
  catalysts: string[];
  target_price: number;
  stop_loss: number;
  portfolio_action?: PortfolioAction;
}

export interface EvaluationUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface EvaluationResult {
  ok: boolean;
  symbol: string;
  evaluation?: EvaluationOutput;
  usage?: EvaluationUsage;
  error?: string;
  raw?: unknown;
}
