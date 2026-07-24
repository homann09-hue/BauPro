import { getOptionalAppContext } from "@/lib/auth";
import { downloadHeaders } from "@/lib/security/downloads";
import { safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildTimeReportCsv, loadTimeReportExportData, timeReportFilename } from "@/lib/time-report-export";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });
  if (!context.canManage) return new Response("Keine Berechtigung", { status: 403 });

  try {
    await checkRateLimit(`time-report-csv:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 40, 60_000);
    const { id } = await params;
    const data = await loadTimeReportExportData(id, context.companyId);
    const csv = buildTimeReportCsv(data);
    return new Response(csv, {
      headers: downloadHeaders("text/csv; charset=utf-8", timeReportFilename(data, "csv"))
    });
  } catch (error) {
    return new Response(safeErrorMessage(error, "CSV konnte nicht erzeugt werden."), { status: safeErrorStatus(error) });
  }
}
