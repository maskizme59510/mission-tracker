import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { DeleteReportButton } from "@/components/delete-report-button";
import { MissionIdentityEditor, NextFollowupEditor } from "@/components/mission-detail-editors";
import { toFrenchDate } from "@/lib/format";
import { DeleteMissionButton } from "@/components/delete-mission-button";
import {
  createFollowupReportAction,
  deleteMissionAction,
  deleteReportAction,
  updateMissionIdentityAction,
  updateMissionNextFollowupAction,
} from "@/app/(private)/missions/actions";

type Mission = {
  id: string;
  consultant_first_name: string;
  consultant_last_name: string;
  consultant_email: string;
  client_name: string;
  client_contact_email: string;
  start_date: string;
  follow_up_frequency_days: number;
};

type Report = {
  id: string;
  type: "kickoff" | "followup";
  report_date: string;
  next_followup_date: string | null;
  status: "draft" | "pending_consultant_validation" | "validated" | "sent_to_client";
};

function statusMeta(status: Report["status"]) {
  if (status === "draft") return { label: "Brouillon", classes: "bg-slate-100 text-slate-700 border-slate-300" };
  if (status === "pending_consultant_validation")
    return { label: "Envoye consultant", classes: "bg-orange-50 text-orange-700 border-orange-200" };
  if (status === "validated") return { label: "Valide consultant", classes: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Transmis au client", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminSession();

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("*")
    .eq("id", id)
    .single();
  if (missionError) throw new Error(missionError.message);
  if (!mission) notFound();

  const { data: reports, error: reportsError } = await supabase
    .from("mission_reports")
    .select("id,type,report_date,next_followup_date,status")
    .eq("mission_id", id)
    .order("report_date", { ascending: false });
  if (reportsError) throw new Error(reportsError.message);

  const typedMission = mission as Mission;
  const typedReports = (reports ?? []) as Report[];

  const latestReport = typedReports[0];
  const defaultReportDate = new Date().toISOString().slice(0, 10);
  const lastValidatedReport = typedReports.find((report) => report.status === "validated" || report.status === "sent_to_client");
  const nextPlannedDate = latestReport?.next_followup_date ?? null;

  return (
    <section className="space-y-6">
      <Link href="/missions" className="text-sm font-medium text-slate-700 underline">
        Retour a la liste des missions
      </Link>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-slate-900">
            {typedMission.consultant_first_name} {typedMission.consultant_last_name} - {typedMission.client_name}
          </h2>
          <MissionIdentityEditor
            missionId={typedMission.id}
            initialConsultantFirstName={typedMission.consultant_first_name}
            initialConsultantLastName={typedMission.consultant_last_name}
            initialClientName={typedMission.client_name}
            action={updateMissionIdentityAction}
          />
        </div>
        <p className="mt-1 text-slate-600">
          Debut mission : {toFrenchDate(typedMission.start_date)} - Frequence : {typedMission.follow_up_frequency_days} jours
        </p>
        <form action={deleteMissionAction} className="mt-4">
          <input type="hidden" name="mission_id" value={typedMission.id} />
          <DeleteMissionButton />
        </form>
        <p className="mt-2 text-xs text-slate-500">
          La suppression retire definitivement la mission, ses CR, participants, sections, tokens de validation et logs email associes.
        </p>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Suivi de mission</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-900">Dernier suivi de mission</p>
            <p className="mt-1 text-sm text-slate-700">
              {lastValidatedReport ? toFrenchDate(lastValidatedReport.report_date) : "Aucun suivi effectue"}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-900">Prochain suivi planifie</p>
            <div className="mt-1 text-sm text-slate-700">
              {nextPlannedDate ? null : <p className="mb-2">A planifier</p>}
              <NextFollowupEditor
                missionId={typedMission.id}
                initialNextFollowupDate={nextPlannedDate}
                displayNextFollowupText={toFrenchDate(nextPlannedDate)}
                action={updateMissionNextFollowupAction}
              />
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Creer un CR de suivi</h3>
        <form action={createFollowupReportAction} className="mt-4 grid gap-3 md:grid-cols-4">
          <input type="hidden" name="mission_id" value={typedMission.id} />
          <label className="text-sm text-slate-700">
            Date du CR
            <input name="report_date" type="date" required defaultValue={defaultReportDate} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-700">
            Dernier suivi
            <input
              name="last_followup_date"
              type="date"
              defaultValue={latestReport?.report_date ?? typedMission.start_date}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-700">
            Prochain suivi
            <input name="next_followup_date" type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Creer CR suivi
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Historique des CR</h3>
        {typedReports.length === 0 ? (
          <p className="mt-3 text-slate-600">Aucun CR pour cette mission.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {typedReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm text-slate-800">
                  {report.type === "kickoff" ? "CR Demarrage" : "CR Suivi"} - {toFrenchDate(report.report_date)}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusMeta(report.status).classes}`}>
                    {statusMeta(report.status).label}
                  </span>
                  <Link href={`/reports/${report.id}/edit`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
                    Editer
                  </Link>
                  <form action={deleteReportAction}>
                    <input type="hidden" name="mission_id" value={typedMission.id} />
                    <input type="hidden" name="report_id" value={report.id} />
                    <DeleteReportButton />
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
