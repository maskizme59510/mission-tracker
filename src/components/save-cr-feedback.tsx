"use client";

import { useEffect, useState } from "react";

type SaveCrFeedbackProps = {
  mode: "success" | "error" | null;
};

export function SaveCrFeedback({ mode }: Readonly<SaveCrFeedbackProps>) {
  const [visible, setVisible] = useState(Boolean(mode));

  useEffect(() => {
    setVisible(Boolean(mode));
    if (mode !== "success") return;

    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [mode]);

  if (!visible || !mode) return null;

  if (mode === "success") {
    return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✅ CR enregistre avec succes</p>;
  }

  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      ❌ Erreur lors de l&apos;enregistrement, veuillez reessayer
    </p>
  );
}
