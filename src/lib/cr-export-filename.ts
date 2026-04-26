export function buildCrExportFileName(clientName: string, firstName: string, reportDate: string, extension: "pdf" | "docx") {
  const sanitize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();

  const safeClientName = sanitize(clientName) || "ENSEIGNE";
  const safeFirstName = sanitize(firstName) || "PRENOM";

  return `CR_${safeClientName}_${safeFirstName}_${reportDate}.${extension}`;
}
