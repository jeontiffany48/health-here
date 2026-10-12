import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Accepts the URL even if it was pasted with "/rest/v1/" or a trailing slash.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, "");
export const SUPABASE_KEY =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null when env vars aren't set (guest-only mode). */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}

let emailClient: SupabaseClient | null = null;

/**
 * Client used only to SEND sign-up and reset-password emails. It uses the "implicit" flow, so the
 * email link carries the login itself (in the #hash) and works in any browser or device —
 * not only the one that asked for the email. Nothing is stored by this client.
 */
export function getEmailLinkClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!emailClient)
    emailClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  return emailClient;
}
