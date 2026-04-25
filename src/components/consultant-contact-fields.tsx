"use client";

import { useState } from "react";
import { CapitalizeInput } from "@/components/capitalize-input";

function slugPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, ".")
    .toLowerCase();
}

function computeInternalEmail(firstName: string, lastName: string) {
  const first = slugPart(firstName);
  const last = slugPart(lastName);
  if (!first || !last) return "";
  return `${first}.${last}@ntico.com`;
}

export function ConsultantContactFields() {
  const [consultantFirstName, setConsultantFirstName] = useState("");
  const [consultantLastName, setConsultantLastName] = useState("");
  const [consultantType, setConsultantType] = useState("");
  const [consultantEmail, setConsultantEmail] = useState("");
  const [lastAutoEmail, setLastAutoEmail] = useState("");

  const canAutoOverride = consultantEmail.trim() === "" || consultantEmail === lastAutoEmail;

  return (
    <>
      <CapitalizeInput
        name="consultant_first_name"
        required
        placeholder="Prenom consultant"
        className="rounded-md border border-slate-300 px-3 py-2"
        defaultValue={consultantFirstName}
        onValueChange={(next) => {
          setConsultantFirstName(next);
          if (consultantType === "Consultant Interne" && canAutoOverride) {
            const autoEmail = computeInternalEmail(next, consultantLastName);
            setConsultantEmail(autoEmail);
            setLastAutoEmail(autoEmail);
          }
        }}
      />
      <input
        name="consultant_last_name"
        required
        placeholder="Nom consultant"
        className="rounded-md border border-slate-300 px-3 py-2"
        value={consultantLastName}
        onChange={(event) => {
          const next = event.currentTarget.value.toLocaleUpperCase("fr-FR");
          setConsultantLastName(next);
          if (consultantType === "Consultant Interne" && canAutoOverride) {
            const autoEmail = computeInternalEmail(consultantFirstName, next);
            setConsultantEmail(autoEmail);
            setLastAutoEmail(autoEmail);
          }
        }}
      />
      <label className="text-sm text-slate-700 md:col-span-2">
        Type de consultant
        <select
          name="consultant_type"
          required
          value={consultantType}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) => {
            const nextType = event.currentTarget.value;
            setConsultantType(nextType);

            if (nextType === "Consultant Interne") {
              const autoEmail = computeInternalEmail(consultantFirstName, consultantLastName);
              if (canAutoOverride) {
                setConsultantEmail(autoEmail);
              }
              setLastAutoEmail(autoEmail);
              return;
            }

            setConsultantEmail("");
            setLastAutoEmail("");
          }}
        >
          <option value="" disabled>
            Selectionner un type
          </option>
          <option value="Consultant Interne">Consultant Interne</option>
          <option value="Consultant Externe">Consultant Externe</option>
        </select>
      </label>
      <input
        name="consultant_email"
        type="email"
        required
        placeholder="Email consultant"
        className="rounded-md border border-slate-300 px-3 py-2"
        value={consultantEmail}
        onChange={(event) => setConsultantEmail(event.currentTarget.value)}
      />
    </>
  );
}
