import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const roleHardeningMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260615_roles_security_hardening.sql"),
  "utf8"
);
const privacyMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260615_privacy_compliance.sql"), "utf8");
const redteamMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260615_zz_redteam_hardening.sql"),
  "utf8"
);
const inventoryRpcActorMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260617_inventory_rpc_actor_hardening.sql"),
  "utf8"
);
const vehicleMaterialTenantMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260617_vehicle_material_tenant_hardening.sql"),
  "utf8"
);
const legacySoftDeleteMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260617_legacy_soft_delete_hardening.sql"),
  "utf8"
);
const reportArchiveHardeningMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260617_report_archive_hardening.sql"),
  "utf8"
);
const taskAssignmentHardeningMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260617_task_assignment_hardening.sql"),
  "utf8"
);
const bringListDirectUpdateHardeningMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260617_bring_list_direct_update_hardening.sql"),
  "utf8"
);
const inventoryJobsiteFlowMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260630_inventory_jobsite_flow.sql"),
  "utf8"
);
const autoBringListsMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260701_auto_bring_lists.sql"),
  "utf8"
);
const deliveryNoteRecognitionMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260702_delivery_note_recognition.sql"),
  "utf8"
);
const aiRoofMaterialCalculationMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260703_ai_roof_material_calculation.sql"),
  "utf8"
);
const resourceVehicleManagementMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260704_resource_vehicle_management.sql"),
  "utf8"
);
const flexibleChecklistsMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260705_flexible_checklists.sql"),
  "utf8"
);
const defectManagementMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260706_defect_management.sql"),
  "utf8"
);
const privacySecurityHardeningMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260708_privacy_security_hardening.sql"),
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
  it("documents every Supabase delta migration in the setup guide", () => {
    const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();

    for (const migration of migrations) {
      expect(readme, migration).toContain(`supabase/migrations/${migration}`);
    }
  });

  it("supports Vorarbeiter but does not grant manager rights", () => {
    expect(schema).toContain("role in ('admin', 'chef', 'vorarbeiter', 'mitarbeiter', 'kunde')");
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

  it("keeps a final forced-RLS guard for all tenant tables", () => {
    for (const sql of [schema, privacySecurityHardeningMigration]) {
      expect(sql).toContain("information_schema.columns");
      expect(sql).toContain("column_name = 'company_id'");
      expect(sql).toContain("force row level security");
      expect(sql).toContain("alter table if exists public.companies force row level security");
    }

    expect(schema).toContain("BauPro final privacy/security hardening");
    expect(privacySecurityHardeningMigration).toContain("20260708_privacy_security_hardening");
  });

  it("limits time entries to company managers or the owning employee", () => {
    const policy = block("create policy \"read relevant time entries\"", "drop policy if exists \"create time entries\"");
    expect(policy).toContain("company_id = public.current_company_id()");
    expect(policy).toContain("public.can_manage_company() or employee_id = auth.uid()");
  });

  it("limits task reads and updates to managers or assigned employees only", () => {
    const taskPolicies = block('create policy "read relevant tasks"', "insert into storage.buckets");

    for (const sql of [taskPolicies, taskAssignmentHardeningMigration]) {
      expect(sql).toContain("company_id = public.current_company_id()");
      expect(sql).toContain("archived_at is null");
      expect(sql).toContain("public.can_manage_company() or assigned_to = auth.uid()");
      expect(sql).toContain("assigned_to = auth.uid() and archived_at is null");
    }
  });

  it("adds a forced-RLS planning board with manager writes and scoped employee reads", () => {
    expect(schema).toContain("create table if not exists public.planning_resources");
    expect(schema).toContain("create table if not exists public.planning_assignments");
    expect(schema).toContain("alter table public.planning_resources force row level security");
    expect(schema).toContain("alter table public.planning_assignments force row level security");
    expect(schema).toContain('create policy "members read planning resources"');
    expect(schema).toContain('create policy "members read planning assignments"');
    expect(schema).toContain('create policy "managers insert planning assignments"');
    expect(schema).toContain('create policy "managers update planning assignments"');
    expect(schema).toContain('create policy "managers insert planning resources"');
    expect(schema).toContain('create policy "managers update planning resources"');
    expect(schema).toContain("public.can_manage_company()");
    expect(schema).toContain("role = 'vorarbeiter'");
    expect(schema).toContain("resource_type = 'employee' and employee_id = auth.uid()");
    expect(schema).not.toContain('create policy "managers write planning assignments"');
    expect(schema).not.toContain('create policy "managers write planning resources"');
  });

  it("adds resource and vehicle management with scoped documents and storage policies", () => {
    for (const sql of [schema, resourceVehicleManagementMigration]) {
      expect(sql).toContain("alter table public.vehicles add column if not exists status text");
      expect(sql).toContain("alter table public.planning_resources add column if not exists vehicle_id uuid");
      expect(sql).toContain("check (resource_kind in ('fahrzeug', 'anhaenger', 'maschine', 'werkzeug', 'geruest_leiter', 'geraet', 'sonstiges'))");
      expect(sql).toContain("check (status in ('verfuegbar', 'auf_baustelle', 'im_fahrzeug', 'defekt', 'werkstatt', 'reserviert', 'archiviert'))");
      expect(sql).toContain("create table if not exists public.resource_documents");
      expect(sql).toContain("alter table public.resource_documents force row level security");
      expect(sql).toContain('create policy "members read resource documents"');
      expect(sql).toContain('create policy "managers insert resource documents"');
      expect(sql).toContain("create or replace function public.validate_resource_document_tenant()");
      expect(sql).toContain("planning_resource_not_found");
      expect(sql).toContain("vehicle_not_found");
      expect(sql).toContain("bucket_id = 'resource-documents'");
      expect(sql).toContain("(storage.foldername(name))[2] = 'resources'");
      expect(sql).toContain("(storage.foldername(name))[2] = 'vehicles'");
      expect(sql).not.toContain('create policy "managers delete resource documents"');
    }
  });

  it("adds flexible checklists with scoped jobsite access and problem task automation", () => {
    for (const sql of [schema, flexibleChecklistsMigration]) {
      expect(sql).toContain("create table if not exists public.checklist_templates");
      expect(sql).toContain("create table if not exists public.jobsite_checklists");
      expect(sql).toContain("create table if not exists public.jobsite_checklist_items");
      expect(sql).toContain("create table if not exists public.checklist_item_photos");
      expect(sql).toContain("alter table public.checklist_templates force row level security");
      expect(sql).toContain("alter table public.jobsite_checklists force row level security");
      expect(sql).toContain('create policy "members read checklist templates"');
      expect(sql).toContain('create policy "members read jobsite checklists"');
      expect(sql).toContain('create policy "operators update jobsite checklist items"');
      expect(sql).toContain("public.can_manage_company()");
      expect(sql).toContain("auth.uid() = any(j.assigned_employee_ids)");
      expect(sql).toContain("create or replace function public.create_task_for_checklist_problem()");
      expect(sql).toContain("concat('Mangel/Problem: ', left(new.label, 120))");
      expect(sql).toContain("bucket_id = 'checklist-photos'");
      expect(sql).toContain("(storage.foldername(name))[2] = 'checklists'");
      expect(sql).toContain('drop policy if exists "redteam managers delete fallback" on public.jobsite_checklists');
    }
  });

  it("adds defect management with scoped jobsite access, customer release and due notifications", () => {
    for (const sql of [schema, defectManagementMigration]) {
      expect(sql).toContain("create table if not exists public.defects");
      expect(sql).toContain("create table if not exists public.defect_photos");
      expect(sql).toContain("create table if not exists public.defect_notifications");
      expect(sql).toContain("alter table public.defects force row level security");
      expect(sql).toContain('create policy "members read relevant defects"');
      expect(sql).toContain('create policy "members insert assigned jobsite defects"');
      expect(sql).toContain('create policy "members update relevant defects"');
      expect(sql).toContain("public.can_manage_company()");
      expect(sql).toContain("auth.uid() = any(j.assigned_employee_ids)");
      expect(sql).toContain("restricted_defect_update");
      expect(sql).toContain("create or replace function public.create_defect_due_notification()");
      expect(sql).toContain("create or replace function public.create_defect_from_checklist_problem()");
      expect(sql).toContain("visible_to_customer boolean not null default false");
      expect(sql).toContain("customer_released_at timestamptz");
      expect(sql).toContain("bucket_id = 'defect-photos'");
      expect(sql).toContain("(storage.foldername(name))[2] = 'defects'");
      expect(sql).toContain('drop policy if exists "redteam managers delete fallback" on public.defects');
    }
  });

  it("adds forced-RLS cached weather risks for the planning board", () => {
    expect(schema).toContain("create table if not exists public.planning_weather_checks");
    expect(schema).toContain("alter table public.planning_weather_checks force row level security");
    expect(schema).toContain('create policy "read relevant planning weather checks"');
    expect(schema).toContain('create policy "managers insert planning weather checks"');
    expect(schema).toContain('create policy "managers update planning weather checks"');
    expect(schema).toContain("risk_level text not null default 'green' check (risk_level in ('green', 'yellow', 'red'))");
    expect(schema).toContain("acknowledged_action text check (acknowledged_action in ('confirmed', 'ignored'))");
    expect(schema).toContain("resource_type = 'employee'");
    expect(schema).toContain("pa.employee_id = auth.uid()");
    expect(schema).not.toContain('create policy "managers delete planning weather checks"');
  });

  it("hardens bring lists against direct tenant and assignment manipulation", () => {
    const bringListHardening = block(
      "create or replace function public.can_access_bring_list(",
      "select pg_notify('pgrst', 'reload schema');"
    );

    for (const sql of [bringListHardening, bringListDirectUpdateHardeningMigration]) {
      expect(sql).toContain("public.can_access_bring_list(company_id, job_id, assigned_to, created_by)");
      expect(sql).toContain("create or replace function public.validate_bring_list_tenant()");
      expect(sql).toContain("create or replace function public.validate_bring_list_item_tenant()");
      expect(sql).toContain("new.company_id <> public.current_company_id()");
      expect(sql).toContain("role in ('vorarbeiter', 'mitarbeiter')");
      expect(sql).toContain("new.assigned_to is distinct from auth.uid()");
      expect(sql).toContain("restricted_bring_list_update");
      expect(sql).toContain("restricted_bring_list_item_update");
      expect(sql).toContain("old.missing_reported and not new.missing_reported");
      expect(sql).toContain("new.packed_by is distinct from auth.uid()");
      expect(sql).toContain("material_not_found");
      expect(sql).toContain("inventory_item_not_found");
      expect(sql).toContain("vehicle_not_found");
      expect(sql).toContain("drop trigger if exists validate_bring_list_tenant");
      expect(sql).toContain("before insert or update on public.bring_lists");
      expect(sql).toContain("drop trigger if exists validate_bring_list_item_tenant");
      expect(sql).toContain("before insert or update on public.bring_list_items");
    }
  });

  it("adds automatic bring lists with source protection and audit logs", () => {
    for (const sql of [schema, autoBringListsMigration]) {
      expect(sql).toContain("auto_generated boolean not null default false");
      expect(sql).toContain("generation_source text not null default 'manual'");
      expect(sql).toContain("required_vehicle_id uuid references public.vehicles");
      expect(sql).toContain("create table if not exists public.bring_list_audit_log");
      expect(sql).toContain("alter table public.bring_list_audit_log force row level security");
      expect(sql).toContain("prevent_bring_list_auto_field_spoof");
      expect(sql).toContain("validate_bring_list_item_auto_fields");
      expect(sql).toContain("restricted_bring_list_auto_insert");
      expect(sql).toContain("restricted_bring_list_item_source_insert");
      expect(sql).toContain("public.can_access_bring_list(bl.company_id, bl.job_id, bl.assigned_to, bl.created_by)");
      expect(sql).toContain('drop policy if exists "redteam managers delete fallback" on public.bring_list_audit_log');
    }
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
    expect(adjust).toContain("p_actor_id is distinct from auth.uid()");
    expect(transfer).toMatch(/for update/i);
    expect(transfer).toContain("insufficient_source_stock");
    expect(transfer).toContain("p_actor_id is distinct from auth.uid()");
    expect(reserve).toMatch(/for update/i);
    expect(reserve).toContain("active_reserved");
    expect(reserve).toContain("least(p_quantity_requested, available_quantity)");
    expect(reserve).toContain("p_reserved_by is distinct from auth.uid()");
    expect(reserve).toContain("jobsite_not_found");
    expect(reserve).toContain("bring_list_not_found");
  });

  it("links jobsite material usage through reported entries and atomic confirmation", () => {
    for (const sql of [schema, inventoryJobsiteFlowMigration]) {
      expect(sql).toContain("create table if not exists public.material_usage_reports");
      expect(sql).toContain("alter table public.material_usage_reports force row level security");
      expect(sql).toContain('create policy "members create material usage reports"');
      expect(sql).toContain('create policy "operators update material usage reports"');
      expect(sql).toContain("create or replace function public.confirm_material_usage_report");
      expect(sql).toContain("for update");
      expect(sql).toContain("negative_stock_not_allowed");
      expect(sql).toContain("booking_type in ('consume', 'return', 'loss', 'break')");
      expect(sql).toContain("movement_type in ('purchase', 'transfer', 'reserve', 'consume', 'return', 'correction', 'loss', 'break')");
      expect(sql).toContain("current_role() = 'vorarbeiter'");
      expect(sql).toContain("auth.uid() = any(j.assigned_employee_ids)");
      expect(sql).toContain("prevent_direct_material_usage_status_update");
      expect(sql).toContain("use_material_usage_confirmation_rpc");
      expect(sql).toContain("set_config('app.material_usage_confirmation', '1', true)");
      expect(sql).toContain("create or replace function public.reserve_inventory_for_jobsite");
      expect(sql).toContain("and job_id = p_jobsite_id");
      expect(sql).toContain("drop policy if exists \"managers delete material movements\"");
      expect(sql).toContain("revoke delete on public.material_movements from authenticated");
    }

    expect(schema).not.toContain('create policy "managers delete material movements"');
  });

  it("prevents inventory RPC actor spoofing and cross-tenant side effects", () => {
    expect(schema).toContain("prevent_inventory_audit_actor_spoof");
    expect(schema).toContain("validate_material_reservation_tenant");
    expect(schema).toContain("validate_material_movement_tenant");
    expect(schema).toContain("prevent_inventory_item_creator_spoof");
    expect(inventoryRpcActorMigration).toContain("create table if not exists public.company_audit_log");
    expect(inventoryRpcActorMigration).toContain("create table if not exists public.material_reservations");
    expect(inventoryRpcActorMigration).toContain("create table if not exists public.material_movements");
    expect(inventoryRpcActorMigration.indexOf("create table if not exists public.company_audit_log")).toBeLessThan(
      inventoryRpcActorMigration.indexOf("drop trigger if exists prevent_inventory_audit_actor_spoof")
    );
    expect(inventoryRpcActorMigration.indexOf("create table if not exists public.material_reservations")).toBeLessThan(
      inventoryRpcActorMigration.indexOf("drop trigger if exists validate_material_reservation_tenant")
    );
    expect(inventoryRpcActorMigration.indexOf("create table if not exists public.material_movements")).toBeLessThan(
      inventoryRpcActorMigration.indexOf("drop trigger if exists validate_material_movement_tenant")
    );

    for (const sql of [schema, inventoryRpcActorMigration]) {
      expect(sql).toContain("actor_mismatch");
      expect(sql).toContain("new.actor_id is distinct from auth.uid()");
      expect(sql).toContain("new.reserved_by is distinct from auth.uid()");
      expect(sql).toContain("new.created_by is distinct from auth.uid()");
      expect(sql).toContain("inventory_item_not_found");
      expect(sql).toContain("jobsite_not_found");
      expect(sql).toContain("bring_list_not_found");
      expect(sql).toContain("material_not_found");
    }
  });

  it("prevents cross-tenant vehicle material links", () => {
    const vehicleMaterialGuard = block(
      "create or replace function public.validate_vehicle_material_tenant()",
      "create or replace function public.audit_profile_role_change()"
    );

    for (const sql of [vehicleMaterialGuard, vehicleMaterialTenantMigration]) {
      expect(sql).toContain("not_authorized");
      expect(sql).toContain("vehicle_not_found");
      expect(sql).toContain("material_not_found");
      expect(sql).toContain("new.company_id <> public.current_company_id()");
      expect(sql).toContain("from public.vehicles");
      expect(sql).toContain("from public.materials");
      expect(sql).toContain("drop trigger if exists validate_vehicle_material_tenant");
      expect(sql).toContain("before insert or update on public.vehicle_materials");
    }
  });

  it("supports soft delete/archive for legacy operational tables", () => {
    for (const sql of [schema, legacySoftDeleteMigration]) {
      expect(sql).toContain("alter table public.materials add column if not exists archived_at timestamptz");
      expect(sql).toContain("alter table public.vehicles add column if not exists archived_at timestamptz");
      expect(sql).toContain("alter table public.tasks add column if not exists archived_at timestamptz");
      expect(sql).toContain("create index if not exists materials_archived_idx on public.materials(company_id, archived_at)");
      expect(sql).toContain("create index if not exists vehicles_archived_idx on public.vehicles(company_id, archived_at)");
      expect(sql).toContain("create index if not exists tasks_archived_idx on public.tasks(company_id, archived_at)");
    }
  });

  it("archives reports and hides archived report/photo reads from normal report policies", () => {
    expect(schema).toContain("archived_at timestamptz");
    expect(reportArchiveHardeningMigration).toContain("alter table public.reports add column if not exists archived_at timestamptz");

    for (const sql of [schema, reportArchiveHardeningMigration]) {
      expect(sql).toContain("reports_archived_idx");
      expect(sql).toContain("archived_at is null");
      expect(sql).toContain('create policy "read relevant reports"');
      expect(sql).toContain('create policy "read relevant report photos"');
    }
  });

  it("audits critical role, price and supplier-key changes", () => {
    expect(schema).toContain("audit_profile_role_change");
    expect(schema).toContain("audit_inventory_price_change");
    expect(schema).toContain("audit_supplier_key_change");
  });

  it("adds delivery note recognition with price isolation and confirmed stock booking", () => {
    for (const sql of [schema, deliveryNoteRecognitionMigration]) {
      expect(sql).toContain("create table if not exists public.delivery_notes");
      expect(sql).toContain("create table if not exists public.delivery_note_items");
      expect(sql).toContain("create table if not exists public.delivery_note_item_prices");
      expect(sql).toContain("values ('delivery-notes', 'delivery-notes', false)");
      expect(sql).toContain("alter table public.delivery_notes force row level security");
      expect(sql).toContain("alter table public.delivery_note_items force row level security");
      expect(sql).toContain("alter table public.delivery_note_item_prices force row level security");
      expect(sql).toContain('create policy "operators read delivery notes"');
      expect(sql).toContain('create policy "managers read delivery note item prices"');
      expect(sql).toContain("public.can_manage_company()");
      expect(sql).toContain("current_role() in ('admin', 'chef', 'vorarbeiter')");
      expect(sql).toContain("create or replace function public.confirm_delivery_note");
      expect(sql).toContain("for update");
      expect(sql).toContain("delivery_note_item_missing_inventory");
      expect(sql).toContain("movement_type");
      expect(sql).toContain("'purchase'");
      expect(sql).toContain("delivery_note_confirmed");
      expect(sql).toContain("(storage.foldername(name))[1] = public.current_company_id()::text");
      expect(sql).toContain("(storage.foldername(name))[2] = 'delivery-notes'");
      expect(sql).not.toContain('create policy "operators read delivery note item prices"');
      expect(sql).not.toContain('create policy "operators delete delivery notes"');
    }
  });

  it("adds AI-assisted roof material calculations without exposing prices in public views", () => {
    for (const sql of [schema, aiRoofMaterialCalculationMigration]) {
      expect(sql).toContain("roof_form text");
      expect(sql).toContain("material_type text");
      expect(sql).toContain("dormers_count integer");
      expect(sql).toContain("chimneys_count integer");
      expect(sql).toContain("ai_enabled boolean");
      expect(sql).toContain("review_notice text");
      expect(sql).toContain("missing_quantity numeric");
      expect(sql).toContain("source text");
      expect(sql).toContain("ai_reason text");
      expect(sql).toContain("'dormers_count'");
      expect(sql).toContain("'chimneys_count'");
    }

    expect(aiRoofMaterialCalculationMigration).toContain("steildach_schrauben_naegel");
    expect(aiRoofMaterialCalculationMigration).toContain("steildach_gaubenanschluss");
    expect(aiRoofMaterialCalculationMigration).toContain("steildach_schornsteinanschluss");

    const publicCalculationView = block(
      "create or replace view public.job_material_calculation_items_public as",
      "grant select on public.job_material_calculation_items_public"
    );
    expect(publicCalculationView).toContain("missing_quantity");
    expect(publicCalculationView).toContain("source");
    expect(publicCalculationView).toContain("ai_reason");
    expect(publicCalculationView).not.toMatch(/\b(purchase_price|sales_price|purchase_total|sales_total|margin_total)\b/);
  });
});
