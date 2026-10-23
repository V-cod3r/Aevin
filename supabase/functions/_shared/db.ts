import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Admin = SupabaseClient;

// Service-role client: bypasses RLS. Only ever used inside Edge Functions,
// and every query is explicitly scoped by user_id.
export function adminClient(): Admin {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
