import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { DeleteReportButton } from "@/components/delete-report-button";
import { InlineReportStatusSelect } from "@/components/inline-report-status-select";
import { LoadingSubmitButton } from "@/components/loading-submit-button";
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
  consultant_type: string;
  consultant_email: string;
  client_name: string;
  commercial: string | null;
  client_operational_contact: string | null;
  client_contact_email: string;
  start_date: string;
  follow_up_frequency_days: number;
  last_followup_date: string | null;
  next_followup_date: string | null;
  tjm: number | null;
  cj: number | null;
};

type Report = {
  id: string;
  type: "kickoff" | "followup";
  report_date: string;
  next_followup_date: string | null;
  status: "draft" | "pending_consultant_validation" | "validated" | "sent_to_client";
};

function missionDurationLabel(startDate: string) {
  const start = new Date(startDate);
  const now = new Date();
  const totalMonths = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
  );
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years < 1) {
    return `En mission depuis ${months} mois`;
  }

  return `En mission depuis ${years} an(s) et ${months} mois`;
}

function toReportHistoryLabel(reportDate: string, mission: Mission) {
  const clientToken = mission.client_name.trim().toLocaleUpperCase("fr-FR").replace(/\s+/g, "_");
  const consultantFirstName = mission.consultant_first_name.trim();
  const consultantLastInitial = (mission.consultant_last_name.trim().charAt(0) || "").toLocaleUpperCase("fr-FR");
  return `CR_${clientToken}_${consultantFirstName} ${consultantLastInitial}_${toFrenchDate(reportDate)}`;
}

export default async function MissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ createReport?: string; createReportError?: string }>;
}) {
  const { id } = await params;
  const { createReport, createReportError } = await searchParams;
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

  const latestReport = typedReports[0] ?? null;
  const lastFollowupDisplayDate = latestReport?.report_date ?? null;
  const nextPlannedDate = typedMission.next_followup_date ?? (latestReport?.next_followup_date ?? null);

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
            initialConsultantType={typedMission.consultant_type}
            initialConsultantEmail={typedMission.consultant_email}
            initialClientName={typedMission.client_name}
            initialCommercial={typedMission.commercial}
            initialClientOperationalContact={typedMission.client_operational_contact}
            initialStartDate={typedMission.start_date}
            initialTjm={typedMission.tjm}
            initialCj={typedMission.cj}
            initialFollowUpFrequencyDays={typedMission.follow_up_frequency_days}
            action={updateMissionIdentityAction}
          />
        </div>
        <p className="mt-1 text-slate-600">Debut mission : {toFrenchDate(typedMission.start_date)}</p>
        <p className="text-slate-600">Commercial : {typedMission.commercial || "Non renseigne"}</p>
        <p className="text-slate-600">{missionDurationLabel(typedMission.start_date)}</p>
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
              {lastFollowupDisplayDate ? toFrenchDate(lastFollowupDisplayDate) : "Aucun suivi effectue"}
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
        {createReport === "success" ? (
          <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✅ CR de suivi cree avec succes.</p>
        ) : null}
        {createReport === "error" ? (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            ❌ Erreur lors de la creation du CR : {createReportError ?? "Veuillez reessayer."}
          </p>
        ) : null}
        <form action={createFollowupReportAction} className="mt-4">
          <input type="hidden" name="mission_id" value={typedMission.id} />
          <LoadingSubmitButton
            label="Creer un nouveau CR"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          />
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
                <Link
                  href={`/reports/${report.id}/edit`}
                  className="text-sm text-slate-800 underline-offset-2 hover:underline"
                >
                  {toReportHistoryLabel(report.report_date, typedMission)}
                </Link>
                <div className="flex items-center gap-2">
                  <InlineReportStatusSelect
                    reportId={report.id}
                    missionId={typedMission.id}
                    initialStatus={report.status}
                  />
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
