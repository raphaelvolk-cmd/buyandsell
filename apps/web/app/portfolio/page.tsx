import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function addPosition(formData: FormData) {
  "use server";
  const symbol = (formData.get("symbol") as string)?.trim().toUpperCase();
  const shares = Number(formData.get("shares"));
  const cost = Number(formData.get("cost_basis"));
  const currency = ((formData.get("currency") as string) || "USD").trim().toUpperCase();
  const boughtAtRaw = (formData.get("bought_at") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!symbol || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(cost) || cost < 0) return;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("portfolio_positions").insert({
    user_id: user.id,
    symbol,
    shares,
    cost_basis: cost,
    currency,
    bought_at: boughtAtRaw || null,
    notes,
  });
  revalidatePath("/portfolio");
}

async function deletePosition(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("portfolio_positions").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/portfolio");
}

export default async function PortfolioPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="card"><p>Please <a href="/login">sign in</a>.</p></div>;
  }
  const { data: positions } = await supabase
    .from("portfolio_positions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Latest portfolio recommendations to overlay
  const { data: portfolioRecs } = await supabase
    .from("recommendations")
    .select("*")
    .eq("user_id", user.id)
    .eq("context", "portfolio")
    .order("created_at", { ascending: false })
    .limit(50);

  const recBySymbol = new Map<string, { action: string; rationale: string | null; target_price: number | null; stop_loss: number | null }>();
  for (const r of portfolioRecs ?? []) {
    if (!recBySymbol.has(r.symbol)) {
      recBySymbol.set(r.symbol, { action: r.action, rationale: r.rationale, target_price: r.target_price, stop_loss: r.stop_loss });
    }
  }

  return (
    <div>
      <p><Link href="/">← Back to dashboard</Link></p>
      <h1>Portfolio</h1>

      <section className="card">
        <h2>Add position</h2>
        <form action={addPosition} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, alignItems: "end" }}>
          <label>Symbol<input name="symbol" required placeholder="AAPL" style={inputStyle} /></label>
          <label>Shares<input name="shares" type="number" min="0" step="0.0001" required style={inputStyle} /></label>
          <label>Cost basis<input name="cost_basis" type="number" min="0" step="0.0001" required style={inputStyle} /></label>
          <label>Currency<input name="currency" defaultValue="USD" style={inputStyle} /></label>
          <label>Bought<input name="bought_at" type="date" style={inputStyle} /></label>
          <button type="submit" style={btnStyle}>Add</button>
        </form>
        <p className="muted" style={{ marginTop: 8 }}>Notes can be added later by editing the row directly in Supabase (UI in v2).</p>
      </section>

      <section className="card">
        <h2>Positions ({positions?.length ?? 0})</h2>
        {positions && positions.length > 0 ? (
          <table>
            <thead><tr><th>Symbol</th><th>Shares</th><th>Cost</th><th>Currency</th><th>Bought</th><th>Latest action</th><th>Target</th><th>Stop</th><th></th></tr></thead>
            <tbody>
              {positions.map((p) => {
                const rec = recBySymbol.get(p.symbol);
                return (
                  <tr key={p.id}>
                    <td><strong>{p.symbol}</strong></td>
                    <td>{Number(p.shares).toFixed(4)}</td>
                    <td>{Number(p.cost_basis).toFixed(2)}</td>
                    <td>{p.currency}</td>
                    <td>{p.bought_at ?? "—"}</td>
                    <td>{rec ? <span className={`pill ${actionPill(rec.action)}`}>{rec.action}</span> : <span className="pill slate">no run yet</span>}</td>
                    <td>{rec?.target_price?.toFixed(2) ?? "—"}</td>
                    <td>{rec?.stop_loss?.toFixed(2) ?? "—"}</td>
                    <td>
                      <form action={deletePosition}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" style={{ ...btnStyle, background: "#fee2e2", color: "#b91c1c" }}>Delete</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">No positions yet. Add one above to start tracking.</p>
        )}
      </section>
    </div>
  );
}

function actionPill(action: string): string {
  if (action === "ADD") return "blue";
  if (action === "SELL") return "red";
  if (action === "HOLD") return "slate";
  return "green";
}

const inputStyle = { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, width: "100%" };
const btnStyle = { background: "#0f172a", color: "white", border: 0, borderRadius: 6, padding: "8px 14px", fontSize: 14, cursor: "pointer", height: 36 };
