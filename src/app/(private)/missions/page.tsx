import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { toFrenchDate } from "@/lib/format";
import { createMissionAction } from "@/app/(private)/missions/actions";

type MissionRow = {
  mission_id: string;
  consultant_first_name: string;
  consultant_last_name: string;
  client_name: string;
  mission_status: "active" | "paused" | "closed";
  next_followup_date: string | null;
  is_follow_up_overdue: boolean | null;
  is_follow_up_within_14_days: boolean | null;
  is_pending_validation_over_5_days: boolean | null;
  health_color: "red" | "yellow" | "green" | null;
};

function badgeColor(healthColor: MissionRow["health_color"]) {
  if (healthColor === "red") return "bg-red-50 text-red-700 border-red-200";
  if (healthColor === "yellow") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
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

  const missions = (data ?? []) as MissionRow[];

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
          <input name="consultant_first_name" required placeholder="Prenom consultant" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="consultant_last_name" required placeholder="Nom consultant" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="consultant_email" type="email" required placeholder="Email consultant" className="rounded-md border border-slate-300 px-3 py-2" />
          <input name="client_name" required placeholder="Nom de l'enseigne" className="rounded-md border border-slate-300 px-3 py-2" />
          <input
            name="client_operational_contact"
            placeholder="Responsable de mission cote client (optionnel)"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <input name="start_date" type="date" required className="rounded-md border border-slate-300 px-3 py-2" />
          <label className="text-sm text-slate-700 md:col-span-1">
            Frequence de suivi (en jours)
            <input
              name="follow_up_frequency_days"
              type="number"
              min={1}
              defaultValue={90}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">90 jours = trimestriel (recommande)</span>
          </label>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 md:col-span-2 md:w-fit"
          >
            Creer la mission (avec CR de demarrage)
          </button>
        </form>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Liste des missions</h3>
        {missions.length === 0 ? (
          <p className="mt-3 text-slate-600">Aucune mission pour le moment.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {missions.map((mission) => (
              <div key={mission.mission_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {mission.consultant_first_name} {mission.consultant_last_name} - {mission.client_name}
                  </p>
                  <p className="text-sm text-slate-600">Prochain suivi : {toFrenchDate(mission.next_followup_date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-xs font-medium ${badgeColor(mission.health_color)}`}>
                    {mission.is_follow_up_overdue
                      ? "Suivi en retard"
                      : mission.is_pending_validation_over_5_days
                        ? "Validation en attente > 5 jours"
                        : mission.is_follow_up_within_14_days
                          ? "Suivi dans moins de 14 jours"
                          : "Mission a jour"}
                  </span>
                  <Link href={`/missions/${mission.mission_id}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                    Ouvrir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
