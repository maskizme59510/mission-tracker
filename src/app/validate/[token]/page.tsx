import { buildReportBody } from "@/lib/report-template";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fromLines } from "@/lib/format";
import { hashToken } from "@/lib/tokens";
import { LoadingSubmitButton } from "@/components/loading-submit-button";
import { confirmConsultantValidationAction, saveConsultantEditsAction } from "@/app/validate/[token]/actions";

type SectionType = "consultant_feedback" | "client_feedback" | "next_objectives" | "training";

export default async function ValidateReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ validated?: string; saved?: string }>;
}) {
  const { token } = await params;
  const { validated, saved } = await searchParams;
  const isValidatedSuccess = validated === "1";
  const isSavedSuccess = saved === "1";
  if (!supabaseAdmin) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
        <p className="rounded-md bg-red-50 px-3 py-2 text-red-700">Configuration serveur incomplete.</p>
      </main>
    );
  }

  const tokenHash = hashToken(token);
  const { data: tokenRow } = await supabaseAdmin
    .from("report_validation_tokens")
    .select("id,report_id,used_at,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!tokenRow) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Lien de validation introuvable</h1>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          Ce lien est invalide, a expire ou a deja ete revoque. Merci de contacter votre ingenieur d&apos;affaires.
        </p>
      </main>
    );
  }

  const isUsed = Boolean(tokenRow.used_at);
  const isExpired = new Date(tokenRow.expires_at).getTime() < Date.now();

  const { data: report } = await supabaseAdmin
    .from("mission_reports")
    .select("id,mission_id,report_date,last_followup_date,next_followup_date,status")
    .eq("id", tokenRow.report_id)
    .single();
  if (!report) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          Le compte-rendu associe a ce lien est introuvable.
        </p>
      </main>
    );
  }

  const { data: mission } = await supabaseAdmin
    .from("missions")
    .select("consultant_first_name,consultant_last_name,client_name,start_date")
    .eq("id", report.mission_id)
    .single();
  if (!mission) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          La mission associee a ce lien est introuvable.
        </p>
      </main>
    );
  }

  const { data: participantsData } = await supabaseAdmin
    .from("report_participants")
    .select("name")
    .eq("report_id", report.id)
    .order("position", { ascending: true });

  const { data: sectionData } = await supabaseAdmin
    .from("report_sections_items")
    .select("section_type,content")
    .eq("report_id", report.id)
    .order("position", { ascending: true });

  const sectionMap: Record<SectionType, string[]> = {
    consultant_feedback: [],
    client_feedback: [],
    next_objectives: [],
    training: [],
  };

  sectionData?.forEach((item) => {
    sectionMap[item.section_type as SectionType].push(item.content);
  });

  const reportBody = buildReportBody({
    consultantFullName: `${mission.consultant_first_name} ${mission.consultant_last_name}`,
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
    engineerFirstName: "",
  });

  const isActionDisabled = isUsed || isExpired || report.status === "validated" || report.status === "sent_to_client";

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Validation du compte-rendu de mission</h1>
        <p className="mt-1 text-slate-600">Merci de verifier le contenu ci-dessous avant validation.</p>
      </header>

      {isValidatedSuccess && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800">
          Merci, votre validation a bien ete prise en compte.
        </p>
      )}
      {isSavedSuccess && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-blue-800">
          Modifications enregistrees avec succes. Vous pouvez encore ajuster puis valider.
        </p>
      )}

      {(isUsed || isExpired) && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          {isUsed ? "Ce lien a deja ete utilise." : "Ce lien a expire. Merci de contacter votre ingenieur d'affaires."}
        </p>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <pre className="whitespace-pre-wrap text-sm text-slate-500">{reportBody}</pre>
      </article>

      {!isValidatedSuccess && !isActionDisabled ? (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Modifier le contenu du CR</h2>
          <p className="mt-1 text-sm text-slate-600">
            Vous pouvez ajuster les sections ci-dessous, enregistrer, puis valider definitivement.
          </p>

          <form action={saveConsultantEditsAction} className="mt-4 space-y-3">
            <input type="hidden" name="token" value={token} />
            <label className="block text-sm text-slate-700">
              Retours consultant
              <textarea
                name="consultant_feedback"
                rows={4}
                defaultValue={fromLines(sectionMap.consultant_feedback)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Retours client
              <textarea
                name="client_feedback"
                rows={4}
                defaultValue={fromLines(sectionMap.client_feedback)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Objectifs
              <textarea
                name="next_objectives"
                rows={4}
                defaultValue={fromLines(sectionMap.next_objectives)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Formation
              <textarea
                name="training"
                rows={4}
                defaultValue={fromLines(sectionMap.training)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <LoadingSubmitButton
              label="Enregistrer les modifications"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            />
          </form>

          <form action={confirmConsultantValidationAction} className="mt-3">
            <input type="hidden" name="token" value={token} />
            <LoadingSubmitButton
              label="Je valide ce compte-rendu"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            />
          </form>
        </article>
      ) : null}
    </main>
  );
}
