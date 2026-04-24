"use client";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <html lang="fr">
      <body className="bg-slate-50">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-6">
          <h1 className="text-2xl font-semibold text-slate-900">Une erreur est survenue</h1>
          <p className="text-slate-700">
            L&apos;application a rencontre une erreur inattendue. Vous pouvez reessayer ou revenir au tableau de bord.
          </p>
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Details techniques: {error.message || "Erreur inconnue"}
          </p>
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
        </main>
      </body>
    </html>
  );
}
