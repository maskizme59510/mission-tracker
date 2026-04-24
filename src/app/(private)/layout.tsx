import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : user.email ?? "Utilisateur";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-[#F03A2E] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex flex-col gap-1">
            <Image src="/logo-ntico.png" alt="Logo NTICO" width={120} height={40} className="h-10 w-auto" priority />
            <p className="text-xs text-slate-600">Compte-Rendu du suivi de mission</p>
            <p className="text-sm font-medium text-slate-900">{fullName}</p>
          </div>

          <nav className="flex items-center gap-3 text-sm">
            <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/dashboard">
              Dashboard
            </Link>
            <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/missions">
              Missions
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-100"
              >
                Se deconnecter
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
