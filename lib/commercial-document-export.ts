import {
  commercialDocumentStatusLabels,
  commercialDocumentTypeLabels
} from "@/lib/data/commercial-documents";
import { cleanPdfText, line, text } from "@/lib/pdf/simple-pdf";
import { formatDate, formatMoney } from "@/lib/utils";
import type { CommercialDocument, CommercialDocumentItem, Company } from "@/types/app";

export type CommercialDocumentExportData = {
  company: Pick<Company, "id" | "name" | "address" | "contact_email" | "phone" | "tax_id">;
  document: CommercialDocument;
  items: CommercialDocumentItem[];
  generatedAt: string;
};

function truncate(value: string | null | undefined, length: number) {
  const cleaned = cleanPdfText(value ?? "");
  return cleaned.length > length ? `${cleaned.slice(0, length - 1)}.` : cleaned;
}

function buildPdfDocument(content: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}endstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function customerLine(document: CommercialDocument, key: string) {
  const value = document.customer_snapshot?.[key];
  return typeof value === "string" ? value : null;
}

function number(value: number | null | undefined) {
  return Number(value ?? 0).toFixed(2);
}

function csvValue(value: string | number | null | undefined) {
  const textValue = String(value ?? "");
  return `"${textValue.replace(/"/g, '""')}"`;
}

