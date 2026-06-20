import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("digital signatures", () => {
  it("adds signature tables, report lock trigger and forced RLS to migration and schema", () => {
    const migration = read("supabase/migrations/20260625_digital_signatures.sql");
    const schema = read("supabase/schema.sql");

    for (const source of [migration, schema]) {
      expect(source).toContain("create table if not exists public.digital_signatures");
      expect(source).toContain("create table if not exists public.digital_document_versions");
      expect(source).toContain("alter table public.digital_signatures force row level security");
      expect(source).toContain("alter table public.digital_document_versions force row level security");
      expect(source).toContain("create or replace function public.prevent_signed_report_mutation");
      expect(source).toContain("Signierte Tagesberichte koennen nicht geaendert werden");
      expect(source).toContain("signature_data_url text");
      expect(source).toContain("source_report_id uuid references public.reports");
      expect(source).toContain("document_version integer not null default 1");
      expect(source).toContain("document_type in ('work_order', 'report', 'commercial_document', 'jobsite_document', 'acceptance')");
    }
  });

  it("uses a real touch/mouse signature canvas and validates the server payload", () => {
    const component = read("components/signature/signature-pad.tsx");
    const validator = read("lib/signatures/signature.ts");

    expect(component).toContain("<canvas");
    expect(component).toContain("onPointerDown");
    expect(component).toContain('toDataURL("image/jpeg"');
    expect(component).toContain('name = "signature_data_url"');
    expect(validator).toContain("validateSignatureDataUrl");
    expect(validator).toContain("bytes.length > 250 * 1024");
    expect(validator).toContain("Unterschrift passt nicht zum angegebenen Bildformat");
  });

  it("requires signatures in customer portal and records immutable signature evidence", () => {
    const portalPage = read("app/portal/[token]/page.tsx");
    const portalActions = read("lib/actions/customer-portal-actions.ts");
    const tokens = read("lib/customer-portal/tokens.ts");

    expect(portalPage).toContain("SignaturePad");
    expect(portalPage).toContain("Unterschrift für Bestätigung");
    expect(portalActions).toContain("validateSignatureDataUrl");
    expect(portalActions).toContain('required: decisionValue === "sign"');
    expect(portalActions).toContain("digital_document_versions");
    expect(portalActions).toContain("digital_signatures");
    expect(portalActions).toContain('signer_role: "kunde"');
    expect(tokens).toContain("signature_data_hash");
  });

  it("finalizes reports and jobsite documents with hashes and visible UI locks", () => {
    const reportActions = read("lib/actions/report-actions.ts");
    const reportPage = read("app/(app)/berichte/[id]/page.tsx");
    const editPage = read("app/(app)/berichte/[id]/bearbeiten/page.tsx");
    const jobsiteActions = read("lib/actions/jobsite-file-actions.ts");
    const jobsitePage = read("app/(app)/baustellen/[id]/page.tsx");

    expect(reportActions).toContain("signReportAction");
    expect(reportActions).toContain("createReportRevisionAction");
    expect(reportActions).toContain("signature_status");
    expect(reportActions).toContain("signature_content_hash");
    expect(reportActions).toContain("digital_signatures");
    expect(reportPage).toContain("Digitale Unterschrift");
    expect(reportPage).toContain("Bericht unterschreiben");
    expect(reportPage).toContain("Neue Version anlegen");
    expect(editPage).toContain("Nach Unterschrift gesperrt");
    expect(jobsiteActions).toContain("signJobsiteDocumentAction");
    expect(jobsiteActions).toContain("validateSignatureDataUrl");
    expect(jobsiteActions).toContain("document.category === \"abnahmeprotokoll\" ? \"acceptance\" : \"jobsite_document\"");
    expect(jobsitePage).toContain("Dokument digital unterschreiben");
  });

  it("embeds captured signatures into generated PDFs", () => {
    const helper = read("lib/pdf/simple-pdf.ts");
    const reportExport = read("lib/report-export.ts");
    const workOrderExport = read("lib/work-order-export.ts");

    expect(helper).toContain("drawImage");
    expect(helper).toContain("/Subtype /Image");
    expect(helper).toContain("/Filter /DCTDecode");
    expect(reportExport).toContain("imageFromDataUrl(report.signature_data_url");
    expect(reportExport).toContain("drawImage(signatureImage.name");
    expect(workOrderExport).toContain("imageFromDataUrl(workOrder.signature_data_url");
    expect(workOrderExport).toContain("drawImage(signatureImage.name");
  });
});
