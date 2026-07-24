import type { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { buildCompanyDataExport, jsonDownloadResponse } from "@/lib/privacy/export";
import { safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const context = await requirePlatformAdmin();

  try {
    await checkRateLimit(`privacy-export:company:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 2, 60_000);

    const supabase = await createSupabaseServerClient();
    const payload = await buildCompanyDataExport({
      supabase,
      companyId: context.companyId,
      actorId: context.userId,
      companyName: context.companyName
    });

    return jsonDownloadResponse(payload, `firmendaten_export_${context.companyId}.json`);
  } catch (error) {
    return new Response(safeErrorMessage(error, "Firmenexport konnte nicht erstellt werden."), {
      status: safeErrorStatus(error),
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
}
