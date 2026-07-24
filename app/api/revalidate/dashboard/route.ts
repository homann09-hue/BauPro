import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/origin";
import { dashboardTag } from "@/lib/data/dashboard";
import { safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";

export async function POST(request: NextRequest) {
  const context = await getOptionalAppContext();
  if (!context) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    await checkRateLimit(`dashboard-revalidate:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 60, 60_000);
    const body = (await request.json().catch(() => ({}))) as { companyId?: unknown };
    if (typeof body.companyId === "string" && body.companyId !== context.companyId) {
      return NextResponse.json({ error: "Keine Berechtigung für diese Firma." }, { status: 403 });
    }

    revalidateTag(dashboardTag(context.companyId), { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Dashboard-Cache konnte nicht aktualisiert werden.") },
      { status: safeErrorStatus(error) }
    );
  }
}
