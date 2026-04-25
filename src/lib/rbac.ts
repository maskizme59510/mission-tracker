import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "commercial" | "responsable" | "directeur";

export type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  manager_id: string | null;
  user_code: string | null;
};

export async function getUserProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<ProfileRow> {
  const primaryQuery = await supabase
    .from("profiles")
    .select("id,first_name,last_name,role,manager_id,user_code")
    .eq("id", user.id)
    .maybeSingle();
  if (!primaryQuery.error && primaryQuery.data) {
    return primaryQuery.data as ProfileRow;
  }

  const message = (primaryQuery.error?.message ?? "").toLowerCase();
  const columnMissing = message.includes("column") && (message.includes("does not exist") || message.includes("not found"));
  if (!columnMissing && primaryQuery.error) {
    throw new Error(primaryQuery.error.message);
  }

  const fallbackQuery = await supabase
    .from("profiles")
    .select("id,first_name,last_name,role")
    .eq("id", user.id)
    .maybeSingle();
  if (fallbackQuery.error) {
    throw new Error(fallbackQuery.error.message);
  }
  if (!fallbackQuery.data) {
    throw new Error("Profil utilisateur introuvable.");
  }
  return {
    ...(fallbackQuery.data as Omit<ProfileRow, "manager_id" | "user_code">),
    manager_id: null,
    user_code: null,
  };
}

export async function getTeamMemberIds(
  supabase: SupabaseClient,
  managerId: string,
): Promise<string[]> {
  const query = await supabase
    .from("profiles")
    .select("id")
    .eq("manager_id", managerId)
    .eq("role", "commercial");
  if (!query.error) {
    return (query.data ?? []).map((row) => String((row as { id: string }).id));
  }
  const message = query.error.message.toLowerCase();
  const columnMissing = message.includes("column") && (message.includes("does not exist") || message.includes("not found"));
  if (columnMissing) {
    return [];
  }
  throw new Error(query.error.message);
}
