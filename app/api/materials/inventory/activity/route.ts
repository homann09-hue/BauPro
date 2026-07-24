import { checkRateLimit } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { materialMovementSelect, materialUsageReportSelect } from "@/lib/data/selects";
import { safeErrorMessage, safeErrorStatus, safeQueryErrorMessage } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MaterialMovement, MaterialUsageReport } from "@/types/app";

export async function GET(request: Request) {
  try {
    const context = await getOptionalAppContext();

    if (!context) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    await checkRateLimit(`materials-activity:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 80, 60_000);

    const supabase = await createSupabaseServerClient();
    let accessibleJobsiteIds: string[] = [];

    if (!context.canManage) {
      const { data: assignedJobsites, error: assignedError } = await supabase
        .from("jobsites")
        .select("id")
        .eq("company_id", context.companyId)
        .contains("assigned_employee_ids", [context.userId])
        .limit(200);

      const assignedQueryError = safeQueryErrorMessage(assignedError);
      if (assignedQueryError) {
        return NextResponse.json({ error: assignedQueryError }, { status: 500 });
      }

      accessibleJobsiteIds = (assignedJobsites ?? []).map((row) => String(row.id));
    }

    let usageReportsQuery = supabase
      .from("material_usage_reports")
      .select(materialUsageReportSelect)
      .eq("company_id", context.companyId)
      .eq("status", "reported")
      .order("created_at", { ascending: false })
      .limit(12);

    let movementsQuery = supabase
      .from("material_movements")
      .select(materialMovementSelect)
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (!context.canManage) {
      const jobsiteFilter = accessibleJobsiteIds.length ? `,jobsite_id.in.(${accessibleJobsiteIds.join(",")})` : "";
      usageReportsQuery = usageReportsQuery.or(`reported_by.eq.${context.userId}${jobsiteFilter}`);
      movementsQuery = movementsQuery.or(`created_by.eq.${context.userId}${jobsiteFilter}`);
    }

    const [usageReportsResult, movementsResult] = await Promise.all([usageReportsQuery, movementsQuery]);

    const queryError = safeQueryErrorMessage(usageReportsResult.error) || safeQueryErrorMessage(movementsResult.error);

    if (queryError) {
      return NextResponse.json({ error: queryError }, { status: 500 });
    }

    return NextResponse.json(
      {
        usageReports: (usageReportsResult.data ?? []) as unknown as MaterialUsageReport[],
        movements: (movementsResult.data ?? []) as unknown as MaterialMovement[]
      },
      {
        headers: {
          "Cache-Control": "private, no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Materialaktivitaeten konnten nicht geladen werden.") },
      { status: safeErrorStatus(error) }
    );
  }
}
