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
const rlsPolicyMatrix = fs.readFileSync(path.join(root, "docs/RLS_POLICY_MATRIX.md"), "utf8");
const rlsConsolidation = fs.readFileSync(
  path.join(root, "supabase/migrations/20260622_rls_consolidation.sql"),
  "utf8"
);
const sessionTimeoutSetting = fs.readFileSync(
  path.join(root, "supabase/migrations/20260623_session_timeout_setting.sql"),
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
check(
  schema.includes("RLS consolidation: exact duplicate redteam fallback policies removed"),
  "schema.sql must include the documented RLS consolidation block."
);
check(
  schema.indexOf("RLS consolidation: exact duplicate redteam fallback policies removed") >
    schema.indexOf('create policy "redteam managers select fallback" on %I.%I'),
  "RLS consolidation block must run after dynamic redteam fallback policy creation."
);
check(rlsPolicyMatrix.includes("# RLS Policy Matrix"), "RLS policy matrix must be generated.");
check(
  rlsPolicyMatrix.includes("Automatisch als exakt redundant erkannte Fallback-Policies: 0"),
  "RLS policy matrix must confirm that no exact duplicate redteam fallbacks remain."
);
check(
  rlsConsolidation.includes("scripts/audit-rls-policies.mjs --redundant-drops"),
  "RLS consolidation migration must be generated from the audit script."
);
check(!/create policy/i.test(rlsConsolidation), "RLS consolidation migration must not create new policies.");
check(
  rlsConsolidation.includes("to_regclass(format('%I.%I'") &&
    rlsConsolidation.includes("drop policy if exists %I on %I.%I") &&
    rlsConsolidation.includes("redteam managers select fallback"),
  "RLS consolidation migration must guard missing tables and only remove documented redteam fallback policies."
);
check(schema.includes("session_timeout_minutes integer not null default 30"), "companies must define session timeout minutes.");
check(schema.includes("companies_session_timeout_minutes_check"), "companies must constrain session timeout minutes.");
check(
  sessionTimeoutSetting.includes("session_timeout_minutes integer not null default 30") &&
    sessionTimeoutSetting.includes("check (session_timeout_minutes between 0 and 1440)"),
  "session timeout migration must add and constrain the company setting."
);

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
check(schema.includes("function public.assert_role_change_allowed"), "role changes must be guarded before audit.");
check(schema.includes("guard_profile_role_change_before_audit"), "profiles must have a role escalation guard trigger.");
check(schema.includes("before update of role on public.profiles"), "role escalation guard must run before profile role updates.");
check(schema.includes("Keine Berechtigung fuer diese Rollenaenderung."), "role escalation guard must raise a safe German error.");

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
