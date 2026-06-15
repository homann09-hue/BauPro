import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const roleHardeningMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260615_roles_security_hardening.sql"),
  "utf8"
);
const privacyMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260615_privacy_compliance.sql"), "utf8");

function block(start: string, end: string) {
  const startIndex = schema.indexOf(start);
  const endIndex = schema.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return schema.slice(startIndex, endIndex);
}

describe("Supabase RLS and security schema", () => {
  it("supports Vorarbeiter but does not grant manager rights", () => {
    expect(schema).toContain("role in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter')");
    const managerFunction = block("create or replace function public.can_manage_company()", "create or replace function public.handle_new_user()");
    expect(managerFunction).toContain("current_role() in ('admin', 'chef')");
    expect(managerFunction).not.toContain("vorarbeiter");
    expect(roleHardeningMigration).toContain("notify pgrst, 'reload schema'");
  });

  it("keeps employee inventory reads price-free", () => {
    const publicInventoryView = block("create or replace view public.inventory_items_public as", "grant select on public.inventory_items_public");
    expect(publicInventoryView).toContain("where i.company_id = public.current_company_id()");
    expect(publicInventoryView).not.toMatch(/\b(purchase_price|sales_price|markup_percent|price_per_unit)\b/);
  });

  it("limits time entries to company managers or the owning employee", () => {
    const policy = block("create policy \"read relevant time entries\"", "drop policy if exists \"create time entries\"");
    expect(policy).toContain("company_id = public.current_company_id()");
    expect(policy).toContain("public.can_manage_company() or employee_id = auth.uid()");
  });

  it("adds privacy requests with own-or-manager RLS", () => {
    expect(schema).toContain("create table if not exists public.privacy_requests");
    expect(privacyMigration).toContain("read own or managed privacy requests");
    expect(privacyMigration).toContain("requester_id = auth.uid()");
    expect(privacyMigration).toContain("public.can_manage_company()");
  });

  it("limits report photo deletion to managers or object owner", () => {
    const policy = block('create policy "members can delete own report photos"', "select pg_notify('pgrst', 'reload schema');");
    expect(policy).toContain("public.can_manage_company() or owner = auth.uid()");
  });
});
