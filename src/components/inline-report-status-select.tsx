"use client";

import { useState, useTransition } from "react";
import { updateReportStatusAction } from "@/app/(private)/reports/[id]/actions";

type ReportStatus = "draft" | "pending_consultant_validation" | "validated" | "sent_to_client";

const allowedStatuses: readonly ReportStatus[] = ["draft", "pending_consultant_validation", "validated", "sent_to_client"];

function isReportStatus(value: string): value is ReportStatus {
  return (allowedStatuses as readonly string[]).includes(value);
}

export function InlineReportStatusSelect({
  reportId,
  missionId,
  initialStatus,
}: {
  reportId: string;
  missionId: string;
  initialStatus: ReportStatus;
}) {
  const [status, setStatus] = useState<ReportStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(event) => {
        const rawValue = event.currentTarget.value;
        if (!isReportStatus(rawValue)) return;

        const previous = status;
        const next = rawValue;
        setStatus(next);

        startTransition(() => {
          void (async () => {
            const formData = new FormData();
            formData.set("report_id", reportId);
            formData.set("mission_id", missionId);
            formData.set("status", next);

            try {
              await updateReportStatusAction(formData);
            } catch {
              setStatus(previous);
            }
          })();
        });
      }}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
      aria-label="Statut du CR"
    >
      <option value="draft">Brouillon</option>
      <option value="pending_consultant_validation">Envoye consultant</option>
      <option value="validated">Valide consultant</option>
      <option value="sent_to_client">Transmis au client</option>
    </select>
  );
}
