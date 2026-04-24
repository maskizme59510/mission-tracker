import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_* variables.");
  }

  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
