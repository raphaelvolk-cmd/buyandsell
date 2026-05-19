import type { DataSourceResult, NewsItem } from "./types.js";

const BASE = "https://www.alphavantage.co/query";

interface AvNewsResponse {
  feed?: Array<{
    title?: string;
    url?: string;
    summary?: string;
    source?: string;
    time_published?: string;
    overall_sentiment_score?: number;
    overall_sentiment_label?: string;
    ticker_sentiment?: Array<{
      ticker?: string;
      ticker_sentiment_score?: string;
      ticker_sentiment_label?: string;
    }>;
  }>;
  Note?: string; // Rate-limit warning
  Information?: string;
}

/**
 * Bulk-fetch news + sentiment for a batch of tickers (max ~50).
 * AlphaVantage NEWS_SENTIMENT supports comma-separated tickers in one call.
 * Free tier: 25 calls/day. Premium: 75/min.
 */
export async function fetchNewsSentiment(
  symbols: string[],
  apiKey: string,
  signal?: AbortSignal,
): Promise<DataSourceResult<Map<string, NewsItem[]>>> {
  if (symbols.length === 0) {
    return { ok: true, data: new Map(), source: "alphavantage.news" };
  }
  if (!apiKey) {
    return { ok: false, error: "missing_api_key", source: "alphavantage.news" };
  }
  // AV strips dots in ticker e.g. BRK.B → BRK-B for news; we pass as-is and let the API resolve.
  const tickerParam = symbols.slice(0, 50).join(",");
  const url = `${BASE}?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(tickerParam)}&limit=200&apikey=${encodeURIComponent(apiKey)}`;
  try {
    const init: RequestInit = { headers: { Accept: "application/json" } };
    if (signal) (init as { signal: AbortSignal }).signal = signal;
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`alphavantage http ${res.status}`);
    const raw = (await res.json()) as AvNewsResponse;
    if (raw.Note || raw.Information) {
      return {
        ok: false,
        error: raw.Note ?? raw.Information ?? "rate_limited",
        source: "alphavantage.news",
      };
    }
    const out = new Map<string, NewsItem[]>();
    for (const sym of symbols) out.set(sym, []);
    for (const f of raw.feed ?? []) {
      const item: NewsItem = {
        title: f.title ?? "",
        url: f.url ?? "",
        summary: f.summary,
        source: f.source,
        published: f.time_published,
        sentiment_score: f.overall_sentiment_score,
        sentiment_label: f.overall_sentiment_label,
      };
      const tickerSents = f.ticker_sentiment ?? [];
      const related = tickerSents
        .map((t) => t.ticker)
        .filter((t): t is string => !!t);
      item.related_symbols = related;
      for (const t of related) {
        if (out.has(t)) (out.get(t) as NewsItem[]).push(item);
      }
    }
    return { ok: true, data: out, source: "alphavantage.news" };
  } catch (err) {
    return { ok: false, error: (err as Error).message, source: "alphavantage.news" };
  }
}
