"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { optionalFormString, requiredFormUuid } from "@/lib/security/form-data";
import { safeReturnPath, withStatusMessage } from "@/lib/security/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { geocodeOpenMeteo, parseCoordinatePair } from "@/lib/weather/open-meteo";

function manualCoordinatesFromForm(formData: FormData) {
  const combined = optionalFormString(formData, "manual_coordinates");
  if (combined) {
    const parsed = parseCoordinatePair(combined);
    if (!parsed) throw new SafeActionError("Manuelle Koordinaten bitte als Breitengrad, Längengrad eintragen.");
    return parsed;
  }

  const latRaw = optionalFormString(formData, "manual_latitude");
  const lngRaw = optionalFormString(formData, "manual_longitude");
  if (!latRaw && !lngRaw) return null;
  if (!latRaw || !lngRaw) throw new SafeActionError("Bitte Breitengrad und Längengrad eintragen.");

  const parsed = parseCoordinatePair(`${latRaw},${lngRaw}`);
  if (!parsed) throw new SafeActionError("Manuelle Koordinaten liegen ausserhalb des gueltigen Bereichs.");
  return parsed;
}

export async function geocodeJobsiteWeatherLocationAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");
  const returnTo = safeReturnPath(formData.get("return_to"), "/dashboard");

  try {
    const { data: jobsite } = await supabase
      .from("jobsites")
      .select("id, name, address")
      .eq("id", jobsiteId)
      .eq("company_id", context.companyId)
      .maybeSingle();

    if (!jobsite) throw new SafeActionError("Baustelle wurde nicht gefunden.");

    const manualCoordinates = manualCoordinatesFromForm(formData);
    const location =
      manualCoordinates === null
        ? await geocodeOpenMeteo(String(jobsite.address ?? ""))
        : { ...manualCoordinates, label: "Manuell eingetragene Koordinaten" };

    if (!location) {
      throw new SafeActionError("Koordinaten konnten aus der Adresse nicht ermittelt werden. Bitte PLZ und Ort ergänzen oder Adresse leicht vereinfacht eintragen.");
    }

    const { error } = await supabase
      .from("jobsites")
      .update({
        latitude: location.lat,
        longitude: location.lng,
        weather_last_checked_at: new Date().toISOString()
      })
      .eq("id", jobsiteId)
      .eq("company_id", context.companyId);

    if (error) throw new SafeActionError("Koordinaten konnten nicht gespeichert werden. Ist die Wetter-Migration eingespielt?");

    revalidatePath("/dashboard");
    revalidatePath("/plantafel");
    redirect(withStatusMessage(returnTo, "success", "Koordinaten fuer Live-Wetter wurden gespeichert."));
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Koordinaten konnten nicht ermittelt werden."))}`);
  }
}
