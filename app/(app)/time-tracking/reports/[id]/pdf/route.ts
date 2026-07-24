import { getOptionalAppContext } from "@/lib/auth";
import { downloadHeaders } from "@/lib/security/downloads";
import { safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logServerError } from "@/lib/security/logging";
import { buildTimeReportPdf, loadTimeReportExportData, timeReportFilename } from "@/lib/time-report-export";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });
  if (!context.canManage) return new Response("Keine Berechtigung", { status: 403 });

  try {
    await checkRateLimit(`time-report-pdf:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 40, 60_000);

    const { id } = await params;
    const data = await loadTimeReportExportData(id, context.companyId);
    const pdf = buildTimeReportPdf(data);
    return new Response(new Uint8Array(pdf), {
      headers: downloadHeaders("application/pdf", timeReportFilename(data, "pdf"))
    });
  } catch (error) {
    logServerError("time-report-pdf-export-failed", error);
    return new Response(safeErrorMessage(error, "PDF konnte nicht erzeugt werden."), { status: safeErrorStatus(error) });
  }
}
