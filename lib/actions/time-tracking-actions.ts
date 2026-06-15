"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext, requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateTimeMinutes, monthRange, timeEntryWarnings } from "@/lib/time-tracking";
import { optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type { TimeEntry, TimeEntryStatus } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function statusValue(value: FormDataEntryValue | null, canManage: boolean): TimeEntryStatus {
  const status = String(value ?? "submitted");
  if (canManage && ["draft", "submitted", "approved", "rejected"].includes(status)) return status as TimeEntryStatus;
  return status === "draft" ? "draft" : "submitted";
}

function positiveInteger(formData: FormData, key: string, fallback = 0) {
  const value = Number(String(formData.get(key) ?? "").replace(",", "."));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function warningMessage(entry: Pick<TimeEntry, "gross_minutes" | "net_minutes" | "break_minutes">) {
  const warnings = timeEntryWarnings(entry);
  return warnings.length ? ` ${warnings.join(" ")}` : "";
}

async function resolveJobsite(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  jobId: string,
  companyId: string
) {
  const { data, error } = await supabase
    .from("jobsites")
    .select("id, name, address, customer")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    throw new Error("Baustelle wurde nicht gefunden oder ist fuer dich nicht freigegeben.");
  }

  return data as { id: string; name: string; address: string; customer: string };
}

async function assertEmployee(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  employeeId: string,
  companyId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .eq("active", true)
    .single();

  if (error || !data) {
    throw new Error("Mitarbeiter wurde nicht gefunden.");
  }
}

async function buildTimeEntryPayload({
  formData,
  canManage,
  companyId,
  userId,
  currentEmployeeId
}: {
  formData: FormData;
  canManage: boolean;
  companyId: string;
  userId: string;
  currentEmployeeId?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const employeeId = canManage ? requiredString(formData, "employee_id") : currentEmployeeId ?? userId;
  const jobId = requiredString(formData, "job_id");
  const jobsite = await resolveJobsite(supabase, jobId, companyId);
  await assertEmployee(supabase, employeeId, companyId);

  const startTime = requiredString(formData, "start_time");
  const endTime = requiredString(formData, "end_time");
  const breakMinutes = positiveInteger(formData, "break_minutes");
  const calculated = calculateTimeMinutes({ startTime, endTime, breakMinutes });
  const status = statusValue(formData.get("status"), canManage);

  return {
    company_id: companyId,
    employee_id: employeeId,
    job_id: jobId,
    customer_id: optionalString(formData, "customer_id"),
    date: requiredString(formData, "date"),
    work_location: optionalString(formData, "work_location") ?? jobsite.name,
    work_address: optionalString(formData, "work_address") ?? jobsite.address,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes,
    gross_minutes: calculated.grossMinutes,
    net_minutes: calculated.netMinutes,
    activity: requiredString(formData, "activity"),
    weather: optionalString(formData, "weather"),
    kilometers: optionalNumber(formData, "kilometers"),
    notes: optionalString(formData, "notes"),
    status,
    approved_by: status === "approved" ? userId : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    created_by: userId
  };
}

async function insertAuditLog({
  companyId,
  entryId,
  userId,
  oldValues,
  newValues,
  reason
}: {
  companyId: string;
  entryId: string;
  userId: string;
  oldValues: unknown;
  newValues: unknown;
  reason: string;
}) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("time_entry_audit_log").insert({
    company_id: companyId,
    time_entry_id: entryId,
    changed_by: userId,
    old_values: oldValues,
    new_values: newValues,
    change_reason: reason
  });
}

export async function createTimeEntryAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  let target = "/time-tracking";

  try {
    const payload = await buildTimeEntryPayload({
      formData,
      canManage: context.canManage,
      companyId: context.companyId,
      userId: context.userId
    });

    const { data, error } = await supabase.from("time_entries").insert(payload).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Arbeitszeit konnte nicht gespeichert werden.");

    await insertAuditLog({
      companyId: context.companyId,
      entryId: data.id as string,
      userId: context.userId,
      oldValues: null,
      newValues: data,
      reason: "Arbeitszeit angelegt"
    });

    target = `/time-tracking?success=${toQuery(`Arbeitszeit wurde gespeichert.${warningMessage(data as TimeEntry)}`)}`;
  } catch (error) {
    target = `/time-tracking/new?error=${toQuery(error instanceof Error ? error.message : "Arbeitszeit konnte nicht gespeichert werden.")}`;
  }

  revalidatePath("/time-tracking");
  redirect(target);
}

