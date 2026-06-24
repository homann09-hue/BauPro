"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { checkUserLimit } from "@/lib/billing/plans";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { checkPasswordBreach } from "@/lib/security/password-breach-check";
import { safeReturnPath } from "@/lib/security/redirects";
import { isMissingSchemaError, isUnsupportedVorarbeiterRoleError } from "@/lib/supabase/errors";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, requiredString } from "@/lib/utils";
import type { Role } from "@/types/app";

type ImportEmployee = {
  fullName: string;
  email: string;
  role: Exclude<Role, "admin" | "kunde">;
};

type ImportJobsite = {
  name: string;
  customer: string;
  address: string;
  startDate: string | null;
  status: "geplant" | "aktiv" | "abgeschlossen";
  notes: string | null;
};

function splitLine(line: string) {
  return line
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseRole(value?: string): ImportEmployee["role"] {
  const role = value?.toLowerCase().trim();
  if (role === "chef") return "chef";
  if (role === "vorarbeiter") return "vorarbeiter";
  return "mitarbeiter";
}

function parseStatus(value?: string): ImportJobsite["status"] {
  const status = value?.toLowerCase().trim();
  if (status === "aktiv") return "aktiv";
  if (status === "abgeschlossen") return "abgeschlossen";
  return "geplant";
}

function parseDate(value?: string) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function parseEmployees(raw: string) {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("name;") && !line.toLowerCase().startsWith("name,"));

  return rows.slice(0, 25).map((line, index): ImportEmployee => {
    const [fullName, email, role] = splitLine(line);
    if (!fullName || !email || !email.includes("@")) {
      throw new SafeActionError(`Zeile ${index + 1}: Bitte Name und gueltige E-Mail eintragen.`);
    }

    return {
      fullName,
      email: email.toLowerCase(),
      role: parseRole(role)
    };
  });
}

function parseJobsites(raw: string) {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("baustelle;") && !line.toLowerCase().startsWith("baustelle,"));

  return rows.slice(0, 50).map((line, index): ImportJobsite => {
    const [name, customer, address, startDate, status, notes] = splitLine(line);
    if (!name || !customer || !address) {
      throw new SafeActionError(`Zeile ${index + 1}: Bitte Baustelle, Kunde und Adresse eintragen.`);
    }

    return {
      name,
      customer,
      address,
      startDate: parseDate(startDate),
      status: parseStatus(status),
      notes: notes ?? null
    };
  });
}

function redirectBack(returnTo: FormDataEntryValue | null, params: { error?: string; success?: string }): never {
  const path = safeReturnPath(returnTo, "/onboarding");
  const key = params.error ? "error" : "success";
  const message = params.error ?? params.success ?? "";
  redirect(`${path}?${key}=${toQuery(message)}`);
}

export async function updateOnboardingCompanyAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = formData.get("return_to");
  const payload = {
    name: requiredString(formData, "name"),
    contact_email: optionalString(formData, "contact_email"),
    phone: optionalString(formData, "phone"),
    address: optionalString(formData, "address"),
    website: optionalString(formData, "website")
  };

  const { error } = await supabase.from("companies").update(payload).eq("id", context.companyId);

  if (error) {
    redirectBack(returnTo, {
      error: isMissingSchemaError(error)
        ? "Firmenprofil-Felder fehlen in Supabase. Bitte SaaS-Hardening-Migration ausfuehren."
        : "Firmendaten konnten nicht gespeichert werden."
    });
  }

  revalidatePath("/onboarding");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirectBack(returnTo, { success: "Firmendaten gespeichert." });
}

