"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { toLines } from "@/lib/format";
import { buildEmailIntro, buildReportBody } from "@/lib/report-template";
import { generateRawToken, hashToken } from "@/lib/tokens";

const sections = ["consultant_feedback", "client_feedback", "next_objectives", "training"] as const;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateReportAction(formData: FormData) {
  const reportId = String(formData.get("report_id") ?? "");
  const missionId = String(formData.get("mission_id") ?? "");

  if (!reportId || !missionId) {
    redirect(`/reports/${reportId}/edit?save=error`);
  }

  try {
    const { supabase } = await requireAdminSession();
    const payload = {
      report_date: String(formData.get("report_date") ?? ""),
      last_followup_date: String(formData.get("last_followup_date") ?? "") || null,
    next_followup_date: String(formData.get("next_followup_date") ?? "") || null,
      status: String(formData.get("status") ?? "draft"),
    };

    const { error: reportError } = await supabase.from("mission_reports").update(payload).eq("id", reportId);
    if (reportError) throw new Error(reportError.message);

    await supabase.from("report_participants").delete().eq("report_id", reportId);
    const participants = toLines(String(formData.get("participants") ?? ""));
    if (participants.length > 0) {
      const { error: participantsError } = await supabase.from("report_participants").insert(
        participants.map((name, position) => ({
          report_id: reportId,
          name,
          role_label: "Participant",
          position,
        })),
      );
      if (participantsError) throw new Error(participantsError.message);
    }

    await supabase.from("report_sections_items").delete().eq("report_id", reportId);

    for (const section of sections) {
      const values = toLines(String(formData.get(section) ?? ""));
      if (values.length === 0) continue;
      const { error } = await supabase.from("report_sections_items").insert(
        values.map((content, position) => ({
          report_id: reportId,
          section_type: section,
          content,
          position,
        })),
      );
      if (error) throw new Error(error.message);
    }

    revalidatePath(`/reports/${reportId}/edit`);
    revalidatePath(`/missions/${missionId}`);
    revalidatePath("/missions");
    redirect(`/reports/${reportId}/edit?save=success`);
  } catch {
    redirect(`/reports/${reportId}/edit?save=error`);
  }
}

export async function sendToConsultantAction(formData: FormData) {
  const { supabase, user } = await requireAdminSession();
  const reportId = String(formData.get("report_id") ?? "");
  const missionId = String(formData.get("mission_id") ?? "");

  if (!reportId || !missionId) {
    throw new Error("report_id et mission_id sont obligatoires.");
  }

  const { data: report, error: reportError } = await supabase
    .from("mission_reports")
    .select("id,mission_id,report_date,last_followup_date,next_followup_date")
    .eq("id", reportId)
    .single();
  if (reportError || !report) throw new Error(reportError?.message ?? "CR introuvable.");

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("consultant_first_name,consultant_last_name,consultant_email,client_name,start_date")
    .eq("id", missionId)
    .single();
  if (missionError || !mission) throw new Error(missionError?.message ?? "Mission introuvable.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: participantsData } = await supabase
    .from("report_participants")
    .select("name")
    .eq("report_id", reportId)
    .order("position", { ascending: true });

  const { data: sectionsData } = await supabase
    .from("report_sections_items")
    .select("section_type,content")
    .eq("report_id", reportId)
    .order("position", { ascending: true });

  const sectionMap: Record<string, string[]> = {
    consultant_feedback: [],
    client_feedback: [],
    next_objectives: [],
    training: [],
  };
  sectionsData?.forEach((item) => sectionMap[item.section_type].push(item.content));

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("report_validation_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("report_id", reportId)
    .is("used_at", null);

  const { error: tokenError } = await supabase.from("report_validation_tokens").insert({
    report_id: reportId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: user.id,
  });
  if (tokenError) throw new Error(tokenError.message);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const validateUrl = `${baseUrl}/validate/${rawToken}`;
  const consultantFullName = `${mission.consultant_first_name} ${mission.consultant_last_name}`;

  const body = buildReportBody({
    consultantFullName,
    missionStartDate: mission.start_date,
    lastFollowupDate: report.last_followup_date,
    reportDate: report.report_date,
    nextFollowupDate: report.next_followup_date,
    participants: (participantsData ?? []).map((p) => p.name),
    consultantFeedback: sectionMap.consultant_feedback,
    clientFeedback: sectionMap.client_feedback,
    objectives: sectionMap.next_objectives,
    training: sectionMap.training,
    consultantFirstName: mission.consultant_first_name,
    clientName: mission.client_name,
    engineerFirstName: profile?.first_name ?? "Votre ingenieur d'affaires",
  });

  const textEmail = `${buildEmailIntro({
    consultantFullName,
    missionStartDate: mission.start_date,
    lastFollowupDate: report.last_followup_date,
    reportDate: report.report_date,
    nextFollowupDate: report.next_followup_date,
    participants: (participantsData ?? []).map((p) => p.name),
    consultantFeedback: sectionMap.consultant_feedback,
    clientFeedback: sectionMap.client_feedback,
    objectives: sectionMap.next_objectives,
    training: sectionMap.training,
    consultantFirstName: mission.consultant_first_name,
    clientName: mission.client_name,
    engineerFirstName: profile?.first_name ?? "Votre ingenieur d'affaires",
  })}

${body}

Lien de validation :
${validateUrl}`;

  let emailStatus: "queued" | "sent" | "failed" = "queued";
  let providerMessageId: string | null = `preview:${validateUrl}`;
  let errorMessage: string | null = null;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Mission Tracker <no-reply@mission-tracker.local>",
          to: [mission.consultant_email],
          subject: `Validation CR mission - ${consultantFullName}`,
          text: textEmail,
        }),
      });

      if (!response.ok) {
        emailStatus = "failed";
        providerMessageId = null;
        errorMessage = `Resend HTTP ${response.status}`;
      } else {
        const payload = (await response.json()) as { id?: string };
        emailStatus = "sent";
        providerMessageId = payload.id ?? "sent";
      }
    } catch (error) {
      emailStatus = "failed";
      providerMessageId = null;
      errorMessage = error instanceof Error ? error.message : "Erreur inconnue envoi Resend.";
    }
  }

  await supabase.from("email_logs").insert({
    report_id: reportId,
    recipient_email: mission.consultant_email,
    email_type: "consultant_validation",
    provider_message_id: providerMessageId,
    status: emailStatus,
    error_message: errorMessage,
    sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
  });

  const { error: statusError } = await supabase
    .from("mission_reports")
    .update({ status: "pending_consultant_validation" })
    .eq("id", reportId);
  if (statusError) throw new Error(statusError.message);

  revalidatePath(`/reports/${reportId}/edit`);
  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
}

