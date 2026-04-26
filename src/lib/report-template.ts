type ReportTemplateInput = {
  consultantFullName: string;
  missionStartDate: string;
  lastFollowupDate: string | null;
  reportDate: string;
  nextFollowupDate: string | null;
  participants: string[];
  consultantFeedback: string[];
  clientFeedback: string[];
  objectives: string[];
  training: string[];
  consultantFirstName: string;
  clientName: string;
  engineerFirstName: string;
};

function normalizeListLine(value: string) {
  return value.replace(/^\s*[-•–—]\s*/, "").trim();
}

function lines(title: string, values: string[]) {
  if (values.length === 0) {
    return `${title}\n- (Aucun point)`;
  }
  return `${title}\n${values.map((value) => `- ${normalizeListLine(value)}`).join("\n")}`;
}

export function buildEmailIntro(input: ReportTemplateInput) {
  return [
    "Bonjour,",
    `Je vous remercie pour les echanges et les retours sur la periode ecoulee sur la mission de ${input.consultantFirstName}. Vous trouverez ci-dessous le CR de nos echanges ce matin.`,
    "N'hesitez pas a apporter vos modifications si necessaire.",
    `Bonne fin de journee a tous les 3,`,
    input.engineerFirstName,
  ].join("\n");
}

export function buildReportBody(input: ReportTemplateInput) {
  return [
    `Suivi de mission : ${input.consultantFullName}`,
    `Demarrage : ${input.missionStartDate}`,
    `Dernier suivi de mission : ${input.lastFollowupDate ?? "-"}`,
    `Date suivi de mission : ${input.reportDate}`,
    `Prochain suivi de mission planifie le : ${input.nextFollowupDate ?? "-"}`,
    "",
    lines("Presents :", input.participants),
    "",
    lines(`Retours de ${input.consultantFirstName} :`, input.consultantFeedback),
    "",
    lines(`Retours ${input.clientName} :`, input.clientFeedback),
    "",
    lines("Objectifs pour la prochaine periode :", input.objectives),
    "",
    lines("Formation a envisager :", input.training),
  ].join("\n");
}
