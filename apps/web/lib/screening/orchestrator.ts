import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildScores,
  computeTechnical,
  shouldEvaluate,
  type Scores,
  type TechnicalIndicators,
} from "@bst/indicators";
import {
  fetchFearGreed,
  fetchYahooFull,
  mapWithConcurrency,
  type FearGreed,
  type TickerQuote,
} from "@bst/datasources";
import { createEvaluator, type EvaluationOutput } from "@bst/claude";
import { dispatchStrongBuy, type SmtpConfig } from "@bst/email";

interface TickerRow {
  id: string;
  symbol: string;
  name: string | null;
  exchange: string | null;
}

interface PortfolioRow {
  id: string;
  symbol: string;
  shares: number;
  cost_basis: number;
  currency: string;
}

interface RecipientRow {
  email: string;
  receives_strong_buy: boolean;
}

interface UserSecretsRow {
  alphavantage_key: string | null;
  google_sheets_id: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_from_address: string | null;
  smtp_from_name: string | null;
}

export interface RunOptions {
  userId: string;
  slot: string; // premarket|midday|close|manual
  anthropicApiKey: string;
  fallbackSmtp?: SmtpConfig;
  dashboardBaseUrl?: string;
}

export interface RunSummary {
  run_id: string;
  user_id: string;
  total: number;
  evaluated: number;
  failed: number;
  strong_buy_emails_sent: number;
  duration_ms: number;
  fear_greed?: FearGreed;
  error?: string;
}

export interface BatchOptions {
  runId: string;
  userId: string;
  tickerSymbols: string[];
  anthropicApiKey: string;
  fallbackSmtp?: SmtpConfig;
  dashboardBaseUrl?: string;
}

export interface BatchResult {
  processed: number;
  evaluated: number;
  failed: number;
  strong_buy_emails_sent: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  fear_greed?: FearGreed;
}

const CLAUDE_CONCURRENCY = 3;
const FETCH_CONCURRENCY = 4;

