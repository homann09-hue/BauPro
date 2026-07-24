import { getOptionalAppContext } from "@/lib/auth";
import { buildDatevCsv, datevCsvFilename, type CommercialDocumentExportData } from "@/lib/commercial-document-export";
import { loadCommercialDocumentDetail } from "@/lib/data/commercial-documents";
import { downloadHeaders } from "@/lib/security/downloads";
import { safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Company } from "@/types/app";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context || !context.canManage) return new Response("Keine Berechtigung", { status: 403 });

  try {
    await checkRateLimit(`commercial-document-datev:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 40, 60_000);

    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const [{ data: companyData }, detail] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, address, contact_email, phone, tax_id")
        .eq("id", context.companyId)
        .single(),
      loadCommercialDocumentDetail({ supabase, companyId: context.companyId, id })
    ]);

    if (!detail.document) return new Response("Dokument wurde nicht gefunden.", { status: 404 });

    const data: CommercialDocumentExportData = {
      company: (companyData as Pick<Company, "id" | "name" | "address" | "contact_email" | "phone" | "tax_id"> | null) ?? {
        id: context.companyId,
        name: context.companyName,
        address: null,
        contact_email: null,
        phone: null,
        tax_id: null
      },
      document: detail.document,
      items: detail.items,
      generatedAt: new Date().toISOString()
    };

    return new Response(new Uint8Array(buildDatevCsv(data)), {
      headers: downloadHeaders("text/csv; charset=utf-8", datevCsvFilename(data))
    });
  } catch (error) {
    return new Response(safeErrorMessage(error, "DATEV-Export konnte nicht erzeugt werden."), { status: safeErrorStatus(error) });
  }
}
