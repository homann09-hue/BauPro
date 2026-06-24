import { NextResponse } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { logServerWarning } from "@/lib/security/logging";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { selectActiveWeatherJobsite } from "@/lib/weather/live-weather";

const allowedScopes = new Set(["dashboard", "jobsites", "tasks", "planning", "team", "materials", "time", "bring-lists", "weather"]);

function response(payload: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      "Cache-Control": "private, max-age=45, stale-while-revalidate=300",
      "X-BauPro-Prefetch": "1",
      ...(init?.headers ?? {})
    }
  });
}

export async function GET(request: Request) {
  const context = await getOptionalAppContext();
  if (!context) return response({ ok: false, message: "Nicht angemeldet." }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "dashboard";
  if (!allowedScopes.has(scope)) return response({ ok: false, message: "Unbekannter Prefetch-Bereich." }, { status: 400 });

  const supabase = await createSupabaseServerClient();

  try {
    const clientIp = getClientIp(request.headers);
    await checkRateLimit(`prefetch:${context.companyId}:${context.userId}:${clientIp}`, 60, 60_000);

    if (scope === "jobsites") {
      let query = supabase
        .from("jobsites")
        .select("id, name, customer, address, start_date, status, assigned_employee_ids, latitude, longitude")
        .eq("company_id", context.companyId)
        .in("status", ["geplant", "aktiv"])
        .order("start_date", { ascending: true, nullsFirst: false })
        .limit(16);
      if (!context.canManage) query = query.contains("assigned_employee_ids", [context.userId]);
      const { data } = await query;

      return response({ ok: true, scope, jobsites: data ?? [] });
    }

    if (scope === "materials") {
      const source = context.canManage ? "inventory_items" : "inventory_items_public";
      const { data } = await supabase
        .from(source)
        .select("id, name, unit, stock, minimum_stock, location_id")
        .eq("company_id", context.companyId)
        .order("name", { ascending: true })
        .limit(context.canManage ? 24 : 16);

      return response({ ok: true, scope, materials: data ?? [] });
    }

    if (scope === "team") {
      if (!context.canManage) return response({ ok: false, message: "Nicht erlaubt." }, { status: 403 });

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, active")
        .eq("company_id", context.companyId)
        .eq("active", true)
        .order("full_name", { ascending: true })
        .limit(40);

      return response({ ok: true, scope, team: data ?? [] });
    }

    if (scope === "tasks") {
      const todayIso = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from("tasks")
        .select("id, jobsite_id, title, status, due_date, assigned_to")
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .neq("status", "erledigt")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(context.canManage ? 30 : 16);
      if (!context.canManage) query = query.eq("assigned_to", context.userId);
      const { data } = await query;

      return response({ ok: true, scope, todayIso, tasks: data ?? [] });
    }

    if (scope === "planning") {
      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const end = new Date(today);
      end.setUTCDate(end.getUTCDate() + 7);
      const endIso = end.toISOString().slice(0, 10);

      let assignmentsQuery = supabase
        .from("planning_assignments")
        .select("id, resource_type, employee_id, vehicle_id, planning_resource_id, jobsite_id, title, status, start_date, end_date")
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .lte("start_date", endIso)
        .gte("end_date", todayIso)
        .order("start_date", { ascending: true })
        .limit(context.canManage ? 80 : 24);
      if (!context.canManage) assignmentsQuery = assignmentsQuery.eq("employee_id", context.userId);

      const [assignmentsResult, resourcesResult, vehiclesResult] = await Promise.all([
        assignmentsQuery,
        context.canManage
          ? supabase
              .from("planning_resources")
              .select("id, name, resource_kind, status, active")
              .eq("company_id", context.companyId)
              .eq("active", true)
              .is("archived_at", null)
              .order("name", { ascending: true })
              .limit(40)
          : Promise.resolve({ data: [] }),
        context.canManage
          ? supabase
              .from("vehicles")
              .select("id, name, license_plate")
              .eq("company_id", context.companyId)
              .is("archived_at", null)
              .order("name", { ascending: true })
              .limit(32)
          : Promise.resolve({ data: [] })
      ]);

      return response({
        ok: true,
        scope,
        period: { from: todayIso, to: endIso },
        assignments: assignmentsResult.data ?? [],
        resources: context.canManage ? resourcesResult.data ?? [] : [],
        vehicles: context.canManage ? vehiclesResult.data ?? [] : []
      });
    }

    if (scope === "time") {
      const todayIso = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from("time_entries")
        .select("id, employee_id, job_id, date, status, net_minutes")
        .eq("company_id", context.companyId)
        .gte("date", todayIso)
        .order("date", { ascending: true })
        .limit(context.canManage ? 24 : 8);
      if (!context.canManage) query = query.eq("employee_id", context.userId);
      const { data } = await query;

      return response({ ok: true, scope, timeEntries: data ?? [] });
    }

    if (scope === "bring-lists") {
      const todayIso = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from("bring_lists")
        .select("id, job_id, date, title, status, assigned_to")
        .eq("company_id", context.companyId)
        .gte("date", todayIso)
        .order("date", { ascending: true })
        .limit(16);
      if (!context.canManage) query = query.or(`assigned_to.eq.${context.userId},created_by.eq.${context.userId}`);
      const { data } = await query;

      return response({ ok: true, scope, bringLists: data ?? [] });
    }

    if (scope === "weather") {
      if (!context.canManage) return response({ ok: false, message: "Nicht erlaubt." }, { status: 403 });

      const todayIso = new Date().toISOString().slice(0, 10);
      const [jobsitesResult, ordersResult, timeResult, reportsResult] = await Promise.all([
        supabase
          .from("jobsites")
          .select("id, name, customer, address, start_date, status, assigned_employee_ids, latitude, longitude, weather_last_checked_at")
          .eq("company_id", context.companyId)
          .in("status", ["geplant", "aktiv"])
          .order("start_date", { ascending: true, nullsFirst: false })
          .limit(24),
        supabase
          .from("orders")
          .select("id, jobsite_id, status, priority, start_date, end_date")
          .eq("company_id", context.companyId)
          .in("status", ["geplant", "in_arbeit"])
          .limit(40),
        supabase.from("time_entries").select("id, job_id, date, status").eq("company_id", context.companyId).eq("date", todayIso).limit(40),
        supabase
          .from("reports")
          .select("id, jobsite_id, report_date")
          .eq("company_id", context.companyId)
          .is("archived_at", null)
          .eq("report_date", todayIso)
          .limit(40)
      ]);

      const decision = selectActiveWeatherJobsite({
        jobsites: jobsitesResult.data ?? [],
        orders: ordersResult.data ?? [],
        timeEntries: timeResult.data ?? [],
        reports: reportsResult.data ?? [],
        todayIso
      });
      const lat = decision.jobsite?.latitude;
      const lng = decision.jobsite?.longitude;
      const hasCoordinates = typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);

      return response({
        ok: true,
        scope,
        activeJobsite: decision.jobsite,
        score: decision.score,
        reasons: decision.reasons,
        weather: null,
        weatherDeferred: hasCoordinates,
        missingCoordinates: Boolean(decision.jobsite && !hasCoordinates)
      });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const [
      jobsitesResult,
      reportsResult,
      tasksResult,
      profilesResult,
      timeResult,
      materialResult
    ] = await Promise.all([
      (context.canManage
        ? supabase
            .from("jobsites")
            .select("id, name, customer, address, start_date, status, assigned_employee_ids, latitude, longitude")
            .eq("company_id", context.companyId)
        : supabase
            .from("jobsites")
            .select("id, name, customer, address, start_date, status, assigned_employee_ids, latitude, longitude")
            .eq("company_id", context.companyId)
            .contains("assigned_employee_ids", [context.userId]))
        .in("status", ["geplant", "aktiv"])
        .order("start_date", { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from("reports")
        .select("id, jobsite_id, report_date, created_at")
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .order("report_date", { ascending: false })
        .limit(6),
      (context.canManage
        ? supabase
            .from("tasks")
            .select("id, jobsite_id, title, status, due_date, assigned_to")
            .eq("company_id", context.companyId)
            .is("archived_at", null)
            .neq("status", "erledigt")
        : supabase
            .from("tasks")
            .select("id, jobsite_id, title, status, due_date, assigned_to")
            .eq("company_id", context.companyId)
            .eq("assigned_to", context.userId)
            .is("archived_at", null)
            .neq("status", "erledigt"))
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(8),
      context.canManage
        ? supabase
            .from("profiles")
            .select("id, full_name, email, role, active")
            .eq("company_id", context.companyId)
            .eq("active", true)
            .order("full_name", { ascending: true })
            .limit(40)
        : Promise.resolve({ data: [] }),
      (context.canManage
        ? supabase
            .from("time_entries")
            .select("id, employee_id, job_id, date, status, net_minutes")
            .eq("company_id", context.companyId)
        : supabase
            .from("time_entries")
            .select("id, employee_id, job_id, date, status, net_minutes")
            .eq("company_id", context.companyId)
            .eq("employee_id", context.userId))
        .eq("date", todayIso)
        .limit(context.canManage ? 40 : 12),
      context.canManage
        ? supabase
            .from("inventory_items")
            .select("id, name, unit, stock, minimum_stock, location_id")
            .eq("company_id", context.companyId)
            .order("name", { ascending: true })
            .limit(24)
        : supabase
            .from("inventory_items_public")
            .select("id, name, unit, stock, minimum_stock, location_id")
            .eq("company_id", context.companyId)
            .order("name", { ascending: true })
            .limit(16)
    ]);

    return response({
      ok: true,
      scope,
      summary: {
        jobsites: jobsitesResult.data?.length ?? 0,
        reports: reportsResult.data?.length ?? 0,
        tasks: tasksResult.data?.length ?? 0,
        profiles: profilesResult.data?.length ?? 0,
        timeEntries: timeResult.data?.length ?? 0,
        materials: materialResult.data?.length ?? 0
      },
      jobsites: jobsitesResult.data ?? [],
      reports: reportsResult.data ?? [],
      tasks: tasksResult.data ?? [],
      profiles: context.canManage ? profilesResult.data ?? [] : [],
      timeEntries: timeResult.data ?? [],
      materials: materialResult.data ?? []
    });
  } catch (error) {
    logServerWarning("prefetch-route-data-failed", error, {
      companyId: context.companyId,
      userId: context.userId,
      scope
    });
    return response(
      { ok: false, scope, message: safeErrorMessage(error, "Prefetch konnte nicht vorbereitet werden.") },
      { status: error instanceof SafeActionError ? 429 : 200 }
    );
  }
}
