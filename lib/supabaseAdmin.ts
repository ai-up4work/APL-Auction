// lib/supabaseAdmin.ts
// ─────────────────────────────────────────────────────────────────────────────
// SERVER-ONLY Supabase client, using the service role key.
//
// This is deliberately a sibling file to lib/supabase.ts (not a lib/supabase/
// folder) — a folder and a file sharing the same name at the same path can
// confuse module resolution in some bundler configs, which is the likely
// cause of the "cannot find module '@/lib/supabase/admin'" error.
//
// Never import this from a "use client" component or anything that ships to
// the browser — only from API routes / server actions. The service role key
// bypasses RLS entirely.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role) — never expose it to the client."
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}