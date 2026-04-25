import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";

type MissionFollowupRow = {
  mission_id: string;
  consultant_first_name: string;
  consultant_last_name: string;
  client_name: string;
  start_date: string;
  follow_up_frequency_days: number;
  latest_report_date: string | null;
  next_followup_date: string | null;
};

type MissionMarginRow = {
  id: string;
  tjm: number | null;
  cj: number | null;
  consultant_type: string;
  next_followup_date: string | null;
};

type AlertBadge = {
  label: string;
  classes: string;
  severity: "red" | "orange";
};

function getMissionDurationBadge(startDate: string): AlertBadge | null {
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
    return { label, classes: "bg-amber-50 text-amber-700 border-amber-200", severity: "orange" };
  }
  return { label, classes: "bg-red-50 text-red-700 border-red-200", severity: "red" };
}

function getPlanningBadge(mission: MissionFollowupRow): AlertBadge | null {
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
    return { label: `A planifier - ${targetMonth}`, classes: "bg-red-50 text-red-700 border-red-200", severity: "red" };
  }

  return {
    label: `A planifier - ${targetMonth}`,
    classes: "bg-amber-50 text-amber-700 border-amber-200",
    severity: "orange",
  };
}

function getMarginBadge(margin: MissionMarginRow | undefined): AlertBadge | null {
  if (!margin || margin.tjm === null || margin.cj === null || margin.tjm <= 0) return null;

  const marginPercent = ((margin.tjm - margin.cj) / margin.tjm) * 100;
  const rounded = Math.round(marginPercent * 10) / 10;
  const label = `${rounded.toFixed(1)}%`;

  if (margin.consultant_type === "Consultant Externe") {
    if (rounded < 10) {
      return { label, classes: "bg-red-50 text-red-700 border-red-200", severity: "red" };
    }
    return null;
  }

  if (rounded < 20) {
    return { label, classes: "bg-red-50 text-red-700 border-red-200", severity: "red" };
  }
  if (rounded < 25) {
    return { label, classes: "bg-amber-50 text-amber-700 border-amber-200", severity: "orange" };
  }
  return null;
}

function getElapsedMonths(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
}

export default async function FollowupsToPlanPage() {
  const { supabase } = await requireAdminSession();

  const [{ data: healthRows, error: healthError }, { data: missionRows, error: missionError }] = await Promise.all([
    supabase
      .from("mission_health_view")
      .select(
        "mission_id,consultant_first_name,consultant_last_name,client_name,start_date,follow_up_frequency_days,latest_report_date,next_followup_date",
      )
      .order("start_date", { ascending: false }),
    supabase.from("missions").select("id,tjm,cj,consultant_type,next_followup_date"),
  ]);

  if (healthError) {
    throw new Error(healthError.message);
  }
  if (missionError) {
    throw new Error(missionError.message);
  }

  const missionMetaById = new Map<string, MissionMarginRow>(
    (missionRows ?? []).map((mission) => [mission.id, mission as MissionMarginRow]),
  );

  const alerts = ((healthRows ?? []) as MissionFollowupRow[])
    .map((row) => {
      const missionMeta = missionMetaById.get(row.mission_id);
      const mergedMission = {
        ...row,
        next_followup_date: missionMeta?.next_followup_date ?? row.next_followup_date,
      };

      if (mergedMission.next_followup_date !== null) {
        return null;
      }

      const planningBadge = getPlanningBadge(mergedMission);
      if (!planningBadge) {
        return null;
      }

      const durationBadge = getMissionDurationBadge(mergedMission.start_date);
      const marginBadge = getMarginBadge(missionMeta);
      const badges = [planningBadge, durationBadge, marginBadge].filter((badge): badge is AlertBadge => badge !== null);
      const severityRank = badges.some((badge) => badge.severity === "red") ? 0 : 1;

      return {
        ...mergedMission,
        badges,
        severityRank,
        elapsedMonths: getElapsedMonths(mergedMission.start_date),
      };
    })
    .filter((alert): alert is NonNullable<typeof alert> => alert !== null)
    .sort((a, b) => {
      if (a.severityRank !== b.severityRank) {
        return a.severityRank - b.severityRank;
      }
      if (a.elapsedMonths !== b.elapsedMonths) {
        return b.elapsedMonths - a.elapsedMonths;
      }
      return `${a.consultant_last_name} ${a.consultant_first_name}`.localeCompare(
        `${b.consultant_last_name} ${b.consultant_first_name}`,
        "fr",
        { sensitivity: "base" },
      );
    });

  const alertsByClient = alerts.reduce<Record<string, (typeof alerts)[number][]>>((accumulator, alert) => {
    const key = alert.client_name || "Enseigne non renseignee";
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(alert);
    return accumulator;
  }, {});
  const sortedClientNames = Object.keys(alertsByClient).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Suivis a planifier</h2>
        <Link href="/dashboard" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Retour au dashboard
        </Link>
      </div>

      {alerts.length === 0 ? (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-slate-600">Aucune mission a planifier.</p>
        </article>
      ) : (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Missions ({alerts.length})</h3>
          <div className="mt-4 space-y-3">
            {sortedClientNames.map((clientName) => (
              <div key={clientName} className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {clientName} ({alertsByClient[clientName].length})
                  </p>
                </div>
                <div className="space-y-2 p-3">
                  {alertsByClient[clientName].map((mission) => (
                    <div key={mission.mission_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                      <div>
                        <Link
                          href={`/missions/${mission.mission_id}`}
                          className="font-medium text-slate-900 underline-offset-2 hover:underline"
                        >
                          {mission.consultant_first_name} {mission.consultant_last_name}
                        </Link>
                        <p className="text-sm text-slate-600">{mission.client_name || "Enseigne non renseignee"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {mission.badges.map((badge) => (
                          <span key={`${mission.mission_id}-${badge.label}`} className={`rounded-full border px-2 py-1 text-xs font-medium ${badge.classes}`}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
