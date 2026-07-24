import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { SafeActionError, safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/origin";
import { assertProfilesInCompany, assertVehicleInCompany } from "@/lib/security/tenant-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanningAssignmentStatus, PlanningResourceType } from "@/types/app";

const assignmentStatuses = ["geplant", "aktiv", "erledigt", "verschoben", "krank", "urlaub", "werkstatt", "defekt", "weiterbildung"] as const;
const resourceTypes = ["employee", "vehicle", "equipment"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new SafeActionError(`${label} fehlt.`);
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredDate(value: unknown, label: string) {
  const date = requiredString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new SafeActionError(`${label} muss ein Datum sein.`);
  return date;
}

function statusValue(value: unknown) {
  return typeof value === "string" && (assignmentStatuses as readonly string[]).includes(value)
    ? (value as PlanningAssignmentStatus)
    : "geplant";
}

function safeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2E7D32";
}

function targetColumns(resourceType: PlanningResourceType, resourceId: string) {
  return {
    employee_id: resourceType === "employee" ? resourceId : null,
    vehicle_id: resourceType === "vehicle" ? resourceId : null,
    planning_resource_id: resourceType === "equipment" ? resourceId : null
  };
}

async function assertTargetInCompany({
  supabase,
  companyId,
  resourceType,
  resourceId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  resourceType: PlanningResourceType;
  resourceId: string;
}) {
  if (resourceType === "employee") {
    await assertProfilesInCompany({
      supabase,
      companyId,
      profileIds: [resourceId],
      allowedRoles: ["vorarbeiter", "mitarbeiter"]
    });
    return;
  }

  if (resourceType === "vehicle") {
    await assertVehicleInCompany({ supabase, companyId, vehicleId: resourceId });
    return;
  }

  const { data, error } = await supabase
    .from("planning_resources")
    .select("id")
    .eq("id", resourceId)
    .eq("company_id", companyId)
    .eq("active", true)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) throw new SafeActionError("Ressource wurde nicht gefunden.");
}

async function loadJobsiteName({
  supabase,
  companyId,
  jobsiteId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  jobsiteId: string | null;
}) {
  if (!jobsiteId) return null;
  const { data, error } = await supabase
    .from("jobsites")
    .select("id, name")
    .eq("id", jobsiteId)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) throw new SafeActionError("Baustelle wurde nicht gefunden.");
  return data as { id: string; name: string };
}

function resourceTarget(value: unknown) {
  const resourceKey = requiredString(value, "Ressource");
  const [type, id] = resourceKey.split(":");
  if (!(resourceTypes as readonly string[]).includes(type) || !id || !uuidPattern.test(id)) {
    throw new SafeActionError("Ungültige Ressource.");
  }
  return { resourceType: type as PlanningResourceType, resourceId: id };
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOptionalAppContext();
    if (!context) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    if (!context.canManage) {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    await checkRateLimit(`planning-assignments:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 30, 60_000);

    const payload = (await request.json()) as Record<string, unknown>;
    const supabase = await createSupabaseServerClient();
    const { resourceType, resourceId } = resourceTarget(payload.resourceKey);
    const jobsiteId = optionalString(payload.jobsiteId);
    const startDate = requiredDate(payload.startDate, "Startdatum");
    const endDate = requiredDate(payload.endDate, "Enddatum");
    if (endDate < startDate) throw new SafeActionError("Enddatum darf nicht vor dem Startdatum liegen.");

    await assertTargetInCompany({ supabase, companyId: context.companyId, resourceType, resourceId });
    const jobsite = await loadJobsiteName({ supabase, companyId: context.companyId, jobsiteId });
    const title = optionalString(payload.title) ?? jobsite?.name ?? "Blocker";

    const { data, error } = await supabase
      .from("planning_assignments")
      .insert({
        company_id: context.companyId,
        jobsite_id: jobsiteId,
        title,
        resource_type: resourceType,
        ...targetColumns(resourceType, resourceId),
        start_date: startDate,
        end_date: endDate,
        status: statusValue(payload.status),
        color: safeColor(payload.color),
        notes: optionalString(payload.notes),
        created_by: context.userId
      })
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Planung konnte nicht gespeichert werden. Ist die Plantafel-Migration eingespielt?");

    revalidatePath("/plantafel");
    return NextResponse.json({ success: "Planung wurde gespeichert.", id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Planung konnte nicht gespeichert werden.") },
      { status: safeErrorStatus(error) }
    );
  }
}
