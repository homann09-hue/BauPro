"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext, requirePermission } from "@/lib/auth";
import {
  selectSingleTimeEntryWithWeatherFallback,
  timeEntryWriteOptions
} from "@/lib/data/time-entries";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { hasAppPermission } from "@/lib/permissions";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { safeReturnPath, withStatusMessage } from "@/lib/security/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateTimeMinutes, monthRange, timeEntryWarnings } from "@/lib/time-tracking";
import { optionalNumber, optionalString, requiredString } from "@/lib/utils";
import { weatherPayloadFromFormData } from "@/lib/weather/form";
import type { TimeEntry, TimeEntryStatus } from "@/types/app";

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

type TimeEntryStatusUpdateResult = {
  entry: TimeEntry;
  returnTo: string;
};

function assertTimeEntryDateAllowed(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SafeActionError("Datum muss im Format JJJJ-MM-TT angegeben werden.");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new SafeActionError("Datum ist ungueltig.");
  }

  const maxDate = new Date();
  maxDate.setUTCHours(0, 0, 0, 0);
  maxDate.setUTCDate(maxDate.getUTCDate() + 7);

  if (date > maxDate) {
    throw new SafeActionError("Zeiteinträge dürfen maximal 7 Tage in der Zukunft liegen.");
  }
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
    throw new SafeActionError("Baustelle wurde nicht gefunden oder ist fuer dich nicht freigegeben.");
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
    throw new SafeActionError("Mitarbeiter wurde nicht gefunden.");
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
  const date = requiredString(formData, "date");
  assertTimeEntryDateAllowed(date);

  return {
    company_id: companyId,
    employee_id: employeeId,
    job_id: jobId,
    customer_id: optionalString(formData, "customer_id"),
    date,
    work_location: optionalString(formData, "work_location") ?? jobsite.name,
    work_address: optionalString(formData, "work_address") ?? jobsite.address,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes,
    gross_minutes: calculated.grossMinutes,
    net_minutes: calculated.netMinutes,
    activity: requiredString(formData, "activity"),
    ...weatherPayloadFromFormData(formData),
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
  const returnTo = safeReturnPath(formData.get("return_to"), "/time/new");
  let target = "/time-tracking";
  const canEditTeamTimes = hasAppPermission(context.profile.role, context.permissions, "time.team.edit");

  try {
    const payload = await buildTimeEntryPayload({
      formData,
      canManage: canEditTeamTimes,
      companyId: context.companyId,
      userId: context.userId
    });

    const writeOptions = await timeEntryWriteOptions(supabase, payload);
    const { data, error } = await supabase
      .from("time_entries")
      .insert(writeOptions.payload)
      .select(writeOptions.select)
      .single();
    if (error || !data) throw new Error("time_entry_insert_failed");
    const typedEntry = data as unknown as TimeEntry;

    await insertAuditLog({
      companyId: context.companyId,
      entryId: typedEntry.id,
      userId: context.userId,
      oldValues: null,
      newValues: data,
      reason: "Arbeitszeit angelegt"
    });

    target = `/time-tracking?success=${toQuery(`Arbeitszeit wurde gespeichert.${warningMessage(typedEntry)}`)}`;
  } catch (error) {
    target = withStatusMessage(returnTo, "error", safeErrorMessage(error, "Arbeitszeit konnte nicht gespeichert werden."));
  }

  revalidatePath("/time-tracking");
  revalidateDashboardCache(context.companyId);
  redirect(target);
}

