import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const supabaseClient = createClient(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
