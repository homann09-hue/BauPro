import "server-only";
import { DEMO_CHEF_EMAIL, DEMO_COMPANY_NAME, DEMO_CUSTOMER_PORTAL_TOKEN, DEMO_DEFAULT_PASSWORD, DEMO_EMAIL_DOMAIN } from "@/lib/demo/constants";
import { contentHash, hashCustomerPortalToken } from "@/lib/customer-portal/tokens";
import { SafeActionError } from "@/lib/security/errors";
import { logServerError } from "@/lib/security/logging";
import { isMissingSchemaError, isUnsupportedVorarbeiterRoleError } from "@/lib/supabase/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/types/app";

type DemoRole = Extract<Role, "chef" | "vorarbeiter" | "mitarbeiter">;
type DemoUserSeed = {
  key: string;
  email: string;
  fullName: string;
  role: DemoRole;
};
type DemoUser = DemoUserSeed & { id: string; role: DemoRole };
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type DemoRow = Record<string, unknown> & { id: string };
type EnsureDemoModeOptions = {
  forceUserSync?: boolean;
};

const demoUsers: DemoUserSeed[] = [
  { key: "chef", email: DEMO_CHEF_EMAIL, fullName: "Sabine Müller", role: "chef" },
  { key: "v1", email: `niklas@${DEMO_EMAIL_DOMAIN}`, fullName: "Niklas Berger", role: "vorarbeiter" },
  { key: "v2", email: `tobias@${DEMO_EMAIL_DOMAIN}`, fullName: "Tobias Klein", role: "vorarbeiter" },
  { key: "m1", email: `max@${DEMO_EMAIL_DOMAIN}`, fullName: "Max Schneider", role: "mitarbeiter" },
  { key: "m2", email: `lena@${DEMO_EMAIL_DOMAIN}`, fullName: "Lena Fischer", role: "mitarbeiter" },
  { key: "m3", email: `emre@${DEMO_EMAIL_DOMAIN}`, fullName: "Emre Yilmaz", role: "mitarbeiter" },
  { key: "m4", email: `sophie@${DEMO_EMAIL_DOMAIN}`, fullName: "Sophie Weber", role: "mitarbeiter" },
  { key: "m5", email: `jan@${DEMO_EMAIL_DOMAIN}`, fullName: "Jan Hoffmann", role: "mitarbeiter" }
];

function todayOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function minutes(start: string, end: string, pause: number) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const gross = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return { gross_minutes: gross, net_minutes: Math.max(0, gross - pause) };
}

function demoModeEnabled() {
  return (
    process.env.DEMO_MODE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

function demoPassword() {
  const password = process.env.DEMO_USER_PASSWORD || (process.env.NODE_ENV !== "production" ? DEMO_DEFAULT_PASSWORD : "");
  if (!password) {
    throw new SafeActionError("Demo-Passwort fehlt. Bitte DEMO_USER_PASSWORD serverseitig setzen.");
  }

  return password;
}

function shouldReseedDemoDataOnStart() {
  return process.env.DEMO_RESEED_ON_START === "true";
}

function hasRows(result: { data: unknown[] | null; error: unknown }) {
  if (result.error) {
    if (isMissingSchemaError(result.error)) return false;
    throw new Error("demo_ready_lookup_failed");
  }

  return (result.data ?? []).length > 0;
}

async function hasPreparedDemoData(admin: AdminClient, companyId: string) {
  const [chefProfile, jobsite, order, inventoryItem] = await Promise.all([
    admin
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", DEMO_CHEF_EMAIL)
      .eq("active", true)
      .limit(1),
    admin
      .from("jobsites")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", "Demo: Steildach Schmidt")
      .limit(1),
    admin
      .from("orders")
      .select("id")
      .eq("company_id", companyId)
      .eq("order_number", `DEMO-${new Date().getFullYear()}-0001`)
      .limit(1),
    admin
      .from("inventory_items")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", "Konterlatte 40/60 impr.")
      .limit(1)
  ]);

  return [chefProfile, jobsite, order, inventoryItem].every(hasRows);
}

async function listAllUsers(admin: AdminClient) {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("demo_auth_users_failed");
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < 1000) break;
  }

  return users;
}

async function ensureDemoCompany(admin: AdminClient) {
  const { data: existing, error: lookupError } = await admin
    .from("companies")
    .select("id, name")
    .eq("name", DEMO_COMPANY_NAME)
    .maybeSingle();

  if (lookupError) throw new Error("demo_company_lookup_failed");
  if (existing) return existing as { id: string; name: string };

  const { data, error } = await admin
    .from("companies")
    .insert({
      name: DEMO_COMPANY_NAME,
      plan_id: "business",
      subscription_status: "trialing",
      onboarding_completed_at: new Date().toISOString()
    })
    .select("id, name")
    .single();

  if (error || !data) throw new Error("demo_company_insert_failed");
  return data as { id: string; name: string };
}

async function markDemoCompanyReady(admin: AdminClient, companyId: string, chefId: string) {
  const fullUpdate = await admin
    .from("companies")
    .update({
      plan_id: "business",
      subscription_status: "trialing",
      contact_email: "demo@mueller-dachtechnik.example.invalid",
      phone: "0221 555000",
      address: "Werkstrasse 8, 50667 Koeln",
      website: "https://mueller-dachtechnik.example.invalid",
      onboarding_completed_at: new Date().toISOString(),
      created_by: chefId
    })
    .eq("id", companyId);

  if (!fullUpdate.error) return;
  if (!isMissingSchemaError(fullUpdate.error)) throw new Error("demo_company_update_failed");

  const billingFallback = await admin
    .from("companies")
    .update({
      plan_id: "business",
      subscription_status: "trialing",
      onboarding_completed_at: new Date().toISOString()
    })
    .eq("id", companyId);

  if (!billingFallback.error) return;
  if (!isMissingSchemaError(billingFallback.error)) throw new Error("demo_company_update_failed");

  const minimalFallback = await admin
    .from("companies")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", companyId);

  if (minimalFallback.error) throw new Error("demo_company_update_failed");
}

async function ensureDemoUser(admin: AdminClient, seed: DemoUserSeed, companyId: string, password: string, existingUsers: Awaited<ReturnType<typeof listAllUsers>>) {
  const existing = existingUsers.find((user) => user.email?.toLowerCase() === seed.email.toLowerCase());
  let finalRole = seed.role;
  const metadata = (role: DemoRole) => ({
    company_id: companyId,
    full_name: seed.fullName,
    role,
    demo_mode: true,
    demo_key: seed.key
  });
  const authPayload = {
    password,
    email_confirm: true,
    user_metadata: metadata(finalRole)
  };
  let authResult = existing
    ? await admin.auth.admin.updateUserById(existing.id, authPayload)
    : await admin.auth.admin.createUser({ email: seed.email, ...authPayload });

  if (authResult.error && seed.role === "vorarbeiter") {
    finalRole = "mitarbeiter";
    authResult = existing
      ? await admin.auth.admin.updateUserById(existing.id, { ...authPayload, user_metadata: metadata(finalRole) })
      : await admin.auth.admin.createUser({ email: seed.email, ...authPayload, user_metadata: metadata(finalRole) });
  }

  if (authResult.error || !authResult.data.user) throw new Error("demo_user_auth_failed");

  const user = authResult.data.user;
  let profileResult = await admin.from("profiles").upsert(
    {
      id: user.id,
      company_id: companyId,
      email: seed.email,
      full_name: seed.fullName,
      role: finalRole,
      active: true
    },
    { onConflict: "id" }
  );

  if (profileResult.error && finalRole === "vorarbeiter" && isUnsupportedVorarbeiterRoleError(profileResult.error)) {
    finalRole = "mitarbeiter";
    await admin.auth.admin.updateUserById(user.id, { user_metadata: metadata(finalRole) });
    profileResult = await admin.from("profiles").upsert(
      {
        id: user.id,
        company_id: companyId,
        email: seed.email,
        full_name: seed.fullName,
        role: finalRole,
        active: true
      },
      { onConflict: "id" }
    );
  }

  if (profileResult.error) throw new Error("demo_profile_upsert_failed");
  return { ...seed, id: user.id, role: finalRole };
}

