import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WatchlistTable, type EvaluationRow } from "@/components/watchlist-table";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="card">
        <p>
          Bitte <a href="/login">anmelden</a>.
        </p>
      </div>
    );
  }

  const { data: lastRun } = await supabase
    .from("screening_runs")
    .select("id, started_at, fear_greed_value, fear_greed_label")
    .eq("user_id", user.id)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let rows: EvaluationRow[] = [];
  if (lastRun) {
    const { data: evals } = await supabase
      .from("evaluations")
      .select(
        "id,symbol,current_price,signal,conviction,score_total,score_technical,score_fundamental,score_sentiment,rsi,macd,macd_signal,bb_position,sma50,sma200,atr,fib_support,fib_resistance,target_price,stop_loss,thesis,risks,catalysts",
      )
      .eq("run_id", lastRun.id)
      .order("score_total", { ascending: false });
    if (evals) {
      rows = evals.map((e) => ({
        id: e.id,
        symbol: e.symbol,
        current_price: Number(e.current_price),
        signal: e.signal,
        conviction: Number(e.conviction ?? 0),
        score_total: Number(e.score_total ?? 0),
        score_technical: Number(e.score_technical ?? 0),
        score_fundamental: Number(e.score_fundamental ?? 0),
        score_sentiment: Number(e.score_sentiment ?? 0),
        rsi: e.rsi != null ? Number(e.rsi) : null,
        macd: e.macd != null ? Number(e.macd) : null,
        macd_signal: e.macd_signal != null ? Number(e.macd_signal) : null,
        bb_position: e.bb_position != null ? Number(e.bb_position) : null,
        sma50: e.sma50 != null ? Number(e.sma50) : null,
        sma200: e.sma200 != null ? Number(e.sma200) : null,
        atr: e.atr != null ? Number(e.atr) : null,
        fib_support: e.fib_support != null ? Number(e.fib_support) : null,
        fib_resistance: e.fib_resistance != null ? Number(e.fib_resistance) : null,
        target_price: e.target_price != null ? Number(e.target_price) : null,
        stop_loss: e.stop_loss != null ? Number(e.stop_loss) : null,
        thesis: e.thesis,
        risks: e.risks,
        catalysts: e.catalysts,
      }));
    }
  }

  return (
    <div>
      <h1>Watchlist</h1>
      <p className="subtitle">
        Alle Bewertungen aus dem letzten erfolgreichen Run
        {lastRun &&
          ` · ${new Date(lastRun.started_at).toLocaleString("de-DE")} · F&G ${lastRun.fear_greed_value} (${lastRun.fear_greed_label})`}
        . Klicke eine Zeile für Details.
      </p>

      {rows.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="big-icon">📭</div>
            Noch keine Bewertungen. Starte ein Screening vom <a href="/">Dashboard</a>.
          </div>
        </div>
      ) : (
        <WatchlistTable rows={rows} />
      )}
    </div>
  );
}
