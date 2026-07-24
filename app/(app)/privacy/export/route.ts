import type { NextRequest } from "next/server";
import { requireAppContext } from "@/lib/auth";
import { buildOwnDataExport, jsonDownloadResponse } from "@/lib/privacy/export";
import { safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const context = await requireAppContext();

  try {
    await checkRateLimit(`privacy-export:own:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 3, 60_000);

    const supabase = await createSupabaseServerClient();
    const payload = await buildOwnDataExport({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      companyName: context.companyName
    });

    return jsonDownloadResponse(payload, `datenauskunft_${context.userId}.json`);
  } catch (error) {
    return new Response(safeErrorMessage(error, "Datenauskunft konnte nicht erstellt werden."), {
      status: safeErrorStatus(error),
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
}
