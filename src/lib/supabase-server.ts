import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service_role key.
 * Returns null when Supabase is not configured so the app can fall back to a
 * local JSON-file store and remain fully functional in the sandbox.
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    client = null;
    return null;
  }
  try {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return client;
  } catch (e) {
    console.error("Failed to init Supabase client:", e);
    client = null;
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
