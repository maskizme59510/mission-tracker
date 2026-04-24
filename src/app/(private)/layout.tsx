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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Mission Tracker</p>
            <h1 className="text-lg font-semibold text-slate-900">Espace Ingenieur d&apos;affaires</h1>
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
