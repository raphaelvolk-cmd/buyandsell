import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FearGreedGauge } from "@/components/fear-greed-gauge";
import { SignalBadge } from "@/components/signal-badge";
import { ScoreBar } from "@/components/score-bar";

export const dynamic = "force-dynamic";

async function runScreeningNow() {
  "use server";
  const base = process.env.NEXT_PUBLIC_APP_BASE_URL;
  const cron = process.env.CRON_SECRET;
  if (!base || !cron) return;
  await fetch(`${base}/api/cron/screen?slot=manual`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cron}` },
    cache: "no-store",
  });
  revalidatePath("/");
  revalidatePath("/runs");
  revalidatePath("/watchlist");
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="card">
        <h1>Buy &amp; Sell</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Bitte <Link href="/login">anmelden</Link>, um das Dashboard zu sehen.
        </p>
      </div>
    );
  }

  // First-sign-in: seed default ticker universe (S&P-Top-60 + DAX-40) if empty.
  const { count: tickerCount } = await supabase
    .from("tickers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  let seeded = 0;
  if (tickerCount === 0) {
    const { data: seedResult } = await supabase.rpc("seed_default_universe");
    if (typeof seedResult === "number") seeded = seedResult;
  }
  if (user.email) {
    await supabase
      .from("email_recipients")
      .upsert(
        {
          user_id: user.id,
          email: user.email,
          receives_strong_buy: true,
          receives_daily_report: true,
          active: true,
        },
        { onConflict: "user_id,email", ignoreDuplicates: true },
      );
  }

  // Latest run summary
  const { data: lastRun } = await supabase
    .from("screening_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Active ticker count
  const { count: activeCount } = await supabase
    .from("tickers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  // Portfolio counts + total positions
  const { count: positionCount } = await supabase
    .from("portfolio_positions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Last run evaluations for the highlights
  let topEvals: Array<{
    symbol: string;
    current_price: number;
    signal: string;
    conviction: number;
    score_total: number;
    target_price: number | null;
    stop_loss: number | null;
    thesis: string | null;
  }> = [];
  let strongBuys = 0;
  let buys = 0;
  let sells = 0;
  if (lastRun) {
    const { data: evals } = await supabase
      .from("evaluations")
      .select("symbol,current_price,signal,conviction,score_total,target_price,stop_loss,thesis")
      .eq("run_id", lastRun.id)
      .order("score_total", { ascending: false });
    if (evals) {
      topEvals = evals.slice(0, 5).map((e) => ({
        symbol: e.symbol,
        current_price: Number(e.current_price),
        signal: e.signal,
        conviction: Number(e.conviction ?? 0),
        score_total: Number(e.score_total ?? 0),
        target_price: e.target_price ? Number(e.target_price) : null,
        stop_loss: e.stop_loss ? Number(e.stop_loss) : null,
        thesis: e.thesis,
      }));
      strongBuys = evals.filter((e) => e.signal === "STRONG_BUY").length;
      buys = evals.filter((e) => e.signal === "BUY").length;
      sells = evals.filter((e) => e.signal === "SELL" || e.signal === "STRONG_SELL").length;
    }
  }

  // Portfolio actions from last run
  const { data: portfolioRecs } = lastRun
    ? await supabase
        .from("recommendations")
        .select("symbol,action")
        .eq("run_id", lastRun.id)
        .eq("context", "portfolio")
    : { data: null };
  const adds = (portfolioRecs ?? []).filter((r) => r.action === "ADD").length;
  const portfolioSells = (portfolioRecs ?? []).filter(
    (r) => r.action === "SELL" || r.action === "STRONG_SELL",
  ).length;

  return (
    <div>
      <p className="subtitle">
        Angemeldet als <strong>{user.email}</strong>
        {lastRun && (
          <>
            {" · "}
            Letzter Run {new Date(lastRun.started_at).toLocaleString("de-DE")} ·{" "}
            <Link href="/runs">alle Runs</Link>
          </>
        )}
      </p>

      <div className="disclaimer">
        Diese Analyse dient nur zu Informationszwecken. Keine Anlageberatung. Daten bis zu
        20 Min. verzögert.
      </div>

      {seeded > 0 && (
        <div className="banner success">
          <strong>Willkommen.</strong> {seeded} Tickers wurden in dein Universum geladen
          (S&amp;P-Top-60 + DAX-40). Verwalten unter{" "}
          <Link href="/universe">Universe</Link>.
        </div>
      )}

      {/* Hero: F&G + Run trigger */}
      <div className="hero">
        <FearGreedGauge
          value={lastRun?.fear_greed_value ?? null}
          label={lastRun?.fear_greed_label ?? null}
        />
        <div className="fg-info">
          <div className="fg-label">
            {lastRun?.fear_greed_label ?? "Noch kein Run"}
          </div>
          <div className="fg-rationale">
            {lastRun?.fear_greed_value != null
              ? `CNN Fear & Greed Index · Contrarian: ${lastRun.fear_greed_value <= 25 ? "Extreme Fear = Kaufgelegenheit" : lastRun.fear_greed_value >= 75 ? "Extreme Greed = Vorsicht" : "Markt im neutralen Bereich"}`
              : "Trigger eine Screening-Aufnahme, um Marktstimmung zu erfassen"}
          </div>
        </div>
        <form action={runScreeningNow}>
          <button type="submit" className="run-btn">
            ▶ Neues Screening
          </button>
        </form>
      </div>

      {/* Summary cards */}
      <div className="card-grid">
        <div className="summary-card">
          <div className="label">Aktive Tickers</div>
          <div className="value">{activeCount ?? 0}</div>
          <div className="sub">von {tickerCount ?? 0} im Universum</div>
        </div>
        <div className="summary-card">
          <div className="label">Strong Buys</div>
          <div className="value" style={{ color: "var(--green)" }}>
            {strongBuys}
          </div>
          <div className="sub">letzter Run</div>
        </div>
        <div className="summary-card">
          <div className="label">Buys</div>
          <div className="value" style={{ color: "var(--green)" }}>
            {buys}
          </div>
          <div className="sub">letzter Run</div>
        </div>
        <div className="summary-card">
          <div className="label">Sells</div>
          <div className="value" style={{ color: "var(--red)" }}>
            {sells}
          </div>
          <div className="sub">letzter Run</div>
        </div>
        <div className="summary-card">
          <div className="label">Portfolio</div>
          <div className="value">{positionCount ?? 0}</div>
          <div className="sub">
            {adds > 0 && <span style={{ color: "var(--blue)" }}>{adds} ADD</span>}
            {adds > 0 && portfolioSells > 0 && " · "}
            {portfolioSells > 0 && (
              <span style={{ color: "var(--red)" }}>{portfolioSells} SELL</span>
            )}
            {adds === 0 && portfolioSells === 0 && "alle HOLD"}
          </div>
        </div>
        <div className="summary-card">
          <div className="label">Letzter Run</div>
          <div className="value" style={{ fontSize: "1.05rem" }}>
            {lastRun
              ? lastRun.duration_ms
                ? `${(lastRun.duration_ms / 1000).toFixed(0)}s`
                : "läuft…"
              : "—"}
          </div>
          <div className="sub">
            {lastRun?.claude_input_tokens != null && (
              <>
                {(
                  (lastRun.claude_input_tokens +
                    lastRun.claude_output_tokens +
                    lastRun.claude_cached_tokens) /
                  1000
                ).toFixed(1)}
                k Tokens
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top signals */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px 8px" }}>
          <h2>Top Signale aus dem letzten Run</h2>
        </div>
        {topEvals.length === 0 ? (
          <div className="empty">
            <div className="big-icon">📭</div>
            Noch keine Bewertungen. Klicke oben auf <strong>Neues Screening</strong>.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Kurs</th>
                <th>Signal</th>
                <th className="num">Conv.</th>
                <th>Score</th>
                <th className="num">Target</th>
                <th className="num">Stop</th>
                <th style={{ width: "40%" }}>Thesis</th>
              </tr>
            </thead>
            <tbody>
              {topEvals.map((e) => (
                <tr key={e.symbol}>
                  <td className="symbol-cell">
                    <strong>{e.symbol}</strong>
                  </td>
                  <td className="num">{e.current_price.toFixed(2)}</td>
                  <td>
                    <SignalBadge signal={e.signal} />
                  </td>
                  <td className="num">{(e.conviction * 100).toFixed(0)}%</td>
                  <td>
                    <ScoreBar value={e.score_total} />
                  </td>
                  <td className="num">
                    {e.target_price != null ? e.target_price.toFixed(2) : "—"}
                  </td>
                  <td className="num">
                    {e.stop_loss != null ? e.stop_loss.toFixed(2) : "—"}
                  </td>
                  <td
                    style={{
                      whiteSpace: "normal",
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      maxWidth: 360,
                    }}
                  >
                    {e.thesis ? e.thesis.slice(0, 180) + (e.thesis.length > 180 ? "…" : "") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: "10px 20px", textAlign: "right" }}>
          <Link href="/watchlist" className="muted" style={{ fontSize: "0.8rem" }}>
            Alle Signale anzeigen →
          </Link>
        </div>
      </div>
    </div>
  );
}
