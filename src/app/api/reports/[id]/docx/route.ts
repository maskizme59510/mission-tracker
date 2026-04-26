import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { requireAdminSession } from "@/lib/auth";
import { buildCrExportFileName } from "@/lib/cr-export-filename";
import { toFrenchDate } from "@/lib/format";

type SectionType = "consultant_feedback" | "client_feedback" | "next_objectives" | "training";

const PLACEHOLDER = "{{REPORT_CONTENT}}";

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wParagraph(text: string, bold: boolean) {
  const run = bold
    ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
    : `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  return `<w:p>${run}</w:p>`;
}

function wBlankParagraph() {
  return `<w:p/>`;
}

function findPlaceholderParagraphRange(documentXml: string): { start: number; end: number } {
  const idx = documentXml.indexOf(PLACEHOLDER);
  if (idx !== -1) {
    const pStart = documentXml.lastIndexOf("<w:p", idx);
    const pEnd = documentXml.indexOf("</w:p>", idx);
    if (pStart !== -1 && pEnd !== -1) {
      return { start: pStart, end: pEnd + "</w:p>".length };
    }
  }

  const pRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(documentXml)) !== null) {
    const block = m[0];
    const innerTexts = [...block.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((x) => x[1]);
    const flat = innerTexts.join("");
    if (flat.includes("{{REPORT_CONTENT}}")) {
      return { start: m.index, end: m.index + block.length };
    }
  }

  throw new Error(`Le template doit contenir le marqueur ${PLACEHOLDER} dans word/document.xml.`);
}

function replacePlaceholderParagraph(documentXml: string, injectedXml: string) {
  const { start, end } = findPlaceholderParagraphRange(documentXml);
  return documentXml.slice(0, start) + injectedXml + documentXml.slice(end);
}

function buildReportBodyXml(input: {
  consultantFullName: string;
  missionStartDate: string;
  lastFollowupDate: string | null;
  reportDate: string;
  nextFollowupDate: string | null;
  participants: string[];
  consultantFirstName: string;
  clientName: string;
  consultantFeedback: string[];
  clientFeedback: string[];
  objectives: string[];
  training: string[];
}) {
  const parts: string[] = [];

  const pushSectionGap = () => {
    parts.push(wBlankParagraph());
  };

  parts.push(wParagraph(`Suivi de mission : ${input.consultantFullName}`, true));
  parts.push(wParagraph(`Démarrage : ${toFrenchDate(input.missionStartDate)}`, false));
  parts.push(wParagraph(`Dernier suivi de mission : ${toFrenchDate(input.lastFollowupDate)}`, false));
  parts.push(wParagraph(`Date suivi de mission : ${toFrenchDate(input.reportDate)}`, false));
  parts.push(wParagraph(`Prochain suivi de mission planifié le : ${toFrenchDate(input.nextFollowupDate)}`, false));

  pushSectionGap();

  parts.push(wParagraph("Présents :", true));
  if (input.participants.length === 0) {
    parts.push(wParagraph("- (Aucun point)", false));
  } else {
    for (const name of input.participants) {
      parts.push(wParagraph(`- ${name}`, false));
    }
  }

  pushSectionGap();

  parts.push(wParagraph(`Retours de ${input.consultantFirstName} :`, true));
  if (input.consultantFeedback.length === 0) {
    parts.push(wParagraph("- (Aucun point)", false));
  } else {
    for (const line of input.consultantFeedback) {
      parts.push(wParagraph(`- ${line}`, false));
    }
  }

  pushSectionGap();

  parts.push(wParagraph(`Retours ${input.clientName} :`, true));
  if (input.clientFeedback.length === 0) {
    parts.push(wParagraph("- (Aucun point)", false));
  } else {
    for (const line of input.clientFeedback) {
      parts.push(wParagraph(`- ${line}`, false));
    }
  }

  pushSectionGap();

  parts.push(wParagraph("Objectifs pour la prochaine période :", true));
  if (input.objectives.length === 0) {
    parts.push(wParagraph("- (Aucun point)", false));
  } else {
    for (const line of input.objectives) {
      parts.push(wParagraph(`- ${line}`, false));
    }
  }

  pushSectionGap();

  parts.push(wParagraph("Formation à envisager :", true));
  if (input.training.length === 0) {
    parts.push(wParagraph("- (Aucun point)", false));
  } else {
    for (const line of input.training) {
      parts.push(wParagraph(`- ${line}`, false));
    }
  }

  return parts.join("");
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminSession();

  const { data: report, error: reportError } = await supabase
    .from("mission_reports")
    .select("id,mission_id,report_date,last_followup_date,next_followup_date")
    .eq("id", id)
    .single();
  if (reportError || !report) {
    return NextResponse.json({ error: "CR introuvable." }, { status: 404 });
  }

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("consultant_first_name,consultant_last_name,client_name,start_date")
    .eq("id", report.mission_id)
    .single();
  if (missionError || !mission) {
    return NextResponse.json({ error: "Mission introuvable." }, { status: 404 });
  }

  const { data: participantsData } = await supabase
    .from("report_participants")
    .select("name")
    .eq("report_id", report.id)
    .order("position", { ascending: true });

  const { data: sectionData } = await supabase
    .from("report_sections_items")
    .select("section_type,content")
    .eq("report_id", report.id)
    .order("position", { ascending: true });

  const sectionMap: Record<SectionType, string[]> = {
    consultant_feedback: [],
    client_feedback: [],
    next_objectives: [],
    training: [],
  };

  sectionData?.forEach((item) => {
    sectionMap[item.section_type as SectionType].push(item.content);
  });

  const consultantFullName = `${mission.consultant_first_name} ${mission.consultant_last_name}`;
  const participants = (participantsData ?? []).map((p) => p.name);

  const templatePath = path.join(process.cwd(), "public", "Template_CR_de_mission.docx");
  const templateBuffer = await readFile(templatePath);

  const zip = await JSZip.loadAsync(templateBuffer);
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) {
    return NextResponse.json({ error: "Template Word invalide (document.xml manquant)." }, { status: 500 });
  }

  let documentXml = await documentEntry.async("string");

  const bodyXml = buildReportBodyXml({
    consultantFullName,
    missionStartDate: mission.start_date,
    lastFollowupDate: report.last_followup_date,
    reportDate: report.report_date,
    nextFollowupDate: report.next_followup_date,
    participants,
    consultantFirstName: mission.consultant_first_name,
    clientName: mission.client_name,
    consultantFeedback: sectionMap.consultant_feedback,
    clientFeedback: sectionMap.client_feedback,
    objectives: sectionMap.next_objectives,
    training: sectionMap.training,
  });

  try {
    documentXml = replacePlaceholderParagraph(documentXml, bodyXml);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur template Word.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  zip.file("word/document.xml", documentXml);

  const docxBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const outputFileName = buildCrExportFileName(mission.client_name, mission.consultant_first_name, report.report_date, "docx");

  return new NextResponse(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${outputFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