async function insertRows(admin: AdminClient, table: string, rows: Array<Record<string, unknown>>, select = "*"): Promise<DemoRow[]> {
  if (!rows.length) return [];
  const { data, error } = await admin.from(table).insert(rows as never).select(select);
  if (error) {
    if (isMissingSchemaError(error)) {
      throw new SafeActionError("Datenbank-Update fehlt. Bitte die aktuellen Supabase-Migrationen ausfuehren.");
    }
    logServerError("demo-seed-insert-failed", error, { table });
    throw new Error(`demo_insert_${table}_failed`);
  }

  return (data ?? []) as unknown as DemoRow[];
}

async function insertOptionalRows(admin: AdminClient, table: string, rows: Array<Record<string, unknown>>, select = "*"): Promise<DemoRow[]> {
  if (!rows.length) return [];
  const { data, error } = await admin.from(table).insert(rows as never).select(select);
  if (error) {
    if (isMissingSchemaError(error)) return [];
    logServerError("demo-seed-optional-insert-failed", error, { table });
    throw new Error(`demo_insert_${table}_failed`);
  }

  return (data ?? []) as unknown as DemoRow[];
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return fallback;
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function buildCalculationItem({
  companyId,
  calculationId,
  jobsiteId,
  inventoryItem,
  materialName,
  unit,
  baseQuantity,
  wastePercent = 20,
  locationName,
  source = "rule",
  aiReason,
  createdBy
}: {
  companyId: string;
  calculationId: string;
  jobsiteId: string;
  inventoryItem?: DemoRow;
  materialName: string;
  unit: string;
  baseQuantity: number;
  wastePercent?: number;
  locationName?: string;
  source?: "rule" | "ai" | "manual";
  aiReason?: string;
  createdBy: string;
}) {
  const wasteQuantity = rounded((baseQuantity * wastePercent) / 100);
  const totalQuantity = rounded(baseQuantity + wasteQuantity);
  const purchasePrice = numberValue(inventoryItem?.purchase_price);
  const salesPrice = numberValue(inventoryItem?.sales_price);
  const stock = numberValue(inventoryItem?.stock);
  const minimumStock = numberValue(inventoryItem?.minimum_stock);
  const purchaseTotal = purchasePrice > 0 ? rounded(totalQuantity * purchasePrice) : null;
  const salesTotal = salesPrice > 0 ? rounded(totalQuantity * salesPrice) : null;
  const marginTotal = purchaseTotal !== null && salesTotal !== null ? rounded(salesTotal - purchaseTotal) : null;

  return {
    company_id: companyId,
    calculation_id: calculationId,
    jobsite_id: jobsiteId,
    inventory_item_id: inventoryItem?.id ?? null,
    material_name: materialName,
    unit,
    base_quantity: baseQuantity,
    waste_percent: wastePercent,
    waste_quantity: wasteQuantity,
    total_quantity: totalQuantity,
    purchase_price: purchasePrice || null,
    sales_price: salesPrice || null,
    purchase_total: purchaseTotal,
    sales_total: salesTotal,
    margin_total: marginTotal,
    location_name: locationName ?? null,
    stock,
    minimum_stock: minimumStock,
    missing_quantity: rounded(Math.max(totalQuantity - stock, 0)),
    source,
    ai_reason: aiReason ?? null,
    created_by: createdBy
  };
}

async function selectIdsByCompany(admin: AdminClient, table: string, companyId: string) {
  const { data, error } = await admin.from(table).select("id").eq("company_id", companyId);
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw new Error(`demo_cleanup_select_${table}_failed`);
  }

  return (data ?? []).map((row) => String((row as { id: string }).id));
}

async function deleteByCompany(admin: AdminClient, table: string, companyId: string) {
  const { error } = await admin.from(table).delete().eq("company_id", companyId);
  if (error) {
    if (isMissingSchemaError(error)) return;
    throw new Error(`demo_cleanup_${table}_failed`);
  }
}

async function deleteWhereIn(admin: AdminClient, table: string, column: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await admin.from(table).delete().in(column, ids);
  if (error) {
    if (isMissingSchemaError(error)) return;
    throw new Error(`demo_cleanup_${table}_failed`);
  }
}

async function cleanupDemoData(admin: AdminClient, companyId: string) {
  const bringListIds = await selectIdsByCompany(admin, "bring_lists", companyId);
  await deleteWhereIn(admin, "bring_list_items", "bring_list_id", bringListIds);

  const timeReportIds = await selectIdsByCompany(admin, "time_reports", companyId);
  await deleteWhereIn(admin, "time_report_entries", "time_report_id", timeReportIds);

  const estimateIds = await selectIdsByCompany(admin, "job_estimates", companyId);
  await deleteWhereIn(admin, "job_estimate_items", "estimate_id", estimateIds);

  const tables = [
    "work_order_versions",
    "digital_document_versions",
    "work_orders",
    "customer_portal_messages",
    "customer_portal_events",
    "customer_documents",
    "customer_portal_tokens",
    "job_estimates",
    "ai_job_drafts",
    "ai_actions",
    "ai_usage_logs",
    "time_entry_audit_log",
    "time_reports",
    "time_entries",
    "report_photos",
    "reports",
    "material_alerts",
    "purchase_suggestions",
    "material_usage_reports",
    "material_movements",
    "material_reservations",
    "bring_lists",
    "tasks",
    "job_material_requirements",
    "job_material_calculation_items",
    "job_material_calculations",
    "order_measurement_items",
    "job_dimensions",
    "planning_weather_checks",
    "planning_assignments",
    "resource_documents",
    "planning_resources",
    "orders",
    "vehicle_materials",
    "vehicles",
    "inventory_items",
    "suppliers",
    "inventory_locations",
    "materials",
    "customers"
  ];

  for (const table of tables) {
    await deleteByCompany(admin, table, companyId);
  }
}

