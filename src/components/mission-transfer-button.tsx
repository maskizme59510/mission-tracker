"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useState, useTransition } from "react";
import { executeMissionTransferAction } from "@/app/(private)/missions/actions";

type MissionTransferButtonProps = {
  missionId: string;
  candidateCodes: string[];
};

export function MissionTransferButton({ missionId, candidateCodes }: Readonly<MissionTransferButtonProps>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCode, setSelectedCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openModal() {
    setStep(1);
    setSelectedCode("");
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setStep(1);
    setSelectedCode("");
    setError(null);
  }

  function handleNext() {
    setError(null);
    if (!selectedCode) {
      setError("Choisissez un trigramme.");
      return;
    }
    setStep(2);
  }

  function handleConfirmTransfer() {
    setError(null);
    if (!selectedCode) {
      setError("Trigramme manquant.");
      return;
    }
    const fd = new FormData();
    fd.set("mission_id", missionId);
    fd.set("new_commercial", selectedCode);
    startTransition(async () => {
      try {
        await executeMissionTransferAction(fd);
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        setError(err instanceof Error ? err.message : "Erreur lors du transfert.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
      >
        Transférer la mission
      </button>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              closeModal();
            }
          }}
        >
          <div
            className="max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-mission-dialog-title"
          >
            <h3 id="transfer-mission-dialog-title" className="text-lg font-semibold text-slate-900">
              Transférer la mission
            </h3>

            {step === 1 ? (
              <div className="mt-4 space-y-4">
                <label className="block text-sm text-slate-700">
                  <span className="font-medium">Nouveau commercial</span>
                  <select
                    value={selectedCode}
                    onChange={(event) => setSelectedCode(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  >
                    <option value="">— Choisir un trigramme —</option>
                    {candidateCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleNext}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Suivant
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={closeModal}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-700">
                  Vous allez transférer cette mission vers {selectedCode}. Cette mission ne sera plus visible depuis votre
                  compte. Confirmez-vous ?
                </p>
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleConfirmTransfer}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Chargement..." : "Confirmer le transfert"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={closeModal}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