export async function updateTimeEntryAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  let target = `/time-tracking/${id}/edit`;

  try {
    const { data: oldEntry, error: oldError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("id", id)
      .eq("company_id", context.companyId)
      .single();

    if (oldError || !oldEntry) throw new Error("Arbeitszeit wurde nicht gefunden.");
    const typedOld = oldEntry as TimeEntry;

    if (!context.canManage && typedOld.status === "approved") {
      throw new Error("Freigegebene Zeiten koennen von Mitarbeitern nicht mehr bearbeitet werden.");
    }

    const payload = await buildTimeEntryPayload({
      formData,
      canManage: context.canManage,
      companyId: context.companyId,
      userId: context.userId,
      currentEmployeeId: context.canManage ? undefined : typedOld.employee_id
    });

    const updatePayload = {
      ...payload,
      created_by: typedOld.created_by,
      approved_by:
        payload.status === "approved" ? typedOld.approved_by ?? context.userId : context.canManage ? null : typedOld.approved_by,
      approved_at:
        payload.status === "approved" ? typedOld.approved_at ?? new Date().toISOString() : context.canManage ? null : typedOld.approved_at
    };

    const { data, error } = await supabase
      .from("time_entries")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", context.companyId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Arbeitszeit konnte nicht aktualisiert werden.");

    await insertAuditLog({
      companyId: context.companyId,
      entryId: id,
      userId: context.userId,
      oldValues: oldEntry,
      newValues: data,
      reason: optionalString(formData, "change_reason") ?? "Arbeitszeit bearbeitet"
    });

    target = `/time-tracking?success=${toQuery(`Arbeitszeit wurde aktualisiert.${warningMessage(data as TimeEntry)}`)}`;
  } catch (error) {
    target = `/time-tracking/${id}/edit?error=${toQuery(
      error instanceof Error ? error.message : "Arbeitszeit konnte nicht aktualisiert werden."
    )}`;
  }

  revalidatePath("/time-tracking");
  revalidatePath(`/time-tracking/${id}/edit`);
  redirect(target);
}

export async function setTimeEntryStatusAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  const requestedStatus = statusValue(formData.get("status"), context.canManage);
  let target = "/time-tracking";

  try {
    const { data: oldEntry, error: oldError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("id", id)
      .eq("company_id", context.companyId)
      .single();

    if (oldError || !oldEntry) throw new Error("Arbeitszeit wurde nicht gefunden.");
    const typedOld = oldEntry as TimeEntry;

    if (!context.canManage && typedOld.employee_id !== context.userId) {
      throw new Error("Keine Berechtigung fuer diese Arbeitszeit.");
    }

    if (!context.canManage && typedOld.status === "approved") {
      throw new Error("Freigegebene Zeiten koennen von Mitarbeitern nicht mehr geaendert werden.");
    }

    if (!context.canManage && !["draft", "submitted"].includes(requestedStatus)) {
      throw new Error("Mitarbeiter koennen Zeiten nur als Entwurf speichern oder einreichen.");
    }

    const statusPayload = {
      status: requestedStatus,
      approved_by: requestedStatus === "approved" ? context.userId : null,
      approved_at: requestedStatus === "approved" ? new Date().toISOString() : null
    };

    const { data, error } = await supabase
      .from("time_entries")
      .update(statusPayload)
      .eq("id", id)
      .eq("company_id", context.companyId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Status konnte nicht gespeichert werden.");

    await insertAuditLog({
      companyId: context.companyId,
      entryId: id,
      userId: context.userId,
      oldValues: oldEntry,
      newValues: data,
      reason: optionalString(formData, "change_reason") ?? `Status geaendert zu ${requestedStatus}`
    });

    target = `/time-tracking?success=${toQuery("Status wurde gespeichert.")}`;
  } catch (error) {
    target = `/time-tracking?error=${toQuery(error instanceof Error ? error.message : "Status konnte nicht gespeichert werden.")}`;
  }

  revalidatePath("/time-tracking");
  redirect(target);
}

export async function createTimeReportAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  let target = "/time-tracking/reports";

  try {
    const employeeId = requiredString(formData, "employee_id");
    const month = positiveInteger(formData, "month");
    const year = positiveInteger(formData, "year");
    if (month < 1 || month > 12) throw new Error("Bitte gueltigen Monat auswaehlen.");
    if (year < 2000 || year > 2100) throw new Error("Bitte gueltiges Jahr eintragen.");

    await assertEmployee(supabase, employeeId, context.companyId);
    const { dateFrom, dateTo } = monthRange(year, month);

    const { data: entries, error: entriesError } = await supabase
      .from("time_entries")
      .select("id")
      .eq("company_id", context.companyId)
      .eq("employee_id", employeeId)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .in("status", ["submitted", "approved"])
      .order("date", { ascending: true });

    if (entriesError) throw new Error(entriesError.message);
    if (!entries || entries.length === 0) {
      throw new Error("Keine eingereichten oder freigegebenen Zeiten fuer diesen Zeitraum gefunden.");
    }

    const { data: report, error: reportError } = await supabase
      .from("time_reports")
      .insert({
        company_id: context.companyId,
        employee_id: employeeId,
        month,
        year,
        date_from: dateFrom,
        date_to: dateTo,
        generated_by: context.userId
      })
      .select("id")
      .single();

    if (reportError || !report) throw new Error(reportError?.message ?? "Stundenzettel konnte nicht erstellt werden.");

    const { error: linkError } = await supabase.from("time_report_entries").insert(
      entries.map((entry) => ({
        time_report_id: report.id,
        time_entry_id: entry.id
      }))
    );

    if (linkError) throw new Error(linkError.message);
    target = `/time-tracking/reports/${report.id}?success=${toQuery("Stundenzettel wurde erstellt.")}`;
  } catch (error) {
    target = `/time-tracking/reports?error=${toQuery(
      error instanceof Error ? error.message : "Stundenzettel konnte nicht erstellt werden."
    )}`;
  }

  revalidatePath("/time-tracking/reports");
  redirect(target);
}