export async function importOnboardingEmployeesAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = formData.get("return_to");
  const startPassword = requiredString(formData, "start_password");
  const raw = requiredString(formData, "employees_csv");
  let admin: ReturnType<typeof createSupabaseAdminClient>;

  if (startPassword.length < 8) {
    redirectBack(returnTo, { error: "Startpasswort muss mindestens 8 Zeichen haben." });
  }

  if (await checkPasswordBreach(startPassword)) {
    redirectBack(returnTo, {
      error: "Dieses Passwort wurde in einem Datenleck gefunden. Bitte wähle ein anderes Passwort."
    });
  }

  try {
    admin = createSupabaseAdminClient();
  } catch {
    redirectBack(returnTo, { error: "SUPABASE_SERVICE_ROLE_KEY fehlt fuer Mitarbeiterimport." });
  }

  let employees: ImportEmployee[];
  try {
    employees = parseEmployees(raw);
  } catch (error) {
    redirectBack(returnTo, { error: safeErrorMessage(error, "Mitarbeiterimport konnte nicht gelesen werden.") });
  }

  let created = 0;
  let skipped = 0;
  let roleFallbacks = 0;

  for (const employee of employees) {
    try {
      await checkUserLimit(supabase, context.companyId);
    } catch (error) {
      redirectBack(returnTo, { error: safeErrorMessage(error, "Nutzerlimit erreicht.") });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: employee.email,
      password: startPassword,
      email_confirm: true,
      user_metadata: {
        company_id: context.companyId,
        full_name: employee.fullName,
        role: employee.role
      }
    });

    if (error || !data.user) {
      skipped += 1;
      continue;
    }

    let finalRole: ImportEmployee["role"] = employee.role;
    let profileResult = await admin.from("profiles").upsert({
      id: data.user.id,
      company_id: context.companyId,
      email: employee.email,
      full_name: employee.fullName,
      role: finalRole,
      active: true
    });

    if (profileResult.error && finalRole === "vorarbeiter" && isUnsupportedVorarbeiterRoleError(profileResult.error)) {
      finalRole = "mitarbeiter";
      roleFallbacks += 1;
      await admin.auth.admin.updateUserById(data.user.id, {
        user_metadata: {
          company_id: context.companyId,
          full_name: employee.fullName,
          role: finalRole
        }
      });
      profileResult = await admin.from("profiles").upsert({
        id: data.user.id,
        company_id: context.companyId,
        email: employee.email,
        full_name: employee.fullName,
        role: finalRole,
        active: true
      });
    }

    if (profileResult.error) {
      skipped += 1;
      continue;
    }

    created += 1;
  }

  revalidatePath("/onboarding");
  revalidatePath("/team");
  const fallbackText = roleFallbacks > 0 ? ` ${roleFallbacks} Vorarbeiter wurden vorlaeufig als Mitarbeiter angelegt.` : "";
  redirectBack(returnTo, { success: `${created} Mitarbeiter importiert. ${skipped} uebersprungen.${fallbackText}` });
}

export async function importOnboardingJobsitesAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = formData.get("return_to");
  const raw = requiredString(formData, "jobsites_csv");

  let jobsites: ImportJobsite[];
  try {
    jobsites = parseJobsites(raw);
  } catch (error) {
    redirectBack(returnTo, { error: safeErrorMessage(error, "Baustellenimport konnte nicht gelesen werden.") });
  }

  const { error } = await supabase.from("jobsites").insert(
    jobsites.map((jobsite) => ({
      company_id: context.companyId,
      name: jobsite.name,
      customer: jobsite.customer,
      address: jobsite.address,
      start_date: jobsite.startDate,
      status: jobsite.status,
      notes: jobsite.notes,
      assigned_employee_ids: [],
      created_by: context.userId
    }))
  );

  if (error) {
    redirectBack(returnTo, { error: "Baustellen konnten nicht importiert werden." });
  }

  revalidatePath("/onboarding");
  revalidatePath("/baustellen");
  revalidatePath("/dashboard");
  redirectBack(returnTo, { success: `${jobsites.length} Baustellen importiert.` });
}

