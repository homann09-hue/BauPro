import { NextResponse } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const context = await getOptionalAppContext();

  if (!context) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  if (!context.canManage) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

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
}
