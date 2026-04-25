import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserSessionWithProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LoadingSubmitButton } from "@/components/loading-submit-button";
import { createUserAccountAction, updateUserRoleAction } from "@/app/(private)/admin/actions";
import type { AppRole } from "@/lib/rbac";

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  manager_id: string | null;
  user_code: string | null;
};

export default async function AdminPage() {
  const { profile } = await requireUserSessionWithProfile();
  if (profile.role !== "responsable" && profile.role !== "directeur") {
    redirect("/dashboard");
  }
  if (!supabaseAdmin) {
    throw new Error("Client admin Supabase indisponible.");
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,first_name,last_name,role,manager_id,user_code")
    .order("last_name", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  const profiles = (data ?? []) as ProfileRow[];
  const managers = profiles.filter((p) => p.role === "responsable" || p.role === "directeur");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Administration utilisateurs</h2>
          <p className="mt-1 text-slate-600">Creation de comptes et gestion des roles NTICO.</p>
        </div>
        <Link href="/dashboard" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Retour au dashboard
        </Link>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Creer un compte</h3>
        <form action={createUserAccountAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input name="email" type="email" required placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2" />
          <input
            name="password"
            type="password"
            required
            placeholder="Mot de passe temporaire"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <select name="role" defaultValue="commercial" className="rounded-md border border-slate-300 px-3 py-2">
            <option value="commercial">commercial</option>
            <option value="responsable">responsable</option>
            <option value="directeur">directeur</option>
          </select>
          <select name="manager_id" defaultValue="" className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">Aucun manager</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.first_name} {manager.last_name}
              </option>
            ))}
          </select>
          <LoadingSubmitButton
            label="Creer le compte"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 md:col-span-2 md:w-fit"
          />
        </form>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Utilisateurs existants</h3>
        <div className="mt-4 space-y-3">
          {profiles.map((userProfile) => (
            <form key={userProfile.id} action={updateUserRoleAction} className="rounded-lg border border-slate-200 p-3">
              <input type="hidden" name="profile_id" value={userProfile.id} />
              <p className="text-sm font-semibold text-slate-900">
                {userProfile.first_name} {userProfile.last_name}
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <select name="role" defaultValue={userProfile.role} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="commercial">commercial</option>
                  <option value="responsable">responsable</option>
                  <option value="directeur">directeur</option>
                </select>
                <select
                  name="manager_id"
                  defaultValue={userProfile.manager_id ?? ""}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Aucun manager</option>
                  {managers
                    .filter((manager) => manager.id !== userProfile.id)
                    .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name}
                      </option>
                    ))}
                </select>
                <input
                  name="user_code"
                  defaultValue={userProfile.user_code ?? ""}
                  placeholder="User code"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
                />
                <LoadingSubmitButton
                  label="Mettre a jour"
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                />
              </div>
            </form>
          ))}
        </div>
      </article>
    </section>
  );
}
