import { buildPdfDocument, cleanPdfText, text, truncatePdfText } from "@/lib/pdf/simple-pdf";
import { defectPriorityLabels, defectSourceLabels, defectStatusLabels, isDefectOverdue } from "@/lib/defects";
import { safeUtf8FilenamePart } from "@/lib/text/german";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Company, Defect, DefectPhoto } from "@/types/app";

export type DefectExportData = {
  company: Pick<Company, "id" | "name">;
  defect: Defect;
  photos: Array<Pick<DefectPhoto, "id" | "file_name" | "visible_to_customer" | "created_at">>;
  generatedAt: string;
};

function truncate(value: string | null | undefined, length: number) {
  return truncatePdfText(value, length);
}

export function defectFilename(data: DefectExportData) {
  const title = safeUtf8FilenamePart(cleanPdfText(data.defect.title), "mangel").toLowerCase().slice(0, 60);
  return `mängelbericht_${title}_${data.defect.created_at.slice(0, 10)}.pdf`;
}

export function buildDefectPdf(data: DefectExportData) {
  const defect = data.defect;
  const overdue = isDefectOverdue(defect);
  const assignee = defect.profiles?.full_name || defect.profiles?.email || "Nicht zugewiesen";
  const sourceLabel = defectSourceLabels[defect.source_type];
  const publicPhotos = data.photos.filter((photo) => photo.visible_to_customer).length;

  let content = "0.8 w\n";
  content += text(42, 792, 18, "Mängelbericht");
  content += text(42, 768, 10, `Firma: ${data.company.name}`);
  content += text(42, 752, 10, `Baustelle: ${defect.jobsites?.name ?? "Ohne Baustelle"}`);
  content += text(42, 736, 10, `Kunde: ${defect.jobsites?.customer ?? "-"}`);
  content += text(42, 720, 10, `Adresse: ${defect.jobsites?.address ?? "-"}`);
  content += text(42, 696, 13, truncate(defect.title, 90));
  content += text(42, 674, 10, `Status: ${defectStatusLabels[defect.status]}`);
  content += text(260, 674, 10, `Prioritaet: ${defectPriorityLabels[defect.priority]}`);
  content += text(42, 658, 10, `Verantwortlich: ${assignee}`);
  content += text(260, 658, 10, `Frist: ${formatDate(defect.due_date)}`);
  content += text(420, 658, 10, overdue ? "Friststatus: Ueberfaellig" : "Friststatus: im Plan");
  content += text(42, 642, 10, `Quelle: ${sourceLabel}`);
  content += text(260, 642, 10, `Kundenfreigabe: ${defect.visible_to_customer ? "Ja" : "Nein"}`);

  content += text(42, 610, 12, "Beschreibung");
  content += text(42, 592, 9, truncate(defect.description, 120) || "-");
  content += text(42, 576, 9, truncate(defect.description?.slice(120), 120));
  content += text(42, 560, 9, truncate(defect.description?.slice(240), 120));

  content += text(42, 520, 12, "Nachweise");
  content += text(42, 502, 9, `Fotos gesamt: ${data.photos.length}`);
  content += text(42, 486, 9, `Davon fuer Kunden freigegeben: ${publicPhotos}`);
  content += text(42, 470, 9, `Erstellt am: ${formatDateTime(defect.created_at)}`);
  content += text(42, 454, 9, `Aktualisiert am: ${formatDateTime(defect.updated_at)}`);
  content += text(42, 438, 9, `Erledigt am: ${formatDateTime(defect.closed_at)}`);
  content += text(42, 422, 9, `Abgenommen am: ${formatDateTime(defect.accepted_at)}`);

  content += text(42, 386, 12, "Foto-Liste");
  const visiblePhotos = data.photos.slice(0, 12);
  visiblePhotos.forEach((photo, index) => {
    const y = 368 - index * 16;
    content += text(
      42,
      y,
      8,
      `${index + 1}. ${truncate(photo.file_name, 70)} | ${formatDateTime(photo.created_at)} | ${photo.visible_to_customer ? "Kunde" : "Intern"}`
    );
  });
  if (data.photos.length > visiblePhotos.length) {
    content += text(42, 176, 8, `Weitere ${data.photos.length - visiblePhotos.length} Foto(s) in BauPro gespeichert.`);
  }

  content += text(42, 74, 8, `Erstellt: ${formatDateTime(data.generatedAt)}`);
  content += text(42, 58, 8, "Automatisch erzeugter Maengelbericht aus BauPro.");

  return buildPdfDocument(content);
}
