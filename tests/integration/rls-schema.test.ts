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
const redteamMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260615_zz_redteam_hardening.sql"),
  "utf8"
);

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
    expect(publicInventoryView).not.toMatch(/\b(purchase_price|sales_price|markup_percent|price_per_unit|price_net|price_gross)\b/);
    expect(schema).toContain('drop policy if exists "read own company inventory items"');
    expect(schema).toContain("managers can read inventory items with prices");
    expect(schema).toContain("managers can read materials with prices");
    expect(schema).toContain("managers can read priced material catalog");
  });

  it("forces RLS and adds tenant CRUD fallback policies for managers", () => {
    expect(schema).toContain("force row level security");
    expect(redteamMigration).toContain("force row level security");
    expect(redteamMigration).toContain("redteam managers select fallback");
    expect(redteamMigration).toContain("redteam managers insert fallback");
    expect(redteamMigration).toContain("redteam managers update fallback");
    expect(redteamMigration).toContain("redteam managers delete fallback");
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

  it("enforces report photo storage paths and report ownership on upload", () => {
    expect(redteamMigration).toContain("(storage.foldername(name))[1] = public.current_company_id()::text");
    expect(redteamMigration).toContain("(storage.foldername(name))[2] = 'reports'");
    expect(redteamMigration).toContain("r.id::text = (storage.foldername(name))[3]");
  });

  it("uses atomic inventory RPCs with row locks for stock movement and reservations", () => {
    const adjust = block("create or replace function public.adjust_inventory_stock", "create or replace function public.transfer_inventory_item");
    const transfer = block("create or replace function public.transfer_inventory_item", "create or replace function public.reserve_inventory_item");
    const reserve = block("create or replace function public.reserve_inventory_item", "grant execute on function public.adjust_inventory_stock");
    expect(adjust).toMatch(/for update/i);
    expect(adjust).toContain("negative_stock_not_allowed");
    expect(transfer).toMatch(/for update/i);
    expect(transfer).toContain("insufficient_source_stock");
    expect(reserve).toMatch(/for update/i);
    expect(reserve).toContain("active_reserved");
    expect(reserve).toContain("least(p_quantity_requested, available_quantity)");
  });

  it("audits critical role, price and supplier-key changes", () => {
    expect(schema).toContain("audit_profile_role_change");
    expect(schema).toContain("audit_inventory_price_change");
    expect(schema).toContain("audit_supplier_key_change");
  });
});
