import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { toFrenchDate } from "@/lib/format";

export default async function DashboardPage() {
  const { supabase } = await requireAdminSession();

  const [
    { count: activeMissions },
    { count: pendingValidations },
    { count: overdueFollowups },
    { data: notifications },
    { data: healthRows, error: healthError },
    { data: missionsRows, error: missionsRowsError },
  ] =
    await Promise.all([
      supabase.from("missions").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("mission_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_consultant_validation"),
      supabase.from("mission_health_view").select("*", { count: "exact", head: true }).eq("is_follow_up_overdue", true),
      supabase
        .from("admin_notifications")
        .select(
          "id,title,message,created_at,read_at,report_id,report:mission_reports(type,mission:missions(consultant_first_name,consultant_last_name,client_name))",
        )
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("mission_health_view")
        .select(
          "mission_id,consultant_first_name,consultant_last_name,client_name,latest_report_date,next_followup_date,is_follow_up_within_14_days",
        )
        .order("next_followup_date", { ascending: true }),
      supabase.from("missions").select("id,last_followup_date,next_followup_date"),
    ]);

  if (healthError) {
    throw new Error(healthError.message);
  }
  if (missionsRowsError) {
    throw new Error(missionsRowsError.message);
  }

  const missionMetaById = new Map(
    (missionsRows ?? []).map((mission) => [mission.id, mission]),
  );

  const alerts = (healthRows ?? [])
    .map((row) => {
      const today = new Date();
      const missionMeta = missionMetaById.get(row.mission_id);
      const lastFollowupSource = row.latest_report_date ?? missionMeta?.last_followup_date ?? null;
      const nextFollowupSource = missionMeta?.next_followup_date ?? null;
      const lastFollowupDate = lastFollowupSource ? new Date(lastFollowupSource) : null;
      const daysSinceLastFollowup = lastFollowupDate
        ? Math.floor((today.getTime() - lastFollowupDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const delayDays = Math.max(0, daysSinceLastFollowup - 90);

      let priority = 4;
      let label = "🟢 Mission a jour";
      let classes = "border-emerald-200 bg-emerald-50 text-emerald-800";

      if (daysSinceLastFollowup > 120) {
        priority = 1;
        label = `🔴 CRITIQUE - Suivi tres en retard - ${delayDays} jours de retard`;
        classes = "border-red-200 bg-red-50 text-red-800";
      } else if (daysSinceLastFollowup > 90) {
        priority = 2;
        label = `🟠 Suivi en retard - ${delayDays} jours de retard`;
        classes = "border-orange-200 bg-orange-50 text-orange-800";
      } else if (row.is_follow_up_within_14_days) {
        priority = 3;
        label = "📅 Prochain suivi < 14 jours";
        classes = "border-blue-200 bg-blue-50 text-blue-800";
      }

      return {
        ...row,
        last_followup_display_date: lastFollowupSource,
        next_followup_display_date: nextFollowupSource,
        priority,
        label,
        classes,
      };
    })
    .sort((a, b) => a.priority - b.priority);
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
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-slate-600">Vue synthese missions, validations et notifications.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Missions actives</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{activeMissions ?? 0}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">CR en attente validation</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">{pendingValidations ?? 0}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Suivis en retard</p>
          <p className="mt-2 text-3xl font-semibold text-red-600">{overdueFollowups ?? 0}</p>
        </article>
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Alertes missions</h3>
        <p className="mt-1 text-sm text-slate-600">Priorite: retard, validation en attente, suivi a venir, puis missions a jour.</p>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Aucune mission a afficher.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {sortedClientNames.map((clientName) => (
              <div key={clientName} className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                  <p className="text-sm font-semibold text-slate-900">{clientName}</p>
                </div>
                <div className="space-y-2 p-3">
                  {alertsByClient[clientName].map((alert) => (
                    <div key={alert.mission_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {alert.consultant_first_name} {alert.consultant_last_name}
                        </p>
                        <p className="text-xs text-slate-600">
                          Dernier suivi de mission:{" "}
                          {alert.last_followup_display_date ? toFrenchDate(alert.last_followup_display_date) : "Aucun suivi effectue"}
                        </p>
                        <p className="text-xs text-slate-600">
                          Prochain suivi planifie:{" "}
                          {alert.next_followup_display_date ? toFrenchDate(alert.next_followup_display_date) : "A planifier"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${alert.classes}`}>{alert.label}</span>
                        <Link href={`/missions/${alert.mission_id}`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                          Ouvrir
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
