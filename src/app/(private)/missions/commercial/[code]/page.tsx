import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/rbac";
import { resolveManagedCommercialByCode } from "@/lib/team-commercials";
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

export default async function MissionsByCommercialCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).trim();

  const { supabase, user } = await requireAdminSession();
  const profile = await getUserProfile(supabase, user);
  if (profile.role !== "responsable") {
    redirect("/missions");
  }

  const commercialProfile = await resolveManagedCommercialByCode(supabase, user.id, code);
  if (!commercialProfile) {
    notFound();
  }

  const { data, error } = await supabase
    .from("mission_health_view")
    .select("*")
    .eq("owner_id", commercialProfile.id)
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const missions = (data ?? []) as MissionRow[];
  const missionIds = missions.map((row) => String(row.mission_id));

  let marginsData: MissionMarginRow[] | null = null;
  if (missionIds.length > 0) {
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
  } else {
    marginsData = [];
  }

  const marginsByMissionId = new Map<string, MissionMarginRow>((marginsData ?? []).map((item) => [item.id, item]));

  return (
    <section className="space-y-6">
      <Link href="/missions" className="text-sm font-medium text-slate-700 underline">
        Retour a mes missions
      </Link>

      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Missions {commercialProfile.user_code}</h2>
        <p className="mt-1 text-slate-600">
          Missions de {commercialProfile.first_name} {commercialProfile.last_name} ({commercialProfile.user_code})
        </p>
      </div>

      <MissionsListView
        missions={missions as MissionsListMissionRow[]}
        marginsByMissionId={marginsByMissionId as Map<string, MissionsListMarginRow>}
        listTitle={`Liste des missions (${missions.length})`}
      />
    </section>
  );
}
