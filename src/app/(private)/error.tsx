"use client";

export default function PrivateError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Impossible de charger cette page</h2>
      <p className="text-slate-700">
        Une erreur est apparue sur cet espace prive. Merci de reessayer, puis de contacter le support si le probleme persiste.
      </p>
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error.message || "Erreur inconnue"}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Reessayer
        </button>
        <a href="/dashboard" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
          Retour au dashboard
        </a>
      </div>
    </section>
  );
}
