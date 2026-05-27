import type { Fundamentals, OHLCV } from "@bst/indicators";
import type { DataSourceResult, TickerQuote } from "./types.js";

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const QUOTE_BASE = "https://query1.finance.yahoo.com/v10/finance/quoteSummary";
const FC_BASE = "https://fc.yahoo.com";
const CRUMB_URL = "https://query1.finance.yahoo.com/v1/test/getcrumb";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export interface YahooFetchOptions {
  range?: "1mo" | "3mo" | "6mo" | "1y" | "2y";
  interval?: "1d" | "1wk";
  signal?: AbortSignal;
}

// ─── Crumb + cookie caching ─────────────────────────────────────────────────
// Yahoo's quoteSummary endpoint requires a cookie+crumb pair since 2024.
// We cache them per function instance (and refresh on 401).

interface YahooSession {
  cookie: string;
  crumb: string;
}

let cachedSession: YahooSession | null = null;
let pendingSession: Promise<YahooSession | null> | null = null;

function parseSetCookie(setCookieHeaders: string[]): string {
  // Build a Cookie header value from the cookies Yahoo set on us.
  // We only need name=value pairs, drop the attributes.
  const pairs: string[] = [];
  for (const h of setCookieHeaders) {
    const first = h.split(";")[0]?.trim();
    if (first) pairs.push(first);
  }
  return pairs.join("; ");
}

async function obtainSession(signal?: AbortSignal): Promise<YahooSession | null> {
  try {
    // Step 1: hit fc.yahoo.com to receive Set-Cookie. The endpoint returns 404
    // but still sets the cookie — that's fine.
    const init: RequestInit = {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "manual",
    };
    if (signal) (init as { signal: AbortSignal }).signal = signal;
    const r1 = await fetch(FC_BASE, init);
    const setCookies = r1.headers.getSetCookie?.() ?? r1.headers.get("set-cookie")?.split(/,\s*(?=[^,]+=)/) ?? [];
    const cookie = parseSetCookie(setCookies);
    if (!cookie) return null;

    // Step 2: get the crumb token using that cookie.
    const initCrumb: RequestInit = {
      headers: { "User-Agent": UA, Accept: "text/plain", Cookie: cookie },
    };
    if (signal) (initCrumb as { signal: AbortSignal }).signal = signal;
    const r2 = await fetch(CRUMB_URL, initCrumb);
    if (!r2.ok) return null;
    const crumb = (await r2.text()).trim();
    if (!crumb) return null;
    return { cookie, crumb };
  } catch {
    return null;
  }
}

async function getSession(signal?: AbortSignal): Promise<YahooSession | null> {
  if (cachedSession) return cachedSession;
  if (!pendingSession) {
    pendingSession = (async () => {
      const s = await obtainSession(signal);
      if (s) cachedSession = s;
      return s;
    })().finally(() => {
      pendingSession = null;
    });
  }
  return pendingSession;
}

function invalidateSession() {
  cachedSession = null;
}

// ─── Public helpers ─────────────────────────────────────────────────────────

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const init: RequestInit = {
    headers: { "User-Agent": UA, Accept: "application/json" },
  };
  if (signal) (init as { signal: AbortSignal }).signal = signal;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`yahoo http ${res.status}`);
  return res.json();
}

async function fetchJsonAuthed(
  pathWithModules: string,
  signal?: AbortSignal,
): Promise<unknown> {
  // Tries authed fetch with crumb; on 401 invalidates session and retries once.
  const attempt = async (sess: YahooSession): Promise<Response> => {
    const url = `${pathWithModules}${pathWithModules.includes("?") ? "&" : "?"}crumb=${encodeURIComponent(sess.crumb)}`;
    const init: RequestInit = {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Cookie: sess.cookie,
      },
    };
    if (signal) (init as { signal: AbortSignal }).signal = signal;
    return fetch(url, init);
  };

  let sess = await getSession(signal);
  if (!sess) throw new Error("yahoo_session_unavailable");
  let res = await attempt(sess);
  if (res.status === 401) {
    invalidateSession();
    sess = await getSession(signal);
    if (!sess) throw new Error("yahoo_session_unavailable_retry");
    res = await attempt(sess);
  }
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
    const raw = (await fetchJsonAuthed(url, signal)) as QuoteSummaryResponse;
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
