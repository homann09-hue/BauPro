import { requirePlatformAdmin } from "@/lib/auth";
import { buildCompanyDataExport, jsonDownloadResponse } from "@/lib/privacy/export";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const context = await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();
  const payload = await buildCompanyDataExport({
    supabase,
    companyId: context.companyId,
    actorId: context.userId,
    companyName: context.companyName
  });

  return jsonDownloadResponse(payload, `firmendaten_export_${context.companyId}.json`);
}
