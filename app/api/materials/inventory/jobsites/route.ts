import { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const context = await getOptionalAppContext();

  if (!context) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  await checkRateLimit(`materials-jobsites:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 80, 60_000);

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("jobsites")
    .select("id, name, customer")
    .eq("company_id", context.companyId)
    .in("status", ["geplant", "aktiv"])
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(80);

  if (!context.canManage) {
    query = query.contains("assigned_employee_ids", [context.userId]);
  }

  const result = await query;
  const queryError = safeQueryErrorMessage(result.error);

  if (queryError) {
    return NextResponse.json({ error: queryError }, { status: 500 });
  }

  return NextResponse.json(
    {
      jobsites: result.data ?? []
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60"
      }
    }
  );
}
