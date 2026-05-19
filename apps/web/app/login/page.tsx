"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid email profile offline_access",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };
  return (
    <div className="card">
      <h1>Sign in</h1>
      <p>Use your Microsoft Entra account to continue.</p>
      <button
        onClick={handleSignIn}
        style={{
          background: "#0f172a",
          color: "white",
          border: 0,
          borderRadius: 6,
          padding: "10px 16px",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Sign in with Microsoft
      </button>
    </div>
  );
}
