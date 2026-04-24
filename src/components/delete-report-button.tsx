"use client";

export function DeleteReportButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        const confirmed = window.confirm(
          "Etes-vous sur ? Cette action supprimera definitivement ce CR et toutes ses donnees associees.",
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
    >
      Supprimer
    </button>
  );
}
