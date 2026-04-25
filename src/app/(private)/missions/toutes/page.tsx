import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserSessionWithProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/rbac";

type MissionRow = {
  mission_id: string;
  owner_id: string;
  consultant_first_name: string;
  consultant_last_name: string;
  client_name: string;
  start_date: string;
  follow_up_frequency_days: number;
  latest_report_date: string | null;
  next_followup_date: string | null;
};

type MissionMeta = {
  id: string;
  owner_id: string;
  tjm: number | null;
  cj: number | null;
  consultant_type: string;
  next_followup_date: string | null;
};

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  manager_id: string | null;
  user_code: string | null;
};

type Badge = {
  label: string;
  classes: string;
  severity: "red" | "orange";
};

function getDurationBadge(startDate: string): Badge | null {
  const start = new Date(startDate);
  const now = new Date();
  const elapsedMonths = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  let label = "3ans";
  if (elapsedMonths < 36) label = `3ans-${36 - elapsedMonths}mois`;
  else if (elapsedMonths > 36) label = `3ans+${elapsedMonths - 36}mois`;
  if (elapsedMonths < 30) return null;
  if (elapsedMonths <= 41) return { label, classes: "bg-amber-50 text-amber-700 border-amber-200", severity: "orange" };
  return { label, classes: "bg-red-50 text-red-700 border-red-200", severity: "red" };
}

function getPlanningBadge(mission: MissionRow): Badge | null {
  if (mission.next_followup_date) return null;
  const baselineDate = mission.latest_report_date ?? mission.start_date;
  const baseline = new Date(`${baselineDate}T00:00:00`);
  const today = new Date();
  const elapsedDays = Math.floor((today.getTime() - baseline.getTime()) / (24 * 60 * 60 * 1000));
  const frequencyDays = mission.follow_up_frequency_days > 0 ? mission.follow_up_frequency_days : 90;
  const targetDate = new Date(baseline.getTime() + frequencyDays * 24 * 60 * 60 * 1000);
  const targetMonthRaw = targetDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const targetMonth = targetMonthRaw.charAt(0).toLocaleUpperCase("fr-FR") + targetMonthRaw.slice(1);
  if (elapsedDays > frequencyDays) {
    return { label: `A planifier - ${targetMonth}`, classes: "bg-red-50 text-red-700 border-red-200", severity: "red" };
  }
  return { label: `A planifier - ${targetMonth}`, classes: "bg-amber-50 text-amber-700 border-amber-200", severity: "orange" };
}

function getMarginBadge(meta: MissionMeta | undefined): Badge | null {
  if (!meta || meta.tjm === null || meta.cj === null || meta.tjm <= 0) return null;
  const rounded = Math.round((((meta.tjm - meta.cj) / meta.tjm) * 100) * 10) / 10;
  const label = `${rounded.toFixed(1)}%`;
  if (meta.consultant_type === "Consultant Externe") {
    if (rounded < 10) return { label, classes: "bg-red-50 text-red-700 border-red-200", severity: "red" };
    return null;
  }
  if (rounded < 20) return { label, classes: "bg-red-50 text-red-700 border-red-200", severity: "red" };
  if (rounded < 25) return { label, classes: "bg-amber-50 text-amber-700 border-amber-200", severity: "orange" };
  return null;
}

function getElapsedMonths(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
}

