import { requireAdminSession } from "@/lib/auth";
import { createMissionAction } from "@/app/(private)/missions/actions";
import { ConsultantContactFields } from "@/components/consultant-contact-fields";
import { LoadingSubmitButton } from "@/components/loading-submit-button";
import { UppercaseInput } from "@/components/uppercase-input";
import { deriveCommercialFromUser } from "@/lib/commercial";
import { fetchProfileCommercialUserCodes } from "@/lib/profile-commercial-codes";
import { MissionsListView, type MissionsListMarginRow, type MissionsListMissionRow } from "@/components/missions-list-view";

type MissionRow = {
  mission_id: string;
  consultant_first_name: string;
  consultant_last_name: string;
  client_name: string;
  start_date: string;
  follow_up_frequency_days: number;
  latest_report_date: string | null;
  mission_status: "active" | "paused" | "closed";
  next_followup_date: string | null;
  is_follow_up_overdue: boolean | null;
  is_follow_up_within_14_days: boolean | null;
  is_pending_validation_over_5_days: boolean | null;
  health_color: "red" | "yellow" | "green" | null;
};

type MissionMarginRow = {
  id: string;
  tjm: number | null;
  cj: number | null;
  consultant_type: string;
  commercial: string | null;
};

function isColumnMissingError(message: string | undefined) {
  const raw = (message ?? "").toLowerCase();
  return raw.includes("column") && (raw.includes("does not exist") || raw.includes("not found"));
}

export default async function MissionsPage() {
  const { supabase, user } = await requireAdminSession();
  const { data, error } = await supabase
    .from("mission_health_view")
    .select("*")
    .eq("owner_id", user.id)
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const missionIds = (data ?? []).map((row) => String((row as { mission_id: string }).mission_id));
  let marginsData: MissionMarginRow[] | null = null;
  const marginsQuery = await supabase
    .from("missions")
    .select("id,tjm,cj,consultant_type,commercial")
    .in("id", missionIds);
  if (marginsQuery.error && isColumnMissingError(marginsQuery.error.message)) {
    const fallbackQuery = await supabase
      .from("missions")
      .select("id,tjm,cj,consultant_type")
      .in("id", missionIds);
    if (fallbackQuery.error) {
      throw new Error(fallbackQuery.error.message);
    }
    marginsData = (fallbackQuery.data ?? []).map((item) => ({ ...(item as MissionMarginRow), commercial: null }));
  } else if (marginsQuery.error) {
    throw new Error(marginsQuery.error.message);
  } else {
    marginsData = (marginsQuery.data ?? []) as MissionMarginRow[];
  }

  const missions = (data ?? []) as MissionRow[];
  const marginsByMissionId = new Map<string, MissionMarginRow>((marginsData ?? []).map((item) => [item.id, item as MissionMarginRow]));
  const defaultCommercial = deriveCommercialFromUser(user) ?? "";
  const commercialUserCodesRaw = await fetchProfileCommercialUserCodes(supabase);
  const commercialUserCodesSet = new Set(commercialUserCodesRaw);
  if (defaultCommercial) {
    commercialUserCodesSet.add(defaultCommercial);
  }
  const commercialUserCodes = [...commercialUserCodesSet].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  const defaultCommercialSelect = defaultCommercial || commercialUserCodes[0] || "";
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Mes Missions</h2>
          <p className="mt-1 text-slate-600">Création, suivi et pilotage de mes missions consultants.</p>
        </div>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Nouvelle mission</h3>
        <form action={createMissionAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <ConsultantContactFields />
          <UppercaseInput
            name="client_name"
            required
            placeholder="Nom de l'enseigne"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            name="client_operational_contact"
            placeholder="Responsable de mission cote client (optionnel)"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <label className="text-sm text-slate-700">
            Commercial
            <select
              name="commercial"
              defaultValue={defaultCommercialSelect}
              required={commercialUserCodes.length > 0}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {commercialUserCodes.length === 0 ? (
                <option value="">—</option>
              ) : null}
              {commercialUserCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Date de demarrage de mission
            <input name="start_date" type="date" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-700">
            Date du dernier suivi de mission
            <input
              name="last_followup_date"
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-700">
            Date du prochain suivi planifie
            <input
              name="next_followup_date"
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-700 md:col-span-1">
            Frequence de suivi (en jours)
            <select
              name="follow_up_frequency_days"
              defaultValue="90"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="30">Mensuel (30 jours)</option>
              <option value="90">Trimestriel (90 jours)</option>
              <option value="120">Tous les 4 mois (120 jours)</option>
              <option value="150">Tous les 5 mois (150 jours)</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            TJM (€ HT)
            <input
              name="tjm"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex: 650"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-700">
            CJ (€ HT)
            <input
              name="cj"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex: 750"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <LoadingSubmitButton
            label="Valider"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 md:col-span-2 md:w-fit"
          />
        </form>
      </article>

      <MissionsListView
        missions={missions as MissionsListMissionRow[]}
        marginsByMissionId={marginsByMissionId as Map<string, MissionsListMarginRow>}
        listTitle={`Liste de mes missions (${missions.length})`}
      />
    </section>
  );
}