async function seedDemoData(admin: AdminClient, companyId: string, users: Record<string, DemoUser>) {
  const { data: existingJobsite, error: existingError } = await admin
    .from("jobsites")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", "Demo: Steildach Schmidt")
    .limit(1);

  if (existingError) throw new Error("demo_existing_lookup_failed");
  if ((existingJobsite ?? []).length > 0) {
    if (!shouldReseedDemoDataOnStart()) return;
    await cleanupDemoData(admin, companyId);
  }

  const year = new Date().getFullYear();
  const customers = await insertRows(admin, "customers", [
    {
      company_id: companyId,
      customer_type: "privatkunde",
      first_name: "Anna",
      last_name: "Schmidt",
      phone: "0221 555010",
      email: "anna.schmidt@example.invalid",
      billing_address: "Hauptstrasse 12, 50667 Koeln",
      jobsite_address: "Hauptstrasse 12, 50667 Koeln",
      notes: "Demo-Kunde: Steildachsanierung mit Geruestzugang ueber den Hof.",
      status: "aktiv",
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      customer_type: "gewerbekunde",
      company: "Baeckerei Kranz GmbH",
      contact_person: "Thomas Kranz",
      phone: "0211 555019",
      email: "technik@baeckerei-kranz.example.invalid",
      billing_address: "Marktallee 7, 40213 Duesseldorf",
      jobsite_address: "Marktallee 7, 40213 Duesseldorf",
      notes: "Demo-Kunde: Flachdach ueber Produktion, Arbeiten nachmittags planen.",
      status: "aktiv",
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      customer_type: "hausverwaltung",
      company: "Hausverwaltung Rheinblick",
      contact_person: "Katrin Neumann",
      phone: "0228 555023",
      email: "service@rheinblick.example.invalid",
      billing_address: "Bonner Strasse 88, 53111 Bonn",
      jobsite_address: "Rosenweg 4, 53115 Bonn",
      notes: "Demo-Kunde: Rinnenanlage und Fallrohre erneuern.",
      status: "aktiv",
      created_by: users.chef.id
    }
  ]);
  const [schmidt, kranz, rheinblick] = customers;

  const jobsites = await insertRows(admin, "jobsites", [
    {
      company_id: companyId,
      name: "Demo: Steildach Schmidt",
      customer: "Anna Schmidt",
      address: "Hauptstrasse 12, 50667 Koeln",
      latitude: 50.9375,
      longitude: 6.9603,
      start_date: todayOffset(0),
      status: "aktiv",
      notes: "Demo in 2 Minuten: Materialwarnung, Mitbringliste, Aufmass und Tagesstunden sind vorbereitet.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m2.id, users.m3.id],
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      name: "Demo: Flachdach Baeckerei Kranz",
      customer: "Baeckerei Kranz GmbH",
      address: "Marktallee 7, 40213 Duesseldorf",
      latitude: 51.2254,
      longitude: 6.7763,
      start_date: todayOffset(2),
      status: "geplant",
      notes: "Demo: Angebot, Daemmung und Schweissbahn-Bedarf pruefen.",
      assigned_employee_ids: [users.v2.id, users.m4.id, users.m5.id],
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      name: "Demo: Rinnenanlage Rosenweg",
      customer: "Hausverwaltung Rheinblick",
      address: "Rosenweg 4, 53115 Bonn",
      latitude: 50.7374,
      longitude: 7.0982,
      start_date: todayOffset(1),
      status: "geplant",
      notes: "Demo: Dachrinne, Rinnenhalter und Fallrohrlaengen.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m5.id],
      created_by: users.chef.id
    }
  ]);
  const [jobSchmidt, jobKranz, jobRheinblick] = jobsites;

  const orders = await insertRows(admin, "orders", [
    {
      company_id: companyId,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      order_number: `DEMO-${year}-0001`,
      title: "Demo: Steildachsanierung Schmidt",
      order_type: "steildach",
      status: "in_arbeit",
      priority: "hoch",
      jobsite_address: jobSchmidt.address,
      start_date: todayOffset(0),
      end_date: todayOffset(4),
      description: "Unterspannbahn, Konterlattung, Dachlattung und Tonziegel erneuern.",
      internal_notes: "Demo-Fokus: Aufmass pruefen, Materialliste uebernehmen, Mitbringliste erzeugen.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m2.id, users.m3.id],
      has_dimensions: true,
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      customer_id: kranz.id,
      jobsite_id: jobKranz.id,
      order_number: `DEMO-${year}-0002`,
      title: "Demo: Flachdach Baeckerei Kranz",
      order_type: "flachdach",
      status: "angebot",
      priority: "normal",
      jobsite_address: jobKranz.address,
      start_date: todayOffset(2),
      description: "Vor-Kalkulation fuer Flachdach mit Dampfsperre, Daemmung und Oberlage.",
      internal_notes: "Demo-Fokus: Chef-Preise und XRechnung/DATEV-Funktionen zeigen.",
      assigned_employee_ids: [users.v2.id, users.m4.id, users.m5.id],
      has_dimensions: true,
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      customer_id: rheinblick.id,
      jobsite_id: jobRheinblick.id,
      order_number: `DEMO-${year}-0003`,
      title: "Demo: Rinnenanlage Rosenweg",
      order_type: "dachrinne",
      status: "geplant",
      priority: "normal",
      jobsite_address: jobRheinblick.address,
      start_date: todayOffset(1),
      description: "Dachrinne 28 m, zwei Fallrohre und Halter erneuern.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m5.id],
      has_dimensions: true,
      created_by: users.chef.id
    }
  ]);
  const [orderSchmidt, orderKranz, orderRheinblick] = orders;

  const dimensions = await insertRows(admin, "job_dimensions", [
    {
      company_id: companyId,
      order_id: orderSchmidt.id,
      length_m: 10.8,
      width_m: 14.52,
      area_m2: 112,
      roof_pitch: 35,
      eaves_length_m: 18,
      ridge_length_m: 11,
      verge_length_m: 16,
      valley_length_m: 4,
      wall_connection_length_m: 3.5,
      building_height_m: 7.2,
      roof_windows_count: 2,
      penetrations_count: 3,
      roof_drains_count: 0,
      emergency_overflows_count: 0,
      waste_percent: 20,
      notes: "Demo-Aufmass: zwei Dachflaechen, Abzug Dachfenster/Gaube, Ortgang links beschaedigt.",
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      order_id: orderKranz.id,
      length_m: 9.5,
      width_m: 10,
      area_m2: 95,
      wall_connection_length_m: 22,
      building_height_m: 4.8,
      roof_windows_count: 0,
      penetrations_count: 0,
      roof_drains_count: 2,
      emergency_overflows_count: 1,
      waste_percent: 20,
      notes: "Demo-Flachdach: Produktionsdach, Attika und zwei Abläufe, Arbeiten nachmittags planen.",
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      order_id: orderRheinblick.id,
      area_m2: 0,
      eaves_length_m: 28,
      building_height_m: 6.5,
      downpipe_length_m: 14,
      roof_windows_count: 0,
      penetrations_count: 0,
      roof_drains_count: 0,
      emergency_overflows_count: 0,
      waste_percent: 20,
      notes: "Demo-Entwaesserung: RG 333, zwei Fallrohre, Ablaufstutzen korrodiert.",
      created_by: users.chef.id
    }
  ]);
  const [dimSchmidt, dimKranz, dimRheinblick] = dimensions;

  await insertOptionalRows(admin, "order_measurement_items", [
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "roof_area", label: "Hauptdach links", length_m: 10, width_m: 6, quantity: 1, pitch_deg: 35, calculated_area_m2: 73.24, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "roof_area", label: "Hauptdach rechts", length_m: 9, width_m: 5.2, quantity: 1, pitch_deg: 35, calculated_area_m2: 57.13, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "deduction_area", label: "Dachfenster und Gaube", length_m: 3.4, width_m: 5.4, quantity: 1, calculated_area_m2: 18.36, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "eaves_length", label: "Traufe vorne/hinten", length_m: 9, quantity: 2, calculated_area_m2: 0, calculated_length_m: 18, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "ridge_length", label: "First", length_m: 11, quantity: 1, calculated_area_m2: 0, calculated_length_m: 11, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "verge_length", label: "Ortgang links/rechts", length_m: 8, quantity: 2, calculated_area_m2: 0, calculated_length_m: 16, count_value: 0, notes: "Ortgang links beschaedigt, Chef prueft Ersatz.", created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "valley_length", label: "Kehle an Gaube", length_m: 4, quantity: 1, calculated_area_m2: 0, calculated_length_m: 4, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "wall_connection_length", label: "Wandanschluss Gaube", length_m: 3.5, quantity: 1, calculated_area_m2: 0, calculated_length_m: 3.5, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "roof_window", label: "Dachfenster", quantity: 2, calculated_area_m2: 0, calculated_length_m: 0, count_value: 2, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "penetration", label: "Schornstein/Luefter", quantity: 3, calculated_area_m2: 0, calculated_length_m: 0, count_value: 3, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, item_type: "roof_area", label: "Flachdach Produktion", length_m: 9.5, width_m: 10, quantity: 1, calculated_area_m2: 95, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, item_type: "wall_connection_length", label: "Attika/Wandanschluss", length_m: 22, quantity: 1, calculated_area_m2: 0, calculated_length_m: 22, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, item_type: "roof_drain", label: "Dachablaeufe", quantity: 2, calculated_area_m2: 0, calculated_length_m: 0, count_value: 2, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, item_type: "emergency_overflow", label: "Notueberlauf", quantity: 1, calculated_area_m2: 0, calculated_length_m: 0, count_value: 1, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, item_type: "eaves_length", label: "Dachrinne Vorderseite", length_m: 28, quantity: 1, calculated_area_m2: 0, calculated_length_m: 28, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, item_type: "downpipe_length", label: "Zwei Fallrohre", length_m: 7, quantity: 2, calculated_area_m2: 0, calculated_length_m: 14, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, item_type: "penetration", label: "Ablaufstutzen ersetzen", quantity: 2, calculated_area_m2: 0, calculated_length_m: 0, count_value: 2, notes: "Altbestand korrodiert.", created_by: users.chef.id }
  ]);

  const locations = await insertRows(admin, "inventory_locations", [
    { company_id: companyId, name: "Hauptlager Koeln", location_type: "Hauptlager", notes: "Demo-Lager mit typischen Dachdeckerartikeln" },
    { company_id: companyId, name: "Sprinter K-DT 210", location_type: "Fahrzeuglager", notes: "Demo-Fahrzeug Niklas" },
    { company_id: companyId, name: "Container Schmidt", location_type: "Baustelle", notes: "Demo-Container an der Baustelle" }
  ]);
  const [mainLocation, vanLocation, containerLocation] = locations;

  const suppliers = await insertRows(admin, "suppliers", [
    { company_id: companyId, name: "Baustoffhandel Rhein", contact_name: "Herr Vogel", phone: "0221 555030", active: true },
    { company_id: companyId, name: "Wuerth Niederlassung Koeln", contact_name: "Frau Klein", phone: "0221 555031", active: true }
  ]);

  const inventory = await insertRows(admin, "inventory_items", [
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Unterspannbahn diffusionsoffen", unit: "m2", stock: 160, minimum_stock: 80, package_unit: "Rolle 75 m2", manufacturer: "Klober", purchase_price: 1.85, sales_price: 3.1, markup_percent: 35, sales_unit: "m2", price_per_unit: 3.1, notes: "Demo: Standardartikel fuer Steildach.", created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Dachlatte 30/50 impr.", unit: "lfm", stock: 420, minimum_stock: 300, package_unit: "Bund", purchase_price: 0.72, sales_price: 1.15, markup_percent: 40, sales_unit: "lfm", price_per_unit: 1.15, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Konterlatte 40/60 impr.", unit: "lfm", stock: 210, minimum_stock: 250, package_unit: "Bund", purchase_price: 0.9, sales_price: 1.42, markup_percent: 38, sales_unit: "lfm", price_per_unit: 1.42, created_by: users.chef.id },
    { company_id: companyId, location_id: vanLocation.id, supplier_id: suppliers[1].id, name: "Spenglerschrauben 4,5x35 Edelstahl", unit: "Stueck", stock: 280, minimum_stock: 500, package_unit: "Pack 100", manufacturer: "Wuerth", purchase_price: 0.08, sales_price: 0.16, markup_percent: 50, sales_unit: "Stueck", price_per_unit: 0.16, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Schweissbahn PYE PV200 S5 Oberlage", unit: "m2", stock: 70, minimum_stock: 120, package_unit: "Rolle 5 m2", purchase_price: 8.4, sales_price: 13.9, markup_percent: 40, sales_unit: "m2", price_per_unit: 13.9, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Dampfsperre Alu-Bitumen", unit: "m2", stock: 130, minimum_stock: 100, package_unit: "Rolle 10 m2", purchase_price: 4.3, sales_price: 7.2, markup_percent: 40, sales_unit: "m2", price_per_unit: 7.2, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Daemmung PIR 120 mm", unit: "m2", stock: 90, minimum_stock: 120, package_unit: "Paket", purchase_price: 14.8, sales_price: 24.5, markup_percent: 40, sales_unit: "m2", price_per_unit: 24.5, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Voranstrich Bitumen", unit: "l", stock: 24, minimum_stock: 20, package_unit: "Kanister 10 l", purchase_price: 3.9, sales_price: 6.8, markup_percent: 43, sales_unit: "l", price_per_unit: 6.8, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Firstrolle Alu rot", unit: "m", stock: 18, minimum_stock: 12, package_unit: "Rolle 5 m", purchase_price: 4.8, sales_price: 8.2, markup_percent: 41, sales_unit: "m", price_per_unit: 8.2, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Traufblech Titanzink", unit: "m", stock: 24, minimum_stock: 30, package_unit: "Stab 2 m", purchase_price: 5.6, sales_price: 9.2, markup_percent: 39, sales_unit: "m", price_per_unit: 9.2, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Dachrinne RG 333 Zink", unit: "m", stock: 18, minimum_stock: 30, package_unit: "Stab 3 m", purchase_price: 9.4, sales_price: 15.9, markup_percent: 41, sales_unit: "m", price_per_unit: 15.9, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Rinnenhalter verzinkt RG 333", unit: "Stueck", stock: 38, minimum_stock: 60, package_unit: "Stueck", purchase_price: 2.2, sales_price: 4.1, markup_percent: 42, sales_unit: "Stueck", price_per_unit: 4.1, created_by: users.chef.id },
    { company_id: companyId, location_id: mainLocation.id, supplier_id: suppliers[0].id, name: "Fallrohr Zink DN100", unit: "m", stock: 10, minimum_stock: 18, package_unit: "Stab 3 m", purchase_price: 8.1, sales_price: 13.4, markup_percent: 40, sales_unit: "m", price_per_unit: 13.4, created_by: users.chef.id },
    { company_id: companyId, location_id: vanLocation.id, supplier_id: suppliers[0].id, name: "Rohrschelle DN100", unit: "Stueck", stock: 16, minimum_stock: 20, package_unit: "Stueck", purchase_price: 1.6, sales_price: 3.0, markup_percent: 47, sales_unit: "Stueck", price_per_unit: 3.0, created_by: users.chef.id },
    { company_id: companyId, location_id: containerLocation.id, supplier_id: suppliers[0].id, name: "Tonziegel naturrot", unit: "Stueck", stock: 1380, minimum_stock: 0, package_unit: "Palette", purchase_price: 0.94, sales_price: 1.55, markup_percent: 39, sales_unit: "Stueck", price_per_unit: 1.55, created_by: users.chef.id }
  ]);
  const inventoryByName = Object.fromEntries(inventory.map((item) => [String(item.name), item]));

  await insertRows(admin, "job_material_requirements", [
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id, material_name: "Unterspannbahn diffusionsoffen", unit: "m2", base_quantity: 112, waste_percent: 20, waste_quantity: 22.4, total_quantity: 134.4, purchase_price: 1.85, sales_price: 3.1, purchase_total: 248.64, sales_total: 416.64, margin_total: 168, location_name: "Hauptlager Koeln", stock: 160, minimum_stock: 80, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, material_name: "Konterlatte 40/60 impr.", unit: "lfm", base_quantity: 260, waste_percent: 20, waste_quantity: 52, total_quantity: 312, purchase_price: 0.9, sales_price: 1.42, purchase_total: 280.8, sales_total: 443.04, margin_total: 162.24, location_name: "Hauptlager Koeln", stock: 210, minimum_stock: 250, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Dachlatte 30/50 impr."].id, material_name: "Dachlatte 30/50 impr.", unit: "lfm", base_quantity: 420, waste_percent: 20, waste_quantity: 84, total_quantity: 504, purchase_price: 0.72, sales_price: 1.15, purchase_total: 362.88, sales_total: 579.6, margin_total: 216.72, location_name: "Hauptlager Koeln", stock: 420, minimum_stock: 300, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Tonziegel naturrot"].id, material_name: "Tonziegel naturrot", unit: "Stueck", base_quantity: 1288, waste_percent: 20, waste_quantity: 257.6, total_quantity: 1545.6, purchase_price: 0.94, sales_price: 1.55, purchase_total: 1452.86, sales_total: 2395.68, margin_total: 942.82, location_name: "Container Schmidt", stock: 1380, minimum_stock: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Firstrolle Alu rot"].id, material_name: "Firstrolle Alu rot", unit: "m", base_quantity: 11, waste_percent: 20, waste_quantity: 2.2, total_quantity: 13.2, purchase_price: 4.8, sales_price: 8.2, purchase_total: 63.36, sales_total: 108.24, margin_total: 44.88, location_name: "Hauptlager Koeln", stock: 18, minimum_stock: 12, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Traufblech Titanzink"].id, material_name: "Traufblech Titanzink", unit: "m", base_quantity: 18, waste_percent: 20, waste_quantity: 3.6, total_quantity: 21.6, purchase_price: 5.6, sales_price: 9.2, purchase_total: 120.96, sales_total: 198.72, margin_total: 77.76, location_name: "Hauptlager Koeln", stock: 24, minimum_stock: 30, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, dimension_id: dimKranz.id, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Dampfsperre Alu-Bitumen"].id, material_name: "Dampfsperre Alu-Bitumen", unit: "m2", base_quantity: 95, waste_percent: 20, waste_quantity: 19, total_quantity: 114, purchase_price: 4.3, sales_price: 7.2, purchase_total: 490.2, sales_total: 820.8, margin_total: 330.6, location_name: "Hauptlager Koeln", stock: 130, minimum_stock: 100, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, dimension_id: dimKranz.id, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Daemmung PIR 120 mm"].id, material_name: "Daemmung PIR 120 mm", unit: "m2", base_quantity: 95, waste_percent: 20, waste_quantity: 19, total_quantity: 114, purchase_price: 14.8, sales_price: 24.5, purchase_total: 1687.2, sales_total: 2793, margin_total: 1105.8, location_name: "Hauptlager Koeln", stock: 90, minimum_stock: 120, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, dimension_id: dimKranz.id, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id, material_name: "Schweissbahn PYE PV200 S5 Oberlage", unit: "m2", base_quantity: 95, waste_percent: 20, waste_quantity: 19, total_quantity: 114, purchase_price: 8.4, sales_price: 13.9, purchase_total: 957.6, sales_total: 1584.6, margin_total: 627, location_name: "Hauptlager Koeln", stock: 70, minimum_stock: 120, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, dimension_id: dimKranz.id, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Voranstrich Bitumen"].id, material_name: "Voranstrich Bitumen", unit: "l", base_quantity: 28.5, waste_percent: 20, waste_quantity: 5.7, total_quantity: 34.2, purchase_price: 3.9, sales_price: 6.8, purchase_total: 133.38, sales_total: 232.56, margin_total: 99.18, location_name: "Hauptlager Koeln", stock: 24, minimum_stock: 20, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, dimension_id: dimRheinblick.id, jobsite_id: jobRheinblick.id, inventory_item_id: inventoryByName["Dachrinne RG 333 Zink"].id, material_name: "Dachrinne RG 333 Zink", unit: "m", base_quantity: 28, waste_percent: 20, waste_quantity: 5.6, total_quantity: 33.6, purchase_price: 9.4, sales_price: 15.9, purchase_total: 315.84, sales_total: 534.24, margin_total: 218.4, location_name: "Hauptlager Koeln", stock: 18, minimum_stock: 30, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, dimension_id: dimRheinblick.id, jobsite_id: jobRheinblick.id, inventory_item_id: inventoryByName["Rinnenhalter verzinkt RG 333"].id, material_name: "Rinnenhalter verzinkt RG 333", unit: "Stueck", base_quantity: 47, waste_percent: 0, waste_quantity: 0, total_quantity: 47, purchase_price: 2.2, sales_price: 4.1, purchase_total: 103.4, sales_total: 192.7, margin_total: 89.3, location_name: "Hauptlager Koeln", stock: 38, minimum_stock: 60, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, dimension_id: dimRheinblick.id, jobsite_id: jobRheinblick.id, inventory_item_id: inventoryByName["Fallrohr Zink DN100"].id, material_name: "Fallrohr Zink DN100", unit: "m", base_quantity: 14, waste_percent: 20, waste_quantity: 2.8, total_quantity: 16.8, purchase_price: 8.1, sales_price: 13.4, purchase_total: 136.08, sales_total: 225.12, margin_total: 89.04, location_name: "Hauptlager Koeln", stock: 10, minimum_stock: 18, created_by: users.chef.id }
  ]);

  const materialCalculations = await insertRows(
    admin,
    "job_material_calculations",
    [
      {
        company_id: companyId,
        jobsite_id: jobSchmidt.id,
        roof_type: "steildach",
        roof_form: "satteldach",
        material_type: "tonziegel",
        length_m: 10.8,
        width_m: 14.52,
        area_m2: 112,
        roof_pitch: 35,
        eaves_length_m: 18,
        ridge_length_m: 11,
        verge_length_m: 16,
        valley_length_m: 4,
        wall_connection_length_m: 3.5,
        penetrations_count: 3,
        roof_windows_count: 2,
        dormers_count: 1,
        chimneys_count: 1,
        waste_percent: 20,
        ai_enabled: false,
        review_notice: "Demo: Vorschlag aus Aufmass und Dachdecker-Regeln. Vor Bestellung fachlich pruefen.",
        notes: "Ziegel ca. 11,5 Stueck/m2, Lattung grob aus Dachflaeche geschaetzt.",
        created_by: users.chef.id
      },
      {
        company_id: companyId,
        jobsite_id: jobKranz.id,
        roof_type: "flachdach",
        roof_form: "flachdach_mit_attika",
        material_type: "bitumenbahn",
        length_m: 9.5,
        width_m: 10,
        area_m2: 95,
        roof_pitch: 2,
        wall_connection_length_m: 22,
        penetrations_count: 3,
        roof_windows_count: 0,
        dormers_count: 0,
        chimneys_count: 0,
        waste_percent: 20,
        ai_enabled: false,
        review_notice: "Demo: Flachdach-Materialliste ist ein Angebotsvorschlag und muss vor Ausfuehrung geprueft werden.",
        notes: "Dampfsperre, Daemmung und Oberlage jeweils mit 20 Prozent Zuschlag.",
        created_by: users.chef.id
      },
      {
        company_id: companyId,
        jobsite_id: jobRheinblick.id,
        roof_type: "entwaesserung",
        roof_form: "satteldach_rinne",
        material_type: "zink",
        length_m: 28,
        area_m2: 0,
        eaves_length_m: 28,
        penetrations_count: 2,
        roof_windows_count: 0,
        dormers_count: 0,
        chimneys_count: 0,
        waste_percent: 20,
        ai_enabled: false,
        review_notice: "Demo: Entwaesserungsbedarf mit 20 Prozent Zuschlag fuer Zuschnitt und Reserve.",
        notes: "Rinnenhalter nach 60 cm Abstand, Fallrohre 2 x 7 m.",
        created_by: users.chef.id
      }
    ],
    "id, jobsite_id"
  );
  const [calcSchmidt, calcKranz, calcRheinblick] = materialCalculations;

  await insertRows(admin, "job_material_calculation_items", [
    buildCalculationItem({ companyId, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Tonziegel naturrot"], materialName: "Tonziegel naturrot", unit: "Stueck", baseQuantity: 1288, locationName: "Container Schmidt", aiReason: "112 m2 x ca. 11,5 Stueck/m2 plus 20 Prozent Reserve.", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Unterspannbahn diffusionsoffen"], materialName: "Unterspannbahn diffusionsoffen", unit: "m2", baseQuantity: 112, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Konterlatte 40/60 impr."], materialName: "Konterlatte 40/60 impr.", unit: "lfm", baseQuantity: 260, locationName: "Hauptlager Koeln", aiReason: "Grobe Schaetzung aus Dachflaeche und Sparrenabstand.", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Dachlatte 30/50 impr."], materialName: "Dachlatte 30/50 impr.", unit: "lfm", baseQuantity: 420, locationName: "Hauptlager Koeln", aiReason: "Grobe Schaetzung aus Dachflaeche und Lattenabstand.", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Firstrolle Alu rot"], materialName: "Firstrolle Alu rot", unit: "m", baseQuantity: 11, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcSchmidt.id, jobsiteId: jobSchmidt.id, inventoryItem: inventoryByName["Traufblech Titanzink"], materialName: "Traufblech Titanzink", unit: "m", baseQuantity: 18, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcKranz.id, jobsiteId: jobKranz.id, inventoryItem: inventoryByName["Dampfsperre Alu-Bitumen"], materialName: "Dampfsperre Alu-Bitumen", unit: "m2", baseQuantity: 95, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcKranz.id, jobsiteId: jobKranz.id, inventoryItem: inventoryByName["Daemmung PIR 120 mm"], materialName: "Daemmung PIR 120 mm", unit: "m2", baseQuantity: 95, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcKranz.id, jobsiteId: jobKranz.id, inventoryItem: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"], materialName: "Schweissbahn PYE PV200 S5 Oberlage", unit: "m2", baseQuantity: 95, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcKranz.id, jobsiteId: jobKranz.id, inventoryItem: inventoryByName["Voranstrich Bitumen"], materialName: "Voranstrich Bitumen", unit: "l", baseQuantity: 28.5, locationName: "Hauptlager Koeln", aiReason: "0,3 l/m2 fuer 95 m2 plus 20 Prozent Reserve.", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcRheinblick.id, jobsiteId: jobRheinblick.id, inventoryItem: inventoryByName["Dachrinne RG 333 Zink"], materialName: "Dachrinne RG 333 Zink", unit: "m", baseQuantity: 28, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcRheinblick.id, jobsiteId: jobRheinblick.id, inventoryItem: inventoryByName["Rinnenhalter verzinkt RG 333"], materialName: "Rinnenhalter verzinkt RG 333", unit: "Stueck", baseQuantity: 47, wastePercent: 0, locationName: "Hauptlager Koeln", aiReason: "28 m Traufe / 0,6 m Halterabstand aufgerundet.", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcRheinblick.id, jobsiteId: jobRheinblick.id, inventoryItem: inventoryByName["Fallrohr Zink DN100"], materialName: "Fallrohr Zink DN100", unit: "m", baseQuantity: 14, locationName: "Hauptlager Koeln", createdBy: users.chef.id }),
    buildCalculationItem({ companyId, calculationId: calcRheinblick.id, jobsiteId: jobRheinblick.id, inventoryItem: inventoryByName["Rohrschelle DN100"], materialName: "Rohrschelle DN100", unit: "Stueck", baseQuantity: 8, wastePercent: 0, locationName: "Sprinter K-DT 210", createdBy: users.chef.id })
  ]);

  const vehicles = await insertRows(admin, "vehicles", [
    { company_id: companyId, name: "Sprinter 210", license_plate: "K-DT 210", tuv_date: todayOffset(210), notes: "Demo-Fahrzeug mit Leitertraeger" },
    { company_id: companyId, name: "Pritsche 211", license_plate: "K-DT 211", tuv_date: todayOffset(95), notes: "Demo-Fahrzeug fuer Materialtransport" }
  ]);

  await insertRows(admin, "time_entries", [
    { company_id: companyId, employee_id: users.m1.id, job_id: jobSchmidt.id, date: todayOffset(0), work_location: jobSchmidt.name, work_address: jobSchmidt.address, start_time: "07:00", end_time: "16:00", break_minutes: 45, ...minutes("07:00", "16:00", 45), activity: "Demo: alte Lattung aufgenommen, Unterspannbahn vorbereitet", weather: "trocken", status: "submitted", created_by: users.m1.id },
    { company_id: companyId, employee_id: users.m2.id, job_id: jobSchmidt.id, date: todayOffset(0), work_location: jobSchmidt.name, work_address: jobSchmidt.address, start_time: "07:15", end_time: "15:45", break_minutes: 45, ...minutes("07:15", "15:45", 45), activity: "Demo: Material angenommen, Ortgang geprueft", weather: "trocken", status: "submitted", created_by: users.m2.id },
    { company_id: companyId, employee_id: users.m5.id, job_id: jobRheinblick.id, date: todayOffset(-1), work_location: jobRheinblick.name, work_address: jobRheinblick.address, start_time: "07:30", end_time: "14:30", break_minutes: 30, ...minutes("07:30", "14:30", 30), activity: "Demo: Dachrinne demontiert und Fallrohrlaengen aufgenommen", weather: "bedeckt", status: "approved", approved_by: users.chef.id, approved_at: new Date().toISOString(), created_by: users.m5.id }
  ]);

  await insertRows(admin, "reports", [
    {
      company_id: companyId,
      jobsite_id: jobSchmidt.id,
      report_date: todayOffset(-1),
      weather: "Trocken, 18 Grad, leichter Wind",
      weather_summary: "Trocken, 18 °C, leichter Wind - gute Bedingungen fuer Dacharbeiten.",
      weather_temperature_c: 18,
      weather_precipitation_mm: 0,
      weather_wind_kmh: 14,
      weather_source: "open-meteo-demo",
      weather_fetched_at: new Date().toISOString(),
      work_start: "07:00",
      work_end: "16:00",
      employee_ids: [users.v1.id, users.m1.id, users.m2.id],
      activities: "Unterspannbahn vorbereitet, Material kontrolliert, Aufmass geprueft und Ortgang links dokumentiert.",
      material_usage: "Unterspannbahn 75 m2, Dachlatten 110 lfm.",
      machine_usage: "Dachaufzug, Sprinter K-DT 210.",
      issues: "Konterlattenbestand reicht voraussichtlich nicht. Chef-Warnung wurde erzeugt.",
      report_status: "approved",
      visible_to_customer: true,
      customer_summary:
        "Die Dachflaeche wurde vorbereitet. Unterspannbahn und erste Lattung sind begonnen, der Ortgang links wird gesondert geprueft. Fuer morgen ist zusaetzliches Material eingeplant.",
      customer_released_at: new Date().toISOString(),
      signature_name: "Niklas Berger",
      created_by: users.v1.id
    },
    {
      company_id: companyId,
      jobsite_id: jobRheinblick.id,
      report_date: todayOffset(-1),
      weather: "Bedeckt, trocken",
      weather_summary: "Bedeckt, trocken - Arbeiten an der Rinne ohne Niederschlag.",
      work_start: "07:30",
      work_end: "14:30",
      employee_ids: [users.m5.id],
      activities: "Demo: Rinne demontiert, Ablaufstutzen korrodiert dokumentiert.",
      material_usage: "Rinnenhalter Muster, Schrauben.",
      issues: "Ablaufstutzen muss ersetzt werden.",
      report_status: "reviewed",
      visible_to_customer: false,
      signature_name: "Jan Hoffmann",
      created_by: users.m5.id
    }
  ]);

  const portalTokens = await insertRows(
    admin,
    "customer_portal_tokens",
    [
      {
        company_id: companyId,
        customer_id: schmidt.id,
        jobsite_id: jobSchmidt.id,
        token_hash: hashCustomerPortalToken(DEMO_CUSTOMER_PORTAL_TOKEN),
        label: "Demo: Kundenportal Schmidt",
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: users.chef.id
      }
    ],
    "id"
  );
  const [portalToken] = portalTokens;

  await insertRows(admin, "customer_portal_events", [
    {
      company_id: companyId,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "status",
      title: "Baustelle gestartet",
      body: "Geruest steht, Material wurde geprueft und die Dachflaeche ist fuer die naechsten Arbeitsschritte vorbereitet.",
      visible_to_customer: true,
      event_date: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "appointment",
      title: "Naechster Termin: Lattung und Ortgang",
      body: "Das Team ist morgen ab ca. 7:00 Uhr vor Ort. Bitte Hofzufahrt freihalten.",
      visible_to_customer: true,
      event_date: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
      created_by: users.v1.id
    },
    {
      company_id: companyId,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "photo",
      title: "Fotodokumentation vorbereitet",
      body: "Beispiel-Fotos werden im echten Betrieb einzeln freigegeben. Interne Fotos bleiben verborgen.",
      visible_to_customer: true,
      event_date: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      created_by: users.v1.id
    },
    {
      company_id: companyId,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "document",
      title: "Dokumentenbereich bereit",
      body: "Angebote, Arbeitsauftraege und Abnahmen koennen hier freigegeben und digital bestaetigt werden.",
      visible_to_customer: true,
      event_date: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      event_type: "update",
      title: "Wetterhinweis dokumentiert",
      body: "Trocken, leichter Wind - gute Bedingungen. Falls Regen aufzieht, werden Material und Folien gesichert.",
      visible_to_customer: true,
      event_date: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
      created_by: users.v1.id
    }
  ]);

  await insertRows(admin, "customer_portal_messages", [
    {
      company_id: companyId,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      portal_token_id: portalToken.id,
      sender_name: "Anna Schmidt",
      sender_email: "anna.schmidt@example.invalid",
      message: "Koennen die Dachfenster waehrend der Arbeiten abgedeckt bleiben? Wir sind morgen nicht durchgehend zu Hause.",
      status: "open"
    }
  ]);

  const demoWorkOrderSnapshot = {
    title: "Arbeitsauftrag: Steildachsanierung Schmidt",
    scope_of_work:
      "Unterspannbahn verlegen, Konterlattung und Dachlattung herstellen, Ortgang links pruefen und die naechsten Materialschritte dokumentieren.",
    version: 1,
    customer_id: schmidt.id,
    jobsite_id: jobSchmidt.id
  };
  await insertRows(admin, "work_orders", [
    {
      company_id: companyId,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      order_id: orderSchmidt.id,
      title: demoWorkOrderSnapshot.title,
      description: "Demo-Arbeitsauftrag fuer die digitale Kundenfreigabe.",
      scope_of_work: demoWorkOrderSnapshot.scope_of_work,
      price_note: "Preisdetails stehen im Angebot. Interne EK-/Marge-Daten sind nicht Teil des Kundenportals.",
      status: "sent",
      version: 1,
      content_hash: contentHash(demoWorkOrderSnapshot),
      sent_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
      created_by: users.chef.id
    }
  ]);

  await insertRows(admin, "tasks", [
    { company_id: companyId, jobsite_id: jobSchmidt.id, title: "Demo: Konterlatten nachbestellen", description: "Mindestens 150 lfm fuer Schmidt reservieren.", assigned_to: users.chef.id, due_date: todayOffset(0), status: "offen", created_by: users.v1.id },
    { company_id: companyId, jobsite_id: jobKranz.id, title: "Demo: Brenner und Gas pruefen", description: "Vor Flachdachtermin Gasbrennerzubehoer kontrollieren.", assigned_to: users.v2.id, due_date: todayOffset(1), status: "in_arbeit", created_by: users.chef.id }
  ]);

  const bringLists = await insertRows(admin, "bring_lists", [
    { company_id: companyId, job_id: jobSchmidt.id, date: todayOffset(1), title: "Demo: Morgen Schmidt vorbereiten", notes: "Vom Hauptlager und Container laden. Fehlende Konterlatten und Ziegelmenge melden.", status: "ready", created_by: users.chef.id, assigned_to: users.v1.id, vehicle_id: vehicles[0].id },
    { company_id: companyId, job_id: jobKranz.id, date: todayOffset(2), title: "Demo: Flachdach Kranz packen", notes: "Brenner-Set, Dampfsperre, Daemmung und Oberlage pruefen. Daemmung und Oberlage sind knapp.", status: "draft", created_by: users.chef.id, assigned_to: users.v2.id, vehicle_id: vehicles[1].id },
    { company_id: companyId, job_id: jobRheinblick.id, date: todayOffset(1), title: "Demo: Rinnenanlage Rosenweg", notes: "Rinne, Halter, Fallrohre und Rohrschellen laden. Bestand reicht nicht vollstaendig.", status: "ready", created_by: users.chef.id, assigned_to: users.v1.id, vehicle_id: vehicles[1].id }
  ]);
  const [bringList, bringListKranz, bringListRheinblick] = bringLists;

  await insertRows(admin, "bring_list_items", [
    { bring_list_id: bringList.id, inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id, custom_item_name: "Unterspannbahn diffusionsoffen", item_type: "material", quantity: 134.4, unit: "m2", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[0].id, missing_reported: false },
    { bring_list_id: bringList.id, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, custom_item_name: "Konterlatte 40/60 impr.", item_type: "material", quantity: 312, unit: "lfm", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[0].id, missing_reported: true, notes: "Bestand reicht voraussichtlich nicht." },
    { bring_list_id: bringList.id, inventory_item_id: inventoryByName["Dachlatte 30/50 impr."].id, custom_item_name: "Dachlatte 30/50 impr.", item_type: "material", quantity: 504, unit: "lfm", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[0].id, missing_reported: true, notes: "84 lfm fehlen gegen kalkulierten Bedarf." },
    { bring_list_id: bringList.id, inventory_item_id: inventoryByName["Tonziegel naturrot"].id, custom_item_name: "Tonziegel naturrot", item_type: "material", quantity: 1546, unit: "Stueck", storage_location: "Container Schmidt", vehicle_id: vehicles[0].id, missing_reported: true, notes: "Containerbestand reicht nicht fuer komplette Dachflaeche." },
    { bring_list_id: bringList.id, inventory_item_id: inventoryByName["Firstrolle Alu rot"].id, custom_item_name: "Firstrolle Alu rot", item_type: "material", quantity: 13.2, unit: "m", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[0].id, missing_reported: false },
    { bring_list_id: bringList.id, inventory_item_id: inventoryByName["Traufblech Titanzink"].id, custom_item_name: "Traufblech Titanzink", item_type: "material", quantity: 21.6, unit: "m", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[0].id, missing_reported: false },
    { bring_list_id: bringList.id, custom_item_name: "PSA-Set und Absturzsicherung", item_type: "safety", quantity: 1, unit: "Set", storage_location: "Sprinter K-DT 210", vehicle_id: vehicles[0].id, missing_reported: false },
    { bring_list_id: bringListKranz.id, inventory_item_id: inventoryByName["Dampfsperre Alu-Bitumen"].id, custom_item_name: "Dampfsperre Alu-Bitumen", item_type: "material", quantity: 114, unit: "m2", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: false },
    { bring_list_id: bringListKranz.id, inventory_item_id: inventoryByName["Daemmung PIR 120 mm"].id, custom_item_name: "Daemmung PIR 120 mm", item_type: "material", quantity: 114, unit: "m2", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "24 m2 fehlen." },
    { bring_list_id: bringListKranz.id, inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id, custom_item_name: "Schweissbahn PYE PV200 S5 Oberlage", item_type: "material", quantity: 114, unit: "m2", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "44 m2 fehlen." },
    { bring_list_id: bringListKranz.id, custom_item_name: "Gasbrenner-Set gross", item_type: "tool", quantity: 1, unit: "Set", storage_location: "Pritsche K-DT 211", vehicle_id: vehicles[1].id, missing_reported: false },
    { bring_list_id: bringListRheinblick.id, inventory_item_id: inventoryByName["Dachrinne RG 333 Zink"].id, custom_item_name: "Dachrinne RG 333 Zink", item_type: "material", quantity: 33.6, unit: "m", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "15,6 m fehlen." },
    { bring_list_id: bringListRheinblick.id, inventory_item_id: inventoryByName["Rinnenhalter verzinkt RG 333"].id, custom_item_name: "Rinnenhalter verzinkt RG 333", item_type: "material", quantity: 47, unit: "Stueck", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "9 Stueck fehlen." },
    { bring_list_id: bringListRheinblick.id, inventory_item_id: inventoryByName["Fallrohr Zink DN100"].id, custom_item_name: "Fallrohr Zink DN100", item_type: "material", quantity: 16.8, unit: "m", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[1].id, missing_reported: true, notes: "6,8 m fehlen." }
  ]);

  await insertRows(admin, "material_alerts", [
    { company_id: companyId, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, job_id: jobSchmidt.id, bring_list_id: bringList.id, alert_type: "low_stock", severity: "critical", message: "Demo: Konterlatten reichen fuer Baustelle Schmidt voraussichtlich nicht aus.", required_quantity: 312, available_quantity: 210, missing_quantity: 102, unit: "lfm", status: "open", created_by_system: true, assigned_to_admin: users.chef.id },
    { company_id: companyId, inventory_item_id: inventoryByName["Daemmung PIR 120 mm"].id, job_id: jobKranz.id, bring_list_id: bringListKranz.id, alert_type: "low_stock", severity: "warning", message: "Demo: Daemmung fuer Flachdach Kranz ist zu knapp.", required_quantity: 114, available_quantity: 90, missing_quantity: 24, unit: "m2", status: "open", created_by_system: true, assigned_to_admin: users.chef.id },
    { company_id: companyId, inventory_item_id: inventoryByName["Dachrinne RG 333 Zink"].id, job_id: jobRheinblick.id, bring_list_id: bringListRheinblick.id, alert_type: "low_stock", severity: "critical", message: "Demo: Dachrinne fuer Rosenweg reicht nicht aus.", required_quantity: 33.6, available_quantity: 18, missing_quantity: 15.6, unit: "m", status: "open", created_by_system: true, assigned_to_admin: users.chef.id },
    { company_id: companyId, inventory_item_id: inventoryByName["Spenglerschrauben 4,5x35 Edelstahl"].id, alert_type: "below_minimum_after_reservation", severity: "warning", message: "Demo: Spenglerschrauben liegen unter Mindestbestand.", required_quantity: 500, available_quantity: 280, missing_quantity: 220, unit: "Stueck", status: "open", created_by_system: true, assigned_to_admin: users.chef.id }
  ]);

  await insertRows(admin, "purchase_suggestions", [
    { company_id: companyId, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, job_id: jobSchmidt.id, bring_list_id: bringList.id, quantity_needed: 160, unit: "lfm", reason: "Demo: Bestand unter Mindestbestand und Baustelle Schmidt braucht 312 lfm.", status: "open" },
    { company_id: companyId, inventory_item_id: inventoryByName["Daemmung PIR 120 mm"].id, job_id: jobKranz.id, bring_list_id: bringListKranz.id, quantity_needed: 40, unit: "m2", reason: "Demo: Flachdach Kranz braucht 114 m2 Daemmung, Lager hat 90 m2.", status: "open" },
    { company_id: companyId, inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id, job_id: jobKranz.id, quantity_needed: 60, unit: "m2", reason: "Demo: Flachdach Kranz braucht kalkuliert 95 m2 plus Verschnitt.", status: "open" },
    { company_id: companyId, inventory_item_id: inventoryByName["Dachrinne RG 333 Zink"].id, job_id: jobRheinblick.id, bring_list_id: bringListRheinblick.id, quantity_needed: 24, unit: "m", reason: "Demo: Rosenweg braucht 33,6 m Dachrinne, Lager hat 18 m.", status: "open" }
  ]);
}