export default async function AllMissionsPage() {
  const { profile } = await requireUserSessionWithProfile();
  if (profile.role !== "directeur") {
    redirect("/missions");
  }
  if (!supabaseAdmin) {
    throw new Error("Client admin Supabase indisponible.");
  }

  const [{ data: healthRows, error: healthError }, { data: missionsMeta, error: metaError }, { data: profilesData, error: profileError }] =
    await Promise.all([
      supabaseAdmin
        .from("mission_health_view")
        .select("mission_id,owner_id,consultant_first_name,consultant_last_name,client_name,start_date,follow_up_frequency_days,latest_report_date,next_followup_date"),
      supabaseAdmin.from("missions").select("id,owner_id,tjm,cj,consultant_type,next_followup_date"),
      supabaseAdmin.from("profiles").select("id,first_name,last_name,role,manager_id,user_code"),
    ]);
  if (healthError || metaError || profileError) {
    throw new Error(healthError?.message ?? metaError?.message ?? profileError?.message ?? "Erreur chargement missions.");
  }

  const metaByMissionId = new Map<string, MissionMeta>((missionsMeta ?? []).map((m) => [String((m as MissionMeta).id), m as MissionMeta]));
  const profileById = new Map<string, Profile>((profilesData ?? []).map((p) => [String((p as Profile).id), p as Profile]));

  const missions = ((healthRows ?? []) as MissionRow[])
    .map((row) => {
      const meta = metaByMissionId.get(row.mission_id);
      const merged = { ...row, next_followup_date: meta?.next_followup_date ?? row.next_followup_date };
      const planning = getPlanningBadge(merged);
      const duration = getDurationBadge(merged.start_date);
      const margin = getMarginBadge(meta);
      const badges = [planning, duration, margin].filter((b): b is Badge => b !== null);
      const severityRank = badges.some((b) => b.severity === "red") ? 0 : badges.length > 0 ? 1 : 2;
      return { ...merged, badges, severityRank, elapsedMonths: getElapsedMonths(merged.start_date) };
    })
    .sort((a, b) => {
      if (a.severityRank !== b.severityRank) return a.severityRank - b.severityRank;
      if (a.elapsedMonths !== b.elapsedMonths) return b.elapsedMonths - a.elapsedMonths;
      return `${a.consultant_last_name} ${a.consultant_first_name}`.localeCompare(`${b.consultant_last_name} ${b.consultant_first_name}`, "fr", { sensitivity: "base" });
    });

  const grouped = missions.reduce<Record<string, Record<string, Record<string, typeof missions>>>>((acc, mission) => {
    const owner = profileById.get(mission.owner_id);
    const managerProfile = owner?.manager_id ? profileById.get(owner.manager_id) : null;

    const responsibleLabel =
      owner?.role === "commercial"
        ? managerProfile
          ? `${managerProfile.first_name} ${managerProfile.last_name}${managerProfile.user_code ? ` (${managerProfile.user_code})` : ""}`
          : "Responsable non renseigne"
        : owner
          ? `${owner.first_name} ${owner.last_name}${owner.user_code ? ` (${owner.user_code})` : ""}`
          : "Responsable inconnu";

    const commercialLabel = owner
      ? `${owner.first_name} ${owner.last_name}${owner.user_code ? ` (${owner.user_code})` : ""}`
      : "Commercial inconnu";
    const clientKey = mission.client_name || "Enseigne non renseignee";

    if (!acc[responsibleLabel]) acc[responsibleLabel] = {};
    if (!acc[responsibleLabel][commercialLabel]) acc[responsibleLabel][commercialLabel] = {};
    if (!acc[responsibleLabel][commercialLabel][clientKey]) acc[responsibleLabel][commercialLabel][clientKey] = [];
    acc[responsibleLabel][commercialLabel][clientKey].push(mission);
    return acc;
  }, {});

  const responsibleNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Toutes les missions</h2>
          <p className="mt-1 text-slate-600">Vue globale de toutes les missions NTICO.</p>
        </div>
        <Link href="/dashboard" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Retour au dashboard
        </Link>
      </div>

      {responsibleNames.map((responsible) => {
        const commercialMap = grouped[responsible];
        const commercialNames = Object.keys(commercialMap).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

        return (
          <article key={responsible} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">{responsible}</h3>
            <div className="mt-3 space-y-3">
              {commercialNames.map((commercial) => {
                const byClient = commercialMap[commercial];
                const clientNames = Object.keys(byClient).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
                return (
                  <div key={`${responsible}-${commercial}`} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">{commercial}</p>
                    <div className="mt-2 space-y-2">
                      {clientNames.map((clientName) => (
                        <div key={`${commercial}-${clientName}`} className="rounded-lg border border-slate-200">
                          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                            <p className="text-sm font-semibold text-slate-900">{clientName}</p>
                          </div>
                          <div className="space-y-2 p-3">
                            {byClient[clientName].map((mission) => (
                              <div key={mission.mission_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                                <div>
                                  <Link href={`/missions/${mission.mission_id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
                                    {mission.consultant_first_name} {mission.consultant_last_name}
                                  </Link>
                                  <p className="text-xs text-slate-600">{commercial}</p>
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
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}
