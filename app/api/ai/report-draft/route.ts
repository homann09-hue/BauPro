import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDailyReportDraftFromPayload } from "@/lib/actions/ai-actions";
import { getOptionalAppContext } from "@/lib/auth";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DailyReportAutomationContext } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

const reportDraftRequestSchema = z.object({
  input: z.string().trim().min(1).max(2000, "KI-Eingabe ist zu lang (max. 2000 Zeichen)."),
  aiProcessingOptIn: z.literal(true, {
    error: "Bitte KI-Verarbeitung aktiv bestätigen."
  }),
  context: z
    .object({
      jobsite_label: z.string().max(300).nullable().optional(),
      report_date: z.string().max(30).nullable().optional(),
      weather: z
        .object({
          summary: z.string().max(500).nullable().optional(),
          temperature_c: z.string().max(40).nullable().optional(),
          precipitation_mm: z.string().max(40).nullable().optional(),
          wind_kmh: z.string().max(40).nullable().optional(),
          source: z.string().max(120).nullable().optional()
        })
        .optional(),
      employees: z.array(z.string().max(180)).max(30).optional(),
      time_entries: z.array(z.string().max(500)).max(40).optional(),
      material_usage: z.string().max(3000).nullable().optional(),
      machine_usage: z.string().max(3000).nullable().optional(),
      vehicle_names: z.array(z.string().max(180)).max(20).optional(),
      existing_photo_names: z.array(z.string().max(220)).max(12).optional(),
      selected_photo_names: z.array(z.string().max(220)).max(12).optional(),
      photo_context_note: z.string().max(500).nullable().optional()
    })
    .optional(),
  existingPhotoIds: z.array(z.string().uuid()).max(4).optional()
});

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

async function signedReportPhotoUrls(photoIds: string[], companyId: string) {
  if (photoIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_photos")
    .select("id, storage_path")
    .eq("company_id", companyId)
    .is("archived_at", null)
    .in("id", photoIds);

  if (error || !data) {
    throw new SafeActionError("Foto-Kontext konnte nicht geladen werden.");
  }

  const urls = await Promise.all(
    data.slice(0, 4).map(async (photo) => {
      const { data: signed } = await supabase.storage.from("report-photos").createSignedUrl(photo.storage_path as string, 60 * 5);
      return signed?.signedUrl ?? null;
    })
  );

  return urls.filter((url): url is string => Boolean(url));
}

export async function POST(request: Request) {
  const context = await getOptionalAppContext();
  if (!context) return json({ ok: false, configured: false, message: "Nicht angemeldet." }, { status: 401 });

  try {
    const body = request.headers.get("content-type")?.includes("application/json")
      ? await request.json().catch(() => ({}))
      : {};
    const parsed = reportDraftRequestSchema.safeParse(body);
    if (!parsed.success) {
      return json({ ok: false, configured: true, message: parsed.error.issues[0]?.message ?? "KI-Eingabe konnte nicht gelesen werden." }, { status: 400 });
    }

    const imageUrls = await signedReportPhotoUrls(parsed.data.existingPhotoIds ?? [], context.companyId);
    const reportContext: DailyReportAutomationContext = {
      ...(parsed.data.context ?? {}),
      photo_context_note:
        imageUrls.length > 0
          ? `${imageUrls.length} bereits gespeicherte Berichtsfotos wurden als Bildkontext an OpenAI übergeben.`
          : (parsed.data.context?.photo_context_note ?? "Keine gespeicherten Fotos als Bildkontext übergeben.")
    };

    const result = await generateDailyReportDraftFromPayload({
      input: parsed.data.input,
      context: reportContext,
      imageUrls
    });

    return json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return json(
      {
        ok: false,
        configured: true,
        message: safeErrorMessage(error, "KI-Bautagesbericht konnte nicht erstellt werden.")
      },
      { status: error instanceof SafeActionError ? 400 : 500 }
    );
  }
}
