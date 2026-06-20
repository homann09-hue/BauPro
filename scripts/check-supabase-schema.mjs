import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const hardening = fs.readFileSync(path.join(root, "supabase/migrations/20260615_zz_redteam_hardening.sql"), "utf8");
const reportArchiveHardening = fs.readFileSync(
  path.join(root, "supabase/migrations/20260617_report_archive_hardening.sql"),
  "utf8"
);
const privacySecurityHardening = fs.readFileSync(
  path.join(root, "supabase/migrations/20260708_privacy_security_hardening.sql"),
  "utf8"
);

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function block(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  return startIndex >= 0 && endIndex > startIndex ? source.slice(startIndex, endIndex) : "";
}

const inventoryPublicView = block(
  schema,
  "create or replace view public.inventory_items_public as",
  "grant select on public.inventory_items_public"
);

check(schema.includes("force row level security"), "schema.sql must force RLS on public tables.");
check(hardening.includes("force row level security"), "redteam migration must force RLS.");
check(
  privacySecurityHardening.includes("force row level security") &&
    privacySecurityHardening.includes("information_schema.columns") &&
    privacySecurityHardening.includes("column_name = 'company_id'"),
  "privacy/security migration must force RLS on all tenant tables with company_id."
);
check(
  schema.includes("BauPro final privacy/security hardening") &&
    schema.includes("column_name = 'company_id'") &&
    schema.includes("force row level security"),
  "schema.sql must include the final privacy/security hardening block."
);
check(schema.includes("redteam managers select fallback"), "schema.sql must include tenant manager CRUD fallback policies.");
check(hardening.includes("redteam managers delete fallback"), "redteam migration must include tenant delete fallback policies.");

check(inventoryPublicView.includes("where i.company_id = public.current_company_id()"), "inventory_items_public must filter by current company.");
check(
  !/\b(purchase_price|sales_price|markup_percent|price_per_unit|price_net|price_gross|total_price_gross)\b/.test(inventoryPublicView),
  "inventory_items_public must not expose price columns."
);

check(schema.includes('drop policy if exists "read own company inventory items"'), "full inventory_items read policy must be replaced.");
check(schema.includes("managers can read inventory items with prices"), "priced inventory_items must be manager-only.");
check(schema.includes("managers can read materials with prices"), "priced materials table must be manager-only.");
check(schema.includes("managers can read priced material catalog"), "priced material_catalog must be manager-only.");

for (const functionName of ["adjust_inventory_stock", "transfer_inventory_item", "reserve_inventory_item"]) {
  check(schema.includes(`function public.${functionName}`), `${functionName} must exist in schema.sql.`);
  check(hardening.includes(`function public.${functionName}`), `${functionName} must exist in redteam migration.`);
}

check(/for update/i.test(block(schema, "function public.adjust_inventory_stock", "function public.transfer_inventory_item")), "stock adjustment must lock rows.");
check(/for update/i.test(block(schema, "function public.transfer_inventory_item", "function public.reserve_inventory_item")), "stock transfer must lock rows.");
check(/active_reserved/i.test(block(schema, "function public.reserve_inventory_item", "grant execute on function public.adjust_inventory_stock")), "reservation RPC must account for existing reservations.");
check(schema.includes("negative_stock_not_allowed"), "inventory RPC must reject negative stock.");

check(schema.includes("(storage.foldername(name))[2] = 'reports'"), "storage upload policy must enforce reports path segment.");
check(schema.includes("r.id::text = (storage.foldername(name))[3]"), "storage upload policy must bind path report_id to reports table.");

check(schema.includes("audit_inventory_price_change"), "price changes must be audited.");
check(schema.includes("audit_supplier_key_change"), "supplier key changes must be audited.");
check(schema.includes("audit_profile_role_change"), "role changes must be audited.");

check(schema.includes("archived_at timestamptz"), "reports must support archived_at for soft deletion.");
check(reportArchiveHardening.includes("alter table public.reports add column if not exists archived_at timestamptz"), "report archive migration must add archived_at.");
check(schema.includes("reports_archived_idx"), "reports archived index must exist in schema.sql.");
check(reportArchiveHardening.includes("reports_archived_idx"), "reports archived index must exist in migration.");
check(
  block(schema, 'create policy "read relevant reports"', 'drop policy if exists "create own reports"').includes("archived_at is null"),
  "report read policy must hide archived reports."
);
check(
  block(schema, 'create policy "read relevant report photos"', 'drop policy if exists "create report photos"').includes("r.archived_at is null"),
  "report photo read policy must hide photos behind archived reports."
);

if (failures.length > 0) {
  console.error("Supabase schema hardening check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Supabase schema hardening check passed.");
