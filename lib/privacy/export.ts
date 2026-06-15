import { isMissingSchemaError } from "@/lib/supabase/errors";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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
    safeRows("Profil", supabase.from("profiles").select("id, company_id, email, full_name, role, active, created_at, updated_at").eq("id", userId), issues),
    safeRows("Zeiten", supabase.from("time_entries").select("*").eq("company_id", companyId).eq("employee_id", userId), issues),
    safeRows("Tagesberichte", supabase.from("reports").select("*").eq("company_id", companyId).contains("employee_ids", [userId]), issues),
    safeRows("Berichtsfotos", supabase.from("report_photos").select("id, report_id, file_name, content_type, created_at").eq("company_id", companyId).eq("created_by", userId), issues),
    safeRows("Spracheingaben", supabase.from("voice_notes").select("*").eq("company_id", companyId).eq("user_id", userId), issues),
    safeRows("KI-Aktionen", supabase.from("ai_actions").select("*").eq("company_id", companyId).eq("user_id", userId), issues),
    safeRows("KI-Nutzung", supabase.from("ai_usage_logs").select("*").eq("company_id", companyId).eq("user_id", userId), issues),
    safeRows("Aufgaben", supabase.from("tasks").select("*").eq("company_id", companyId).eq("assigned_to", userId), issues),
    safeRows("Mitbringlisten", supabase.from("bring_lists").select("*").eq("company_id", companyId).eq("assigned_to", userId), issues)
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
    const query =
      table === "companies"
        ? supabase.from(table).select("*").eq("id", companyId)
        : supabase.from(table).select("*").eq("company_id", companyId);
    data[table] = await safeRows(table, query, issues);
  }

  const bringListIds = (data.bring_lists ?? [])
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");
  data.bring_list_items = bringListIds.length
    ? await safeRows("bring_list_items", supabase.from("bring_list_items").select("*").in("bring_list_id", bringListIds), issues)
    : [];

  const timeReportIds = (data.time_reports ?? [])
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");
  data.time_report_entries = timeReportIds.length
    ? await safeRows("time_report_entries", supabase.from("time_report_entries").select("*").in("time_report_id", timeReportIds), issues)
    : [];

  await auditExport({
    supabase,
    companyId,
    actorId,
    action: "company_data_export",
    metadata: { table_count: tableNames.length, issue_count: issues.length }
  });

  return {
    export_type: "company_data",
    generated_at: new Date().toISOString(),
    company: { id: companyId, name: companyName },
    issues,
    data
  };
}

export function jsonDownloadResponse(payload: unknown, filename: string) {
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
