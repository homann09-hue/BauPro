import {
  aiActionSelect,
  bringListItemSelect,
  bringListOperationalSelect,
  customerFormSelect,
  inventoryLocationSelect,
  jobsiteFormSelect,
  materialAlertSelect,
  purchaseSuggestionSelect,
  reportFormSelect,
  reportPhotoSelect,
  timeEntryFormSelect
} from "@/lib/data/selects";
import { downloadHeaders } from "@/lib/security/downloads";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const profileExportSelect = "id, company_id, email, full_name, role, active, created_at, updated_at";
const voiceNoteExportSelect =
  "id, company_id, user_id, raw_text, detected_intent, detected_entities, linked_customer_id, linked_job_id, linked_time_entry_id, linked_bring_list_id, linked_material_alert_id, status, created_at";
const aiUsageLogExportSelect =
  "id, company_id, user_id, feature, model, input_tokens, output_tokens, status, error_message, created_at";
const taskExportSelect =
  "id, company_id, jobsite_id, title, description, assigned_to, due_date, status, created_by, created_at, updated_at";
const companyExportSelect =
  "id, name, created_by, created_at, updated_at, contact_email, phone, address, website, tax_id, payment_terms, onboarding_completed_at";
const orderExportSelect =
  "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, internal_notes, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at, archived_at";
const materialExportSelect =
  "id, company_id, name, category, unit, stock, minimum_stock, location, created_by, created_at, updated_at";
const materialPriceExportSelect =
  "id, company_id, name, category, unit, location, purchase_price, sales_price, created_by, created_at, updated_at";
const inventoryItemOperationalExportSelect =
  "id, company_id, catalog_item_id, category_id, subcategory_id, location_id, supplier_id, name, unit, stock, minimum_stock, package_unit, manufacturer, article_number, ean, sales_unit, notes, created_by, created_at, updated_at, archived_at";
const inventoryPriceExportSelect =
  "id, company_id, name, unit, purchase_price, sales_price, markup_percent, sales_unit, price_per_unit, supplier_id, last_price_changed_at, updated_at";
const supplierOfferFinancialExportSelect =
  "id, company_id, supplier_integration_id, provider_key, supplier_name, external_product_id, product_name, manufacturer, category, unit, package_size, price_net, price_gross, currency, vat_rate, shipping_cost, total_price_gross, delivery_time_text, stock_status, product_url, last_checked_at, valid_until, source_type, created_at, updated_at";
const onlinePriceDiscoveryFinancialExportSelect =
  "id, company_id, material_id, query, status, source_statuses, cheapest_price_gross, average_price_gross, offer_count, created_by, created_at";
const onlinePriceOfferFinancialExportSelect =
  "id, company_id, discovery_id, material_id, source_key, supplier_name, product_name, product_url, price_gross, shipping_cost, total_price_gross, delivery_time_text, checked_at, source_note";
const vehicleExportSelect =
  "id, company_id, name, license_plate, tuv_date, notes, created_by, created_at, updated_at, archived_at";
const timeReportExportSelect =
  "id, company_id, employee_id, month, year, date_from, date_to, status, generated_by, generated_at";
const privacyRequestExportSelect =
  "id, company_id, requester_id, request_type, status, description, response_notes, due_at, completed_at, created_at, updated_at";
const timeReportEntryExportSelect = "id, time_report_id, time_entry_id";

const companyTableSelects: Record<string, string> = {
  companies: companyExportSelect,
  profiles: profileExportSelect,
  customers: `${customerFormSelect}, archived_at`,
  jobsites: `${jobsiteFormSelect}, updated_at, archived_at`,
  orders: orderExportSelect,
  reports: reportFormSelect,
  report_photos: reportPhotoSelect,
  time_entries: timeEntryFormSelect,
  time_reports: timeReportExportSelect,
  materials: materialExportSelect,
  inventory_locations: inventoryLocationSelect,
  inventory_items: inventoryItemOperationalExportSelect,
  vehicles: vehicleExportSelect,
  tasks: taskExportSelect,
  bring_lists: bringListOperationalSelect,
  material_alerts: materialAlertSelect,
  purchase_suggestions: purchaseSuggestionSelect,
  privacy_requests: privacyRequestExportSelect
};

async function safeRows<T>(
  label: string,
  query: PromiseLike<{ data: unknown; error: unknown }>,
  issues: string[]
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    if (isMissingSchemaError(error)) {
      issues.push(`${label}: Tabelle oder Spalte fehlt in der aktuellen Supabase-Migration.`);
      return [];
    }
    issues.push(`${label}: konnte nicht geladen werden.`);
    return [];
  }
  return Array.isArray(data) ? (data as T[]) : [];
}

async function auditExport({
  supabase,
  companyId,
  actorId,
  action,
  metadata
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}) {
  const { error } = await supabase.from("company_audit_log").insert({
    company_id: companyId,
    actor_id: actorId,
    entity_type: "privacy_export",
    action,
    new_values: metadata
  });

  if (error && !isMissingSchemaError(error)) {
    // Audit darf den Export nie blockieren und soll keine personenbezogenen Details loggen.
  }
}