export async function updateTimeEntryAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  let target = `/time-tracking/${id}/edit`;
  const canEditTeamTimes = hasAppPermission(context.profile.role, context.permissions, "time.team.edit");

  try {
    const { data: oldEntry, error: oldError } = await selectSingleTimeEntryWithWeatherFallback((select) =>
      supabase.from("time_entries").select(select).eq("id", id).eq("company_id", context.companyId).single()
    );

    if (oldError || !oldEntry) throw new SafeActionError("Arbeitszeit wurde nicht gefunden.");
    const typedOld = oldEntry as unknown as TimeEntry;

    if (!canEditTeamTimes && typedOld.status === "approved") {
      throw new SafeActionError("Freigegebene Zeiten koennen von Mitarbeitern nicht mehr bearbeitet werden.");
    }

    const payload = await buildTimeEntryPayload({
      formData,
      canManage: canEditTeamTimes,
      companyId: context.companyId,
      userId: context.userId,
      currentEmployeeId: canEditTeamTimes ? undefined : typedOld.employee_id
    });

    const updatePayload = {
      ...payload,
      created_by: typedOld.created_by,
      approved_by:
        payload.status === "approved" ? typedOld.approved_by ?? context.userId : canEditTeamTimes ? null : typedOld.approved_by,
      approved_at:
        payload.status === "approved" ? typedOld.approved_at ?? new Date().toISOString() : canEditTeamTimes ? null : typedOld.approved_at
    };

    const writeOptions = await timeEntryWriteOptions(supabase, updatePayload);
    const { data, error } = await supabase
      .from("time_entries")
      .update(writeOptions.payload)
      .eq("id", id)
      .eq("company_id", context.companyId)
      .select(writeOptions.select)
      .single();

    if (error || !data) throw new Error("time_entry_update_failed");
    const typedEntry = data as unknown as TimeEntry;

    await insertAuditLog({
      companyId: context.companyId,
      entryId: id,
      userId: context.userId,
      oldValues: oldEntry,
      newValues: data,
      reason: optionalString(formData, "change_reason") ?? "Arbeitszeit bearbeitet"
    });

    target = `/time-tracking?success=${toQuery(`Arbeitszeit wurde aktualisiert.${warningMessage(typedEntry)}`)}`;
  } catch (error) {
    target = `/time-tracking/${id}/edit?error=${toQuery(
      safeErrorMessage(error, "Arbeitszeit konnte nicht aktualisiert werden.")
    )}`;
  }

  revalidatePath("/time-tracking");
  revalidatePath(`/time-tracking/${id}/edit`);
  revalidateDashboardCache(context.companyId);
  redirect(target);
}

export async function setTimeEntryStatusAction(formData: FormData) {
  const returnToFallback = safeReturnPath(formData.get("return_to"));
  let target = returnToFallback;

  try {
    const result = await updateTimeEntryStatus(formData);
    target = withStatusMessage(result.returnTo, "success", "Status wurde gespeichert.");
  } catch (error) {
    target = withStatusMessage(returnToFallback, "error", safeErrorMessage(error, "Status konnte nicht gespeichert werden."));
  }

  redirect(target);
}

export async function setTimeEntryStatusInlineAction(formData: FormData): Promise<{ ok: boolean; message: string; status?: TimeEntryStatus }> {
  try {
    const result = await updateTimeEntryStatus(formData);
    return { ok: true, message: "Status wurde gespeichert.", status: result.entry.status };
  } catch (error) {
    return { ok: false, message: safeErrorMessage(error, "Status konnte nicht gespeichert werden.") };
  }
}

