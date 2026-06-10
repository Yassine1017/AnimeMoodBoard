import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserSupabaseClient: SupabaseClient | null | undefined;

export function createBrowserSupabaseClient() {
  const client = createOptionalBrowserSupabaseClient();

  if (!client) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return client;
}

export function createOptionalBrowserSupabaseClient() {
  if (browserSupabaseClient !== undefined) {
    return browserSupabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    browserSupabaseClient = null;
    return null;
  }

  browserSupabaseClient = createClient(url, anonKey);
  return browserSupabaseClient;
}
