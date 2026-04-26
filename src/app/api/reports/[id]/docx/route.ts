import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  Document,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  convertInchesToTwip,
} from "docx";
import { requireAdminSession } from "@/lib/auth";
import { buildCrExportFileName } from "@/lib/cr-export-filename";
import { toFrenchDate } from "@/lib/format";

type SectionType = "consultant_feedback" | "client_feedback" | "next_objectives" | "training";

/** docx attend largeur/hauteur en pixels (conversion interne 96 dpi). */
const LOGO_WIDTH_PX = 154;
const LOGO_HEIGHT_PX = 53;

function normalizeListLine(value: string) {
  return value.replace(/^\s*[-•–—]\s*/, "").trim();
}

function listItemParagraph(text: string) {
  const line = normalizeListLine(text);
  return new Paragraph({
    children: [new TextRun(`- ${line}`)],
    spacing: { after: 80 },
  });
}

function sectionTitleParagraph(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true })],
    spacing: { before: 240, after: 120 },
  });
}

function bodyParagraph(text: string, options?: { bold?: boolean; title?: boolean }) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: options?.bold ?? false,
        size: options?.title ? 32 : undefined,
      }),
    ],
    spacing: { after: 120 },
  });
}

function sectionGap() {
  return new Paragraph({ text: "", spacing: { after: 120 } });
}

function buildBodyChildren(input: {
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
}): Paragraph[] {
  const out: Paragraph[] = [];

  out.push(bodyParagraph(`Suivi de mission : ${input.consultantFullName}`, { bold: true, title: true }));
  out.push(bodyParagraph(`Démarrage : ${toFrenchDate(input.missionStartDate)}`));
  out.push(bodyParagraph(`Dernier suivi de mission : ${toFrenchDate(input.lastFollowupDate)}`));
  out.push(bodyParagraph(`Date suivi de mission : ${toFrenchDate(input.reportDate)}`));
  out.push(bodyParagraph(`Prochain suivi de mission planifié le : ${toFrenchDate(input.nextFollowupDate)}`));

  out.push(sectionGap());
  out.push(sectionTitleParagraph("Présents :"));
  if (input.participants.length === 0) {
    out.push(listItemParagraph("(Aucun point)"));
  } else {
    for (const name of input.participants) {
      out.push(listItemParagraph(name));
    }
  }

  out.push(sectionGap());
  out.push(sectionTitleParagraph(`Retours de ${input.consultantFirstName} :`));
  if (input.consultantFeedback.length === 0) {
    out.push(listItemParagraph("(Aucun point)"));
  } else {
    for (const line of input.consultantFeedback) {
      out.push(listItemParagraph(line));
    }
  }

  out.push(sectionGap());
  out.push(sectionTitleParagraph(`Retours ${input.clientName} :`));
  if (input.clientFeedback.length === 0) {
    out.push(listItemParagraph("(Aucun point)"));
  } else {
    for (const line of input.clientFeedback) {
      out.push(listItemParagraph(line));
    }
  }

  out.push(sectionGap());
  out.push(sectionTitleParagraph("Objectifs pour la prochaine période :"));
  if (input.objectives.length === 0) {
    out.push(listItemParagraph("(Aucun point)"));
  } else {
    for (const line of input.objectives) {
      out.push(listItemParagraph(line));
    }
  }

  out.push(sectionGap());
  out.push(sectionTitleParagraph("Formation à envisager :"));
  if (input.training.length === 0) {
    out.push(listItemParagraph("(Aucun point)"));
  } else {
    for (const line of input.training) {
      out.push(listItemParagraph(line));
    }
  }

  return out;
}

async function buildHeader(): Promise<Header> {
  const logoPath = path.join(process.cwd(), "public", "logo-ntico.png");
  let logoBuffer: Buffer | null = null;
  try {
    logoBuffer = await readFile(logoPath);
  } catch {
    logoBuffer = null;
  }

  const titleParagraph = new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: "Compte Rendu de mission", bold: true, size: 32 })],
  });

  if (!logoBuffer) {
    return new Header({
      children: [titleParagraph],
    });
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4500, 5500],
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            verticalAlign: VerticalAlignTable.CENTER,
            margins: { top: 80, bottom: 80, left: 0, right: 160 },
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    type: "png",
                    data: logoBuffer,
                    transformation: { width: LOGO_WIDTH_PX, height: LOGO_HEIGHT_PX },
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            verticalAlign: VerticalAlignTable.CENTER,
            children: [titleParagraph],
          }),
        ],
      }),
    ],
  });

  return new Header({
    children: [headerTable],
  });
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

  const header = await buildHeader();

  const doc = new Document({
    sections: [
      {
        headers: { default: header },
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              header: convertInchesToTwip(0.55),
              footer: convertInchesToTwip(0.45),
            },
          },
        },
        children: buildBodyChildren({
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
        }),
      },
    ],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  const outputFileName = buildCrExportFileName(mission.client_name, mission.consultant_first_name, report.report_date, "docx");

  return new NextResponse(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${outputFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
