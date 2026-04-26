import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Paragraph, PatchType, TextRun, patchDocument } from "docx";
import { requireAdminSession } from "@/lib/auth";
import { toFrenchDate } from "@/lib/format";

type SectionType = "consultant_feedback" | "client_feedback" | "next_objectives" | "training";

function sectionParagraphs(title: string, values: string[]) {
  const titleParagraph = new Paragraph({
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text: title, bold: true })],
  });

  if (values.length === 0) {
    return [
      titleParagraph,
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun("(Aucun point)")],
      }),
    ];
  }

  return [
    titleParagraph,
    ...values.map(
      (value) =>
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(value)],
        }),
    ),
  ];
}

function buildExportFileName(clientName: string, firstName: string, reportDate: string) {
  const sanitize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();

  const safeClientName = sanitize(clientName) || "ENSEIGNE";
  const safeFirstName = sanitize(firstName) || "PRENOM";

  return `CR_${safeClientName}_${safeFirstName}_${reportDate}.docx`;
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

  const docxBuffer = await patchDocument({
    outputType: "nodebuffer",
    data: templateBuffer,
    patches: {
      REPORT_CONTENT: {
        type: PatchType.DOCUMENT,
        children: [
          new Paragraph({
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: `Suivi de mission : ${consultantFullName}`,
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph(`Démarrage : ${toFrenchDate(mission.start_date)}`),
          new Paragraph(`Dernier suivi de mission : ${toFrenchDate(report.last_followup_date)}`),
          new Paragraph(`Date suivi de mission : ${toFrenchDate(report.report_date)}`),
          new Paragraph(`Prochain suivi de mission planifié le : ${toFrenchDate(report.next_followup_date)}`),
          ...sectionParagraphs("Présents :", participants),
          ...sectionParagraphs(`Retours de ${mission.consultant_first_name} :`, sectionMap.consultant_feedback),
          ...sectionParagraphs(`Retours ${mission.client_name} :`, sectionMap.client_feedback),
          ...sectionParagraphs("Objectifs pour la prochaine période :", sectionMap.next_objectives),
          ...sectionParagraphs("Formation à envisager :", sectionMap.training),
        ],
      },
    },
    keepOriginalStyles: true,
  });

  const outputFileName = buildExportFileName(mission.client_name, mission.consultant_first_name, report.report_date);

  return new NextResponse(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${outputFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
