import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { runScreening } from "@/lib/screening/orchestrator";
import type { SmtpConfig } from "@bst/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const supabase = createSupabaseServiceRoleClient();
  const { data: users, error } = await supabase
    .from("tickers")
    .select("user_id")
    .eq("active", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const userIds = Array.from(new Set((users ?? []).map((u) => u.user_id as string)));

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!anthropicApiKey) {
    return NextResponse.json({ error: "missing_anthropic_api_key" }, { status: 500 });
  }
  const fallbackSmtp = resolveFallbackSmtp();
  const dashboardBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

  const summaries = [];
  for (const userId of userIds) {
    const opts: Parameters<typeof runScreening>[1] = {
      userId,
      slot,
      anthropicApiKey,
    };
    if (fallbackSmtp) opts.fallbackSmtp = fallbackSmtp;
    if (dashboardBaseUrl) opts.dashboardBaseUrl = dashboardBaseUrl;
    const summary = await runScreening(supabase, opts);
    summaries.push(summary);
  }

  return NextResponse.json({ slot, user_count: userIds.length, summaries });
}

function resolveFallbackSmtp(): SmtpConfig | undefined {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const fromAddr = process.env.SMTP_FROM_ADDRESS;
  if (!host || !port || !fromAddr) return undefined;
  const cfg: SmtpConfig = {
    host,
    port: Number(port),
    from_address: fromAddr,
  };
  if (process.env.SMTP_USER) cfg.user = process.env.SMTP_USER;
  if (process.env.SMTP_PASSWORD) cfg.password = process.env.SMTP_PASSWORD;
  if (process.env.SMTP_FROM_NAME) cfg.from_name = process.env.SMTP_FROM_NAME;
  return cfg;
}
