import "server-only";
import { DEMO_CHEF_EMAIL, DEMO_COMPANY_NAME, DEMO_DEFAULT_PASSWORD, DEMO_EMAIL_DOMAIN } from "@/lib/demo/constants";
import { SafeActionError } from "@/lib/security/errors";
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
    throw new Error(`demo_insert_${table}_failed`);
  }

  return (data ?? []) as unknown as DemoRow[];
}

async function seedDemoData(admin: AdminClient, companyId: string, users: Record<string, DemoUser>) {
  const { data: existingJobsite, error: existingError } = await admin
    .from("jobsites")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", "Demo: Steildach Schmidt")
    .maybeSingle();

  if (existingError) throw new Error("demo_existing_lookup_failed");
  if (existingJobsite) return;

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
      area_m2: 112,
      roof_pitch: 35,
      eaves_length_m: 18,
      ridge_length_m: 11,
      verge_length_m: 16,
      valley_length_m: 4,
      wall_connection_length_m: 0,
      roof_windows_count: 2,
      penetrations_count: 3,
      roof_drains_count: 0,
      emergency_overflows_count: 0,
      waste_percent: 20,
      notes: "Demo-Aufmass aus drei Positionen.",
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      order_id: orderKranz.id,
      area_m2: 95,
      wall_connection_length_m: 22,
      roof_drains_count: 2,
      emergency_overflows_count: 1,
      waste_percent: 20,
      notes: "Demo-Flachdach fuer Angebot.",
      created_by: users.chef.id
    },
    {
      company_id: companyId,
      order_id: orderRheinblick.id,
      area_m2: 0,
      eaves_length_m: 28,
      downpipe_length_m: 14,
      waste_percent: 20,
      notes: "Demo-Entwaesserung.",
      created_by: users.chef.id
    }
  ]);
  const [dimSchmidt, dimKranz, dimRheinblick] = dimensions;

  await insertRows(admin, "order_measurement_items", [
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "roof_area", label: "Hauptdach links", length_m: 10, width_m: 6, quantity: 1, pitch_deg: 35, calculated_area_m2: 73.24, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "roof_area", label: "Hauptdach rechts", length_m: 9, width_m: 5.2, quantity: 1, pitch_deg: 35, calculated_area_m2: 57.13, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "deduction_area", label: "Dachfenster und Gaube", length_m: 3.4, width_m: 5.4, quantity: 1, calculated_area_m2: 18.36, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "eaves_length", label: "Traufe vorne/hinten", length_m: 9, quantity: 2, calculated_area_m2: 0, calculated_length_m: 18, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, item_type: "ridge_length", label: "First", length_m: 11, quantity: 1, calculated_area_m2: 0, calculated_length_m: 11, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, item_type: "roof_area", label: "Flachdach Produktion", length_m: 9.5, width_m: 10, quantity: 1, calculated_area_m2: 95, calculated_length_m: 0, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, item_type: "eaves_length", label: "Dachrinne Vorderseite", length_m: 28, quantity: 1, calculated_area_m2: 0, calculated_length_m: 28, count_value: 0, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, item_type: "downpipe_length", label: "Zwei Fallrohre", length_m: 7, quantity: 2, calculated_area_m2: 0, calculated_length_m: 14, count_value: 0, created_by: users.chef.id }
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
    { company_id: companyId, location_id: containerLocation.id, supplier_id: suppliers[0].id, name: "Tonziegel naturrot", unit: "Stueck", stock: 1380, minimum_stock: 0, package_unit: "Palette", purchase_price: 0.94, sales_price: 1.55, markup_percent: 39, sales_unit: "Stueck", price_per_unit: 1.55, created_by: users.chef.id }
  ]);
  const inventoryByName = Object.fromEntries(inventory.map((item) => [String(item.name), item]));

  await insertRows(admin, "job_material_requirements", [
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id, material_name: "Unterspannbahn diffusionsoffen", unit: "m2", base_quantity: 112, waste_percent: 20, waste_quantity: 22.4, total_quantity: 134.4, purchase_price: 1.85, sales_price: 3.1, purchase_total: 248.64, sales_total: 416.64, margin_total: 168, location_name: "Hauptlager Koeln", stock: 160, minimum_stock: 80, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, material_name: "Konterlatte 40/60 impr.", unit: "lfm", base_quantity: 260, waste_percent: 20, waste_quantity: 52, total_quantity: 312, purchase_price: 0.9, sales_price: 1.42, purchase_total: 280.8, sales_total: 443.04, margin_total: 162.24, location_name: "Hauptlager Koeln", stock: 210, minimum_stock: 250, created_by: users.chef.id },
    { company_id: companyId, order_id: orderSchmidt.id, dimension_id: dimSchmidt.id, jobsite_id: jobSchmidt.id, inventory_item_id: inventoryByName["Dachlatte 30/50 impr."].id, material_name: "Dachlatte 30/50 impr.", unit: "lfm", base_quantity: 420, waste_percent: 20, waste_quantity: 84, total_quantity: 504, purchase_price: 0.72, sales_price: 1.15, purchase_total: 362.88, sales_total: 579.6, margin_total: 216.72, location_name: "Hauptlager Koeln", stock: 420, minimum_stock: 300, created_by: users.chef.id },
    { company_id: companyId, order_id: orderKranz.id, dimension_id: dimKranz.id, jobsite_id: jobKranz.id, inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id, material_name: "Schweissbahn PYE PV200 S5 Oberlage", unit: "m2", base_quantity: 95, waste_percent: 20, waste_quantity: 19, total_quantity: 114, purchase_price: 8.4, sales_price: 13.9, purchase_total: 957.6, sales_total: 1584.6, margin_total: 627, location_name: "Hauptlager Koeln", stock: 70, minimum_stock: 120, created_by: users.chef.id },
    { company_id: companyId, order_id: orderRheinblick.id, dimension_id: dimRheinblick.id, jobsite_id: jobRheinblick.id, material_name: "Dachrinne RG 333 Zink", unit: "m", base_quantity: 28, waste_percent: 20, waste_quantity: 5.6, total_quantity: 33.6, purchase_price: 9.4, sales_price: 15.9, purchase_total: 315.84, sales_total: 534.24, margin_total: 218.4, location_name: "Hauptlager Koeln", stock: 18, minimum_stock: 30, created_by: users.chef.id }
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
    { company_id: companyId, jobsite_id: jobSchmidt.id, report_date: todayOffset(0), weather: "Trocken, 18 Grad, leichter Wind", work_start: "07:00", work_end: "16:00", employee_ids: [users.v1.id, users.m1.id, users.m2.id], activities: "Demo: Unterspannbahn vorbereitet, Material kontrolliert, Aufmass geprueft.", material_usage: "Unterspannbahn 75 m2, Dachlatten 110 lfm.", issues: "Konterlattenbestand reicht voraussichtlich nicht.", signature_name: "Niklas Berger", created_by: users.v1.id },
    { company_id: companyId, jobsite_id: jobRheinblick.id, report_date: todayOffset(-1), weather: "Bedeckt, trocken", work_start: "07:30", work_end: "14:30", employee_ids: [users.m5.id], activities: "Demo: Rinne demontiert, Ablaufstutzen korrodiert dokumentiert.", material_usage: "Rinnenhalter Muster, Schrauben.", issues: "Ablaufstutzen muss ersetzt werden.", signature_name: "Jan Hoffmann", created_by: users.m5.id }
  ]);

  await insertRows(admin, "tasks", [
    { company_id: companyId, jobsite_id: jobSchmidt.id, title: "Demo: Konterlatten nachbestellen", description: "Mindestens 150 lfm fuer Schmidt reservieren.", assigned_to: users.chef.id, due_date: todayOffset(0), status: "offen", created_by: users.v1.id },
    { company_id: companyId, jobsite_id: jobKranz.id, title: "Demo: Brenner und Gas pruefen", description: "Vor Flachdachtermin Gasbrennerzubehoer kontrollieren.", assigned_to: users.v2.id, due_date: todayOffset(1), status: "in_arbeit", created_by: users.chef.id }
  ]);

  const bringLists = await insertRows(admin, "bring_lists", [
    { company_id: companyId, job_id: jobSchmidt.id, date: todayOffset(1), title: "Demo: Morgen Schmidt vorbereiten", notes: "Vom Hauptlager laden. Fehlende Konterlatten melden.", status: "ready", created_by: users.chef.id, assigned_to: users.v1.id, vehicle_id: vehicles[0].id }
  ]);
  const bringList = bringLists[0];

  await insertRows(admin, "bring_list_items", [
    { bring_list_id: bringList.id, inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id, custom_item_name: "Unterspannbahn diffusionsoffen", item_type: "material", quantity: 120, unit: "m2", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[0].id, missing_reported: false },
    { bring_list_id: bringList.id, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, custom_item_name: "Konterlatte 40/60 impr.", item_type: "material", quantity: 260, unit: "lfm", storage_location: "Hauptlager Koeln", vehicle_id: vehicles[0].id, missing_reported: true, notes: "Bestand reicht voraussichtlich nicht." },
    { bring_list_id: bringList.id, custom_item_name: "PSA-Set und Absturzsicherung", item_type: "safety", quantity: 1, unit: "Set", storage_location: "Sprinter K-DT 210", vehicle_id: vehicles[0].id, missing_reported: false }
  ]);

  await insertRows(admin, "material_alerts", [
    { company_id: companyId, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, job_id: jobSchmidt.id, bring_list_id: bringList.id, alert_type: "low_stock", severity: "critical", message: "Demo: Konterlatten reichen fuer Baustelle Schmidt voraussichtlich nicht aus.", required_quantity: 260, available_quantity: 210, missing_quantity: 50, unit: "lfm", status: "open", created_by_system: true, assigned_to_admin: users.chef.id },
    { company_id: companyId, inventory_item_id: inventoryByName["Spenglerschrauben 4,5x35 Edelstahl"].id, alert_type: "below_minimum_after_reservation", severity: "warning", message: "Demo: Spenglerschrauben liegen unter Mindestbestand.", required_quantity: 500, available_quantity: 280, missing_quantity: 220, unit: "Stueck", status: "open", created_by_system: true, assigned_to_admin: users.chef.id }
  ]);

  await insertRows(admin, "purchase_suggestions", [
    { company_id: companyId, inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id, job_id: jobSchmidt.id, bring_list_id: bringList.id, quantity_needed: 150, unit: "lfm", reason: "Demo: Bestand unter Mindestbestand und Baustelle Schmidt braucht 260 lfm.", status: "open" },
    { company_id: companyId, inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id, job_id: jobKranz.id, quantity_needed: 60, unit: "m2", reason: "Demo: Flachdach Kranz braucht kalkuliert 95 m2 plus Verschnitt.", status: "open" }
  ]);
}

export async function ensureDemoModeData() {
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
  const existingUsers = await listAllUsers(admin);
  const users = Object.fromEntries(
    await Promise.all(demoUsers.map(async (seed) => [seed.key, await ensureDemoUser(admin, seed, company.id, password, existingUsers)] as const))
  ) as Record<string, DemoUser>;

  await admin
    .from("companies")
    .update({
      plan_id: "business",
      subscription_status: "trialing",
      contact_email: "demo@mueller-dachtechnik.example.invalid",
      phone: "0221 555000",
      address: "Werkstrasse 8, 50667 Koeln",
      website: "https://mueller-dachtechnik.example.invalid",
      onboarding_completed_at: new Date().toISOString(),
      created_by: users.chef.id
    })
    .eq("id", company.id);

  await seedDemoData(admin, company.id, users);

  return {
    companyId: company.id,
    companyName: DEMO_COMPANY_NAME,
    chefEmail: DEMO_CHEF_EMAIL,
    password
  };
}