export async function ensureDemoModeData(options: EnsureDemoModeOptions = {}) {
  if (!demoModeEnabled()) {
    throw new SafeActionError("Demo-Modus ist in dieser Umgebung nicht aktiviert.");
  }

  let admin: AdminClient;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    throw new SafeActionError("Demo-Modus braucht serverseitig SUPABASE_SERVICE_ROLE_KEY.");
  }

  const password = demoPassword();
  const company = await ensureDemoCompany(admin);

  if (!options.forceUserSync && !shouldReseedDemoDataOnStart() && (await hasPreparedDemoData(admin, company.id))) {
    return {
      companyId: company.id,
      companyName: DEMO_COMPANY_NAME,
      chefEmail: DEMO_CHEF_EMAIL,
      password
    };
  }

  const existingUsers = await listAllUsers(admin);
  const users = Object.fromEntries(
    await Promise.all(demoUsers.map(async (seed) => [seed.key, await ensureDemoUser(admin, seed, company.id, password, existingUsers)] as const))
  ) as Record<string, DemoUser>;

  await markDemoCompanyReady(admin, company.id, users.chef.id);

  await seedDemoData(admin, company.id, users);

  return {
    companyId: company.id,
    companyName: DEMO_COMPANY_NAME,
    chefEmail: DEMO_CHEF_EMAIL,
    password
  };
}