export async function buildOwnDataExport({
  supabase,
  companyId,
  userId,
  companyName
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  userId: string;
  companyName: string;
}) {
  const issues: string[] = [];
  const [profile, timeEntries, reports, reportPhotos, voiceNotes, aiActions, aiUsageLogs, tasks, bringLists] = await Promise.all([
    safeRows("Profil", supabase.from("profiles").select(profileExportSelect).eq("id", userId), issues),
    safeRows("Zeiten", supabase.from("time_entries").select(timeEntryFormSelect).eq("company_id", companyId).eq("employee_id", userId), issues),
    safeRows("Tagesberichte", supabase.from("reports").select(reportFormSelect).eq("company_id", companyId).contains("employee_ids", [userId]), issues),
    safeRows("Berichtsfotos", supabase.from("report_photos").select("id, report_id, file_name, content_type, created_at").eq("company_id", companyId).eq("created_by", userId), issues),
    safeRows("Spracheingaben", supabase.from("voice_notes").select(voiceNoteExportSelect).eq("company_id", companyId).eq("user_id", userId), issues),
    safeRows("KI-Aktionen", supabase.from("ai_actions").select(aiActionSelect).eq("company_id", companyId).eq("user_id", userId), issues),
    safeRows("KI-Nutzung", supabase.from("ai_usage_logs").select(aiUsageLogExportSelect).eq("company_id", companyId).eq("user_id", userId), issues),
    safeRows("Aufgaben", supabase.from("tasks").select(taskExportSelect).eq("company_id", companyId).eq("assigned_to", userId), issues),
    safeRows("Mitbringlisten", supabase.from("bring_lists").select(bringListOperationalSelect).eq("company_id", companyId).eq("assigned_to", userId), issues)
  ]);

  await auditExport({
    supabase,
    companyId,
    actorId: userId,
    action: "own_data_export",
    metadata: { subject_id: userId, issue_count: issues.length }
  });

  return {
    export_type: "own_data",
    generated_at: new Date().toISOString(),
    company: { id: companyId, name: companyName },
    issues,
    data: {
      profile,
      time_entries: timeEntries,
      reports,
      report_photos: reportPhotos,
      voice_notes: voiceNotes,
      ai_actions: aiActions,
      ai_usage_logs: aiUsageLogs,
      tasks,
      bring_lists: bringLists
    }
  };
}

export async function buildCompanyDataExport({
  supabase,
  companyId,
  actorId,
  companyName
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  actorId: string;
  companyName: string;
}) {
  const issues: string[] = [];
  const tableNames = [
    "companies",
    "profiles",
    "customers",
    "jobsites",
    "orders",
    "reports",
    "report_photos",
    "time_entries",
    "time_reports",
    "materials",
    "inventory_locations",
    "inventory_items",
    "vehicles",
    "tasks",
    "bring_lists",
    "material_alerts",
    "purchase_suggestions",
    "privacy_requests"
  ];

  const data: Record<string, unknown[]> = {};
  for (const table of tableNames) {
    const selectFields = companyTableSelects[table];
    const query =
      table === "companies"
        ? supabase.from(table).select(selectFields).eq("id", companyId)
        : supabase.from(table).select(selectFields).eq("company_id", companyId);
    data[table] = await safeRows(table, query, issues);
  }

  const bringListIds = (data.bring_lists ?? [])
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");
  data.bring_list_items = bringListIds.length
    ? await safeRows("bring_list_items", supabase.from("bring_list_items").select(bringListItemSelect).in("bring_list_id", bringListIds), issues)
    : [];

  const timeReportIds = (data.time_reports ?? [])
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");
  data.time_report_entries = timeReportIds.length
    ? await safeRows(
        "time_report_entries",
        supabase.from("time_report_entries").select(timeReportEntryExportSelect).in("time_report_id", timeReportIds),
        issues
      )
    : [];

  const restrictedFinancialData = {
    materials_with_prices: await safeRows(
      "materials_with_prices",
      supabase.from("materials").select(materialPriceExportSelect).eq("company_id", companyId),
      issues
    ),
    inventory_prices: await safeRows(
      "inventory_prices",
      supabase.from("inventory_items").select(inventoryPriceExportSelect).eq("company_id", companyId),
      issues
    ),
    supplier_offers: await safeRows(
      "supplier_offers",
      supabase.from("supplier_offers").select(supplierOfferFinancialExportSelect).eq("company_id", companyId),
      issues
    ),
    online_price_discoveries: await safeRows(
      "online_price_discoveries",
      supabase.from("online_price_discoveries").select(onlinePriceDiscoveryFinancialExportSelect).eq("company_id", companyId),
      issues
    ),
    online_price_offers: await safeRows(
      "online_price_offers",
      supabase.from("online_price_offers").select(onlinePriceOfferFinancialExportSelect).eq("company_id", companyId),
      issues
    )
  };

  await auditExport({
    supabase,
    companyId,
    actorId,
    action: "company_data_export",
    metadata: {
      table_count: tableNames.length,
      restricted_financial_sections: Object.keys(restrictedFinancialData),
      issue_count: issues.length
    }
  });

  return {
    export_type: "company_data",
    generated_at: new Date().toISOString(),
    company: { id: companyId, name: companyName },
    export_policy: {
      access: "chef_admin_only",
      operational_data_is_price_redacted: true,
      restricted_financial_data_contains_prices: true,
      employee_exports_exclude_price_margin_and_supplier_offer_fields: true
    },
    issues,
    data,
    restricted_financial_data: restrictedFinancialData
  };
}

export function jsonDownloadResponse(payload: unknown, filename: string) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: downloadHeaders("application/json; charset=utf-8", filename)
  });
}
