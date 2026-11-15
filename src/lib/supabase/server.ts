if (typeof window !== "undefined") {
  throw new Error("This module can only be loaded on the server.");
}
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serverSupabaseClient: SupabaseClient | null = null;

/**
 * Returns a server-only Supabase client authenticated via SUPABASE_SERVICE_ROLE_KEY.
 * Strictly forbidden from being imported into or bundled with client components.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  if (!serverSupabaseClient) {
    serverSupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverSupabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
