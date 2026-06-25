import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireAppContext } from "@/lib/auth";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function decisionValue(value: unknown) {
  return value === "rejected" ? "rejected" : "confirmed";
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new SafeActionError(`${label} fehlt.`);
  return value.trim();
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAppContext();
    if (!context.canOperate) throw new SafeActionError("Keine Berechtigung für Materialbestätigungen.");

    const payload = (await request.json()) as Record<string, unknown>;
    const reportId = requiredString(payload.reportId, "Materialmeldung");
    const decision = decisionValue(payload.decision);
    const note = typeof payload.note === "string" ? payload.note.trim() || null : null;
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.rpc("confirm_material_usage_report", {
      p_company_id: context.companyId,
      p_report_id: reportId,
      p_actor_id: context.userId,
      p_decision: decision,
      p_note: note
    });

    if (error) {
      throw new SafeActionError(
        decision === "rejected"
          ? "Materialmeldung konnte nicht abgelehnt werden."
          : "Materialmeldung konnte nicht bestätigt werden. Prüfe Bestand und Berechtigung."
      );
    }

    revalidatePath("/materials");
    revalidatePath("/materials/inventory");
    revalidatePath("/materials/low-stock");
    revalidatePath("/dashboard");
    revalidateDashboardCache(context.companyId);

    return NextResponse.json({ success: "Materialmeldung wurde verarbeitet." });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Materialmeldung konnte nicht verarbeitet werden.") },
      { status: error instanceof SafeActionError ? 400 : 500 }
    );
  }
}
