"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function createMissionAction(formData: FormData) {
  const { supabase, user } = await requireAdminSession();

  const consultantFirstName = String(formData.get("consultant_first_name") ?? "").trim();
  const consultantLastName = String(formData.get("consultant_last_name") ?? "").trim();
  const consultantType = String(formData.get("consultant_type") ?? "").trim();
  const consultantEmail = String(formData.get("consultant_email") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();
  const clientOperationalContact = String(formData.get("client_operational_contact") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
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
      // Keep DB compatibility (current column is NOT NULL) while client emails are handled manually.
      client_contact_email: "manual-client-send@local.invalid",
      start_date: startDate,
      follow_up_frequency_days: Number.isFinite(frequency) && frequency > 0 ? frequency : 90,
    })
    .select("id, start_date, follow_up_frequency_days")
    .single();

  if (missionError || !mission) {
    throw new Error(missionError?.message ?? "Erreur de creation de mission.");
  }

  const start = new Date(mission.start_date);
  const nextFollowup = new Date(start);
  nextFollowup.setDate(nextFollowup.getDate() + mission.follow_up_frequency_days);

  const { data: report, error: reportError } = await supabase
    .from("mission_reports")
    .insert({
      mission_id: mission.id,
      type: "kickoff",
      report_date: mission.start_date,
      last_followup_date: null,
      next_followup_date: nextFollowup.toISOString().slice(0, 10),
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (reportError || !report) {
    throw new Error(reportError?.message ?? "Mission creee, mais erreur sur le CR de demarrage.");
  }

  revalidatePath("/missions");
}

export async function createFollowupReportAction(formData: FormData) {
  const { supabase, user } = await requireAdminSession();

  const missionId = String(formData.get("mission_id") ?? "");
  const reportDate = String(formData.get("report_date") ?? "");
  const lastFollowupDate = String(formData.get("last_followup_date") ?? "");
  const nextFollowupDate = String(formData.get("next_followup_date") ?? "");

  if (!missionId || !reportDate) {
    throw new Error("mission_id et report_date sont obligatoires.");
  }

  const { error } = await supabase.from("mission_reports").insert({
    mission_id: missionId,
    type: "followup",
    report_date: reportDate,
    last_followup_date: lastFollowupDate || null,
    next_followup_date: nextFollowupDate || null,
    status: "draft",
    created_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/missions/${missionId}`);
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
  const consultantLastName = String(formData.get("consultant_last_name") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();

  if (!missionId || !consultantFirstName || !consultantLastName || !clientName) {
    throw new Error("Tous les champs de modification mission sont obligatoires.");
  }

  const { error } = await supabase
    .from("missions")
    .update({
      consultant_first_name: consultantFirstName,
      consultant_last_name: consultantLastName,
      client_name: clientName,
    })
    .eq("id", missionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
}

export async function updateMissionNextFollowupAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const missionId = String(formData.get("mission_id") ?? "");
  const nextFollowupDate = String(formData.get("next_followup_date") ?? "").trim();

  if (!missionId) {
    throw new Error("mission_id obligatoire.");
  }

  const { data: latestReport, error: latestReportError } = await supabase
    .from("mission_reports")
    .select("id")
    .eq("mission_id", missionId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestReportError) {
    throw new Error(latestReportError.message);
  }
  if (!latestReport) {
    throw new Error("Aucun CR existant pour planifier un prochain suivi.");
  }

  const { error } = await supabase
    .from("mission_reports")
    .update({ next_followup_date: nextFollowupDate || null })
    .eq("id", latestReport.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
}
