import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function addRecipient(formData: FormData) {
  "use server";
  const email = (formData.get("email") as string)?.trim();
  if (!email) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("email_recipients")
    .update({ active: !active })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/settings");
}

async function deleteRecipient(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("email_recipients").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/settings");
}

async function saveSmtp(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const host = (formData.get("smtp_host") as string)?.trim();
  const port = Number(formData.get("smtp_port"));
  const u = (formData.get("smtp_user") as string)?.trim();
  const pw = (formData.get("smtp_password") as string)?.trim();
  const fromAddr = (formData.get("smtp_from_address") as string)?.trim();
  const fromName = (formData.get("smtp_from_name") as string)?.trim();
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
  const [{ data: recipients }, { data: secrets }] = await Promise.all([
    supabase
      .from("email_recipients")
      .select("*")
      .eq("user_id", user.id)
      .order("email"),
    supabase
      .from("user_secrets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div>
      <h1>Settings</h1>
      <p className="subtitle">
        Empfänger, SMTP-Setup, Account-Verwaltung.
      </p>

      <div className="card">
        <h2>Email-Empfänger</h2>
        <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 12 }}>
          Wer bekommt Strong-Buy-Push-Alerts und den abendlichen Tagesreport?
        </p>
        <form action={addRecipient}>
          <div className="form-row">
            <label className="full">
              Email
              <input name="email" type="email" required placeholder="recipient@example.com" />
            </label>
            <button type="submit" className="primary">
              Hinzufügen
            </button>
          </div>
        </form>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Strong-Buy</th>
                <th>Tagesreport</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(recipients ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.receives_strong_buy ? "✓" : "—"}</td>
                  <td>{r.receives_daily_report ? "✓" : "—"}</td>
                  <td>
                    {r.active ? (
                      <span className="pill green">aktiv</span>
                    ) : (
                      <span className="pill slate">pausiert</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <form action={toggleRecipient}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="active" value={String(r.active)} />
                        <button type="submit" className="small">
                          {r.active ? "Pause" : "Aktivieren"}
                        </button>
                      </form>
                      <form action={deleteRecipient}>
                        <input type="hidden" name="id" value={r.id} />
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

      <div className="card">
        <h2>SMTP für ausgehende Alerts</h2>
        <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 12 }}>
          Optional. Passwort verschlüsselt gespeichert. Leer lassen, um Server-SMTP-Vars
          aus Vercel zu nutzen.
        </p>
        <form action={saveSmtp}>
          <div className="form-row">
            <label>
              Host
              <input
                name="smtp_host"
                defaultValue={secrets?.smtp_host ?? ""}
                placeholder="smtp.office365.com"
              />
            </label>
            <label>
              Port
              <input
                name="smtp_port"
                type="number"
                defaultValue={secrets?.smtp_port ?? 587}
              />
            </label>
            <label>
              Username
              <input name="smtp_user" defaultValue={secrets?.smtp_user ?? ""} />
            </label>
            <label>
              Passwort
              <input
                name="smtp_password"
                type="password"
                placeholder={
                  secrets?.smtp_password ? "•••••• (gesetzt, leer = behalten)" : ""
                }
              />
            </label>
            <label>
              Absender-Adresse
              <input
                name="smtp_from_address"
                defaultValue={secrets?.smtp_from_address ?? ""}
                placeholder="alerts@example.com"
              />
            </label>
            <label>
              Absender-Name
              <input
                name="smtp_from_name"
                defaultValue={secrets?.smtp_from_name ?? "Buy & Sell"}
              />
            </label>
            <div className="full">
              <button type="submit" className="primary">
                SMTP speichern
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Account</h2>
        <p style={{ fontSize: "0.9rem" }}>
          Angemeldet als <strong>{user.email}</strong>
        </p>
        <form action="/auth/signout" method="post" style={{ marginTop: 8 }}>
          <button type="submit" className="small">
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}
