import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
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
  const { data: runs } = await supabase
    .from("screening_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1>Screening Runs</h1>
      <p className="subtitle">
        Letzte 50 Runs. Crons feuern Mo-Fr 22:00 UTC (Screening) und 22:30 UTC (Report).
      </p>

      <div className="card" style={{ padding: 0 }}>
        {runs && runs.length > 0 ? (
          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Start</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th className="num">Tickers</th>
                  <th>F&amp;G</th>
                  <th className="num">Dauer</th>
                  <th className="num">In</th>
                  <th className="num">Out</th>
                  <th className="num">Cached</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const statusClass =
                    r.status === "done" ? "green" : r.status === "failed" ? "red" : "yellow";
                  return (
                    <tr key={r.id}>
                      <td className="muted">
                        {new Date(r.started_at).toLocaleString("de-DE")}
                      </td>
                      <td className="muted">{r.trigger}</td>
                      <td>
                        <span className={`pill ${statusClass}`}>{r.status}</span>
                      </td>
                      <td className="num">
                        {r.tickers_ok ?? 0} / {r.tickers_total ?? 0}
                      </td>
                      <td className="muted">
                        {r.fear_greed_value ?? "—"} {r.fear_greed_label ?? ""}
                      </td>
                      <td className="num">
                        {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="num">
                        {r.claude_input_tokens?.toLocaleString() ?? "—"}
                      </td>
                      <td className="num">
                        {r.claude_output_tokens?.toLocaleString() ?? "—"}
                      </td>
                      <td className="num">
                        {r.claude_cached_tokens?.toLocaleString() ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <div className="big-icon">⏳</div>
            Noch keine Runs.
          </div>
        )}
      </div>
    </div>
  );
}
