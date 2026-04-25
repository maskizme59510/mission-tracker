import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/rbac";

export async function requireAdminSession() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function requireUserSessionWithProfile() {
  const { supabase, user } = await requireAdminSession();
  const profile = await getUserProfile(supabase, user);
  return { supabase, user, profile };
}
