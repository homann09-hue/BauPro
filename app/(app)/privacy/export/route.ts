import { requireAppContext } from "@/lib/auth";
import { buildOwnDataExport, jsonDownloadResponse } from "@/lib/privacy/export";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const payload = await buildOwnDataExport({
    supabase,
    companyId: context.companyId,
    userId: context.userId,
    companyName: context.companyName
  });

  return jsonDownloadResponse(payload, `datenauskunft_${context.userId}.json`);
}
