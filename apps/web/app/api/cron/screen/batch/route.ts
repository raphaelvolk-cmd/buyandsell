import { NextResponse, after } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { processBatch, type BatchOptions } from "@/lib/screening/orchestrator";
import type { SmtpConfig } from "@bst/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 10;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const runId = url.searchParams.get("run_id");
  const userId = url.searchParams.get("user_id");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  if (!runId || !userId || !Number.isFinite(offset)) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!anthropicApiKey) {
    return NextResponse.json({ error: "missing_anthropic_api_key" }, { status: 500 });
  }

  const supabase = createSupabaseServiceRoleClient();

  // Resolve the ticker slice for this batch synchronously so we can return
  // 202 with an honest "no tickers" / "queued" body. Heavy work goes to after().
  const { data: tickerRows, error: tErr } = await supabase
    .from("tickers")
    .select("symbol")
    .eq("user_id", userId)
    .eq("active", true)
    .order("symbol")
    .range(offset, offset + BATCH_SIZE - 1);
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  const tickerSymbols = (tickerRows ?? []).map((t) => t.symbol as string);

  if (tickerSymbols.length === 0) {
    // No work for this offset; let the completion guard run in after()
    after(async () => {
      await maybeFinalizeRun(runId);
    });
    return NextResponse.json({ run_id: runId, offset, processed: 0 }, { status: 202 });
  }

  const fallbackSmtp = resolveFallbackSmtp();
  const base = process.env.NEXT_PUBLIC_APP_BASE_URL ?? `${url.protocol}//${url.host}`;
  const opts: BatchOptions = {
    runId,
    userId,
    tickerSymbols,
    anthropicApiKey,
    ...(fallbackSmtp ? { fallbackSmtp } : {}),
    ...(base ? { dashboardBaseUrl: base } : {}),
  };

  // Schedule the heavy work to run AFTER the 202 response is sent.
  after(async () => {
    try {
      await processBatch(supabase, opts);
    } catch {
      // swallow — failure increments are already tracked in processBatch.
    }
    await maybeFinalizeRun(runId);
  });

  // Return 202 immediately so the master loop can dispatch the next batch.
  return NextResponse.json({ run_id: runId, offset, queued: tickerSymbols.length }, { status: 202 });
}

async function maybeFinalizeRun(runId: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: post } = await supabase
    .from("screening_runs")
    .select("tickers_ok, tickers_failed, tickers_total, started_at, status")
    .eq("id", runId)
    .single();
  if (!post || post.status !== "running") return;
  const okCount = (post.tickers_ok as number | null) ?? 0;
  const failCount = (post.tickers_failed as number | null) ?? 0;
  const totalCount = (post.tickers_total as number | null) ?? 0;
  if (okCount + failCount >= totalCount) {
    const startedIso = post.started_at as string;
    const durationMs = Date.now() - new Date(startedIso).getTime();
    await supabase
      .from("screening_runs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", runId)
      .eq("status", "running");
  }
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
