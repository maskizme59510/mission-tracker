"use client";

import { useFormStatus } from "react-dom";

export function DeleteReportButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        const confirmed = window.confirm(
          "Etes-vous sur ? Cette action supprimera definitivement ce CR et toutes ses donnees associees.",
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Chargement..." : "Supprimer"}
    </button>
  );
}
