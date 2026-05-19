import type { DataSourceResult, FearGreed } from "./types.js";

const URL_PRIMARY =
  "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

interface CnnResponse {
  fear_and_greed?: {
    score?: number;
    rating?: string;
    timestamp?: string;
    previous_close?: number;
    previous_1_week?: number;
    previous_1_month?: number;
    previous_1_year?: number;
  };
}

function labelFor(score: number): string {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

export async function fetchFearGreed(
  signal?: AbortSignal,
): Promise<DataSourceResult<FearGreed>> {
  try {
    const init: RequestInit = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    };
    if (signal) (init as { signal: AbortSignal }).signal = signal;
    const res = await fetch(URL_PRIMARY, init);
    if (!res.ok) throw new Error(`cnn http ${res.status}`);
    const raw = (await res.json()) as CnnResponse;
    const score = raw.fear_and_greed?.score;
    if (typeof score !== "number") {
      return { ok: false, error: "no_score", source: "cnn.fearandgreed" };
    }
    const value = Math.round(score);
    return {
      ok: true,
      source: "cnn.fearandgreed",
      data: {
        value,
        rating: raw.fear_and_greed?.rating ?? labelFor(value),
        label: labelFor(value),
        timestamp:
          raw.fear_and_greed?.timestamp ?? new Date().toISOString(),
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message, source: "cnn.fearandgreed" };
  }
}
