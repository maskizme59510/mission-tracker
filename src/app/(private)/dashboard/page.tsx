import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { toFrenchDate } from "@/lib/format";

type MissionAlertRow = {
  mission_id: string;
  consultant_first_name: string;
  consultant_last_name: string;
  client_name: string;
  start_date: string;
  latest_report_date: string | null;
  next_followup_date: string | null;
  follow_up_frequency_days: number;
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

type MarginAlert = {
  badge: AlertBadge | null;
  percent: number | null;
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

function getPlanningBadge(mission: MissionAlertRow): AlertBadge | null {
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

function getMarginAlert(margin: MissionMarginRow | undefined): MarginAlert {
  if (!margin || margin.tjm === null || margin.cj === null || margin.tjm <= 0) {
    return { badge: null, percent: null };
  }

  const marginPercent = ((margin.tjm - margin.cj) / margin.tjm) * 100;
  const rounded = Math.round(marginPercent * 10) / 10;
  return {
    badge: getMarginBadge(margin),
    percent: rounded,
  };
}

function getElapsedMonths(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
}

export default async function DashboardPage() {
  const { supabase, user } = await requireAdminSession();

  const [
    { count: activeMissions },
    { count: pendingValidations },
    { data: notifications },
    { data: healthRows, error: healthError },
    { data: marginsRows, error: marginsRowsError },
  ] =
    await Promise.all([
      supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "active").eq("owner_id", user.id),
      supabase
        .from("mission_health_view")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("latest_report_status", "pending_consultant_validation"),
      supabase
        .from("admin_notifications")
        .select(
          "id,title,message,created_at,read_at,report_id,report:mission_reports(type,mission:missions(owner_id,consultant_first_name,consultant_last_name,client_name))",
        )
        .is("read_at", null)
        .eq("report.mission.owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("mission_health_view")
        .select(
          "mission_id,consultant_first_name,consultant_last_name,client_name,start_date,follow_up_frequency_days,latest_report_date,next_followup_date",
        )
        .eq("owner_id", user.id)
        .order("next_followup_date", { ascending: true }),
      supabase.from("missions").select("id,tjm,cj,consultant_type,next_followup_date"),
    ]);

  if (healthError) {
    throw new Error(healthError.message);
  }
  if (marginsRowsError) {
    throw new Error(marginsRowsError.message);
  }

  const marginsByMissionId = new Map<string, MissionMarginRow>(
    (marginsRows ?? []).map((mission) => [mission.id, mission as MissionMarginRow]),
  );

  const alerts = ((healthRows ?? []) as MissionAlertRow[])
    .map((row) => {
      const missionMeta = marginsByMissionId.get(row.mission_id);
      const rowWithMissionNextFollowup = {
        ...row,
        next_followup_date: missionMeta?.next_followup_date ?? row.next_followup_date,
      };
      const marginAlert = getMarginAlert(missionMeta);
      const marginBadge = marginAlert.badge;
      const durationBadge = getMissionDurationBadge(row.start_date);
      const planningBadge = getPlanningBadge(rowWithMissionNextFollowup);
      const badges = [marginBadge, durationBadge, planningBadge].filter((badge): badge is AlertBadge => badge !== null);
      if (badges.length === 0) {
        return null;
      }

      const marginRank = marginBadge?.severity === "red" ? 0 : marginBadge?.severity === "orange" ? 1 : 2;
      return {
        ...row,
        badges,
        marginRank,
        marginPercent: marginAlert.percent,
        elapsedMonths: getElapsedMonths(row.start_date),
      };
    })
    .filter((alert): alert is NonNullable<typeof alert> => alert !== null)
    .sort((a, b) => {
      if (a.marginRank !== b.marginRank) {
        return a.marginRank - b.marginRank;
      }

      if (a.marginRank < 2 && a.marginPercent !== b.marginPercent) {
        return (a.marginPercent ?? Number.POSITIVE_INFINITY) - (b.marginPercent ?? Number.POSITIVE_INFINITY);
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

  const followupsToPlanCount = ((healthRows ?? []) as MissionAlertRow[]).filter((row) => {
    const missionMeta = marginsByMissionId.get(row.mission_id);
    const rowWithMissionNextFollowup = {
      ...row,
      next_followup_date: missionMeta?.next_followup_date ?? row.next_followup_date,
    };
    return getPlanningBadge(rowWithMissionNextFollowup) !== null;
  }).length;
  const activeMissionsCount = activeMissions ?? 0;
  const alertsPercentage = activeMissionsCount > 0 ? Math.round((alerts.length / activeMissionsCount) * 100) : 0;
  const alertsPercentageClass = alertsPercentage >= 65 ? "text-red-600" : alertsPercentage >= 40 ? "text-amber-600" : "text-emerald-600";
  const followupsToPlanRatio = activeMissionsCount > 0 ? (followupsToPlanCount / activeMissionsCount) * 100 : 0;
  const followupsToPlanClass =
    followupsToPlanRatio >= 30 ? "text-red-600" : followupsToPlanRatio >= 15 ? "text-amber-600" : "text-emerald-600";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Mon Tableau de bord</h2>
        <p className="mt-1 text-slate-600">Vue synthèse de mes missions, validations et notifications.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/missions" className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
          <p className="text-sm text-slate-500">Missions actives</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{activeMissions ?? 0}</p>
        </Link>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">CR en attente validation</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">{pendingValidations ?? 0}</p>
        </article>
        <Link href="/dashboard/suivis-a-planifier" className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
          <p className="text-sm text-slate-500">Suivis a planifier</p>
          <p className={`mt-2 text-3xl font-semibold ${followupsToPlanClass}`}>{followupsToPlanCount}</p>
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Notifications admin</h3>
        {!notifications || notifications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Aucune notification non lue.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">
                  {(() => {
                    const report = Array.isArray(notification.report) ? notification.report[0] : notification.report;
                    const mission = Array.isArray(report?.mission) ? report.mission[0] : report?.mission;
                    const reportType = report?.type === "kickoff" ? "Démarrage" : "Suivi";
                    const consultantFirstName = mission?.consultant_first_name ?? "";
                    const consultantLastName = mission?.consultant_last_name ?? "";
                    const clientName = mission?.client_name ?? "";
                    const fullName = `${consultantFirstName} ${consultantLastName}`.trim();
                    const eventDate = toFrenchDate(notification.created_at);
                    if (!fullName || !clientName) {
                      return `${notification.title} - ${eventDate}`;
                    }
                    return `✅ CR ${reportType} validé par ${fullName} - ${clientName} - ${eventDate}`;
                  })()}
                </p>
                <p className="mt-1 text-xs text-slate-500">{toFrenchDate(notification.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Alertes missions (<span className={alertsPercentageClass}>{alertsPercentage}%</span> - {alerts.length} missions en alerte)
            </h3>
            <p className="mt-1 text-sm text-slate-600">Affiche uniquement les missions avec alertes marge, duree ou suivi (orange/rouge).</p>
          </div>
          <span className="text-slate-500 group-open:hidden">▼</span>
          <span className="hidden text-slate-500 group-open:inline">▲</span>
        </summary>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Aucune mission a afficher.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {alerts.map((alert) => (
              <div key={alert.mission_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div>
                  <Link href={`/missions/${alert.mission_id}`} className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
                    {alert.consultant_first_name} {alert.consultant_last_name}
                  </Link>
                  <p className="text-xs text-slate-600">{alert.client_name || "Enseigne non renseignee"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {alert.badges.map((badge) => (
                    <span key={`${alert.mission_id}-${badge.label}`} className={`rounded-full border px-2 py-1 text-xs font-medium ${badge.classes}`}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </details>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Actions rapides</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/missions"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Voir les missions
          </Link>
        </div>
      </div>
    </section>
  );
}
