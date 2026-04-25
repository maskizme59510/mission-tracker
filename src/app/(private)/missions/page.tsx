import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { toFrenchDate } from "@/lib/format";
import { createMissionAction } from "@/app/(private)/missions/actions";
import { ConsultantContactFields } from "@/components/consultant-contact-fields";
import { LoadingSubmitButton } from "@/components/loading-submit-button";
import { UppercaseInput } from "@/components/uppercase-input";

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
};

function getMissionDurationBadge(startDate: string): { label: string; classes: string } | null {
  const start = new Date(startDate);
  const now = new Date();
  const elapsedMonths = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
  );

  let label = "3ans";
  if (elapsedMonths < 36) {
    label = `3ans-${36 - elapsedMonths}mois`;
  } else if (elapsedMonths > 36) {
    label = `3ans+${elapsedMonths - 36}mois`;
  }

  if (elapsedMonths < 30) {
    return null;
  }
  if (elapsedMonths <= 41) {
    return { label, classes: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { label, classes: "bg-red-50 text-red-700 border-red-200" };
}

function getPlanningBadge(mission: MissionRow): { label: string; classes: string } | null {
  if (mission.next_followup_date) {
    return null;
  }

  const baselineDate = mission.latest_report_date ?? mission.start_date;
  const baseline = new Date(`${baselineDate}T00:00:00`);
  const today = new Date();
  const msInDay = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.floor((today.getTime() - baseline.getTime()) / msInDay);
  const frequencyDays = mission.follow_up_frequency_days > 0 ? mission.follow_up_frequency_days : 90;
  const targetDate = new Date(baseline.getTime() + frequencyDays * msInDay);
  const targetMonthRaw = targetDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const targetMonth = targetMonthRaw.charAt(0).toLocaleUpperCase("fr-FR") + targetMonthRaw.slice(1);

  if (elapsedDays > frequencyDays) {
    return { label: `A planifier - ${targetMonth}`, classes: "bg-red-50 text-red-700 border-red-200" };
  }

  return {
    label: `A planifier - ${targetMonth}`,
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  };
}

export default async function MissionsPage() {
  const { supabase } = await requireAdminSession();
  const { data, error } = await supabase
    .from("mission_health_view")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const missionIds = (data ?? []).map((row) => String((row as { mission_id: string }).mission_id));
  const { data: marginsData, error: marginsError } = await supabase
    .from("missions")
    .select("id,tjm,cj,consultant_type")
    .in("id", missionIds);
  if (marginsError) {
    throw new Error(marginsError.message);
  }

  const missions = (data ?? []) as MissionRow[];
  const marginsByMissionId = new Map<string, MissionMarginRow>((marginsData ?? []).map((item) => [item.id, item as MissionMarginRow]));
  const missionsByClient = missions.reduce<Record<string, MissionRow[]>>((accumulator, mission) => {
    const key = mission.client_name || "Enseigne non renseignee";
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(mission);
    return accumulator;
  }, {});

  const sortedClientNames = Object.keys(missionsByClient).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

  function getMarginBadge(missionId: string) {
    const row = marginsByMissionId.get(missionId);
    if (!row || row.tjm === null || row.cj === null || row.tjm <= 0) return null;

    const marginPercent = ((row.tjm - row.cj) / row.tjm) * 100;
    const rounded = Math.round(marginPercent * 10) / 10;
    const label = `${rounded.toFixed(1)}%`;

    if (row.consultant_type === "Consultant Externe") {
      if (rounded < 10) {
        return { label, classes: "bg-red-50 text-red-700 border-red-200" };
      }
      return { label, classes: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }

    if (rounded < 20) {
      return { label, classes: "bg-red-50 text-red-700 border-red-200" };
    }
    if (rounded < 25) {
      return { label, classes: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    return { label, classes: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Missions</h2>
          <p className="mt-1 text-slate-600">Creation, suivi et pilotage des missions consultants.</p>
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

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Liste des missions ({missions.length})</h3>
        {missions.length === 0 ? (
          <p className="mt-3 text-slate-600">Aucune mission pour le moment.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedClientNames.map((clientName) => (
              <div key={clientName} className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {clientName} ({missionsByClient[clientName].length})
                  </p>
                </div>
                <div className="space-y-2 p-3">
                  {missionsByClient[clientName]
                    .slice()
                    .sort((a, b) => {
                      const dateDiff = new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
                      if (dateDiff !== 0) return dateDiff;
                      return `${a.consultant_last_name} ${a.consultant_first_name}`.localeCompare(
                        `${b.consultant_last_name} ${b.consultant_first_name}`,
                        "fr",
                        { sensitivity: "base" },
                      );
                    })
                    .map((mission) => {
                      const durationBadge = getMissionDurationBadge(mission.start_date);
                      const planningBadge = getPlanningBadge(mission);
                      const marginBadge = getMarginBadge(mission.mission_id);
                      return (
                        <div key={mission.mission_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                          <div>
                            <Link
                              href={`/missions/${mission.mission_id}`}
                              className="font-medium text-slate-900 underline-offset-2 hover:underline"
                            >
                              {mission.consultant_first_name} {mission.consultant_last_name}
                            </Link>
                            <p className="text-sm text-slate-600">Prochain suivi : {toFrenchDate(mission.next_followup_date)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {durationBadge ? (
                              <span className={`rounded-full border px-2 py-1 text-xs font-medium ${durationBadge.classes}`}>
                                {durationBadge.label}
                              </span>
                            ) : null}
                            {marginBadge ? (
                              <span className={`rounded-full border px-2 py-1 text-xs font-medium ${marginBadge.classes}`}>
                                {marginBadge.label}
                              </span>
                            ) : null}
                            {planningBadge ? (
                              <span className={`rounded-full border px-2 py-1 text-xs font-medium ${planningBadge.classes}`}>
                                {planningBadge.label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
