import { loadCustomerPortalData } from "@/lib/customer-portal/tokens";
import { downloadHeaders } from "@/lib/security/downloads";
import { SafeActionError } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildWorkOrderPdf, workOrderFilename } from "@/lib/work-order-export";

function portalPdfUnavailableResponse() {
  return new Response("Portal-Datei ist nicht verfügbar. Bitte warte einen Moment und versuche es erneut.", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const clientIp = getClientIp(request.headers);

  try {
    await checkRateLimit(`portal-pdf:${clientIp}`, 30, 60_000);
  } catch (rateLimitError) {
    if (rateLimitError instanceof SafeActionError) return portalPdfUnavailableResponse();
    throw rateLimitError;
  }

  try {
    const portal = await loadCustomerPortalData(token);
    if (!portal) return portalPdfUnavailableResponse();

    const workOrder = portal.workOrders.find((item) => item.id === id);
    if (!workOrder || workOrder.status !== "signed") {
      return new Response("PDF ist erst nach Unterschrift verfügbar.", { status: 403 });
    }

    const pdfData = {
      company: portal.company,
      customer: portal.customer,
      jobsite: portal.jobsite,
      workOrder
    };
    const pdf = buildWorkOrderPdf(pdfData);

    return new Response(new Uint8Array(pdf), {
      headers: downloadHeaders("application/pdf", workOrderFilename(pdfData))
    });
  } catch {
    return portalPdfUnavailableResponse();
  }
}
