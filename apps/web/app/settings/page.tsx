import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function addRecipient(formData: FormData) {
  "use server";
  const email = (formData.get("email") as string)?.trim();
  if (!email) return;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("email_recipients").upsert(
    {
      user_id: user.id,
      email,
      receives_strong_buy: true,
      receives_daily_report: true,
      active: true,
    },
    { onConflict: "user_id,email" },
  );
  revalidatePath("/settings");
}

async function toggleRecipient(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("email_recipients").update({ active: !active }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/settings");
}

async function deleteRecipient(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("email_recipients").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/settings");
}

async function saveSmtp(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const host = (formData.get("smtp_host") as string)?.trim();
  const port = Number(formData.get("smtp_port"));
  const u = (formData.get("smtp_user") as string)?.trim();
  const pw = (formData.get("smtp_password") as string)?.trim();
  const fromAddr = (formData.get("smtp_from_address") as string)?.trim();
  const fromName = (formData.get("smtp_from_name") as string)?.trim();
  // Only update fields that were provided (so password isn't cleared if left blank)
  const patch: Record<string, unknown> = { user_id: user.id };
  if (host) patch.smtp_host = host;
  if (Number.isFinite(port) && port > 0) patch.smtp_port = port;
  if (u) patch.smtp_user = u;
  if (pw) patch.smtp_password = pw;
  if (fromAddr) patch.smtp_from_address = fromAddr;
  if (fromName) patch.smtp_from_name = fromName;
  await supabase.from("user_secrets").upsert(patch, { onConflict: "user_id" });
  revalidatePath("/settings");
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="card"><p>Please <a href="/login">sign in</a>.</p></div>;
  }
  const [{ data: recipients }, { data: secrets }] = await Promise.all([
    supabase.from("email_recipients").select("*").eq("user_id", user.id).order("email"),
    supabase.from("user_secrets").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <div>
      <p><Link href="/">← Back to dashboard</Link></p>
      <h1>Settings</h1>

      <section className="card">
        <h2>Email recipients</h2>
        <p className="muted">Addresses that receive strong-buy push alerts and the daily report.</p>
        <form action={addRecipient} style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input name="email" type="email" required placeholder="recipient@example.com" style={inputStyle} />
          <button type="submit" style={btnStyle}>Add</button>
        </form>
        <table style={{ marginTop: 16 }}>
          <thead><tr><th>Email</th><th>Strong-buy</th><th>Daily report</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(recipients ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.email}</td>
                <td>{r.receives_strong_buy ? "yes" : "no"}</td>
                <td>{r.receives_daily_report ? "yes" : "no"}</td>
                <td>{r.active ? <span className="pill green">active</span> : <span className="pill slate">paused</span>}</td>
                <td style={{ display: "flex", gap: 4 }}>
                  <form action={toggleRecipient}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="active" value={String(r.active)} />
                    <button type="submit" style={smallBtn}>{r.active ? "Pause" : "Resume"}</button>
                  </form>
                  <form action={deleteRecipient}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" style={{ ...smallBtn, background: "#fee2e2", color: "#b91c1c" }}>Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>SMTP for outgoing alerts</h2>
        <p className="muted">
          Leave blank to rely on the server-wide SMTP env vars. Per-user settings override.
          Password is stored encrypted at rest by Supabase.
        </p>
        <form action={saveSmtp} style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          <label>Host<input name="smtp_host" defaultValue={secrets?.smtp_host ?? ""} placeholder="smtp.office365.com" style={inputStyle} /></label>
          <label>Port<input name="smtp_port" type="number" defaultValue={secrets?.smtp_port ?? 587} style={inputStyle} /></label>
          <label>Username<input name="smtp_user" defaultValue={secrets?.smtp_user ?? ""} style={inputStyle} /></label>
          <label>Password<input name="smtp_password" type="password" placeholder={secrets?.smtp_password ? "•••••• (set, leave blank to keep)" : ""} style={inputStyle} /></label>
          <label>From address<input name="smtp_from_address" defaultValue={secrets?.smtp_from_address ?? ""} placeholder="alerts@example.com" style={inputStyle} /></label>
          <label>From name<input name="smtp_from_name" defaultValue={secrets?.smtp_from_name ?? "Buy & Sell Tool"} style={inputStyle} /></label>
          <button type="submit" style={{ ...btnStyle, gridColumn: "1 / -1" }}>Save SMTP</button>
        </form>
      </section>

      <section className="card">
        <h2>Account</h2>
        <p>Signed in as <strong>{user.email}</strong></p>
        <form action="/auth/signout" method="post">
          <button type="submit" style={smallBtn}>Sign out</button>
        </form>
      </section>
    </div>
  );
}

const inputStyle = { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, width: "100%" };
const btnStyle = { background: "#0f172a", color: "white", border: 0, borderRadius: 6, padding: "8px 14px", fontSize: 14, cursor: "pointer" };
const smallBtn = { background: "#f1f5f9", color: "#475569", border: 0, borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer" };
