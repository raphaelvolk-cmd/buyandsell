import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="card">
        <h1>Buy &amp; Sell Tool</h1>
        <p>Please <a href="/login">sign in with Microsoft Entra</a> to continue.</p>
      </div>
    );
  }

  const { data: lastRun } = await supabase
    .from("screening_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recs } = await supabase
    .from("recommendations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="muted">Signed in as {user.email}</p>

      <section className="card">
        <h2>Last screening run</h2>
        {lastRun ? (
          <div>
            <div>Started: {new Date(lastRun.started_at).toLocaleString()}</div>
            <div>Status: {lastRun.status}</div>
            <div>
              Fear &amp; Greed: {lastRun.fear_greed_value ?? "—"} (
              {lastRun.fear_greed_label ?? "—"})
            </div>
            <div>
              Tickers: {lastRun.tickers_ok ?? 0} ok / {lastRun.tickers_failed ?? 0} failed of{" "}
              {lastRun.tickers_total ?? 0}
            </div>
          </div>
        ) : (
          <p className="muted">No runs yet. The first cron tick will create one.</p>
        )}
      </section>

      <section className="card">
        <h2>Latest recommendations</h2>
        {recs && recs.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Action</th>
                <th>Context</th>
                <th>Target</th>
                <th>Stop</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => (
                <tr key={r.id}>
                  <td>{r.symbol}</td>
                  <td>
                    <span className={`pill ${actionPill(r.action)}`}>
                      {r.action.replace("_", " ")}
                    </span>
                  </td>
                  <td>{r.context}</td>
                  <td>{r.target_price?.toFixed(2) ?? "—"}</td>
                  <td>{r.stop_loss?.toFixed(2) ?? "—"}</td>
                  <td>{r.rationale?.slice(0, 100) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No recommendations yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Navigation</h2>
        <ul>
          <li><a href="/portfolio">Portfolio (manual positions)</a></li>
          <li><a href="/watchlist">Watchlist signals</a></li>
          <li><a href="/universe">Universe (tickers)</a></li>
          <li><a href="/settings">Settings (recipients, SMTP, API keys)</a></li>
        </ul>
      </section>
    </div>
  );
}

function actionPill(action: string): string {
  if (action === "STRONG_BUY" || action === "BUY") return "green";
  if (action === "ADD") return "blue";
  if (action === "SELL") return "red";
  return "slate";
}
