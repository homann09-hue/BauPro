"use server";

import { revalidatePath } from "next/cache";
import { requireAppContext, requireManager } from "@/lib/auth";
import { loadCalendarEvents } from "@/lib/data/calendar-events";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { requiredFormString, requiredFormUuid } from "@/lib/security/form-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function requiredIsoDate(formData: FormData, key: string, label: string) {
  const value = requiredFormString(formData, key, label);
  if (!isoDatePattern.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    throw new SafeActionError(`Bitte ein gueltiges Datum fuer ${label} verwenden.`);
  }

  return value;
}

export async function updateOrderDateAction(formData: FormData) {
  const context = await requireManager();

  try {
    const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
    const newDate = requiredIsoDate(formData, "new_date", "neues Datum");
    const supabase = await createSupabaseServerClient();

    const { data: order, error: loadError } = await supabase
      .from("orders")
      .select("id, company_id")
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (loadError || !order) {
      throw new SafeActionError("Auftrag wurde nicht gefunden oder gehoert nicht zu deiner Firma.");
    }

    // BauPro nutzt aktuell start_date als geplantes Auftragsdatum.
    const { error } = await supabase
      .from("orders")
      .update({
        start_date: newDate,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .eq("company_id", context.companyId);

    if (error) throw new SafeActionError("Auftragsdatum konnte nicht gespeichert werden.");

    revalidatePath("/calendar");
    revalidatePath(`/orders/${orderId}`);

    return { ok: true, message: "Auftrag wurde im Kalender verschoben." };
  } catch (error) {
    return {
      ok: false,
      message: safeErrorMessage(error, "Auftrag konnte nicht verschoben werden.")
    };
  }
}

export async function getCalendarEventsAction(from: string, to: string) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  return loadCalendarEvents(supabase, context, from, to);
}
