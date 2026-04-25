"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAdminSession } from "@/lib/auth";
import { deriveCommercialFromUser, normalizeCommercial } from "@/lib/commercial";
import { supabaseAdmin } from "@/lib/supabase/server";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeClientName(value: string) {
  return value.trim().toLocaleUpperCase("fr-FR");
}

function normalizeConsultantLastName(value: string) {
  return value.trim().toLocaleUpperCase("fr-FR");
}

function normalizeConsultantFirstName(value: string) {
  return value
    .trim()
    .split("-")
    .map((segment) => {
      if (!segment) return "";
      return segment.charAt(0).toLocaleUpperCase("fr-FR") + segment.slice(1).toLocaleLowerCase("fr-FR");
    })
    .join("-");
}

function normalizeOptionalDate(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeOptionalNumeric(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error("Valeur numerique invalide.");
  }
  return parsed;
}

function isMissingColumnError(message: string | undefined) {
  const raw = (message ?? "").toLowerCase();
  return raw.includes("column") && (raw.includes("does not exist") || raw.includes("not found"));
}

export async function createMissionAction(formData: FormData) {
  const { supabase, user } = await requireAdminSession();

  const consultantFirstName = normalizeConsultantFirstName(String(formData.get("consultant_first_name") ?? ""));
  const consultantLastName = normalizeConsultantLastName(String(formData.get("consultant_last_name") ?? ""));
  const consultantType = String(formData.get("consultant_type") ?? "").trim();
  const consultantEmail = String(formData.get("consultant_email") ?? "").trim();
  const clientName = normalizeClientName(String(formData.get("client_name") ?? ""));
  const clientOperationalContact = String(formData.get("client_operational_contact") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const lastFollowupDate = String(formData.get("last_followup_date") ?? "").trim();
  const nextFollowupDate = String(formData.get("next_followup_date") ?? "").trim();
  const tjm = normalizeOptionalNumeric(String(formData.get("tjm") ?? ""));
  const cj = normalizeOptionalNumeric(String(formData.get("cj") ?? ""));
  const frequency = Number(formData.get("follow_up_frequency_days") ?? 90);
  const commercialInput = normalizeCommercial(String(formData.get("commercial") ?? ""));
  const commercial = commercialInput ?? deriveCommercialFromUser(user);

  if (!consultantFirstName || !consultantLastName || !consultantType || !consultantEmail || !clientName || !startDate) {
    throw new Error("Tous les champs mission sont obligatoires.");
  }
  if (consultantType !== "Consultant Interne" && consultantType !== "Consultant Externe") {
    throw new Error("Type de consultant invalide.");
  }
  if (!isValidEmail(consultantEmail)) {
    throw new Error("L'email du consultant n'est pas valide.");
  }

  const basePayload = {
    owner_id: user.id,
    consultant_first_name: consultantFirstName,
    consultant_last_name: consultantLastName,
    consultant_type: consultantType,
    consultant_email: consultantEmail,
    client_name: clientName,
    client_operational_contact: clientOperationalContact || null,
    last_followup_date: lastFollowupDate || null,
    next_followup_date: nextFollowupDate || null,
    tjm,
    cj,
    // Keep DB compatibility (current column is NOT NULL) while client emails are handled manually.
    client_contact_email: "manual-client-send@local.invalid",
    start_date: startDate,
    follow_up_frequency_days: Number.isFinite(frequency) && frequency > 0 ? frequency : 90,
  };

  let mission:
    | {
        id: string;
      }
    | null = null;
  let missionError: Error | { message?: string } | null = null;

  const insertWithCommercial = await supabase
    .from("missions")
    .insert({
      ...basePayload,
      commercial,
    })
    .select("id")
    .single();

  if (insertWithCommercial.error && isMissingColumnError(insertWithCommercial.error.message)) {
    const fallbackInsert = await supabase
      .from("missions")
      .insert(basePayload)
      .select("id")
      .single();
    mission = fallbackInsert.data;
    missionError = fallbackInsert.error;
  } else {
    mission = insertWithCommercial.data;
    missionError = insertWithCommercial.error;
  }

  if (missionError || !mission) {
    throw new Error(missionError?.message ?? "Erreur de creation de mission.");
  }

  const normalizedLastFollowupDate = normalizeOptionalDate(lastFollowupDate);
  if (normalizedLastFollowupDate) {
    const { error: reportError } = await supabase.from("mission_reports").insert({
      mission_id: mission.id,
      type: "followup",
      report_date: normalizedLastFollowupDate,
      last_followup_date: normalizedLastFollowupDate,
      next_followup_date: normalizeOptionalDate(nextFollowupDate),
      status: "draft",
      created_by: user.id,
    });
    if (reportError) {
      throw new Error(reportError.message);
    }
  }

  revalidatePath("/missions");
  redirect(`/missions/${mission.id}`);
}

export async function createFollowupReportAction(formData: FormData) {
  const missionId = String(formData.get("mission_id") ?? "");

  if (!missionId) {
    redirect("/missions?createReport=error&createReportError=mission_id%20manquant");
  }

  try {
    const { supabase, user } = await requireAdminSession();
    const reportDate = new Date().toISOString().slice(0, 10);

    const { data: latestReport } = await supabase
      .from("mission_reports")
      .select("report_date")
      .eq("mission_id", missionId)
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastFollowupDate = normalizeOptionalDate(latestReport?.report_date ?? null);
    const nextFollowupDate = normalizeOptionalDate(String(formData.get("next_followup_date") ?? ""));

    const { data: createdReport, error: createError } = await supabase
      .from("mission_reports")
      .insert({
        mission_id: missionId,
        type: "followup",
        report_date: reportDate,
        // Optional dates: always persist null when empty.
        last_followup_date: lastFollowupDate,
        next_followup_date: nextFollowupDate,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (createError || !createdReport) {
      throw new Error(createError?.message ?? "Impossible de creer le CR de suivi.");
    }

    revalidatePath(`/missions/${missionId}`);
    redirect(`/reports/${createdReport.id}/edit`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Erreur inconnue lors de la creation du CR.";
    redirect(`/missions/${missionId}?createReport=error&createReportError=${encodeURIComponent(message)}`);
  }
}

export async function deleteMissionAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const missionId = String(formData.get("mission_id") ?? "");

  if (!missionId) {
    throw new Error("mission_id obligatoire.");
  }

  const { error } = await supabase.from("missions").delete().eq("id", missionId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/missions");
  redirect("/missions");
}

export async function deleteReportAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const missionId = String(formData.get("mission_id") ?? "");
  const reportId = String(formData.get("report_id") ?? "");

  if (!missionId || !reportId) {
    throw new Error("mission_id et report_id obligatoires.");
  }

  const { error } = await supabase.from("mission_reports").delete().eq("id", reportId).eq("mission_id", missionId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
}

type MissionIdentityUpdatePayload = {
  consultant_first_name: string;
  consultant_last_name: string;
  consultant_type: string;
  consultant_email: string;
  client_name: string;
  commercial: string | null;
  client_operational_contact: string | null;
  start_date: string;
  tjm: number | null;
  cj: number | null;
  follow_up_frequency_days: number;
  last_followup_date?: string | null;
  next_followup_date?: string | null;
};

function parseMissionIdentityUpdateFromForm(formData: FormData): { missionId: string; updatePayload: MissionIdentityUpdatePayload } {
  const missionId = String(formData.get("mission_id") ?? "");
  const consultantFirstName = normalizeConsultantFirstName(String(formData.get("consultant_first_name") ?? ""));
  const consultantLastName = normalizeConsultantLastName(String(formData.get("consultant_last_name") ?? ""));
  const consultantType = String(formData.get("consultant_type") ?? "").trim();
  const consultantEmail = String(formData.get("consultant_email") ?? "").trim();
  const clientName = normalizeClientName(String(formData.get("client_name") ?? ""));
  const clientOperationalContact = String(formData.get("client_operational_contact") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const hasLastFollowupDate = formData.has("last_followup_date");
  const hasNextFollowupDate = formData.has("next_followup_date");
  const lastFollowupDate = String(formData.get("last_followup_date") ?? "").trim();
  const nextFollowupDate = String(formData.get("next_followup_date") ?? "").trim();
  const tjm = normalizeOptionalNumeric(String(formData.get("tjm") ?? ""));
  const cj = normalizeOptionalNumeric(String(formData.get("cj") ?? ""));
  const commercial = normalizeCommercial(String(formData.get("commercial") ?? ""));
  const frequencyRaw = String(formData.get("follow_up_frequency_days") ?? "").trim();
  const existingFrequency = Number(formData.get("existing_follow_up_frequency_days") ?? 90);
  const followUpFrequencyDays = frequencyRaw === "custom" ? existingFrequency : Number(frequencyRaw);

  if (!missionId || !consultantFirstName || !consultantLastName || !consultantType || !consultantEmail || !clientName || !startDate) {
    throw new Error("Tous les champs de modification mission sont obligatoires.");
  }
  if (consultantType !== "Consultant Interne" && consultantType !== "Consultant Externe") {
    throw new Error("Type de consultant invalide.");
  }
  if (!isValidEmail(consultantEmail)) {
    throw new Error("L'email du consultant n'est pas valide.");
  }
  if (!Number.isFinite(followUpFrequencyDays) || followUpFrequencyDays <= 0) {
    throw new Error("Frequence de suivi invalide.");
  }

  const updatePayload: MissionIdentityUpdatePayload = {
    consultant_first_name: consultantFirstName,
    consultant_last_name: consultantLastName,
    consultant_type: consultantType,
    consultant_email: consultantEmail,
    client_name: clientName,
    commercial,
    client_operational_contact: clientOperationalContact || null,
    start_date: startDate,
    tjm,
    cj,
    follow_up_frequency_days: followUpFrequencyDays,
  };
  if (hasLastFollowupDate) {
    updatePayload.last_followup_date = lastFollowupDate || null;
  }
  if (hasNextFollowupDate) {
    updatePayload.next_followup_date = nextFollowupDate || null;
  }

  return { missionId, updatePayload };
}

export async function updateMissionIdentityAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const { missionId, updatePayload } = parseMissionIdentityUpdateFromForm(formData);

  const { error } = await supabase.from("missions").update(updatePayload).eq("id", missionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
  redirect(`/missions/${missionId}?missionUpdated=1`);
}

/**
 * Transfert de mission : met a jour commercial + owner_id (profil du trigramme cible).
 * Reserve au titulaire actuel (owner_id).
 */
export async function executeMissionTransferAction(formData: FormData) {
  const missionId = String(formData.get("mission_id") ?? "");
  const newCommercial = normalizeCommercial(String(formData.get("new_commercial") ?? ""));

  if (!missionId) {
    throw new Error("mission_id obligatoire.");
  }
  if (!newCommercial) {
    throw new Error("Trigramme obligatoire.");
  }

  const { supabase, user } = await requireAdminSession();

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("owner_id, commercial")
    .eq("id", missionId)
    .single();

  if (missionError || !mission) {
    throw new Error(missionError?.message ?? "Mission introuvable.");
  }

  if (mission.owner_id !== user.id) {
    throw new Error("Seul le titulaire actuel de la mission peut transferer.");
  }

  const previousCommercial = normalizeCommercial(mission.commercial as string | null);
  if ((previousCommercial ?? "") === newCommercial) {
    throw new Error("Choisissez un autre commercial que le titulaire actuel.");
  }

  const profileClient = supabaseAdmin ?? supabase;
  const { data: recipient, error: profileError } = await profileClient
    .from("profiles")
    .select("id")
    .eq("user_code", newCommercial)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }
  if (!recipient?.id) {
    throw new Error(`Aucun profil utilisateur trouve pour le trigramme ${newCommercial}.`);
  }

  const dbClient = supabaseAdmin ?? supabase;
  const { error: updateError } = await dbClient
    .from("missions")
    .update({ commercial: newCommercial, owner_id: recipient.id as string })
    .eq("id", missionId)
    .eq("owner_id", user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/missions");
  redirect("/missions");
}

export async function updateMissionNextFollowupAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const missionId = String(formData.get("mission_id") ?? "");
  const nextFollowupDate = normalizeOptionalDate(String(formData.get("next_followup_date") ?? ""));

  if (!missionId) {
    throw new Error("mission_id obligatoire.");
  }

  const { error } = await supabase
    .from("missions")
    .update({ next_followup_date: nextFollowupDate })
    .eq("id", missionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
}
