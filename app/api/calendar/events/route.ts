import { NextResponse } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { calendarRangeAround, loadCalendarEvents } from "@/lib/data/calendar-events";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function json(payload: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...(init?.headers ?? {})
    }
  });
}

export async function GET(request: Request) {
  const context = await getOptionalAppContext();
  if (!context) return json({ ok: false, message: "Nicht angemeldet." }, { status: 401 });

  try {
    const clientIp = getClientIp(request.headers);
    await checkRateLimit(`calendar-events:${context.companyId}:${context.userId}:${clientIp}`, 90, 60_000);

    const url = new URL(request.url);
    const fallbackRange = calendarRangeAround();
    const from = url.searchParams.get("from") ?? fallbackRange.from;
    const to = url.searchParams.get("to") ?? fallbackRange.to;
    const supabase = await createSupabaseServerClient();
    const result = await loadCalendarEvents(supabase, context, from, to);

    return json({ ok: true, ...result });
  } catch (error) {
    return json(
      { ok: false, message: safeErrorMessage(error, "Kalenderdaten konnten nicht geladen werden.") },
      { status: error instanceof SafeActionError ? 400 : 500 }
    );
  }
}
