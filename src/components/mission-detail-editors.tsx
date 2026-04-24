"use client";

import { useState } from "react";

type MissionIdentityEditorProps = {
  missionId: string;
  initialConsultantFirstName: string;
  initialConsultantLastName: string;
  initialClientName: string;
  initialStartDate: string;
  action: (formData: FormData) => void | Promise<void>;
};

type NextFollowupEditorProps = {
  missionId: string;
  initialNextFollowupDate: string | null;
  displayNextFollowupText: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function MissionIdentityEditor({
  missionId,
  initialConsultantFirstName,
  initialConsultantLastName,
  initialClientName,
  initialStartDate,
  action,
}: Readonly<MissionIdentityEditorProps>) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
        aria-label="Modifier la mission"
      >
        ✏️
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="mission_id" value={missionId} />
      <div className="grid gap-2 md:grid-cols-2">
        <input
          name="consultant_first_name"
          defaultValue={initialConsultantFirstName}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Prenom consultant"
        />
        <input
          name="consultant_last_name"
          defaultValue={initialConsultantLastName}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nom consultant"
        />
        <input
          name="client_name"
          defaultValue={initialClientName}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nom de l'enseigne"
        />
        <input
          name="start_date"
          type="date"
          defaultValue={initialStartDate}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Enregistrer
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

export function NextFollowupEditor({
  missionId,
  initialNextFollowupDate,
  displayNextFollowupText,
  action,
}: Readonly<NextFollowupEditorProps>) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    if (!initialNextFollowupDate) {
      return (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Ajouter une date
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span>{displayNextFollowupText}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
          aria-label="Modifier le prochain suivi"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="mission_id" value={missionId} />
      <input
        name="next_followup_date"
        type="date"
        defaultValue={initialNextFollowupDate ?? ""}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Enregistrer
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
      >
        Annuler
      </button>
    </form>
  );
}
