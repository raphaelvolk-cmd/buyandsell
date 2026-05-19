import type { Fundamentals, OHLCV } from "@bst/indicators";
import type { DataSourceResult, TickerQuote } from "./types.js";

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const QUOTE_BASE = "https://query1.finance.yahoo.com/v10/finance/quoteSummary";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export interface YahooFetchOptions {
  range?: "1mo" | "3mo" | "6mo" | "1y" | "2y";
  interval?: "1d" | "1wk";
  signal?: AbortSignal;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const init: RequestInit = {
    headers: { "User-Agent": UA, Accept: "application/json" },
  };
  if (signal) (init as { signal: AbortSignal }).signal = signal;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`yahoo http ${res.status}`);
  return res.json();
}

interface ChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        currency?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

function isoDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export async function fetchYahooHistory(
  symbol: string,
  opts: YahooFetchOptions = {},
): Promise<DataSourceResult<TickerQuote>> {
  const range = opts.range ?? "6mo";
  const interval = opts.interval ?? "1d";
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  try {
    const raw = (await fetchJson(url, opts.signal)) as ChartResponse;
    const result = raw.chart?.result?.[0];
    if (!result) {
      const err = raw.chart?.error?.description ?? "no_result";
      return { ok: false, error: err, source: "yahoo.chart" };
    }
    const ts = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0];
    if (!q) return { ok: false, error: "no_quote_indicator", source: "yahoo.chart" };

    const history: OHLCV[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      const v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null || v == null) continue;
      history.push({
        date: isoDate(ts[i] as number),
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
      });
    }

    const currentPrice =
      result.meta?.regularMarketPrice ??
      (history.length > 0 ? (history[history.length - 1] as OHLCV).close : 0);
    const currency = result.meta?.currency ?? "USD";

    return {
      ok: true,
      data: { symbol, current_price: currentPrice, currency, history },
      source: "yahoo.chart",
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message, source: "yahoo.chart" };
  }
}

interface QuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<Record<string, unknown>>;
    error?: { description?: string };
  };
}

function num(x: unknown): number | undefined {
  if (x == null) return undefined;
  if (typeof x === "number") return x;
  if (typeof x === "object" && x !== null && "raw" in x) {
    const raw = (x as { raw: unknown }).raw;
    return typeof raw === "number" ? raw : undefined;
  }
  return undefined;
}

export async function fetchYahooFundamentals(
  symbol: string,
  signal?: AbortSignal,
): Promise<DataSourceResult<Fundamentals>> {
  const modules = [
    "summaryDetail",
    "financialData",
    "defaultKeyStatistics",
    "price",
  ].join(",");
  const url = `${QUOTE_BASE}/${encodeURIComponent(symbol)}?modules=${modules}`;
  try {
    const raw = (await fetchJson(url, signal)) as QuoteSummaryResponse;
    const result = raw.quoteSummary?.result?.[0];
    if (!result) {
      return {
        ok: false,
        error: raw.quoteSummary?.error?.description ?? "no_result",
        source: "yahoo.quoteSummary",
      };
    }
    const sd = (result["summaryDetail"] ?? {}) as Record<string, unknown>;
    const fd = (result["financialData"] ?? {}) as Record<string, unknown>;
    const ks = (result["defaultKeyStatistics"] ?? {}) as Record<string, unknown>;

    const fundamentals: Fundamentals = {
      pe_trailing: num(sd["trailingPE"]),
      pe_forward: num(sd["forwardPE"]) ?? num(ks["forwardPE"]),
      ps_ratio: num(sd["priceToSalesTrailing12Months"]),
      revenue_growth: num(fd["revenueGrowth"]),
      earnings_growth: num(fd["earningsGrowth"]),
      debt_to_equity: num(fd["debtToEquity"]),
      dividend_yield: num(sd["dividendYield"]),
      profit_margins: num(fd["profitMargins"]),
      market_cap: num(sd["marketCap"]),
      fifty_two_week_high: num(sd["fiftyTwoWeekHigh"]),
      fifty_two_week_low: num(sd["fiftyTwoWeekLow"]),
      beta: num(sd["beta"]),
      return_on_equity: num(fd["returnOnEquity"]),
    };
    return { ok: true, data: fundamentals, source: "yahoo.quoteSummary" };
  } catch (err) {
    return { ok: false, error: (err as Error).message, source: "yahoo.quoteSummary" };
  }
}

export async function fetchYahooFull(
  symbol: string,
  opts: YahooFetchOptions = {},
): Promise<DataSourceResult<TickerQuote>> {
  const hist = await fetchYahooHistory(symbol, opts);
  if (!hist.ok || !hist.data) return hist;
  const fund = await fetchYahooFundamentals(symbol, opts.signal);
  if (fund.ok && fund.data) hist.data.fundamentals = fund.data;
  return hist;
}
