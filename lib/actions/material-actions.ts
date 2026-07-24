"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { requiredFormUuid } from "@/lib/security/form-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalNumber, optionalString, requiredString } from "@/lib/utils";
import { withQueryTimeout } from "@/lib/performance/observability";
import type { MaterialLocation } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function withActionTimeout<T>(action: string, fn: () => Promise<T>): Promise<T> {
  return withQueryTimeout(fn, {
    route: "/app/material",
    action,
    timeoutMs: 7_500,
    slowMs: 1_900
  });
}

function locationValue(value: FormDataEntryValue | null): MaterialLocation {
  const location = String(value ?? "Lager");
  return location === "Fahrzeug" || location === "Baustelle" ? location : "Lager";
}

export async function createMaterialAction(formData: FormData) {
  return withActionTimeout("createMaterialAction", async () => {
    const context = await requireManager();
    const supabase = await createSupabaseServerClient();

    try {
      const { data, error } = await supabase
        .from("materials")
        .insert({
          company_id: context.companyId,
          name: requiredString(formData, "name"),
          category: optionalString(formData, "category"),
          unit: requiredString(formData, "unit"),
          stock: numberOrZero(formData, "stock"),
          minimum_stock: numberOrZero(formData, "minimum_stock"),
          location: locationValue(formData.get("location")),
          purchase_price: optionalNumber(formData, "purchase_price"),
          sales_price: optionalNumber(formData, "sales_price"),
          created_by: context.userId
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        throw new SafeActionError("Material konnte nicht angelegt werden.");
      }
    } catch (error) {
      redirect(`/material/neu?error=${toQuery(safeErrorMessage(error, "Material konnte nicht angelegt werden."))}`);
    }

    revalidatePath("/material");
    redirect(`/material?success=${toQuery("Material wurde angelegt.")}`);
  });
}

export async function updateMaterialAction(formData: FormData) {
  return withActionTimeout("updateMaterialAction", async () => {
    const context = await requireManager();
    const supabase = await createSupabaseServerClient();
    let id = "";

    try {
      id = requiredFormUuid(formData, "id", "Material");
      const { data, error } = await supabase
        .from("materials")
        .update({
          name: requiredString(formData, "name"),
          category: optionalString(formData, "category"),
          unit: requiredString(formData, "unit"),
          stock: numberOrZero(formData, "stock"),
          minimum_stock: numberOrZero(formData, "minimum_stock"),
          location: locationValue(formData.get("location")),
          purchase_price: optionalNumber(formData, "purchase_price"),
          sales_price: optionalNumber(formData, "sales_price")
        })
        .eq("id", id)
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();

      if (error || !data) {
        throw new SafeActionError("Material konnte nicht aktualisiert werden.");
      }
    } catch (error) {
      const message = safeErrorMessage(error, "Material konnte nicht aktualisiert werden.");
      redirect(id ? `/material/${id}/bearbeiten?error=${toQuery(message)}` : `/material?error=${toQuery(message)}`);
    }

    revalidatePath("/material");
    redirect(`/material?success=${toQuery("Material wurde aktualisiert.")}`);
  });
}

export async function deleteMaterialAction(formData: FormData) {
  return withActionTimeout("deleteMaterialAction", async () => {
    const context = await requireManager();
    const supabase = await createSupabaseServerClient();
    const id = requiredFormUuid(formData, "id", "Material");

    const { data, error } = await supabase
      .from("materials")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      redirect(`/material?error=${toQuery("Material konnte nicht archiviert werden.")}`);
    }

    revalidatePath("/material");
    redirect(`/material?success=${toQuery("Material wurde archiviert.")}`);
  });
}