async function updateTimeEntryStatus(formData: FormData): Promise<TimeEntryStatusUpdateResult> {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  const canEditTeamTimes = hasAppPermission(context.profile.role, context.permissions, "time.team.edit");
  const requestedStatus = statusValue(formData.get("status"), canEditTeamTimes);
  const returnTo = safeReturnPath(formData.get("return_to"));

  const { data: oldEntry, error: oldError } = await selectSingleTimeEntryWithWeatherFallback((select) =>
    supabase.from("time_entries").select(select).eq("id", id).eq("company_id", context.companyId).single()
  );

  if (oldError || !oldEntry) throw new SafeActionError("Arbeitszeit wurde nicht gefunden.");
  const typedOld = oldEntry as unknown as TimeEntry;

  if (!canEditTeamTimes && typedOld.employee_id !== context.userId) {
    throw new SafeActionError("Keine Berechtigung fuer diese Arbeitszeit.");
  }

  if (!canEditTeamTimes && typedOld.status === "approved") {
    throw new SafeActionError("Freigegebene Zeiten koennen von Mitarbeitern nicht mehr geaendert werden.");
  }

  if (!canEditTeamTimes && !["draft", "submitted"].includes(requestedStatus)) {
    throw new SafeActionError("Mitarbeiter koennen Zeiten nur als Entwurf speichern oder einreichen.");
  }

  const statusPayload = {
    status: requestedStatus,
    approved_by: requestedStatus === "approved" ? context.userId : null,
    approved_at: requestedStatus === "approved" ? new Date().toISOString() : null
  };

  const writeOptions = await timeEntryWriteOptions(supabase, statusPayload);
  const { data, error } = await supabase
    .from("time_entries")
    .update(writeOptions.payload)
    .eq("id", id)
    .eq("company_id", context.companyId)
    .select(writeOptions.select)
    .single();

  if (error || !data) throw new Error("time_entry_status_update_failed");

  await insertAuditLog({
    companyId: context.companyId,
    entryId: id,
    userId: context.userId,
    oldValues: oldEntry,
    newValues: data,
    reason: optionalString(formData, "change_reason") ?? `Status geaendert zu ${requestedStatus}`
  });

  revalidatePath("/time-tracking");
  revalidatePath("/time-tracking/daily");
  revalidatePath(returnTo.split("?")[0] || "/time-tracking");
  revalidateDashboardCache(context.companyId);

  return {
    entry: data as unknown as TimeEntry,
    returnTo
  };
}

export async function createTimeReportAction(formData: FormData) {
  const context = await requirePermission("time.team.view", "/time-tracking/reports");
  const supabase = await createSupabaseServerClient();
  let target = "/time-tracking/reports";

  try {
    const employeeId = requiredString(formData, "employee_id");
    const month = positiveInteger(formData, "month");
    const year = positiveInteger(formData, "year");
    if (month < 1 || month > 12) throw new SafeActionError("Bitte gueltigen Monat auswaehlen.");
    if (year < 2000 || year > 2100) throw new SafeActionError("Bitte gueltiges Jahr eintragen.");

    await assertEmployee(supabase, employeeId, context.companyId);
    const { dateFrom, dateTo } = monthRange(year, month);
    const { data: existingReport } = await supabase
      .from("time_reports")
      .select("id")
      .eq("company_id", context.companyId)
      .eq("employee_id", employeeId)
      .eq("month", month)
      .eq("year", year)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle();

    if (existingReport?.id) {
      throw new SafeActionError("Für diesen Mitarbeiter und Monat existiert bereits ein Stundenzettel.");
    }

    const { data: entries, error: entriesError } = await supabase
      .from("time_entries")
      .select("id")
      .eq("company_id", context.companyId)
      .eq("employee_id", employeeId)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .in("status", ["submitted", "approved"])
      .order("date", { ascending: true });

    if (entriesError) throw new Error("time_entries_load_failed");
    if (!entries || entries.length === 0) {
      throw new SafeActionError("Keine eingereichten oder freigegebenen Zeiten fuer diesen Zeitraum gefunden.");
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

    if (reportError || !report) throw new Error("time_report_insert_failed");

    const { error: linkError } = await supabase.from("time_report_entries").insert(
      entries.map((entry) => ({
        time_report_id: report.id,
        time_entry_id: entry.id
      }))
    );

    if (linkError) throw new Error("time_report_entries_link_failed");
    target = `/time-tracking/reports/${report.id}?success=${toQuery("Stundenzettel wurde erstellt.")}`;
  } catch (error) {
    target = `/time-tracking/reports?error=${toQuery(
      safeErrorMessage(error, "Stundenzettel konnte nicht erstellt werden.")
    )}`;
  }

  revalidatePath("/time-tracking/reports");
  redirect(target);
}
