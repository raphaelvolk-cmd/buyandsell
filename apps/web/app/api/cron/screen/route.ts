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
    const totalBatches = Math.ceil(r.totalTickers / BATCH_SIZE);
    summaries.push({
      user_id: userId,
      run_id: r.runId,
      total_tickers: r.totalTickers,
      fear_greed: r.fearGreed,
      batches: totalBatches,
    });

    // Fan out: dispatch ALL batches in parallel via after(). Each worker is an
    // independent function invocation with its own 60s budget. Master's after()
    // keeps the response open while the dispatches complete.
    const runId = r.runId;
    after(async () => {
      const dispatches: Promise<unknown>[] = [];
      for (let offset = 0; offset < r.totalTickers; offset += BATCH_SIZE) {
        dispatches.push(
          fetch(
            `${base}/api/cron/screen/batch?run_id=${runId}&user_id=${userId}&offset=${offset}`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${secret}` },
              cache: "no-store",
            },
          ).catch(() => null),
        );
      }
      await Promise.allSettled(dispatches);
    });
  }

  return NextResponse.json({ slot, dispatched: summaries.length, summaries });
}
