import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
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
  const { data: runs } = await supabase
    .from("screening_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <p><Link href="/">← Back to dashboard</Link></p>
      <h1>Screening runs</h1>
      <p className="muted">Last 50 runs with token usage + duration.</p>
      <section className="card">
        {runs && runs.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Tickers</th>
                <th>F&amp;G</th>
                <th>Duration</th>
                <th>In tokens</th>
                <th>Out tokens</th>
                <th>Cached</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.started_at).toLocaleString()}</td>
                  <td>{r.trigger}</td>
                  <td>
                    <span className={`pill ${r.status === "done" ? "green" : r.status === "failed" ? "red" : "slate"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.tickers_ok ?? 0} / {r.tickers_total ?? 0}</td>
                  <td>{r.fear_greed_value ?? "—"} {r.fear_greed_label ?? ""}</td>
                  <td>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
                  <td>{r.claude_input_tokens?.toLocaleString() ?? "—"}</td>
                  <td>{r.claude_output_tokens?.toLocaleString() ?? "—"}</td>
                  <td>{r.claude_cached_tokens?.toLocaleString() ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No runs yet. Trigger one from the dashboard.</p>
        )}
      </section>
    </div>
  );
}
