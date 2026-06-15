"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAppContext } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, requiredString } from "@/lib/utils";

const requestTypes = new Set(["access", "rectification", "erasure", "restriction", "portability", "objection", "contract_end_export"]);

function toQuery(value: string) {
  return encodeURIComponent(value);
}

export async function createPrivacyRequestAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const rawType = requiredString(formData, "request_type");
  const requestType = requestTypes.has(rawType) ? rawType : "access";
  const description = optionalString(formData, "description");
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const { error } = await supabase.from("privacy_requests").insert({
    company_id: context.companyId,
    requester_id: context.userId,
    request_type: requestType,
    status: "open",
    description,
    due_at: dueAt.toISOString()
  });

  if (error) {
    if (isMissingSchemaError(error)) {
      redirect(
        `/privacy?error=${toQuery(
          "Datenschutzanfrage konnte noch nicht gespeichert werden, weil die Datenschutz-Migration fehlt. Bitte organisatorisch erfassen."
        )}`
      );
    }
    redirect(`/privacy?error=${toQuery("Datenschutzanfrage konnte nicht gespeichert werden.")}`);
  }

  revalidatePath("/privacy");
  redirect(`/privacy?success=${toQuery("Datenschutzanfrage wurde gespeichert.")}`);
}
