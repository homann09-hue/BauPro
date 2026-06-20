import {
  buildPdfDocument,
  cleanPdfText,
  drawImage,
  imageFromDataUrl,
  line,
  text,
  truncatePdfText,
  wrapText
} from "@/lib/pdf/simple-pdf";
import { checklistCategoryLabels, checklistItemStatusLabels, jobsiteChecklistStatusLabels } from "@/lib/checklists";
import { safeUtf8FilenamePart } from "@/lib/text/german";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ChecklistItemPhoto, JobsiteChecklist, JobsiteChecklistItem } from "@/types/app";

export type ChecklistPdfData = {
  companyName: string;
  checklist: JobsiteChecklist;
  items: JobsiteChecklistItem[];
  photosByItem: Map<string, ChecklistItemPhoto[]>;
  generatedAt: string;
};

function safeFilename(value: string) {
  return safeUtf8FilenamePart(cleanPdfText(value), "checkliste");
}

export function checklistFilename(data: ChecklistPdfData) {
  return `checkliste_${safeFilename(data.checklist.title)}_${safeFilename(data.checklist.jobsites?.name ?? "baustelle")}.pdf`;
}

export function buildChecklistPdf(data: ChecklistPdfData) {
  const { companyName, checklist, items, photosByItem, generatedAt } = data;
  const signatureImage = imageFromDataUrl(checklist.signature_data_url, "Sig1");
  const images = signatureImage ? [signatureImage] : [];
  let content = "";
  let y = 802;

  content += text(42, y, 18, "BauPro Checkliste");
  content += text(42, y - 18, 10, companyName);
  content += text(390, y, 9, `Erstellt: ${formatDateTime(generatedAt)}`);
  content += line(42, y - 30, 553, y - 30);
  y -= 58;

  const metaRows = [
    ["Titel", checklist.title],
    ["Kategorie", checklistCategoryLabels[checklist.category]],
    ["Status", jobsiteChecklistStatusLabels[checklist.status]],
    ["Baustelle", checklist.jobsites?.name ?? "-"],
    ["Kunde", checklist.jobsites?.customer ?? "-"],
    ["Adresse", checklist.jobsites?.address ?? "-"],
    ["Faellig", formatDate(checklist.due_date)],
    ["Abgeschlossen", formatDateTime(checklist.completed_at)]
  ] as const;

  for (const [label, value] of metaRows) {
    content += text(42, y, 8, `${label}:`, "F1");
    content += text(132, y, 9, truncatePdfText(value, 74));
    y -= 16;
  }

  if (checklist.notes) {
    y -= 6;
    content += text(42, y, 10, "Notiz");
    y -= 14;
    for (const row of wrapText(checklist.notes, 95).slice(0, 4)) {
      content += text(42, y, 8, row);
      y -= 12;
    }
  }

  y -= 12;
  content += line(42, y, 553, y);
  y -= 22;
  content += text(42, y, 13, "Punkte");
  y -= 18;

  for (const item of items) {
    if (y < 130) {
      content += text(42, y, 8, "Weitere Punkte wurden aus Platzgruenden gekuerzt.");
      break;
    }

    const photos = photosByItem.get(item.id) ?? [];
    content += text(42, y, 9, checklistItemStatusLabels[item.status]);
    content += text(134, y, 9, truncatePdfText(item.label, 72));
    content += text(482, y, 8, `${photos.length} Foto(s)`);
    y -= 13;

    const badges = [
      item.required ? "Pflicht" : "Optional",
      item.photo_required ? "Foto Pflicht" : null,
      item.tasks ? `Aufgabe: ${item.tasks.status}` : null
    ].filter(Boolean);
    content += text(134, y, 7, badges.join(" · "));
    y -= 11;

    if (item.problem_description) {
      content += text(134, y, 8, `Problem: ${truncatePdfText(item.problem_description, 80)}`);
      y -= 11;
    }
    if (item.notes) {
      for (const row of wrapText(item.notes, 82).slice(0, 2)) {
        content += text(134, y, 8, row);
        y -= 10;
      }
    }
    y -= 4;
  }

  y = Math.max(y, 92);
  content += line(42, y, 553, y);
  y -= 20;

  if (checklist.signature_name) {
    content += text(42, y, 10, "Unterschrift");
    content += text(42, y - 14, 8, `${checklist.signature_name} (${checklist.signature_role ?? "-"})`);
    content += text(42, y - 27, 8, `Signiert: ${formatDateTime(checklist.signature_signed_at)}`);
    if (signatureImage) {
      content += drawImage(signatureImage.name, 310, y - 58, 190, 58);
    }
    y -= 70;
  }

  content += text(42, 50, 8, "Automatisch erzeugter PDF-Nachweis aus BauPro. Checkliste, Fotos und Aufgaben bleiben in der Baustellenakte gespeichert.");

  return buildPdfDocument(content, images);
}
