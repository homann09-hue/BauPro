import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash, createCustomerPortalToken, hashCustomerPortalToken, publicWorkOrderSnapshot, stableJson } from "@/lib/customer-portal/tokens";
import { buildWorkOrderPdf, workOrderFilename } from "@/lib/work-order-export";
import type { WorkOrder } from "@/types/app";

const root = process.cwd();

function sampleWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    company_id: "22222222-2222-4222-8222-222222222222",
    customer_id: "33333333-3333-4333-8333-333333333333",
    jobsite_id: "44444444-4444-4444-8444-444444444444",
    order_id: "55555555-5555-4555-8555-555555555555",
    title: "Dachreparatur Musterstrasse",
    description: "Ortgang links reparieren",
    scope_of_work: "Beschädigte Ortgangdeckung aufnehmen, Unterspannbahn pruefen und Anschluss fachgerecht schliessen.",
    price_note: "Gemaess Angebot.",
    status: "signed",
    version: 1,
    content_hash: "hash",
    sent_at: "2026-06-17T08:00:00.000Z",
    viewed_at: "2026-06-17T08:05:00.000Z",
    signed_at: "2026-06-17T18:00:00.000Z",
    rejected_at: null,
    signer_name: "Max Mustermann",
    signer_ip: "127.0.0.1",
    signer_user_agent: "vitest",
    signature_data_url: null,
    rejection_reason: null,
    created_by: "66666666-6666-4666-8666-666666666666",
    created_at: "2026-06-17T07:30:00.000Z",
    updated_at: "2026-06-17T18:00:00.000Z",
    ...overrides
  };
}

