import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { ReportStatusSelect } from "@/components/report-status-select";
import { SaveCrFeedback } from "@/components/save-cr-feedback";
import { SaveCrSubmitButton } from "@/components/save-cr-submit-button";
import { fromLines, toFrenchDate } from "@/lib/format";
import { sendToConsultantAction, updateReportAction } from "@/app/(private)/reports/[id]/actions";

type Report = {
  id: string;
  mission_id: string;
  type: "kickoff" | "followup";
  report_date: string;
  last_followup_date: string | null;
  next_followup_date: string | null;
  status: "draft" | "pending_consultant_validation" | "validated" | "sent_to_client";
  consultant_last_edited_at?: string | null;
};

type Mission = {
  id: string;
  consultant_first_name: string;
  consultant_last_name: string;
  client_name: string;
};

type SectionItem = {
  section_type: "consultant_feedback" | "client_feedback" | "next_objectives" | "training";
  content: string;
};

export default async function EditReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ save?: string }>;
}) {
  const { id } = await params;
  const { save } = await searchParams;
  const { supabase } = await requireAdminSession();

  const { data: report, error: reportError } = await supabase.from("mission_reports").select("*").eq("id", id).single();
  if (reportError) throw new Error(reportError.message);
  if (!report) notFound();

  const typedReport = report as Report;
  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("id,consultant_first_name,consultant_last_name,client_name")
    .eq("id", typedReport.mission_id)
    .single();
  if (missionError) throw new Error(missionError.message);
  const typedMission = mission as Mission;

  const { data: participantsData } = await supabase
    .from("report_participants")
    .select("name")
    .eq("report_id", id)
    .order("position", { ascending: true });
  const participants = (participantsData ?? []).map((p) => p.name);

  const { data: sectionsData } = await supabase
    .from("report_sections_items")
    .select("section_type,content")
    .eq("report_id", id)
    .order("position", { ascending: true });

  const sectionMap: Record<string, string[]> = {
    consultant_feedback: [],
    client_feedback: [],
    next_objectives: [],
    training: [],
  };

  (sectionsData as SectionItem[] | null)?.forEach((item) => {
    sectionMap[item.section_type].push(item.content);
  });

  const { data: lastEmailLog } = await supabase
    .from("email_logs")
    .select("provider_message_id,status,created_at")
    .eq("report_id", typedReport.id)
    .eq("email_type", "consultant_validation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: emailHistory } = await supabase
    .from("email_logs")
    .select("id,email_type,recipient_email,status,created_at,error_message")
    .eq("report_id", typedReport.id)
    .order("created_at", { ascending: false });

  const saveFeedbackMode = save === "success" ? "success" : save === "error" ? "error" : null;

  return (
    <section className="space-y-6">
      <Link href={`/missions/${typedReport.mission_id}`} className="text-sm font-medium text-slate-700 underline">
        Retour a la mission
      </Link>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">
          {typedReport.type === "kickoff" ? "CR Demarrage" : "CR Suivi"} - {typedMission.consultant_first_name} {typedMission.consultant_last_name}
        </h2>
        <p className="mt-1 text-slate-600">Client : {typedMission.client_name}</p>
        <p className="text-slate-600">Date CR : {toFrenchDate(typedReport.report_date)}</p>
        {typedReport.consultant_last_edited_at ? (
          <p className="text-slate-600">
            Modifie par le consultant le {toFrenchDate(typedReport.consultant_last_edited_at)}
          </p>
        ) : null}
        <a
          href={`/api/reports/${typedReport.id}/pdf`}
          className="mt-3 inline-block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Exporter en PDF
        </a>
      </article>

      <form action={updateReportAction} className="space-y-5">
        <input type="hidden" name="report_id" value={typedReport.id} />
        <input type="hidden" name="mission_id" value={typedReport.mission_id} />
        <SaveCrFeedback mode={saveFeedbackMode} />

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Informations generales</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm text-slate-700">
              Date du CR
              <input name="report_date" type="date" required defaultValue={typedReport.report_date} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm text-slate-700">
              Dernier suivi
              <input
                name="last_followup_date"
                type="date"
                defaultValue={typedReport.last_followup_date ?? ""}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700">
              Prochain suivi
              <input
                name="next_followup_date"
                type="date"
                defaultValue={typedReport.next_followup_date ?? ""}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <ReportStatusSelect
              reportId={typedReport.id}
              missionId={typedReport.mission_id}
              initialStatus={typedReport.status}
            />
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Contenu du CR</h3>
          <p className="mt-1 text-sm text-slate-600">Un element par ligne.</p>
          <div className="mt-4 grid gap-4">
            <label className="text-sm text-slate-700">
              Participants presents
              <textarea name="participants" defaultValue={fromLines(participants)} rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm text-slate-700">
              Retours consultant
              <textarea
                name="consultant_feedback"
                defaultValue={fromLines(sectionMap.consultant_feedback)}
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700">
              Retours client
              <textarea
                name="client_feedback"
                defaultValue={fromLines(sectionMap.client_feedback)}
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700">
              Objectifs prochaine periode
              <textarea
                name="next_objectives"
                defaultValue={fromLines(sectionMap.next_objectives)}
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700">
              Formation a envisager
              <textarea
                name="training"
                defaultValue={fromLines(sectionMap.training)}
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </article>

        <SaveCrSubmitButton />
      </form>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Validation consultant</h3>
        <p className="mt-1 text-sm text-slate-600">
          Genere un lien magique unique (7 jours), passe le CR en attente de validation et envoie un email si Resend est configure.
        </p>
        <form action={sendToConsultantAction} className="mt-4 flex items-center gap-3">
          <input type="hidden" name="report_id" value={typedReport.id} />
          <input type="hidden" name="mission_id" value={typedReport.mission_id} />
          <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Envoyer au consultant
          </button>
        </form>
        {lastEmailLog?.provider_message_id?.startsWith("preview:") ? (
          <p className="mt-3 text-sm text-slate-700">
            Lien de validation (mode preview):{" "}
            <a className="underline" href={lastEmailLog.provider_message_id.replace("preview:", "")}>
              {lastEmailLog.provider_message_id.replace("preview:", "")}
            </a>
          </p>
        ) : null}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Historique des envois</h3>
        {!emailHistory || emailHistory.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Aucun envoi enregistre pour ce CR.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {emailHistory.map((log) => (
              <div key={log.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">
                  {log.email_type === "consultant_validation" ? "Consultant (validation)" : "Client"} - {log.recipient_email}
                </p>
                <p className="text-slate-600">Statut: {log.status} - Date: {toFrenchDate(log.created_at)}</p>
                {log.error_message ? <p className="text-red-700">Erreur: {log.error_message}</p> : null}
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
