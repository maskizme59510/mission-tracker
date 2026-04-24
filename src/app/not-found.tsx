import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold text-slate-900">Page introuvable</h1>
      <p className="text-slate-700">
        Le lien que vous avez ouvert est invalide ou la ressource n&apos;existe plus.
      </p>
      <div>
        <Link
          href="/dashboard"
          className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Retour au dashboard
        </Link>
      </div>
    </main>
  );
}
