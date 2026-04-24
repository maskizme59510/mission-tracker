"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { toLines } from "@/lib/format";
import { hashToken } from "@/lib/tokens";

const editableSections = ["consultant_feedback", "client_feedback", "next_objectives", "training"] as const;

async function resolveValidToken(rawToken: string) {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante.");
  }
  if (!rawToken) {
    throw new Error("Token de validation manquant.");
  }

  const tokenHash = hashToken(rawToken);
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("report_validation_tokens")
    .select("id,report_id,used_at,expires_at")
    .eq("token_hash", tokenHash)
    .single();

  if (tokenError || !tokenRow) {
    throw new Error("Lien invalide.");
  }
  if (tokenRow.used_at) {
    throw new Error("Ce lien a deja ete utilise.");
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    throw new Error("Ce lien a expire.");
  }

  return tokenRow;
}

export async function saveConsultantEditsAction(formData: FormData) {
  const rawToken = String(formData.get("token") ?? "");
  const tokenRow = await resolveValidToken(rawToken);

  const sectionsPayload = {
    consultant_feedback: toLines(String(formData.get("consultant_feedback") ?? "")),
    client_feedback: toLines(String(formData.get("client_feedback") ?? "")),
    next_objectives: toLines(String(formData.get("next_objectives") ?? "")),
    training: toLines(String(formData.get("training") ?? "")),
  };

  const { error: deleteError } = await supabaseAdmin!
    .from("report_sections_items")
    .delete()
    .eq("report_id", tokenRow.report_id)
    .in("section_type", [...editableSections]);
  if (deleteError) throw new Error(deleteError.message);

  const inserts = editableSections.flatMap((section) =>
    sectionsPayload[section].map((content, position) => ({
      report_id: tokenRow.report_id,
      section_type: section,
      content,
      position,
    })),
  );

  if (inserts.length > 0) {
    const { error: insertError } = await supabaseAdmin!.from("report_sections_items").insert(inserts);
    if (insertError) throw new Error(insertError.message);
  }

  const { error: reportUpdateError } = await supabaseAdmin!
    .from("mission_reports")
    .update({ consultant_last_edited_at: new Date().toISOString() })
    .eq("id", tokenRow.report_id);
  if (reportUpdateError) throw new Error(reportUpdateError.message);

  revalidatePath(`/validate/${rawToken}`);
  redirect(`/validate/${rawToken}?saved=1`);
}

export async function confirmConsultantValidationAction(formData: FormData) {
  const rawToken = String(formData.get("token") ?? "");
  const tokenRow = await resolveValidToken(rawToken);
  const nowIso = new Date().toISOString();

  const { error: tokenUpdateError } = await supabaseAdmin!
    .from("report_validation_tokens")
    .update({ used_at: nowIso })
    .eq("id", tokenRow.id)
    .is("used_at", null);
  if (tokenUpdateError) throw new Error(tokenUpdateError.message);

  const { error: reportError } = await supabaseAdmin!
    .from("mission_reports")
    .update({
      status: "validated",
      consultant_validated_at: nowIso,
    })
    .eq("id", tokenRow.report_id);
  if (reportError) throw new Error(reportError.message);

  const { data: reportMeta } = await supabaseAdmin!
    .from("mission_reports")
    .select("id,created_by")
    .eq("id", tokenRow.report_id)
    .single();

  if (reportMeta?.created_by) {
    await supabaseAdmin!.from("admin_notifications").insert({
      owner_id: reportMeta.created_by,
      report_id: tokenRow.report_id,
      type: "consultant_validated",
      title: "CR valide par le consultant",
      message: "Le consultant a valide le compte-rendu. Vous pouvez maintenant l'envoyer au client.",
    });
  }

  revalidatePath(`/validate/${rawToken}`);
  redirect(`/validate/${rawToken}?validated=1`);
}
