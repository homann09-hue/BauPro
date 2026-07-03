import { NextResponse } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { safeErrorMessage, safeErrorStatus, safeQueryErrorMessage } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const context = await getOptionalAppContext();

    if (!context) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    if (!context.canManage) {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    await checkRateLimit(`materials-suppliers:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 60, 60_000);

    const supabase = await createSupabaseServerClient();
    const result = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("company_id", context.companyId)
      .eq("active", true)
      .order("name")
      .limit(120);

    const queryError = safeQueryErrorMessage(result.error);

    if (queryError) {
      return NextResponse.json({ error: queryError }, { status: 500 });
    }

    return NextResponse.json(
      {
        suppliers: result.data ?? []
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Lieferanten konnten nicht geladen werden.") },
      { status: safeErrorStatus(error) }
    );
  }
}
