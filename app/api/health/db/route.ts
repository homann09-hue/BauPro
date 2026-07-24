import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SafeActionError } from "@/lib/security/errors";
import { getClientIp } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

type HealthStatus = "ok" | "degraded";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();

  try {
    await checkRateLimit(`health-db:${getClientIp(request.headers)}`, 120, 60_000);
  } catch (error) {
    const isThrottled = error instanceof SafeActionError && error.message.toLowerCase().includes("zu viele anfragen");
    return NextResponse.json(
      {
        status: "degraded" satisfies HealthStatus,
        latencyMs: Math.round(performance.now() - startedAt),
        message: isThrottled ? "Health-Check wurde gedrosselt." : "Health-Check ist aktuell nicht verfügbar."
      },
      { status: isThrottled ? 429 : 503 }
    );
  }

  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    return NextResponse.json(
      {
        status: "degraded" satisfies HealthStatus,
        latencyMs: Math.round(performance.now() - startedAt)
      },
      { status: 503 }
    );
  }

  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { error } = await supabase.from("plans").select("id").limit(1);
  const latencyMs = Math.round(performance.now() - startedAt);
  const status: HealthStatus = !error && latencyMs <= 1000 ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      latencyMs
    },
    { status: status === "ok" ? 200 : 503 }
  );
}
