#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY_NAME = "Müller Dachtechnik GmbH";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || "BauProDemo!2026";
const EMAIL_DOMAIN = "mueller-dachtechnik.example";
const downgradedRoles = new Set();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Bitte NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function todayOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentMonth() {
  const date = new Date();
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

function minutes(start, end, pause) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const gross = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return { gross_minutes: gross, net_minutes: gross - pause };
}

function isMissingSchemaError(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST205" ||
    error?.message?.includes("Could not find the table") ||
    error?.message?.includes("Could not find the column")
  );
}

async function allowMissing(label, promise) {
  const { error, data } = await promise;
  if (error && !isMissingSchemaError(error)) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data ?? null;
}

async function insertRows(table, rows, select = "*") {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select(select);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function insertOptionalRows(table, rows, select = "*") {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select(select);
  if (error && isMissingSchemaError(error)) {
    console.warn(`Ueberspringe ${table}: Tabelle/Spalte fehlt in der Live-Datenbank.`);
    return [];
  }
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function upsertOptionalRow(table, row, onConflict) {
  const { data, error } = await supabase.from(table).upsert(row, { onConflict }).select("*").single();
  if (error && isMissingSchemaError(error)) {
    console.warn(`Ueberspringe ${table}: Tabelle/Spalte fehlt in der Live-Datenbank.`);
    return null;
  }
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Auth-User konnten nicht geladen werden: ${error.message}`);
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < 1000) break;
  }
  return users;
}

async function ensureCompany() {
  const { data: existingRows, error: selectError } = await supabase
    .from("companies")
    .select("id, name")
    .eq("name", COMPANY_NAME)
    .limit(1);

  if (selectError) throw new Error(`companies: ${selectError.message}`);
  if (existingRows?.[0]) return existingRows[0];

  const { data, error } = await supabase.from("companies").insert({ name: COMPANY_NAME }).select("id, name").single();
  if (error) throw new Error(`Demo-Firma konnte nicht angelegt werden: ${error.message}`);
  return data;
}

async function ensureUser({ key, email, fullName, role, companyId }, existingUsers) {
  const existing = existingUsers.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  let authRole = role;
  const buildMetadata = (selectedRole) => ({ company_id: companyId, full_name: fullName, role: selectedRole, demo_key: key });
  const authResult = existing
    ? await supabase.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: buildMetadata(authRole)
      })
    : await supabase.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: buildMetadata(authRole)
      });

  if (authResult.error && role === "vorarbeiter") {
    authRole = "mitarbeiter";
    downgradedRoles.add(email);
    const fallbackResult = existing
      ? await supabase.auth.admin.updateUserById(existing.id, {
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: buildMetadata(authRole)
        })
      : await supabase.auth.admin.createUser({
          email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: buildMetadata(authRole)
        });
    if (fallbackResult.error || !fallbackResult.data.user) {
      throw new Error(`Demo-User ${email}: ${fallbackResult.error?.message ?? "unbekannter Fehler"}`);
    }
    authResult.data = fallbackResult.data;
    authResult.error = null;
  }

  if (authResult.error || !authResult.data.user) {
    throw new Error(`Demo-User ${email}: ${authResult.error?.message ?? "unbekannter Fehler"}`);
  }

  const user = authResult.data.user;
  const profileRow = {
    id: user.id,
    company_id: companyId,
    email,
    full_name: fullName,
    role: authRole,
    active: true
  };
  let { error: profileError } = await supabase.from("profiles").upsert(profileRow, { onConflict: "id" }).select("*").single();

  if (profileError && role === "vorarbeiter") {
    authRole = "mitarbeiter";
    downgradedRoles.add(email);
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: buildMetadata(authRole)
    });
    profileError = (
      await supabase
        .from("profiles")
        .upsert({ ...profileRow, role: authRole }, { onConflict: "id" })
        .select("*")
        .single()
    ).error;
  }

  if (profileError) throw new Error(`profiles: ${profileError.message}`);

  return { key, id: user.id, email, fullName, role: authRole };
}

async function cleanupCompany(companyId) {
  const { data: estimates } = await supabase.from("job_estimates").select("id").eq("company_id", companyId);
  const estimateIds = (estimates ?? []).map((row) => row.id);
  if (estimateIds.length) {
    await allowMissing("job_estimate_items cleanup", supabase.from("job_estimate_items").delete().in("estimate_id", estimateIds));
  }

  const { data: reports } = await supabase.from("time_reports").select("id").eq("company_id", companyId);
  const reportIds = (reports ?? []).map((row) => row.id);
  if (reportIds.length) {
    await allowMissing("time_report_entries cleanup", supabase.from("time_report_entries").delete().in("time_report_id", reportIds));
  }

  const { data: bringLists } = await supabase.from("bring_lists").select("id").eq("company_id", companyId);
  const bringListIds = (bringLists ?? []).map((row) => row.id);
  if (bringListIds.length) {
    await allowMissing("bring_list_items cleanup", supabase.from("bring_list_items").delete().in("bring_list_id", bringListIds));
  }

  const tables = [
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
    "material_reservations",
    "bring_lists",
    "tasks",
    "job_material_requirements",
    "job_material_calculation_items",
    "job_material_calculations",
    "job_dimensions",
    "orders",
    "vehicle_materials",
    "vehicles",
    "inventory_items",
    "suppliers",
    "inventory_locations",
    "materials",
    "customers",
    "calculation_settings",
    "company_pricing_settings",
    "ai_settings"
  ];

  for (const table of tables) {
    await allowMissing(`${table} cleanup`, supabase.from(table).delete().eq("company_id", companyId));
  }
}

async function main() {
  const company = await ensureCompany();
  const existingUsers = await listAllUsers();
  const demoUsers = [
    { key: "chef", email: `chef@${EMAIL_DOMAIN}`, fullName: "Sabine Müller", role: "chef" },
    { key: "v1", email: `niklas@${EMAIL_DOMAIN}`, fullName: "Niklas Berger", role: "vorarbeiter" },
    { key: "v2", email: `tobias@${EMAIL_DOMAIN}`, fullName: "Tobias Klein", role: "vorarbeiter" },
    { key: "m1", email: `max@${EMAIL_DOMAIN}`, fullName: "Max Schneider", role: "mitarbeiter" },
    { key: "m2", email: `lena@${EMAIL_DOMAIN}`, fullName: "Lena Fischer", role: "mitarbeiter" },
    { key: "m3", email: `emre@${EMAIL_DOMAIN}`, fullName: "Emre Yilmaz", role: "mitarbeiter" },
    { key: "m4", email: `sophie@${EMAIL_DOMAIN}`, fullName: "Sophie Weber", role: "mitarbeiter" },
    { key: "m5", email: `jan@${EMAIL_DOMAIN}`, fullName: "Jan Hoffmann", role: "mitarbeiter" }
  ];

  const users = {};
  for (const demoUser of demoUsers) {
    const user = await ensureUser({ ...demoUser, companyId: company.id }, existingUsers);
    users[user.key] = user;
  }

  await cleanupCompany(company.id);

  await upsertOptionalRow(
    "company_pricing_settings",
    {
      company_id: company.id,
      waste_percent: 20,
      default_markup_percent: 35,
      auto_calculate_sales_price: true,
      created_by: users.chef.id
    },
    "company_id"
  );

  await upsertOptionalRow(
    "calculation_settings",
    {
      company_id: company.id,
      default_waste_percent: 20,
      default_vat_rate: 19,
      default_labor_rate_net: 68,
      default_internal_hourly_cost: 39,
      default_profit_markup_percent: 12,
      default_overhead_percent: 14,
      default_travel_flat_rate: 45,
      allow_ai_job_creation: true,
      require_admin_confirmation: true
    },
    "company_id"
  );

  await upsertOptionalRow(
    "ai_settings",
    {
      company_id: company.id,
      enabled: true,
      default_model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      allow_employee_ai: true,
      allow_ai_daily_reports: true,
      allow_ai_time_tracking: true,
      allow_ai_material_matching: true
    },
    "company_id"
  );

  const customers = await insertRows("customers", [
    {
      company_id: company.id,
      customer_type: "privatkunde",
      first_name: "Anna",
      last_name: "Schmidt",
      phone: "0221 555010",
      email: "anna.schmidt@example.com",
      billing_address: "Hauptstrasse 12, 50667 Koeln",
      jobsite_address: "Hauptstrasse 12, 50667 Koeln",
      notes: "Steildachsanierung mit Tonziegeln, Zugang ueber Hof.",
      status: "aktiv",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_type: "gewerbekunde",
      company: "Baeckerei Kranz GmbH",
      contact_person: "Thomas Kranz",
      phone: "0211 555019",
      email: "technik@baeckerei-kranz.example",
      billing_address: "Marktallee 7, 40213 Duesseldorf",
      jobsite_address: "Marktallee 7, 40213 Duesseldorf",
      notes: "Flachdach ueber Produktion, Arbeiten nur ab 14 Uhr moeglich.",
      status: "aktiv",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_type: "hausverwaltung",
      company: "Hausverwaltung Rheinblick",
      contact_person: "Katrin Neumann",
      phone: "0228 555023",
      email: "service@rheinblick.example",
      billing_address: "Bonner Strasse 88, 53111 Bonn",
      jobsite_address: "Rosenweg 4, 53115 Bonn",
      notes: "Mehrfamilienhaus, Dachrinne und Fallrohre erneuern.",
      status: "aktiv",
      created_by: users.chef.id
    }
  ]);

  const [schmidt, kranz] = customers;
  const jobsites = await insertRows("jobsites", [
    {
      company_id: company.id,
      name: "Steildachsanierung Schmidt",
      customer: "Anna Schmidt",
      address: "Hauptstrasse 12, 50667 Koeln",
      start_date: todayOffset(1),
      status: "aktiv",
      notes: "120 m2 Dachflaeche, Traufe 18 m, First 11 m. Unterspannbahn und Lattung morgen starten.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m2.id, users.m3.id],
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      name: "Flachdach Baeckerei Kranz",
      customer: "Baeckerei Kranz GmbH",
      address: "Marktallee 7, 40213 Duesseldorf",
      start_date: todayOffset(3),
      status: "geplant",
      notes: "Schweissbahn Oberlage, Daemmung pruefen, Ablaufe freihalten.",
      assigned_employee_ids: [users.v2.id, users.m4.id, users.m5.id],
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      name: "Rinnenanlage Rosenweg",
      customer: "Hausverwaltung Rheinblick",
      address: "Rosenweg 4, 53115 Bonn",
      start_date: todayOffset(2),
      status: "geplant",
      notes: "Dachrinne 28 m, zwei Fallrohre, Bewohnerinfo beachten.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m5.id],
      created_by: users.chef.id
    }
  ]);

  const [jobSchmidt, jobKranz, jobRheinblick] = jobsites;
  await insertOptionalRows("orders", [
    {
      company_id: company.id,
      customer_id: schmidt.id,
      jobsite_id: jobSchmidt.id,
      order_number: `AU-${new Date().getFullYear()}-0001`,
      title: "Steildachsanierung Schmidt",
      order_type: "steildach",
      status: "in_arbeit",
      priority: "hoch",
      jobsite_address: jobSchmidt.address,
      start_date: todayOffset(1),
      description: "Unterspannbahn, Konterlattung, Dachlattung und Tonziegel erneuern.",
      internal_notes: "Geruest steht. Materialcheck bis heute 16 Uhr.",
      assigned_employee_ids: [users.v1.id, users.m1.id, users.m2.id, users.m3.id],
      has_dimensions: true,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      customer_id: kranz.id,
      jobsite_id: jobKranz.id,
      order_number: `AU-${new Date().getFullYear()}-0002`,
      title: "Flachdach Baeckerei Kranz",
      order_type: "flachdach",
      status: "angebot",
      priority: "normal",
      jobsite_address: jobKranz.address,
      start_date: todayOffset(3),
      description: "Vor-Kalkulation fuer 95 m2 Flachdach mit Dampfsperre, Daemmung und Oberlage.",
      internal_notes: "Preisbindung beim Baustoffhandel pruefen.",
      assigned_employee_ids: [users.v2.id, users.m4.id, users.m5.id],
      has_dimensions: true,
      created_by: users.chef.id
    }
  ]);

  const locations = await insertRows("inventory_locations", [
    { company_id: company.id, name: "Hauptlager Koeln", location_type: "Hauptlager", notes: "Regal A-C, Palettenplatz hinten" },
    { company_id: company.id, name: "Sprinter K-DT 210", location_type: "Fahrzeuglager", notes: "Vorarbeiter Niklas" },
    { company_id: company.id, name: "Sprinter K-DT 211", location_type: "Fahrzeuglager", notes: "Vorarbeiter Tobias" },
    { company_id: company.id, name: "Container Schmidt", location_type: "Baustelle", notes: "Baustelle Hauptstrasse 12" }
  ]);
  const location = Object.fromEntries(locations.map((row) => [row.name, row]));

  const suppliers = await insertRows("suppliers", [
    { company_id: company.id, name: "Baustoffhandel Rhein", contact_name: "Herr Vogel", phone: "0221 555030", active: true },
    { company_id: company.id, name: "Wuerth Niederlassung Koeln", contact_name: "Frau Klein", phone: "0221 555031", active: true }
  ]);

  const inventory = await insertRows("inventory_items", [
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Unterspannbahn diffusionsoffen",
      unit: "m2",
      stock: 160,
      minimum_stock: 80,
      package_unit: "Rolle 75 m2",
      manufacturer: "Klober",
      purchase_price: 1.85,
      sales_price: 3.1,
      markup_percent: 35,
      sales_unit: "m2",
      price_per_unit: 3.1,
      notes: "Standard fuer Steildach, immer auf Mindestbestand achten.",
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Dachlatte 30/50 impr.",
      unit: "lfm",
      stock: 420,
      minimum_stock: 300,
      package_unit: "Bund",
      purchase_price: 0.72,
      sales_price: 1.15,
      markup_percent: 40,
      sales_unit: "lfm",
      price_per_unit: 1.15,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Konterlatte 40/60 impr.",
      unit: "lfm",
      stock: 210,
      minimum_stock: 250,
      package_unit: "Bund",
      purchase_price: 0.9,
      sales_price: 1.42,
      markup_percent: 38,
      sales_unit: "lfm",
      price_per_unit: 1.42,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Sprinter K-DT 210"].id,
      supplier_id: suppliers[1].id,
      name: "Spenglerschrauben 4,5x35 Edelstahl",
      unit: "Stueck",
      stock: 280,
      minimum_stock: 500,
      package_unit: "Pack 100",
      manufacturer: "Wuerth",
      purchase_price: 0.08,
      sales_price: 0.16,
      markup_percent: 50,
      sales_unit: "Stueck",
      price_per_unit: 0.16,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Schweissbahn PYE PV200 S5 Oberlage",
      unit: "m2",
      stock: 70,
      minimum_stock: 120,
      package_unit: "Rolle 5 m2",
      purchase_price: 8.4,
      sales_price: 13.9,
      markup_percent: 40,
      sales_unit: "m2",
      price_per_unit: 13.9,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Hauptlager Koeln"].id,
      supplier_id: suppliers[0].id,
      name: "Rinnenhalter verzinkt RG 333",
      unit: "Stueck",
      stock: 38,
      minimum_stock: 60,
      package_unit: "Stueck",
      purchase_price: 2.2,
      sales_price: 4.1,
      markup_percent: 42,
      sales_unit: "Stueck",
      price_per_unit: 4.1,
      created_by: users.chef.id
    },
    {
      company_id: company.id,
      location_id: location["Container Schmidt"].id,
      supplier_id: suppliers[0].id,
      name: "Tonziegel naturrot",
      unit: "Stueck",
      stock: 1380,
      minimum_stock: 0,
      package_unit: "Palette",
      purchase_price: 0.94,
      sales_price: 1.55,
      markup_percent: 39,
      sales_unit: "Stueck",
      price_per_unit: 1.55,
      created_by: users.chef.id
    }
  ]);
  const inventoryByName = Object.fromEntries(inventory.map((row) => [row.name, row]));

  const vehicles = await insertRows("vehicles", [
    { company_id: company.id, name: "Sprinter 210", license_plate: "K-DT 210", tuv_date: todayOffset(210), notes: "Leitertraeger, Gasflaschenhalter" },
    { company_id: company.id, name: "Pritsche 211", license_plate: "K-DT 211", tuv_date: todayOffset(95), notes: "Materialtransport, Anhängerkupplung" }
  ]);

  const timeEntries = [];
  for (const row of [
    { user: users.m1, job: jobSchmidt, date: todayOffset(-2), start: "07:00", end: "16:00", pause: 45, activity: "Geruestzugang geprueft, alte Lattung aufgenommen" },
    { user: users.m2, job: jobSchmidt, date: todayOffset(-2), start: "07:15", end: "16:00", pause: 45, activity: "Unterspannbahn vorbereitet, Dachflaechen gereinigt" },
    { user: users.v1, job: jobSchmidt, date: todayOffset(-1), start: "06:45", end: "15:45", pause: 60, activity: "Materialannahme, Einweisung Team, Ortgang geprueft" },
    { user: users.m4, job: jobKranz, date: todayOffset(-1), start: "08:00", end: "15:30", pause: 30, activity: "Aufmass Flachdach, Abläufe kontrolliert" },
    { user: users.m5, job: jobRheinblick, date: todayOffset(0), start: "07:30", end: "14:30", pause: 30, activity: "Dachrinne demontiert und Fallrohrlaengen aufgenommen" }
  ]) {
    timeEntries.push({
      company_id: company.id,
      employee_id: row.user.id,
      job_id: row.job.id,
      date: row.date,
      work_location: row.job.name,
      work_address: row.job.address,
      start_time: row.start,
      end_time: row.end,
      break_minutes: row.pause,
      ...minutes(row.start, row.end, row.pause),
      activity: row.activity,
      weather: "trocken",
      kilometers: 18,
      notes: null,
      status: "approved",
      approved_by: users.chef.id,
      approved_at: new Date().toISOString(),
      created_by: row.user.id
    });
  }
  const insertedTimeEntries = await insertOptionalRows("time_entries", timeEntries);

  await insertOptionalRows("reports", [
    {
      company_id: company.id,
      jobsite_id: jobSchmidt.id,
      report_date: todayOffset(-1),
      weather: "trocken, 21 Grad",
      work_start: "06:45",
      work_end: "15:45",
      employee_ids: [users.v1.id, users.m1.id, users.m2.id],
      activities: "Material angenommen, Unterspannbahn begonnen, Ortgang und Traufe kontrolliert.",
      material_usage: "Unterspannbahn 75 m2, Dachlatten 110 lfm, Konterlatten 60 lfm.",
      issues: "Konterlattenbestand knapp, Nachbestellung erforderlich.",
      signature_name: "Niklas Berger",
      created_by: users.v1.id
    },
    {
      company_id: company.id,
      jobsite_id: jobRheinblick.id,
      report_date: todayOffset(0),
      weather: "bedeckt",
      work_start: "07:30",
      work_end: "14:30",
      employee_ids: [users.m5.id],
      activities: "Alte Rinne demontiert, Maße fuer neue Rinne und Fallrohre aufgenommen.",
      material_usage: "Rinnenhalter Muster, Schrauben.",
      issues: "Ein Ablaufstutzen stark korrodiert.",
      signature_name: "Jan Hoffmann",
      created_by: users.m5.id
    }
  ]);

  await insertOptionalRows("tasks", [
    {
      company_id: company.id,
      jobsite_id: jobSchmidt.id,
      title: "Konterlatten nachbestellen",
      description: "Mindestens 150 lfm fuer Schmidt reservieren.",
      assigned_to: users.chef.id,
      due_date: todayOffset(0),
      status: "offen",
      created_by: users.v1.id
    },
    {
      company_id: company.id,
      jobsite_id: jobKranz.id,
      title: "Brenner und Gas pruefen",
      description: "Vor Flachdachtermin Gasbrennerzubehoer kontrollieren.",
      assigned_to: users.v2.id,
      due_date: todayOffset(2),
      status: "in_arbeit",
      created_by: users.chef.id
    }
  ]);

  const bringLists = await insertOptionalRows("bring_lists", [
    {
      company_id: company.id,
      job_id: jobSchmidt.id,
      date: todayOffset(1),
      title: "Morgen: Schmidt Dachflaeche vorbereiten",
      notes: "Vom Hauptlager und Container Schmidt laden. Fehlende Konterlatten melden.",
      status: "ready",
      created_by: users.chef.id,
      assigned_to: users.v1.id,
      vehicle_id: vehicles[0].id
    }
  ]);
  const bringList = bringLists[0] ?? null;

  if (bringList) {
    await insertOptionalRows("bring_list_items", [
      {
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id,
        custom_item_name: "Unterspannbahn diffusionsoffen",
        item_type: "material",
        quantity: 120,
        unit: "m2",
        storage_location: "Hauptlager Koeln",
        vehicle_id: vehicles[0].id,
        missing_reported: false
      },
      {
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id,
        custom_item_name: "Konterlatte 40/60 impr.",
        item_type: "material",
        quantity: 260,
        unit: "lfm",
        storage_location: "Hauptlager Koeln",
        vehicle_id: vehicles[0].id,
        missing_reported: true,
        notes: "Bestand reicht voraussichtlich nicht."
      },
      {
        bring_list_id: bringList.id,
        custom_item_name: "PSA-Set und Absturzsicherung",
        item_type: "safety",
        quantity: 1,
        unit: "Set",
        storage_location: "Sprinter K-DT 210",
        vehicle_id: vehicles[0].id,
        missing_reported: false
      }
    ]);
  }

  await insertOptionalRows("material_alerts", [
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id,
      job_id: jobSchmidt.id,
      bring_list_id: bringList?.id ?? null,
      alert_type: "low_stock",
      severity: "critical",
      message: "Konterlatten reichen fuer Baustelle Schmidt voraussichtlich nicht aus.",
      required_quantity: 260,
      available_quantity: 210,
      missing_quantity: 50,
      unit: "lfm",
      status: "open",
      created_by_system: true,
      assigned_to_admin: users.chef.id
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Spenglerschrauben 4,5x35 Edelstahl"].id,
      alert_type: "below_minimum_after_reservation",
      severity: "warning",
      message: "Spenglerschrauben liegen unter Mindestbestand.",
      required_quantity: 500,
      available_quantity: 280,
      missing_quantity: 220,
      unit: "Stueck",
      status: "open",
      created_by_system: true,
      assigned_to_admin: users.chef.id
    }
  ]);

  await insertOptionalRows("purchase_suggestions", [
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Konterlatte 40/60 impr."].id,
      job_id: jobSchmidt.id,
      bring_list_id: bringList?.id ?? null,
      quantity_needed: 150,
      unit: "lfm",
      reason: "Bestand unter Mindestbestand und Baustelle Schmidt benoetigt 260 lfm.",
      status: "open"
    },
    {
      company_id: company.id,
      inventory_item_id: inventoryByName["Schweissbahn PYE PV200 S5 Oberlage"].id,
      job_id: jobKranz.id,
      quantity_needed: 60,
      unit: "m2",
      reason: "Flachdach Kranz braucht kalkuliert 95 m2 plus Verschnitt.",
      status: "open"
    }
  ]);

  if (bringList) {
    await insertOptionalRows("material_reservations", [
      {
        company_id: company.id,
        job_id: jobSchmidt.id,
        bring_list_id: bringList.id,
        inventory_item_id: inventoryByName["Unterspannbahn diffusionsoffen"].id,
        quantity_required: 120,
        quantity_reserved: 120,
        unit: "m2",
        status: "reserved",
        reserved_by: users.chef.id,
        reserved_at: new Date().toISOString()
      }
    ]);
  }

  const { month, year } = currentMonth();
  const monthEntries = insertedTimeEntries.filter((entry) => entry.employee_id === users.m1.id);
  if (monthEntries.length) {
    const report = await insertOptionalRows(
      "time_reports",
      [
        {
          company_id: company.id,
          employee_id: users.m1.id,
          month,
          year,
          date_from: `${year}-${String(month).padStart(2, "0")}-01`,
          date_to: `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`,
          status: "generated",
          generated_by: users.chef.id
        }
      ],
      "id"
    );
    if (report[0]) {
      await insertOptionalRows(
        "time_report_entries",
        monthEntries.map((entry) => ({ time_report_id: report[0].id, time_entry_id: entry.id }))
      );
    }
  }

  console.log("Demo-Firma wurde erstellt/aktualisiert.");
  console.log(`Firma: ${COMPANY_NAME}`);
  console.log(`Chef-Login: chef@${EMAIL_DOMAIN}`);
  console.log(`Passwort: ${DEMO_PASSWORD}`);
  console.log("Weitere Logins: niklas, tobias, max, lena, emre, sophie, jan @mueller-dachtechnik.example");
  if (downgradedRoles.size) {
    console.warn(
      "Hinweis: Die Live-Datenbank kennt die Rolle 'vorarbeiter' noch nicht. Fuehre supabase/migrations/20260615_roles_security_hardening.sql aus und starte npm run seed:demo erneut."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
