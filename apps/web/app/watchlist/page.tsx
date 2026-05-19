import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

function pill(action: string) {
  if (action === "STRONG_BUY") return "green";
  if (action === "BUY") return "green";
  if (action === "ADD") return "blue";
  if (action === "SELL" || action === "STRONG_SELL") return "red";
  return "slate";
}

export default async function WatchlistPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="card">
        <p>Please <a href="/login">sign in</a>.</p>
      </div>
    );
  }

  // Latest evaluation per symbol from the most recent run for the user.
  const { data: latestRun } = await supabase
    .from("screening_runs")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: evals } = latestRun
    ? await supabase
        .from("evaluations")
        .select("*")
        .eq("run_id", latestRun.id)
        .order("score_total", { ascending: false })
    : { data: null };

  const buys = (evals ?? []).filter((e) => e.signal === "STRONG_BUY" || e.signal === "BUY");
  const sells = (evals ?? []).filter((e) => e.signal === "SELL" || e.signal === "STRONG_SELL");

  return (
    <div>
      <p><Link href="/">← Back to dashboard</Link></p>
      <h1>Watchlist</h1>

      <section className="card">
        <h2>Buy signals ({buys.length})</h2>
        {buys.length > 0 ? (
          <table>
            <thead><tr><th>Symbol</th><th>Price</th><th>Signal</th><th>Conviction</th><th>Score</th><th>Target</th><th>Stop</th><th>RSI</th><th>Thesis</th></tr></thead>
            <tbody>
              {buys.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.symbol}</strong></td>
                  <td>{e.current_price?.toFixed(2)}</td>
                  <td><span className={`pill ${pill(e.signal)}`}>{e.signal?.replace("_", " ")}</span></td>
                  <td>{e.conviction ? (Number(e.conviction) * 100).toFixed(0) + "%" : "—"}</td>
                  <td>{e.score_total?.toFixed(2)}</td>
                  <td>{e.target_price?.toFixed(2) ?? "—"}</td>
                  <td>{e.stop_loss?.toFixed(2) ?? "—"}</td>
                  <td>{e.rsi?.toFixed(1) ?? "—"}</td>
                  <td style={{ maxWidth: 360, fontSize: "0.8rem" }}>{e.thesis?.slice(0, 200) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No buy signals yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Sell signals ({sells.length})</h2>
        {sells.length > 0 ? (
          <table>
            <thead><tr><th>Symbol</th><th>Price</th><th>Signal</th><th>Conviction</th><th>RSI</th><th>Thesis</th></tr></thead>
            <tbody>
              {sells.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.symbol}</strong></td>
                  <td>{e.current_price?.toFixed(2)}</td>
                  <td><span className={`pill ${pill(e.signal)}`}>{e.signal?.replace("_", " ")}</span></td>
                  <td>{e.conviction ? (Number(e.conviction) * 100).toFixed(0) + "%" : "—"}</td>
                  <td>{e.rsi?.toFixed(1) ?? "—"}</td>
                  <td style={{ maxWidth: 360, fontSize: "0.8rem" }}>{e.thesis?.slice(0, 200) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No sell signals yet.</p>
        )}
      </section>
    </div>
  );
}
