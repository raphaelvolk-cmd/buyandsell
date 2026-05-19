import { NextResponse, after } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { processBatch, finalizeMasterRun, type BatchOptions } from "@/lib/screening/orchestrator";
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
    await markRunFailed(runId, "missing_anthropic_api_key");
    return NextResponse.json({ error: "missing_anthropic_api_key" }, { status: 500 });
  }

  const supabase = createSupabaseServiceRoleClient();

  // Need the master run start time to compute duration at finalize.
  const { data: runRow, error: runErr } = await supabase
    .from("screening_runs")
    .select("started_at, status")
    .eq("id", runId)
    .single();
  if (runErr || !runRow) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }
  if (runRow.status !== "running") {
    return NextResponse.json({ run_id: runId, already_finalized: true });
  }

  // Pull the next batch of active tickers, deterministic order.
  const { data: tickerRows, error: tErr } = await supabase
    .from("tickers")
    .select("symbol")
    .eq("user_id", userId)
    .eq("active", true)
    .order("symbol")
    .range(offset, offset + BATCH_SIZE - 1);
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  const tickerSymbols = (tickerRows ?? []).map((t) => t.symbol as string);

  // No tickers left → finalize.
  if (tickerSymbols.length === 0) {
    await finalizeMasterRun(supabase, runId, runRow.started_at as string);
    return NextResponse.json({ run_id: runId, finalized: true });
  }

  const base = process.env.NEXT_PUBLIC_APP_BASE_URL ?? `${url.protocol}//${url.host}`;
  const fallbackSmtp = resolveFallbackSmtp();

  const opts: BatchOptions = {
    runId,
    userId,
    tickerSymbols,
    anthropicApiKey,
    ...(fallbackSmtp ? { fallbackSmtp } : {}),
    ...(base ? { dashboardBaseUrl: base } : {}),
  };

  const result = await processBatch(supabase, opts);

  // Dispatch the next batch (or finalize via the no-tickers branch above).
  after(async () => {
    try {
      await fetch(
        `${base}/api/cron/screen/batch?run_id=${runId}&user_id=${userId}&offset=${offset + BATCH_SIZE}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
          cache: "no-store",
        },
      );
    } catch {
      // ignore — next cron run will pick up incomplete state via /api/cron/runs-recover (todo)
    }
  });

  return NextResponse.json({ run_id: runId, offset, batch: result });
}

async function markRunFailed(runId: string, reason: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  await supabase
    .from("screening_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  // Also store the reason somewhere — we don't have a column, so attach to a future log table later.
  void reason;
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
