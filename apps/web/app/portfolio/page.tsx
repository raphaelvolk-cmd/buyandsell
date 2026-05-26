import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { SignalBadge } from "@/components/signal-badge";

export const dynamic = "force-dynamic";

async function addPosition(formData: FormData) {
  "use server";
  const symbol = (formData.get("symbol") as string)?.trim().toUpperCase();
  const shares = Number(formData.get("shares"));
  const cost = Number(formData.get("cost_basis"));
  const currency = ((formData.get("currency") as string) || "USD").trim().toUpperCase();
  const boughtAtRaw = (formData.get("bought_at") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!symbol || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(cost) || cost < 0)
    return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("portfolio_positions").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/portfolio");
}

export default async function PortfolioPage() {
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
  const { data: positions } = await supabase
    .from("portfolio_positions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: portfolioRecs } = await supabase
    .from("recommendations")
    .select("*")
    .eq("user_id", user.id)
    .eq("context", "portfolio")
    .order("created_at", { ascending: false })
    .limit(100);

  const recBySymbol = new Map<
    string,
    {
      action: string;
      rationale: string | null;
      target_price: number | null;
      stop_loss: number | null;
    }
  >();
  for (const r of portfolioRecs ?? []) {
    if (!recBySymbol.has(r.symbol)) {
      recBySymbol.set(r.symbol, {
        action: r.action,
        rationale: r.rationale,
        target_price: r.target_price,
        stop_loss: r.stop_loss,
      });
    }
  }

  return (
    <div>
      <h1>Portfolio</h1>
      <p className="subtitle">
        Manuelle Positionen. Bei jedem Screening-Run wird pro Position eine HOLD/SELL/ADD
        Empfehlung berechnet.
      </p>

      <div className="card">
        <h2>Position hinzufügen</h2>
        <form action={addPosition}>
          <div className="form-row">
            <label>
              Symbol
              <input name="symbol" required placeholder="AAPL" />
            </label>
            <label>
              Stückzahl
              <input name="shares" type="number" min="0" step="0.0001" required placeholder="10" />
            </label>
            <label>
              Einstandskurs
              <input
                name="cost_basis"
                type="number"
                min="0"
                step="0.0001"
                required
                placeholder="180.50"
              />
            </label>
            <label>
              Währung
              <input name="currency" defaultValue="USD" />
            </label>
            <label>
              Kaufdatum
              <input name="bought_at" type="date" />
            </label>
            <button type="submit" className="primary">
              Hinzufügen
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px 8px" }}>
          <h2>Positionen ({positions?.length ?? 0})</h2>
        </div>
        {positions && positions.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Stück</th>
                <th className="num">Einstand</th>
                <th>Währung</th>
                <th>Kaufdatum</th>
                <th>Letzte Aktion</th>
                <th className="num">Target</th>
                <th className="num">Stop</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const rec = recBySymbol.get(p.symbol);
                return (
                  <tr key={p.id}>
                    <td className="symbol-cell">
                      <strong>{p.symbol}</strong>
                    </td>
                    <td className="num">{Number(p.shares).toFixed(4)}</td>
                    <td className="num">{Number(p.cost_basis).toFixed(2)}</td>
                    <td>{p.currency}</td>
                    <td className="muted">{p.bought_at ?? "—"}</td>
                    <td>
                      {rec ? (
                        <SignalBadge signal={rec.action} />
                      ) : (
                        <span className="pill slate">noch kein Run</span>
                      )}
                    </td>
                    <td className="num">
                      {rec?.target_price != null ? Number(rec.target_price).toFixed(2) : "—"}
                    </td>
                    <td className="num">
                      {rec?.stop_loss != null ? Number(rec.stop_loss).toFixed(2) : "—"}
                    </td>
                    <td>
                      <form action={deletePosition}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="danger small">
                          Löschen
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <div className="big-icon">💼</div>
            Noch keine Positionen. Lege oben deine erste Position an.
          </div>
        )}
      </div>
    </div>
  );
}
