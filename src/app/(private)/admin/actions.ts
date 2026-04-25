"use server";

import { revalidatePath } from "next/cache";
import { requireUserSessionWithProfile } from "@/lib/auth";
import { deriveCommercialFromNames, normalizeCommercial } from "@/lib/commercial";
import { supabaseAdmin } from "@/lib/supabase/server";

type Role = "commercial" | "responsable" | "directeur";

function assertAllowedRole(role: string): asserts role is Role {
  if (role !== "commercial" && role !== "responsable" && role !== "directeur") {
    throw new Error("Role invalide.");
  }
}

async function assertCanManageUsers() {
  const { profile } = await requireUserSessionWithProfile();
  if (profile.role !== "responsable" && profile.role !== "directeur") {
    throw new Error("Acces non autorise.");
  }
}

function deriveNamesFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const segments = localPart.split(/[._-]+/).filter(Boolean);
  const firstName = segments[0] ?? localPart;
  const lastName = segments.length > 1 ? segments[segments.length - 1] : "";
  return { firstName, lastName };
}

export async function createUserAccountAction(formData: FormData) {
  await assertCanManageUsers();
  if (!supabaseAdmin) {
    throw new Error("Client admin Supabase indisponible.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();
  const managerIdRaw = String(formData.get("manager_id") ?? "").trim();
  assertAllowedRole(roleRaw);

  if (!email || !password) {
    throw new Error("Email et mot de passe obligatoires.");
  }
  const managerId = roleRaw === "commercial" ? managerIdRaw || null : null;

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createUserError || !createdUser.user) {
    throw new Error(createUserError?.message ?? "Impossible de creer le compte.");
  }

  const { firstName, lastName } = deriveNamesFromEmail(email);
  const fallbackCode = deriveCommercialFromNames(firstName, lastName) ?? deriveCommercialFromNames(firstName, "") ?? null;

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: createdUser.user.id,
    first_name: firstName || "Utilisateur",
    last_name: lastName || "",
    role: roleRaw,
    manager_id: managerId,
    user_code: fallbackCode,
  });
  if (profileError) {
    throw new Error(profileError.message);
  }

  revalidatePath("/admin");
}

export async function updateUserRoleAction(formData: FormData) {
  await assertCanManageUsers();
  if (!supabaseAdmin) {
    throw new Error("Client admin Supabase indisponible.");
  }

  const profileId = String(formData.get("profile_id") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();
  const managerIdRaw = String(formData.get("manager_id") ?? "").trim();
  const userCodeRaw = String(formData.get("user_code") ?? "").trim();
  assertAllowedRole(roleRaw);

  if (!profileId) {
    throw new Error("profile_id obligatoire.");
  }

  const payload = {
    role: roleRaw,
    manager_id: roleRaw === "commercial" ? managerIdRaw || null : null,
    user_code: normalizeCommercial(userCodeRaw),
  };

  const { error } = await supabaseAdmin.from("profiles").update(payload).eq("id", profileId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
}
