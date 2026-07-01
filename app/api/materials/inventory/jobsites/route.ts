import { NextResponse } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const context = await getOptionalAppContext();

  if (!context) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

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
