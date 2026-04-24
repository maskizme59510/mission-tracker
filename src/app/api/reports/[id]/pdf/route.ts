import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { buildReportBody } from "@/lib/report-template";

type SectionType = "consultant_feedback" | "client_feedback" | "next_objectives" | "training";

function wrapLine(line: string, maxLength: number) {
  if (line.length <= maxLength) return [line];
  const words = line.split(" ");
  const rows: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      if (current) rows.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) rows.push(current);
  return rows;
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

  const reportText = buildReportBody({
    consultantFullName: `${mission.consultant_first_name} ${mission.consultant_last_name}`,
    missionStartDate: mission.start_date,
    lastFollowupDate: report.last_followup_date,
    reportDate: report.report_date,
    nextFollowupDate: report.next_followup_date,
    participants: (participantsData ?? []).map((p) => p.name),
    consultantFeedback: sectionMap.consultant_feedback,
    clientFeedback: sectionMap.client_feedback,
    objectives: sectionMap.next_objectives,
    training: sectionMap.training,
    consultantFirstName: mission.consultant_first_name,
    clientName: mission.client_name,
    engineerFirstName: "",
  });

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 portrait
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const generatedAt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  let y = 800;
  const lineHeight = 16;
  const marginX = 50;
  const maxChars = 90;

  page.drawRectangle({
    x: 0,
    y: 770,
    width: 595,
    height: 72,
    color: rgb(0.08, 0.12, 0.2),
  });

  page.drawText("MISSION TRACKER", {
    x: marginX,
    y: 814,
    size: 10,
    font: boldFont,
    color: rgb(0.9, 0.93, 0.99),
  });

  page.drawText("Compte-rendu de mission", {
    x: marginX,
    y: 792,
    size: 18,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Genere le ${generatedAt}`, {
    x: marginX,
    y: 776,
    size: 10,
    font,
    color: rgb(0.87, 0.9, 0.96),
  });
  y = 748;

  const lines = reportText.split("\n");
  for (const line of lines) {
    const wrapped = wrapLine(line, maxChars);
    for (const row of wrapped) {
      if (y < 60) {
        page = pdfDoc.addPage([595, 842]);
        y = 800;
      }
      page.drawText(row, {
        x: marginX,
        y,
        size: 11,
        font,
        color: rgb(0.1, 0.12, 0.18),
      });
      y -= lineHeight;
    }
    if (line.trim() === "") {
      y -= 4;
    }
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cr-mission-${report.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
