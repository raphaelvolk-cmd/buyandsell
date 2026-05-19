export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  secure?: boolean;     // true for 465; false + STARTTLS for 587
  from_address: string;
  from_name?: string;
}

export interface StrongBuyAlert {
  symbol: string;
  name?: string;
  current_price: number;
  currency: string;
  total_score: number;
  conviction: number;
  thesis: string;
  risks: string[];
  catalysts: string[];
  target_price: number;
  stop_loss: number;
  dashboard_link?: string;
}

export interface RecommendationRow {
  symbol: string;
  name?: string;
  current_price: number;
  currency: string;
  action: "BUY" | "STRONG_BUY" | "HOLD" | "SELL" | "ADD";
  context: "watchlist" | "portfolio";
  rationale?: string;
  target_price?: number;
  stop_loss?: number;
  total_score?: number;
}

export interface DailyReportContext {
  date: string;          // YYYY-MM-DD
  fear_greed_value: number;
  fear_greed_label: string;
  run_count: number;
  rows_watchlist: RecommendationRow[];
  rows_portfolio: RecommendationRow[];
  dashboard_link?: string;
}
