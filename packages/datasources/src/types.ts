import type { Fundamentals, OHLCV } from "@bst/indicators";

export interface TickerQuote {
  symbol: string;
  current_price: number;
  currency: string;
  history: OHLCV[];
  fundamentals?: Fundamentals;
  name?: string;
  sector?: string;
}

export interface DataSourceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  source: string;
}

export interface FearGreed {
  value: number;
  label: string;
  rating: string;
  timestamp: string;
}

export interface NewsItem {
  title: string;
  url: string;
  summary?: string;
  source?: string;
  published?: string;
  sentiment_score?: number;
  sentiment_label?: string;
  related_symbols?: string[];
}
