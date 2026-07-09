// lib/supabse.ts
// ─────────────────────────────────────────────────────────────────────────────
// Singleton Supabase browser client.
// Add your credentials to .env.local (never commit that file).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
    "Add them to .env.local — see .env.local.example."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon);