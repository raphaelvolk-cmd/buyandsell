import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function toggleActive(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("tickers")
    .update({ active: !active })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/universe");
}

async function addTicker(formData: FormData) {
  "use server";
  const symbol = (formData.get("symbol") as string)?.trim().toUpperCase();
  const exchange = (formData.get("exchange") as string)?.trim() || null;
  const name = (formData.get("name") as string)?.trim() || null;
  if (!symbol) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("tickers").upsert(
    {
      user_id: user.id,
      symbol,
      exchange,
      name,
      group_tag: "custom",
      active: true,
    },
    { onConflict: "user_id,symbol" },
  );
  revalidatePath("/universe");
}

async function deleteTicker(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("tickers").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/universe");
}

export default async function UniversePage() {
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
  const { data: tickers } = await supabase
    .from("tickers")
    .select("*")
    .eq("user_id", user.id)
    .order("group_tag")
    .order("symbol");

  const active = (tickers ?? []).filter((t) => t.active).length;
  const total = tickers?.length ?? 0;
  const groups = new Map<string, number>();
  for (const t of tickers ?? []) {
    const g = (t.group_tag ?? "custom") as string;
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }

  return (
    <div>
      <h1>Universe</h1>
      <p className="subtitle">
        {active} aktive von {total} Tickers · {Array.from(groups.entries())
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ")}
      </p>

      <div className="banner warn">
        <strong>Hobby-Tier Limit:</strong> Aktuell laufen Screenings zuverlässig mit ~30
        aktiven Tickern (60s Function-Limit). Für mehr, Vercel Pro nutzen oder Tickers
        unten pausieren.
      </div>

      <div className="card">
        <h2>Custom Ticker hinzufügen</h2>
        <form action={addTicker}>
          <div className="form-row">
            <label>
              Symbol
              <input name="symbol" placeholder="PLTR oder SAP.DE" required />
            </label>
            <label>
              Name (optional)
              <input name="name" placeholder="Palantir Technologies" />
            </label>
            <label>
              Exchange (optional)
              <input name="exchange" placeholder="NYSE" />
            </label>
            <button type="submit" className="primary">
              Hinzufügen
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px 8px" }}>
          <h2>Alle Tickers</h2>
        </div>
        <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Exchange</th>
                <th>Gruppe</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(tickers ?? []).map((t) => (
                <tr key={t.id}>
                  <td className="symbol-cell">
                    <strong>{t.symbol}</strong>
                  </td>
                  <td>{t.name ?? "—"}</td>
                  <td className="muted">{t.exchange ?? "—"}</td>
                  <td>
                    <span className="pill slate">{t.group_tag ?? "—"}</span>
                  </td>
                  <td>
                    {t.active ? (
                      <span className="pill green">aktiv</span>
                    ) : (
                      <span className="pill slate">pausiert</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <form action={toggleActive}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="active" value={String(t.active)} />
                        <button type="submit" className="small">
                          {t.active ? "Pause" : "Aktivieren"}
                        </button>
                      </form>
                      <form action={deleteTicker}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="danger small">
                          Löschen
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
