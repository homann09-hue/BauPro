import { formatDateTime } from "@/lib/utils";
import { buildPdfDocument, drawImage, imageFromDataUrl, line, text, wrapText } from "@/lib/pdf/simple-pdf";
import { safeUtf8FilenamePart } from "@/lib/text/german";
import type { Customer, Jobsite, WorkOrder } from "@/types/app";

export type WorkOrderPdfWorkOrder = Pick<
  WorkOrder,
  | "title"
  | "version"
  | "status"
  | "created_at"
  | "signed_at"
  | "rejected_at"
  | "description"
  | "scope_of_work"
  | "price_note"
  | "signer_name"
  | "signature_data_url"
  | "rejection_reason"
  | "content_hash"
>;

export type WorkOrderPdfData = {
  company: { name: string };
  customer: Pick<Customer, "company" | "first_name" | "last_name" | "contact_person">;
  jobsite: Pick<Jobsite, "name" | "address"> | null;
  workOrder: WorkOrderPdfWorkOrder;
};

function safeFilenamePart(value: string) {
  return safeUtf8FilenamePart(value, "arbeitsauftrag");
}

function customerName(customer: WorkOrderPdfData["customer"]) {
  const privateName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  return customer.company || privateName || customer.contact_person || "Kunde";
}

export function workOrderFilename(data: WorkOrderPdfData) {
  const customer = safeFilenamePart(customerName(data.customer));
  const title = safeFilenamePart(data.workOrder.title);
  return `arbeitsauftrag_${customer}_${title}_v${data.workOrder.version}.pdf`;
}

export function buildWorkOrderPdf(data: WorkOrderPdfData) {
  const workOrder = data.workOrder;
  const signatureImage = imageFromDataUrl(workOrder.signature_data_url, "Sig1");
  const images = signatureImage ? [signatureImage] : [];
  let content = "0.8 w\n";
  content += text(42, 790, 20, "Digitaler Arbeitsauftrag");
  content += text(42, 762, 11, `Firma: ${data.company.name}`);
  content += text(42, 744, 11, `Kunde: ${customerName(data.customer)}`);
  content += text(42, 726, 11, `Baustelle: ${data.jobsite?.name ?? "-"}`);
  content += text(42, 708, 11, `Adresse: ${data.jobsite?.address ?? "-"}`);
  content += text(380, 762, 10, `Status: ${workOrder.status}`);
  content += text(380, 744, 10, `Version: ${workOrder.version}`);
  content += text(380, 726, 10, `Erstellt: ${formatDateTime(workOrder.created_at)}`);
  content += text(380, 708, 10, `Finalisiert: ${formatDateTime(workOrder.signed_at ?? workOrder.rejected_at)}`);
  content += line(42, 686, 553, 686);
  content += text(42, 660, 15, workOrder.title);

  let y = 634;
  if (workOrder.description) {
    content += text(42, y, 10, workOrder.description);
    y -= 24;
  }

  content += text(42, y, 12, "Leistungsbeschreibung");
  y -= 18;
  for (const lineText of wrapText(workOrder.scope_of_work, 96).slice(0, 18)) {
    content += text(42, y, 9, lineText);
    y -= 14;
  }

  if (workOrder.price_note) {
    y -= 8;
    content += text(42, y, 12, "Preis-/Angebotshinweis");
    y -= 18;
    for (const lineText of wrapText(workOrder.price_note, 96).slice(0, 4)) {
      content += text(42, y, 9, lineText);
      y -= 14;
    }
  }

  y = Math.min(y - 18, 250);
  content += line(42, y + 20, 553, y + 20);
  content += text(42, y, 11, `Unterschrift/Rückmeldung: ${workOrder.signer_name ?? "-"}`);
  content += text(42, y - 18, 10, `Unterschrieben am: ${formatDateTime(workOrder.signed_at)}`);
  content += text(42, y - 36, 10, `Abgelehnt am: ${formatDateTime(workOrder.rejected_at)}`);
  content += text(42, y - 54, 10, `Ablehnungsgrund: ${workOrder.rejection_reason ?? "-"}`);
  if (signatureImage) {
    content += text(42, y - 78, 8, "Gezeichnete Unterschrift:");
    content += drawImage(signatureImage.name, 42, y - 154, 190, 58);
    content += text(42, y - 168, 8, `Hash: ${workOrder.content_hash ?? "-"}`);
  } else {
    content += text(42, y - 82, 8, `Hash: ${workOrder.content_hash ?? "-"}`);
  }
  content += text(42, 50, 8, "Automatisch erzeugter PDF-Nachweis aus dem BauPro Kundenportal.");

  return buildPdfDocument(content, images);
}
