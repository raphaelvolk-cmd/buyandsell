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
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="card">
      <h1>Sign in</h1>
      <p>Enter your email — we&apos;ll send you a one-click sign-in link.</p>
      <form onSubmit={handleSend} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={status === "sending" || status === "sent"}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={status === "sending" || status === "sent"}
          style={{
            background: status === "sent" ? "#16a34a" : "#0f172a",
            color: "white",
            border: 0,
            borderRadius: 6,
            padding: "10px 16px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {status === "sending" ? "Sending…" : status === "sent" ? "Sent ✓" : "Send link"}
        </button>
      </form>
      {status === "sent" && (
        <p style={{ marginTop: 12, color: "#15803d" }}>
          Check your inbox at <strong>{email}</strong>. The link expires in 1 hour.
        </p>
      )}
      {status === "error" && (
        <p style={{ marginTop: 12, color: "#dc2626" }}>Error: {errorMsg}</p>
      )}
    </div>
  );
}
