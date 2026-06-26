"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAppContext } from "@/lib/auth";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { searchOrFilter } from "@/lib/data/shared";
import { createOrUpdateMaterialAlert } from "@/lib/inventory/alerts";
import { generatePurchaseSuggestions } from "@/lib/inventory/purchase-suggestions";
import { safeReturnPath } from "@/lib/security/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalNumber, optionalString, requiredString } from "@/lib/utils";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function returnTo(formData: FormData) {
  return safeReturnPath(formData.get("return_to"), "/material-melden");
}

export async function reportMaterialNeedAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const target = returnTo(formData);
  const materialName = requiredString(formData, "material_name");
  const quantity = optionalNumber(formData, "quantity") ?? 1;
  const unit = optionalString(formData, "unit") ?? "Stueck";
  const jobId = optionalString(formData, "job_id");
  const note = optionalString(formData, "note");

  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("id, name, unit")
    .eq("company_id", context.companyId)
    .or(searchOrFilter(["name"], materialName))
    .order("stock", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inventoryItem = inventory as { id: string; name: string; unit: string } | null;
  const finalUnit = inventoryItem?.unit ?? unit;
  const displayName = inventoryItem?.name ?? materialName;

  const alertId = await createOrUpdateMaterialAlert({
    supabase,
    companyId: context.companyId,
    inventoryItemId: inventoryItem?.id ?? null,
    jobId,
    alertType: "missing_for_job",
    severity: "critical",
    message: `${displayName} fehlt oder wird benoetigt.${note ? ` Hinweis: ${note}` : ""}`,
    requiredQuantity: quantity,
    availableQuantity: 0,
    missingQuantity: quantity,
    unit: finalUnit,
    createdBySystem: false
  });

  await generatePurchaseSuggestions({
    supabase,
    companyId: context.companyId,
    inventoryItemId: inventoryItem?.id ?? null,
    jobId,
    quantityNeeded: quantity,
    unit: finalUnit,
    reason: `Materialmeldung: ${displayName}${note ? ` (${note})` : ""}`
  });

  if (!alertId) {
    redirect(`${target}?error=${toQuery("Materialmeldung konnte nicht gespeichert werden.")}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/material-melden");
  revalidateDashboardCache(context.companyId);
  redirect(`${target}?success=${toQuery("Materialmeldung wurde an Chef gesendet.")}`);
}
