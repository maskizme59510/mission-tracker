"use client";

import { useFormStatus } from "react-dom";

export function SaveCrSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Chargement..." : "Enregistrer le CR"}
    </button>
  );
}
