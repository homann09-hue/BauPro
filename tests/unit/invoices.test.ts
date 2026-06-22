import fs from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("invoice module", () => {
  it("adds dedicated invoice tables with tenant RLS and numbering", () => {
    const migration = source("supabase/migrations/20260625_invoices.sql");
    const atomicMigration = source("supabase/migrations/20260711_invoice_atomic_stats.sql");
    const schema = source("supabase/schema.sql");

    for (const sql of [migration, schema]) {
      expect(sql).toContain("create table if not exists public.invoices");
      expect(sql).toContain("create table if not exists public.invoice_items");
      expect(sql).toContain("alter table public.invoices force row level security");
      expect(sql).toContain("create policy \"managers read invoices\"");
      expect(sql).toContain("create or replace function public.generate_invoice_number");
      expect(sql).toContain("create or replace function public.recalculate_invoice_totals");
      expect(sql).toContain("unique (company_id, invoice_number)");
    }

    for (const sql of [atomicMigration, schema]) {
      expect(sql).toContain("create or replace function public.create_invoice_with_items");
      expect(sql).toContain("create or replace function public.update_invoice_with_items");
      expect(sql).toContain("create or replace function public.get_invoice_stats");
    }
  });

  it("keeps invoice actions manager-only and soft-delete based", () => {
    const actions = source("lib/actions/invoice-actions.ts");

    expect(actions).toContain("requireManager()");
    expect(actions).toContain("create_invoice_with_items");
    expect(actions).toContain("update_invoice_with_items");
    expect(actions).toContain("createInvoiceFromOrderAction");
    expect(actions).toContain("update({ archived_at: new Date().toISOString() })");
    expect(actions).not.toContain(".from(\"invoices\").delete()");
    expect(actions).toContain("canChangeStatus");
  });

  it("exposes invoice pages, PDF route and manager navigation", () => {
    expect(source("app/(app)/invoices/page.tsx")).toContain("Angebote & Rechnungen");
    expect(source("app/(app)/invoices/new/page.tsx")).toContain("createInvoiceAction");
    expect(source("app/(app)/invoices/[id]/page.tsx")).toContain("Als PDF herunterladen");
    expect(source("app/(app)/invoices/[id]/edit/page.tsx")).toContain("updateInvoiceAction");
    expect(source("app/api/invoices/[id]/pdf/route.ts")).toContain("buildInvoicePdf");
    expect(source("components/app-shell.tsx")).toContain('href: "/invoices"');
  });
});
