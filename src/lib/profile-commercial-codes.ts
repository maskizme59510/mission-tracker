import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

function isMissingColumnError(message: string | undefined) {
  const raw = (message ?? "").toLowerCase();
  return raw.includes("column") && (raw.includes("does not exist") || raw.includes("not found"));
}

/**
 * Liste des trigrammes (user_code) distincts depuis public.profiles.
 * Préfère le client service role pour lire tous les profils (RLS restrictive sur profiles).
 */
export async function fetchProfileCommercialUserCodes(userClient: SupabaseClient): Promise<string[]> {
  const client = supabaseAdmin ?? userClient;
  const query = await client.from("profiles").select("user_code").not("user_code", "is", null).order("user_code");

  if (query.error) {
    if (isMissingColumnError(query.error.message)) {
      return [];
    }
    throw new Error(query.error.message);
  }

  const set = new Set<string>();
  for (const row of query.data ?? []) {
    const code = (row as { user_code: string | null }).user_code?.trim().toLocaleUpperCase("fr-FR");
    if (code) set.add(code);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}
