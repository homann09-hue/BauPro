import { getOptionalAppContext } from "@/lib/auth";
import { downloadHeaders } from "@/lib/security/downloads";
import { buildTimeReportPdf, loadTimeReportExportData, timeReportFilename } from "@/lib/time-report-export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });
  if (!context.canManage) return new Response("Keine Berechtigung", { status: 403 });

  try {
    const { id } = await params;
    const data = await loadTimeReportExportData(id, context.companyId);
    const pdf = buildTimeReportPdf(data);
    return new Response(new Uint8Array(pdf), {
      headers: downloadHeaders("application/pdf", timeReportFilename(data, "pdf"))
    });
  } catch (error) {
    console.error("time-report-pdf-export-failed", error);
    return new Response("PDF konnte nicht erzeugt werden.", { status: 500 });
  }
}
