"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAdminSession } from "@/lib/auth";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeClientName(value: string) {
  return value.trim().toLocaleUpperCase("fr-FR");
}

function normalizeConsultantLastName(value: string) {
  return value.trim().toLocaleUpperCase("fr-FR");
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

export async function createMissionAction(formData: FormData) {
  const { supabase, user } = await requireAdminSession();

  const consultantFirstName = String(formData.get("consultant_first_name") ?? "").trim();
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

  if (!consultantFirstName || !consultantLastName || !consultantType || !consultantEmail || !clientName || !startDate) {
    throw new Error("Tous les champs mission sont obligatoires.");
  }
  if (consultantType !== "Consultant Interne" && consultantType !== "Consultant Externe") {
    throw new Error("Type de consultant invalide.");
  }
  if (!isValidEmail(consultantEmail)) {
    throw new Error("L'email du consultant n'est pas valide.");
  }

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .insert({
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
    })
    .select("id")
    .single();

  if (missionError || !mission) {
    throw new Error(missionError?.message ?? "Erreur de creation de mission.");
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

export async function updateMissionIdentityAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const missionId = String(formData.get("mission_id") ?? "");
  const consultantFirstName = String(formData.get("consultant_first_name") ?? "").trim();
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

  const { error } = await supabase
    .from("missions")
    .update({
      consultant_first_name: consultantFirstName,
      consultant_last_name: consultantLastName,
      consultant_type: consultantType,
      consultant_email: consultantEmail,
      client_name: clientName,
      client_operational_contact: clientOperationalContact || null,
      start_date: startDate,
      last_followup_date: lastFollowupDate || null,
      next_followup_date: nextFollowupDate || null,
      tjm,
      cj,
      follow_up_frequency_days: followUpFrequencyDays,
    })
    .eq("id", missionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
  redirect(`/missions/${missionId}?missionUpdated=1`);
}

export async function updateMissionNextFollowupAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const missionId = String(formData.get("mission_id") ?? "");
  const nextFollowupDate = String(formData.get("next_followup_date") ?? "").trim();

  if (!missionId) {
    throw new Error("mission_id obligatoire.");
  }

  const { error } = await supabase
    .from("missions")
    .update({ next_followup_date: nextFollowupDate || null })
    .eq("id", missionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
}
