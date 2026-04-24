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
  const consultantEmail = String(formData.get("consultant_email") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();
  const clientOperationalContact = String(formData.get("client_operational_contact") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const frequency = Number(formData.get("follow_up_frequency_days") ?? 90);

  if (!consultantFirstName || !consultantLastName || !consultantEmail || !clientName || !startDate) {
    throw new Error("Tous les champs mission sont obligatoires.");
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

  if (!missionId || !reportDate || !nextFollowupDate) {
    throw new Error("mission_id, report_date et next_followup_date sont obligatoires.");
  }

  const { error } = await supabase.from("mission_reports").insert({
    mission_id: missionId,
    type: "followup",
    report_date: reportDate,
    last_followup_date: lastFollowupDate || null,
    next_followup_date: nextFollowupDate,
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
