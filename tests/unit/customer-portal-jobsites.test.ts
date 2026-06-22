import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("customer portal jobsite access", () => {
  it("adds report release fields and customer messages with forced RLS", () => {
    const migration = read("supabase/migrations/20260627_customer_portal_jobsites.sql");
    const schema = read("supabase/schema.sql");

    for (const source of [migration, schema]) {
      expect(source).toContain("visible_to_customer boolean not null default false");
      expect(source).toContain("customer_summary text");
      expect(source).toContain("create table if not exists public.customer_portal_messages");
      expect(source).toContain("alter table public.customer_portal_messages force row level security");
      expect(source).toContain("managers read customer portal messages");
      expect(source).toContain("customer_portal_messages(company_id, customer_id, jobsite_id");
    }
  });

  it("loads only customer-safe portal data filtered by token company, customer and jobsite", () => {
    const loader = read("lib/customer-portal/tokens.ts");

    expect(loader).toContain('.eq("token_hash", tokenHash)');
    expect(loader).toContain('.eq("company_id", portalToken.company_id)');
    expect(loader).toContain('.eq("customer_id", portalToken.customer_id)');
    expect(loader).toContain('ordersQuery = ordersQuery.eq("jobsite_id", portalToken.jobsite_id)');
    expect(loader).toContain('commercialDocumentsQuery = commercialDocumentsQuery.eq("jobsite_id", portalToken.jobsite_id)');
    expect(loader).toContain('.eq("visible_to_customer", true)');
    expect(loader).toContain('.eq("report_status", "approved")');
    expect(loader).not.toMatch(/\binternal_notes\b/);
    expect(loader).not.toMatch(/\b(purchase_price|sales_price|margin_total|supplier_offers|online_price_offers)\b/);
  });

  it("lets customers send messages through a validated portal token only", () => {
    const actions = read("lib/actions/customer-portal-actions.ts");

    expect(actions).toContain("sendCustomerPortalMessageAction");
    expect(actions).toContain('await checkRateLimit(`portal-message:${hashCustomerPortalToken(token)}`');
    expect(actions).toContain('.from("customer_portal_tokens")');
    expect(actions).toContain('.eq("token_hash", tokenHash)');
    expect(actions).toContain('.from("customer_portal_messages")');
    expect(actions).toContain("portalToken.company_id");
    expect(actions).toContain("portalToken.customer_id");
    expect(actions).not.toContain('formData.get("company_id")');
    expect(actions).not.toContain('formData.get("customer_id")');
  });

  it("requires manager approval before reports become visible in the portal", () => {
    const actions = read("lib/actions/customer-portal-actions.ts");
    const reportPage = read("app/(app)/berichte/[id]/page.tsx");

    expect(actions).toContain("toggleReportCustomerReleaseAction");
    expect(actions).toContain("const context = await requireManager()");
    expect(actions).toContain('report.report_status !== "approved"');
    expect(actions).toContain("visible_to_customer: release");
    expect(reportPage).toContain("CustomerReleasePanel");
    expect(reportPage).toContain("Bautagesbericht für Kunden freigeben");
  });

  it("renders a full customer portal without internal notes or buying prices", () => {
    const portalPage = read("app/portal/[token]/page.tsx");

    for (const label of [
      "Projektstatus",
      "Freigegebene Bautagesberichte",
      "Freigegebene Fotos",
      "Aufträge, Angebote und Rechnungen",
      "Wetterhinweise",
      "Frage senden",
      "Ich bin einverstanden"
    ]) {
      expect(portalPage).toContain(label);
    }

    expect(portalPage).not.toMatch(/\binternal_notes\b/);
    expect(portalPage).not.toMatch(/\b(purchase_price|sales_price|margin_total|supplier_offers|online_price_offers)\b/);
  });
});
