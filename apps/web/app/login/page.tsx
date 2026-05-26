"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "60px auto" }}>
      <div className="card">
        <h1 style={{ marginBottom: 6 }}>Anmelden</h1>
        <p className="muted" style={{ fontSize: "0.88rem", marginBottom: 16 }}>
          Trage deine Email ein — du bekommst einen Magic-Link zum Einloggen.
        </p>
        <form onSubmit={handleSend} className="form-grid">
          <div>
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === "sending" || status === "sent"}
            />
          </div>
          <button
            type="submit"
            className="primary"
            disabled={status === "sending" || status === "sent"}
          >
            {status === "sending"
              ? "Sende…"
              : status === "sent"
                ? "Gesendet ✓"
                : "Magic-Link senden"}
          </button>
        </form>
        {status === "sent" && (
          <div className="banner success" style={{ marginTop: 16, marginBottom: 0 }}>
            Schau in deine Inbox bei <strong>{email}</strong>. Der Link ist 1h gültig.
          </div>
        )}
        {status === "error" && (
          <div
            className="banner"
            style={{
              marginTop: 16,
              marginBottom: 0,
              background: "var(--red-bg)",
              borderColor: "rgba(239, 68, 68, 0.3)",
              color: "var(--red)",
            }}
          >
            Fehler: {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