export async function sendToClientAction(formData: FormData) {
  const { supabase, user } = await requireAdminSession();
  const reportId = String(formData.get("report_id") ?? "");
  const missionId = String(formData.get("mission_id") ?? "");
  const clientRecipientEmail = String(formData.get("client_recipient_email") ?? "").trim();

  if (!reportId || !missionId || !clientRecipientEmail) {
    throw new Error("report_id, mission_id et email destinataire client sont obligatoires.");
  }
  if (!emailRegex.test(clientRecipientEmail)) {
    throw new Error("L'email destinataire client n'est pas valide.");
  }

  const { data: report, error: reportError } = await supabase
    .from("mission_reports")
    .select("id,report_date,last_followup_date,next_followup_date")
    .eq("id", reportId)
    .single();
  if (reportError || !report) throw new Error(reportError?.message ?? "CR introuvable.");

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("consultant_first_name,consultant_last_name,client_name,start_date")
    .eq("id", missionId)
    .single();
  if (missionError || !mission) throw new Error(missionError?.message ?? "Mission introuvable.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: participantsData } = await supabase
    .from("report_participants")
    .select("name")
    .eq("report_id", reportId)
    .order("position", { ascending: true });

  const { data: sectionsData } = await supabase
    .from("report_sections_items")
    .select("section_type,content")
    .eq("report_id", reportId)
    .order("position", { ascending: true });

  const sectionMap: Record<string, string[]> = {
    consultant_feedback: [],
    client_feedback: [],
    next_objectives: [],
    training: [],
  };
  sectionsData?.forEach((item) => sectionMap[item.section_type].push(item.content));

  const consultantFullName = `${mission.consultant_first_name} ${mission.consultant_last_name}`;
  const body = buildReportBody({
    consultantFullName,
    missionStartDate: mission.start_date,
    lastFollowupDate: report.last_followup_date,
    reportDate: report.report_date,
    nextFollowupDate: report.next_followup_date,
    participants: (participantsData ?? []).map((p) => p.name),
    consultantFeedback: sectionMap.consultant_feedback,
    clientFeedback: sectionMap.client_feedback,
    objectives: sectionMap.next_objectives,
    training: sectionMap.training,
    consultantFirstName: mission.consultant_first_name,
    clientName: mission.client_name,
    engineerFirstName: profile?.first_name ?? "Votre ingenieur d'affaires",
  });

  const textEmail = `${buildEmailIntro({
    consultantFullName,
    missionStartDate: mission.start_date,
    lastFollowupDate: report.last_followup_date,
    reportDate: report.report_date,
    nextFollowupDate: report.next_followup_date,
    participants: (participantsData ?? []).map((p) => p.name),
    consultantFeedback: sectionMap.consultant_feedback,
    clientFeedback: sectionMap.client_feedback,
    objectives: sectionMap.next_objectives,
    training: sectionMap.training,
    consultantFirstName: mission.consultant_first_name,
    clientName: mission.client_name,
    engineerFirstName: profile?.first_name ?? "Votre ingenieur d'affaires",
  })}

${body}`;

  let emailStatus: "queued" | "sent" | "failed" = "queued";
  let providerMessageId: string | null = "preview:client-email";
  let errorMessage: string | null = null;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Mission Tracker <no-reply@mission-tracker.local>",
          to: [clientRecipientEmail],
          subject: `CR mission - ${consultantFullName}`,
          text: textEmail,
        }),
      });

      if (!response.ok) {
        emailStatus = "failed";
        providerMessageId = null;
        errorMessage = `Resend HTTP ${response.status}`;
      } else {
        const payload = (await response.json()) as { id?: string };
        emailStatus = "sent";
        providerMessageId = payload.id ?? "sent";
      }
    } catch (error) {
      emailStatus = "failed";
      providerMessageId = null;
      errorMessage = error instanceof Error ? error.message : "Erreur inconnue envoi Resend.";
    }
  }

  await supabase.from("email_logs").insert({
    report_id: reportId,
    recipient_email: clientRecipientEmail,
    email_type: "client_send",
    provider_message_id: providerMessageId,
    status: emailStatus,
    error_message: errorMessage,
    sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
  });

  await supabase.from("admin_notifications").insert({
    owner_id: user.id,
    report_id: reportId,
    type: "client_email_sent",
    title: "CR envoye au client",
    message: `Le CR a ete envoye au client (${clientRecipientEmail}).`,
  });

  const { error: statusError } = await supabase
    .from("mission_reports")
    .update({
      status: "sent_to_client",
      sent_to_client_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (statusError) throw new Error(statusError.message);

  revalidatePath(`/reports/${reportId}/edit`);
  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
  revalidatePath("/dashboard");
}
