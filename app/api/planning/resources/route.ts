import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAppContext } from "@/lib/auth";
import { resourceKinds, resourceStatuses } from "@/lib/resources";
import { hasAppPermission } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/origin";
import { SafeActionError, safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanningResourceKind, PlanningResourceStatus } from "@/types/app";

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new SafeActionError(`${label} fehlt.`);
  return value.trim();
}

function enumValue<T extends readonly string[]>(value: unknown, values: T, fallback: T[number]) {
  return typeof value === "string" && values.includes(value) ? value : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOptionalAppContext();
    if (!context) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    if (!hasAppPermission(context.profile.role, context.permissions, "vehicles.manage")) {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    await checkRateLimit(`planning-resources:${context.companyId}:${context.userId}:${getClientIp(request.headers)}`, 30, 60_000);

    const payload = (await request.json()) as Record<string, unknown>;
    const name = requiredString(payload.name, "Name");
    const resourceKind = enumValue(payload.resourceKind, resourceKinds, "geraet") as PlanningResourceKind;
    const status = enumValue(payload.status, resourceStatuses, "verfuegbar") as PlanningResourceStatus;
    const notes = typeof payload.notes === "string" ? payload.notes.trim() || null : null;
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("planning_resources")
      .insert({
        company_id: context.companyId,
        name,
        resource_kind: resourceKind,
        status,
        notes,
        created_by: context.userId
      })
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Ressource konnte nicht angelegt werden. Ist die Plantafel-Migration eingespielt?");

    revalidatePath("/plantafel");
    revalidatePath("/fahrzeuge");
    return NextResponse.json({ success: "Ressource wurde angelegt.", id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Ressource konnte nicht angelegt werden.") },
      { status: safeErrorStatus(error) }
    );
  }
}