function xmlEscape(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function commercialDocumentFilename(data: CommercialDocumentExportData) {
  const type = data.document.document_type === "invoice" ? "rechnung" : "angebot";
  const number = cleanPdfText(data.document.document_number).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${type}_${number}.pdf`;
}

export function datevCsvFilename(data: CommercialDocumentExportData) {
  const number = cleanPdfText(data.document.document_number).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `datev_${number}.csv`;
}

export function xrechnungXmlFilename(data: CommercialDocumentExportData) {
  const number = cleanPdfText(data.document.document_number).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `xrechnung_entwurf_${number}.xml`;
}

export function buildDatevCsv(data: CommercialDocumentExportData) {
  const document = data.document;
  const customer = customerLine(document, "name") ?? "Kunde";
  const sign = document.document_type === "invoice" ? 1 : 0;
  const rows = [
    [
      "Belegdatum",
      "Belegnummer",
      "Belegtyp",
      "Status",
      "Kunde",
      "Betreff",
      "Umsatz Brutto EUR",
      "Umsatz Netto EUR",
      "Steuer EUR",
      "Steuersatz",
      "Zahlungsziel",
      "Hinweis"
    ],
    [
      document.issue_date,
      document.document_number,
      commercialDocumentTypeLabels[document.document_type],
      commercialDocumentStatusLabels[document.status],
      customer,
      document.subject,
      number(document.total_gross * sign).replace(".", ","),
      number(document.subtotal_net * sign).replace(".", ","),
      number(document.tax_total * sign).replace(".", ","),
      number(document.tax_rate).replace(".", ","),
      document.due_date ?? document.valid_until ?? "",
      "DATEV-Vorbereitung aus BauPro. Kontierung vor Import prüfen."
    ]
  ];

  return Buffer.from(`\uFEFF${rows.map((row) => row.map(csvValue).join(";")).join("\n")}\n`, "utf8");
}

export function buildXrechnungXml(data: CommercialDocumentExportData) {
  const document = data.document;
  const customerName = customerLine(document, "name") ?? "Kunde";
  const customerAddress = customerLine(document, "billing_address") ?? customerLine(document, "jobsite_address") ?? "";
  const supplierAddress = data.company.address ?? "";
  const dueDate = document.due_date ?? document.issue_date;
  const lines = data.items.map((item) => {
    return `  <cac:InvoiceLine>
    <cbc:ID>${xmlEscape(item.position)}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${number(item.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${number(item.line_total_net)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xmlEscape(item.title)}</cbc:Name>
      <cbc:Description>${xmlEscape(item.description)}</cbc:Description>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${number(document.tax_rate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${number(item.unit_price_net)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  });

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEscape(document.document_number)}</cbc:ID>
  <cbc:IssueDate>${xmlEscape(document.issue_date)}</cbc:IssueDate>
  <cbc:DueDate>${xmlEscape(dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>${xmlEscape("XRechnung-Entwurf aus BauPro. Vor Versand mit Fachverfahren validieren.")}</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${xmlEscape(data.company.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>${xmlEscape(supplierAddress)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>${xmlEscape(data.company.tax_id)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${xmlEscape(customerName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>${xmlEscape(customerAddress)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentTerms><cbc:Note>${xmlEscape(document.payment_terms)}</cbc:Note></cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${number(document.tax_total)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${number(document.subtotal_net)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${number(document.tax_total)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${number(document.tax_rate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${number(document.subtotal_net)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${number(document.subtotal_net)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${number(document.total_gross)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${number(document.total_gross)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines.join("\n")}
</Invoice>
`, "utf8");
}

export function buildCommercialDocumentPdf(data: CommercialDocumentExportData) {
  const document = data.document;
  const typeLabel = commercialDocumentTypeLabels[document.document_type];
  let content = "0.8 w\n";
  content += text(42, 792, 20, `${typeLabel} ${document.document_number}`);
  content += text(42, 768, 10, data.company.name);
  content += text(42, 752, 9, data.company.address ?? "");
  content += text(42, 736, 9, [data.company.contact_email, data.company.phone].filter(Boolean).join(" · "));
  content += text(380, 768, 9, `Datum: ${formatDate(document.issue_date)}`);
  content += text(380, 752, 9, `Status: ${commercialDocumentStatusLabels[document.status]}`);
  content += text(380, 736, 9, document.document_type === "invoice" ? `Fällig: ${formatDate(document.due_date)}` : `Gültig bis: ${formatDate(document.valid_until)}`);
  content += line(42, 718, 553, 718);

  content += text(42, 692, 11, "Kunde");
  content += text(42, 674, 10, customerLine(document, "name") ?? "Kunde");
  content += text(42, 658, 9, customerLine(document, "billing_address") ?? customerLine(document, "jobsite_address") ?? "");
  content += text(42, 628, 12, truncate(document.subject, 86));

  let y = 594;
  content += text(42, y, 9, "Pos.");
  content += text(78, y, 9, "Leistung / Material");
  content += text(322, y, 9, "Menge");
  content += text(398, y, 9, "EP netto");
  content += text(482, y, 9, "Gesamt");
  content += line(42, y - 8, 553, y - 8);
  y -= 26;

  for (const item of data.items.slice(0, 14)) {
    content += text(42, y, 8, item.position);
    content += text(78, y, 8, truncate(item.title, 46));
    content += text(322, y, 8, `${item.quantity} ${item.unit}`);
    content += text(398, y, 8, formatMoney(item.unit_price_net));
    content += text(482, y, 8, formatMoney(item.line_total_net));
    if (item.description) {
      y -= 12;
      content += text(78, y, 7, truncate(item.description, 58));
    }
    y -= 20;
    if (y < 210) break;
  }

  content += line(340, 190, 553, 190);
  content += text(350, 170, 10, "Netto");
  content += text(482, 170, 10, formatMoney(document.subtotal_net));
  content += text(350, 150, 10, `MwSt. ${document.tax_rate}%`);
  content += text(482, 150, 10, formatMoney(document.tax_total));
  content += text(350, 124, 12, "Brutto");
  content += text(482, 124, 12, formatMoney(document.total_gross));

  content += text(42, 154, 9, truncate(document.payment_terms, 80));
  content += text(42, 138, 9, truncate(document.notes, 90));
  content += text(42, 74, 8, "Hinweis: Kaufmännischer Entwurf aus BauPro. Vor Versand rechtlich/steuerlich prüfen.");
  content += text(42, 58, 8, `Erstellt: ${new Date(data.generatedAt).toLocaleDateString("de-DE")}`);

  return buildPdfDocument(content);
}
