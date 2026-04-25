"use client";

import { useFormStatus } from "react-dom";

type DeleteMissionButtonProps = {
  label?: string;
};

export function DeleteMissionButton({ label = "Supprimer la mission" }: Readonly<DeleteMissionButtonProps>) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        const confirmed = window.confirm(
          "Etes-vous sur ? Cette action supprimera definitivement la mission et tous ses CR associes.",
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Chargement..." : label}
    </button>
  );
}
