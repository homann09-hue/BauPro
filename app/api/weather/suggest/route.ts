import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAppContext } from "@/lib/auth";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emptyWeatherSuggestion, fetchOpenMeteoWeather, geocodeOpenMeteo } from "@/lib/weather/open-meteo";

const requestSchema = z.object({
  jobId: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  preferBrowserLocation: z.boolean().optional().nullable(),
  manualLocation: z.string().max(300).optional().nullable()
});

type LocationCandidate = {
  lat: number;
  lng: number;
  label: string | null;
};

function json(payload: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...(init?.headers ?? {})
    }
  });
}

async function geocodeCandidate(query?: string | null) {
  if (!query) return null;
  return geocodeOpenMeteo(query);
}

export async function POST(request: Request) {
  const context = await getOptionalAppContext();
  if (!context) return json({ ok: false, message: "Nicht angemeldet." }, { status: 401 });

  try {
    await checkRateLimit(`weather:${context.companyId}:${context.userId}`, 40, 60_000);

    const body = request.headers.get("content-type")?.includes("application/json")
      ? await request.json().catch(() => ({}))
      : {};
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return json({ ok: false, message: "Wetterdaten konnten nicht gelesen werden." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
    const candidates: Array<Promise<LocationCandidate | null>> = [];

    if (parsed.data.jobId) {
      const { data: jobsite } = await supabase
        .from("jobsites")
        .select("id, name, address, assigned_employee_ids, latitude, longitude")
        .eq("id", parsed.data.jobId)
        .eq("company_id", context.companyId)
        .maybeSingle();

      if (!jobsite) {
        throw new SafeActionError("Baustelle wurde nicht gefunden.");
      }

      const assignedIds = (jobsite.assigned_employee_ids ?? []) as string[];
      if (!context.canManage && !assignedIds.includes(context.userId)) {
        throw new SafeActionError("Keine Berechtigung für diese Baustelle.");
      }

      const latitude = typeof jobsite.latitude === "number" ? jobsite.latitude : null;
      const longitude = typeof jobsite.longitude === "number" ? jobsite.longitude : null;
      if (latitude !== null && Number.isFinite(latitude) && longitude !== null && Number.isFinite(longitude)) {
        candidates.push(Promise.resolve({ lat: latitude, lng: longitude, label: (jobsite.address as string) || (jobsite.name as string) || null }));
      } else {
        candidates.push(
          geocodeCandidate(String(jobsite.address ?? "")).then((location) =>
            location ? { ...location, label: location.label || (jobsite.address as string) || (jobsite.name as string) } : null
          )
        );
      }
    }

    const browserCandidate =
      typeof parsed.data.lat === "number" && typeof parsed.data.lng === "number"
        ? Promise.resolve({ lat: parsed.data.lat, lng: parsed.data.lng, label: "Browser-Standort" })
        : null;

    if (browserCandidate && parsed.data.preferBrowserLocation) {
      candidates.push(browserCandidate);
    }

    const { data: company } = await supabase.from("companies").select("address, name").eq("id", context.companyId).maybeSingle();

    candidates.push(
      geocodeCandidate((company as { address?: string | null; name?: string | null } | null)?.address).then((location) =>
        location ? { ...location, label: location.label || (company as { address?: string | null } | null)?.address || null } : null
      )
    );

    if (browserCandidate && !parsed.data.preferBrowserLocation) {
      candidates.push(browserCandidate);
    }

    candidates.push(
      geocodeCandidate(parsed.data.manualLocation).then((location) =>
        location ? { ...location, label: location.label || parsed.data.manualLocation || null } : null
      )
    );

    const resolved = (await Promise.all(candidates)).find(Boolean);
    if (!resolved) {
      return json({
        ok: false,
        message: emptyWeatherSuggestion("Kein Standort für automatische Wetterdaten gefunden.").reason
      });
    }

    const weather = await fetchOpenMeteoWeather({
      lat: resolved.lat,
      lng: resolved.lng,
      date,
      locationLabel: resolved.label
    });

    if (!weather) {
      return json({ ok: false, message: "Keine lokalen Wetterdaten gefunden. Manuelle Eingabe bleibt möglich." });
    }

    return json({ ok: true, weather });
  } catch (error) {
    return json(
      { ok: false, message: safeErrorMessage(error, "Wetter konnte nicht automatisch ermittelt werden.") },
      { status: error instanceof SafeActionError ? 400 : 500 }
    );
  }
}