export async function runScreening(
  supabase: SupabaseClient,
  opts: RunOptions,
): Promise<RunSummary> {
  const startedAt = Date.now();

  // 1. Insert screening_runs row (status=running)
  const trigger = `cron_${opts.slot}`;
  const { data: runRow, error: runErr } = await supabase
    .from("screening_runs")
    .insert({
      user_id: opts.userId,
      trigger,
      status: "running",
    })
    .select("id")
    .single();
  if (runErr || !runRow) {
    return {
      run_id: "",
      user_id: opts.userId,
      total: 0,
      evaluated: 0,
      failed: 0,
      strong_buy_emails_sent: 0,
      duration_ms: Date.now() - startedAt,
      error: `run_insert_failed: ${runErr?.message}`,
    };
  }
  const runId = runRow.id as string;

  try {
    // 2. Load tickers, portfolio, recipients, secrets in parallel
    const [tickersRes, positionsRes, recipientsRes, secretsRes, fgRes] =
      await Promise.all([
        supabase
          .from("tickers")
          .select("id, symbol, name, exchange")
          .eq("user_id", opts.userId)
          .eq("active", true),
        supabase
          .from("portfolio_positions")
          .select("id, symbol, shares, cost_basis, currency")
          .eq("user_id", opts.userId),
        supabase
          .from("email_recipients")
          .select("email, receives_strong_buy")
          .eq("user_id", opts.userId)
          .eq("active", true),
        supabase
          .from("user_secrets")
          .select("*")
          .eq("user_id", opts.userId)
          .maybeSingle(),
        fetchFearGreed(),
      ]);
    if (tickersRes.error) throw new Error(`tickers_query: ${tickersRes.error.message}`);
    const tickers = (tickersRes.data ?? []) as TickerRow[];
    const positions = (positionsRes.data ?? []) as PortfolioRow[];
    const recipients = (recipientsRes.data ?? []) as RecipientRow[];
    const secrets = (secretsRes.data ?? null) as UserSecretsRow | null;
    const fearGreed: FearGreed = fgRes.ok && fgRes.data
      ? fgRes.data
      : { value: 50, label: "Neutral", rating: "neutral", timestamp: new Date().toISOString() };

    // 3. Fetch market data
    const fetched = await mapWithConcurrency(
      tickers,
      FETCH_CONCURRENCY,
      async (t) => {
        const quote = await fetchYahooFull(t.symbol, { range: "6mo" });
        return { ticker: t, quote };
      },
    );

    // 4. Compute indicators + prefilter
    interface Prepared {
      ticker: TickerRow;
      quote: TickerQuote;
      indicators: TechnicalIndicators;
      scores: Scores;
      portfolioPosition?: PortfolioRow;
    }
    const portfolioBySymbol = new Map(positions.map((p) => [p.symbol, p]));
    const prepared: Prepared[] = [];
    let failed = 0;

    for (const settled of fetched) {
      if (settled.status === "rejected") {
        failed++;
        continue;
      }
      const { ticker, quote } = settled.value;
      if (!quote.ok || !quote.data) {
        failed++;
        continue;
      }
      const tech = computeTechnical(quote.data.history);
      if (tech.error) {
        failed++;
        continue;
      }
      const scores = buildScores(
        tech,
        quote.data.fundamentals,
        fearGreed.value,
        quote.data.current_price,
        0.1,
      );
      const item: Prepared = {
        ticker,
        quote: quote.data,
        indicators: tech,
        scores,
      };
      const pos = portfolioBySymbol.get(ticker.symbol);
      if (pos) item.portfolioPosition = pos;
      prepared.push(item);
    }

    // 5. Decide which tickers go to Claude
    const toEvaluate = prepared.filter((p) =>
      shouldEvaluate({
        tech: p.indicators,
        scores: p.scores,
        inPortfolio: p.portfolioPosition !== undefined,
      }).passes,
    );

    // 6. Run Claude evaluations
    const evaluator = createEvaluator({ apiKey: opts.anthropicApiKey });
    const evalResults = await mapWithConcurrency(
      toEvaluate,
      CLAUDE_CONCURRENCY,
      async (p) =>
        evaluator.evaluateOne({
          symbol: p.ticker.symbol,
          name: p.ticker.name ?? undefined,
          exchange: p.ticker.exchange ?? undefined,
          currency: p.quote.currency,
          current_price: p.quote.current_price,
          indicators: p.indicators,
          fundamentals: p.quote.fundamentals,
          scores: p.scores,
          fear_greed: { value: fearGreed.value, label: fearGreed.label },
          portfolio: p.portfolioPosition
            ? {
                cost_basis: p.portfolioPosition.cost_basis,
                shares: p.portfolioPosition.shares,
                currency: p.portfolioPosition.currency,
              }
            : undefined,
        }),
    );

    // 7. Aggregate, build inserts, dispatch strong-buy alerts
    const tokenAgg = { input: 0, output: 0, cached: 0 };
    const evalInserts: Array<Record<string, unknown>> = [];
    const recInserts: Array<Record<string, unknown>> = [];
    const strongBuyAlerts: Array<{
      symbol: string;
      name?: string;
      currency: string;
      current_price: number;
      total_score: number;
      evaluation: EvaluationOutput;
    }> = [];

    for (let i = 0; i < evalResults.length; i++) {
      const settled = evalResults[i];
      const p = toEvaluate[i];
      if (!p || !settled) continue;
      if (settled.status === "rejected" || !settled.value.ok || !settled.value.evaluation) {
        failed++;
        evalInserts.push({
          run_id: runId,
          user_id: opts.userId,
          symbol: p.ticker.symbol,
          current_price: p.quote.current_price,
          rsi: p.indicators.rsi,
          macd: p.indicators.macd,
          macd_signal: p.indicators.macd_signal,
          macd_histogram: p.indicators.macd_histogram,
          macd_crossover: p.indicators.macd_crossover,
          bb_position: p.indicators.bb_position,
          sma50: p.indicators.sma50,
          sma200: p.indicators.sma200,
          atr: p.indicators.atr,
          fib_support: p.indicators.fibonacci?.next_support ?? null,
          fib_resistance: p.indicators.fibonacci?.next_resistance ?? null,
          stop_loss: p.indicators.stop_loss,
          score_technical: p.scores.technical,
          score_fundamental: p.scores.fundamental,
          score_sentiment: p.scores.sentiment,
          score_total: p.scores.total,
          signal: null,
          conviction: null,
          thesis: settled.status === "rejected" ? String(settled.reason) : settled.value.error,
        });
        continue;
      }
      const e = settled.value.evaluation;
      const u = settled.value.usage;
      if (u) {
        tokenAgg.input += u.input_tokens;
        tokenAgg.output += u.output_tokens;
        tokenAgg.cached += u.cache_read_input_tokens ?? 0;
      }
      evalInserts.push({
        run_id: runId,
        user_id: opts.userId,
        symbol: p.ticker.symbol,
        current_price: p.quote.current_price,
        rsi: p.indicators.rsi,
        macd: p.indicators.macd,
        macd_signal: p.indicators.macd_signal,
        macd_histogram: p.indicators.macd_histogram,
        macd_crossover: p.indicators.macd_crossover,
        bb_position: p.indicators.bb_position,
        sma50: p.indicators.sma50,
        sma200: p.indicators.sma200,
        atr: p.indicators.atr,
        fib_support: p.indicators.fibonacci?.next_support ?? null,
        fib_resistance: p.indicators.fibonacci?.next_resistance ?? null,
        stop_loss: e.stop_loss,
        score_technical: p.scores.technical,
        score_fundamental: p.scores.fundamental,
        score_sentiment: p.scores.sentiment,
        score_total: p.scores.total,
        signal: e.signal,
        conviction: e.conviction,
        thesis: e.thesis,
        risks: e.risks,
        catalysts: e.catalysts,
        target_price: e.target_price,
        raw_payload: e as unknown,
      });

      // Watchlist recommendation
      if (e.signal === "BUY" || e.signal === "STRONG_BUY" || e.signal === "SELL" || e.signal === "STRONG_SELL") {
        recInserts.push({
          run_id: runId,
          user_id: opts.userId,
          symbol: p.ticker.symbol,
          action: e.signal,
          context: "watchlist",
          rationale: e.thesis,
          target_price: e.target_price,
          stop_loss: e.stop_loss,
        });
      }
      // Portfolio recommendation (if portfolio_action was returned)
      if (p.portfolioPosition && e.portfolio_action) {
        recInserts.push({
          run_id: runId,
          user_id: opts.userId,
          symbol: p.ticker.symbol,
          action: e.portfolio_action,
          context: "portfolio",
          position_id: p.portfolioPosition.id,
          rationale: e.thesis,
          target_price: e.target_price,
          stop_loss: e.stop_loss,
        });
      }
      // Queue strong-buy alert
      if (e.signal === "STRONG_BUY" && e.conviction >= 0.7) {
        strongBuyAlerts.push({
          symbol: p.ticker.symbol,
          name: p.ticker.name ?? undefined,
          currency: p.quote.currency,
          current_price: p.quote.current_price,
          total_score: p.scores.total,
          evaluation: e,
        });
      }
    }

    // 8. Bulk inserts
    if (evalInserts.length > 0) {
      await supabase.from("evaluations").insert(evalInserts);
    }
    if (recInserts.length > 0) {
      await supabase.from("recommendations").insert(recInserts);
    }

    // 9. Strong-buy dispatch with dedup
    let alertsSent = 0;
    const smtp = resolveSmtp(secrets, opts.fallbackSmtp);
    const strongBuyRecipients = recipients
      .filter((r) => r.receives_strong_buy)
      .map((r) => r.email);
    if (smtp && strongBuyAlerts.length > 0 && strongBuyRecipients.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      for (const a of strongBuyAlerts) {
        const dedupKey = `${a.symbol}:STRONG_BUY:${today}`;
        const { data: existing } = await supabase
          .from("alerts_sent")
          .select("id")
          .eq("user_id", opts.userId)
          .eq("dedup_key", dedupKey)
          .maybeSingle();
        if (existing) continue;

        const res = await dispatchStrongBuy(smtp, strongBuyRecipients, {
          symbol: a.symbol,
          name: a.name,
          currency: a.currency,
          current_price: a.current_price,
          total_score: a.total_score,
          conviction: a.evaluation.conviction,
          thesis: a.evaluation.thesis,
          risks: a.evaluation.risks,
          catalysts: a.evaluation.catalysts,
          target_price: a.evaluation.target_price,
          stop_loss: a.evaluation.stop_loss,
          dashboard_link: opts.dashboardBaseUrl
            ? `${opts.dashboardBaseUrl}/watchlist?focus=${encodeURIComponent(a.symbol)}`
            : undefined,
        });
        if (res.ok) {
          alertsSent++;
          await supabase.from("alerts_sent").insert({
            user_id: opts.userId,
            symbol: a.symbol,
            signal: "STRONG_BUY",
            dedup_key: dedupKey,
          });
        }
      }
    }

    // 10. Finalize run
    const durationMs = Date.now() - startedAt;
    await supabase
      .from("screening_runs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        tickers_total: tickers.length,
        tickers_ok: evalInserts.length - failed,
        tickers_failed: failed,
        fear_greed_value: fearGreed.value,
        fear_greed_label: fearGreed.label,
        claude_input_tokens: tokenAgg.input,
        claude_output_tokens: tokenAgg.output,
        claude_cached_tokens: tokenAgg.cached,
        duration_ms: durationMs,
      })
      .eq("id", runId);

    return {
      run_id: runId,
      user_id: opts.userId,
      total: tickers.length,
      evaluated: evalInserts.length - failed,
      failed,
      strong_buy_emails_sent: alertsSent,
      duration_ms: durationMs,
      fear_greed: fearGreed,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    await supabase
      .from("screening_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), duration_ms: durationMs })
      .eq("id", runId);
    return {
      run_id: runId,
      user_id: opts.userId,
      total: 0,
      evaluated: 0,
      failed: 0,
      strong_buy_emails_sent: 0,
      duration_ms: durationMs,
      error: (err as Error).message,
    };
  }
}

function resolveSmtp(
  secrets: UserSecretsRow | null,
  fallback?: SmtpConfig,
): SmtpConfig | undefined {
  if (
    secrets?.smtp_host &&
    secrets.smtp_port &&
    secrets.smtp_from_address
  ) {
    const cfg: SmtpConfig = {
      host: secrets.smtp_host,
      port: secrets.smtp_port,
      from_address: secrets.smtp_from_address,
    };
    if (secrets.smtp_user) cfg.user = secrets.smtp_user;
    if (secrets.smtp_password) cfg.password = secrets.smtp_password;
    if (secrets.smtp_from_name) cfg.from_name = secrets.smtp_from_name;
    return cfg;
  }
  return fallback;
}

// ───────────────── Sub-batch master/worker helpers ─────────────────

export async function createMasterRun(
  supabase: SupabaseClient,
  userId: string,
  slot: string,
): Promise<{ runId: string; fearGreed: FearGreed; totalTickers: number } | { error: string }> {
  const trigger = `cron_${slot}`;
  const fgRes = await fetchFearGreed();
  const fearGreed: FearGreed =
    fgRes.ok && fgRes.data
      ? fgRes.data
      : { value: 50, label: "Neutral", rating: "neutral", timestamp: new Date().toISOString() };

  const { count } = await supabase
    .from("tickers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("active", true);
  const total = count ?? 0;

  const { data: runRow, error: runErr } = await supabase
    .from("screening_runs")
    .insert({
      user_id: userId,
      trigger,
      status: "running",
      tickers_total: total,
      tickers_ok: 0,
      tickers_failed: 0,
      claude_input_tokens: 0,
      claude_output_tokens: 0,
      claude_cached_tokens: 0,
      fear_greed_value: fearGreed.value,
      fear_greed_label: fearGreed.label,
    })
    .select("id")
    .single();
  if (runErr || !runRow) return { error: `run_insert_failed: ${runErr?.message}` };
  return { runId: runRow.id as string, fearGreed, totalTickers: total };
}

export async function processBatch(
  supabase: SupabaseClient,
  opts: BatchOptions,
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: opts.tickerSymbols.length,
    evaluated: 0,
    failed: 0,
    strong_buy_emails_sent: 0,
    input_tokens: 0,
    output_tokens: 0,
    cached_tokens: 0,
  };

  // 1. Load run context: F&G snapshot + portfolio + recipients + secrets in parallel
  const [runRes, tickersRes, positionsRes, recipientsRes, secretsRes] = await Promise.all([
    supabase.from("screening_runs").select("fear_greed_value, fear_greed_label").eq("id", opts.runId).single(),
    supabase
      .from("tickers")
      .select("id, symbol, name, exchange")
      .eq("user_id", opts.userId)
      .in("symbol", opts.tickerSymbols),
    supabase
      .from("portfolio_positions")
      .select("id, symbol, shares, cost_basis, currency")
      .eq("user_id", opts.userId)
      .in("symbol", opts.tickerSymbols),
    supabase
      .from("email_recipients")
      .select("email, receives_strong_buy")
      .eq("user_id", opts.userId)
      .eq("active", true),
    supabase
      .from("user_secrets")
      .select("*")
      .eq("user_id", opts.userId)
      .maybeSingle(),
  ]);
  const fgValue = (runRes.data?.fear_greed_value as number | null) ?? 50;
  const fgLabel = (runRes.data?.fear_greed_label as string | null) ?? "Neutral";
  result.fear_greed = { value: fgValue, label: fgLabel, rating: fgLabel.toLowerCase(), timestamp: new Date().toISOString() };

  const tickers = (tickersRes.data ?? []) as Array<{ id: string; symbol: string; name: string | null; exchange: string | null }>;
  const positions = (positionsRes.data ?? []) as Array<{ id: string; symbol: string; shares: number; cost_basis: number; currency: string }>;
  const recipients = (recipientsRes.data ?? []) as Array<{ email: string; receives_strong_buy: boolean }>;
  const secrets = (secretsRes.data ?? null) as UserSecretsRow | null;

  // 2. Fetch market data
  const fetched = await mapWithConcurrency(tickers, FETCH_CONCURRENCY, async (t) => {
    const quote = await fetchYahooFull(t.symbol, { range: "6mo" });
    return { ticker: t, quote };
  });

  // 3. Compute indicators + prefilter
  interface Prepared {
    ticker: { id: string; symbol: string; name: string | null; exchange: string | null };
    quote: TickerQuote;
    indicators: TechnicalIndicators;
    scores: Scores;
    portfolioPosition?: { id: string; symbol: string; shares: number; cost_basis: number; currency: string };
  }
  const portfolioBySymbol = new Map(positions.map((p) => [p.symbol, p]));
  const prepared: Prepared[] = [];
  for (const settled of fetched) {
    if (settled.status === "rejected") {
      result.failed++;
      continue;
    }
    const { ticker, quote } = settled.value;
    if (!quote.ok || !quote.data) {
      result.failed++;
      continue;
    }
    const tech = computeTechnical(quote.data.history);
    if (tech.error) {
      result.failed++;
      continue;
    }
    const scores = buildScores(tech, quote.data.fundamentals, fgValue, quote.data.current_price, 0.1);
    const item: Prepared = { ticker, quote: quote.data, indicators: tech, scores };
    const pos = portfolioBySymbol.get(ticker.symbol);
    if (pos) item.portfolioPosition = pos;
    prepared.push(item);
  }

  const toEvaluate = prepared.filter((p) =>
    shouldEvaluate({ tech: p.indicators, scores: p.scores, inPortfolio: p.portfolioPosition !== undefined }).passes,
  );

  // 4. Claude evaluations
  const evaluator = createEvaluator({ apiKey: opts.anthropicApiKey });
  const evalResults = await mapWithConcurrency(toEvaluate, CLAUDE_CONCURRENCY, async (p) =>
    evaluator.evaluateOne({
      symbol: p.ticker.symbol,
      name: p.ticker.name ?? undefined,
      exchange: p.ticker.exchange ?? undefined,
      currency: p.quote.currency,
      current_price: p.quote.current_price,
      indicators: p.indicators,
      fundamentals: p.quote.fundamentals,
      scores: p.scores,
      fear_greed: { value: fgValue, label: fgLabel },
      portfolio: p.portfolioPosition
        ? {
            cost_basis: p.portfolioPosition.cost_basis,
            shares: p.portfolioPosition.shares,
            currency: p.portfolioPosition.currency,
          }
        : undefined,
    }),
  );

  // 5. Build inserts
  const evalInserts: Array<Record<string, unknown>> = [];
  const recInserts: Array<Record<string, unknown>> = [];
  const strongBuyAlerts: Array<{
    symbol: string;
    name?: string;
    currency: string;
    current_price: number;
    total_score: number;
    evaluation: EvaluationOutput;
  }> = [];

  for (let i = 0; i < evalResults.length; i++) {
    const settled = evalResults[i];
    const p = toEvaluate[i];
    if (!p || !settled) continue;
    if (settled.status === "rejected" || !settled.value.ok || !settled.value.evaluation) {
      result.failed++;
      continue;
    }
    const e = settled.value.evaluation;
    const u = settled.value.usage;
    if (u) {
      result.input_tokens += u.input_tokens;
      result.output_tokens += u.output_tokens;
      result.cached_tokens += u.cache_read_input_tokens ?? 0;
    }
    result.evaluated++;
    evalInserts.push({
      run_id: opts.runId,
      user_id: opts.userId,
      symbol: p.ticker.symbol,
      current_price: p.quote.current_price,
      rsi: p.indicators.rsi,
      macd: p.indicators.macd,
      macd_signal: p.indicators.macd_signal,
      macd_histogram: p.indicators.macd_histogram,
      macd_crossover: p.indicators.macd_crossover,
      bb_position: p.indicators.bb_position,
      sma50: p.indicators.sma50,
      sma200: p.indicators.sma200,
      atr: p.indicators.atr,
      fib_support: p.indicators.fibonacci?.next_support ?? null,
      fib_resistance: p.indicators.fibonacci?.next_resistance ?? null,
      stop_loss: e.stop_loss,
      score_technical: p.scores.technical,
      score_fundamental: p.scores.fundamental,
      score_sentiment: p.scores.sentiment,
      score_total: p.scores.total,
      signal: e.signal,
      conviction: e.conviction,
      thesis: e.thesis,
      risks: e.risks,
      catalysts: e.catalysts,
      target_price: e.target_price,
      raw_payload: e as unknown,
    });
    if (e.signal === "BUY" || e.signal === "STRONG_BUY" || e.signal === "SELL" || e.signal === "STRONG_SELL") {
      recInserts.push({
        run_id: opts.runId,
        user_id: opts.userId,
        symbol: p.ticker.symbol,
        action: e.signal,
        context: "watchlist",
        rationale: e.thesis,
        target_price: e.target_price,
        stop_loss: e.stop_loss,
      });
    }
    if (p.portfolioPosition && e.portfolio_action) {
      recInserts.push({
        run_id: opts.runId,
        user_id: opts.userId,
        symbol: p.ticker.symbol,
        action: e.portfolio_action,
        context: "portfolio",
        position_id: p.portfolioPosition.id,
        rationale: e.thesis,
        target_price: e.target_price,
        stop_loss: e.stop_loss,
      });
    }
    if (e.signal === "STRONG_BUY" && e.conviction >= 0.7) {
      const alert: typeof strongBuyAlerts[number] = {
        symbol: p.ticker.symbol,
        currency: p.quote.currency,
        current_price: p.quote.current_price,
        total_score: p.scores.total,
        evaluation: e,
      };
      if (p.ticker.name) alert.name = p.ticker.name;
      strongBuyAlerts.push(alert);
    }
  }

  if (evalInserts.length > 0) await supabase.from("evaluations").insert(evalInserts);
  if (recInserts.length > 0) await supabase.from("recommendations").insert(recInserts);

  // 6. Strong-buy dispatch
  const smtp = resolveSmtp(secrets, opts.fallbackSmtp);
  const strongBuyRecipients = recipients.filter((r) => r.receives_strong_buy).map((r) => r.email);
  if (smtp && strongBuyAlerts.length > 0 && strongBuyRecipients.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    for (const a of strongBuyAlerts) {
      const dedupKey = `${a.symbol}:STRONG_BUY:${today}`;
      const { data: existing } = await supabase
        .from("alerts_sent")
        .select("id")
        .eq("user_id", opts.userId)
        .eq("dedup_key", dedupKey)
        .maybeSingle();
      if (existing) continue;
      const sent = await dispatchStrongBuy(smtp, strongBuyRecipients, {
        symbol: a.symbol,
        ...(a.name !== undefined ? { name: a.name } : {}),
        currency: a.currency,
        current_price: a.current_price,
        total_score: a.total_score,
        conviction: a.evaluation.conviction,
        thesis: a.evaluation.thesis,
        risks: a.evaluation.risks,
        catalysts: a.evaluation.catalysts,
        target_price: a.evaluation.target_price,
        stop_loss: a.evaluation.stop_loss,
        ...(opts.dashboardBaseUrl
          ? { dashboard_link: `${opts.dashboardBaseUrl}/watchlist?focus=${encodeURIComponent(a.symbol)}` }
          : {}),
      });
      if (sent.ok) {
        result.strong_buy_emails_sent++;
        await supabase.from("alerts_sent").insert({
          user_id: opts.userId,
          symbol: a.symbol,
          signal: "STRONG_BUY",
          dedup_key: dedupKey,
        });
      }
    }
  }

  // 7. Increment master run stats (read-modify-write; single-user low race risk)
  const { data: current } = await supabase
    .from("screening_runs")
    .select("tickers_ok, tickers_failed, claude_input_tokens, claude_output_tokens, claude_cached_tokens")
    .eq("id", opts.runId)
    .single();
  if (current) {
    await supabase
      .from("screening_runs")
      .update({
        tickers_ok: (current.tickers_ok ?? 0) + result.evaluated,
        tickers_failed: (current.tickers_failed ?? 0) + result.failed,
        claude_input_tokens: (current.claude_input_tokens ?? 0) + result.input_tokens,
        claude_output_tokens: (current.claude_output_tokens ?? 0) + result.output_tokens,
        claude_cached_tokens: (current.claude_cached_tokens ?? 0) + result.cached_tokens,
      })
      .eq("id", opts.runId);
  }

  return result;
}

export async function finalizeMasterRun(
  supabase: SupabaseClient,
  runId: string,
  startedAtIso: string,
): Promise<void> {
  const durationMs = Date.now() - new Date(startedAtIso).getTime();
  await supabase
    .from("screening_runs")
    .update({ status: "done", finished_at: new Date().toISOString(), duration_ms: durationMs })
    .eq("id", runId);
}
