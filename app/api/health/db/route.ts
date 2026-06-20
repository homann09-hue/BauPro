import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

type HealthStatus = "ok" | "degraded";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
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
