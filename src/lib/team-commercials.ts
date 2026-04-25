import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

export type TeamCommercial = {
  id: string;
  user_code: string;
};

function isMissingColumnError(message: string | undefined) {
  const raw = (message ?? "").toLowerCase();
  return raw.includes("column") && (raw.includes("does not exist") || raw.includes("not found"));
}

/**
 * Commerciaux rattachés au responsable (manager_id), avec trigramme renseigné.
 * Utilise le service role si disponible (RLS profiles souvent limitée au profil courant).
 */
export async function fetchTeamCommercialsForManager(supabase: SupabaseClient, managerId: string): Promise<TeamCommercial[]> {
  const client = supabaseAdmin ?? supabase;
  const query = await client
    .from("profiles")
    .select("id,user_code")
    .eq("manager_id", managerId)
    .eq("role", "commercial")
    .not("user_code", "is", null)
    .order("user_code");

  if (query.error) {
    if (isMissingColumnError(query.error.message)) {
      return [];
    }
    throw new Error(query.error.message);
  }

  return (query.data ?? [])
    .map((row) => ({
      id: String((row as { id: string }).id),
      user_code: String((row as { user_code: string | null }).user_code ?? "")
        .trim()
        .toLocaleUpperCase("fr-FR"),
    }))
    .filter((row) => row.user_code.length > 0);
}

export type ManagedCommercialProfile = {
  id: string;
  user_code: string;
  first_name: string;
  last_name: string;
};

export async function resolveManagedCommercialByCode(
  supabase: SupabaseClient,
  managerId: string,
  code: string,
): Promise<ManagedCommercialProfile | null> {
  const normalized = code.trim().toLocaleUpperCase("fr-FR");
  if (!normalized) {
    return null;
  }

  const client = supabaseAdmin ?? supabase;
  const query = await client
    .from("profiles")
    .select("id,user_code,first_name,last_name")
    .eq("user_code", normalized)
    .eq("manager_id", managerId)
    .eq("role", "commercial")
    .maybeSingle();

  if (query.error) {
    if (isMissingColumnError(query.error.message)) {
      return null;
    }
    throw new Error(query.error.message);
  }

  if (!query.data) {
    return null;
  }

  const row = query.data as ManagedCommercialProfile;
  return {
    id: row.id,
    user_code: row.user_code,
    first_name: row.first_name,
    last_name: row.last_name,
  };
}
