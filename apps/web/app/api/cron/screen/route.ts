import { NextResponse, after } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createMasterRun } from "@/lib/screening/orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 10;

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

  const supabase = createSupabaseServiceRoleClient();

  // Pick all users that have at least one active ticker
  const { data: userRows, error } = await supabase
    .from("tickers")
    .select("user_id")
    .eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const userIds = Array.from(new Set((userRows ?? []).map((u) => u.user_id as string)));

  const summaries: Array<Record<string, unknown>> = [];

  for (const userId of userIds) {
    const r = await createMasterRun(supabase, userId, slot);
    if ("error" in r) {
      summaries.push({ user_id: userId, error: r.error });
      continue;
    }
    summaries.push({
      user_id: userId,
      run_id: r.runId,
      total_tickers: r.totalTickers,
      fear_greed: r.fearGreed,
      batches: Math.ceil(r.totalTickers / BATCH_SIZE),
    });

    // Dispatch first batch via after() so the master response can return immediately.
    after(async () => {
      try {
        await fetch(`${base}/api/cron/screen/batch?run_id=${r.runId}&user_id=${userId}&offset=0`, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
          cache: "no-store",
        });
      } catch {
        // best-effort dispatch; worker handles its own retries via the next-batch chain
      }
    });
  }

  return NextResponse.json({ slot, dispatched: summaries.length, summaries });
}