describe("customer portal security", () => {
  it("stores customer portal tokens as hashes, not raw link secrets", () => {
    const token = createCustomerPortalToken();
    const hash = hashCustomerPortalToken(token);

    expect(token.length).toBeGreaterThan(32);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(hashCustomerPortalToken(token)).toBe(hash);
  });

  it("creates stable content hashes for signed work order versions", () => {
    const left = { b: 2, a: { d: 4, c: 3 } };
    const right = { a: { c: 3, d: 4 }, b: 2 };

    expect(stableJson(left)).toBe(stableJson(right));
    expect(contentHash(left)).toBe(contentHash(right));
  });

  it("keeps portal work order snapshots free of internal price fields", () => {
    const snapshot = publicWorkOrderSnapshot(sampleWorkOrder());
    const json = JSON.stringify(snapshot);

    expect(json).not.toMatch(/purchase_price|sales_price|margin|markup_percent|supplier_offers|online_price_offers/);
    expect(snapshot).toMatchObject({
      title: "Dachreparatur Musterstrasse",
      signer_name: "Max Mustermann",
      status: "signed"
    });
  });

  it("generates a valid signed work order PDF filename and buffer", () => {
    const data = {
      company: { name: "Müller Dachtechnik GmbH" },
      customer: { company: "Familie Test", first_name: null, last_name: null, contact_person: null },
      jobsite: { name: "Musterstrasse 12", address: "Musterstrasse 12, 50667 Koeln" },
      workOrder: sampleWorkOrder()
    };

    expect(workOrderFilename(data)).toBe("arbeitsauftrag_Familie_Test_Dachreparatur_Musterstrasse_v1.pdf");
    const pdf = buildWorkOrderPdf(data);
    expect(pdf.subarray(0, 8).toString("utf8")).toBe("%PDF-1.4");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("keeps portal UI and actions away from internal price fields", () => {
    const portalPage = fs.readFileSync(path.join(root, "app/portal/[token]/page.tsx"), "utf8");
    const portalActions = fs.readFileSync(path.join(root, "lib/actions/customer-portal-actions.ts"), "utf8");

    expect(portalPage).not.toMatch(/\b(purchase_price|sales_price|margin|markup_percent|supplier_offers|online_price_offers)\b/);
    expect(portalActions).not.toMatch(/formData\.get\(["']company_id["']\)/);
    expect(portalActions).toContain("validateCustomerDocument(file)");
    expect(portalActions).toContain("customer-documents");
  });

  it("filters customer portal data by jobsite before returning portal content", () => {
    const portalTokens = fs.readFileSync(path.join(root, "lib/customer-portal/tokens.ts"), "utf8");

    expect(portalTokens).toContain('eventsQuery = eventsQuery.eq("jobsite_id", portalToken.jobsite_id)');
    expect(portalTokens).toContain('documentsQuery = documentsQuery.eq("jobsite_id", portalToken.jobsite_id)');
    expect(portalTokens).toContain('workOrdersQuery = workOrdersQuery.eq("jobsite_id", portalToken.jobsite_id)');
    expect(portalTokens).not.toContain("workOrdersResult.data ?? []) as unknown as PortalWorkOrder[]).filter");
  });

  it("checks affected rows for portal revocation, sending, signing and photo releases", () => {
    const portalActions = fs.readFileSync(path.join(root, "lib/actions/customer-portal-actions.ts"), "utf8");
    const portalPage = fs.readFileSync(path.join(root, "app/portal/[token]/page.tsx"), "utf8");

    for (const marker of ["revokedToken", "sentWorkOrder", "signedWorkOrder", "updatedPhoto"]) {
      expect(portalActions).toContain(marker);
    }

    expect(portalActions).toContain('.eq("order_id", orderId)');
    expect(portalActions).toContain("workOrderDecision(decision)");
    expect(portalActions).toContain("validateSignatureDataUrl");
    expect(portalActions).toContain("required: decisionValue === \"sign\"");
    expect(portalActions).toContain("digital_signatures");
    expect(portalActions).toContain("Bitte bei Ablehnung kurz angeben");
    expect(portalActions).toContain('.eq("customer_id", portalToken.customer_id)');
    expect(portalActions).toContain('workOrderQuery = workOrderQuery.eq("jobsite_id", portalToken.jobsite_id)');
    expect(portalActions).toContain('updateQuery = updateQuery.eq("jobsite_id", portalToken.jobsite_id)');
    expect(portalActions.match(/\.select\("id"\)\s*\.maybeSingle\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(portalPage).toContain("maxLength={120}");
    expect(portalPage).toContain("maxLength={1000}");
  });

  it("adds customer portal tables with forced RLS to schema and migration", () => {
    const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
    const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260617_customer_portal_work_orders.sql"), "utf8");

    for (const source of [schema, migration]) {
      expect(source).toContain("create table if not exists public.customer_portal_tokens");
      expect(source).toContain("create table if not exists public.work_orders");
      expect(source).toContain("alter table public.customer_portal_tokens force row level security");
      expect(source).toContain("alter table public.work_orders force row level security");
      expect(source).toContain("visible_to_customer boolean not null default false");
      expect(source).toContain("values ('customer-documents', 'customer-documents', false)");
      expect(source).toContain("(storage.foldername(name))[2] = 'customers'");
      expect(source).toContain("c.id::text = (storage.foldername(name))[3]");
    }
  });

  it("renders manager controls for customer updates and document releases on order details", () => {
    const orderPage = fs.readFileSync(path.join(root, "app/(app)/orders/[id]/page.tsx"), "utf8");

    expect(orderPage).toContain("createCustomerPortalEventAction");
    expect(orderPage).toContain("uploadCustomerDocumentAction");
    expect(orderPage).toContain('accept="application/pdf,image/jpeg,image/png,image/webp"');
    expect(orderPage).toContain("Kurz, klar und ohne interne Notizen.");
  });

  it("paginates the jobsite list instead of loading the whole table", () => {
    const jobsitesPage = fs.readFileSync(path.join(root, "app/(app)/baustellen/page.tsx"), "utf8");

    expect(jobsitesPage).toContain(".range(from, to)");
    expect(jobsitesPage).toContain('count: "exact"');
    expect(jobsitesPage).not.toContain('.select("*")');
  });
});
