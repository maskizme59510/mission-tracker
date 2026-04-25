import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { LoadingSubmitButton } from "@/components/loading-submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserProfile, getTeamMemberIds } from "@/lib/rbac";

export default async function PrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  if (!isSupabaseConfigured || !supabase) {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getUserProfile(supabase, user);
  const teamMemberIds = profile.role === "responsable" ? await getTeamMemberIds(supabase, user.id) : [];
  const showTeamMissions = profile.role === "responsable" && teamMemberIds.length > 0;
  const showAllMissions = profile.role === "directeur";
  const showAdmin = profile.role === "responsable" || profile.role === "directeur";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-[#F03A2E] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <img src="/logo-ntico.png" alt="Logo NTICO" height={40} className="h-10 w-auto" />
          </div>

          <nav className="flex items-center gap-3 text-sm">
            <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/dashboard">
              Mon Tableau de bord
            </Link>
            <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/missions">
              Mes Missions
            </Link>
            {showTeamMissions ? (
              <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/missions/equipe">
                Missions de l&apos;equipe
              </Link>
            ) : null}
            {showAllMissions ? (
              <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/missions/toutes">
                Toutes les missions
              </Link>
            ) : null}
            {showAdmin ? (
              <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/admin">
                Admin
              </Link>
            ) : null}
            <form action="/api/auth/logout" method="post">
              <LoadingSubmitButton
                label="Se deconnecter"
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-100"
              />
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
