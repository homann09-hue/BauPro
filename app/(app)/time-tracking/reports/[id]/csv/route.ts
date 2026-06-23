import { getOptionalAppContext } from "@/lib/auth";
import { downloadHeaders } from "@/lib/security/downloads";
import { logServerError } from "@/lib/security/logging";
import { buildTimeReportCsv, loadTimeReportExportData, timeReportFilename } from "@/lib/time-report-export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });
  if (!context.canManage) return new Response("Keine Berechtigung", { status: 403 });

  try {
    const { id } = await params;
    const data = await loadTimeReportExportData(id, context.companyId);
    const csv = buildTimeReportCsv(data);
    return new Response(csv, {
      headers: downloadHeaders("text/csv; charset=utf-8", timeReportFilename(data, "csv"))
    });
  } catch (error) {
    logServerError("time-report-csv-export-failed", error);
    return new Response("CSV konnte nicht erzeugt werden.", { status: 500 });
  }
}
