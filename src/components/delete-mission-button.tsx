"use client";

type DeleteMissionButtonProps = {
  label?: string;
};

export function DeleteMissionButton({ label = "Supprimer la mission" }: Readonly<DeleteMissionButtonProps>) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        const confirmed = window.confirm(
          "Etes-vous sur ? Cette action supprimera definitivement la mission et tous ses CR associes.",
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
    >
      {label}
    </button>
  );
}
