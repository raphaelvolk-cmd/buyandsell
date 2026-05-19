import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function toggleActive(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("tickers").update({ active: !active }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/universe");
}

async function addTicker(formData: FormData) {
  "use server";
  const symbol = (formData.get("symbol") as string)?.trim().toUpperCase();
  const exchange = (formData.get("exchange") as string)?.trim() || null;
  const name = (formData.get("name") as string)?.trim() || null;
  if (!symbol) return;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("tickers").upsert({
    user_id: user.id, symbol, exchange, name, group_tag: "custom", active: true,
  }, { onConflict: "user_id,symbol" });
  revalidatePath("/universe");
}

async function deleteTicker(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("tickers").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/universe");
}

export default async function UniversePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="card"><p>Please <a href="/login">sign in</a>.</p></div>;
  }
  const { data: tickers } = await supabase
    .from("tickers")
    .select("*")
    .eq("user_id", user.id)
    .order("group_tag")
    .order("symbol");

  const active = (tickers ?? []).filter((t) => t.active).length;
  const total = tickers?.length ?? 0;

  return (
    <div>
      <p><Link href="/">← Back to dashboard</Link></p>
      <h1>Universe</h1>
      <p className="muted">{active} active of {total} total tickers.</p>

      <section className="card">
        <h2>Add custom ticker</h2>
        <form action={addTicker} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="symbol" placeholder="Symbol (e.g. PLTR or SAP.DE)" required style={inputStyle} />
          <input name="name" placeholder="Name (optional)" style={inputStyle} />
          <input name="exchange" placeholder="Exchange (optional)" style={inputStyle} />
          <button type="submit" style={btnStyle}>Add</button>
        </form>
      </section>

      <section className="card">
        <h2>All tickers</h2>
        <table>
          <thead><tr><th>Symbol</th><th>Name</th><th>Exchange</th><th>Group</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {(tickers ?? []).map((t) => (
              <tr key={t.id}>
                <td><strong>{t.symbol}</strong></td>
                <td>{t.name ?? "—"}</td>
                <td>{t.exchange ?? "—"}</td>
                <td><span className="pill slate">{t.group_tag ?? "—"}</span></td>
                <td>{t.active ? <span className="pill green">active</span> : <span className="pill slate">paused</span>}</td>
                <td style={{ display: "flex", gap: 4 }}>
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="active" value={String(t.active)} />
                    <button type="submit" style={smallBtn}>{t.active ? "Pause" : "Resume"}</button>
                  </form>
                  <form action={deleteTicker}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" style={{ ...smallBtn, background: "#fee2e2", color: "#b91c1c" }}>Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const inputStyle = { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, flex: "1 1 auto", minWidth: 120 };
const btnStyle = { background: "#0f172a", color: "white", border: 0, borderRadius: 6, padding: "8px 14px", fontSize: 14, cursor: "pointer" };
const smallBtn = { background: "#f1f5f9", color: "#475569", border: 0, borderRadius: 4, padding: "4px 8px", fontSize: 12, cursor: "pointer" };
