"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateReportStatusAction } from "@/app/(private)/reports/[id]/actions";

export type ReportStatusValue =
  | "draft"
  | "pending_consultant_validation"
  | "validated"
  | "sent_to_client";

const ALLOWED: readonly ReportStatusValue[] = [
  "draft",
  "pending_consultant_validation",
  "validated",
  "sent_to_client",
];

function isReportStatus(value: string): value is ReportStatusValue {
  return (ALLOWED as readonly string[]).includes(value);
}

export function ReportStatusSelect({
  reportId,
  missionId,
  initialStatus,
}: {
  reportId: string;
  missionId: string;
  initialStatus: ReportStatusValue;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState<ReportStatusValue>(initialStatus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialStatus);
  }, [initialStatus]);

  return (
    <label className="text-sm text-slate-700">
      Statut
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => {
          const raw = e.target.value;
          if (!isReportStatus(raw)) return;
          const next = raw;
          const previous = value;
          setValue(next);
          setError(null);
          startTransition(() => {
            void (async () => {
              const fd = new FormData();
              fd.set("report_id", reportId);
              fd.set("mission_id", missionId);
              fd.set("status", next);
              try {
                await updateReportStatusAction(fd);
                router.refresh();
              } catch (err) {
                setValue(previous);
                setError(
                  err instanceof Error && err.message
                    ? err.message
                    : "Impossible d'enregistrer le statut.",
                );
              }
            })();
          });
        }}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 disabled:opacity-60"
      >
        <option value="draft">Brouillon</option>
        <option value="pending_consultant_validation">En attente validation consultant</option>
        <option value="validated">Valide</option>
        <option value="sent_to_client">Transmis client</option>
      </select>
      {isPending ? <p className="mt-1 text-xs text-slate-500">Enregistrement du statut...</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
