import { checkRateLimit } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { materialMovementSelect, materialUsageReportSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MaterialMovement, MaterialUsageReport } from "@/types/app";

export async function GET(request: Request) {
  const context = await getOptionalAppContext();

  if (!context) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  await checkRateLimit(`materials-activity:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 80, 60_000);

  const supabase = await createSupabaseServerClient();

  const [usageReportsResult, movementsResult] = await Promise.all([
    supabase
      .from("material_usage_reports")
      .select(materialUsageReportSelect)
      .eq("company_id", context.companyId)
      .eq("status", "reported")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("material_movements")
      .select(materialMovementSelect)
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

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
}
