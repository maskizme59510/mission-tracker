export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
