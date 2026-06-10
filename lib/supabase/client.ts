import { createClient } from "@supabase/supabase-js";

export function createBrowserSupabaseClient() {
  const client = createOptionalBrowserSupabaseClient();

  if (!client) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return client;
}

export function createOptionalBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}
