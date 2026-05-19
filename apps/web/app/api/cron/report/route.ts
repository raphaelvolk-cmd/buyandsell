import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { dispatchDailyReport, type DailyReportContext, type RecommendationRow, type SmtpConfig } from "@bst/email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

  const supabase = createSupabaseServiceRoleClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // All users with any recipients flagged for daily report
  const { data: recipientRows, error: recErr } = await supabase
    .from("email_recipients")
    .select("user_id, email")
    .eq("active", true)
    .eq("receives_daily_report", true);
  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });

  const grouped = new Map<string, string[]>();
  for (const r of recipientRows ?? []) {
    const arr = grouped.get(r.user_id as string) ?? [];
    arr.push(r.email as string);
    grouped.set(r.user_id as string, arr);
  }

  const fallbackSmtp = resolveFallbackSmtp();
  const dashboardBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;
  const summaries: Array<Record<string, unknown>> = [];

  for (const [userId, emails] of grouped) {
    // Latest run for F&G + run count
    const { data: runs } = await supabase
      .from("screening_runs")
      .select("fear_greed_value, fear_greed_label")
      .eq("user_id", userId)
      .gte("started_at", since)
      .order("started_at", { ascending: false });
    const runCount = runs?.length ?? 0;
    const fgValue = runs?.[0]?.fear_greed_value ?? 50;
    const fgLabel = runs?.[0]?.fear_greed_label ?? "Neutral";

    // 24h recommendations grouped by context
    const { data: recs } = await supabase
      .from("recommendations")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    const watchlist: RecommendationRow[] = [];
    const portfolio: RecommendationRow[] = [];
    for (const r of recs ?? []) {
      const row: RecommendationRow = {
        symbol: r.symbol as string,
        current_price: 0,
        currency: "USD",
        action: r.action as RecommendationRow["action"],
        context: r.context as RecommendationRow["context"],
        rationale: r.rationale as string | undefined,
        target_price: r.target_price as number | undefined,
        stop_loss: r.stop_loss as number | undefined,
      };
      if (r.context === "portfolio") portfolio.push(row);
      else watchlist.push(row);
    }

    // Enrich with current_price from latest evaluation
    const symbols = Array.from(new Set([...watchlist, ...portfolio].map((r) => r.symbol)));
    if (symbols.length > 0) {
      const { data: evals } = await supabase
        .from("evaluations")
        .select("symbol, current_price")
        .eq("user_id", userId)
        .gte("created_at", since)
        .in("symbol", symbols)
        .order("created_at", { ascending: false });
      const priceBySymbol = new Map<string, number>();
      for (const e of evals ?? []) {
        if (!priceBySymbol.has(e.symbol as string)) {
          priceBySymbol.set(e.symbol as string, Number(e.current_price));
        }
      }
      for (const r of watchlist) r.current_price = priceBySymbol.get(r.symbol) ?? 0;
      for (const r of portfolio) r.current_price = priceBySymbol.get(r.symbol) ?? 0;
    }

    const ctx: DailyReportContext = {
      date: today,
      fear_greed_value: fgValue,
      fear_greed_label: fgLabel,
      run_count: runCount,
      rows_watchlist: watchlist,
      rows_portfolio: portfolio,
    };
    if (dashboardBaseUrl) ctx.dashboard_link = dashboardBaseUrl;

    // Resolve SMTP (per-user secrets > env fallback)
    const { data: secrets } = await supabase
      .from("user_secrets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const smtp = resolveSmtp(secrets, fallbackSmtp);
    if (!smtp) {
      summaries.push({ user_id: userId, error: "no_smtp_configured" });
      continue;
    }
    const dispatch = await dispatchDailyReport(smtp, emails, ctx);
    summaries.push({
      user_id: userId,
      recipients: emails.length,
      watchlist_signals: watchlist.length,
      portfolio_actions: portfolio.length,
      dispatch_ok: dispatch.ok,
      error: dispatch.error,
    });
  }
  return NextResponse.json({ date: today, user_count: grouped.size, summaries });
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

interface SecretsRow {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_from_address: string | null;
  smtp_from_name: string | null;
}

function resolveSmtp(
  secrets: SecretsRow | null,
  fallback?: SmtpConfig,
): SmtpConfig | undefined {
  if (secrets?.smtp_host && secrets.smtp_port && secrets.smtp_from_address) {
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
