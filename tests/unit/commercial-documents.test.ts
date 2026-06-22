import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCommercialDocumentPdf,
  buildDatevCsv,
  buildXrechnungXml,
  commercialDocumentFilename,
  datevCsvFilename,
  xrechnungXmlFilename
} from "@/lib/commercial-document-export";
import { commercialDocumentStatusLabels, commercialDocumentTypeLabels } from "@/lib/data/commercial-documents";
import type { CommercialDocumentExportData } from "@/lib/commercial-document-export";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const exportData: CommercialDocumentExportData = {
  company: {
    id: "company-1",
    name: "Muster Dach GmbH",
    address: "Dachweg 1, 50667 Koeln",
    contact_email: "info@example.invalid",
    phone: "0221 123456",
    tax_id: "DEMO"
  },
  document: {
    id: "doc-1",
    company_id: "company-1",
    order_id: "order-1",
    customer_id: "customer-1",
    jobsite_id: "job-1",
    document_type: "quote",
    document_number: "AG-2026-0001",
    status: "draft",
    subject: "Angebot Dachsanierung",
    customer_snapshot: {
      name: "Familie Muster",
      billing_address: "Musterstrasse 12, 50667 Koeln"
    },
    issue_date: "2026-06-18",
    due_date: null,
    valid_until: "2026-07-18",
    subtotal_net: 1000,
    tax_rate: 19,
    tax_total: 190,
    total_gross: 1190,
    notes: "Bitte pruefen.",
    payment_terms: "Zahlbar nach Absprache.",
    created_by: "user-1",
    sent_at: null,
    accepted_at: null,
    paid_at: null,
    archived_at: null,
    created_at: "2026-06-18T10:00:00.000Z",
    updated_at: "2026-06-18T10:00:00.000Z"
  },
  items: [
    {
      id: "item-1",
      company_id: "company-1",
      document_id: "doc-1",
      source_requirement_id: "req-1",
      position: 1,
      title: "Unterspannbahn",
      description: "Aus Materialberechnung",
      quantity: 120,
      unit: "m2",
      unit_price_net: 4,
      discount_percent: 0,
      line_total_net: 480,
      created_at: "2026-06-18T10:00:00.000Z",
      updated_at: "2026-06-18T10:00:00.000Z"
    }
  ],
  generatedAt: "2026-06-18T10:00:00.000Z"
};

describe("commercial documents", () => {
  it("defines labels for Angebote and Rechnungen", () => {
    expect(commercialDocumentTypeLabels.quote).toBe("Angebot");
    expect(commercialDocumentTypeLabels.invoice).toBe("Rechnung");
    expect(commercialDocumentStatusLabels.paid).toBe("Bezahlt");
  });

  it("adds migration and schema with manager-only RLS", () => {
    for (const file of ["supabase/migrations/20260622_commercial_documents.sql", "supabase/schema.sql"]) {
      const sql = source(file);
      expect(sql).toContain("create table if not exists public.commercial_documents");
      expect(sql).toContain("create table if not exists public.commercial_document_items");
      expect(sql).toContain("alter table public.commercial_documents force row level security");
      expect(sql).toContain("public.can_manage_company()");
      expect(sql).toContain("recalculate_commercial_document_totals");
    }
  });

  it("keeps commercial document actions tenant-scoped and soft-delete based", () => {
    const actions = source("lib/actions/commercial-document-actions.ts");
    expect(actions).toContain("requireManager()");
    expect(actions).toContain("context.companyId");
    expect(actions).not.toContain('formData.get("company_id")');
    expect(actions).toContain("archived_at");
    expect(actions).not.toContain(".delete(");
  });

  it("renders list, detail, pdf route and order conversion controls", () => {
    expect(source("app/(app)/angebote-rechnungen/page.tsx")).toContain("Angebote & Rechnungen");
    expect(source("app/(app)/angebote-rechnungen/[id]/page.tsx")).toContain("PDF herunterladen");
    expect(source("app/(app)/angebote-rechnungen/[id]/pdf/route.ts")).toContain("buildCommercialDocumentPdf");
    expect(source("app/(app)/angebote-rechnungen/[id]/datev/route.ts")).toContain("buildDatevCsv");
    expect(source("app/(app)/angebote-rechnungen/[id]/xrechnung/route.ts")).toContain("buildXrechnungXml");
    expect(source("app/(app)/orders/[id]/page.tsx")).toContain("createInvoiceFromOrderAction");
    expect(source("components/app-shell.tsx")).toContain("/invoices");
  });

  it("exports a PDF buffer and deterministic filename", () => {
    expect(commercialDocumentFilename(exportData)).toBe("angebot_AG-2026-0001.pdf");
    const pdf = buildCommercialDocumentPdf(exportData);
    expect(pdf.subarray(0, 8).toString("utf8")).toBe("%PDF-1.4");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("exports DATEV CSV and XRechnung XML drafts", () => {
    expect(datevCsvFilename(exportData)).toBe("datev_AG-2026-0001.csv");
    const csv = buildDatevCsv(exportData).toString("utf8");
    expect(csv).toContain("Belegdatum");
    expect(csv).toContain("DATEV-Vorbereitung");

    const invoiceData: CommercialDocumentExportData = {
      ...exportData,
      document: {
        ...exportData.document,
        document_type: "invoice",
        document_number: "RE-2026-0001",
        due_date: "2026-07-02"
      }
    };
    expect(xrechnungXmlFilename(invoiceData)).toBe("xrechnung_entwurf_RE-2026-0001.xml");
    const xml = buildXrechnungXml(invoiceData).toString("utf8");
    expect(xml).toContain("<Invoice");
    expect(xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
    expect(xml).toContain("XRechnung-Entwurf");
  });
});
