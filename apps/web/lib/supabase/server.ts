import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

interface CookieItem {
  name: string;
  value: string;
  options?: CookieOptions;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items: CookieItem[]) {
          try {
            for (const { name, value, options } of items) {
              cookieStore.set({ name, value, ...(options ?? {}) });
            }
          } catch {
            // Called from a Server Component context where cookies are read-only — ignore.
          }
        },
      },
    },
  );
}

export function createSupabaseServiceRoleClient() {
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
