import { loadCustomerPortalData } from "@/lib/customer-portal/tokens";
import { downloadHeaders } from "@/lib/security/downloads";
import { buildWorkOrderPdf, workOrderFilename } from "@/lib/work-order-export";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const portal = await loadCustomerPortalData(token);
  if (!portal) return new Response("Portal-Link ist abgelaufen oder ungültig.", { status: 404 });

  const workOrder = portal.workOrders.find((item) => item.id === id);
  if (!workOrder || workOrder.status !== "signed") {
    return new Response("PDF ist erst nach Unterschrift verfuegbar.", { status: 403 });
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
}
