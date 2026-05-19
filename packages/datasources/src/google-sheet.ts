import type { DataSourceResult } from "./types.js";

/**
 * Backup price source via a user-maintained Google Sheet that uses
 * `=GOOGLEFINANCE(...)` formulas in columns A:E like:
 *
 *   A: symbol | B: price | C: prev_close | D: name | E: timestamp
 *
 * Read via the public Sheets v4 API with a Service Account OAuth token.
 * Token acquisition is the caller's responsibility — we accept it as input
 * to keep this module pure (no JWT/google-auth deps).
 */

export interface SheetQuote {
  symbol: string;
  price: number;
  prev_close: number | null;
  name?: string;
  timestamp?: string;
}

interface SheetsValuesResponse {
  values?: string[][];
}

export async function fetchGoogleSheetQuotes(
  spreadsheetId: string,
  accessToken: string,
  range = "Quotes!A2:E",
  signal?: AbortSignal,
): Promise<DataSourceResult<Map<string, SheetQuote>>> {
  if (!spreadsheetId || !accessToken) {
    return { ok: false, error: "missing_credentials", source: "google.sheet" };
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  try {
    const init: RequestInit = {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    };
    if (signal) (init as { signal: AbortSignal }).signal = signal;
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`sheets http ${res.status}`);
    const raw = (await res.json()) as SheetsValuesResponse;
    const rows = raw.values ?? [];
    const out = new Map<string, SheetQuote>();
    for (const row of rows) {
      const symbol = row[0]?.trim();
      const priceStr = row[1];
      if (!symbol || !priceStr) continue;
      const price = Number(priceStr.replace(",", "."));
      if (!Number.isFinite(price)) continue;
      const prev = row[2] ? Number(row[2].replace(",", ".")) : null;
      out.set(symbol, {
        symbol,
        price,
        prev_close: prev !== null && Number.isFinite(prev) ? prev : null,
        name: row[3]?.trim(),
        timestamp: row[4]?.trim(),
      });
    }
    return { ok: true, data: out, source: "google.sheet" };
  } catch (err) {
    return { ok: false, error: (err as Error).message, source: "google.sheet" };
  }
}
