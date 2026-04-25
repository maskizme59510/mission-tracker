"use client";

import { useState } from "react";
import { CapitalizeInput } from "@/components/capitalize-input";
import { UppercaseInput } from "@/components/uppercase-input";

type MissionIdentityEditorProps = {
  missionId: string;
  initialConsultantFirstName: string;
  initialConsultantLastName: string;
  initialConsultantType: string;
  initialConsultantEmail: string;
  initialClientName: string;
  initialClientOperationalContact: string | null;
  initialStartDate: string;
  initialLastFollowupDate: string | null;
  initialNextFollowupDate: string | null;
  initialTjm: number | null;
  initialCj: number | null;
  initialFollowUpFrequencyDays: number;
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
  initialConsultantType,
  initialConsultantEmail,
  initialClientName,
  initialClientOperationalContact,
  initialStartDate,
  initialLastFollowupDate,
  initialNextFollowupDate,
  initialTjm,
  initialCj,
  initialFollowUpFrequencyDays,
  action,
}: Readonly<MissionIdentityEditorProps>) {
  const [editing, setEditing] = useState(false);
  const knownFrequencies = [30, 90, 120, 150, 180];
  const initialFrequencyValue = knownFrequencies.includes(initialFollowUpFrequencyDays)
    ? String(initialFollowUpFrequencyDays)
    : "custom";

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
      <input type="hidden" name="existing_follow_up_frequency_days" value={initialFollowUpFrequencyDays} />
      <div className="grid gap-2 md:grid-cols-2">
        <CapitalizeInput
          name="consultant_first_name"
          defaultValue={initialConsultantFirstName}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Prenom consultant"
        />
        <UppercaseInput
          name="consultant_last_name"
          defaultValue={initialConsultantLastName}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nom consultant"
        />
        <select
          name="consultant_type"
          defaultValue={initialConsultantType}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="Consultant Interne">Consultant Interne</option>
          <option value="Consultant Externe">Consultant Externe</option>
        </select>
        <input
          name="consultant_email"
          type="email"
          defaultValue={initialConsultantEmail}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Email consultant"
        />
        <UppercaseInput
          name="client_name"
          defaultValue={initialClientName}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nom de l'enseigne"
        />
        <input
          name="client_operational_contact"
          defaultValue={initialClientOperationalContact ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Responsable de mission cote client (optionnel)"
        />
        <input
          name="start_date"
          type="date"
          defaultValue={initialStartDate ? initialStartDate.slice(0, 10) : ""}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="last_followup_date"
          type="date"
          defaultValue={initialLastFollowupDate ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="next_followup_date"
          type="date"
          defaultValue={initialNextFollowupDate ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="tjm"
          type="number"
          min="0"
          step="0.01"
          defaultValue={initialTjm ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="TJM (€ HT)"
        />
        <input
          name="cj"
          type="number"
          min="0"
          step="0.01"
          defaultValue={initialCj ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="CJ (€ HT)"
        />
        <select
          name="follow_up_frequency_days"
          defaultValue={initialFrequencyValue}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="30">Mensuel (30 jours)</option>
          <option value="90">Trimestriel (90 jours)</option>
          <option value="120">Tous les 4 mois (120 jours)</option>
          <option value="150">Tous les 5 mois (150 jours)</option>
          <option value="180">Semestriel (180 jours)</option>
          <option value="custom">Personnalise</option>
        </select>
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