export async function createOnboardingDemoDataAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = formData.get("return_to");

  const existing = await supabase
    .from("jobsites")
    .select("id")
    .eq("company_id", context.companyId)
    .eq("name", "Demo - Steildach Musterstraße")
    .maybeSingle();

  if (existing.data) {
    redirectBack(returnTo, { success: "Demo-Daten sind bereits vorhanden." });
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      company_id: context.companyId,
      customer_type: "privatkunde",
      first_name: "Thomas",
      last_name: "Muster",
      phone: "0151 000000",
      email: "kunde.demo@example.invalid",
      billing_address: "Musterstraße 12, 50667 Köln",
      jobsite_address: "Musterstraße 12, 50667 Köln",
      notes: "Demo-Kunde fuer die 5-Minuten-Einfuehrung.",
      created_by: context.userId
    })
    .select("id")
    .maybeSingle();

  if (customerError || !customer) {
    redirectBack(returnTo, { error: "Demo-Kunde konnte nicht angelegt werden." });
  }

  const { data: jobsite, error: jobsiteError } = await supabase
    .from("jobsites")
    .insert({
      company_id: context.companyId,
      name: "Demo - Steildach Musterstraße",
      customer: "Thomas Muster",
      address: "Musterstraße 12, 50667 Köln",
      start_date: new Date().toISOString().slice(0, 10),
      status: "aktiv",
      notes: "Demo-Baustelle: Unterspannbahn, Lattung und Dachziegel prüfen.",
      assigned_employee_ids: [],
      created_by: context.userId
    })
    .select("id")
    .maybeSingle();

  if (jobsiteError || !jobsite) {
    redirectBack(returnTo, { error: "Demo-Baustelle konnte nicht angelegt werden." });
  }

  const locationResult = await supabase
    .from("inventory_locations")
    .upsert(
      {
        company_id: context.companyId,
        name: "Hauptlager",
        location_type: "Hauptlager",
        notes: "Automatisch im Onboarding angelegt."
      },
      { onConflict: "company_id,name" }
    )
    .select("id")
    .maybeSingle();

  const locationId = locationResult.data?.id ?? null;
  await supabase.from("inventory_items").insert([
    {
      company_id: context.companyId,
      location_id: locationId,
      name: "Unterspannbahn 75 m²",
      unit: "Rolle",
      stock: 1,
      minimum_stock: 3,
      notes: "Demo: knappes Material",
      created_by: context.userId
    },
    {
      company_id: context.companyId,
      location_id: locationId,
      name: "Dachlatte 30/50",
      unit: "lfm",
      stock: 180,
      minimum_stock: 100,
      notes: "Demo-Bestand",
      created_by: context.userId
    },
    {
      company_id: context.companyId,
      location_id: locationId,
      name: "Spenglerschrauben Edelstahl",
      unit: "Packung",
      stock: 2,
      minimum_stock: 4,
      notes: "Demo: Einkaufsvorschlag",
      created_by: context.userId
    }
  ]);

  await supabase.from("tasks").insert([
    {
      company_id: context.companyId,
      jobsite_id: jobsite.id,
      title: "Demo: Ortgang prüfen",
      description: "Beim Rundgang besprechen und im Tagesbericht dokumentieren.",
      due_date: new Date().toISOString().slice(0, 10),
      status: "offen",
      created_by: context.userId
    },
    {
      company_id: context.companyId,
      jobsite_id: jobsite.id,
      title: "Demo: Material fuer morgen packen",
      description: "Unterspannbahn, Dachlatten und Schrauben in Mitbringliste aufnehmen.",
      due_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      status: "offen",
      created_by: context.userId
    }
  ]);

  await supabase.from("material_alerts").insert({
    company_id: context.companyId,
    job_id: jobsite.id,
    alert_type: "low_stock",
    severity: "warning",
    message: "Demo: Unterspannbahn unter Mindestbestand",
    required_quantity: 3,
    available_quantity: 1,
    missing_quantity: 2,
    unit: "Rolle",
    status: "open",
    created_by_system: true
  });

  await supabase.from("purchase_suggestions").insert({
    company_id: context.companyId,
    job_id: jobsite.id,
    quantity_needed: 2,
    unit: "Rolle",
    reason: "Demo: Unterspannbahn fuer Musterbaustelle nachbestellen",
    status: "open"
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/baustellen");
  revalidatePath("/materials/low-stock");
  redirectBack(returnTo, { success: "Demo-Daten angelegt: Baustelle, Kunde, Lager, Aufgaben und Materialwarnung." });
}

export async function completeOnboardingAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = formData.get("return_to");
  const { error } = await supabase
    .from("companies")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", context.companyId);

  if (error) {
    redirectBack(returnTo, { error: "Onboarding konnte nicht abgeschlossen werden." });
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  redirect("/dashboard?success=Startassistent+abgeschlossen.");
}
