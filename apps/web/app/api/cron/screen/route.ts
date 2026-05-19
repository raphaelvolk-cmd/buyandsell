import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createMasterRun, processBatch, finalizeMasterRun, type BatchOptions } from "@/lib/screening/orchestrator";
import type { SmtpConfig } from "@bst/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 20;

export async function GET(req: Request) {
  return handleCron(req);
}
export async function POST(req: Request) {
  return handleCron(req);
}

async function handleCron(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const slot = url.searchParams.get("slot") ?? "manual";
  const base = process.env.NEXT_PUBLIC_APP_BASE_URL ?? `${url.protocol}//${url.host}`;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!anthropicApiKey) {
    return NextResponse.json({ error: "missing_anthropic_api_key" }, { status: 500 });
  }
  const fallbackSmtp = resolveFallbackSmtp();

  const supabase = createSupabaseServiceRoleClient();

  // Pick all users that have at least one active ticker
  const { data: userRows, error } = await supabase
    .from("tickers")
    .select("user_id")
    .eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const userIds = Array.from(new Set((userRows ?? []).map((u) => u.user_id as string)));

  const summaries: Array<Record<string, unknown>> = [];

  // Sequential master: process each user's batches inline in this function.
  // With BATCH_SIZE=20 + FETCH_CONCURRENCY=12 + CLAUDE_CONCURRENCY=5, each
  // batch runs ~8-12s. 5 batches × ~10s = ~50s for 100 tickers — fits in
  // Hobby's 60s function limit. No after(), no fan-out, no chain breakage.
  for (const userId of userIds) {
    const r = await createMasterRun(supabase, userId, slot);
    if ("error" in r) {
      summaries.push({ user_id: userId, error: r.error });
      continue;
    }
    const runId = r.runId;
    const totalTickers = r.totalTickers;
    let userAggregate = { evaluated: 0, failed: 0, alerts: 0 };

    try {
      // Fetch all active ticker symbols once
      const { data: tickerRows } = await supabase
        .from("tickers")
        .select("symbol")
        .eq("user_id", userId)
        .eq("active", true)
        .order("symbol");
      const allSymbols = (tickerRows ?? []).map((t) => t.symbol as string);

      for (let off = 0; off < allSymbols.length; off += BATCH_SIZE) {
        const slice = allSymbols.slice(off, off + BATCH_SIZE);
        const opts: BatchOptions = {
          runId,
          userId,
          tickerSymbols: slice,
          anthropicApiKey,
          ...(fallbackSmtp ? { fallbackSmtp } : {}),
          ...(base ? { dashboardBaseUrl: base } : {}),
        };
        const bres = await processBatch(supabase, opts);
        userAggregate.evaluated += bres.evaluated;
        userAggregate.failed += bres.failed;
        userAggregate.alerts += bres.strong_buy_emails_sent;
      }

      await finalizeMasterRun(supabase, runId, new Date(Date.now()).toISOString());
      // Use the run's stored started_at for accurate duration:
      const { data: row } = await supabase
        .from("screening_runs")
        .select("started_at")
        .eq("id", runId)
        .single();
      if (row?.started_at) {
        const durMs = Date.now() - new Date(row.started_at as string).getTime();
        await supabase
          .from("screening_runs")
          .update({ duration_ms: durMs })
          .eq("id", runId);
      }

      summaries.push({
        user_id: userId,
        run_id: runId,
        total_tickers: totalTickers,
        fear_greed: r.fearGreed,
        ...userAggregate,
      });
    } catch (err) {
      await supabase
        .from("screening_runs")
        .update({ status: "failed", finished_at: new Date().toISOString() })
        .eq("id", runId);
      summaries.push({ user_id: userId, run_id: runId, error: (err as Error).message, ...userAggregate });
    }
  }

  return NextResponse.json({ slot, processed: summaries.length, summaries });
}

function resolveFallbackSmtp(): SmtpConfig | undefined {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const fromAddr = process.env.SMTP_FROM_ADDRESS;
  if (!host || !port || !fromAddr) return undefined;
  const cfg: SmtpConfig = { host, port: Number(port), from_address: fromAddr };
  if (process.env.SMTP_USER) cfg.user = process.env.SMTP_USER;
  if (process.env.SMTP_PASSWORD) cfg.password = process.env.SMTP_PASSWORD;
  if (process.env.SMTP_FROM_NAME) cfg.from_name = process.env.SMTP_FROM_NAME;
  return cfg;
}
